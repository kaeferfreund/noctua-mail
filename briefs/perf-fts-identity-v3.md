# FTS identity v3 implementation handoff

2026-10-23 UTC. Implementation checkout: `/home/monkey/code/noctua-mail/wt-fts-v3`, branch `perf/fts-identity-v3`, base `9424150f5aa0a446ed9bc03ed199e6825129467d` (round-7 team-inbox). Implemented the owners’ approved option (d) from `perf-fts-identity-spike.md`. The audit contract is `audit-s1s2-verify.md` and the corrected conclusions in `perf-writer-guards.md`.

## Summary

- Contentful FTS5 now uses `message_fts_v3` and a composite-owned `message_fts_identity` integer rowid map. Single/scoped deletions use integer membership before message deletion; existing upserts retain their integer identity.
- The atomic v3 migration retains both writer markers during upgrade, replaces the original 78 guards and adds three map guards (81 total), and exposes both old FTS names as read-only views. Damaged v3 shapes fail explicitly.
- All 112 legacy DML sites reject; 81 guard combinations and both views reject unauthorized writes. Required crash points recover the complete v2 state, and retry converges once. Stale v2 handles fail.
- Synthetic 11k median: 200 FTS deletes **5,504.571 → 5.852 ms**; existing SQL upsert **29.187 → 0.231 ms**; v3 full validated rebuild **960.846 ms**. Committed migration median **1,041.766 ms**. Ordered differential results match `9424150`.
- Gates: typecheck **0 errors / 1,178 files**; CI **2,778 unit + 433 DOM**; stress **8,334**; build, graceful shutdown and headless privacy pass. Lint remains the supplied baseline **1 error + 25 warnings**. Three logical commits, clean tree; merge notes and the explicit owner checklist are below.

## Design as built

`message_fts_identity` has `ftsRowid INTEGER PRIMARY KEY AUTOINCREMENT`, non-null `accountId` and `messageId`, `UNIQUE(accountId,messageId)`, and the composite `FOREIGN KEY(accountId,messageId) REFERENCES messages(accountId,id) ON DELETE CASCADE`. Its key refers to the final local storage ID, including mailbox collision variants, rather than the RFC Message-ID. Every FTS insert supplies that integer as its explicit rowid. AUTOINCREMENT preserves identity across ordinary updates and avoids reuse after deletion; VACUUM stability is tested.

`ftsIdentity.ts` centralizes the new DDL, FTS column list, canonical bulk population, validation, orphan counting, prepared lookup/allocation/insertion and single-delete SQL. `SHARD_FTS_TABLE` remains exported from `shardFormat.ts`; its definition is re-exported from the helper to avoid a module-initialization cycle between schema probing and the DDL helper.

Upsert looks up the final `(accountId,rowId)` mapping, deletes FTS by mapped rowid, upserts the message, allocates a missing mapping with `INSERT ... RETURNING`, and inserts FTS with the explicit integer, within the existing immediate transaction. Prepared statements remain outside the row loop. A surviving message without a mapping raises an explicit repair error. `replaceExisting` snapshots may describe rows already deleted by the enclosing scope replacement; those rows correctly receive new mappings. This distinction preserves source/identity metadata without a key-scan fallback.

Single deletes use `rowid=(SELECT ftsRowid FROM message_fts_identity WHERE accountId=? AND messageId=?)`. Account, folder, batch and folder-prefix deletes use `rowid IN (SELECT ...)` through scoped mapping/message queries. Same-copy duplicate purge uses the shared single-delete statement. FTS is deleted before messages, then the composite FK removes mappings. Existing file staging, attachment/calendar work, collaboration remapping and retry handling remain in place.

The measured single-delete plan is `SCAN message_fts_v3 VIRTUAL TABLE INDEX 0:=`, with a scalar subquery using the covering composite UNIQUE index on the identity table. The virtual-table rowid equality is an integer lookup, not the old whole-index key scan.

## Atomic migration and cold open

1. `prepareAccountShardConnection`, still invoked by `configureAccountDb`, refuses versions above 3 before configuration or marker registration. Schema initialization separately checks complete v3 shape; the preparation hook registers `noctua_writer_v2() => 2` and `noctua_writer_v3() => 3` on supported handles.
2. Shape checks inspect schema metadata: exact normalized map/FTS DDL, the five physical FTS shadow objects, both view definitions, the audited ordinary tables, and every discovered account-scoped table’s three exact v3 guard definitions. Old v2 guards cannot satisfy this probe. The account-key check also validates the audited composite keys/FKs. No full message traversal, integrity write or writer lock occurs on a healthy cold open. A separate connection holding `BEGIN IMMEDIATE` does not prevent full initialization of a healthy v3 shard.
3. Initialization of pre-v3 shards owns one outer immediate transaction, including additive schema work. Pre-v2 initialization retains foreign-key OFF before the transaction and restoration afterward. Normal v2 upgrades leave foreign keys ON. The historical composite-key/FTS conversion remains intact inside the same outer transaction; direct `ensureAccountKeySchema` callers retain their own transaction/FK procedure. The key migration body accepts the caller’s transaction instead of nesting immediate transactions.
4. The migration rechecks under the writer lock. It counts old FTS orphans, creates the side table and the new physical FTS while historical FTS exists, assigns integers by binary `(accountId,id)` order, and bulk-populates from canonical messages. Old FTS rowids are deliberately unrelated to message rowids in fixtures.
5. Validation checks all three counts, message↔mapping↔FTS coverage in both directions, exact account/local-ID ownership, unique ownership, FTS integrity, and foreign keys. Historical duplicate/missing FTS entries are reconstructed from messages. No messages table is copied or updated during an ordinary v2→v3 migration.
6. It drops the old view/physical FTS, creates **both** `message_fts` and `message_fts_v2` as `SELECT rowid,* FROM message_fts_v3`, drops/replaces old guard definitions, and installs all 81 v3 guards. `user_version=3` is the final write, followed by a read-only schema verification and commit. There is no intermediate committed v2 state.
7. Runtime schema readiness caches are marked only after the outer initialization commits. Their additive installers can run inside the caller’s transaction, preventing nested immediate transactions or false readiness after rollback.

The selected v3 repair policy is **explicit failure**: an incomplete physical index/map, missing view/table/guard or weakened guard body produces `explicit atomic repair required` before additive initialization can recreate an empty old index. There is no automatic repair CLI or in-place downgrade. A future repair must rebuild map and index together under an explicitly owned atomic transaction. Cold-open probing is a schema check, not a full data-corruption audit; `validateFtsIdentity` provides the full traversal used during migration/maintenance.

## Audit semantics statement (owner condition c)

