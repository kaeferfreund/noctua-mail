# Storage

This document explains runtime storage from an operator/deployment perspective:
- where data is stored
- how critical each storage component is
- what users lose if specific files are missing

## Base Data Directory

- Base path: `NOCTUA_DATA_DIR` (if set), otherwise `../noctua-data` relative to repo root.
- Main subpaths:
  - `db/main.db` (master SQLite DB)
  - `db/accounts/<accountId>.db` (per-account SQLite shards)
  - `sources/<accountId>/<messageId>.eml` (raw message source cache)
  - `attachments/<accountId>/<messageId>/<attachmentId>.bin` (attachment binary cache)
  - `domain-icons/<sha256(domain)>.png` (admin-uploaded sidebar domain icons, re-encoded 64×64 PNG)

Path segments are `encodeURIComponent(...)` encoded.

## What Is Stored Where

### `db/main.db` (master DB, critical)

Contains control-plane and identity data:
- `accounts` (account definitions, IMAP/SMTP connection config, `dbPath`)
- `users` (application profiles), `auth_*` (Better Auth credentials, factors, sessions and policy state)
- `user_accounts`, `user_account_prefs`, `admin_audit`, `mcp_tokens`, `mcp_token_accounts`
- `invite_codes`
- `domain_icons` (one row per domain with an uploaded icon: byte hash, size, updatedAt, updatedByUserId;
  the PNG itself lives in `domain-icons/`. Back both up together. A row without its file falls
  back to the favicon; a file without its row is never served. The sender-icon route serves an
  upload only for domains of mailboxes the caller can open.)

Encrypted IMAP/SMTP passwords are stored here. `IMAP_CREDENTIALS_STORAGE=db` is the default;
`both` is a deprecated DB-only alias. `cookie` is rejected at startup. Sessions and MCP tokens
carry no mailbox passwords. Back up the independent `IMAP_SECRET_KEY` and `BETTER_AUTH_SECRET`
with the databases.

### `db/accounts/<accountId>.db` (account shard DB, important)

Contains per-account operational and user-facing mail state:
- `folders`, `messages`, `threads`, `mailbox_state`, `message_fts_v3`
- attachment metadata (`attachments`)
- reminder definitions (`calendar_reminders`)
- categorization state and learning:
  - message category fields (`messages.category`, `messages.categoryScore`, `messages.categorySignals`)
  - learned model (`category_model_state`)
  - feedback/training history (`category_feedback_events`)

Several accounts may map to one physical shard via `accounts.dbPath`. Message
and thread identities include `accountId`; attachments, translations and calendar
message links use the same composite ownership. Source and attachment cache paths
remain account scoped. Format 3 (`PRAGMA user_version = 3`) is migrated at first
open in one immediate transaction with the composite-key/FTS rebuild and writer
guards. It preserves surviving data, indexes and custom triggers, checks foreign
keys, and rolls back on failure. Repeated initialization is idempotent.

BEFORE INSERT/UPDATE/DELETE triggers on every ordinary account-scoped table
require `noctua_writer_v3()`, registered per connection by `configureAccountDb`
before writes (also by explicit schema initialization). A legacy connection fails
at statement preparation with `no such function: noctua_writer_v3`. SQLite does
not allow persistent triggers to refer to TEMP tables or triggers on virtual/FTS
shadow tables. Accordingly, the physical FTS table is `message_fts_v3`, and the
old `message_fts` and `message_fts_v2` names are reserved as read-only views: legacy FTS mutations fail
with `cannot modify message_fts because it is a view`. Old reads may work or fail.
The current binary rejects shard versions newer than its supported format before
configuration/schema writes. Raw maintenance writers must use the common shard
connection configuration and the current FTS name. `message_fts_identity` supplies stable integer
rowids for `(accountId, messageId)`; a plain `REPLACE` of FTS rows must not allocate a new identity.

Upgrade procedure:

1. Stop old app instances, watchers, sync and recompute workers.
2. Back up the master DB, every actual shard path once, and account-scoped files
   together. Use SQLite backup or a clean shutdown so WAL data is included.
3. Run `bun scripts/checkShardMessageCollisions.ts /absolute/path/to/shard.db`
   read-only before migration. Save the collision inventory and account mappings;
   a zero collision count cannot reveal rows already overwritten by legacy sync.
4. Start only the current binary; opening each shard migrates it automatically.
5. Resync every account that used a legacy shared shard, including accounts with
   zero surviving collisions. Migration cannot recover previously lost rows.

