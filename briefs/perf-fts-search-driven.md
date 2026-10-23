# FTS-driven search candidates (perf/fts-search-driven)

Base `11dc3c5` (`origin/integration/stage`, round-8 head). Implementation in
worktree `/home/monkey/code/noctua-mail/wt-perf-fts-search`, branch
`perf/fts-search-driven`. Commits: `03d486e` (candidate resolution +
differential tests), `82ce499` (bounded fetches + oversized-token probe);
fix round 1: `55870b6` (F2), `10aafaf` (F4), `b3352c9` (F5) — see
"Fix round 1" below; fix round 2 (review r1 follow-ups): `5a06bd4` (R1),
`78d8347` (fts_error classes), `d4c2b46` (R3) — see "Fix round 2". Review
by the Umbau thread before merge, per task.

## Summary

Rank 1 of `perf-backlog-rerank-r8.md`. The search clause in
`lib/db/messages/query.ts` repeated, inside every selector/count/group
statement, one `(accountId, id) IN (SELECT accountId, messageId FROM
message_fts_v3 WHERE ... MATCH ?)` subquery per token, a correlated
attachment `EXISTS` per token, and three id `LIKE`s. A single
`listThreads` search executed that shape in five statements (thread
selector, thread total, message total, base count, thread group counts);
`listMessages` in three. SQLite planned each one as an account-index scan
of `messages` with a bloom filter over the FTS result — cost tracks
account size, not hit count.

Now the candidate message-id set is resolved **once per top-level list
call** (`resolveSearchCandidateIds` in `query.ts`), driven from FTS v3
`MATCH`, with the two semantics FTS cannot express — attachment filenames
(not indexed) and Message-ID/threadId/local-id substrings — unioned in via
their existing explicit `LIKE` paths. The resolved set is passed to the
selector and to `getTotalCount`/`getGroupCounts`, where it becomes
`m.id IN (?,...)` (or `0 = 1` when empty). Counts/groups then plan as
primary-key probes (`sqlite_autoindex_messages_1 (accountId=? AND id=?)`).

Unselective searches keep the legacy inline clause: if the candidate set
would exceed the cap (default 2000, `NOCTUA_FTS_DRIVEN_MAX_CANDIDATES`),
resolution returns `legacy`. Every fetch is capped at `LIMIT cap+1` so a
discarded resolution stays cheap; a token whose own set exceeds the cap
is not materialized — it is probed against the bounded intersection of
the remaining tokens using its verbatim legacy per-token clause. If every
token is oversized, resolution returns `legacy` without further work.
`NOCTUA_DISABLE_FTS_DRIVEN_SEARCH=1` forces the legacy clause everywhere
(kill switch; also the differential-test toggle).

11k synthetic shard (paired interleaved medians, this box at load ~30;
absolute values inflated vs the rerank run at load 5–10, ratios are the
signal): real `listThreads` search `needle` **99.04 → 49.38 ms**,
two-token `needle gamma` **288.16 → 92.31 ms**, attachment search
`invoice` **97.44 → 44.64 ms**, `listMessages` `needle` **61.36 → 23.60
ms**, unselective `synthetic` (fallback) **388.08 → 385.50 ms** (≈0 at
load ~30; review r1 measured **+2.7 % to +4.3 %** on quieter runs — see
"Fix round 2", R2),
`from:`-only and default list unchanged (≈0, identical SQL). The rerank
baseline for the same real search at low load was **81.03 ms**; the raw
comparison still measures **14.81 ms OR-scan vs 0.20 ms FTS-driven**
(rerank: 13.94 / 0.21), same 28 ids.

No schema change. No `PRAGMA optimize`/`ANALYZE`. Writer guards,
`withDbWriteRetry`, `lib/db/schema.ts`, connection and all no-touch files
untouched. Change is confined to `lib/db/messages/query.ts` plus one new
test file.

## Semantics preserved, and how

Legacy predicate (per `applySearchQueryFilters` before this change):

```
( (token1_FTS OR token1_attachment) AND (token2_FTS OR token2_attachment) AND ... )
OR lower(messageId) LIKE '%<whole raw query>%'
OR lower(threadId)  LIKE '%<whole raw query>%'
OR lower(id)        LIKE '%<whole raw query>%'
```

Resolution reproduces exactly this set:

- **Per-token FTS**: the identical scoped MATCH strings from
  `buildScopedFtsTokenQueries` (same columns, same `token*` prefix, same
  quoted `"..."*` form for non-alphanumeric tokens), now executed as a
  driving `SELECT messageId FROM message_fts_v3 WHERE ... MATCH ? AND
  accountId = ?` instead of a tuple-`IN` subquery. The account filter is
  equivalent because every call site already scopes `m.accountId = ?`;
  FTS v3's `(accountId, messageId)` identity keeps shared-shard accounts
  with identical local ids apart (tested).
- **Multi-token AND**: per-token sets are intersected in JS. This matters
  when attachment filenames are in play (the default): token 1 may hit
  via FTS while token 2 hits only via a filename — a single combined
  MATCH cannot express that mix, so the per-token form is the exact one.
  When no attachment terms exist (explicit `fields` without
  `attachments`) and there are 2+ tokens, resolution uses **one**
  combined MATCH, the token queries joined with `AND`.
- **Attachment-name-only hits**: same `lower(COALESCE(filename,''))
  LIKE '%term%'` over `attachments`, now driving (`SELECT messageId ...
  WHERE accountId = ? AND ...`) instead of a per-message correlated
  `EXISTS`. Unioned per token with that token's FTS set, as before.
- **Message-ID / threadId / local-id substrings**: the verbatim three
  `lower(...) LIKE '%<rawQuery lowercase>%'` clauses over `messages`,
  unioned with the token intersection — including the legacy quirk that
  the pattern is the *whole* remaining raw query (spaces included), and
  that a symbol-only query (`!!!`) produces only this clause.
