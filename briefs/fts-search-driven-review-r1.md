# Review r1 — perf/fts-search-driven (FTS-driven search candidates)

Reviewer: review sub-agent (Umbau thread), 2026-10-23. Read-only review of
`ROOT/wt-review-fts`, detached at `b3352c9` (base `11dc3c5`, round 8).
Scope: `git diff 11dc3c5..b3352c9` = `lib/db/messages/query.ts` (+382/−9),
`lib/db/messages/query.ftsSearchDriven.test.ts` (new, 67 tests),
`doc/DEPLOYMENT.md` (+11). Line references are `query.ts` at `b3352c9`.
Harnesses and raw results: `ROOT/briefs/fts-search-driven-review-r1/`
(scripts ran from `wt-review-fts/.tmp/review`, synthetic data only, all
addresses `@example.test`; no tracked file was modified).

## Verdict

**MERGE-WITH-FOLLOW-UPS.** No correctness, isolation or privacy defect
found in the branch. Differential harness: 0 mismatches over 600
randomized queries (1,612 list calls) on an 11k shared shard; every
fallback mode returns exactly the legacy result or the legacy error;
the F3 race experiments show no new anomaly class. Perf gains reproduce
(−50 % to −71 % on selective searches), unselective fallbacks cost
+2.7 % to +4.3 %, non-search list paths unchanged. All findings are
follow-ups; none blocks the merge.

## Findings (ranked)

| # | Severity | Finding | Recommendation |
|---|---|---|---|
| R1 | Low (pre-existing bug; affects F1 classification) | A free-text token `AND`, `OR` or `NOT` (upper case) makes the FTS5 MATCH a syntax error (`fts5: syntax error near "NOT"`). `buildFtsTokenQuery` (`query.ts:469–474`) emits bare `NOT*` / `subject:NOT*`. Legacy and driven both return this error (identical, verified on 11k shard and in 14 of 1,612 harness calls), so it is not a regression. On the driven path, however, it is logged as `reason: "fts_error"`, `errorCode: "SQLITE_ERROR"` (`query.ts:824–838`), the same reason as a missing/corrupt FTS table. The F1 plan treats `fts_error` as "expected 0; any hit goes to the perf/fts-identity-v3 owners". | Follow-up: quote FTS5 keyword barewords in `buildFtsTokenQuery` (e.g. `"NOT"*`) — fixes the user-visible search error in both modes and removes the misclassification. Until then, the F1 evaluation should bucket `fts_error` by `errorCode` (`SQLITE_CORRUPT`/`no such table` → identity-v3 owners; `SQLITE_ERROR` from the syntax case → search owners). |
| R2 | Low (perf) | An unselective search that ends in a cap/oversized fallback pays the discarded capped resolution on top of the legacy clause: `synthetic` (11k hits) 305.40 → 318.65 ms (+4.3 %, ranges [299.0–311.5] vs [312.2–322.4], no overlap), on the second shard `synthetic` +2.7 %, `overcap` (2,750 hits) +3.1 %. The deps brief reports ≈0 for this case. | Accept for merge (bounded by `LIMIT cap+1`, a few ms). Record in the F1 evaluation: a high fallback share also means a ~3–4 % tax on those searches. |
| R3 | Info | `NOCTUA_FTS_DRIVEN_MAX_CANDIDATES` has no upper bound (`query.ts:783–786`). The brief cites a variable limit of 32,766; Bun 1.4.4's SQLite accepts 250,000 bound variables (measured: 250,000 ok, 250,001 `too many SQL variables`). A very large cap would only fail on accounts above 250k candidates, but every consuming statement re-prepares with that many placeholders. | Optional: clamp the parsed value (e.g. ≤ 20,000) or state a recommended maximum in `doc/DEPLOYMENT.md`; correct the 32,766 figure in the deps brief. |
| R4 | Info (privacy, acceptable) | The fallback line carries `accountHash` = first 12 hex of unsalted SHA-256 of the account id (`query.ts:772`). It is pseudonymous, not anonymous: anyone holding the log and a candidate account id can confirm it. No query text, token, raw account id or SQLite message text appears in any line (checked on all fallback lines in the harness and in the corrupt/BUSY runs). | Fine for server-side logs. If F1 aggregates are ever exported, keep to the per-hash aggregates the plan already prescribes. |
| R5 | Info (F1 plan) | F1 denominator = proxy-log requests with non-empty `q`. Operator-only searches (`from:x`, `in:x`, `thread:x`) resolve to `none`, can never fall back and dilute the share. | When filtering the access log, count only `q` values that contain at least one free-text token (classified in the one-off filter, values not stored), or report both shares. |

