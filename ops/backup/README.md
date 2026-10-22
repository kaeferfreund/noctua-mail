<!-- Purpose: backup, archive and isolated restore operations; runbook §6; REVIEW BEFORE USE. -->
# Backups and independent mail archive

Install nothing from these notes without review. Both timers are **disabled**: no
script enables or starts them. Install the reviewed ops tree at `/opt/noctua/ops`
root-owned, shell entrypoints executable; install units separately as root. Backups
need Python 3.11+ (stdlib sqlite3), GNU tar/coreutils, flock, restic, SSH, systemd and
native ARM64 Bun. Restore startup also needs `systemd-run`, `nsenter` and curl. Native
ARM sqlite3 is still needed for the runbook's manual SQL; the scaffold uses Python's
SQLite binding for integrity/foreign-key checks. No packages were installed here.

## App backup

Default paths are from §6 with the task's explicit `/srv/noctua/env/noctua.env`
override. Create parent directories before use; `/srv/noctua/backups` is root:root
0700. Privately prepare `/etc/noctua/backup.env` and a separate password file,
both root:root 0600. Example configuration values, never actual credentials:

```dotenv
RESTIC_REPOSITORY=sftp:<dedicated-backup-user>@<verified-nas-host>:/<dedicated-repository>
RESTIC_PASSWORD_FILE=/etc/noctua/restic-password
```

Use a dedicated SSH identity and independently verified host key, noninteractive
`BatchMode yes`, `StrictHostKeyChecking yes`, and a restricted NAS backup account.
No inline password in the repository URL or SSH command. Initialize a new **empty**
repository only as a separately approved operator action; never init over an existing
repository. Protect keys/password offline on an independent medium. The script does
not source any secret file. The service manager supplies backup.env; for manual
activation/backup, load it privately into the root shell with export semantics and
without xtrace/output. Never run `systemctl show ... -p Environment`.

Review the writer exclusion procedure, all paths/ownership, Caddy state/drop-ins,
backup failure notifications and archive completion. Only then create the empty
`/etc/noctua/backup-reviewed` marker root:root 0600; its presence is an operator
attestation, not an automatic proof of quiescence. CLI/fullsync/auth migration/recovery
jobs must never write while the app is stopped for the snapshot. Disable conflicting
timers/manual jobs during deploys. The process lock coordinates only these scripts.

`restic-backup.sh --dry-run` never reads secrets, contacts NAS, creates stages, or
changes services. Actual later execution:

```sh
/opt/noctua/ops/backup/restic-backup.sh --execute --confirm-no-other-writers
```

The script records original active states, stops app/Caddy and checks the fullsync
unit. It validates `accounts.dbPath` references, default encodeURIComponent shard
paths, duplicate/shared references, all discovered `*.db`, integrity and foreign keys.
Any missing referenced shard, external data symlink/path or unknown nonempty data tree
fails closed. Expand the backup/restore design before using external shards; do not
rewrite production paths as a workaround. Include legacy `mail.db` if it exists.

With **all** writers stopped, tar captures the whole data tree including residual
WAL/SHM, sources and attachments: this is the WAL-safe stopped-snapshot method in
§6.2, not a running-file copy or a collection of non-atomic online DB backups. Do not
remove sidecars. A private manifest lists actual shard references. Config/TLS archive
includes runtime env, `/etc/noctua`, `/etc/caddy`, `/var/lib/caddy`, app unit, Caddy
drop-in and installed ops files. The matching release and executable Bun are archived
with checksums. These archives contain secrets; they remain 0700/0600 local, and
restic encrypts the off-box copy. They must never be attached to a review or chat.

Caddy/app resume before the network upload except that `--pre-deploy` deliberately
keeps app stopped on success. Error traps resume services that were originally active;
services originally stopped stay stopped. Incomplete stages are retained privately
for diagnosis and never get `OFFBOX_SUCCESS`. Successful `restic backup` plus `restic
check` is required before activation continues. The success marker is local only;
restore verification uses the uploaded archive checksums.

Daily schedule: proposed 03:15 UTC with up to 5-minute jitter, after Maildir export.
`After=noctua-mailarchive.service` orders jobs only if both are queued **on the same
host**; it neither triggers nor verifies a remote archive. Confirm NAS archive completion
manually or add a separately reviewed cross-host completion gate. 01:00 archive time
is an assumption, not proof it finishes by 03:15. Prevent overruns and alert on failure.
Enable timers manually only after a successful first backup, isolated restore and
household acceptance; the corresponding explicit command is `systemctl enable --now
noctua-backup.timer` on the app host and `noctua-mailarchive.timer` on the archive host.