- **Prefix/Unicode behaviour**: unchanged tokenization both sides — the
  same `buildSearchTokens`/`buildFtsTokenQuery` output feeds both paths.
  Differential corpus covers umlauts (`grüße`, `GRÜSSE`, `köl`), prefixes
  (`needl`), non-prefix infixes (`eedle`), dashed tokens
  (`budget-2026`, `unique-xyzzy-42@example`), quoted input and email-ish
  tokens.
- **`from:`/`to:`/`with:`/`in:`/`thread:`/`topic:`/`invite:` filters,
  `fields` column scoping, badges (flagged/unread/...), folder/thread
  scoping, excluded folders, attachments-only**: untouched code; they
  AND with the candidate clause exactly where the legacy clause was
  ANDed. The `from:` expression-index situation is unchanged: the
  `from:`-only SQL is byte-identical before/after and its EXPLAIN plan
  is identical (the planner does not pick
  `idx_messages_account_from_lower` in either mode on this fixture, per
  `perf-sqlite.md` item 4 — there was no plan regression to preserve
  against; no statement that used the index before changed shape).
- **Thread-selector flagged ordering**: `shouldPrioritizeFlaggedThreads`
  / `isUnfilteredThreadList` still derive from the same
  `hasQuery/hasIdQuery/hasAttachmentFilenameQuery` flags returned by
  `applySearchQueryFilters`; with no search terms resolution is `none`
  and the where clause is untouched. The existing
  `query.threadSelector.test.ts` differential (EXISTS flagged ordering)
  passes unchanged.
- **Deleted/visibility filters**: candidates are account-wide;
  `applyVisibleMessageFilters` (deleted etc.) still filters in every
  consuming statement, as it did after the legacy clause.
- **Empty result**: empty candidate set becomes `AND (0 = 1)`; legacy
  produced an equivalent always-false disjunction. Corpus covers it.
- **FTS identity collisions**: two accounts on one physical shard with
  identical local message ids (the v3 collision case) stay isolated —
  every candidate fetch is `accountId`-scoped and the consuming
  statements keep `m.accountId = ?` next to `m.id IN (...)`.

One deliberate deviation from the rank-1 sketch, for the reviewer:
"one FTS v3 MATCH" holds per token (and as a single combined MATCH when
attachments cannot mix). A single MATCH for the *whole* predicate is
impossible without dropping either the per-token attachment mixing or
the id-substring union, both of which are current semantics. What is
"one" is the resolution: computed once per top-level call and reused by
selector + all counts/groups instead of re-evaluated per statement.

## Query-by-query: statements and EXPLAIN QUERY PLAN

Captured from real `listThreads`/`listMessages` calls on the 11k bench
shard (prepare-wrapping capture in the harness, both modes).
Full SQL, args and plans: `briefs/perf-fts-search-driven/bench-results.json`,
`replay-results.json`. Plan lines below are the decisive ones.

New resolution statements (driven only, once per top-level call):

| Statement | Plan |
|---|---|
| `SELECT messageId FROM message_fts_v3 WHERE message_fts_v3 MATCH ? AND accountId = ? LIMIT ?` | `SCAN message_fts_v3 VIRTUAL TABLE INDEX 0:M9` (MATCH-driven term scan, 28 rows for `needle`) |
| `SELECT messageId FROM attachments WHERE accountId = ? AND lower(COALESCE(filename,'')) LIKE ? LIMIT ?` | `SEARCH attachments USING INDEX sqlite_autoindex_attachments_1 (accountId=?)` |
| `SELECT id FROM messages WHERE accountId = ? AND (lower(messageId) LIKE ? OR lower(threadId) LIKE ? OR lower(id) LIKE ?) LIMIT ?` | `SEARCH messages USING INDEX idx_messages_account_folder_unread (accountId=?)` — one account pass, once, instead of inside every statement |

Per consuming statement (`needle`, 28 candidates):

| Statement | Before (legacy) | After (driven) |
|---|---|---|
| Thread selector `... t.threadId IN (SELECT DISTINCT m.threadId FROM messages m WHERE ...)` | `SEARCH m USING idx_messages_account_thread_date (accountId=?)` + `LIST SUBQUERY: SCAN message_fts_v3 VIRTUAL TABLE` + `CREATE BLOOM FILTER` + correlated attachment `EXISTS` per row | `SEARCH m USING idx_messages_account_thread_date (accountId=?)` + `CREATE BLOOM FILTER` (over the 28-id IN list; no FTS subquery, no attachment EXISTS) |
| Thread total `COUNT(*) FROM threads t WHERE ... IN (threadFilterSql)` | same FTS subquery + bloom + attachment EXISTS | same thread-date walk, no FTS/attachment subqueries |
| Message total (`getTotalCount`) | `SEARCH m USING idx_messages_account_folder_unread (accountId=?)` + FTS `LIST SUBQUERY` + bloom + attachment EXISTS | `SEARCH m USING INDEX sqlite_autoindex_messages_1 (accountId=? AND id=?)` — 28 PK probes |
| Base count (`... AND m.threadId IN (page threads)`) | FTS subquery + bloom + attachment EXISTS on a thread-index walk | thread-index walk only |
| Thread group counts (`getThreadGroupCounts`, date) | `idx_messages_account_folder_unread` walk + FTS subquery + bloom + EXISTS, `SEARCH t` PK, temp b-tree group | `SEARCH m USING sqlite_autoindex_messages_1 (accountId=? AND id=?)`, `SEARCH t` PK, temp b-tree group |
| `listMessages` main select (ORDER BY dateValue DESC LIMIT) | `idx_messages_account_date` walk + FTS `LIST SUBQUERY` + bloom + 3 correlated attachment subqueries (search + 2 projections) | `idx_messages_account_date` walk (kept for ordering) + only the 2 projection subqueries; search reduces to IN-list membership per walked row |
| `listMessages` group counts (`getGroupCounts`, date) | folder-unread walk + FTS subquery + bloom + EXISTS + temp b-tree | `sqlite_autoindex_messages_1 (accountId=? AND id=?)` probes + temp b-tree |
| `from:`-only selector/counts/groups | `lower(COALESCE(m.fromAddr,'')) LIKE ?` on folder-unread / thread-date walks | **identical SQL, identical plans** (no tokens → resolution `none`) |