Nothing found under: result identity, cross-account isolation, composite
keys, sender-key semantics, double resolution/logging, kill-switch
behaviour, documentation defaults.

## 1. Result identity — differential harness

Shard: one physical shard with two accounts (`acct-a-review` 11,000
messages / 3,667 threads / 883 attachments; `acct-b-review` 1,500
messages / 503 threads, local ids `m0…m1499` identical to A's — the v3
collision case), seeded through the production `upsertMessages` path
(FTS rows via `message_fts_identity`), threads recomputed, 299
`thread_collab_state` rows (open/closed/in_progress/waiting, assignees
`u-viewer`/`u-other`). Content: one token in every message
(`synthetic`), mid-frequency words, rare tokens (`needle` 415 hits),
umlaut words (Grüße, Köln, Müller, Straße, Übersicht, Größe …), dashed
tokens, cap-band tokens `nearcap` (1,834) and `overcap` (2,750), 2 %
deleted rows, flags/todo/done/categories, cc/bcc, preview-only tokens,
attachment names incl. `_` and spaces, Message-IDs with `.xyzzy`.
**Date ties on purpose**: three messages share each timestamp and every
50th block reuses an older one (3,667 distinct dates for 11,000
messages; 11 tied thread dates), so `ORDER BY dateValue DESC` /
`ORDER BY count DESC` without tie-breakers would expose plan-dependent
order differences.

Queries (seeded generator, `diff.ts`): 0–3 free-text tokens from the
pools (common, mid, rare, umlaut incl. `GRÜSSE`/`KÖLN`/`ÜBER`, dashed,
cap-band, 3–5-char prefixes, id fragments `m12`/`th-a-77`/`xyzzy`,
attachment fragments `invoice-2026`/`photo_`/`_1`/`%`, symbol-only
`!!!`/`--`/`"`, email-ish, nonexistent, `has:attachment`, FTS keywords),
optional whole-query quoting, mixed with `from:` (incl. `from:me`,
quoted display name, infix `lic`), `to:`, `with:`, `in:`, `thread:`,
`topic:none`, `invite:`/`event:`; parameters folderId (4 folders),
badges (flagged, unread, attachments, unanswered, todo, done, attention,
newsletter, focused, transactional, assigned-to-me, unassigned, open,
closed, in-progress, waiting; with/without `viewerUserId`), `fields`
(sender, participants, subject, body, attachments, preview, to, cc,
bcc, from, unknown), groupBy (date, week, year, sender, domain, folder,
none, invite-date, event), threadDateSource, attachmentsOnly,
excludedFolderIds, from/recipients/participants lists, sortBy size,
pageSize 10–100, pages 1–3; 25 % of queries with cap 40/300/1000 to
force probe/fallback paths at scale. Each call runs `listThreads` and
`listMessages` legacy (kill switch) then driven and compares the full
JSON payload (items, order, groups, total, hasMore, baseCount) or the
error `name:code:message`.

| Seed | Queries (A/B) | Calls | Mismatches | Paths (driven) | Legacy errors | >1 log/search | Cross-account items |
|---|---|---|---|---|---|---|---|
| 4242 | 240/60 | 794 | **0** | ids 364, ids+probe 62, none 108, all_tokens_oversized 246, candidate_cap_exceeded 8, fts_error 6 | 4 | 0 | 0 |
| 777 | 240/60 | 818 | **0** | ids 376, ids+probe 80, none 126, all_tokens_oversized 210, candidate_cap_exceeded 12, fts_error 14 | 10 | 0 | 0 |