For downgrade, stop the current processes and restore the coordinated pre-upgrade
backup before starting an old binary. Do not drop guards or lower the version to
permit mixed writers. See [Team Inbox §3.2](TEAM-INBOX.md#32-account-shard-db-dbaccountsaccountiddb)
for the shard key and migration contract.

### `sources/...` and `attachments/...` (cache, rebuildable)

Contains cached raw message source and attachment binaries. In these paths,
`messageId` is the **final database row id**, including a collision suffix for
copies sharing a Message-ID in different mailboxes/UIDs. It is not the wire
Message-ID or the provisional base id. The pre-existing base row keeps its
source and attachments byte-for-byte when another copy is ingested.

Ingestion stages bytes under temporary names, then resolves each final row id
and publishes its source/attachments by rename within the existing immediate
shard transaction. The nullable `messages.sourceSha256 TEXT` column records the
source's SHA-256 digest in that same transaction; source-less updates to a
retained row preserve its existing digest. Publication is idempotent for the same final id and bytes.
On a caught file/SQL failure, prior files are restored while the writer lock is
held, newly published files are removed, and staging/backup files are cleaned.
SQLite and files are not a single crash-atomic resource: interruption can leave
temporary `.pending-*` files or a source inconsistent with the rolled-back row.
These temporary files are not read as sources; a digest mismatch fails closed
for sender-key backfill. They can be removed with the app stopped; resync
refreshes the row and its files.

Lazy sender-key backfill requires an exact final-row-id source matching that
ownership digest. Legacy files without a digest are never trusted for sender
permissions on open, even if their filename exactly matches a row; only the
one-time operator tool `scripts/backfill-sender-keys.ts` stamps them, after
matching byte size, Message-ID and From mailbox against the row
([HTML mail privacy](HTML-MAIL-PRIVACY.md)). Authoritative resync
writes both the parsed sender key and the ownership digest. Low-level cache
rewrites (for example attachment-removal fallback) do not establish provenance;
if they change the bytes, backfill waits for resync.
These files are performance/availability cache for message rendering and downloads.

## Loss Impact (What Users Lose)

### If `db/main.db` is lost

Users lose:
- account definitions and account-to-user assignments
- application users, invite codes, credentials, MFA factors, sessions and MCP tokens
- personal mailbox preferences and administration audit history
- IMAP/SMTP passwords stored in DB (`IMAP_CREDENTIALS_STORAGE=db|both`)

Operational impact:
- app cannot map users/accounts until rebuilt/recreated
- account shard files may still exist on disk, but become orphaned without master metadata

### If one account shard `db/accounts/<accountId>.db` is lost

Users lose local state for that account:
- local message index/search/threading metadata
- folder/mailbox sync cursors (`mailbox_state`)
- reminders (`calendar_reminders`)
- all categorization values and learned categorization model/feedback
- topics/learning, thread collaboration, notes/activity, sender attribution and local calendar state

Not lost:
- canonical mailbox content on the upstream IMAP server

Operational impact:
- account can be re-synced, but local classifications/reminders/learning are gone

### If `sources/...` is lost

Users lose:
- cached raw RFC822 source files for affected messages

Operational impact:
- source view and some reprocessing paths may fail until cache is rebuilt (e.g. via re-sync/resync)

### If `attachments/...` is lost

Users lose:
- cached attachment binaries for affected messages

Operational impact:
- attachment download/inline rendering may fail until binaries are rebuilt (e.g. via re-sync/resync)
- attachment metadata in account DB remains

### If entire `NOCTUA_DATA_DIR` is lost

Users lose all local app state:
- all users/accounts
- all local indexed mail state
- all reminders
- all categorization values/learning
- all source/attachment caches

Canonical IMAP mailbox content is not deleted by this, but full re-onboarding and re-sync is required.

## Backup Priority

Recommended backup priority:
1. `db/main.db` (highest)
2. `db/accounts/*.db` (high)
3. `sources/` and `attachments/` (optional cache, lower priority)

If backup volume is constrained, prioritize DB files first.

## Cleanup and Lifecycle Notes

- Account delete removes:
  - account linkage/row in master DB
  - account shard DB file (`.db`, `-wal`, `-shm`) when unreferenced
  - account source/attachment cache directories
- Message hard-delete and draft discard remove DB rows plus cached source/attachment files for those messages.
- Full sync can prune cache files for messages no longer present in that sync scope.