FTS virtual-table scans per `listThreads` search: **5 → 1** (the one
resolution MATCH). Per `listMessages` search: **3 → 1**.

## Differential tests

`lib/db/messages/query.ftsSearchDriven.test.ts` (49 tests, 442 expects
at `82ce499`; 67 after fix round 1, 101 after fix round 2 — see below),
built on the existing shared-shard synthetic fixture
(`createSharedShardFixture`: two accounts, one physical shard, identical
local ids — the FTS v3 collision case). Every corpus entry runs the real
`listThreads` and `listMessages` (pages 1–2, pageSize 3) twice — legacy
forced via `NOCTUA_DISABLE_FTS_DRIVEN_SEARCH=1`, then driven — and
asserts `JSON.stringify` byte-identity of the full payloads (items,
order, groups, total, hasMore, baseCount).

Corpus (44 cases + spot checks + collision isolation + tiny-cap +
path-engaged tests): plain word; 2/3-token AND; quoted input; prefix
and infix fragments; umlauts (lower/upper/prefix); Message-ID fragment
and dashed Message-ID token; threadId and local-id substrings;
attachment-name-only and dashed attachment names; mixed FTS+attachment
tokens in both orders (`zebra quokka` hits via body+filename and
filename+body); `from:`/`to:`/`with:`/`in:`/`thread:` combined with
tokens; `from:` infix substring (`from:lic`); email-ish token;
symbol-only query; empty results (1 and 2 tokens); `fields`
subject/body/sender/attachments/preview (body case exercises the
combined single MATCH); preview token under default fields (must not
hit); flagged/unread badges; inbox/archive folder scope; `groupBy`
sender/domain/folder/week/year/none; `from`/`recipients` param lists.
Spot checks assert the intended non-empty hit sets for the semantic
corner cases (mixed tokens, id substrings, attachment-only, preview
scoping, deleted exclusion). The tiny-cap test
(`NOCTUA_FTS_DRIVEN_MAX_CANDIDATES=3`) forces the oversized-token probe
and full-legacy fallback paths on the small fixture, still
byte-identical; the same paths are exercised at 11k by the bench
(`needle gamma` probes: `gamma` matches every body; `synthetic` falls
back), where legacy/driven payload JSON also compared equal for all
seven bench cases.

One test spies on `prepare` to prove the driven path actually engages:
driven mode shows the resolution MATCH and `.id IN (?...)` clauses and
zero legacy `IN (SELECT accountId, messageId FROM ...)` subqueries;
legacy mode shows the subquery.

## Bench (11k synthetic shard)

Harness: `briefs/perf-fts-search-driven/bench.ts` (adapted from
`perf-backlog-rerank-r8/sql.ts`: same 11,000 messages / 3,667 threads /
3,900-char bodies / `needle` every 400th subject → 28 hits, plus an
attachment every 500th message; production schema via `getAccountDb`,
guards intact, FTS rows seeded through `message_fts_identity`
allocation). Method: after one warmup per mode, 9 interleaved paired
reps per case (mode order alternates per rep to cancel cache-warming
bias), median reported. Bun 1.4.4 / SQLite 3.53.4. **Load caveat:**
shared-box loadavg 1-min was ~30–33 during the run (other agents
active), vs 4.5–10.5 for the rerank numbers; absolutes are inflated,
the legacy side of each pair ran under the same load, and the
identical-SQL controls (`from:`-only, default list) come out ≈0, which
bounds the noise.

| Case (pageSize 300) | Legacy ms (median [min–max]) | Driven ms (median [min–max]) | Δ |
|---|---:|---:|---:|
| `listThreads` search `needle` | 99.04 [90.46–136.46] | 49.38 [43.29–102.60] | **−50%** |
| `listThreads` search `needle gamma` | 288.16 [274.82–433.95] | 92.31 [89.23–268.85] | **−68%** |
| `listThreads` search `invoice` (attachment) | 97.44 [85.26–233.14] | 44.64 [43.64–77.44] | **−54%** |
| `listThreads` search `synthetic` (11k hits → fallback) | 388.08 [340.39–749.94] | 385.50 [334.68–446.66] | ≈0 (r1: +2.7 to +4.3 %) |
| `listThreads` `from:sender` only (control, identical SQL) | 81.43 [78.60–89.75] | 83.48 [78.01–160.55] | ≈0 |
| `listMessages` search `needle` | 61.36 [60.09–87.24] | 23.60 [22.74–29.81] | **−62%** |
| `listThreads` default (control) | 70.02 [62.21–74.04] | 66.40 [62.98–114.75] | ≈0 |
| Raw rerank pair: OR-scan shape vs FTS-driven join | 14.81 [14.38–23.48] | 0.20 [0.19–0.24] | same 28 ids |

Notes: (a) the first (unpaired) run with uncapped fetches showed
`synthetic` driven *slower* (411 vs 330 ms) — that wasted-work case is
what the capped fetches in `82ce499` removed; the paired run above is
the capped implementation. (b) Driven `needle` (49 ms) is now cheaper
than the default 300-thread list (66–70 ms): the residual is member
projection + counts that the rerank already attributed to the list
contract, not search. (c) Payload JSON was equal legacy vs driven for
all seven cases on the 11k shard. Statement-level replay timings for
every captured selector/count/group statement are in
`replay-results.json` next to the harness. Highlights from that replay
(median of 7, same loaded box, legacy block replayed before driven):
legacy selector 39.9 ms, thread total 36.7 ms, message total 37.2 ms,
thread group counts 41.4 ms, `listMessages` main 44.2 ms / group 52.2 ms
/ total 42.0 ms — the search shape paid ~37–52 ms **per statement**.
Driven: resolution MATCH 0.26 ms + attachment fetch 0.03 ms + id-substring
pass 28.3 ms **once**, then message total 0.07 ms, thread group counts
0.07 ms, `listMessages` group 0.05 ms / total 0.04 ms; the thread
selector (26.5 ms) and the member projection (25.2 ms) remain
account-walk bound in both modes. The id-substring pass is now the
largest single driven statement — the price of preserving
Message-ID/threadId/local-id substring semantics without an index or
schema change (see risk 8).

