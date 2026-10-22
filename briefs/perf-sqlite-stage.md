# SQLite quick wins on the integration stand

2026-10-22. Worktree: `/home/monkey/code/noctua-mail/wt-perf-sqlite-stage`, branch `perf/sqlite-stage`, base `40cf8b6019327815c53b09b9ebee2a50ffc1effe`.
Commit: `bc44a4a39e2552de8215873e329e7c69c2136da2` (`perf(db): tune account shards and add quick-win indexes`).

```text
 lib/db/connection.auth.test.ts | 88 ++++++++++++++++++++++++++++++++++++++++++
 lib/db/connection.ts           | 21 +++++++++-
 lib/db/schema.ts               |  8 ++++
 3 files changed, 115 insertions(+), 2 deletions(-)
```

The existing shard-only call omits the timeout argument; every master writer passes an explicit timeout. `configureDb` now applies shard pragmas only when that argument is omitted. `getAccountDb`, its probes, and all other connection call sites are unchanged. The three indexes are appended after `idx_messages_account_folder_size` in the additive index block, marked `perf-sqlite quick-win indexes`.

Measured through real initialization against fresh temporary files, SQLite 3.53.4:

- Master and auth handles, before = after: `journal_mode=wal`, `synchronous=2` (FULL), `busy_timeout=0`, `foreign_keys=1`, `cache_size=-2000`, `temp_store=0`, `mmap_size=0`, `wal_autocheckpoint=1000`, `journal_size_limit=-1`.
- Shard, unchanged: `journal_mode=wal`, `busy_timeout=15000`, `foreign_keys=1`.
- Shard, before → after: `synchronous=2 → 1` (NORMAL), `cache_size=-2000 → -32768` (32 MiB), `temp_store=0 → 2` (MEMORY), `mmap_size=0 → 134217728`, `wal_autocheckpoint=1000 → 4000`, `journal_size_limit=-1 → 67108864`.
- `ACCOUNT_DB_CACHE_KIB` retains the brief's parsing and minimum: default 32768; overrides below 2000 or invalid values fall back to 32768. Tests cover 65536, 1999, and invalid input.

Indexes:

- `idx_messages_account_folder_messageid` on `(accountId, folderId, messageId)`.
- `idx_messages_account_msgid_date` on `(accountId, lower(messageId), dateValue DESC)`.
- `idx_messages_account_folder_unread` on `(accountId, folderId, unread)`.

EXPLAIN QUERY PLAN for the brief's folder badge aggregate, binding a synthetic account ID:

```sql
SELECT folderId, COUNT(*) AS total,
       SUM(CASE WHEN unread = 1 THEN 1 ELSE 0 END) AS unreadCount
FROM messages WHERE accountId = ? GROUP BY folderId;
```

Before: `SEARCH messages USING INDEX idx_messages_account_folder_size (accountId=?)`.
After: `SEARCH messages USING COVERING INDEX idx_messages_account_folder_unread (accountId=?)`.
Both plans were captured on fresh, empty shards; no timing improvement is claimed from this probe. No statistics-generating SQL was added or executed.

Verification, all Bun commands under `nice -n 10` (child processes inherit niceness; new probes explicitly use `nice` too):

- No `typecheck` script exists. `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'`: clean, stash-free baseline **409**; final **409**. Full diagnostic logs are byte-for-byte identical. Both compiler runs exit 2 because of existing errors; this stand is not typecheck-green.
- `bun test lib/db`: **164 pass, 0 fail**, 550 expectations, 27 files, 14.83 s.
- `bun run test:ci`: exit **0**. Server suite: **2279 pass, 0 fail**, 7143 expectations, 247 files, 303.12 s. DOM suite: **190 pass, 0 fail**, 1479 expectations, 18 files, 24.14 s. Combined: **2469 pass, 0 fail**.
- Four added tests exercise fresh real shard initialization, index presence in `sqlite_master`, missing-index recreation on reopen, connection-local pragma reapplication, unchanged master/auth values, and cache overrides. They use isolated subprocesses and temporary directories.
- Final diff whitespace check passed. Verification logs are `/tmp/perf-sqlite-stage-{baseline-tsc,final-tsc,db-tests-final,test-ci-final}.log`.

All requested work and checks completed. The report is outside the worktree at the requested path and is not part of the commit. No push, merge, rebase, PR, or deployment was performed.
