# SQLite performance — ranked findings

Read-only study of `repo/` at `team-inbox` @ `c1652ec`. Nothing in the repo was modified. No servers, no `bun install`, no full test suite.

## How it was measured

Fixture copy: `/tmp/perf-sqlite/db/` from `data/noctua-data-fixture/db`. The account shard is 90 messages, 40 threads, 664 KB (`messages` 90, `message_fts` 90, `message_fts_content` 90). Too small for timings. It was not used for numbers below.

Synthetic shard: `/tmp/perf-sqlite/synthetic.db`, created with `initAccountSchema` from `lib/db/schema.ts` plus the same runtime indexes that function adds. 11,000 messages, 3,667 threads (~3 messages each), 3,667 attachments, 8 folders (inbox 7,000). Body 6,160 chars, `htmlBody` 22,011 chars, preview 88 chars. Addresses are `userN@example.test` only. SQLite **3.53.4** (Bun 1.4.4). Production pragmas only, unless a row says otherwise: `journal_mode=WAL`, `synchronous=2` (FULL), `busy_timeout=15000`, `foreign_keys=ON`, `cache_size=-2000` (2 MiB), `temp_store=0` (file), `mmap_size=0`, `wal_autocheckpoint=1000`, `journal_size_limit=-1`.

File size 427 MB. `dbstat` says the `messages` table alone is 315 MB. That is the bodies.

Timings are warm OS page cache, median of 3–5 runs after one warmup, `nice -n 10`. Cold-cache (`drop_caches`) was not measured. A number from a connection that had already scanned the whole file is marked as contaminated and is not used.

`ANALYZE` is not part of app startup (`lib/db/schema.ts` only mentions it in a warning). Plans below are without `sqlite_stat1` unless the row says otherwise.

## Ship now

Two changes do not need to wait, and they do not touch the sync or message-query files the in-flight branches own.

1. **ready — shard pragmas only** in `lib/db/connection.ts`. Leave the master connection on today's `configureDb`. Overlap: none of the three branches. Do not change master `busy_timeout` (team-auth plan, below).
2. **ready — three indexes** in the additive `CREATE INDEX IF NOT EXISTS` block in `initAccountSchema` (`lib/db/schema.ts` around lines 1148–1157). That is the migration path: `initAccountSchema` runs once per process per shard, and `IF NOT EXISTS` applies to existing files. Overlap: `feat/thread-collaboration` and `feat/team-auth` (both edit `lib/db/schema.ts`). The indexes were checked together. Folder list still uses `idx_messages_account_folder_flagged_date`.

Exact code is in items 4 and 2 below.

## Ranked

### 1. Default thread list sorts every thread before LIMIT

**Impact: high. Measured ~180–270 ms vs 0.85 ms at 11k messages.** Effort: medium. Risk: medium (sort order of flagged threads must stay the same). **Not ready.** Overlap: `feat/mailbox-watcher` and `feat/thread-collaboration` (`lib/db/messages/query.ts`). A `threads.hasFlagged` column would also touch `lib/db/schema.ts` (both of those plus `feat/team-auth`) and `lib/db/threads.ts` (not on those lists).

`GET /api/accounts/[accountId]/threads` defaults to `pageSize` 300 (`app/api/accounts/[accountId]/threads/route.ts:24`). With no search and no badges, `shouldPrioritizeFlaggedThreads` is true (`lib/db/messages/query.ts:2276–2285`). The unfiltered query is `query.ts:2316–2338`:

```sql
SELECT t.*, t.latestReceivedDateValue AS effectiveThreadDateValue
FROM threads t
LEFT JOIN (
  SELECT DISTINCT m.threadId
  FROM messages m
  WHERE m.accountId = ? AND m.flagged = 1 AND COALESCE(m.deleted, 0) = 0
) flaggedThreads ON flaggedThreads.threadId = t.threadId
WHERE t.accountId = ?
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.accountId = t.accountId AND m.threadId = t.threadId
      AND COALESCE(m.deleted, 0) = 0
  )
ORDER BY CASE WHEN flaggedThreads.threadId IS NULL THEN 0 ELSE 1 END DESC,
         t.latestReceivedDateValue DESC
LIMIT 300 OFFSET 0
```

`EXPLAIN QUERY PLAN`: materialize the flagged set via `idx_messages_account_flagged_thread`, scan threads with `idx_threads_account_latest` (the `latestDateValue` index, not `idx_threads_account_latest_received`), correlated `EXISTS` per thread, `USE TEMP B-TREE FOR ORDER BY`. The `CASE` sort means SQLite cannot stop at 300. It scores all 3,667 threads.