All 14 legacy errors and 20 `fts_error` paths are the R1 keyword case;
in 6 of those (`has:attachment AND`, `… AND thread:th-a-1046`) legacy
succeeds because the scope is empty and its lazy subquery never runs,
and driven reproduces the successful legacy page (F4 working). The
harness's automatic "query text in log line" check flagged 16 lines;
all are false positives of the substring heuristic (`and` ⊂
`candidateCapExceeded`), verified by printing the lines (R4).
Pagination: the API is page/offset; pages 1–3 compared byte-identical,
including tied dates. "Date ranges" is not a search operator in
`lib/db/messages` (no `before:`/`after:` parser); date behaviour is
covered through groupBy date/week/year and both thread date sources.
The existing differential file (67 tests) passes.

## 2. Fallback

Runs on copies of the 11k shard (`fallback.ts`), legacy vs driven, full
outcome compared:

| Mode | Cases | Outcome | Log lines (driven) |
|---|---|---|---|
| `DROP TABLE message_fts_v3` | 8 (threads/messages token, grouped, combined MATCH, attachment+FTS, attachments-only, id fragment, empty scope) | identical; FTS cases = legacy error `no such table`, attachments-only/id-fragment = identical non-empty pages | 1 `fts_error/SQLITE_ERROR` per FTS search, 0 otherwise |
| Root page of `message_fts_v3_data` overwritten (`SQLITE_CORRUPT`) | same 8 | identical; FTS cases = legacy `database disk image is malformed`; empty-scope case = identical successful empty page | 1 `fts_error/SQLITE_CORRUPT` per FTS search |
| Malformed MATCH (`NOT`, `needle AND`, `OR needle`, `needle OR quokka`, each also thread-scoped) | 8 | identical legacy `fts5: syntax error` | 1 `fts_error/SQLITE_ERROR` (R1) |
| `SQLITE_BUSY` on the resolution MATCH | 8 | identical; driven falls back and returns the successful legacy page | 1 `fts_error/SQLITE_BUSY` per FTS search |
| Concurrent storm, 40 parallel searches | `synthetic`, `overcap`, `needle`, dropped FTS | all 40 succeed / all 40 fail identically | exactly 40 / 40 / 0 / 40 lines — one per search, no amplification |

BUSY note: a WAL reader cannot be made `SQLITE_BUSY` from a second
connection while the app connection is open (an `EXCLUSIVE`
locking-mode holder cannot get its lock), so the error was injected as a
real-shaped `SQLiteError(code SQLITE_BUSY)` into the resolution
statement. With the production `busy_timeout` (15 s) a genuine BUSY on
the resolution statement would wait once there and possibly once more
in the legacy statement; given that WAL readers do not take busy
waits in normal operation this is theoretical.

Kill switch (`NOCTUA_DISABLE_FTS_DRIVEN_SEARCH=1`): returns `legacy`
before any DB access (`query.ts:817–820`), no log line (0 lines over
1,612 legacy calls), and the legacy clause code is unchanged in the diff
(only the `candidates` branch is inserted before it), so the disabled
SQL is byte-identical to `11dc3c5`.

## 3. F3 — race between resolution and follow-up reads

Method (`race.ts`/`write.ts`): a hook on the shard connection's
`prepare` runs a **separate process** (production `upsertMessages`,
`deleteMessageById`, `updateMessageFolder` on the same data dir, i.e. a
sync-worker-like writer) synchronously at one of three points of one
search (`needle`, folder inbox, groupBy sender, pageSize 25):
after resolution (before the selector), after the selector, before the
totals. The response is compared with the result just before and just
after the write. 60 runs = {insert matching row, delete matching row,
edit matching row so it no longer matches, move matching row out of
the folder, insert a matching row with the **same local id in account
B**} × 3 points × {listThreads, listMessages} × {legacy, driven}.

