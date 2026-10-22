# Task draft: perf/db-stage (rebuild of 6692c32 + SQLite quickwins on integration/stage)

Status: DRAFT, waiting for the Umbau thread's ping with the integration/stage SHA that contains collab-ui (r2). Do not start before that.

## Base
- Worktree: /home/monkey/code/noctua-mail/wt-perf-db-stage, branch perf/db-stage from origin/integration/stage @ <SHA from ping>.
- Codex gpt-6.1-sol high via delegate_task; agent commits on the branch, never pushes, never merges.

## Scope (two commits)
1. `perf(db): skip settled account db probes` — re-implement commit 6692c32 (wt-perf-server, chore/perf-server-quickwins) on the new lib/db/connection.ts. Original: getAccountDb memoises the per-account probe once it has settled; test lib/db/accountDbProbes.test.ts (152 lines) comes along. Show `git show 6692c32` to the agent; the conflict is only textual (team-auth/collab moved code in connection.ts).
2. `perf(db): shard pragmas + three indexes` per briefs/perf-sqlite.md "Ship now" items (exact code in the brief's items 2 and 4): pragmas only for account shards inside configureDb (master connection stays exactly as today, do not change master busy_timeout); the three `CREATE INDEX IF NOT EXISTS` in the additive block of initAccountSchema in lib/db/schema.ts. NEVER add PRAGMA optimize / ANALYZE (SQLite 3.53.4 turns from: search into a full scan).

## Constraints
- Touch only lib/db/connection.ts, lib/db/schema.ts, new/adjusted tests under lib/db/. No other files, no package.json/bun.lock.
- Verify: `bun run typecheck` (bun check; baseline = the Umbau thread's 60 errors in 6 test files, no new ones), `bun test lib/db`, then full `bun run test:ci` niced (`nice -n 10`), host is loaded.
- Report to briefs/perf-db-stage.md: diff stat, before/after of the probe memo (count of probes per request), index names, test numbers.

## After the agent
Orchestrator verifies, pushes perf/db-stage, offers it to the Umbau thread for the next stage round. No merge into stage or team-inbox by this thread.