Policy: 14 daily / 8 weekly / 12 monthly snapshots. Script prints **only retention
preview**, grouped by host,tags so varying staging paths do not defeat retention.
After restore approval, review the equivalent command without `--dry-run`; prune
separately in a quiet window. Keep manual pre-go-live snapshots under a separate tag
and policy. Do not change host/tags casually. Keep the newest two successful local
stages and delete older ones manually only after off-box restore verification.
RPO ≤24 h and RTO 2 h are targets pending measurement, not guarantees. Monitor failed
unit status, last successful off-box snapshot age, disk/NAS capacity and certificate
expiry; ownership/alert transport is a user decision. No notification service is set up.

## Maildir archive on the NAS/archive host

App cache is not a mail archive. imapsync is IMAP-to-IMAP, not Maildir. The archive
service uses mbsync/isync and a **separate** `noctua-archive` account on a Linux archive
host with systemd; a NAS without systemd needs its native scheduler running the same
reviewed pull-only command. That scheduler integration is not automated.

Create a private per-mailbox config in `/etc/noctua-archive/mbsyncrc` readable only by
root and `noctua-archive`, private password files readable by that account, and a
writable private NAS volume. Replace the service's `/volume1/noctua-mail-archive`
placeholder if different. All mailbox channels must be reviewed; `-a` runs them all.
Use the installed isync version's TLS syntax; never disable certificate verification.
Repeat this synthetic template once per actual mailbox:

```text
IMAPAccount netcup-mailbox-01
Host <verified-netcup-imap-host>
Port 993
User <actual-login>
PassCmd "cat /etc/noctua-archive/mailbox-01.pass"
TLSType IMAPS
SystemCertificates yes

IMAPStore netcup-01
Account netcup-mailbox-01

MaildirStore archive-01
SubFolders Verbatim
Path /volume1/noctua-mail-archive/mailbox-01/
Inbox /volume1/noctua-mail-archive/mailbox-01/INBOX

Channel mailbox-01
Far :netcup-01:
Near :archive-01:
Patterns *
Create Near
Remove None
Expunge None
Sync Pull New Flags
SyncState *
```

No push, no removals/expunge. Flags may carry Deleted locally but must never remove
local messages. Create directories and protect generation snapshots against writes;
review folder coverage before creating `/etc/noctua-archive/reviewed`. Test remote
deletion only with synthetic mail: archived EML and attachment must remain and open
offline. Take protected NAS generations, at least 12 monthly points plus independent
second/offline media. The unit does not implement NAS snapshots or retention itself.
Preserve MailPlus unchanged for the proposed six months, POP3/sending off; it contains
no new post-cutover mail, so it cannot replace the new archive. Disable only the
archive job to roll it back; never run a bidirectional restore against netcup.

## Restore drill

Use a **dedicated isolated restore VM/host**, never live production. The initial
restic download needs NAS access; restored app startup runs in its own private
network namespace with no external interface. Watcher=0 alone is insufficient.
The sandbox also hides production/config paths, drops capabilities, restricts
address families and grants filesystem writes only to scratch. No copied credentials
may contact netcup/CalDAV. Keep the host clean of production data/services.

Select a full immutable restic snapshot ID privately. The new scratch root must be
under `/srv/noctua-drills/`. A dry run makes no connection:

```sh
/opt/noctua/ops/backup/restic-restore-drill.sh --dry-run '<full-snapshot-id>' /srv/noctua-drills/drill-01
# Later, on the isolated host with private backup env loaded, repeat with:
# --execute <id> <new-dir> --confirm-isolated-host
```

The script runs full `restic check --read-data`, restores, verifies checksums and
safe archive paths, extracts into scratch (never production), rebases **copied**
`accounts.dbPath` values to scratch, and validates SQLite integrity/foreign keys.
Unexpected archive symlinks fail closed and need explicit review; the known Next
cache link is replaced with a scratch cache. It starts matching restored Bun/release
with restored env via the systemd manager (never sourcing/printing keys), overrides
only data path/port/watcher, polls 200/401 inside the private network, and stops its
own transient unit on success/failure. Application stdout/stderr is discarded to
avoid logging capability-bearing diagnostics from restored data. Scratch stays private.

`DRILL_AUTOMATED_RESULT` is **not** full restore acceptance. Privately record snapshot,
release/Bun/key association, duration/RTO and latest event/RPO. Manually verify users,
mailbox counts, roles/owners, audit, prefs, comments/assignments/topics, calendars,
reminders, cached EML/attachments; confirm each actual shard and original path mapping.
TOTP/passkey and both household members need a separately isolated canonical-origin
client setup; this CLI probe does not exercise them. Send/write only against synthetic
fixtures. Document any gap as NO-GO, shut down test environment and secure/delete
private copies under the operator's data policy. Production restore is a separate
manual paired restore, after first preserving the current state.
