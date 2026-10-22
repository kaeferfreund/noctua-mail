# Noctua Mail Deployment Reference

Quick reference for deploying Noctua Mail in any environment.

## Prerequisites

### Runtime
- **Bun**

### Infrastructure
- **Persistent storage** for SQLite database and email attachments
- **HTTPS/TLS** for secure connections
- **Network access** to IMAP/SMTP servers

## Required Environment Variables

One Linux/systemd Bun process serves the application behind a loopback reverse proxy.
Better Auth stores auth tables in the master `db/main.db`; keep it with all account shards and keys.
No native desktop mode, sealed-cookie credentials or SMTP recovery delivery is supported.

```sh
BETTER_AUTH_URL=https://mail.example.org
PASSKEY_RP_ID=mail.example.org
BETTER_AUTH_SECRET=<independent-random-secret-at-least-32-characters>
IMAP_SECRET_KEY=<retain-existing-independent-encryption-key>
IMAP_CREDENTIALS_STORAGE=db
BETTER_AUTH_TELEMETRY=0
NOCTUA_DATA_DIR=/srv/noctua/data
PORT=3654
# Leave NOCTUA_TRUSTED_ORIGINS, NOCTUA_IMAP_LOGIN_HOSTS,
# BETTER_AUTH_TELEMETRY_ENDPOINT and NOCTUA_DESKTOP_MODE unset.
```

`db` is the credential default; `both` is a deprecated DB-only alias and `cookie` fails startup.
`NOCTUA_DESKTOP_MODE=true` fails startup. IMAP login is OFF unless an explicit exact host allowlist
is set. `PASSKEY_RP_ID` defaults to the canonical hostname. Additional trusted origins are rejected.
Keep independent random secrets in a root-readable environment file, never in source or logs.
Generate a new auth secret with `openssl rand -hex 32`; retain the existing IMAP key for old data.

Canonical DNS A is `203.0.113.10` inside the tailnet. Obtain and renew TLS via mailprovider DNS-01;
keep mailprovider API credentials in the proxy secret store. No public HTTP challenge is required.
The separate preview `https://preview.example.org:3790` has isolated data/auth/encryption
secrets, its own URL and RP ID `preview.example.org`, preview-only trust and new passkeys.
Never add preview trust to production or claim canonical passkey reuse there.

## Deployment Methods

### Docker (Recommended)

**Build image:**
```bash
docker build -t noctua-mail .
```

Worker subprocesses are started by API routes and execute TypeScript entrypoints from `./scripts` at runtime. In `output: 'standalone'` builds, those files must be included explicitly by Next's trace configuration in [next.config.ts](next.config.ts). Do not rely on incidental file tracing to pull them into `.next/standalone`.

**Verify Docker worker packaging:**
```bash
bun run test:docker-workers
```

This rebuilds the Docker runtime image and confirms that the worker entrypoints resolve inside the container.

**Run container:**
```bash
docker run -d \
  --name noctua-mail \
  -p 127.0.0.1:3654:3654 \
  -v /path/to/data:/app/.data \
  -e BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  -e BETTER_AUTH_URL=https://mail.example.org \
  -e PASSKEY_RP_ID=mail.example.org \
  -e IMAP_CREDENTIALS_STORAGE=db \
  -e BETTER_AUTH_TELEMETRY=0 \
  -e IMAP_SECRET_KEY="your_key_here" \
  noctua-mail
```

### Standalone (Bun)

**Install dependencies:**
```bash
bun install
```

**Build:**
```bash
bun run build
```

**Verify standalone worker packaging:**
```bash
bun run test:standalone-workers
```

This verifies that the standalone output contains the required worker entrypoints and their traced local runtime dependencies.

**Run:**
```bash
export BETTER_AUTH_SECRET="<independent-random-secret>"
export BETTER_AUTH_URL=https://mail.example.org
export PASSKEY_RP_ID=mail.example.org
export BETTER_AUTH_TELEMETRY=0
export IMAP_SECRET_KEY="your_key_here"
export NOCTUA_DATA_DIR="/path/to/data/"
export HOSTNAME=127.0.0.1
export PORT=3654
bun --bun .next/standalone/server.js
```