| Write | Legacy | Driven |
|---|---|---|
| insert (new match) | after-resolution: consistent-after; later points: mixed (items from before, total/groups from after; `listMessages` groupSum ≠ total) | **consistent-before at all 3 points** (row appears on next request) |
| edit (row stops matching) | consistent-after / mixed as above | **consistent-before at all 3 points** (stale row still listed and counted, consistently) |
| delete | after-resolution consistent-after; later points mixed | identical to legacy at every point |
| move (folder change, FTS unchanged) | as delete | identical to legacy at every point |
| account B inserts same local id | consistent-before, no B row | consistent-before, no B row |

No duplicate rows, no cross-account rows, no missing row that was
neither deleted nor moved. Driven freezes the FTS predicate at
resolution, so FTS-content changes produce a coherent "before" response
where legacy produced mixed ones; non-FTS changes (delete, move, flags)
behave exactly as in legacy because those predicates are re-evaluated
per statement in both modes. Writers commit messages + FTS (+
attachments) atomically (`upsert.ts` one immediate transaction,
`delete.ts:93–97`, `:137–152`), so the "FTS-before-messages" delete
order is not observable by a reader.

Recommendation: **no read transaction** for this branch. The shared
per-shard connection makes a `BEGIN` across the list call unsafe —
re-verified on Bun 1.4.4: a `db.transaction()` started while a `BEGIN`
is open becomes a savepoint and is undone by the outer `ROLLBACK`. The
remaining delete/move skew is pre-existing and one request wide.

## 4. Privacy / isolation

- Every resolution statement is `accountId`-scoped (`query.ts:879–883`,
  attachment fetch, id pass, probe `m.accountId = ?`); every consuming
  statement keeps `m.accountId = ?` (or `t.accountId = ?` +
  `m.accountId = ?` in `threadFilterSql`) next to `m.id IN (…)`.
  Shared-shard collision ids stayed isolated in all harness calls (0
  cross-account items) and in the account-B race.
- Sender-key (S3) code (`lib/db/messages/senderKey.ts`, retrieval) is
  not touched; `from:me` / `with:me` still resolve through
  `ownAddressList` before resolution and AND with the candidate clause;
  harness covered `from:me`.
- Query text is never logged by the branch; error text (which can
  contain MATCH text, e.g. `syntax error near "NOT"`) is dropped by
  `FtsCandidateError`. The legacy error that is re-raised to the caller
  still carries it — unchanged pre-existing behaviour.

## 5. Performance

Box: load 9.5–14.4 during the runs (other agents), Bun 1.4.4 / SQLite
3.53.4, `nice -n 15`, paired interleaved reps.

Original harness (`bench.ts`, same 11k shard shape as the deps brief,
pageSize 300, median of 9 [min–max]):

| Case | Legacy ms | Driven ms | Δ | Deps brief Δ |
|---|---:|---:|---:|---:|
| listThreads `needle` | 89.99 [88.9–90.5] | 42.82 [42.2–46.1] | −52 % | −50 % |
| listThreads `needle gamma` | 274.13 [272.3–277.4] | 90.25 [88.3–93.8] | −67 % | −68 % |
| listThreads `invoice` | 83.14 [81.7–84.7] | 41.27 [40.6–46.2] | −50 % | −54 % |
| listThreads `synthetic` (fallback) | 305.40 [299.0–311.5] | 318.65 [312.2–322.4] | **+4.3 %** | ≈0 |
| listThreads `from:sender` (control) | 76.19 | 76.82 | ≈0 | ≈0 |
| listMessages `needle` | 58.41 [57.3–59.0] | 22.00 [21.4–22.8] | −62 % | −62 % |
| listThreads default (control) | 60.42 | 61.29 | ≈0 | ≈0 |
| raw OR-scan vs FTS-driven | 13.82 | 0.20 | same 28 ids | 14.81 / 0.20 |