## Verification

Commands (cwd `wt-perf-fts-search`, heavy ones under `nice -n 10`,
`TMPDIR=$PWD/.tmp/fts-search/tmp`):

- `bun run typecheck` — 0 errors, 1,195 files.
- `bun run lint` — 1 error + 25 warnings, exactly the `11dc3c5`
  baseline (pre-existing `react-hooks/set-state-in-effect` in
  `useCalendarConflicts.ts:58` area); no new findings.
- Targeted: `bun test lib/db/messages/query.ftsSearchDriven.test.ts` —
  49 pass / 0 fail. Existing search-adjacent suites
  (`query.threadSelector`, `query.unassigned`, `threadTopicSearch`,
  `calendarInviteSearch`, `db.sharedShard`) — 23 pass / 0 fail.
- `bun run test:ci` — **2853 unit pass / 0 fail** (305 files, 588.96 s
  Bun-reported) + **462 DOM pass / 0 fail** (58 files, 92.65 s), exit 0.
  Baseline on `11dc3c5` was 2804 + 462; the delta is exactly the 49 new
  differential tests.
- **Fix round 1 (HEAD `b3352c9`):** `bun run typecheck` 0 errors (1,195
  files); `bun run lint` 1 error + 25 warnings (baseline, unchanged);
  `bun test lib/db/messages` 97 pass / 0 fail (differential file 67).
  `bun run test:ci` (load 8→16): **2870 unit pass / 1 fail** (2871 tests,
  305 files, 442.60 s) — the one failure is `lib/sendIdentity.routes.test.ts`
  with `SQLITE_BUSY` (`database is locked`) on a master-DB
  `DELETE FROM user_accounts` at `lib/testFixtures/verifySenderIdentity.ts:339`,
  a file this branch does not touch; rerun alone 5× → 4 pass, 1 fail
  (same `SQLITE_BUSY`, load 16), i.e. a load flake of the same family as
  the known identities-route one (that file alone: 3 pass / 0 fail).
  `test:dom` run separately because `&&` stopped after the unit failure:
  **462 pass / 0 fail** (58 files, 83.11 s). Unit delta vs `82ce499`
  baseline 2853: +18 = 3 (F2) + 15 (F4).
- `git -C repo merge-tree --write-tree b3352c9 origin/integration/stage`
  (`11dc3c5`): clean, tree `446615f7b9a7`.
- Bench: `bun --tsconfig-override tsconfig.json .tmp/fts-search/bench.ts`
  → `briefs/perf-fts-search-driven/bench-results.json`; replay:
  `.tmp/fts-search/replay.ts` → `replay-results.json`.

## Risks and open questions for the reviewer (Umbau thread)

1. **Cap choice (2000).** Above it, searches silently use the legacy
   scan. On much larger shards a 2000-candidate `IN` list is still far
   below any variable limit (Bun 1.4.4's SQLite accepts 250,000 bound
   variables — measured in review r1; 32,766 is only SQLite's portable
   default; the enforced cap maximum is 32,000 to leave headroom below it,
   see R3) and each
   consuming statement re-prepares with that many placeholders — is 2000 the
   right trade-off, or should the cap scale with page size / account
   size? No measurement above 11k backs a higher value yet.
2. **All-tokens-oversized → legacy.** Two common words whose
   intersection is tiny (`synthetic body`) get no win. Acceptable?
   The alternative (probing the second token's capped set by the
   first token) adds a second probe shape; deferred deliberately.
3. **Candidate staleness within one call.** Resolution runs before the
   selector on the same connection; a concurrent writer on another
   connection could change FTS between resolution and counts. The
   legacy code had the same cross-statement race (each statement
   re-read FTS), so this is not a regression, but the window is now
   one-resolution-wide instead of per-statement. Worth a read
   transaction, or fine as-is?
4. **Corrupt-shard behaviour.** If `message_fts_v3` lacks a row for an
   existing message, legacy and driven both miss its FTS tokens
   (identical), but driven additionally cannot surface it via another
   token's attachment hit beyond what legacy did — verified equivalent
   by construction, yet no corrupt-fixture test exists. Add one?
5. **Env knobs.** Two new env vars (`NOCTUA_DISABLE_FTS_DRIVEN_SEARCH`,
   `NOCTUA_FTS_DRIVEN_MAX_CANDIDATES`) — keep both, or fold the cap
   into a constant and keep only the kill switch? The cap override
   exists mainly so tests can force the probe/fallback paths.
6. **Thread selector plan.** Driven selector still walks
   `idx_messages_account_thread_date` with a bloom filter over the IN
   list (planner choice for `DISTINCT threadId`); counts probe the PK.
   Forcing the selector onto the PK (e.g. restructuring
   `threadFilterSql` to a join) was left out — it would touch the
   flagged-EXISTS ordering surface. Follow-up candidate if the
   residual ~49 ms needs to go lower.
7. **Absolute numbers at low load.** This box never dropped below load
   ~25 during the session; a quiet-box re-run of `bench.ts` would pin
   the absolutes against the rerank's 81.03 ms baseline. The paired
   ratios and the raw 14.81 → 0.20 ms pair (rerank: 13.94 → 0.21) are
   the load-independent evidence.
8. **ID-substring pass (~28 ms replay at 11k under load).** It is a
   single account pass with three `lower(...) LIKE '%…%'` evaluations —
   unchanged semantics, now paid once instead of per statement, but
   still the dominant driven cost. Cheaper shapes (per-column covering
   scans, splitting `id`/`threadId` onto their indexes) are possible;
   each adds planner fragility (`INDEXED BY`) or extra statements. Left
   as a follow-up decision; not attempted here to keep the diff
   semantics-exact.

## Fix round 1

