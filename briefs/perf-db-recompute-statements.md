# perf-db-recompute-statements

## Summary

Implemented in `/home/monkey/code/noctua-mail/wt-perf-dbloops`, branch `perf/db-recompute-statements`, starting at `435ba5d1885d5b016d15dbad5b269f84e6497ce3`. Two commits, one per rank. Rank 3 commit: `6b670cb039cd9137fb3fe8c9a16b2f9e51ff40b3` (`perf(db): scope author normalization to recomputed threads`). Rank 4 commit: `171b129b583280465601d485def3be9824bb4bbd` (`perf(db): reuse prepared statements in stable write loops`).

Synthetic, guarded SQLite measurements show single-thread public recompute **61.09 → 2.52 ms** and collaboration remap of 1,000 notes plus 1,000 activities **54.81 → 14.21 ms**. Topic assignment of 1,000 topics **60.85 → 45.28 ms**; category recompute of 500 metadata-only messages **57.49 → 43.38 ms**. These are warm synthetic medians, not production p95s.

## Per-rank

### Rank 3: scoped author canonicalization

The public `recomputeThreadsForAccount` wrapper now selects authors only from the supplied normalized thread IDs, in batches of 400, retaining the account predicate for both reads and updates. It uses the existing `parseAddressEmails` and leaves raw From values intact. The existing summary, thread-signal and topic-learning rebuilds still run. Omitted IDs and `[]` retain the existing full-rebuild behavior; a nonempty list containing only blanks scans no authors.

Nine measured repetitions after one warmup:

- Public single-thread recompute: before median **61.0927 ms**, min–max **58.3181–63.3426**; after **2.5175 ms**, **2.3152–2.7669**.
- Internal single-thread summary control: **0.8916 ms** (**0.8189–0.9975**) before, **0.8690 ms** (**0.8400–1.4675**) after.
- Adapted author-prefix control, same guarded shard: full-account **59.9326 ms** (**57.7459–60.7933**), **11,000 rows**; scoped **0.1285 ms** (**0.0986–0.1797**), **3 rows**. The new production regression test independently counts exactly **3 scanned author rows** for a one-thread update.

Tests in `lib/db/threads.recompute.test.ts` compare canonical authors, raw From, summaries, thread signals, and topic-learning values with full recompute. Cases include stale populated legacy authors, malformed From, Unicode/punycode domains, several threads, duplicate/trimmed/missing IDs, empty and blank lists, batching past 400 IDs, bulk flag updates, and two accounts sharing one shard with identical message/thread IDs. Scoped work preserves other threads and the other account. New tests plus existing `senderIdentityFixes.test.ts`: **8 pass, 0 fail**. Existing bulk-flags route/mutation tests: **18 pass, 0 fail**.

### Rank 4: function-local statement reuse

`remapThreadCollab` prepares stable reads/writes once per call, including message-presence checks, state reads/writes, topic moves, comment/activity moves, comment counts/revisions and merge activity insertion. Existing state/activity SQL is shared through private writer factories; public APIs remain unchanged. A visited-ID set prevents duplicate state snapshot reads for shared targets, including missing state rows. The complete pre-move snapshot and subsequent write ordering remain intact.

`setThreadTopics` prepares its stable assignment INSERT once per invocation. `recomputeCategoriesForAccount` prepares its metadata-only attachment filename lookup once per invocation. No cross-call statement cache or WeakMap was introduced. Dynamic IN predicates remain dynamic. Writer registration and retry code were not changed.

Nine measured repetitions after one warmup, production guards installed:

- Actual remap, 1,000 notes plus 1,000 activities: before **54.8109 ms** (**53.4054–55.8644**), after **14.2144 ms** (**13.9100–14.5173**). Each run uses an immediate transaction and rolls back outside timing. Both return the same source/target revision-2 events, 1,000 moved notes at revision 2, and 1,001 target activities including the merge event.
- Actual `setThreadTopics`, 1,000 topics on one thread: before **60.8464 ms** (**57.8366–61.9853**), after **45.2757 ms** (**44.6384–50.5067**).
- Actual category recompute, 500 metadata-only messages: before **57.4855 ms** (**50.5528–67.4106**), after **43.3790 ms** (**41.1501–49.4743**). Ordered category/score/signal, topic-assignment and topic-learning result hashes match between implementations.

New tests in `lib/db/threadCollab.statements.test.ts` exercise simultaneous swaps, A→B→C chains, shared targets, live/deleted notes, activity placement, topic unions, merge payloads, event order, target revisions, counts and shared-shard account isolation. Collaboration row IDs are globally unique in the current schema, so the second account uses distinct note/activity IDs while sharing local thread/topic IDs. A subsequent remap after closing/reopening the shard verifies handle lifetime. `lib/db/stableLoops.test.ts` checks topic deduplication/removal and learning values plus attachment-based metadata categorization, account isolation and close/reopen between calls.

All five new rank-4 tests pass against **both the original 435ba5d implementations and the updated implementations**. Including existing collaboration storage/remap tests: **19 pass, 0 fail**.

