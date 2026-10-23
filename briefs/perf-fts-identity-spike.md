# FTS identity spike — decision brief

2026-10-23 UTC. Source checkout: `/home/monkey/code/noctua-mail/wt-fts-spike`, detached at **620a7854006ef09ebdf762c91209a9f54f4d44f3**. Research only. All experimental code and synthetic databases are in `/tmp/fts-spike/`. No checkout files, branches, commits, stashes, servers, or real mailboxes were used or changed. The checkout was clean before and after. Sibling worktrees and `repo` were not accessed.

## Decision

**Recommend (d): retain contentful FTS5 and add a composite-key side table that owns the FTS integer rowid.** Use its indexed lookup for every single-message and scoped FTS deletion, and explicitly supply that rowid when inserting. Keep search semantics and the `messages` schema unchanged. This is an identity fix; defer external-content/contentless storage changes to a separate proposal.

On the synthetic 11,000-message shard, 200 FTS deletes including mapping lookups take **1,945.54 → 6.46 ms** (about **301× faster**); a narrow existing-message SQL upsert takes **10.817 → 0.531 ms**. The mapping adds approximately **0.33 MiB**. A full side-table/FTS rebuild takes **480.77 ms**. A separately measured atomic **v2 → v3 migration**, including guard replacement, validation and commit, takes **837.68 ms** median; reopening its already migrated shape takes **0.48 ms** in the scratch prototype. These are local SQLite measurements, not whole sync/API timings.

**Shard-format owner review is required before implementation.** In particular, the v2 migration, downgrade boundary, persistent guard replacement, both read-only legacy FTS views, connection registration, and startup concurrency belong to the sync/auth owners. This brief does not authorize implementation or deployment.

## Current state at 620a785

### DDL and identities

`lib/db/schema.ts:1102` creates exactly:

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS message_fts
USING fts5(accountId UNINDEXED, messageId UNINDEXED, subject, fromAddr,
           toAddr, ccAddr, bccAddr, body, preview);
```

`ensureAccountKeySchema` in `lib/db/accountKeys.ts:160` rebuilds old account keys and, if necessary, rebuilds this contentful FTS from `messages`. Its FTS DDL at `:200` has the same columns/options. The canonical backfill is:

```sql
INSERT INTO message_fts
  (accountId,messageId,subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview)
SELECT accountId,id,subject,fromAddr,toAddr,
       COALESCE(ccAddr,''),COALESCE(bccAddr,''),body,preview