Composite keys and authorization/account predicates are unchanged. The original guard discovery still covers all account-scoped ordinary tables and retains missing-function preparation rejection, including zero-row operations, plus runtime wrong-version rejection. It now installs 78 equivalent v3 guards and the three additional identity guards. The historical marker returns 2 throughout upgrade; it is never changed to return 3. Writer-marker registration remains in the existing `configureAccountDb` hook; `connection.ts` and its pragmas/retries are unchanged. Separately configured cleanup handles preserve the existing absent/partial collaboration-schema behavior; they retain version refusal and marker registration without invoking full schema initialization.

Acceptance is the actual opener contract, not “readonly/cold opens do not register writer markers.” `initAccountSchema` calls `prepareAccountShardConnection` unconditionally at `lib/db/schema.ts:977`: a healthy supported v3 `{ readonly: true }` cold handle gains both connection-local markers (2 and 3). Healthy cold initialization takes no writer lock, traverses no full message data, runs no FTS integrity command and does not migrate/rebuild; it does check schema. Registration does not change SQLite's readonly file-open mode, so actual DML still fails with `attempt to write a readonly database`. Pre-v3/incomplete schemas may require writes or explicit refusal; initialization is not a general readonly repair API. Raw unconfigured inventory/SQLite readers remain unregistered; application read requests use configured write-capable handles because runtime/provenance backfills can write. Future versions are refused before registration.

Evidence: `lib/db/ftsIdentity.test.ts`, **“cold open checks schema without a writer lock, even with a concurrent writer”**, checks lock freedom and unchanged `schema_version` on a write-capable handle. `lib/db/shardFormat.test.ts` covers future-version refusal before markers and the opener inventory. Neither requested test file explicitly proves readonly DML failure. Review r1 independently observed it; the missing automated probe would open a healthy disposable v3 shard readonly, confirm markers absent, initialize it, confirm marker results 2/3, attempt DELETE on an existing composite-owned message, require the readonly error and compare unchanged rows/schema/version. No test or code is added for this documentation correction.

The original FTS name remains read-only, and the v2 physical name becomes a second read-only view. SQLite cannot install these row guards on FTS virtual/shadow tables. Deliberate DML against the new physical `message_fts_v3` from an unregistered SQL client remains outside the audited legacy-binary guarantee. This implementation makes no broader arbitrary-SQL protection claim.

`messages` columns, `senderKey`/`sourceSha256` NULL/known values and raw-source ownership semantics are preserved. The migration reads no raw source files and performs no sender backfill. The master `users.uiLocale` addition is retained. `query.ts`, `retrieval.ts`, `senderKey.ts`, `connection.ts`, auth/sync/UI/parser code and `bun.lock` are byte-unchanged from the base.

## Orphan inventory and handling (owner condition b)

Before starting the upgraded preview, run:

```sh
nice -n 10 bun scripts/checkShardMessageCollisions.ts /absolute/synthetic-or-stopped-shard.db
```

The existing CLI still opens each deduplicated path with `{ readonly: true }`, without importing/configuring the connection layer or initializing schema. It now reports `shardVersion` and `ftsOrphanCount` alongside the existing collision inventory. On v2, an orphan is an FTS row lacking a message with the same `(accountId,id)`; an identical ID in another account does not rescue it. The helper also supports older unscoped historical FTS shapes.

The migration counts every orphan row, discards it deterministically by rebuilding exclusively from canonical messages in binary key order, returns `{ migrated, droppedFtsOrphans }`, and logs `[shard-format-v3] dropped N orphan FTS rows` after successful commit when N is nonzero. No arbitrary orphan is promoted into a message or mapped to another account. Regression: two orphans, a duplicated historical entry, and a missing historical entry migrate to exactly two canonical mappings/FTS rows; return value is 2, both message rows remain byte-equivalent, and retry returns 0. A separate read-only CLI test reports one v2 orphan and leaves the full schema/data/version snapshot unchanged.

## Crash injection, concurrency and audit matrix (owner condition d)

The child-process test worker intercepts the actual production SQL; it kills only itself with SIGKILL. Disk/WAL fixtures compare the complete schema, version, and every table’s rows before recovery and after rollback. All required points pass:

- Immediately after side-table creation.
- After bulk FTS population.
- After the 81st new guard, with the views already swapped.
- Immediately before the version assignment.

Additional kills after version assignment/before commit also recover the complete v2 snapshot. A kill after commit leaves complete v3 and a subsequent opener reports no migration. Every rollback case retries successfully, then a second initialization leaves the snapshot unchanged.

Other passing regressions cover population exceptions/FK restoration, historical key-copy/guard/version failures, two simultaneous production openers (exactly one migrates), a writer-lock failure followed by retry, a reader retaining its v2 snapshot across commit, healthy cold-open lock freedom, damaged v3 shape refusal, repeated updates and delete/reuse, shared-account local-ID collisions, replacement, missing-map failure without mutation, identity-allocation rollback, and VACUUM identity stability. Existing shared-shard tests now validate the three-way bijection after single/batch/prefix/account/folder deletion/replacement.

The frozen **112-site corpus from 164a57e**, supplied by the audited writer-guard probe, is retained in `lib/testFixtures/legacyShardDml.json` and replayed in `shardFormat.test.ts`: **105 missing-v3-function preparation failures + 7 read-only-view failures; zero accepted sites, snapshots unchanged**. All **81/81** ordinary-table INSERT/UPDATE/DELETE combinations reject an unregistered or v2-only handle with FK enforcement OFF, including zero-row UPDATE/DELETE. Both old FTS names reject all **6/6** INSERT/UPDATE/DELETE operations. A registered v3 marker returning 2 rejects an actual row mutation. Previously prepared v2 message and physical-FTS statements fail after migration, without mutation.

The writable-opener inventory still passes: common get/with-account handles, evicted/reopened handles, separately configured membership cleanup, watcher/sync worker, recompute workers, scripts, and MCP/application callers consume the common configured API. The collision CLI remains read-only. No new alternate production writable opener was introduced.

S3 focused sender-key/retrieval/provenance/shared-shard tests pass. The headless `tests/browser/htmlPrivacy.test.ts` regression passes **1 test / 177 assertions**, using this worktree’s synthetic data and only ports **3897/3898**. Temporary port literals were restored afterward. Its app, tracker and browser were closed by test cleanup. The shared fixtures on 3790–3799 and reserved 3800 were left alone.

## Measurements

Bun **1.4.4**, SQLite **3.53.4**, Linux arm64; all heavy commands under `nice -n 10`. Shared-host 1/5/15 load at the timing series endpoints was **12.27/16.50/14.38 → 10.39/15.22/14.08**. These are local synthetic measurements, not production latency guarantees.