## Verification

- `nice -n 10 bun run typecheck`: **0 errors**, 1,094 files.
- `nice -n 10 bun run lint`: **1 error + 25 warnings**, exactly the supplied baseline. Existing error: `app/components/calendar/useCalendarConflicts.ts:58`, synchronous setState inside an effect. No findings added by this change.
- Sole final `nice -n 10 bun run test:ci`: **exit 0**, **2,512 unit tests across 277 files** (300.09 s) and **366 DOM tests across 40 files** (36.18 s), **0 failures**. Unit count is baseline 2,503 plus nine new regression tests. The known identities-route flake did not occur; all three tests in that file passed on this run. No rerun was necessary.
- `git diff --check`: clean. Exactly two commits on `perf/db-recompute-statements`; final worktree status clean. No push, merge, rebase, stash, destructive reset or branch change.
- All launched commands completed; SQLite benchmark handles closed. No background server or watcher was started or left running.

## Measurement method and artifacts

Copied `author-scope.ts`, `recompute.ts`, `followup.ts` and the rerank JSON results from `/home/monkey/code/noctua-mail/briefs/perf-backlog-rerank/` to `/tmp/perf-dbloops/`. Adapted them to this worktree and a freshly created synthetic master/shard under `/tmp/perf-dbloops/data`; added `setup.ts` and `loops.ts`. Real `getAccountDb`/schema/configuration install the v2 writer guards, and benchmarks assert their presence. No hand-written approximation of the schema, guard bypass, global prepare/query substitution, ANALYZE or PRAGMA optimize was used. No build or server was started.

Before source comparisons use `git show 435ba5d:<allowed-file>` temporarily in this worktree, restored in Python `finally` blocks; no checkout change, stash, branch switch, reset, or extra commit. Reference tests and each benchmark finish before sources are restored. An initial scratch recompute attempt used a mismatched synthetic key and failed before measurement; the key was corrected and genuine before/after measurements rerun. Failed-attempt output and copied rerank results are not used as new timings.

Primary artifacts: `recompute-before.json`, `recompute-after.json`, `author-scope-before.json`, `followup-before.json`, `followup-after.json`, `loops-before.json`, `loops-after.json`, `rank3-tests.log`, `bulk-flag-tests.log`, `rank4-reference-tests.log`, `rank4-targeted.log`, `typecheck-final.log`, `lint-final.log`, `test-ci.log`, plus uptime logs, all under `/tmp/perf-dbloops/`.

All benchmark series are sequential; every reported timing has 9 measured repetitions. Long commands use nice 10. Uptime before benchmarks: **2.44/2.19/2.58** (1/5/15-minute load). Public recompute before/after load: **2.61/2.27/2.58**. Author/remap baseline load: **2.45/2.20/2.59**; remap after **4.04/2.84/2.76** at start, **4.19/2.89/2.78** at end. Topic/category before load **6.16/3.87/3.14**, after **6.15/3.91/3.15**. Final uptime load after verification: **9.42/6.91/4.71**. Shared-host noise and warm synthetic data limit extrapolation.

## Deferred

At the code owner's scope change, `lib/db/messages/retrieval.ts` was restored with the requested `git checkout -- lib/db/messages/retrieval.ts` and excluded from commit 2 and subsequent work. Its stable candidate lookup loop at **`lib/db/messages/retrieval.ts:31`** remains for a separate change owned by that integration round. The supplied rerank reference is **73.56 → 21.62 ms for 5,000 lookups**; this is prior research, not an improvement shipped here. Early scratch attachment-read controls in `followup-*.json` are not a retrieval implementation or retrieval benchmark claim. No retrieval-specific test was added.

## Risks

- Full rebuild still intentionally scans/canonicalizes the entire account. Empty `[]` retains that existing contract.
- Scoped rebuild now intentionally leaves unrelated legacy authors untouched until their own scoped or full rebuild.
- Heavy remap and bulk topic fixtures exaggerate typical small-thread savings. The measured category fixture uses metadata fallback rather than MIME-source parsing; MIME work is unchanged.
- Statement lifetimes are confined to the current function and live connection; close/reopen regression tests cover subsequent calls. No statement is retained globally.
- Existing account/shard, summary, learning and collaboration protocols are preserved. No schema, writer-guard, retry, auth, mail parser, sender identity, dependency, build configuration, or integration-owned file changes were made.

## Files touched

Commit 1:
- `lib/db/threads.ts`
- `lib/db/threads.recompute.test.ts`

Commit 2:
- `lib/db/threadCollab.ts`
- `lib/topics/core.ts`
- `lib/db/categories.ts`
- `lib/db/threadCollab.statements.test.ts`
- `lib/db/stableLoops.test.ts`

Deliverable brief: `/home/monkey/code/noctua-mail/briefs/perf-db-recompute-statements.md` (outside the worktree). Scratch scripts/results/logs are under `/tmp/perf-dbloops/`.