Payload JSON equal legacy/driven for all 7 cases.

Second shard (upsert-seeded 11k shared shard, pageSize 50, 21 paired
reps → p50/p95; cold = connection closed and reopened before each of 7
samples per mode, SQLite page cache cold, OS cache warm):

| Case | Legacy p50 / p95 | Driven p50 / p95 | Δ p50 | Cold p50 L → D |
|---|---:|---:|---:|---:|
| T `needle` (415) | 100.69 / 108.97 | 39.36 / 44.27 | −60.9 % | 103.7 → 41.0 |
| M `needle` | 56.18 / 76.39 | 19.68 / 25.21 | −65.0 % | 54.2 → 19.9 |
| T `quokka zebra` | 115.19 / 152.13 | 36.68 / 48.79 | −68.2 % | 119.1 → 37.0 |
| T `nearcap` (1,834, under cap) | 125.96 / 129.58 | 58.49 / 60.93 | −53.6 % | 124.5 → 58.4 |
| M `nearcap` | 63.38 / 65.27 | 28.82 / 31.20 | −54.5 % | 63.0 → 29.0 |
| T `nearcap needle` | 136.96 / 144.35 | 40.13 / 41.88 | −70.7 % | 136.2 → 41.3 |
| T `overcap needle` (oversized probe) | 148.76 / 151.35 | 48.24 / 50.86 | −67.6 % | 152.1 → 50.8 |
| T `overcap` (cap fallback) | 137.26 / 140.15 | 141.54 / 144.06 | **+3.1 %** | 137.9 → 142.6 |
| T `synthetic` (fallback) | 239.79 / 242.23 | 246.15 / 250.68 | **+2.7 %** | 244.1 → 251.6 |
| T `needle` inbox, by sender | 75.04 / 82.61 | 48.68 / 51.94 | −35.1 % | 75.9 → 50.3 |
| T `xyzzy` id-only (fields unknown) | 52.39 / 55.82 | 42.79 / 49.55 | −18.3 % | 54.3 → 44.5 |
| T `grüße` | 122.26 / 124.07 | 55.46 / 60.02 | −54.6 % | 123.0 → 56.9 |
| T default list | 42.73 / 58.75 | 43.23 / 52.16 | +1.2 % | 44.2 → 44.2 |
| T inbox list | 41.52 / 45.72 | 40.66 / 44.54 | −2.1 % | 40.6 → 41.2 |
| M inbox unread badge | 5.57 / 8.94 | 5.55 / 6.33 | −0.4 % | 6.7 → 6.7 |
| T `from:alice` only | 42.02 / 43.94 | 42.99 / 48.55 | +2.3 % | 44.4 → 43.7 |

Non-search list paths: resolution returns `none` before any DB access
and `applySearchQueryFilters` returns before the new branch, so their
SQL is unchanged (also 0 mismatches on 234 `none`-path harness calls);
the ±2 % deltas are noise. The near-cap case (1,834 candidates as an
IN list) is still −54 %, so the 2,000 cap is not past the break-even on
11k shards.

**F1 5 % rule.** The plan is sound as a decision rule and uses only the
F2 line (no query text). Adjustments: bucket `fts_error` by `errorCode`
(R1), restrict the denominator to searches with free-text tokens (R5),
and note that each fallback costs ~3–4 % over legacy (R2). Based on the
near-cap measurement, raising the cap to 5,000 for 15k shards is likely
still a win, but per the plan that needs the 15k bench first.

## 6. Env switches

`doc/DEPLOYMENT.md:46–55` ("Optional search tuning"): both variables documented as optional,
"leave unset", defaults `2000` and unset (on); invalid values fall back
to 2000 (`Number()` + finite ≥ 1, floored) — verified in code;
kill switch exactly `1`, no log line, restart to apply — matches
`query.ts:820`. Disabled = legacy (section 2). R3 (no upper bound) is
the only remark.