The shard contains **11,000 messages, 11,000 attachments and 11,000 retained source files** with matching SHA-256 provenance. Attachment payloads are 32 synthetic bytes each; migration reads their metadata, not attachment/source file contents. Two accounts share local IDs, RFC IDs, thread IDs and attachment IDs. Body is 3,900 characters (`Synthetic body alpha beta gamma delta. ` repeated 100 times), HTML carries the same body, and source files include synthetic headers/body. Half the initial sender keys are NULL. Message dates are distinct. Every 400th subject carries `needle`; subjects also contain café and quoted-phrase cases. All ordinary tables, indexes and guards use production initialization. Historical FTS rowids start at message rowid + 500,000. No ANALYZE or PRAGMA optimize was run.

Write samples use one warmup and then the stated repetitions, inside `BEGIN IMMEDIATE`/ROLLBACK to restore the same fixture. The 200-delete operation removes FTS only, including lookup cost. The narrow upsert uses the unchanged production 47-binding messages UPSERT and FTS maintenance; source staging, network, attachment/calendar/thread/collaboration work are outside the timing. The v3 rebuild includes the production builder’s full validation, both views and guard installation; the v2 rebuild recreates and bulk-populates the old FTS and restores its view, without the new validation/guard-swap work. Thus rebuild totals have deliberately different validation work and should not be presented as a pure storage-engine comparison.

| Workload | Samples | v2 median [min–max], ms | v3 median [min–max], ms |
| --- | ---: | ---: | ---: |
| 200 FTS deletes | 5 | 5,504.571 [5,436.648–5,509.575] | 5.852 [5.789–6.086] |
| Existing-message SQL upsert | 15 | 29.187 [28.543–29.946] | 0.231 [0.210–0.291] |
| Full FTS / validated index+map rebuild | 3 | 480.230 [472.881–481.940] | 960.846 [950.373–1,158.686] |

The fixture-specific delete/upsert ratios are approximately **941× / 126×**. They do not imply corresponding whole-sync or UI speedups. The larger shared fixture/attachments/sources and validation differ from the read-only spike, so its exact timings are not acceptance constants.

Differential: a temporary copy of the **exact `9424150` query implementation**, changing only the imported physical table constant to the v2 literal, ran before migration. The current unchanged query implementation ran afterward on the same shard. **134 application comparisons** (message/thread lists plus related mail, including identical errors for unsupported baseline inputs) and **10 fully ordered SQL FTS queries** match. Cases cover both accounts, selective/common/no-hit and empty searches, case/accents, phrase and multi-token input, field scopes, preview, RFC/local/thread substrings, attachment names, unread/visibility/folder exclusions, page boundaries, totals and groups. SQL cases include prefix, column scopes, phrase, NEAR, OR and NOT. The existing baseline error for the literal application input `alpha OR needle` was preserved; no parser change was made.

A streaming canonical snapshot of every messages column was identical across migration (SHA-256 `5880fedde4cc6ab607eedab24fee7579a7d865edf62d7697db41fdfc6057e58e`). FTS integrity, composite ownership and foreign-key checks pass. Temporary baseline modules and all `/tmp/fts-v3` scratch are removed at handoff; no synthetic source/database fixture is committed.

## Deploy handoff (owner condition a)

The same operator runbook is committed as `doc/FTS-V3-MIGRATION.md` and linked from `doc/DEPLOYMENT.md`. Code remains pinned at `c819806`; this handoff revision is documentation-only.

Operator procedure for the one-way account-shard upgrade implemented at `c819806`.
Run commands from the deployed checkout, with its existing private environment and working
directory. This procedure changes persisted shard format; complete the stopped backup and
inventory before starting the merged binary. Keep public traffic and automatic jobs paused
until verification succeeds. Do not mix v2 and v3 binaries against the same data.

### 1. Stop all database clients

Stop admission at the proxy and disable service/container restart policies and scheduled jobs
for the maintenance window. Stop every app instance, mailbox watcher, sync worker
(`runSyncJob`), thread/category/topic and other recompute worker, MCP process, and maintenance,
calendar, backfill or ad hoc script that can open this datastore. Close interactive SQLite
sessions too. Use the graceful shutdown procedure in `DEPLOYMENT.md`; wait for the parent
and every owned child to exit. Confirm no process still has the master, shards or sidecars
open (for example, inspect `lsof` for each inventoried path). A stopped HTTP listener alone
does not prove workers or MCP have stopped. Keep these clients stopped through steps 2–3.

### 2. Create and verify a complete stopped backup

Record the old deployed binary/image revision, launch directory, service configuration and
account-to-shard mappings. Retain that exact binary with the backup for rollback. Resolve the
real runtime layout from `lib/runtimePaths.ts` and `lib/db/connection.ts`:

- `NOCTUA_DATA_DIR` selects the data root, resolved against the process working directory.
  When unset, the default is `../noctua-data` relative to that directory; it is not necessarily
  the checkout's `.data`. Set the intended absolute root explicitly for this procedure.
- The master is `$NOCTUA_DATA_DIR/db/main.db`, including Better Auth and account mappings.
- `accounts.dbPath` overrides the default shard path. A NULL/blank mapping falls back to
  `$NOCTUA_DATA_DIR/db/accounts/<encodeURIComponent(accountId)>.db`. Nonblank relative paths
  resolve against the application's working directory. Several accounts may share a file;
  mapped shards may be outside the data root. Copy each physical file once, preserving all
  logical mappings and any symlink targets needed for restore.
- Include each database's remaining `-wal` and `-shm` files, including those beside external
  shards. Do not delete sidecars or force a checkpoint to make the backup look smaller.
- Include the entire `sources/` and `attachments/` trees. Current paths are
  `sources/<encodedAccountId>/<encodedFinalMessageId>.eml` and
  `attachments/<encodedAccountId>/<encodedFinalMessageId>/<encodedAttachmentId>.bin`.
  Retain legacy flat files, `.pending-*` staging/backup files (including `.previous`), and
  any operator-retained or held-back files/directories, even outside the root. Inventory their
  actual paths explicitly; there is no separate held-back-files environment variable.
  Treat these files as part of this full restore snapshot even where general cache guidance
  describes them as regenerable. Do not clean them up during this migration.
- Privately preserve the matching `IMAP_SECRET_KEY` and `BETTER_AUTH_SECRET` and their
  root-readable environment/secret-store configuration. Also retain `NOCTUA_DATA_DIR`,
  `IMAP_CREDENTIALS_STORAGE` (normally `db`), `BETTER_AUTH_URL`, `PASSKEY_RP_ID`, launch/service
  settings and any other configured auth/encryption material. Do not print secret values or
  generate replacement keys. Missing/mismatched keys can make mailbox credentials and
  encrypted auth factors unusable.