Review findings F1–F8 from the Umbau thread. F6 (thread selector onto the
PK), F7 (quiet-box re-measurement) and F8 (ID-substring pass) were
classified follow-up / leave and are not touched; see "Follow-ups".

| Finding | Change | Commit |
|---|---|---|
| F2 — fallbacks silent | One `[fts-search] legacy fallback` warning per search (reason code, 12-hex account hash, cap, token/oversized/observed counts, `candidateCapExceeded` flag; never query text); `getGroupCounts` threads its resolution into `getTotalCount` so a search cannot resolve or log twice | `55870b6` |
| F4 — corrupt shard | FTS read failures during resolution fall back to the legacy clause (`fts_error`), logged once with SQLite error name/code only; differential tests on two corrupt synthetic shards | `10aafaf` |
| F5 — env knobs undocumented | `doc/DEPLOYMENT.md` → "Optional search tuning" table (`NOCTUA_FTS_DRIVEN_MAX_CANDIDATES`, `NOCTUA_DISABLE_FTS_DRIVEN_SEARCH`) | `b3352c9` |
| F3 — cross-statement consistency | Documented below ("Cross-statement consistency"); no code change | brief only |
| F1 — cap 2000 unmeasured | Measurement plan in "Follow-ups"; uses the F2 log line as is, no code | brief only |

### F4: corrupt-shard resilience (read path only)

Line refs are `query.ts` at `10aafaf`. Resolution runs its FTS `MATCH`
eagerly, before any selector, so on a shard whose `message_fts_v3` is
missing (`no such table`) or corrupt (`database disk image is
malformed`, FTS5 `SQLITE_CORRUPT_VTAB`) the driven search raised even in
cases the legacy clause answers: the legacy `IN (SELECT … MATCH ?)`
subquery is evaluated lazily, only once the outer scan yields a row, so
e.g. a search scoped to a folder with no rows returns a correct empty
page under legacy. Now:

- The two statements that embed the FTS table — the capped candidate
  fetch `ftsIdsForMatch` (`query.ts:876`) and the oversized-token probe
  (`query.ts:899`, only when the token has an FTS part) — wrap their
  error in `FtsCandidateError` (`query.ts:793`), which keeps only the
  SQLite `name`/`code`, never the message (it can embed MATCH text).
- `resolveSearchCandidateIds` (`query.ts:812`) keeps the `none` and
  kill-switch returns, delegates to `resolveDrivenSearchCandidateIds`
  (`query.ts:842`, the unchanged resolution body) and on
  `FtsCandidateError` logs one `fts_error` fallback
  (`candidateCapExceeded: false`, `errorName`, `errorCode`, cap, token
  count, account hash) and returns `{ kind: "legacy" }`. The legacy
  clause then decides the outcome — the same payload, or the same error
  the pre-change code raised. The driven path never turns an FTS error
  into an empty result. Errors from non-FTS statements (attachment
  fetch, id-substring pass) are not wrapped and propagate as before.
- The resolution is threaded through counts/groups exactly as in F2, so
  one search logs at most once even when the legacy statements then
  raise. FTS repair/migration code (`perf/fts-identity-v3`) is
  untouched; nothing here writes to the shard.
- The F2 commit had added an unused `degradedCandidateCount` log field
  for an abandoned "search without FTS" mode (an earlier, unfinished
  attempt that returned attachment/id-only results instead of the
  legacy outcome — a new semantics, so dropped). `10aafaf` removes it.

Tests (`query.ftsSearchDriven.test.ts`, describe "FTS-driven search on
a corrupt FTS shard", 15 tests). Fixture `createCorruptFtsShard`: a fresh
synthetic account shard in the test-harness temp data dir (never a real
data dir), 6 messages / 3 threads / 2 attachments seeded via
`upsertMessages`, then broken in one of two ways — `dropped`:
`DROP TABLE message_fts_v3` on the live connection; `malformed`: close
the connection, `wal_checkpoint(TRUNCATE)`, overwrite the root page of
`message_fts_v3_data` with `0xff` bytes (direct shadow-table writes are
rejected by SQLite's defensive mode, so the page is corrupted at file
level), reopen. The fixture asserts the corruption is real (MATCH
throws `no such table` / `malformed`) and that `messages` is still
readable. Each case runs legacy (kill switch) then driven and compares
the full outcome (`JSON.stringify` payload, or `name:code:message` of
the error):

- per corruption mode, six FTS cases — `listThreads` token,
  `listMessages` token, `listThreads` combined MATCH (two tokens,
  subject+body), `listMessages` groups by sender (counts + groups),
  `listThreads` groups by week (thread-date group counts), `listMessages`
  mixed FTS+attachment token grouped by folder: outcome identical, the
  outcome is the legacy error (asserted not-ok — never an empty
  result), exactly one `fts_error` line with `errorName: SQLiteError`,
  `errorCode` `SQLITE_ERROR` / `SQLITE_CORRUPT`, `cap: 2000`, and no
  query token, account id or error text in the serialized line;
- per mode, attachment-only search (`fields: ["attachments"]`, no FTS
  token): identical, non-empty (`total` 2), no fallback line;
- `malformed`, folder scope with no rows (`listThreads` grouped by
  sender, `listMessages` grouped by week): the legacy outcome is a
  successful empty page, driven reproduces it and logs one fallback.
  This is the case that failed before `10aafaf`.

Mutation check: with the `fts_error` catch replaced by a rethrow, 13 of
the 15 tests fail (all FTS cases + the empty-scope case); the two
attachment-only tests pass in both, as expected.

Known gap: the probe-path wrap is only reachable if FTS fails *between*
two resolution statements (each token's own MATCH runs before any probe,
so a persistently broken table fails at `ftsIdsForMatch` first); it is
not separately tested.

### Cross-statement consistency (F3)

Line refs are `query.ts` at `10aafaf` unless noted. One search runs
candidate resolution once (`listMessages` `query.ts:2329`, `listThreads`
`query.ts:2649`), then the selector, totals and group counts consume the
id set as `m.id IN (?, …)` (`query.ts:1045`ff), each statement as its own
autocommit read on the shard connection. In WAL mode each statement
sees the latest committed snapshot at its start. Writers commit
`messages` and their FTS rows together: `upsertMessages` in one
`db.transaction(…).immediate()` (`upsert.ts:712–738`), deletes in one
`db.transaction` (`delete.ts:93–97`); thread rows are recomputed after
that commit (`upsert.ts:765`, `delete.ts:98–103`).

What a write landing between resolution and a later statement does:

- **Row disappears** (deleted, moved out of scope, flag changed): the
  id stays in the candidate list, but every consuming statement still
  applies all its other predicates (account, folder, visibility, badges,
  `deleted`) against the current row, so a deleted row is simply not
  found — the selector skips it; a statement that ran before the delete
  (e.g. the thread total) may count it, so totals/groups can be off by
  one for that request.
- **Row appears** (newly upserted match, or an edit that makes it
  match): it is not in the candidate set, so it is absent from this
  response's items and counts and shows up on the next request.
- **Legacy had the same class of skew.** Each legacy statement re-ran
  its own `MATCH` (5 statements per `listThreads` search, 3 per
  `listMessages`), so selector and totals could already disagree when a
  write committed between them; driven freezes the FTS side at one
  point instead of re-reading it per statement. The non-FTS predicates
  are re-evaluated per statement in both modes. Also unchanged: the
  statements are already separated by `await`s — `getTotalCount`
  (`query.ts:1604`) and `getGroupCounts` (`query.ts:1363`) each
  `await getAccountDb`, and `listThreads` awaits event/invite lookups
  between selector and groups — so other requests on the same process
  interleave there today.
- **Bounded effect.** The candidate set only *narrows* the legacy
  predicate's FTS part; it never adds rows that fail the other
  predicates, and a stale id cannot leak another account's row (every
  statement is `accountId`-scoped; covered by the shared-shard collision
  test).

