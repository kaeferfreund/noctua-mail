# Account DB probe memo port

Branch: `perf/connection-memo-stage`, based on `40cf8b6`.
Source: `6692c322278239f0d03ed9ea141741c3b20fc70d`.
Commit: `aa589b813361d72ea6da9cf2b0be338b867fdf15` (`perf(db): skip settled account db probes`).

The original memoized resolved account shard paths and skipped thread-signal,
received-date, and topic-learning probes after their backfills settled. Empty
accounts continue probing so their first messages still receive backfills.
The same settled-data checks are retained in this port.

The port preserves the newer conditional blank-path update, immediate transaction,
and write retry so a concurrent path assignment still wins. The newer collaboration
suite also reassigns paths directly on the live master connection. Cached paths
are therefore invalidated when that connection's SQLite `total_changes()` counter
changes, avoiding stale remaps while still skipping repeated account-row lookups
between writes. This adds one lightweight counter read per lookup; the settled
shard probes remain skipped. Readiness is keyed by
shard path plus account ID, including accounts sharing a shard. A handle identity
check prevents recording readiness for an evicted connection. Existing schema and
calendar initialization, export signatures, auth lifetime locking, `configureDb`,
and all pragma handling are unchanged.

Memo invalidation:
- `closeAccountDbConnection`: clears paths and readiness for every account using
  the shard, including idle eviction and account deletion before reopen.
- `cleanupAccountLifecycleArtifacts`: clears the account's path/readiness even
  when retaining a shared shard; deleting a shard also clears all its memo entries.
- `closeAllDbConnections`: clears both complete caches during shutdown/reset.
Existing account update APIs preserve stored paths. Direct path assignments on
the live master, and changes after close or lifecycle cleanup, are re-resolved.

The two original tests were adapted to current APIs and synthetic fixture data;
four regressions cover close/reopen backfills, path replacement after close,
retained-shard lifecycle cleanup, and live path changes with independent
shared-shard account readiness.
Probe counting covers both `prepare` and `query`.

Code diff: 2 files, 335 insertions(+), 9 deletions(-):
- `lib/db/connection.ts`: +90/-9.
- `lib/db/accountDbProbes.test.ts`: +245.
This standalone report is outside the worktree as requested.

Validation (all Bun commands run under `nice -n 10`):
- TypeScript baseline: 409 `error TS` diagnostics; final: 409 (delta 0).
  No diagnostics in either changed file. Existing TypeScript errors remain open.
- Initial focused regression file: 6 pass, 0 fail, 19 assertions.
- Final targeted run (new file plus existing collaboration filter tests):
  8 pass, 0 fail, 112 assertions, 2 files.
- `bun test lib/db`: 166 pass, 0 fail, 565 assertions, 28 files.
- First full CI run: 2280 pass, 1 fail, 7151 assertions, 248 files; DOM stage
  did not run. The live shared-shard path reassignment exposed stale path caching.
  The write-counter invalidation above fixes it without editing that existing test.
- Final full `bun run test:ci`: exit 0. Primary stage: 2281 pass, 0 fail,
  7158 assertions, 248 files (256.83s). DOM stage: 190 pass, 0 fail,
  1478 assertions, 18 files (24.49s). Total: 2471 passing tests.
- `git diff --cached --check`: passed.

No implementation work remains. Existing TypeScript diagnostics are unchanged;
no new TypeScript errors or failing tests remain. No other repository files were
modified. No push, merge, rebase, PR, or deployment was performed.