Create a private backup destination on a filesystem with enough space, outside every source
tree. The following raw readonly inventory does not import the connection layer or initialize
schema. Use the old application's working directory so relative mappings resolve correctly:

```sh
export NOCTUA_DATA_DIR=/absolute/path/to/deployed-data
export FTS_BACKUP=/absolute/path/to/new-private-fts-v3-backup
umask 077
mkdir -p "$FTS_BACKUP/root"
bun --eval '
import { Database } from "bun:sqlite";
import { realpathSync } from "node:fs";
import path from "node:path";
import { getDataDir, getMainDbPath, getDefaultAccountDbPath } from "./lib/runtimePaths.ts";
const db = new Database(getMainDbPath(), { readonly: true });
try {
  const accounts = db.query("SELECT id, dbPath FROM accounts ORDER BY id").all().map(row => {
    const logicalPath = row.dbPath?.trim() ? row.dbPath : getDefaultAccountDbPath(row.id);
    return { ...row, logicalPath: path.resolve(logicalPath), shardPath: realpathSync(logicalPath) };
  });
  console.log(JSON.stringify({ dataDir: getDataDir(), masterPath: realpathSync(getMainDbPath()),
    accounts, shardPaths: [...new Set(accounts.map(row => row.shardPath))] }, null, 2));
} finally { db.close(); }
' > "$FTS_BACKUP/inventory.json"
```

The command must succeed. Investigate missing files/mappings before proceeding; do not open
them with a creating/writing application handle to obtain an inventory. Record any legitimate
never-initialized account separately and reconcile it against the master. Add unmapped shards
or retained data still required for full restore to the inventory. `realpathSync` deduplicates
shared files but does not establish whether a shard was shared historically.

Copy the complete root, then the master and every actual mapped shard and existing sidecar.
GNU `cp --parents` below preserves absolute path layout beneath `root/` for restoration:

```sh
cp -a --parents -- "$NOCTUA_DATA_DIR" "$FTS_BACKUP/root/"
mapfile -d '' FTS_DATABASES < <(bun --eval '
const i = await Bun.file(process.argv[1]).json();
for (const p of new Set([i.masterPath, ...i.shardPaths])) process.stdout.write(p + "\0");
' "$FTS_BACKUP/inventory.json")
for database in "${FTS_DATABASES[@]}"; do
  for file in "$database" "$database-wal" "$database-shm"; do
    if [ -e "$file" ]; then cp -a --parents -- "$file" "$FTS_BACKUP/root/"; fi
  done
done
```

Copy private configuration, extra retained/held-back paths and external symlink targets with
the same path-preserving procedure. Record a source→backup path manifest for everything
copied, including sidecars and configuration; protect it like the backup. Preserve ownership,
permissions and symlinks. For mounted/symlinked trees, verify the actual contents were copied,
not just a link to the original disk.

Before any upgraded open, verify the backup:

1. For the root and each extra external tree, compare sorted relative filename/byte-size
   manifests on source and copy; file counts and total bytes must match. For example, run
   `find "$NOCTUA_DATA_DIR" -type f -printf '%P\t%s\n' | LC_ALL=C sort` and the same command
   on `"$FTS_BACKUP/root$NOCTUA_DATA_DIR"`, save both outputs and require `diff` to be empty.
   Repeat for external/held-back trees and symlink targets. Compare individual external
   database/sidecar/configuration files with `stat -c %s` and `cmp -s`; every pair must match.
   Reconcile the distinct master/shard count against `inventory.json`; a directory-only
   backup is insufficient when mappings point elsewhere.
2. Make a disposable validation copy of the backed-up database files **with their same-named
   WAL/SHM siblings**. On each copied master and shard run
   `sqlite3 -readonly /absolute/validation-copy/shard.db 'PRAGMA integrity_check;'`.
   Every result must be exactly `ok`. Do not use `immutable=1`, which would ignore WAL.
   Keep the original backup unopened and unchanged; SQLite can touch shared-memory state
   even during reads of a WAL database. Stop if any copy fails integrity or is missing.
3. Retain the copy manifest, integrity results, account mappings and binary revision with
   the private backup. Confirm the matching keys can be recovered without printing them.
   Capture baseline per-account message counts, scoped search results and provenance samples
   from the validation copies for step 5. Keep the verified backup until rollout acceptance
   and the historical resync are complete.

### 3. Inventory collisions and orphans on every shard

While clients remain stopped, run the readonly inventory on every distinct mapped shard,
using the array from step 2, and retain its JSON output privately:

```sh
bun scripts/checkShardMessageCollisions.ts "${FTS_DATABASES[@]:1}"
```

`FTS_DATABASES` puts the master first; exclude it from this command. Inspect additional
retained shards separately. The CLI also deduplicates real paths. It opens `{ readonly: true }`
without configuration, writer markers or schema initialization.

`shardVersion=2` is the normal v2 upgrade input; 0/1 can require the historical composite-key
conversion as well. Version 3 is already upgraded and still needs verification; a version
above 3 must be investigated with its matching binary, never lowered. `ftsOrphanCount` counts
historical FTS rows without a canonical message owner (including `accountId` for scoped
shapes); a matching local ID in another account does not rescue an orphan. Missing historical
FTS columns/table can produce zero, so zero alone does not prove a healthy schema.

If `ftsOrphanCount > 0`, stop the rollout decision here, retain the report and verified backup,
and review the orphan count/ownership with the owner. If proceeding with the documented loss
of orphan-only search rows, record that decision and the expected dropped count per shard.
Do not promote orphans to messages or manually delete them. Migration rebuilds from canonical
`messages`, drops those orphan FTS rows, and reconstructs missing/duplicate index entries.
It cannot recover message rows already overwritten historically. Record all accounts mapped
to historically shared shards for step 7, even when the current collision count is zero.

### 4. Start the merged binary and budget first-open migration

Only after steps 1–3 succeed, install/start the merged binary with the same data paths and
keys. Keep external admission, MCP, scheduled scripts and background sync/recompute disabled;
in particular leave `NOCTUA_MAILBOX_WATCHER` unset during acceptance. Open every mapped account
through the current application's configured DB API so every shard is initialized, including
cold/inactive shards. Startup alone is not evidence that every lazy shard has been opened.
Migration runs once per physical shard at first open, inside one immediate transaction.
Later opens verify the healthy v3 schema and do not rebuild it.

Allow **2.0–3.0 seconds per 11,000-message shard** for the review's fresh-process open/migration
samples: **2,030.265 / 2,967.126 / 2,890.239 ms**. This rollout budget covers the whole open,
including connection configuration. The implementation brief's **1,041.766 ms median**
(1,039.209 / 1,048.154 / 1,041.766 ms) times only `initAccountSchema` on an already configured
handle. These are different timing boundaries and shared-host runs; do not promise one-second
startup or attribute the entire difference to configuration. The review's machine-readable
limitations line says configuration was excluded from its timed interval, so treat 2–3 seconds
as the conservative whole-open planning allowance, not an isolated measurement of configuration
cost. Both series exclude fixture generation.