Why no read transaction:

- There is one connection per shard per process (`connection.ts:380`,
  reused at `:382`), shared by all requests and by in-process writers.
  A `BEGIN` spanning the list call would stay open across the `await`s
  above; a concurrent in-process writer's `db.transaction()` would then
  nest as a savepoint inside the reader's transaction and its commit
  would be deferred to (or rolled back with) the reader (checked on Bun
  1.4.4: a `db.transaction()` run inside an open `BEGIN` is undone by the
  outer `ROLLBACK`). That couples
  unrelated requests and breaks the writer's atomicity/durability
  assumptions (`withDbWriteRetry` retries a write as one unit,
  `dbWriteRetry.ts:42`).
- Sync workers write from their own processes/connections. WAL readers
  never block them and are never blocked by them, so there is no
  `busy_timeout` (`connection.ts` `configureDb`, 15 s) involvement on the
  read path today. A long-lived read snapshot would, however, pin the
  WAL and stop `wal_autocheckpoint` (4000 pages) from completing past
  it under write load, growing `-wal` during large syncs.
- Taking a snapshot would also change semantics relative to legacy for
  the non-FTS predicates (which are currently per-statement), i.e. it
  is a behaviour change beyond this branch's "byte-identical to legacy"
  contract, for a skew that is one request wide and self-heals on the
  next poll.

## Fix round 2

Follow-ups R1–R5 from `briefs/fts-search-driven-review-r1.md` (verdict
MERGE-WITH-FOLLOW-UPS) plus an independently requested log
classification. HEAD `d4c2b46` on `b3352c9`, base still `11dc3c5`.
Line refs are `query.ts` at `d4c2b46`.

| Item | Change | Commit |
|---|---|---|
| R1 — `AND`/`OR`/`NOT` → FTS5 syntax error (both modes) | `buildFtsTokenQuery` (`query.ts:474`) quotes the three FTS5 keyword barewords like any non-bareword token (`"NOT"*`, column-scoped `subject:"NOT"*`); searched as plain prefix terms in both modes | `5a06bd4` |
| Log classification | `fts_error` lines gain `errorClass` `index` / `syntax` / `other`, derived in `FtsCandidateError` (`classifyFtsError`, `query.ts:820`) from the SQLite code/message; the message itself is still never logged | `78d8347` |
| R3 — cap without upper bound | `maxFtsDrivenCandidates` (`query.ts:797`) clamps with one warning per configured value; default 2000 and invalid-value handling unchanged; `doc/DEPLOYMENT.md` documents the maximum and the reason. Maximum 32,766 in `d4c2b46`, lowered to **32,000** in the follow-up commit so a statement's other parameters stay below the portable limit (see "R3: cap maximum") | `d4c2b46` + follow-up |
| R2 — fallback cost | Corrected in this brief (Summary, bench table, F1 rule): a cap/oversized fallback costs **+2.7 % to +4.3 %** on unselective searches, not ≈0 | brief only |
| R3 — 32,766 figure | Corrected (risk 1): Bun 1.4.4's SQLite accepts 250,000 bound variables; 32,766 is the portable default; the enforced maximum is 32,000 (headroom for the non-candidate parameters) | brief only |
| R4 — account hash pseudonymous | No change (review: acceptable; F1 exports only per-hash aggregates) | — |
| R5 — F1 denominator | F1 step 3: primary denominator = searches with ≥ 1 free-text token, both shares reported; steps 2/4 bucket `fts_error` by `errorClass` | brief only |

### R1: FTS5 keywords

FTS5 treats `AND`, `OR`, `NOT` as operators only in upper case
(case-sensitive); `NEAR` is an operator only when followed by `(`
(verified on Bun 1.4.4 / SQLite 3.53.4: `NEAR*`, `subject:NEAR*`,
`x* AND NEAR*` all parse; `NEAR(x)*` is a syntax error). A token
containing `(` is never a bareword in `buildFtsTokenQuery`, so it is
already quoted; `NEAR` therefore needs no handling. Lower/mixed case
(`not`, `Not`, `aNd`) was never affected. `"NOT"*` is the same prefix
query `not*` would be, so semantics match the lower-case form.