FROM messages;
```

`installShardWriterGuards` (`lib/db/shardFormat.ts:46`) renames the virtual table to **`message_fts_v2`** and reserves its original name:

```sql
ALTER TABLE message_fts RENAME TO message_fts_v2;
CREATE VIEW message_fts AS SELECT rowid,* FROM message_fts_v2;
PRAGMA user_version=2;
```

`SHARD_FTS_TABLE` names the physical v2 table. The ordinary `messages` table has `PRIMARY KEY(accountId,id)`, not an `INTEGER PRIMARY KEY`, and is not `WITHOUT ROWID`. Its hidden rowid and the FTS rowid are independent. In FTS, **`messageId` means the local `messages.id`**, including collision variants. In `messages`, **`messageId` means the RFC Message-ID**. This distinction is essential for external-content DDL.

FTS has no ordinary B-tree index on the two UNINDEXED keys. The current delete plan is virtual-table index `0:`; the rowid delete plan is `0:=`. The benchmark deliberately initializes baseline FTS rowids at `messages.rowid + 500000` so accidental equality cannot pass.

### Writes, deletion and rebuilds

* `lib/db/messages/upsert.ts:195` uses `INSERT ... ON CONFLICT(accountId,id) DO UPDATE`, **not** replacement of the message row. After the message UPSERT, `:647` deletes FTS by `(accountId,rowId)` and `:648` inserts nine FTS columns without supplying a rowid. Consequently the FTS integer identity is not maintained across refreshes.
* The prepared key delete is at `upsert.ts:255`; the FTS insert is at `:251`. The same delete removes same-mailbox duplicates before deleting their message rows (`:426`). Collision variants preserve separate mailbox copies and must each obtain a separate mapping.
* `replaceExisting` prepares account/folder FTS deletes at `:161`. Folder deletion correlates FTS to `messages`; account deletion filters only the UNINDEXED account field. Scope deletion happens before messages disappear, inside the `.immediate()` transaction around `:709`. The 200-row chunks do not remove that enclosing writer lock. File staging/rollback, identity snapshots, collaboration remaps, calendar state, thread recompute and retry behavior are separate invariants to retain.
* `lib/db/messages/delete.ts:94`, `:145`, `:212` cover single, batched and folder-prefix deletes. They explicitly remove FTS before messages; no foreign key cascades into FTS today. These paths must also switch to identity lookups. Fixing only upsert would leave substantial scans and inconsistent lifecycle handling.
* The production FTS reconstruction found by the source inventory is the account-key migration above. There is no separate application FTS `rebuild`/`REINDEX` maintenance path in `lib` or `scripts`. Re-sync/replaceExisting repopulates via upsert. Any future repair/rebuild must regenerate mappings and FTS together.

### Reads and ordering

`lib/db/messages/query.ts:738` adds:

```sql
(m.accountId,m.id) IN (
  SELECT accountId,messageId FROM message_fts_v2
  WHERE message_fts_v2 MATCH ?
)
```

The helper builds scoped prefix/phrase token queries; tokens combine with AND, while FTS and attachment-filename matches can combine with OR per token. It also ORs raw substring searches of RFC message ID, thread ID and local ID (`:761`). Default indexed fields are sender, recipients, subject and body; explicit field selection also supports preview. This is membership filtering, with message/thread date/flag ordering and existing pagination/group counts outside FTS. There is no BM25 ranking contract to replace. Keep attachment, substring, account, visibility, badge and folder predicates intact.

**Related mail around `query.ts:1534` does not use FTS.** It derives subject substrings and participant addresses, then ORs those with self/thread/reference/calendar-UID relationships. Preserve that query as-is; neither its participant `LIKE` scans nor the main search's OR scans are fixed by an FTS identity change.

### Audited boundary and S3 additions

The corrected conclusions in `briefs/audit-s1s2-verify.md` and `briefs/perf-writer-guards.md` remain requirements:

* `prepareAccountShardConnection` checks future versions **before configuration, function registration or schema/data writes**. `configureAccountDb` calls it even for handles that skip initialization; direct schema initialization also calls it.
* The connection-local function `noctua_writer_v2()` returns 2. There are **78 persistent BEFORE guards**, INSERT/UPDATE/DELETE on all **26 account-scoped ordinary tables**, including empty tables. Each checks `IS NOT 2` and aborts on a wrong marker; missing-function preparation also rejects legacy SQL even for zero-row operations. Guards run per row, not once per statement.
* `ensureAccountKeySchema` disables foreign keys outside the transaction only for the historical parent/child rebuild, rechecks after taking the immediate lock, preserves ordinary indexes/custom triggers, checks foreign keys, and restores the prior setting on success/failure. Keys, FTS swap, guards and version change are atomic. The initialized fast path must stay read-only.
* Legacy FTS DML fails because `message_fts` is a read-only view. SQLite does not permit the same guards on FTS virtual or shadow tables. Direct deliberate writes to the physical v2 table are currently possible from an unregistered handle; do not claim protection against arbitrary SQL clients. Preserve the demonstrated legacy-binary boundary and strengthen it for stale v2 writers when introducing v3.
* Keep `withDbWriteRetry`, all opener coverage, and the audited runtime version comparison. Do not replace guards with a constant, weaken them to compile-only checks, or remove them for performance.

S3 adds nullable **`senderKey` and `sourceSha256`** to both `ACCOUNT_KEY_TABLE_SQL.messages` and additive initialization (`schema.ts:1299`). Upsert persists the sender key and staged-source digest for the final collision-resolved row; same-copy snapshots preserve source provenance through replacement. `getMessageById` (`retrieval.ts:67`) invokes `backfillMessageSenderKey`; thread retrieval also invokes it. The implementation lives in `messages/senderKey.ts`:

1. Only proceed when `senderKey` is NULL and `sourceSha256` exists.
2. Read the retained source with `{exact:true}` for that account and final local ID; a base-ID fallback cannot establish ownership.
3. Require SHA-256 equality before deriving the wire From key.
4. Update only if account, ID, NULL key, `fromAddr` and digest still match; reread the stored key to handle concurrent resync.

An FTS migration must copy these columns verbatim if it rebuilds `messages`, including NULL/unknown values; it must not parse sources, infer permissions from displayed addresses, or manufacture digests. The recommended side table does not rebuild or update `messages`. Sender-only/provenance-only backfills do not change indexed text and must not cause an FTS rewrite.

## Measured comparison

The following tables are generated from `/tmp/fts-spike/results.json`. All times are milliseconds; search includes the current tuple-membership/ID-OR/date-order SQL shape, not only the MATCH cursor. For contentless, rowid membership replaces tuple membership. `needle*` has **28 matches**; `synthetic*` has **11,000 matches**; the returned page contains 28/50 rows respectively.

| Variant | 200 FTS deletes, median [min–max] | Existing SQL upsert | Full FTS rebuild | Selective search | Common search |
|---|---:|---:|---:|---:|---:|
| Current keys | 1,945.54 [1,916.82–1,968.29] | 10.817 | 449.75 | 14.29 | 27.60 |
| (a) Hidden messages.rowid — unsafe identity | 5.84 [5.75–5.95] | 0.444 | 442.73 | 13.55 | 27.05 |
| (a) Stored messages.ftsRowid | 6.41 [6.35–6.49] | 0.508 | 453.12 | 14.04 | 30.03 |
| (b) External content; explicit old-value delete | 9.26 [6.77–10.03] | 0.279 | 314.50 | 14.07 | 35.37 |
| (c) Plain contentless; explicit old-value delete | 7.23 [6.86–9.48] | 0.277 | 320.17 | 15.32 | 3.81 |
| (d) Contentful + identity side table | 6.46 [6.02–7.30] | 0.531 | 480.77 | 13.37 | 29.65 |

| Variant | Live DB allocation, MiB | Physical DB, MiB | FTS + mapping allocation, MiB | 300k live DB estimate, GiB | 300k index rebuild estimate, s |
|---|---:|---:|---:|---:|---:|
| Current keys | 142.63 | 144.31 | 50.62 | 3.80 | 12.27 |
| (a) Hidden messages.rowid — unsafe identity | 142.58 | 144.31 | 50.57 | 3.80 | 12.07 |
| (a) Stored messages.ftsRowid | 142.77 | 144.45 | 50.62 | 3.80 | 12.36 |
| (b) External content; explicit old-value delete | 99.68 | 144.31 | 7.54 | 2.65 | 8.58 |
| (c) Plain contentless; explicit old-value delete | 99.68 | 144.31 | 7.54 | 2.65 | 8.73 |
| (d) Contentful + identity side table | 142.96 | 144.64 | 50.95 | 3.81 | 13.11 |

### Scope and reproducibility

Bun **1.4.4**, SQLite **3.53.4**, Linux arm64. The host exposes 12 logical CPUs; the supplied scheduling constraint describes a shared six-core machine. No CPU affinity or exclusive allocation was assumed. All heavy commands ran under `nice -n 10`; own timed series were sequential. Recorded per-variant 1/5/15 load samples span approximately 4.7–7.6 / 5.6–6.3 / 6.5–6.8. Shared-host variation limits tiny inter-option comparisons.

The fixture uses the checkout's actual `initAccountSchema`, which installs all 78 guards. It has one synthetic account, 11,000 messages/3,667 thread IDs, the prior rerank's 3,900-character body (`Synthetic body alpha beta gamma delta. ` repeated 100 times), HTML of the same size, synthetic addresses, and every 400th subject containing `needle`. Half the rows carry synthetic non-NULL sender/provenance markers; half retain NULL. No source files are opened. Other schema tables exist but are empty. Message/account/thread indexes come from production initialization; no ANALYZE or PRAGMA optimize was run.

Shard settings match the current configuration: WAL, synchronous NORMAL, foreign keys ON, 32 MiB cache, temp_store MEMORY, mmap 128 MiB, wal_autocheckpoint 4000, journal_size_limit 64 MiB. The side-table case adds its three guards (81 total); other timing cases retain 78. External/contentless use explicit statements, not maintenance triggers. The v3 migration/security prototype separately tests the new marker boundary.

One warmup precedes each series. Medians: five repetitions for 200 deletes, 15 for an existing-message upsert, three for full rebuild, 21 for search. Write samples include BEGIN IMMEDIATE and ROLLBACK, restoring identical data; they exclude commit durability/checkpoint cost. The delete samples delete **only FTS**, including indexed rowid discovery; they leave messages/mapping intact for rollback. The upsert sample changes subject/body, executes the exact 47-binding production message UPSERT SQL extracted from `upsert.ts`, and maintains FTS/identity. It excludes source/attachment/calendar/thread/collaboration/auth/network work. No end-to-end sync speedup is claimed.

The rebuild sample drops/recreates FTS, bulk-populates from messages, and restores the legacy view; (d) also rebuilds its mapping. The stored-ID setup/backfill is outside that rebuild timing; the separate full version-migration measurements below include it. All temporary write samples roll back; these are clean initial-index timings, not a long-term FTS fragmentation/merge soak. Search samples materialize the ordered page. The artifact also contains exploratory `upsertNew` values; these skip the baseline's unconditional missing-key delete and **must not be treated as current production new-message upsert timings**.

DB live allocation is `(page_count - freelist_count) * 4096`; FTS/mapping page attribution comes from `dbstat`. Physical file size is also shown because dropping FTS does not shrink a migrated database. No VACUUM was used in the benchmark. This synthetic corpus is repetitive and relatively small per message; storage ratios and elapsed times will differ for real text.

Scratch artifacts:

* `bench.ts`, `results.json`, per-case logs; `evidence/` contains copies of the prior rerank's `sql.ts`, `fts.ts`, `fts-existing.ts`.
* `baseline.db.gz` is the retained compressed synthetic v2 fixture; transient uncompressed option databases were removed to keep scratch usage down.
* `migrate-lib.ts`, `migration.ts`, `crash-worker.ts`, `migration-results.json`, `migration.log` implement only the scratch side-table migration/security experiment.

The harness attempts hit a live-statement checkpoint lock and intermittent EDQUOT/SQLITE_IOERR_WRITE during large restores on the shared tmpfs. Those incomplete runs are excluded. Explicitly finalizing retained prepared statements before closing/reusing a database and streaming gzip restores allowed all comparison cases and the recommendation migration/security series to complete. A later optional full-migration series for the other options again hit the shared quota and yielded no results. The final JSON contains all completed samples; failure logs remain for transparency. To rerun a single variant after the fixture exists:

```sh
RESUME=1 MODE=side nice -n 10 bun /tmp/fts-spike/bench.ts
nice -n 10 bun /tmp/fts-spike/migration.ts
```

## Options and their migrations

All options below use **shard format 3**. `message_fts_v3` is the physical FTS name; `message_fts` and `message_fts_v2` become read-only compatibility/protection views at the same atomic commit. These views preserve legacy column projections where possible; they do **not** promise that old `MATCH` SQL against a view will work. Mixed old/new application versions are not supported.

### (a) Persist the FTS integer identity on messages

```sql
ALTER TABLE messages ADD COLUMN ftsRowid INTEGER;
CREATE UNIQUE INDEX idx_messages_ftsRowid ON messages(ftsRowid);
-- One-time assignment can use hidden rowid as a number generator:
UPDATE messages SET ftsRowid=rowid+500000;
CREATE VIRTUAL TABLE message_fts_v3 USING fts5(
  accountId UNINDEXED,messageId UNINDEXED,
  subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview);
