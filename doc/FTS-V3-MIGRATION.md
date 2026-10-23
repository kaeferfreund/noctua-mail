# FTS v3 migration

Operator procedure for the one-way account-shard upgrade implemented at `c819806`.
Run commands from the deployed checkout, with its existing private environment and working
directory. This procedure changes persisted shard format; complete the stopped backup and
inventory before starting the merged binary. Keep public traffic and automatic jobs paused
until verification succeeds. Do not mix v2 and v3 binaries against the same data.

## 1. Stop all database clients

Stop admission at the proxy and disable service/container restart policies and scheduled jobs
for the maintenance window. Stop every app instance, mailbox watcher, sync worker
(`runSyncJob`), thread/category/topic and other recompute worker, MCP process, and maintenance,
calendar, backfill or ad hoc script that can open this datastore. Close interactive SQLite
sessions too. Use the graceful shutdown procedure in `DEPLOYMENT.md`; wait for the parent
and every owned child to exit. Confirm no process still has the master, shards or sidecars
open (for example, inspect `lsof` for each inventoried path). A stopped HTTP listener alone
does not prove workers or MCP have stopped. Keep these clients stopped through steps 2–3.

## 2. Create and verify a complete stopped backup

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

## 3. Inventory collisions and orphans on every shard

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

## 4. Start the merged binary and budget first-open migration

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

## 5. Verify in order before resuming traffic

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

## 6. Roll back by restoring the stopped snapshot

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

## 7. Resync every account of historically shared shards

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

## 8. Watch logs and handle failures

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

## Readonly and cold-opener contract

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