| cache | median |
| --- | --- |
| 2 MiB (default) | 200–273 ms |
| 64 MiB, fresh connection | 177 ms |
| 256 MiB, fresh connection | 157 ms |

A larger page cache does not fix this. An earlier 6 ms reading was the same connection after it had already scanned the file. Discarded.

The same function without the `CASE`, `ORDER BY t.latestReceivedDateValue DESC LIMIT 300`, uses `idx_threads_account_latest_received` and median **0.85 ms**. Folder-scoped threads (`query.ts:2427–2438`, inbox 7,000 messages) are the same shape: median **143 ms** at 2 MiB.

A partial index `ON messages(accountId, threadId) WHERE COALESCE(deleted,0)=0` did get used for the `EXISTS` and only moved the time from 273 ms to 204 ms. Not worth adding.

Preferred rewrite, unmeasured, designed so each leg can use the 0.85 ms plan. Keep the existing flagged-first order:

```sql
WITH flagged AS (
  SELECT DISTINCT threadId FROM messages
  WHERE accountId = ? AND flagged = 1 AND COALESCE(deleted, 0) = 0
)
SELECT * FROM (
  SELECT t.*, t.latestReceivedDateValue AS effectiveThreadDateValue
  FROM threads t
  JOIN flagged f ON f.threadId = t.threadId
  WHERE t.accountId = ?
  ORDER BY t.latestReceivedDateValue DESC
  LIMIT ?
)
UNION ALL
SELECT * FROM (
  SELECT t.*, t.latestReceivedDateValue AS effectiveThreadDateValue
  FROM threads t
  WHERE t.accountId = ?
    AND NOT EXISTS (SELECT 1 FROM flagged f WHERE f.threadId = t.threadId)
    AND EXISTS (
      SELECT 1 FROM messages m
      WHERE m.accountId = t.accountId AND m.threadId = t.threadId
        AND COALESCE(m.deleted, 0) = 0
    )
  ORDER BY t.latestReceivedDateValue DESC
  LIMIT ?
)
LIMIT ?;
```

Cleaner long-term: add `threads.hasFlagged INTEGER NOT NULL DEFAULT 0`, set it inside `recomputeThreadsForAccountInternal` (`lib/db/threads.ts:291–355`), and index `(accountId, hasFlagged DESC, latestReceivedDateValue DESC)`. One thread recompute of the window query is **0.40 ms**; 200 threads in one statement is **3.2 ms**. The column has to be maintained on every flag write (`lib/db/messages/flags.ts:26–63` already recomputes the thread).

Files: `lib/db/messages/query.ts`. Optional column: `lib/db/schema.ts`, `lib/db/threads.ts`, `lib/db/messages/flags.ts`, `lib/db/messages/upsert.ts`.

### 2. Sync duplicate lookup scans the whole folder — ready index

**Impact: high on sync. One lookup 15.8 ms → 0.02 ms. 200 lookups 4,232 ms → 1.35 ms.** Effort: small. Risk: low (checked with the other two new indexes; folder list plan unchanged). **ready.** Overlap: `feat/thread-collaboration`, `feat/team-auth` (`lib/db/schema.ts` only).

`upsertMessages` runs, per message, inside the batch transaction (`lib/db/messages/upsert.ts:312–317`):

```sql
SELECT id, threadId, folderId, mailboxPath, imapUid
FROM messages
WHERE accountId = ? AND folderId = ? AND messageId = ? AND id <> ?
```

Plan today: `SEARCH messages USING INDEX idx_messages_account_folder_size (accountId=? AND folderId=?)`. `messageId` is not in that index, so every check walks the folder. Inbox in the synthetic shard is 7,000 rows. Sync calls this once per message (`lib/syncOperation.ts:731`, IMAP batches of 300 at `lib/syncOperation.ts:617`, DB sub-batches of 200 at `upsert.ts:97` and `:600–603`).

Add next to the other additive indexes at `lib/db/schema.ts:1148`:

```sql
CREATE INDEX IF NOT EXISTS idx_messages_account_folder_messageid
  ON messages(accountId, folderId, messageId);
```

Together with items 3 and 5, `EXPLAIN` still shows this index for the duplicate lookup, and the folder list still uses `idx_messages_account_folder_flagged_date` (0.21 ms for 300 ids).

