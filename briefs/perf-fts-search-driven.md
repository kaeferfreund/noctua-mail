# FTS-driven search candidates (perf/fts-search-driven)

Base `11dc3c5` (`origin/integration/stage`, round-8 head). Implementation in
worktree `/home/monkey/code/noctua-mail/wt-perf-fts-search`, branch
`perf/fts-search-driven`. Commits: `03d486e` (candidate resolution +
differential tests), `82ce499` (bounded fetches + oversized-token probe).
Review by the Umbau thread before merge, per task.

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
ms**, unselective `synthetic` (fallback) **388.08 → 385.50 ms** (≈0),
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

`lib/db/messages/query.ftsSearchDriven.test.ts` (49 tests, 442 expects),
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
| `listThreads` search `synthetic` (11k hits → fallback) | 388.08 [340.39–749.94] | 385.50 [334.68–446.66] | ≈0 |
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
- Bench: `bun --tsconfig-override tsconfig.json .tmp/fts-search/bench.ts`
  → `briefs/perf-fts-search-driven/bench-results.json`; replay:
  `.tmp/fts-search/replay.ts` → `replay-results.json`.

## Risks and open questions for the reviewer (Umbau thread)

1. **Cap choice (2000).** Above it, searches silently use the legacy
   scan. On much larger shards a 2000-candidate `IN` list is still far
   below SQLite's variable limit (32766 on 3.53.4) and each consuming
   statement re-prepares with that many placeholders — is 2000 the
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

## Files touched

- `lib/db/messages/query.ts` — `resolveSearchCandidateIds` +
  `SearchCandidateResolution` + cap helper; `candidates` parameter in
  `applySearchQueryFilters`; `searchCandidates` plumbing through
  `listMessages`, `listThreads`, `getGroupCounts`, `getTotalCount`
  (resolved once per top-level call, reused by selector/counts/groups).
  Legacy clause generation is retained verbatim for `legacy` resolution.
- `lib/db/messages/query.ftsSearchDriven.test.ts` — new, 49 tests.
- `briefs/perf-fts-search-driven/bench.ts`, `bench-results.json`,
  `replay-results.json` — harness + raw evidence (in `briefs/`, not the
  worktree).

Nothing in the no-touch list was modified (`lib/db/schema.ts`,
`lib/db/connection.ts`, `lib/auth.ts`, `lib/mail/**`,
`lib/senderIdentity*`, `messages/*.json`, `app/**`, `package.json`,
`bun.lock`, `next.config.ts` — verified via `git diff --stat 11dc3c5`).