Tests (`query.ftsSearchDriven.test.ts`): one corpus message carries the
keywords (`subject: "NOT AND OR sale"`); 31 differential cases run
`listThreads` + `listMessages`, pages 1–2, at the default cap and at cap
3 (probe/fallback paths): `NOT`/`AND`/`OR`/`NEAR` upper, lower and mixed
case alone; all three together; leading/trailing/infix with other
tokens; whole-query quoting; `NEAR(needle)`; `fields` subject, subject +
body, body (combined MATCH), sender, attachments; with `from:`, `in:`,
`thread:`, `to:`; grouped by sender; unread badge. Each asserts legacy
= driven (both succeed) and zero `fts_error` lines. A spot-check test
asserts the keyword hits (`NOT` in subject → the keyword message;
`NOT` ≡ `not`; `AND sale`, `sale OR` subject-scoped). Mutation: with the
quoting removed, 21 of the 32 new tests fail (the remaining 11 are the
lower/mixed-case, `NEAR` and attachments-only cases, as expected).

Fuzz (`briefs/perf-fts-search-driven/keyword-fuzz.test.ts`, seeded LCG,
synthetic shard, run temporarily from `lib/db/messages/`): 4,310 queries
built from 62 pieces — FTS5 specials `" * ^ : ( ) - + NEAR(`, ASCII
punctuation, `_`, `%`, `@`, brackets, non-ASCII letters (`ü É ß 中`),
`²`, `½`, full-width `Ａ`, combining acute, ZWJ, `\x1a`, emoji, NBSP and
ideographic space, column names `subject`/`body`, operators `from:`,
`in:`, `thread:`, `topic:`, and the keywords in four casings — each as
single pieces, prefixed/suffixed/infixed, and 1–3-token random
combinations; × fields default / subject / subject+body / attachments
× legacy and driven, through `listMessages` and `listThreads` (34,480
search runs). Before the fix: the only error class was `fts5: syntax
error near "AND"/"OR"/"NOT"` (both modes identical) and 721 driven
`fts_error` lines, all `SQLITE_ERROR`. After the fix: **0 errors, 0
`fts_error` lines**. No other token class produces an FTS5 syntax error,
so nothing else was added.

Finding from fix round 2, fixed in the follow-up commit: with the cap
at 32,766, a consuming statement binds the candidate ids plus its other
arguments (account id, folder, badges …), so on a SQLite build compiled
with the portable 32,766 variable limit a search near the cap would fail
with `too many SQL variables`. On Bun 1.4.4 (250,000) this cannot happen,
but the documented maximum is meant to be portable, so it is now
**32,000**, leaving 766 variables for the non-candidate parameters
(a search binds well under 100 of those). The default 2000 is unchanged.

### Error classes

`classifyFtsError(code, message)` (`query.ts:820`), applied only to
errors from the two FTS-touching resolution statements:

- `index`: `code` starts with `SQLITE_CORRUPT` (incl. `_VTAB`), or the
  message starts with `no such table: ` or `vtable constructor failed: `
  (missing FTS or shadow table);
- `syntax`: the message starts with `fts5: syntax error` or
  `fts5: parser stack overflow`;
- `other`: everything else (`SQLITE_BUSY`, `no such column` — ambiguous
  between a schema drift and a code bug, so not guessed —, non-SQLite
  errors).

The message is read only inside the constructor and not stored. Tests:
the 12 corrupt-shard FTS cases and the empty-scope case now assert
`errorClass: "index"` (both `dropped`/`SQLITE_ERROR` and
`malformed`/`SQLITE_CORRUPT`); a new test injects eight error shapes
into the resolution MATCH (syntax ×2, missing table, vtable constructor,
`SQLITE_CORRUPT_VTAB`, BUSY, `no such column`, plain `Error`) and asserts
the class, a payload identical to legacy, and that neither the error
text nor the query token nor the account id is in the line. Mutation
(class forced to `other`): 14 tests fail.

### R3: cap maximum

Values above 32,000 clamp to 32,000 and warn once per configured value
(`[fts-search] NOCTUA_FTS_DRIVEN_MAX_CANDIDATES above maximum, clamped`,
`{ configured, max }` — operator config, no user data); a misconfigured
service therefore logs once at its first search, not per search. Chosen
over a silent clamp because, unlike an unparsable value, an oversized
value is a deliberate operator choice that silently not taking effect
would mislead. Test: unset/`""`/`abc`/`0`/`-5`/`Infinity`/`NaN` → fetch
`LIMIT 2001`, `2.9` → 3, `32000` → 32,001 without warning; `32001` ×3 →
one warning; `1e9` ×2 → one more. (Fix round 2 shipped 32,766; the
follow-up commit lowered the maximum to 32,000 and moved the test
values with it.)

### Verification (HEAD `d4c2b46`)

Commands in `wt-perf-fts-search`, everything under `nice -n 10`,
`TMPDIR=$PWD/.tmp/tmp` (emptied afterwards).

- `bun run typecheck` — 0 errors, 1,195 files.
- `bun run lint` — 1 error + 25 warnings, exactly the `11dc3c5`
  baseline (`react-hooks/set-state-in-effect` in
  `useCalendarConflicts.ts:58`); `eslint` on `query.ts` and the test
  file: 0 findings.
- `bun test lib/db/messages` — **131 pass / 0 fail** (2,642 expects,
  6 files; was 97); differential file 101 tests.
- `bun run test:ci` (load 10.0 at start, 9.7 at end; started at once
  because load was below 12) — unit **2,904 pass / 1 fail** (2,905 tests,
  305 files, 445.88 s; wall 452 s). The failure is
  `lib/sendIdentity.routes.test.ts` with `SQLITE_BUSY` (`database is
  locked`) on the master-DB `DELETE FROM user_accounts` at
  `lib/testFixtures/verifySenderIdentity.ts:339`, the same load flake as
  in fix round 1; this branch does not touch the file. Rerun alone 3×
  (load 9.0–9.6): 3 pass / 0 fail. `test:dom` run separately because `&&`
  stops after the unit failure: **462 pass / 0 fail** (58 files,
  69.83 s). Unit delta vs fix round 1 (2,871): +34 = the new tests in the
  differential file.