-- Bulk-populate rowid from the persisted ftsRowid, not from hidden rowid.
```

**Write:** fetch `ftsRowid` through the existing `(accountId,id)` B-tree, DELETE FTS WHERE rowid=?, and INSERT with that exact rowid. Keep the new column out of conflict-update assignments. For a new message, insert FTS with an allocated rowid and persist its returned integer on messages in the same transaction; do not infer it from the RFC Message-ID. Never expose an incomplete NULL identity outside the transaction. Scope deletes select these persisted IDs before messages disappear.

**Read:** contentful FTS retains account/local-message columns, so existing membership SQL stays unchanged apart from `SHARD_FTS_TABLE` naming. Message API hydration need not expose the internal integer.

**Migration:** add/backfill the column and unique index, recreate FTS with explicit rowids, validate one-to-one coverage, then install v3 protections. Idempotent reopen checks the column/index, physical FTS, both views, full guard set and version and does no rebuild. An inconsistent v2 index is reconstructed from messages once; an already complete v3 shard is not rebuilt on every open. The additive column, fill, index, FTS and version should all be in the migration transaction, unlike an unrelated pre-transaction best-effort additive ensure.

**v2/audit preservation:** keep the historical composite-key rebuild and all dependent columns/indexes/custom triggers. Adapt the three messages guards to the v3 marker along with every other existing guard; there are still 78 ordinary guards. Preserve `message_fts` and add the v2 read-only view. Do not let historical table-copy code omit `ftsRowid`, senderKey or sourceSha256. Account-key schema definitions and rebuild detectors need corresponding updates.

**Cost/risk:** measured deletion **6.41 ms**, upsert **0.508 ms**, FTS rebuild **453.12 ms**, plus whole-message backfill/index setup during migration. Live size **142.77 MiB** at 11k and about **3.80 GiB** at 300k; FTS rebuild projection **12.36 s**, excluding that backfill. The extra column is small on disk but couples an index-cache identity to the large, security-sensitive message row and its rebuilds. Identity allocation, NULL handling and preservation through every future table-copy are new invariants.

**Hidden messages.rowid variant:** measured **5.84 ms** for 200 deletes and **0.444 ms** per existing upsert. Its DDL can stay contentful and populate FTS using `SELECT rowid,... FROM messages`; reads may remain tuple-based. A v2-to-v3 migration would rebuild FTS with those rowids and retain all 78 adapted guards/both views. However, current composite-PK messages do not give that hidden rowid a persistent identity guarantee. [SQLite documents that unaliased rowids can change, including through VACUUM](https://www.sqlite.org/rowidtable.html). A table-copy can change them too. Treating the hidden value as durable would require rebuilding FTS for every such operation. The stronger alternative, an explicit `INTEGER PRIMARY KEY` plus `UNIQUE(accountId,id)`, requires a full messages/foreign-key migration and changes the existing account-key detector. Reject hidden rowid as the small safe production step. Its rebuild projection is **12.07 s** and live-size projection **3.80 GiB**, but those numbers do not remove the identity risk.

### (b) External-content FTS5, content=messages

```sql
-- First add/backfill a persistent unique messages.ftsRowid as in (a).
CREATE VIRTUAL TABLE message_fts_v3 USING fts5(
  accountId UNINDEXED,id UNINDEXED,
  subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview,
  content='messages',content_rowid='ftsRowid');