## 7. Gates (in `wt-review-fts` at `b3352c9`)

| Gate | Result |
|---|---|
| `bun run typecheck` | 0 errors, 1,195 files (0.8 s) |
| `nice -n 15 bun test lib/db/messages` | 97 pass / 0 fail, 2,228 expects, 6 files |
| `nice -n 15 timeout 1800 bun run test:ci` | exit 0: unit **2,871 pass / 0 fail** (305 files, 465.25 s) + DOM **462 pass / 0 fail** (58 files, 72.29 s); wall 9 m 41 s at load ~10–14 |
| `bun run lint` | 1 error + 25 warnings = the `11dc3c5` baseline (error `react-hooks/set-state-in-effect` in `app/components/calendar/useCalendarConflicts.ts:58`, fixed on the round-9 side); **0 findings in `query.ts`, the test file or `DEPLOYMENT.md`** — zero new |

The deps brief's fix-round-1 `test:ci` had one `SQLITE_BUSY` flake in
`lib/sendIdentity.routes.test.ts`; it did not recur here.

## Merge-tree vs round-9 candidate

`git -C ROOT/repo merge-tree --write-tree b3352c9 98b4301` → **clean**,
tree `7ec3b96a0d09`, merge base `11dc3c5`. 42 round-9 commits; the only
overlap with the branch's area is `lib/db/messages/upsert.ts` (round 9:
`withOutboundWrite`/`authorizedWrite` wrapper, `replaceDraftId`,
prepared `fromEmail`/source size) — the branch does not touch
`upsert.ts`; the write stays one atomic transaction, so the F3 analysis
holds. `app/api/…/threads/route.ts` and `listMessagesHandler.ts` gain a
folder validation before `listThreads`/`listMessages`; no search
parameter changes. No conflicts, so no resolutions needed.
Merged-tree check: the tree `7ec3b96` was extracted with `git archive`
into the review scratch dir (no worktree created) and run with this
worktree's `node_modules`: `bun test lib/db/messages` **97 pass / 0
fail**. `bun check` there reports 1 error in `lib/i18n/testRender.tsx`
(`bfcacheId`), which comes from round 9's Next 16.4.2 upgrade
(`a0ef4fb`) checked against this worktree's Next 16.2.4 `node_modules`;
it is a setup artifact, not a merge finding. Round-9 integration
should rerun `bun test lib/db/messages/query.ftsSearchDriven.test.ts`
on the real merge.

## Follow-ups (owner suggestion)

1. R1: quote FTS5 keyword barewords in `buildFtsTokenQuery` (search
   owners; separate small fix with a differential test for `NOT`/`AND`/
   `OR`). Until then, F1 buckets `fts_error` by `errorCode`.
2. F1 measurement with R2/R5 adjustments (deps thread, after round 9).
3. R3: optional clamp or documented maximum for the cap; fix the 32,766
   figure in the deps brief.
4. Unchanged from fix round 1: F6, F7, F8.

## Worktree state

`ROOT/wt-review-fts` detached at `b3352c9`, `git status --porcelain`
empty (only the pre-existing ignored `.env.local`); `.tmp` removed.
`ROOT/data/noctua-data-review-fts` untouched (all harness data lived
under `.tmp/review`); no server started, ports 3891–3894 not used; no
process left running; no `PRAGMA optimize`/`ANALYZE`. Harness scripts
in `fts-search-driven-review-r1/` keep their original absolute
`wt-review-fts/.tmp/review` paths: recreate that directory, then run
`bun --preload ./lib/testSetupEnv.ts .tmp/review/diff.ts <seed> 240 60`
(seeding takes ~9 s), `fallback.ts <dropped|malformed|keywords|busy|storm>`,
`race.ts <legacy|driven> <op> <point> <threads|messages> <id>`,
`bench-extra.ts`, `bench-orig.ts`. Results: `diff-4242.json`,
`diff-777.json`, `fallback.log`, `race.log`, `bench-*-results.json`.