The independent review observed a **56,027,912-byte WAL peak (~56 MB / 53.4 MiB)**, main-file
growth **153,776,128 → 207,552,512 bytes (~154 → 208 MB)**, and post-migration process RSS
**219,537,408–226,766,848 bytes (~220 MB)**. The configured SQLite cache target was **32 MiB**;
RSS includes the process and is not resident SQLite cache usage. The main file does not shrink
after the old index is dropped; do not add startup VACUUM, ANALYZE or optimization.

Reserve free space on each shard filesystem **at least 2 × its largest shard file + 56 MB
WAL headroom**, in addition to backup storage, retained files and normal operating reserve.
Use a larger WAL allowance for larger/different shards; 56 MB is an observation, not a cap.
For concurrent migrations, add the per-shard disk and process memory allowances or open shards
serially. Allow several seconds per shard plus backup, startup and verification time; account
for all shards in the window. These are synthetic 11k-text/attachment/source measurements
on Linux arm64/Bun 1.4.4/SQLite 3.53.4 under shared-host load, not production or larger-shard
latency, memory or power-loss guarantees.

### 5. Verify in order before resuming traffic

Keep other writers paused while taking counts/snapshots; if startup spawned any clients, stop
and drain them again after the migrating opens. Use the current checkout for helper imports.
Perform the following on **every** shard, in this order:

1. **Version and schema.** Inspect with raw readonly SQLite:

   ```sh
   sqlite3 -readonly /absolute/shard.db <<'SQL'
   PRAGMA user_version;
   PRAGMA table_info(messages);
   PRAGMA table_info(message_fts_identity);
   PRAGMA foreign_key_list(message_fts_identity);
   SELECT type,name,sql FROM sqlite_master
     WHERE name IN ('message_fts_identity','message_fts_v3','message_fts','message_fts_v2')
     ORDER BY name;
   SELECT name,type FROM pragma_table_list
     WHERE schema='main' AND name GLOB 'message_fts_v3_*' ORDER BY name;
   SELECT COUNT(*) FROM sqlite_master
     WHERE type='trigger' AND name GLOB 'noctua_writer_v3_*';
   SELECT name,tbl_name,sql FROM sqlite_master
     WHERE type='trigger' AND name GLOB 'noctua_writer_v[23]_*' ORDER BY name;
   SQL
   ```

   Expect version **3**, composite messages key `(accountId,id)`, an AUTOINCREMENT integer
   `ftsRowid` primary key, non-null account/message IDs, unique `(accountId,messageId)` and
   a composite cascading FK to messages. `message_fts_v3` must be the contentful FTS5 virtual
   table, with `data`, `idx`, `content`, `docsize`, `config` shadows. Both historical names
   must be views selecting `rowid,*` from `message_fts_v3`. Expect **81 v3 BEFORE guards**
   (INSERT/UPDATE/DELETE on 27 audited ordinary tables), no v2 guards. Custom account-scoped
   tables require three additional guards each; a higher count must be explained by that
   inventory. Count alone cannot detect weakened bodies: run the exact-definition helper
   below too. The helper checks all discovered scoped guards, required tables, views and
   normalized FTS/map DDL, including UNIQUE and shadow-table shape.

   ```sh
   bun --eval '
   import { Database } from "bun:sqlite";
   import { shardWriterGuardsInstalled } from "./lib/db/shardFormat.ts";
   const db = new Database(process.argv[1], { readonly: true });
   try {
     if (!shardWriterGuardsInstalled(db)) throw new Error("Incomplete v3 shape");
     console.log("v3 schema/guards/views: ok");
   } finally { db.close(); }
   ' /absolute/shard.db
   ```

2. **Bijection, counts and FTS integrity.** Compare `SELECT accountId,COUNT(*) FROM messages
   GROUP BY accountId ORDER BY accountId` against the stopped baseline: all canonical message
   counts must match before resync. Run the existing full validator on an existing shard with
   a write-capable maintenance handle while application writers remain paused:

   ```sh
   bun --eval '
   import { Database } from "bun:sqlite";
   import { validateFtsIdentity } from "./lib/db/ftsIdentity.ts";
   const db = new Database(process.argv[1], { create: false });
   try {
     db.exec("PRAGMA foreign_keys=ON");
     validateFtsIdentity(db);
     console.log("messages/map/FTS bijection, FTS integrity and foreign keys: ok");
   } finally { db.close(); }
   ' /absolute/shard.db
   ```

   Success means equal messages/map/FTS counts, complete coverage in both directions, unique
   composite ownership and matching FTS rowids/account/message IDs, plus no FK violations.
   The helper executes `INSERT INTO message_fts_v3(message_fts_v3) VALUES('integrity-check')`;
   it needs a writable handle even though this is validation. It does not initialize/migrate
   schema or write ordinary message tables. Do not interpret a readonly error as corruption
   or use a public SQL client for arbitrary physical-FTS maintenance.

3. **Scoped search.** Resume the current app for controlled acceptance only. Compare pre/post
   results per mapped account for a known selective word, common word, phrase, subject/from
   scope, no-hit term and paginated search. Expected: same ordered canonical message IDs,
   totals and page boundaries, with no cross-account hits. For a shared shard, select two
   accounts with overlapping local/RFC IDs and verify each sees only its own rows and bodies.
   A SQL spot check is `SELECT accountId,messageId FROM message_fts_v3 WHERE message_fts_v3
   MATCH 'subject:needle' AND accountId='synthetic-account-a' ORDER BY messageId`; substitute
   a real inventoried term/account privately and require the recorded canonical hit set.
   Expected exceptions: old orphan-only hits disappear, and canonical messages missing from
   the old FTS may now appear; reconcile these against step 3 and canonical messages rather
   than demanding equality with a known damaged old index. Existing unsupported query errors
   must not become silently different search behavior.

4. **Provenance and privacy.** Before hydration or resync, compare privately recorded
   `SELECT accountId,id,senderKey,sourceSha256 FROM messages ORDER BY accountId,id` samples
   (known and NULL values, including shared-ID copies) to the backup. Migration must preserve
   those values, source bytes/digests and attachment ownership; it reads no raw source and
   performs no sender backfill. Opening messages afterward can legitimately fill a NULL
   sender key only from an exact final-row-ID source matching the stored SHA-256, so record
   comparisons before those reads. A legacy/mismatched/unowned source must not establish
   permission. In the reader and standalone HTML view, check a synthetic known sender and
   unknown sender: remote images blocked by default, Load once permits that view, Always load
   only for a stored canonical sender key; sender CSS never fetches remote resources, and
   permitted remote images send no Referer. Follow `doc/HTML-MAIL-PRIVACY.md` and the scenarios
   in `tests/browser/htmlPrivacy.test.ts` (existing regression: **177 assertions**). That
   browser test starts its own fixtures/servers; it is evidence and a separately isolated
   acceptance procedure, not a command to run against production during this rollout.