## Storage Requirements & Architecture

### Database Architecture

Noctua Mail uses a **master + sharded database architecture**:

| Database | Path | Contains | Backup Priority |
|----------|------|----------|----------------|
| **Master DB** | `$NOCTUA_DATA_DIR/db/main.db` | Users, accounts, credentials, control-plane data | **Critical** |
| **Account DBs** | `$NOCTUA_DATA_DIR/db/accounts/<accountId>.db` | Messages, folders, threads, FTS index (per account) | **Critical** |

### Cache Directories (Regenerable)

| Directory | Path | Purpose | Backup Priority |
|-----------|------|---------|----------------|
| **Email sources** | `$NOCTUA_DATA_DIR/sources/<accountId>/` | Raw .eml files (cache) | Optional¹ |
| **Attachments** | `$NOCTUA_DATA_DIR/attachments/<accountId>/` | Binary attachment files (cache) | Optional¹ |

¹ **Cache directories are regenerable** - These files are re-fetched from IMAP servers on demand if missing. You can safely delete them to reclaim space; they'll be recreated automatically when accessed.

### Storage Size Estimates

| Component | Size Estimate |
|-----------|---------------|
| Master DB | ~1-10MB (scales with user/account count) |
| Account DB (per account) | ~10MB per 10k messages + attachments metadata |
| Source cache (per account) | ~1-2KB per message (if cached) |
| Attachment cache (per account) | Varies widely by email usage |

**Minimum:** 1GB storage
**Recommended:** 10GB+ depending on email volume

### WAL Files (Temporary)

SQLite generates temporary files in WAL mode:
- `.db-wal` (Write-Ahead Log)
- `.db-shm` (Shared Memory)

These are auto-managed and should be included in backups if the app is running.

**For complete storage architecture details, see [STORAGE.md](STORAGE.md)**

## Network & Firewall

### Inbound (Application)
- Port 3654 (HTTP) - or your configured `PORT`
- Typically behind reverse proxy (nginx, Caddy, Traefik)

### Outbound (IMAP/SMTP)
- Port 143 (IMAP)
- Port 993 (IMAPS)
- Port 25 (SMTP)
- Port 587 (Submission)
- Port 465 (SMTPS)

## Reverse Proxy

Use [deploy-scripts/nginx-auth.conf](../deploy-scripts/nginx-auth.conf) at the TLS terminator.
The example binds tailnet IP 203.0.113.10, uses the canonical hostname, overwrites the complete
forwarded-header chain, and disables access logs for all authentication/reset paths. Other access
logs use `$uri` without query strings. Do not enable proxy/debug/body logging for auth traffic.
Provision certificate paths through mailprovider DNS-01 before starting nginx; the actual mailprovider plugin
and renewal service are deployment-owner responsibilities, not exercised by the local smoke.
Only the proxy may connect to the loopback backend. With one sanitized proxy hop, Better Auth's
pinned default IP reader takes `x-forwarded-for`; Noctua wrapper limits use `TRUSTED_PROXY_HOPS=1`.
Do not enable dynamic Host-derived auth origins or forward external client headers unchanged.

## Health Checks

**Endpoint:** `GET /api/ba/ok`
**Expected:** HTTP 200 with `{ "ok": true }`