INSERT INTO message_fts_v3(message_fts_v3) VALUES('rebuild');
```

Use **`id`**, not `messageId`, as the external local-ID column. `content=messages` retrieves columns by their declared names; naming this `messageId` would retrieve the RFC header instead of the API/storage ID. A compatibility view can project `id AS messageId` under both old names. A content view that aliases the local ID is another design, but would no longer be the direct `content=messages` option requested here.

**Write, measured explicit form:** before changing/deleting a message, read its old indexed values and integer identity; issue the FTS special `delete` insertion with that old rowid/text. Then execute the message UPSERT and insert the new FTS row. Each indexed column uses the same NULL/empty normalization as population. FTS deletion cannot occur after the old content has been lost. Flag/sender/provenance-only updates should skip index maintenance when indexed fields did not change.

```sql
INSERT INTO message_fts_v3
 (message_fts_v3,rowid,accountId,id,subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview)
VALUES('delete',?,?,?,?,?,?,?,?,?,?); -- OLD values
-- message INSERT ... ON CONFLICT ... DO UPDATE
INSERT INTO message_fts_v3
 (rowid,accountId,id,subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview)
VALUES(?,?,?,?,?,?,?,?,?,?);          -- NEW values
```

An alternative is AFTER INSERT/DELETE/UPDATE maintenance triggers on **messages**, with old/new values and the same FTS statements. Restrict UPDATE to indexed columns/identity and use a WHEN clause to avoid unchanged values. These are additional maintenance triggers, not replacements for the three security guards on messages. Avoid depending on trigger creation order. Allocate a stable integer before the AFTER INSERT trigger needs it. This trigger variant was **not separately timed**; the table reports explicit statements.

**Read:** change FTS tuple projection to `SELECT accountId,id`, or join/match through persistent `ftsRowid`; keep account and all existing fallback/filter/sort semantics. No stored copy of body remains inside FTS. Related mail is unchanged.

**Migration:** backfill persistent IDs, bulk-rebuild external index from messages, then atomically swap the physical table/views and v3 guards. Normal reopen checks shape/version and does no rebuild. Repair must use canonical content and validate with external-content FTS `integrity-check` including content comparison (`rank=1`), rather than relying on COUNT(*) against the virtual table.

**v2/audit preservation:** retain historical v2 account-key conversion before the external-index stage, preserving sender/provenance columns. Replace all 78 guards with equivalent v3-marker guards; do not make FTS maintenance triggers a substitute. Keep read-only legacy/v2 views with local-ID aliasing. Update historical schema creation so it cannot recreate a contentful v2 table during future opens or rebuilds.

**Cost/risk:** deletion **9.26 ms**, upsert **0.279 ms**, full external-index rebuild **314.50 ms**. Live size **99.68 MiB**, about **2.65 GiB** at 300k; index rebuild projection **8.58 s**, excluding persistent-ID backfill. This saves about **42.95 MiB** of live allocation versus current at 11k. Common-token search was **35.37 ms**, slightly slower than current in this fixture. It solves storage duplication but broadens write/read/migration scope. Missing/wrong old values, indexed-field writes outside the maintenance path, hidden-rowid use, or a misnamed local-ID column can corrupt semantics. Review S3 backfills carefully if triggers are introduced.

### (c) Contentless FTS5, content=''

```sql
-- Persist unique messages.ftsRowid as in (a); do not rely on hidden rowid.
CREATE VIRTUAL TABLE message_fts_v3 USING fts5(
  accountId UNINDEXED,messageId UNINDEXED,
  subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview,content='');