Record results per shard/account. Keep admission closed if any step fails; investigate using
copies, or perform the stopped restore below. Enable normal background clients only after
these checks and scheduling the required historical resync.

### 6. Roll back by restoring the stopped snapshot

Rollback is **restore-only**. The old binary refuses format 3. Never lower `user_version`,
drop guards/views, or point an old binary at upgraded files. There is no in-place downgrade
or automatic repair CLI. Restore discards local changes after the snapshot; record any such
activity before proceeding.

1. Close admission, disable automatic restarts/jobs and stop/drain **all** step-1 clients again.
   Confirm no handles remain open before touching files.
2. Preserve the failed v3 state separately for investigation. Move the entire active data root
   aside to a new recovery location. For each external database, move its main file **and any
   `-wal`/`-shm` siblings** aside as a set. Move aside external retained/configuration paths
   that will be restored too. Do not overlay a v2 main file onto a v3 WAL/SHM or leave files
   absent from the backup in the restored tree.
3. From the pristine backup path manifest, restore `root/<original-absolute-path>` to each
   original absolute location: the full data root, master, every mapped external shard and
   each saved sidecar, retained/held-back file and configuration path. For example, after
   moving the active directory aside, `cp -a -- "$FTS_BACKUP/root$NOCTUA_DATA_DIR"
   "$(dirname "$NOCTUA_DATA_DIR")/"` restores that root. Restore external files and their
   saved siblings with `cp -a` to their recorded parent directories as well. If a sidecar
   did not exist in the backup, none from the failed state may remain. Restore symlinks and
   their actual targets, ownership and permissions from the manifest.
4. Restore the matching private keys/environment and the exact retained pre-upgrade binary.
   Keep restart policies disabled. Compare restored file counts/sizes/bytes to the pristine
   manifest before opening SQLite; on validation copies rerun `PRAGMA integrity_check` for
   master and every shard, expecting `ok`. Read `PRAGMA user_version` on the restored shard
   copies and require the recorded pre-upgrade value, not 3 for an original v2 shard. Verify
   master mappings resolve to those restored files under the original launch directory.
5. Start only the old binary against that matched snapshot; verify auth, scoped search and
   representative retained sources/attachments before reopening admission and restarting
   watcher, workers, MCP and scheduled scripts. Retain both snapshots until recovery is accepted.

A separately reviewed atomic export/rebuild or repair is a different recovery procedure,
not a substitute for this verified backup.

### 7. Resync every account of historically shared shards

After successful verification, explicitly resync **all accounts mapped to any shard shared
before composite account keys**, even if `sharedMessageIdCount=0` and no collisions remain.
Use the preserved master mappings plus deployment history, including currently empty accounts;
`storedAccountCount` only counts surviving messages. The collision script's
`resyncRequiredForLegacySharedShard` flag is based on the current `legacyMessageKey`; a modern
key/false flag cannot disprove historical sharing or historical loss.

As `lib/db/shardCollisionReport.ts`, used by `scripts/checkShardMessageCollisions.ts`, warns:
counts cover surviving rows only. Legacy unscoped sync may already have overwritten another
account's messages, which migration cannot reconstruct from local data. Use authoritative
existing-message resync/full re-ingestion across the affected folders, not only a new-mail
sweep, to refresh lost rows and their source/sender provenance. Schedule within the normal
worker capacity; verify counts against upstream and repeat scoped-search/ownership/privacy
spot checks afterward. Retain the pre-upgrade snapshot through this acceptance.

### 8. Watch logs and handle failures

Watch for **`[shard-format-v3] dropped N orphan FTS rows`** after successful commit when N is
nonzero. Reconcile N with each shard's stopped inventory; a zero count produces no such line.
This logs discarded orphan index rows, not deleted canonical messages. Preserve per-shard
context when correlating the log, since the warning text itself contains no shard path.

Before-commit process death rolls back to complete v2; restart the current binary and retry
after checking disk and ownership. After-commit death leaves complete v3; a later open verifies
it without remigration. Lock contention uses the existing write-retry policy; find and stop
remaining clients rather than changing versions or weakening guards. If retries exhaust,
keep admission closed and investigate locks, free disk and logs before retrying.

`Incomplete account shard format 3; explicit atomic repair required` (or the corresponding
incomplete account-key/FTS-coverage error) is an explicit stop, not a request to initialize an
empty index. Stop all clients, preserve files/logs, inspect a copy, and restore the verified
snapshot or obtain a separately reviewed atomic repair. A declared-v3 file missing its shape
is not normal interrupted-migration recovery. Future-version refusal means a binary/data
mismatch: select the matching binary or restore its matching snapshot. No ad hoc DDL, version
reset or guard removal is part of this runbook. SIGKILL regressions prove process-crash
behavior only; they do not establish power-loss durability.

### Readonly and cold-opener contract

`initAccountSchema` calls `prepareAccountShardConnection` unconditionally before its shape
checks (`lib/db/schema.ts:977`). On a supported, healthy v3 shard, even a cold
`new Database(path, { readonly: true })` handle gains connection-local
`noctua_writer_v2() => 2` and `noctua_writer_v3() => 3`. Registration changes connection state,
not SQLite's file-open mode. Healthy cold initialization checks schema without a writer lock,
full message traversal, FTS integrity command or migration/rebuild; it is not marker-free.
An older/incomplete schema may need writes or fail explicitly, so the initializer is not a
general readonly migration/repair API. A version above 3 is refused before registration.

DML on that initialized readonly handle still fails with `attempt to write a readonly database`:
the marker satisfies writer guards but does not grant SQLite write access. Raw readonly
inventory handles (the collision CLI) and raw SQLite readers remain marker-free **unless a
caller explicitly prepares/initializes them**. Ordinary application read requests instead use
configured write-capable handles because runtime/provenance backfills can write.

`lib/db/ftsIdentity.test.ts`, test **"cold open checks schema without a writer lock, even with
a concurrent writer"**, proves lock freedom and unchanged `schema_version` on a healthy v3
open; its handle is write-capable. `lib/db/shardFormat.test.ts` proves future-version refusal
before registration and the writer-opener inventory. Neither file explicitly tests readonly
DML failure. Review r1 independently probed it; there is no such automated assertion to claim.
The missing regression probe would open a healthy migrated disposable shard `{ readonly: true }`,
observe missing marker functions, call `initAccountSchema`, observe marker results 2 and 3,
then attempt an actual DELETE of an existing `(accountId,id)` and require the readonly error
and unchanged rows/schema/version. No implementation/test change accompanies this documentation.