`deleteMessageByFolderUid` (`lib/db/messages/delete.ts:64–66`) and `listFolderMessageUidRows` (`retrieval.ts:261–264`, `ORDER BY imapUid`) are the same class of miss. A separate `(accountId, folderId, imapUid)` index made the point lookup 8.7 ms → 0.02 ms, but the full UID list stayed ~17 ms (it still materializes 7,000 rows) and it competed for folder scans. Leave it out of the first patch.

### 3. `lower(messageId)` lookup scans the account — ready index

**Impact: medium, on every fallback open. 19.4 ms → 0.01 ms.** Effort: small. Risk: low. **ready.** Overlap: same schema branches as item 2.

`getMessageById` (`lib/db/messages/retrieval.ts:33–35`), after the primary-key miss:

```sql
SELECT * FROM messages
WHERE accountId = ? AND lower(messageId) = lower(?)
ORDER BY dateValue DESC
LIMIT 1
```

Plan today: `idx_messages_account_date`, which cannot stop early. Related mail does the same `lower(messageId)` compare (`query.ts:1451`).

A two-column index on `(accountId, lower(messageId))` was **not chosen** while `ORDER BY dateValue DESC` is present (plan stayed on the date index, 14 ms). This one is chosen:

```sql
CREATE INDEX IF NOT EXISTS idx_messages_account_msgid_date
  ON messages(accountId, lower(messageId), dateValue DESC);
```

The expression matches the query with no `COALESCE`. Plan: `idx_messages_account_msgid_date (accountId=? AND <expr>=?)`. Recipient suggestions (`ORDER BY dateValue DESC LIMIT 2000`, `lib/db/messages/utility.ts:132–138`) stayed on `idx_messages_account_date` (5.1 ms). The leading-wildcard fallback `lower(messageId) LIKE ?` (`retrieval.ts:42–44`) still cannot seek.

### 4. Shard pragmas — ready, master left alone

**Impact: moderate on scans, small on the flagged list (item 1).** Effort: small. Risk: low if master is untouched. **ready.** Overlap: none. `lib/db/connection.ts` is not on the watcher, collab, or team-auth file lists. Do not edit master `busy_timeout` anyway: `doc/TEAM-INBOX.md` (D16, around lines 276–283) wants both master writers at `busy_timeout=0` once Better Auth shares `main.db`, because a synchronous wait blocks the Bun event loop.

`configureDb` (`lib/db/connection.ts:65–69`) is the only pragma site, and it is used for both databases:

```65:69:repo/lib/db/connection.ts
function configureDb(db: any) {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 15000;");
  db.exec("PRAGMA foreign_keys = ON;");
}
```

Measured defaults on a fresh connection: `synchronous=2` (FULL), `cache_size=-2000`, `temp_store=0`, `mmap_size=0`, `wal_autocheckpoint=1000` (1000 × 4 KiB ≈ 4 MiB), `journal_size_limit=-1` (WAL file never shrinks).

**`synchronous=NORMAL` on the shard only.** In WAL mode, FULL fsyncs the WAL on every commit. NORMAL fsyncs at checkpoint. An application crash still keeps committed transactions (the OS has the WAL pages). A power loss or kernel crash can roll back commits that have not been checkpointed. It does not corrupt the file. The shard is an IMAP cache: `upsertMessages` is `INSERT OR REPLACE`, and `syncOperation.ts:757–760` stores `highestUid` after each batch, so a lost tail is re-fetched. Master holds passwords and users (`schema.ts:586–639`) and writes rarely. Keep master at FULL.

Write microbench, 200 messages, 6 KB body + 18 KB html, the same per-message `find` + duplicate `SELECT` + insert, three trials. Duplicate lookups were cheap here because the table was empty at the start, so this isolates fsync and FTS, not item 2.

| | median | min | max |
| --- | --- | --- | --- |
| FULL + FTS | 649 ms | 187 ms | 1,126 ms |
| NORMAL + FTS | 405 ms | 79 ms | 601 ms |
| FULL, no FTS | 71 ms | 24 ms | 128 ms |
| NORMAL, no FTS | 70 ms | 22 ms | 134 ms |

The spread is wide. Direction: FTS dominates; NORMAL helps the FTS case and does nothing measurable without it. Without item 2, a real inbox adds ~4 s of duplicate scans per 200 messages on top of this.

**`cache_size`.** Fresh connection, 2 MiB vs 64 MiB, same plans:

| query | 2 MiB | 64 MiB |
| --- | --- | --- |
| folder unread aggregate | 33 ms | 11 ms |
| thread-page message load (895 rows, preview, no body column) | 30 ms | 10 ms |
| FTS `MATCH 'user12'` (28 hits) | 31 ms | 9 ms |
| `from:` `LIKE '%…%'` | 28 ms | 9 ms |
| recipient suggestions, 2,000 rows | 5.3 ms | 1.6 ms |
| flagged thread list (item 1) | 264 ms | 264 ms |

64 MiB does not help item 1. It does cut repeated overflow-page reads on scans. Twelve hot shards × 64 MiB is 768 MiB if every connection is resident; idle close is 5 minutes (`connection.ts:46–52`, `:144–151`). Default the shard to 32 MiB and allow an override. 32 MiB itself was not timed; 64 MiB was.

**`temp_store=MEMORY`.** Unmeasured alone. The flagged plan's temp b-tree is 3,667 small keys, not the 200 ms. Cheap, avoids a temp file during sync sorts.

**`mmap_size`.** Not isolated. Warm-cache gains were mixed with a hot connection in the first run. 128 MiB covers the main file only (WAL is never mmap'd). Virtual address space, not a reserved 128 MiB RSS. Low risk on Linux. Included because the default is off.

**`wal_autocheckpoint=4000` and `journal_size_limit=64 MiB`.** Not timed. Default checkpoint every ~4 MiB stalls the writer and can return `SQLITE_BUSY` to the other process (web server vs sync worker). Raising it to ~16 MiB trades a longer WAL and a longer crash replay for fewer checkpoints during a sync. `journal_size_limit` truncates the WAL after checkpoint so a big sync does not leave a hundreds-of-MB `-wal` file. Neither changes query plans.

**Do not run `PRAGMA optimize` or `ANALYZE` on close or on a timer.** Confirmed on 3.53.4 for `lower(COALESCE(fromAddr,'')) LIKE ?`:

| | plan |
| --- | --- |
| before `ANALYZE` | `SEARCH` via `idx_messages_account_folder_size` |
| after `ANALYZE` | `SCAN messages` |
| after `PRAGMA optimize` | `SCAN messages` |

That matches the comment at `schema.ts:952–954`. `PRAGMA optimize` is a smart `ANALYZE`. It would regress `from:` search. There is no `ANALYZE` call in the app today. Keep it that way.

`idx_messages_account_from_lower` already exists (`schema.ts:955–956`) and is the right index when forced: **29 ms → 2.0 ms** (`INDEXED BY`). The planner does not pick it among the other `accountId` indexes, on 3.53.4, with or without the three new indexes (`from:` stayed ~23 ms on `idx_messages_account_folder_unread`). Do not add more expression indexes for `to`/`cc`/`bcc`. The comment at `schema.ts:942–950` is right about why. Fixing `from:` means a query change (FTS, or a form the planner will seek), not another index. That change is `query.ts` and overlaps both message-file branches.

```ts
function configureDb(db: any) {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 15000;");
  db.exec("PRAGMA foreign_keys = ON;");
}

const ACCOUNT_DB_CACHE_KIB = (() => {
  const raw = process.env.ACCOUNT_DB_CACHE_KIB?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 32768;
  if (!Number.isFinite(parsed) || parsed < 2000) return 32768;
  return parsed;
})();

function configureAccountShard(db: any) {
  configureDb(db);
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(`PRAGMA cache_size = -${ACCOUNT_DB_CACHE_KIB};`);
  db.exec("PRAGMA temp_store = MEMORY;");
  db.exec("PRAGMA mmap_size = 134217728;");
  db.exec("PRAGMA wal_autocheckpoint = 4000;");
  db.exec("PRAGMA journal_size_limit = 67108864;");
}
```

Call `configureAccountShard` from `getAccountDb` (`connection.ts:225`). Leave `getDb` (`connection.ts:183`) on `configureDb`. Do not add `PRAGMA optimize` to `closeAccountDbConnection`.

### 5. Folder badge query reads every message — ready index

**Impact: medium, every folder-list load. 33.4 ms → 1.53 ms, covering.** Effort: small. Risk: low in combination with items 2 and 3 (folder list plan unchanged). **ready.** Overlap: schema branches, same as item 2. `lib/db/folders.ts` does not need an edit.

`getFoldersForAccount` (`lib/db/folders.ts:23–32`):

```sql
SELECT folderId,
       COUNT(*) AS total,
       SUM(CASE WHEN unread = 1 THEN 1 ELSE 0 END) AS unreadCount
FROM messages
WHERE accountId = ?
GROUP BY folderId
```

Plan today: `idx_messages_account_folder_size (accountId=?)`, then a table read for `unread`. That pulls the 315 MB `messages` table through the cache. `folders.count` is stored (`schema.ts:704`) but ignored; the aggregate overwrites it (`folders.ts:46`).

```sql
CREATE INDEX IF NOT EXISTS idx_messages_account_folder_unread
  ON messages(accountId, folderId, unread);
```

Plan with all three new indexes: `SEARCH messages USING COVERING INDEX idx_messages_account_folder_unread`. Median 1.53 ms. `listRecipientSuggestions` deliberately avoids `getFolders` for this reason (`utility.ts:114–116`) and still pays its own scan (item 9).

### 6. FTS is a second full copy of the body, rewritten on every upsert

**Impact: high on sync writes, medium on search.** Effort: high for a format change, medium for the search `OR`. Risk: high for a format change (rebuild every shard). **Not ready.** Overlap: `feat/mailbox-watcher` and `feat/thread-collaboration` (`lib/db/messages/upsert.ts`, `delete.ts`, `query.ts`). A new FTS ddl also hits `lib/db/schema.ts` (all three branches).

Definition (`schema.ts:915–916`):

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS message_fts
USING fts5(messageId, subject, fromAddr, toAddr, ccAddr, bccAddr, body, preview);
```

No `tokenize=`. Default `unicode61` (no porter, no trigram, no `prefix=` index). Prefix queries (`token*`) work; substring does not. No `content=` and no `contentless`. The fixture's `message_fts_content` has one row per message, so the body is stored again beside `messages.body`. No triggers anywhere under `lib/`. Upsert deletes and reinserts the FTS row itself (`upsert.ts:191–195`, `:540–549`).

Per message, inside `db.transaction` of 200 (`upsert.ts:280–584`), steady state, sync (`replaceExisting` false, so attachments are deleted and rewritten):

1. `findMessageById`
2. `findFolderMessageDuplicates` (item 2)
3. `DELETE` attachments
4. `SELECT` calendar rows
5. `DELETE` calendar rows
6. `INSERT OR REPLACE` the message (replace is delete+insert; `attachments` and `message_calendar_events` are `ON DELETE CASCADE`, so step 3–5 are repeated by the cascade)
7. `DELETE` FTS
8. `INSERT` FTS of the full body
9. reinsert calendar uids and attachments

The transaction is real. Statements are prepared once per `upsertMessages` call, not per row. The FTS delete+insert of the body is the expensive pair (table above: ~70 ms vs ~400–650 ms per 200 messages). A full-account thread recompute on top of a 300-message batch is cheap next to that (3.2 ms for 200 threads; the 1,386 ms figure was a one-shot window over all 11,000 fat rows at `synchronous=OFF` during load).

Search does not drive from FTS. `applySearchQueryFilters` (`query.ts:720–761`) ORs the FTS predicate with three leading-wildcard `LIKE`s whenever the raw query is non-empty:

```sql
m.accountId = ?
AND (
  m.id IN (SELECT messageId FROM message_fts WHERE message_fts MATCH ?)
  OR lower(m.messageId) LIKE ?
  OR lower(m.threadId) LIKE ?
  OR lower(m.id) LIKE ?
)
ORDER BY m.dateValue DESC
LIMIT 50
```

`MATCH 'user12'` hit 28 rows. Plan: walk `idx_messages_account_date` and test a bloom of the FTS result, not "seek FTS, then 28 rowids". Median **31 ms** (FTS only) and **57 ms** (FTS `OR` the three `LIKE`s) at 2 MiB cache. Cost tracks the account size, not the hit count. Dropping the id `LIKE`s, or running FTS first and sorting the hit ids, is a `query.ts` change.

`from:` / `to:` / `with:` never use FTS. They are `lower(COALESCE(addr,'')) LIKE '%term%'` (`query.ts:542–570`). See item 4 for the unused `from` index.

### 7. Thread-list payload is wide, but it does not ship the body

**Impact: medium server-side, modest on the wire.** Effort: high to move bodies out of `messages`. Risk: high. **Not ready.** Overlap: schema (all three branches) and `lib/db/messages/**` (watcher and collab).

For the default page (300 threads → 895 messages in this shard), the JSON of the selected columns was **716 KB**. `listThreads` does not select `body` or `htmlBody` (`query.ts:2514–2559`). The mapper sets `body: ""` (`query.ts:2611`). Preview, addresses, flags, and `categorySignals` are included. That is what the list needs. `getMessageById` does `SELECT *` (`retrieval.ts:27`), which is the open-message path.

SQLite still reads the whole row to project those columns. The `messages` table is 315 MB of the 427 MB file because `htmlBody` sits in the row. A narrow `SELECT` of the same 895 rows was 25 ms vs 42 ms for the list select plus the two attachment `EXISTS` subqueries (`query.ts:2550–2552`) at 2 MiB cache. The attachment `EXISTS` uses `idx_attachments_message` and is not the problem. Moving `body` / `htmlBody` to `message_bodies(id, body, htmlBody)` would shrink the scanned table by roughly that 315 MB and keep list/FTS/sync from hauling HTML through the page cache. It touches every writer. Not a first patch.

`pageSize` 300 with no cap (`threads/route.ts:24`) multiplies item 1 and this load. Capping the default is a route change, not a SQLite change. The route file is not on the overlap lists.

### 8. `busy_timeout` and the sync worker stack, and the wait is synchronous

**Impact: high only while a writer is blocked. Not the steady-state list.** Effort: small, but a behavior change. Risk: medium. **Not ready** (do not fold it into item 4). Overlap: none for `lib/db/connection.ts` and `lib/dbWriteRetry.ts`. The workers themselves are `lib/syncJobs.ts` / `lib/mail/imap/**` (watcher).

Connections:

- Master: one per process, never idle-closed (`connection.ts:41`, `:176–197`). Closed on `SIGINT` / `SIGTERM` / `beforeExit` (`:168–174`).
- Shard: `Map` by path (`:43–44`). First `getAccountDb` opens it (`:219–227`). Every later call in that process reuses it and resets a 5-minute unref'd idle timer (`:246`). Not one connection per request.
- Sync is a child process: `spawnSyncWorker` runs `bun run` on the sync entrypoint (`lib/syncJobs.ts:378–395`). One running job per account. That process has its own cache and its own connection to the same file. Recompute workers are separate processes too.
- WAL allows the web process to read while the worker writes. A second writer blocks.

`busy_timeout=15000` waits **inside** the synchronous `bun:sqlite` call, on the Bun event loop. `withDbWriteRetry` (`lib/dbWriteRetry.ts:7–9`, `:47–96`) only starts after SQLite gives up: 5 attempts, backoff 120 ms → 2 s. Worst case is about 5 × 15 s plus the sleeps, and each 15 s freezes the server. Reads do not take the write lock. Flag updates, moves, and a `getAccountDb` backfill that still has work to do, do.

Today the long holder is the upsert transaction (item 6) plus the folder scan in item 2 (~4 s per 200 messages before the index). That is under 15 s, so the retry helper often never runs; the UI write just sits inside `busy_timeout` until the worker commits. After item 2, a 200-message FTS transaction is a few hundred milliseconds at this body size. Larger real HTML will stretch it. Leave the timeout at 15 s in the ready pragma patch. Revisit only if sync transactions still exceed a second after items 2 and 6.

`ensureThreadLatestReceivedDateValues` (`threads.ts:222–268`) can `UPDATE` on the read path when any `latestReceivedDateValue` is null. After the backfill, the probe is a read. Until then it contends with the worker.

### 9. `getAccountDb` does extra work on every call; the barrel does not

**Impact: low (sub-millisecond) next to item 1.** Effort: small. Risk: low for a path cache. **Partly ready** (path cache only, in `connection.ts`). Overlap: none for that cache. Moving the probes is `lib/db/threads.ts` and `lib/db/topics.ts` (not on the branch lists).

After the first call, schema ensures are WeakMap-gated and return immediately (`schema.ts:132–138`, `:221–229`, `:244–249`, `:522–526`). These still run SQL every time, and they use `prepare` (not cached):

- `resolveAccountDbPath`: `SELECT id, dbPath FROM accounts WHERE id = ?` on the master, every call (`connection.ts:203–216`). The `UPDATE` backfill is rare.
- `ensureThreadSignalRuntimeData`: `SELECT 1 FROM thread_signals … LIMIT 1` (`threads.ts:145–148`). Not WeakMap-gated.
- `ensureThreadLatestReceivedDateValues`: `SELECT 1 FROM threads WHERE latestReceivedDateValue IS NULL LIMIT 1` (`threads.ts:240–247`).
- `ensureTopicLearningRuntimeData`: `SELECT 1 FROM topic_learning_signals … LIMIT 1` (`topics.ts:184–187`).
- `getAccountEmail`: `SELECT email FROM accounts WHERE id = ?` on every list (`accounts.ts:84–89`), called from `listThreads` (`query.ts:2188`).

`ACCOUNT_DB_IDLE_MS` is read once at module load (`connection.ts:46–52`), not per call.

`lib/db.ts` wrappers (`:62–80` and the calendar block from `:227`) are one extra JS call so Bun `mock.module("@/lib/db")` can replace the binding. They do not open a connection or read env. `lib/serverDb.ts:6–8` `import("./db.ts?server-runtime")` on every call; the runtime caches that module, so the steady cost is one microtask. Neither is worth changing for speed.

400 compiles of `SELECT 1 WHERE ? = ?` via `prepare`: **2.39 ms**. The same SQL via `db.query` (cached): **0.19 ms**. A real indexed lookup was 0.02 ms vs 0.01 ms. There are **no** `db.query` call sites under `lib/` (only `scripts/dev-fixture/store.ts`). Hot SQL is dynamic (`WHERE` is concatenated, `IN` lists change length), so the statement cache would miss anyway. Do not convert the codebase to `query()` for its own sake. Do prepare the stable probes once if those functions are touched.

`prepare` inside a loop, for a SQL string that does not change:

- `lib/db/categories.ts:513` (`SELECT filename FROM attachments WHERE messageId = ?` per message during recompute).
- `lib/db/messages/retrieval.ts:25–28` (same `SELECT` per id candidate, usually one or two).
- `lib/topics/core.ts:241` (`INSERT` per topic id).

`IN (...)` prepares in `threads.ts` and `upsert.ts` have to recompile because the SQL text changes with the chunk length. That is fine.

A ready path cache, invalidated when an account row is deleted or `dbPath` changes (`patchAccount`, account delete):

```ts
const accountDbPathByAccountId = new Map<string, string>();

async function resolveAccountDbPath(accountId: string) {
  const cached = accountDbPathByAccountId.get(accountId);
  if (cached) return cached;
  // existing master SELECT / defaultPath / UPDATE body
  accountDbPathByAccountId.set(accountId, resolved);
  return resolved;
}
```

Clear the entry from the account-delete path. A stale path would open the wrong file.

### 10. Related mail is an OR of leading-wildcard LIKEs

**Impact: medium on that one view. The synthetic predicate matched 10,945 / 11,000 rows and took ~50 ms; a tighter subject would still scan.** Effort: medium. Risk: medium (ranking changes). **Not ready.** Overlap: `lib/db/messages/query.ts` (watcher and collab).

`listRelatedMessages` (`query.ts:1509–1613`) builds `id = ? OR lower(subject) LIKE ? OR lower(from/to/cc/bcc) LIKE ? OR lower(messageId/inReplyTo/"references") LIKE ?`, then sorts and scores in JS (`:1640–1703`). Plan: `idx_messages_account_date` and a residual filter. No index can seek `LIKE '%token%'`. Same FTS table as item 6 should answer subject and address tokens. `references` is a JSON blob; FTS will not match it unless it is written as tokens.

### 11. Topic suggestions on the thread list are one query per thread

**Impact: unmeasured, structural. Default thread GET turns them on.** Effort: medium. Risk: low if the result set stays the same. **Not ready** (not connection.ts or an index). Overlap: **none** of the three branches. `app/api/accounts/[accountId]/threads/route.ts` and `lib/topics/suggestions.ts` are outside their file lists.

`threads/route.ts:49–53` calls `enrichMessagesWithThreadTopics` with `includeSuggestions: true`. Threads with no topic each call `getTopicSuggestionsForSignals` (`suggestions.ts:534–541`), which `prepare`s a fresh `OR` over `topic_learning_signals` (`:288–308`). Signals themselves are one batched read (`:190–197`). The per-thread query is the N. On a 300-thread page where most threads have no topic, that is up to 300 compiles and lookups. The synthetic shard had no signals, so the early return at `suggestions.ts:257–264` made the cost invisible. Batch the signal match the way `getTopicsForThreads` already batches (`lib/topics/core.ts:185–208`).

### 12. Copy-to-account loads each message with `SELECT *`

**Impact: low (not the list).** Effort: small. **Not ready.** Overlap: `lib/db/messages/retrieval.ts` (watcher and collab). `app/api/accounts/[accountId]/messages/copy-to-account/route.ts:121–122` calls `getMessageById` in a loop, which also pulls attachments and calendar rows (`retrieval.ts:49–56`). Flag bulk update is already one transaction (`flags.ts:80–110`). Single-message flag update recomputes that one thread (`flags.ts:58–63`); that recompute is 0.4 ms and is fine.

## Existing message and thread indexes

From `initAccountSchema` plus the `ensure*` indexes it calls. All present on the synthetic file.

| index | columns | used by |
| --- | --- | --- |
| `idx_messages_account_folder_date` | `(accountId, folderId, dateValue DESC)` | folder equality; often loses to the size index when `folderId` is absent |
| `idx_messages_account_date` | `(accountId, dateValue DESC)` | suggestions, thread-message `IN` + `ORDER BY date`, FTS bloom walk |
| `idx_messages_thread` | `(threadId)` | not the winner when `accountId` is also predicated |
| `idx_messages_account_thread_date` | `(accountId, threadId, dateValue DESC)` | `EXISTS` in the thread list, one-thread recompute |
| `idx_messages_account_flagged_thread` | `(accountId, flagged, threadId)` | flagged-set materialize |
| `idx_messages_account_flagged_date` | `(accountId, flagged DESC, dateValue DESC)` | |
| `idx_messages_account_folder_flagged_date` | `(accountId, folderId, flagged DESC, dateValue DESC)` | folder message list `ORDER BY flagged, dateValue LIMIT 300` — **0.21 ms**, leave it alone |
| `idx_messages_category` | `(accountId, category, dateValue DESC)` | category badge filters |
| `idx_messages_account_from_lower` | `(accountId, lower(COALESCE(fromAddr,'')))` | **not selected** for `LIKE '%term%'`; 2.0 ms when forced, 29 ms otherwise |
| `idx_messages_account_size` / `_folder_size` | size sort | planner's favorite for "accountId only" scans, including the unread aggregate |
| `idx_messages_account_pending_move_*` | pending move | |
| `idx_threads_account_latest` | `(accountId, latestDateValue DESC)` | chosen when `ORDER BY` is not exactly `latestReceivedDateValue` |
| `idx_threads_account_latest_received` | `(accountId, latestReceivedDateValue DESC)` | the 0.85 ms list |
| `idx_attachments_message` | `(messageId)` | attachment `EXISTS` |
| `idx_thread_signals_account_thread` / `_signal` | | suggestion signal load, the per-call probe |

Migration pattern, for the three ready indexes and anything later: there is no `user_version` and no migrations table. New columns are `PRAGMA table_info` + `ALTER TABLE` (`schema.ts:1100–1147`). New indexes are `CREATE INDEX IF NOT EXISTS` in the `db.exec` immediately after that (`:1148–1157`), which runs for old files on the next `initAccountSchema`. Put the three statements in that exec. Do not add them only inside the big `CREATE TABLE` string higher up; that string also runs, but the additive exec is the place later indexes already live.

## Do not do

- `PRAGMA optimize` or `ANALYZE` on the shard (item 4). Turns `from:` search into a table scan.
- More `lower(toAddr/ccAddr/bccAddr)` expression indexes (`schema.ts:942–950`).
- The partial visible-thread index and the UID covering index. Small or negative plan changes when added alone.
- A two-column `lower(messageId)` index without `dateValue`. The planner ignores it.
- `db.query()` conversion as a project-wide cleanup.
- Master `synchronous=NORMAL` or master `busy_timeout` changes. Team-auth owns that decision.
- Editing `lib/db/messages/**`, `lib/mail/imap/**`, `lib/syncJobs.ts`, or `lib/syncOperation.ts` for any of the ready items. Those belong to `feat/mailbox-watcher` and, for `lib/db/messages/**` and `schema.ts`, `feat/thread-collaboration`.

## What is already in good shape

- Upserts are wrapped in `db.transaction`, 200 at a time, statements prepared outside the row loop.
- Folder message list order uses `idx_messages_account_folder_flagged_date` (0.21 ms for 300 ids).
- The unflagged thread list uses `idx_threads_account_latest_received` (0.85 ms). The default UI does not take that path (item 1).
- Thread-list JSON omits the body (716 KB for 895 messages, preview included on purpose).
- Attachment lookups are indexed.
- One-thread recompute is 0.4 ms. Flag bulk update is one transaction.
- Shard connections are reused for 5 minutes, not opened per request. The sync writer is a separate process, which is why WAL matters.
- `lib/db.ts` mock wrappers and `serverDb.ts` dynamic import are not the hotspot.