INSERT INTO message_fts_v3
 (rowid,accountId,messageId,subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview)
SELECT ftsRowid,accountId,id,subject,fromAddr,toAddr,
       COALESCE(ccAddr,''),COALESCE(bccAddr,''),body,preview FROM messages;
```

**Write:** the measured plain-contentless form uses the special `delete` insertion with the exact old indexed values before changing messages, then inserts new values with explicit rowid. Plain DELETE/UPDATE is unavailable; new inserts must supply rowid. **Read:** user columns, including these two UNINDEXED keys, return NULL. Change membership to `m.ftsRowid IN (SELECT rowid FROM message_fts_v3 WHERE ... MATCH ?)`, retain outer account isolation, and hydrate text from messages. **Rebuild:** drop/recreate and populate from messages; there is no contentless `rebuild` command. These distinctions and the external-content delete pattern are documented in [SQLite FTS5](https://www.sqlite.org/fts5.html#external_content_and_contentless_tables).

**Migration:** populate persistent IDs, rebuild the index once under the version transaction, install v3 guards/views, and ensure complete v3 opens are read-only/idempotent. The old-name views can reconstruct their former columns by joining FTS rowid to messages. Exposing direct NULL projections is also sufficient to reject writes, but is a weaker read-compatibility choice that owners should explicitly decide. Neither view supports old application MATCH SQL reliably.

**v2/audit preservation:** run the historical v2 key conversion without changing its account ownership guarantees; retain every messages/S3 column. Replace all 78 security guards with v3 equivalents; any index-maintenance triggers are additional. Preserve both read-only old names even though contentless has no stored key columns. No claim that physical v3 FTS DML is guarded.

**Cost/risk:** deletion **7.23 ms**, upsert **0.277 ms**, full repopulation **320.17 ms**; live size **99.68 MiB**, about **2.65 GiB** at 300k; rebuild projection **8.73 s**, excluding ID backfill. Common-token search measured **3.81 ms** with integer-membership SQL, while selective-token search remained **15.32 ms**. That is a simultaneous read-query change, not evidence that contentless storage alone causes the saving. A contentful rowid-membership query could be studied separately.

Risks are the broad read contract change, old-value deletion requirements, and loss of FTS-stored text/normal snippet access. SQLite also offers `contentless_delete=1` (available since 3.43), which supports ordinary DELETE and has different update/delete-command rules. It would need a separate measured/version-compatibility proposal; it is not the plain `content=''` case measured here.

### (d) Contentful FTS with a side identity table — recommended

```sql
CREATE TABLE message_fts_identity (
  ftsRowid INTEGER PRIMARY KEY AUTOINCREMENT,
  accountId TEXT NOT NULL,
  messageId TEXT NOT NULL,                 -- local messages.id
  UNIQUE(accountId,messageId),
  FOREIGN KEY(accountId,messageId)
    REFERENCES messages(accountId,id) ON DELETE CASCADE
);
CREATE VIRTUAL TABLE message_fts_v3 USING fts5(
  accountId UNINDEXED,messageId UNINDEXED,
  subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview);