## Deviations and implementation choices relative to the spike

- No storage/query design deviation: option (d), contentful FTS, canonical composite identities, both views, exact runtime marker checks, all original guards plus three, and version-last atomic commit are implemented.
- The implementation is based on round-7 `9424150`, rather than the spike’s `620a785`; `users.uiLocale` and current S3 columns/semantics are preserved.
- Pre-v3 additive initialization joins the outer migration transaction, which is stronger than the old v2 initializer’s additive work before its key transaction. Two schema installers now accept the existing transaction and defer readiness-cache publication until commit. This is necessary to avoid nested immediate transactions and incorrect retry state, without changing their data semantics.
- Incomplete v3 schema uses the explicitly permitted failure policy. No automatic repair/reindex entrypoint is added.
- The physical-table constant is re-exported from the helper to keep DDL/schema probing free of circular initialization. Public imports from `shardFormat.ts` remain valid.
- Added test-only v2/crash fixtures and the frozen 112-site corpus beyond the brief’s named test files to make recovery/audit checks reproducible. Updated the collaboration contention test to construct an actual v2 fixture before removing collaboration tables, rather than incorrectly retaining a complete-v3 header on an older-schema fixture. Extended the existing read-only collision script rather than adding another inventory opener.
- Benchmarks include actual retained sources/attachments, shared-account IDs and the implemented full validation. v3 rebuild cost is therefore reported with its validation/guard work, not as the spike’s narrower repopulation number.
- Randomized execution exposed test-order interference from the connection-pool suite’s global ImapFlow mock in the two real sender-key resync tests. Added a fresh child-process test boundary, matching the existing real-send suite pattern; no resync/IMAP production implementation changed. Added persistent ordered-search and updated-token assertions to the identity tests.
- Used the repository’s actual `test:stress` script (there is no `stress` script). Graceful shutdown receives explicit isolated data/port arguments. Browser port edits were temporary and restored.

## Gates

All heavy commands ran under `nice -n 10` in this worktree. Main gate logs used task-owned scratch under `/tmp/fts-v3`.

| Gate | Final result |
| --- | --- |
| `bun run typecheck` | PASS: 0 errors, 1,178 files (latest rerun 0.64 s) |
| `bun run lint` | Baseline unchanged: 1 error + 25 warnings, all outside changed files; error is the existing synchronous setState-in-effect finding in `useCalendarConflicts.ts` (53.59 s) |
| `bun run test:ci` | PASS: 2,778 unit + 433 DOM, zero failures (final rerun 432.39 s) |
| `bun run test:stress` | PASS: 8,334 randomized executions, zero failures; seed 1337, rerun-each=3 (1021.82 s) |
| `bun run build` | PASS (69.65 s); Next compiled, TypeScript and static generation completed |
| `bun scripts/checkGracefulShutdown.ts --port 3897 --data-dir /home/monkey/code/noctua-mail/wt-fts-v3/.data/fts-v3-shutdown` | PASS: exit 0, SIGTERM-to-exit 1,272 ms, forced=false; owned port 3897 and isolated worktree data (4.49 s total) |
| Headless HTML privacy | PASS: 1 test / 177 assertions, app/tracker ports 3897/3898; 73.18 s |
| Focused compatibility/migration/guards | PASS: 64 tests / 659 assertions with the CI 20 s test timeout |
| Permanent FTS differential/update checks | PASS: 66 randomized executions / 300 assertions, seed 1337, rerun-each=3 |
| Pool mock + isolated real S3 resync | PASS: 57 randomized executions / 153 assertions, seed 1337, rerun-each=3 |
| Changed-test lint after isolation | PASS: 0 errors/warnings |

The first full CI run identified two integration issues: an overbroad shape check added to the connection-preparation hook changed cleanup’s absent/partial collaboration behavior, and a contention fixture dropped tables while retaining a v3 header. Restored the original preparation-hook semantics and modeled an actual v2 fixture; the full CI rerun above passes. Interrupted the already-started stress attempt after those known failures and restarted it on the corrected tree. A first focused invocation used Bun’s 5 s default timeout for an existing test that deliberately sleeps 5.1 s; its CI-equivalent 20 s timeout rerun passes. The first completed randomized run had 8,328 pass / 6 fail: the same two real-resync tests failed in three repetitions because a global pooled-ImapFlow mock leaked into them. Isolated those test cases in fresh child module graphs, then reran the targeted mock/resync combination (57/57) and full CI successfully; final full stress rerun above passes all 8,334 executions. No IMAP/sync implementation changed. The first graceful-shutdown attempt lacked the synthetic auth environment; the final attempt supplies isolated synthetic auth/IMAP settings without changing credentials or source code and passes.

`git diff --check` passes. The lockfile and the specifically excluded production modules remain unchanged.

## Diff stat and commits

Working tree clean after three logical commits on `perf/fts-identity-v3`. The brief is stored outside the checkout at the requested shared handoff path.

```text
 lib/db.senderKey.test.ts                 |  12 +-
 lib/db.sharedShard.test.ts               |   6 +-
 lib/db/accountKeys.test.ts               |  18 +-
 lib/db/accountKeys.ts                    |  42 +-
 lib/db/connection.collab.test.ts         |   6 +-
 lib/db/ftsIdentity.test.ts               | 239 +++++++++++
 lib/db/ftsIdentity.ts                    |  91 +++++
 lib/db/messages/delete.ts                |  13 +-
 lib/db/messages/upsert.ts                |  27 +-
 lib/db/schema.ts                         |  59 ++-
 lib/db/shardFormat.test.ts               |  63 ++-
 lib/db/shardFormat.ts                    |  78 ++--
 lib/mail/resyncMessage.senderKey.test.ts |  15 +
 lib/testFixtures/ftsV3CrashWorker.ts     |  19 +
 lib/testFixtures/legacyShardDml.json     | 674 +++++++++++++++++++++++++++++++
 lib/testFixtures/v2FtsShard.ts           |  32 ++
 scripts/checkShardMessageCollisions.ts   |   5 +-
 17 files changed, 1306 insertions(+), 93 deletions(-)
```

`git log --oneline 9424150..HEAD`:

```text
c819806 test(db): retain FTS search checks and isolate sender resync fixtures
aabd4c0 test(db): verify v3 migration recovery and legacy writer rejection
3827447 perf(db): migrate shards to stable FTS row identities
```

## Merge notes for upsert.ts