**Docker health check:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3654/api/ba/ok || exit 1
```

## Backup & Restore

See [STORAGE.md](STORAGE.md) for detailed information about which data is stored where.

### What to Backup

**Critical (must backup):**
- Master DB: `db/main.db` (includes all Better Auth identities, encrypted factors and policy sidecars)
- Account DBs: `db/accounts/*.db`
- Independent `BETTER_AUTH_SECRET` and `IMAP_SECRET_KEY`, matching the snapshot

**Optional (regenerable cache):**
- Sources: `sources/` (re-fetched from IMAP on demand)
- Attachments: `attachments/` (re-fetched from IMAP on demand)

### Full Backup (including cache)

```bash
# Stop application (recommended for consistency)
tar czf noctua-backup-$(date +%Y%m%d).tar.gz /path/to/noctua/data/
```

### Database-Only Backup (minimal, excludes cache)

```bash
# Stop application (recommended)
cd /path/to/noctua/data
tar czf noctua-db-backup-$(date +%Y%m%d).tar.gz \
  db/
```

**Cache directories (`sources/`, `attachments/`) are excluded** - they'll be regenerated from IMAP.

### Restore

```bash
# Stop application
# Extract backup
tar xzf noctua-backup-20260211.tar.gz -C /path/to/noctua/data/
# Start application
```

### Important Notes

- **Consistency:** Stop the process and checkpoint/close every SQLite handle before copying master and shards together. Copying live WAL files is not a cross-database snapshot. Restore the same auth/encryption secrets privately; missing keys make mailbox credentials and TOTP/backup codes unusable.
- **Cache regeneration:** Missing `sources/` or `attachments/` files are automatically re-downloaded from IMAP servers when needed.
- **Space savings:** Database-only backups are much smaller (excludes potentially large attachment cache).
- **IMAP requirement:** Cache regeneration requires IMAP access. Ensure credentials are valid before restoring database-only backups.

## Background mailbox watcher (team deployments)

The sync worker admission cap (default **2**) and SPECIAL-USE Sent detection apply universally,
including when the watcher is disabled. The browser SSE route now uses the extracted shared
IDLE implementation in `lib/mail/imap/idle.ts`; a tagged NO closes the connection and enters
its existing reconnect policy. Summary timestamps also update after ordinary successful syncs.

The watcher is **off by default**. Enable it on one long-lived Bun server process:

```sh
IMAP_CREDENTIALS_STORAGE=db
NOCTUA_MAILBOX_WATCHER=1
NOCTUA_MAX_SYNC_WORKERS=2
NOCTUA_WATCHER_INTERVAL_MS=300000
```

`IMAP_SECRET_KEY` must decrypt the stored mailbox passwords. Cookie-only credential storage
cannot run the watcher; the startup gate calls `teamFeaturesSupported()` (currently a local
`shouldStorePasswordInDb()` seam accepting `db` or `both`; feat/team-auth replaces it with its
supported-runtime predicate) and requires the exact `NOCTUA_MAILBOX_WATCHER=1` opt-in. The watcher reads the master DB
without the browser credential overlay. Prefer `db` for team deployments.

| Variable | Default | Meaning |
|---|---|---|
| `NOCTUA_MAILBOX_WATCHER` | unset (off) | Exactly `1` enables the watcher; a durable master-DB lease selects one scheduler across module graphs/processes on the same host. |
| `NOCTUA_WATCHER_INTERVAL_MS` | `300000` | Fallback check interval per account, in milliseconds. EXISTS, EXPUNGE and flag events also request a check. |
| `NOCTUA_WATCHER_ACCOUNTS_INTERVAL_MS` | `30000` | Master-account poll interval. Additions, removals and changes to the IMAP endpoint/user/password are detected without a restart. |
| `NOCTUA_MAX_SYNC_WORKERS` | `2` | Maximum simultaneous sync subprocesses across accounts and module graphs sharing the master DB on one host. One worker per account still applies. Interactive new/recent sync precedes watcher work, then repair/full sweeps; ties are FIFO. After eight admission bypasses, older waiting work takes precedence. Running workers are not preempted. |
| `NOCTUA_SYNC_WORKER_TIMEOUT_MS` | `600000` | Worker execution deadline. Expiry sends SIGKILL to that owned child and awaits child.exited before releasing capacity or promoting work. Output draining has its own 2-second bound after exit. |

Intervals, capacity and deadlines must be positive integers; invalid values use the defaults.
Jobs waiting for the global budget are reported as `status: "queued"` through the existing
sync status endpoint, so the process panel can display the wait.

Each account keeps **one read-only INBOX IDLE connection**, with no background IDLE connection
per folder. Initial INBOX sync downloads existing mail. Each check reconciles INBOX UIDs/flags
(including deletions and old unread messages), then uses the existing all-folder new-mail planner.
Other folders retain the planner's upstream baseline behavior: an unsynced folder starts at its
current UIDNEXT. Import historical Sent/other-folder mail with an explicit full sync before cut-over.
A new remote folder is discovered when the INBOX reconciliation refreshes the folder list.

Reconnects after a failed/disconnected IDLE session are limited to one attempt per minute per
account, backing off exponentially to 30 minutes. An open connection breaker can extend the wait.
Authentication failures suspend reconnects for that stored IMAP identity, including across watcher
restarts. Updating the stored host/port/user/password restarts that account and clears its breaker;
operators can also call `watcher.retryAccount(accountId)` for one explicit retry. State transitions
are logged without credentials. `NOCTUA_WATCHER_RECONNECT_MIN_MS` defaults to `60000`; the synthetic
proof shortens it to `150` and counts wire authentication commands across multiple retry windows.
Watcher workers disable their own rapid connection/job retries; the watcher owns their retry schedule.
Event bursts are coalesced per account, and checks never overlap for the same watcher.
SIGTERM/SIGINT abort the loops and connections and cancel watcher-owned queued/running workers;
workers joined by an interactive caller continue under the normal server lifecycle.

### Connection and memory sizing

For roughly 12 accounts, budget 12 persistent IDLE connections plus up to 2 sync workers by
default. Watcher folder checks reuse their IDLE connection for STATUS. Interactive operations can
add a pooled connection (cached for up to 60 seconds), and browser SSE streams retain their
existing INBOX/active-folder IDLE sessions. The worker cap limits subprocesses, not all IMAP sockets or other recompute workers.
Use one host/PID namespace and one shared master DB. Master `sync_worker_leases` reserves slots
atomically through `withDbWriteRetry`, records owner and child PIDs and heartbeats every five
seconds. Queued jobs have no child process. The durable queue bounds priority bypasses at eight;
`mailbox_watcher_lease` selects and heartbeats the scheduler before any IDLE opens. A live owner
cannot be displaced by expiry alone. Restart recovery reclaims worker slots only after proving
both the recorded owner and child exited (ESRCH; unknown/permission errors retain the lease).
Children bind their durable ticket before sync work, closing the parent-spawn crash window.
Shutdown/timeout only signal owned child PIDs and wait for confirmed exit. These local-PID leases
are not a distributed multi-host scheduler. Browser invalidation events remain process-local.

**MailProvider sizing assumption:** the mailbox plan permits a handful of concurrent IMAP connections
per mailbox. This is an assumption to verify against the actual hosting plan before go-live, not
a provider-guaranteed limit. A mailbox can need one watcher, one pooled connection and one worker,
plus the sessions of any open browser tabs or other mail clients. Start with
`NOCTUA_MAX_SYNC_WORKERS=1` on a small host, increase `NOCTUA_WATCHER_INTERVAL_MS` to reduce
polling/worker activity, and lower the existing account/browser `settings.sync.maxIdleSessions`
(minimum INBOX/active-folder behavior still applies). Limit duplicate tabs and other IMAP clients.
If the plan cannot accommodate this footprint, turn the watcher off while adjusting the deployment.
One worker can use substantial memory while parsing attachments; size RAM from representative
mail and leave room for Bun/Next and SQLite caches. Twelve mailboxes do not imply twelve workers.

### Summary and event integration

`GET /api/accounts/summary` returns `{ accounts: [{ accountId, unreadInbox, lastSyncAt,
watcherState }] }` with `Cache-Control: no-store`. It requires the existing session helper and
currently returns only the session's active account, or an empty list without a selected account.
The async-compatible guard is awaited and its response headers (including renewed cookies) are
propagated. Account enumeration goes through the single `summaryAccountIds` seam. `lastSyncAt` is Unix milliseconds (null until
a successful sync); unread counts exclude deleted rows and use a partial index in each shard.
`watcherState` is `disabled`, `starting`, `idling`, `backoff`, `auth_failed` or `stopped`.
The last sync time and watcher state survive process restarts in `mailbox_summary`; startup
refreshes live states. After an unclean crash, the stored state may describe the last process
until the server restarts. With the watcher disabled, summaries always report `disabled`.

`getMailboxSummaries(accountIds)` never enumerates mailboxes: callers must pass authorized ids.
feat/team-auth will replace the guard import with `requireActiveUserSession` and the supported
runtime gate. feat/collab-ui owns the canonical `/api/me/mailboxes/summary` route using
`listAccessibleAccountsForUser`, plus assigned-to-me and unassigned-open counts; this transitional
route does **not** complete v5 go-live fit item 14. `subscribeMailboxEvents(listener)` in `lib/mailboxWatcherEvents.ts` returns
an unsubscribe function and emits `{ accountId, type: "state", watcherState }` or
`{ accountId, type: "synced" }` after a successful check. It is a process-local invalidation feed,
not a per-user SSE endpoint or message notification payload. The future collaboration event
route must authorize account membership before forwarding it, then re-read summaries/messages.
No browser UI or per-user counts are added here.

### Synthetic integration proof

`bun test lib/mailboxWatcher.integration.test.ts` requires the synthetic fixture (never skips).
It prefers this tree's `scripts/dev-fixture/imap-server.ts`, falling back to
`../repo/scripts/dev-fixture/imap-server.ts` while this branch waits for the merged fixture.
It automatically starts its IMAP/control servers
on **OS-assigned ephemeral ports**, uses an isolated temporary `NOCTUA_DATA_DIR`, bootstraps 60 synthetic INBOX
messages, injects one message during IDLE, and checks ingestion within five seconds, unread
counts, flag/EXPUNGE reconciliation, periodic Sent checks, credential reload/auth
backoff/recovery, account addition/removal, events and shutdown.
The selected ports are read from fixture startup output. No external IMAP service or real data is used.

Set `NOCTUA_TEST_IMAP_FIXTURE=/absolute/path/to/scripts/dev-fixture/imap-server.ts` to use another
fixture checkout. A missing fixture fails the integration test. The proof also resets UIDVALIDITY,
reuses UID 61 with different content, proves independent-graph scheduler ownership/takeover, and
observes durable auth suspension/retry/recovery. `lib/processLeases.integration.test.ts` starts
four independent admission processes and proves restart/orphan recovery, the eight-bypass
starvation bound, confirmed-exit failure and scheduler takeover. The standalone proof is also available as
`bun scripts/verifyMailboxWatcher.ts /absolute/path/to/scripts/dev-fixture/imap-server.ts`.

For a manual proof with fixed ports, set the test-only `NOCTUA_TEST_IMAP_PORT` and
`NOCTUA_TEST_CONTROL_PORT` (both default to `0`, meaning OS-assigned). For example:
`NOCTUA_TEST_IMAP_PORT=3799 NOCTUA_TEST_CONTROL_PORT=3798 bun scripts/verifyMailboxWatcher.ts /absolute/path/to/scripts/dev-fixture/imap-server.ts`.

## Migration and recovery

Stop the service, make a consistent master/shard/key backup, and follow the explicit identity
manifest and two-run procedure in [AUTHENTICATION.md](AUTHENTICATION.md#slice-6-contract-changes).
Recovery links are handed over personally and printed once only in a private operator terminal.
No SMTP delivery is configured. The local synthetic restore smoke covers auth IDs/factors and a
shard/key snapshot; application-wide restore acceptance stays Stage 4 in TEAM-INBOX.md §11.

## Integrated authentication readiness

The auth/admin UI and policy-controlled public backend are integrated. Migration and recovery
both hold the shared operator lifetime lock; follow the [offline runbook](AUTHENTICATION.md#offline-migration-and-bootstrap-runbook),
including stopped service, consistent backup and personally verified handover. The build, local
compiled smoke and virtual-authenticator suite do not establish live tailnet DNS/TLS, mailprovider renewal,
physical phone/PWA acceptance or the final application-wide restore. Those remain release gates.