```

The integer primary key aliases the side table's rowid, so it is stable through VACUUM. AUTOINCREMENT avoids recycling an old identity; it is not an account-security boundary and gaps are harmless. The composite UNIQUE key enforces one FTS identity per account/local ID, including shared-shard duplicates. The composite FK protects mapping ownership. The FTS table itself still requires explicit maintenance.

**Write:** inside the existing immediate transaction, look up the mapping by `(accountId,finalRowId)`. If present, delete FTS by rowid; update messages and insert FTS using the same integer. If absent, insert/update messages first, create the mapping with `INSERT ... RETURNING ftsRowid`, then insert FTS. Do not derive it from the RFC Message-ID or collision base ID. Keep prepared statements outside per-row loops. The timed prototype performs an extra `INSERT ... ON CONFLICT DO NOTHING` mapping statement on existing upserts; lookup-first production code may avoid that statement, but no additional saving is claimed.

```sql
DELETE FROM message_fts_v3 WHERE rowid=(
  SELECT ftsRowid FROM message_fts_identity WHERE accountId=? AND messageId=?
);
-- messages UPSERT and missing mapping allocation, as needed
INSERT INTO message_fts_v3
 (rowid,accountId,messageId,subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview)
VALUES(?,?,?,?,?,?,?,?,?,?);
```

For batch/folder/account removal, select mapping integers through the scoped messages query and use `DELETE ... WHERE rowid IN (SELECT ...)`. Delete FTS **before** messages, then let composite FK cascade delete mappings; explicit mapping removal can be used consistently if needed. A mapping cascade alone cannot delete FTS. Same-mailbox duplicate purge, replaceExisting, folder-prefix removal, message batches, and shared-account cleanup must all obey this order. A new mapping uses the final collision-resolved ID. There must never be a key-scan fallback hidden in a missing-mapping branch: treat an unexpected missing mapping on an existing indexed row as a repair/error condition.

**Read:** leave `query.ts` membership, all substring/attachment paths, related mail, ranking/order and pagination unchanged. Only the imported physical-table constant changes. No FTS rowid is exposed as an API ID.

**v2/audit preservation:** no `messages` schema/table copy. Preserve the historical key migration, 78 equivalent guards and the original read-only view; add three guards for `message_fts_identity` (**81 total**) and a read-only `message_fts_v2` view. Swap all guarded-table marker checks to v3 atomically, including tables unrelated to FTS. A stale v2 handle must fail even if it already registered `noctua_writer_v2()`.

**Cost/risk:** deletion **6.46 ms**, existing SQL upsert **0.531 ms**, full index+map rebuild **480.77 ms**. Live size **142.96 MiB**, about **3.81 GiB** at 300k; index+map rebuild projection **13.11 s**. Mapping pages including its UNIQUE index occupy approximately **0.33 MiB**. This does not remove body duplication. Its main new invariant is keeping three rows—message, mapping, FTS—in agreement under one transaction; shared helpers and comprehensive deletion-path coverage are therefore required.

## Atomic migration and owner-review contract

For the recommendation, implement this sequence as a reviewed extension of the existing migration, not an unrelated background reindex:

1. **Before any configuration/write:** refuse `user_version > 3`. Register `noctua_writer_v3() => 3`. During a v2 upgrade, also register the old marker returning 2 so the historical guards continue to protect intermediate writes. Do not return 3 from a marker while old guards still require 2.
2. Probe version **and shape**. A complete v3 shard must have the physical FTS, side table/constraints, two views and every expected guard. Its normal-open path must not acquire a writer lock or read every message. Never blindly rebuild on each open; never stamp a version before completing validation.
3. Acquire **BEGIN IMMEDIATE**, then recheck, since another process may already have migrated. For a normal v2 shard, foreign_keys can remain ON: no parent table is replaced. Build the side table and new physical FTS while the old v2 FTS still exists.
4. Assign mapping integers from canonical `(accountId,id)` messages in a deterministic traversal and bulk-populate the new FTS by joining that mapping. Validate counts, bidirectional identity coverage, unique ownership, FTS integrity and foreign keys. Do not copy sender/provenance values into new meanings or derive them from files.
5. Drop the old `message_fts` view and physical v2 FTS, then create **both read-only views** over v3. Create new BEFORE INSERT/UPDATE/DELETE guards calling the v3 marker on all original 26 tables plus the side table, and retire the old guard definitions **within this same transaction**. Retain runtime wrong-version rejection, zero-row preparation failure and trigger enumeration. Using only `CREATE TRIGGER IF NOT EXISTS` would leave old bodies active and is insufficient.
6. Set **user_version=3 last**, then commit. Retain the existing write retry wrapper. Keep old clients stopped during rollout; on downgrade a new handle refuses version 3, and a pre-opened v2 handle hits the new guard or its now-read-only FTS name. An unregistered client deliberately writing the new physical FTS remains outside the existing guard guarantee.
7. If the transaction fails or the process dies before commit, SQLite must expose the complete old v2 state after recovery. Retry then migrates once. A v3 shard with a missing/repaired index requires a separately identified, atomic repair path (or explicit failure), not silent acceptance based solely on user_version.

For **v0/v1/new shards**, retain the audited composite-key table conversion and its foreign-key OFF/restore procedure. Refactor its transaction body so the historical v2 key/FTS step and the v3 identity step compose under **one outer immediate transaction** with the final foreign-key check. Do not invoke nested immediate transactions or advance a shared `SHARD_FORMAT_VERSION` constant in a way that skips the historical FTS shape. An intermediate version 2 may be set internally but must not be committed as a half-finished v3 upgrade. Existing additive S3 columns/custom indexes/triggers survive. Fresh initialization may construct v3 directly only once the same invariants and protection tests pass.

**Owner review explicitly covers:** `shardFormat.ts` version/constants/marker lifecycle and guard discovery; `accountKeys.ts` historical migration composition; `schema.ts` fresh/additive initialization order and cold-open fast path; all writable openers including cleanup/worker handles; stale v2 and legacy behavior; rollout/retry and no in-place downgrade. Sync owners also review duplicate/collision/replaceExisting and all deletion paths. Auth/sender owners review preservation of NULL/known senderKey/sourceSha256 and absence of eager backfill. Nothing here changes master/auth DB pragmas, authorization SQL, source staging or permissions.

### Measured migration, space and recovery

The scratch recommendation prototype runs on the 11k v2 fixture. Three committed migrations: **837.48, 917.72, 837.68 ms**; median **837.68 ms**. Its post-migration shape-only reentry: **0.773, 0.480, 0.469 ms**. Those fast checks demonstrate idempotence but are not the full production opener or complete production guard-shape verification.

Building the new index alongside the old one leaves the main DB at **204,746,752 bytes (195.26 MiB)**, with reusable free pages after the swap. Captured WAL is **55,644,752 bytes (53.07 MiB)**. Main+WAL is therefore at least **248.33 MiB** during/after this migration, versus a **144.31 MiB** starting main file. It does not shrink automatically to the **142.96 MiB live allocation**. Budget temporary disk space and lock duration; do not add a startup VACUUM. On-disk NORMAL-mode migration commit is distinct from power-loss durability; the performed kill tests model process death, not kernel/power loss.

Straight-line 300k extrapolation (factor **27.27**, same synthetic payload): recommendation migration **22.85 s**, with roughly **5.20 GiB main + 1.41 GiB WAL = 6.61 GiB** at that measured snapshot. This is a planning estimate, **not a 300k measurement or safe capacity bound**. SQLite segment merges, larger keys/text, cache pressure, disk storage rather than tmpfs, checkpoint readers and other writers may change both time and peak space. Reserve additional headroom and measure a larger shard before rollout. The per-option rebuild projections in the comparison exclude ID backfill/guards/validation/commit; only (d) has a separately measured full version migration here. For stored-ID/external/contentless migrations, a full messages backfill may amplify WAL beyond the index-only estimates. An attempted follow-up series for their complete version migrations was blocked by the shared `/tmp` user quota before producing results; there are no measured full-migration totals for those alternatives. Their measured rebuild times and projected sizes are reported separately, with this backfill/validation/commit limitation explicit. No unrelated scratch data was removed to free space.

The current key scan for the same 200 existing deletes would extrapolate to approximately **53.06 s** at 300k if linear scanning held. Indexed options should scale with 200 lookups plus B-tree depth/FTS posting work, rather than 200 whole-shard key scans; do not multiply their measured deletion time by 27.27 or promise it remains exactly 6 ms.

## Validation performed and implementation acceptance plan

**Performed in scratch:** ten full ordered-result differential queries per option: selective/common prefixes, subject/body/sender column scopes, phrase, NEAR, OR, NOT and no-match. All produce the same `(accountId,id)` sequence as the baseline with the same explicit date/account/ID order. The fixture has unique dates, so this checks actual deterministic order without inventing production tie behavior. Every option also checks an updated row appears exactly once under the new token and passes SQLite/FTS internal integrity checks. Stored-ID deletion additionally asserts the common-token count changes 11,000 → 10,800 before rollback. This is SQL-level validation, not the complete application search suite.

The side-table migration preserves a streaming SHA-256 snapshot of **every messages column**, checks selective FTS results before/after, rejects all **81/81** unregistered ordinary-table mutations at prepare, rejects **6/6** DML operations over the two old FTS views, rejects pre-prepared stale-v2 message and FTS statements when stepped, and rejects a registered marker returning 2 instead of 3. It retains 81 guards. Four child-process SIGKILLs—after DDL creation, after population, after guard/view swap, and immediately before user_version—each recover to the identical v2 schema/message/FTS-rowid snapshot and then migrate successfully. Only the exact spawned child is killed. Crash before/after commit, shared-account identity collisions, the whole legacy 112-site corpus and production opener races remain implementation acceptance work.

Before merging an implementation:

1. **Differential application behavior:** on a synthetic shared shard, compare the public search/list/thread APIs before/after across fields, Unicode/accent/case, punctuation/quoted prefixes, AND/OR composition, empty/no-hit queries, preview, ID/thread/RFC substrings, attachment names, deleted/visible/badges/folder exclusions, page boundaries, totals/groups and existing tie ordering. Test related-mail output unchanged. A second account must share local IDs, RFC IDs, thread IDs and attachment IDs with the first.
2. **All mutation paths:** existing/new upsert; both mailbox collision directions; duplicate purge; same-copy resync; folder/account replaceExisting; single/batched/folder-prefix delete; account cleanup; draft replacement; rollback between message/map/FTS statements; source-file failure/commit failure; repeated updates and reuse after deletion. Assert exact message↔map↔FTS bijection after each commit and no cross-account deletion. Exercise optional FK OFF on unregistered connections for guard tests; do not depend on FKs for legacy rejection.
3. **Migration:** real v2 shape and pre-v2 shapes, empty shard, shared shard, existing senderKey/sourceSha256 before/after the historical key rebuild, custom trigger/index retention, repeated reopen with unchanged schema_version, duplicate/orphan/missing historical FTS rows, future-version refusal before any side effect, two simultaneous openers, a reader holding a snapshot and lock/retry exhaustion. Validate all expected guards/constraints/views, not merely names or version.
4. **Crash/error injection:** SIGKILL at all four performed points plus during population, after version assignment/before commit and after commit; injected DDL/DML/validation/commit/I/O failures. Compare full protected-table snapshots and version after recovery; restart must converge once. Verify prior foreign-key setting is restored. Add storage-failure and larger-WAL recovery cases; do not infer power-loss behavior from SIGKILL.
5. **Audit matrix:** replay the 112 historical DML sites and current v2 DML corpus, wrong/missing markers, pre-migration prepared statements, zero-row/empty-table operations, UPSERT/REPLACE/IGNORE variants, both legacy FTS names, reopened/evicted/cleanup/worker handles, and the future-version opener inventory. All original 78 guard combinations must remain covered; add the side table's three.
6. **S3 security:** run existing sender-key/provenance and collision-inline-image suites. No new raw-source reads during migration. Unknown senderKey remains unknown without exact owned digest-matched source; sender-only backfill must not rewrite FTS. Re-synced variants keep their own source ownership.
7. **Performance acceptance:** repeat the 11k experiments against the implemented production path with guards enabled; require no whole-FTS key scan in any single-row delete plan and comparable differential results. Add sustained repeated updates/segment merges, WAL/checkpoint and 300k realistic-text measurements before setting startup-time or space budgets. Run appropriate repo checks (`bun test lib/db`, shared-shard, sender/collision/search suites, `bun check`; full CI checks for the resulting patch). None were run as a substitute for this read-only spike.

## Exact proposed file list for (d)

Production changes:

* **`lib/db/shardFormat.ts`** — format 3, physical FTS constant, v3 marker and guard revision, two protected legacy views, complete-shape fast-path detection. **Sync/auth owners.**
* **`lib/db/accountKeys.ts`** — preserve historical v2 conversion and compose the new version transaction without nested transactions or losing S3 columns/custom objects. **Sync/auth owners.**
* **`lib/db/schema.ts`** — fresh/additive initialization integrates the identity ensure and avoids recreating old physical FTS tables. No new messages column for (d). **Sync/auth owners.**
* **`lib/db/ftsIdentity.ts` (new)** — shared canonical map/index DDL, population/validation and prepared single/scoped delete/insert helpers; migration body accepts the owner's transaction. Avoid duplicated FTS column/normalization lists. **Migration portions reviewed by sync/auth owners.**
* **`lib/db/messages/upsert.ts`** — final-row-ID mapping allocation and rowid maintenance, duplicate/scoped replacement paths; retain file staging, snapshots, retries, calendar state and collaboration handling. **Sync owners.**
* **`lib/db/messages/delete.ts`** — single/batch/folder-prefix FTS deletes through mapped integer IDs before messages/cascades. **Sync owners.**

Tests:

* **`lib/db/ftsIdentity.test.ts` (new)** — identity lifecycle, deletion scope, differential search and corruption detection.
* **`lib/db/accountKeys.test.ts`** — v2→v3 and pre-v2 composition, idempotence, rollback/crash, custom objects and sender-provenance preservation; update literal physical-name/version assertions.
* **`lib/db/shardFormat.test.ts`** — original 78 plus three new guards, old/v2 FTS views, stale v2 handles, wrong/future versions and opener coverage.
* **`lib/db.sharedShard.test.ts`** — cross-account same-ID mapping/search/deletion and collision handling.
* **`lib/db.senderKey.test.ts`** — update explicit v2 expectations for the new format and prove unchanged provenance-gated backfill.

`lib/db/messages/query.ts`, `retrieval.ts`, `senderKey.ts`, `connection.ts`, auth/sync application logic, storage/parser and UI need no production behavior edits for this recommendation. Existing `configureAccountDb` already calls the version-preparation hook; review its coverage without changing pragmas/retries. Existing watcher verification imports `SHARD_FTS_TABLE`, so it follows the rename automatically. `membershipCleanup.ts` opens a separately configured shard handle for collaboration unassignment; it does not delete messages or FTS. Keep its marker-registration regression coverage. Account lifecycle cleanup removes an unshared shard file, and retains a shared shard; this proposal does not alter that behavior. If implementation discovers another production writer, expand this list and get the same owner review instead of adding an untracked key-scan fallback.

## Final summary

Recommend **contentful FTS plus an indexed side table**, with a reviewed atomic **shard v3** migration. Measured 200 deletes: **1,945.54 → 6.46 ms**; existing SQL upsert: **10.817 → 0.531 ms**; full index+map rebuild: **480.77 ms**; committed v2→v3 migration: **837.68 ms** on 11k synthetic messages. The mapping costs about **0.33 MiB** and keeps search behavior and messages/S3 provenance unchanged. Preserve all original guards, add three for the map, and protect both old FTS names with read-only views. All tested ordered SQL search results match; four migration crash points recover cleanly. Sync/auth owners must review the shard format and audited writer boundary before implementation. No repository implementation was made.