- `git -C repo merge-tree --write-tree d4c2b46 origin/deploy/dev-stage`
  (`0ac6cfa`, round-9 candidate) — **clean**, tree `a2334a83df0b`, merge
  base `11dc3c5`.

### Follow-up commit e29b64f (orchestrator)

Cap maximum lowered from 32,766 to 32,000 (see "R3: cap maximum"). Gates on
`e29b64f`, load ~1.5: `bun run typecheck` 0 errors / 1,195 files; eslint on
the two changed source files clean; `bun test lib/db/messages` 131 pass;
`bun run test:ci` exit 0 in 444 s, **2,905 unit + 462 DOM pass, 0 fail**.

## Follow-ups

### F1: how many real searches exceed the cap (run after integration round 9)

Goal: decide whether 2000 is right for the preview's ~15k-message
shards, using only the F2 log line (no new code, no query text).

1. **Window.** After round 9 is integrated and deployed to the dev
   preview, collect 7 days (or ≥ 500 searches, whichever is later) of
   the service log. Do not change `NOCTUA_FTS_DRIVEN_MAX_CANDIDATES`
   during the window.
2. **Numerator.** `grep '\[fts-search\] legacy fallback'` and aggregate
   by `reason` × `accountHash`: counts of `candidate_cap_exceeded`,
   `all_tokens_oversized` (`candidateCapExceeded: true`) and `fts_error`
   (expected 0), the latter bucketed by `errorClass` (fix round 2):
   `index` (missing/corrupt FTS table) → `perf/fts-identity-v3` owners
   with its `errorCode`; `syntax` (FTS5 rejected the MATCH; expected 0
   since R1) → search owners (`buildFtsTokenQuery`); `other` (e.g.
   `SQLITE_BUSY`) → reported with its `errorCode`. Lines logged before
   `78d8347` lack `errorClass`; do not mix them into the window. Per
   account also bucket `tokenCount`, and for cap
   hits note that `observedCandidates` is clamped at `cap + 1` (fetches
   are capped), so it says "above the cap", not by how much.
3. **Denominator.** Count list requests that carried a search: the
   reverse-proxy access log lines for `GET /api/accounts/*/threads`,
   `…/messages` and `…/search` with a non-empty `q` parameter
   (`threads/route.ts:50`, `listMessagesHandler.ts:23`), counted per path
   by a one-off filter that drops the query string before aggregation
   (never store or paste the values). **Primary denominator (R5):** only
   `q` values with at least one free-text token, i.e. something left after
   removing the `from:`/`to:`/`with:`/`in:`/`invite:`/`event:`/`thread:`/
   `topic:` operators and symbol-only tokens — operator-only searches
   resolve to `none` and can never fall back. The filter classifies each
   value in memory (yes/no) and keeps only the counts. Report the share
   against both denominators (free-text searches; all non-empty `q`).
   MCP `search_messages` calls are not in the proxy log; note their count separately if the MCP server
   is in use. One request is one resolution (F2 guarantees no double
   logging).
4. **Anonymised output.** A table per `accountHash` (12 hex, no
   address): searches (free-text / all), cap fallbacks, oversized
   fallbacks, `fts_error` by `errorClass`, fallback share (both
   denominators); plus the overall shares. Only aggregates go into the
   brief.
5. **Decision rule.** Fallback share ≤ 5 % of free-text searches: keep
   2000. Above that, run `briefs/perf-fts-search-driven/bench.ts` on a
   15k synthetic shard with caps 2000 / 5000 / 10000 to check the
   `IN`-list prepare cost before raising the default (and update
   `doc/DEPLOYMENT.md`; the enforced maximum is 32,000). If only a few
   accounts dominate, prefer F6/F8 over a larger cap. Cost side (R2): a
   cap/oversized fallback is not free — it pays the discarded capped
   resolution on top of the legacy clause, **+2.7 % to +4.3 %** on
   unselective searches in review r1 (not ≈0 as the first bench
   suggested) — so a high fallback share also means a 3–4 % tax on those
   searches, not only a missed win.

### Left from review (unchanged on this branch)

- F6 — thread selector onto the PK: risk 6 above.
- F7 — quiet-box absolute re-measurement: risk 7 above.
- F8 — cheaper ID-substring pass: risk 8 above.

## Files touched

- `lib/db/messages/query.ts` — `resolveSearchCandidateIds` +
  `SearchCandidateResolution` + cap helper; `candidates` parameter in
  `applySearchQueryFilters`; `searchCandidates` plumbing through
  `listMessages`, `listThreads`, `getGroupCounts`, `getTotalCount`
  (resolved once per top-level call, reused by selector/counts/groups).
  Legacy clause generation is retained verbatim for `legacy` resolution.
- `lib/db/messages/query.ftsSearchDriven.test.ts` — new, 49 tests
  (67 after fix round 1: +3 F2 logging, +15 F4 corrupt-shard; 101 after
  fix round 2: +32 R1 keyword, +1 error classes, +1 R3 clamp).
- `doc/DEPLOYMENT.md` — "Optional search tuning" env table (F5); cap
  maximum and `errorClass` (fix round 2).
- `briefs/perf-fts-search-driven/keyword-fuzz.test.ts` — fix round 2
  tokenizer-path fuzz (evidence only; copy into `lib/db/messages/` to run,
  not part of the branch).
- `briefs/perf-fts-search-driven/bench.ts`, `bench-results.json`,
  `replay-results.json` — harness + raw evidence (in `briefs/`, not the
  worktree).

Nothing in the no-touch list was modified (`lib/db/schema.ts`,
`lib/db/connection.ts`, `lib/auth.ts`, `lib/mail/**`,
`lib/senderIdentity*`, `messages/*.json`, `app/**`, `package.json`,
`bun.lock`, `next.config.ts` — verified via `git diff --stat 11dc3c5`).