Sync-owner heads-up: `feat/sender-identities-2` at `781b4b2` is not on this base. It changes the later draft-replacement transaction/assertCurrent flow and other outbound modules. No files from that branch/worktree were read or changed here. The v3 diff in `upsert.ts` is confined to one import, FTS statement preparation and mapping/index maintenance inside `upsertMessages` and its existing nested `upsertBatch` callback. Line numbers below refer to the committed v3 implementation (production commit `3827447`); no surrounding transaction or draft/publication code was restructured.

| Function/location | Changed lines | Exact change |
| --- | --- | --- |
| Module import | 36 | Import `prepareFtsIdentityWriter`. |
| `upsertMessages`, `deleteFtsByScope` | 162–171 | Replace folder/account FTS key scans with mapped `rowid IN (SELECT ...)` deletes. Argument/scope selection is unchanged. |
| `upsertMessages`, prepared statements | 255–256 | Prepare the shared identity writer once and bind `deleteFts` to its mapped-rowid removal statement. Replaces the old nine-column FTS insert and key-based delete statements. |
| Existing `upsertBatch` callback | 597–601 | Distinguish replacement snapshots from surviving rows; look up the final collision-resolved mapping and delete old FTS before the message UPSERT. |
| Existing `upsertBatch` callback | 653–661 | Replace `insertFts.run(...)` with the identity writer insertion, which allocates a missing mapping after the message row exists and supplies the explicit FTS rowid. The same seven indexed text values are used. |

Merge invariants for the other branch’s replacement transaction:

- Keep message, mapping and FTS changes inside the same immediate transaction/assertCurrent rollback boundary. A valid **mapping row must exist before every FTS insert**; a newly allocated mapping references the final local message ID after the message row exists, not an RFC/base/collision seed ID.
- **FTS deletion must precede message deletion**, while the mapping and scoped messages still exist. Existing duplicate-purge call sites at lines 427–428 and replaceExisting call sites at lines 726–727 already preserve this ordering and were not rewritten here. The other branch must retain it when moving the replacement flow. Messages deletion cascades the mapping, so looking it up afterward cannot remove the old FTS row.
- A surviving indexed row with no mapping is an explicit repair/error case; replacement metadata snapshots whose rows were already deleted legitimately allocate new identities. Preserve that distinction when adding assertCurrent callbacks.
- The messages UPSERT column/binding block, round-5 deliveredTo/originalTo/senderIdentityId metadata, sourceSha256 staging, file installation/publication and the surrounding replacement/remap transaction are untouched. No changes were made to `mutations.ts`, calendar events or an outbound-write module.

## Review r1 resolution

- **P2 (incomplete rollout handoff):** replaced Deploy handoff with the complete numbered operator runbook, mirrored in `doc/FTS-V3-MIGRATION.md` and linked from Deployment's Backup & Restore section. It names actual runtime paths/mappings/secrets, requires a verified stopped full backup before startup, includes collision/orphan disposition, timing/disk/WAL/RSS allowances, ordered verification, restore-only rollback, historical shared-shard resync and failure/log handling. Both measurement boundaries are documented, including the review JSON's configuration-exclusion caveat; 2–3 seconds remains the conservative whole-open planning allowance.
- **P3 (readonly marker criterion):** corrected the audit/acceptance text, the runbook's opener contract and owner checklist to distinguish marker registration from SQLite write permission and healthy cold-schema probing from migration/repair. Cited the existing lock-freedom/future-version tests and explicitly identified the absent readonly-DML assertion plus the probe that would cover it. No code or tests changed.

This resolves the two documentation findings against implementation pin `c819806`; it does not claim a new code review, sender-merge verification, benchmark or test run. The original review artifact remains unchanged.

## Explicit owner review checklist

- [ ] Marker lifecycle/readonly acceptance: future versions refuse before registration; v2 returns 2 and v3 returns 3. `configureAccountDb` and direct `initAccountSchema` prepare supported handles, including healthy readonly initializers; raw unconfigured inventory readers do not register markers. Registration does not grant write access: readonly DML still fails at SQLite. The readonly-DML probe is independent review evidence, not an existing automated assertion (see Audit semantics statement). Cleanup handles retain configuration and wrong-marker rejection.
- [ ] Guard discovery: original 26 account-scoped tables plus identity (81 guards), extra discovered scoped tables still guarded, missing/changed definitions rejected; physical FTS/shadow limits described accurately.
- [ ] Migration composition: audited composite-key conversion, S3/custom-index/custom-trigger retention, foreign-key OFF/restore for pre-v2, ON for ordinary v2, one outer immediate transaction, recheck under lock, version assignment last.
- [ ] Cold-open fast path: healthy complete v3 schema/constraints/views/guards checked without a writer lock, full message scan, integrity write or rebuild; both markers are still prepared even on readonly initializers. `ftsIdentity.test.ts` proves lock freedom, not readonly DML rejection; pre-v3/incomplete readonly initialization is not a repair API. Schema repair cannot silently create an empty index.
- [ ] All writable openers: get/with-account API, cache reopen/eviction, membership cleanup, watcher, sync worker/runSyncJob, recompute workers/CLIs, calendar scripts and MCP paths retain the common configuration hook; inventory CLI stays read-only.
- [ ] Stale v2 handles: prepared message DML rejects under the v3 marker; the former physical name is read-only; all 112 legacy sites and 81 guard combinations remain rejecting.
- [ ] Mutation scope: final collision IDs, same-copy duplicates, repeated upsert, folder/account replacement and every single/batch/prefix delete preserve the map/FTS/message bijection and other account’s rows/files/provenance.
- [ ] Rollout/retry: execute the Deploy handoff / `doc/FTS-V3-MIGRATION.md` runbook: stop app/watcher/workers/MCP/scripts, verify master/all mapped shards/WAL/SHM/keys/retained-file backup, review collisions/orphans, budget whole-open timing/disk/RSS, open every shard, verify v3 shape/81 guards/two views/bijection/integrity/scoped search/provenance/privacy, and resync every account of historically shared shards even at zero collisions. Understand logged orphan drops, lock/crash retry and explicit failure; larger-shard sizing remains deployment planning work.
- [ ] Later sender-identities merge: preserve the localized FTS hunks, mapping-before-FTS insertion, FTS-before-messages deletion, and the same immediate/assertCurrent rollback boundary; retain round-5 metadata and publication semantics.
- [ ] No in-place downgrade: user_version is not reset as a rollback mechanism; use a stopped pre-upgrade backup or a separately reviewed export/rebuild.

Original implementation handoff: code pin `c8198067454a0034d6e6393f1d99401506bf6446`; the subsequent review-r1 resolution adds one doc-only commit without changing that code pin. The three implementation commits and gate results above are historical evidence, not rerun during this documentation task. Task-owned test listeners/processes are stopped; task-owned scratch and isolated data have been removed.
