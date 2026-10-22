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
BETTER_AUTH_URL=https://mails.monkeymed.de
PASSKEY_RP_ID=mails.monkeymed.de
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

Canonical DNS A is `100.92.134.1` inside the tailnet. Obtain and renew TLS via netcup DNS-01;
keep netcup API credentials in the proxy secret store. No public HTTP challenge is required.
The separate preview `https://remote-arm.tail31b4a1.ts.net:3790` has isolated data/auth/encryption
secrets, its own URL and RP ID `remote-arm.tail31b4a1.ts.net`, preview-only trust and new passkeys.
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
  -e BETTER_AUTH_URL=https://mails.monkeymed.de \
  -e PASSKEY_RP_ID=mails.monkeymed.de \
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
export BETTER_AUTH_URL=https://mails.monkeymed.de
export PASSKEY_RP_ID=mails.monkeymed.de
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
The example binds tailnet IP 100.92.134.1, uses the canonical hostname, overwrites the complete
forwarded-header chain, and disables access logs for all authentication/reset paths. Other access
logs use `$uri` without query strings. Do not enable proxy/debug/body logging for auth traffic.
Provision certificate paths through netcup DNS-01 before starting nginx; the actual netcup plugin
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
compiled smoke and virtual-authenticator suite do not establish live tailnet DNS/TLS, netcup renewal,
physical phone/PWA acceptance or the final application-wide restore. Those remain release gates.
