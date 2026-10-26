# Team Inbox: Better Auth, mailbox roles, shared-inbox collaboration, new shell

Design document for the `kaeferfreund/noctua-mail` fork. It is the single source of truth for the
implementation branches listed in §9. Everything not mentioned here stays as upstream.

Status: design v5, resolved and promoted, 2026-10-22. Reviewed against Better Auth 1.7.12 at spike commit `98f04ad`. Replaces the auth design in v2 following the user's decision
“halt wir sollten doch better auth nutzen” / “weil dann können wir passkeys und 2fa nutzen”.
The verified spike is `spike/better-auth`, report `doc/SPIKE-BETTER-AUTH.md`; named tests in that
report are implementation evidence, while application policy below is work to implement.
Inputs include the complete fit report (§2 items 1–18, §3 and §5), all three independent
Better Auth reviews, and `doc/TEAM-AUTH-REVIEW-LOG.md` (S1–S8, F1–F10, I1–I11).
This is an implementation contract, not a claim that the spike implements production policy.

### v3 → v4 changelog

- Added per-session assurance, verified-record MFA checks, preserved authentication age and stream revocation.
- Made credential mirroring and security generations transactional with SQLite triggers.
- Bound pending login challenges and fresh-proof grants to generations; blocked raw credential bypasses.
- Specified operation-specific password/factor proofs and complete backup-code TOTP replacement.
- Defined reset issuance, public callback/redemption, no-SMTP handover and client ownership.
- Moved invite authority checks before network work; limited journal uniqueness to active operations.
- Defined persisted default mailbox selection, role-aware repair errors and bodyless logout.
- Added all 18 go-live criteria, watcher/worker ownership, Sent reliability and Stage 4 cut-over.
- Replanned seven buildable slices; assigned browser WebAuthn harness and full phone/PWA acceptance.

### v4 → v5 changelog

- Applied the user's final decisions of 2026-10-22; rejected alternatives are recorded in Appendix A.
- Fixed the canonical tailnet HTTPS origin/RP ID and DNS-01 deployment contract (§8).
- Carried over feat/ui-shell commit `ba9d34a`: radix-nova, gray/iris tokens, inset dashboard layout
  and frame-only ownership; retained the reviewed Better Auth contracts and seven-slice sequence.

Decided: D13 — TOTP enrollment is mandatory for every user before any mailbox access; UV passkeys provide convenient login and backup codes provide recovery (user, 2026-10-22).

Decided: D3 — implement personal-mailbox IMAP first factor, OFF by default, enabled only by `NOCTUA_IMAP_LOGIN_HOSTS`, never for shared mailboxes (user, 2026-10-22).

Decided: D2 — encrypted DB-only mailbox credentials; cookie-only mode is dropped; `both` remains only a deprecated alias for `db` (user, 2026-10-22).

Decided: D15 — Tauri/desktop mode is dropped and unsupported; startup rejects it and signup has no desktop invite exemption (user, 2026-10-22).

Decided: D17 — admin issues a short-lived single-use reset link and hands it over personally; SMTP recovery delivery is a non-goal for this stage (user, 2026-10-22).

Decided: canonical HTTPS origin is `https://mail.example.org`, RP ID `mail.example.org`, DNS A `<tailnet-ip>`, TLS via the DNS provider's API (DNS-01); the preview stays separate (§8) (user, 2026-10-22).

## 1. Goals and non-goals

Goals

1. Personal login through Better Auth 1.7.12: e-mail + app password + TOTP (backup codes for
   recovery), or a passkey with authenticator user verification. Both people must complete TOTP
   enrollment before accessing mail. Optional IMAP-password login is OFF by default, proves only the
   person's eligible login mailbox and uses the same TOTP challenge (§4.2). Shared mailbox credentials never identify
   a person. IMAP/SMTP credentials remain encrypted mailbox configuration in the master DB.
2. Mailbox roles. A mailbox (Noctua `Account`) can be shared with several users. Each membership
   carries a role: `viewer`, `editor`, `manager`. Admins manage users and mailboxes.
3. Shared-inbox collaboration per conversation (thread): assignee, status, internal comments, and an
   activity log. "Read" (IMAP `\Seen`) and "closed" (collaboration status) stay independent.
4. A new application shell built with shadcn/ui + Tailwind v4: sidebar, header, list, reading pane,
   settings, login, and a real mobile layout. The existing message rendering, compose editor, and
   calendar remain and inherit the new theme through token aliases.
5. The collaboration features are exposed through REST and through the existing MCP endpoint.

Non-goals (for now)

- Per-user read state. `\Seen` stays shared IMAP state, as it is in every IMAP client.
- OAuth for MCP clients. Bearer tokens stay; per-token mailbox sets and read/drafts/manage/send scopes are enforced (see doc/API.md).
- Unified multi-account inbox. One mailbox is active at a time; the sidebar switches between them.
- Replacing Radix Themes inside the kept components. They keep working under the new tokens.
- Tauri/desktop mode is removed and unsupported. Startup rejects it (§8); no desktop carve-outs remain.
- SMTP delivery of onboarding or password-reset messages. Admin hands links over personally; mailbox
  SMTP sending/replying remains part of the mail client and is unaffected by this recovery non-goal.
- Social/OAuth login, organizations, email/SMS OTP and passwordless invite registration. They are
  unnecessary for this two-person installation. MCP OAuth is also outside this auth change.

### 1.1 Go-live criteria (MailPlus replacement)

This release replaces Synology MailPlus for two people, about twelve mailboxes at the mail provider including
eight shared ones. “Auth merged” is not “ready to cut over”. Each fit-report §2 item has one
accountable owner below; §9 gives files/dependencies. Shared `\Seen` is intentional; collaboration
status tracks work independently. Topics are local, not an IMAP label migration.

| Fit item | Required acceptance | Owner / stage |
|---|---|---|
| 1 | One-member admin-created mailbox is `shared=false`; ownership remains explicit | team-auth / 1 |
| 2 | Stable display-name/e-mail/id order; domain grouping, e-mail tooltip/secondary line, badge slot | ui-shell (team-auth sorted payload) / 1 |
| 3 | Existing mailbox returns 409 before network/invite reservation; no takeover | team-auth / 1 |
| 4 | New credentials require fresh purpose-bound proof, including direct HTTP paths | team-auth / 1 |
| 5 | Empty users never cause IMAP bootstrap; admin invite only | team-auth / 1 |
| 6 | Credential repair follows SMTP coupling rule through every entry point | team-auth / 1 |
| 7 | Account-wide “check all folders” action survives shell replacement | ui-shell / 1 |
| 8 | From row appears in inline and modal compose, including mobile | ui-shell / 1 |
| 9 | This criteria table, explicit owners and Stage 4 runbook sign-off exist | integration/deploy owner / 4 |
| 10 | Installed PWA on iOS Safari and Android Chrome: login, switch, read, reply, camera attachment | ui-shell / 1; deployment recheck / 4 |
| 11 | Inactive mailboxes refresh server-side; bounded workers and measured provider backoff | mailbox-watcher / 2 |
| 12 | Direct/draft/calendar send reports Sent-copy outcome, ingests copy, sets answered/forwarded state; B sees A's reply | thread-collaboration / 2 |
| 13 | Sent detection prefers SPECIAL-USE `\Sent`, tested restricted name fallback; exactly one intended Sent folder | thread-collaboration / 2 |
| 14 | User-scoped mailbox unread/assigned/open summaries and per-user SSE badges, fed by watcher | collab-ui / 3 |
| 15 | Effective personal/team default signature auto-inserts for new/reply/forward, never reopened drafts; both compose entry points | collab-ui / 3 |
| 16 | Inventory resolves aliases; if any must send as aliases, identities + own-address helper ship before cut-over | sender-identities / 3 (conditional, inventory records decision) |
| 17 | Address/role inventory, POP3 shutdown, capability/limit checks, import/full-sync/count and functional verification | integration/deploy owner / 4, §11 |
| 18 | Consistent application backup + offline keys + independent mail archive restored successfully in isolation | integration/deploy owner / 4, §11 |

The operator confirms UI language (English accepted or translation budgeted), calendar of record,
and whether Synology Contacts stays in use. External mail-provider limits/capabilities and MailPlus shared
folder layout must be measured; the fit report's estimates are not release evidence.

## 2. Architecture decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Better Auth 1.7.12 and @better-auth/passkey 1.7.12, pinned exactly. `lib/betterAuth.ts` configures `emailAndPassword`, `twoFactor`, `admin`, `passkey`, and last `nextCookies()`. Passwords use `Bun.password` argon2id through `emailAndPassword.password.{hash,verify}`; length 10..256 via Better Auth options. | Passkeys, TOTP, backup codes and revocable sessions justify the dependency. The standalone custom password stack is retired. Admin createUser needs an explicit minimum-length check (§4.3), as the spike proves. |
| D2 | DB mailbox credential storage is required throughout this fork. `db` is the default; `both` is accepted as a deprecated alias for `db`. Startup rejects `cookie`. Sessions and MCP tokens carry no IMAP/SMTP passwords; remove the global credential overlay. | Shared mailboxes and server-side sync require encrypted credentials accessible without a browser. A second sealed credential cookie would preserve the unsafe overlay and cannot feed workers. |
| D3 | Keep optional IMAP-password first factor at `/api/ba/sign-in/imap`, OFF by default, enabled only by a nonempty explicit `NOCTUA_IMAP_LOGIN_HOSTS` allowlist. Never use shared mailboxes. Apply the strict personal login-mailbox rule in §4.2 and the twoFactor after-hook bridge proven by the spike. Every admin must retain an app-password fallback and offline recovery codes. | The spike proves custom endpoint + TOTP, including the HTTP no-session-before-TOTP invariant. Hook reuse is version-coupled, so exact pins and upgrade tests are required. Shared-mailbox login is forbidden. |
| D4 | Authorization is membership based. `requireAccountContext` obtains the Better Auth user asynchronously, resolves mailbox membership, and enforces a minimum role per route. Active mailbox is only a UI preference on the session. | A user may act on any mailbox they have access to. Switching a mailbox changes the selection without changing authorization. |
| D5 | Use DB sessions in `auth_session`, signed opaque session-token cookies, `cookieCache.enabled:false`, and explicit revocation. Ban/disable maps to admin-plugin `banUser`, plus MCP-token deletion. Use the reviewed password wrapper, credential-generation triggers and explicit session revocation on changes/resets. All admin mutations are audited. | Ban deletes existing sessions and blocks new ones; the spike tests both. A database read on each guard makes revocation immediate. No timestamp comparison in a custom cookie is needed. |
| D6 | Better Auth `auth_user.role` is authoritative for `admin`/`user`; `users.role` is its one-way compatibility mirror. Noctua `/api/admin/*` services wrap admin-plugin APIs with last-admin rules, audit and mailbox-independent permissions. Remove impersonation permission and disable its HTTP paths. | Admin manages users/mailboxes but has no implicit access to mail. Raw plugin admin endpoints must not bypass Noctua policy (§4.5). |
| D7 | Collaboration state lives in the per-account shard DB, keyed by `(accountId, threadId)`. Rows are remapped whenever a message's `threadId` changes (sync upsert, resync, recompute) and are never pruned. All mutations are single immediate SQLite transactions with upserts. | Same key as `thread_topics`, `thread:` search, and MCP thread addressing. `EXISTS` joins on `messages.threadId` work without `ATTACH`. Accounts can share one shard file, so `accountId` is part of every key. |
| D8 | Collaboration status values: `open`, `in_progress`, `waiting`, `closed`. Never `done`. | Upstream has per-message `$Todo`/`$Done` keywords labelled "Mark as Done". |
| D9 | Per-user UI preferences per mailbox move to `user_account_prefs` (master DB, sparse deep-merge). Theme stays a device preference (next-themes, localStorage). | `AccountSettings` mixes team config with personal UI prefs; shared mailboxes need the split. One source of truth per preference. |
| D10 | UI: shadcn/ui (style `radix-nova`, base `neutral`, CSS variables) + Tailwind v4 without preflight + next-themes. Radix Themes stays loaded for kept components, imported into a CSS cascade layer. | Incremental migration. Preflight would strip list bullets, heading sizes and inline SVG layout from the editor and markdown surfaces. |
| D11 | Mobile: below `md` the shell shows one pane at a time, derived from `viewMessage` (not from taps), with both panes kept mounted and CSS-hidden. Compose is always a full-screen modal on mobile. | Deep links, notices and reminders also set `viewMessage`; unmounting panes loses the virtualization and scroll refs. |
| D12 | Every new route and DB module gets adjacent bun tests. Reuse `lib/testDbHarness.ts` and a shared `lib/testAuthHarness.ts` that creates real auth users, sessions and memberships. Mock wrapper seams only. Concurrency cases run with `bun run test:stress`. | Synthetic data and shared helpers follow AGENTS.md. Cookies are issued by Better Auth rather than reimplementing their signing format. |
| D13 | TOTP enrollment is mandatory for every user (including admins and passkey users); an app password alone reaches only enrollment. Passkey login is a full login only with `userVerified === true`. Do not offer “trust this device”; reject `trustDevice:true` server-side. | Both people have consistent recovery and a provider-independent fallback. Better Auth has no built-in mandatory-MFA switch; Noctua enforces the gate (§4.1/§4.4). |
| D14 | Separate `auth_user`, `auth_session`, `auth_account`, `auth_verification`, `auth_two_factor`, `auth_passkey` tables in the master DB; `auth_user.id === users.id`. Mount at `/api/ba`; keep Noctua `/api/auth/me`, `/signup`, `/logout`, `/switch-account` wrappers. | Tests reject direct mapping onto populated `users` and demonstrate ISO-date incompatibility even on an empty table. `/api/auth` already belongs to Noctua routes. |
| D15 | This fork targets one Linux/systemd Next.js process at `https://mail.example.org`, RP ID `mail.example.org`, reachable inside the tailnet only. Tauri/desktop mode is dropped; startup rejects it. | The deployment uses DNS A `<tailnet-ip>` and DNS-01 TLS via the DNS provider's API (§8); desktop origin/secret/invite exceptions are removed. |
| D16 | Dedicated Better Auth SQLite connection to the same master file, with zero synchronous busy timeout on both master writers and Noctua async write retries. | Shared-handle rollback and separate-handle retry tests demonstrate why. Keep auth transaction hooks free of network I/O; never retry an entire non-idempotent auth request automatically (§3.1). |
| D17 | Admin issues a 15-minute single-use password-reset link and hands it over personally; a local operator command uses the same restricted issuance policy. No SMTP recovery delivery or public reset-request issuance in this stage. | Public token redemption remains available; MFA survives password reset (§4.4). |

Superseded from v2: `lib/passwords.ts` as an independent auth API, `users.passwordHash`,
`passwordUpdatedAt` / cookie `iat` liveness, `mustChangePassword`, the AES-sealed `noctua_session`
cookie, and `SESSION_SEAL_KEY` provisioning (including removed desktop generation). Better Auth owns password
hash storage, signed session cookies and session revocation. Forced temporary-password changes are
unnecessary because invites/recovery let the person choose their password. The separate MFA
enrollment/re-authentication gate remains Noctua policy; Better Auth does not provide it automatically.
Old MCP tokens are invalidated at cutover and replaced by opaque random tokens (§4.7); no seal key is
retained solely for them. IMAP at-rest encryption still requires `IMAP_SECRET_KEY`.

## 3. Data model

Noctua DDL is additive; Better Auth schema is generated programmatically after it (§3.1). Use the existing idioms: `CREATE TABLE IF NOT EXISTS`, `PRAGMA table_info` +
`ALTER TABLE ADD COLUMN`. Pre-auth master DDL goes in `initMasterSchema`; auth-dependent sidecars/triggers are installed
by `installAuthControlPlane` after Better Auth migrations (§3.1.1). Shard tables are created in
`initAccountSchema` (not only in a runtime guard), with an `ensureThreadCollabRuntimeSchema` for
later column additions (see `ensureTopicRuntimeSchema`). The `ALTER` block of each migration runs
inside `db.transaction(() => { /* re-read PRAGMA table_info here */ }).immediate()` and tolerates
`duplicate column name` errors (CLI scripts can race a server restart).

### 3.1 Master DB (`mail.db`)

```sql
-- users retains id TEXT PK, email TEXT UNIQUE, role TEXT, createdAt INTEGER (unix ms).
-- No new auth fields on users. auth_user is authoritative; id/email/role mirror one way.
-- Better Auth tables are created by getMigrations(noctuaAuthOptions(config)).runMigrations().
-- auth_user: id, name, email, emailVerified, image, createdAt, updatedAt,
--            role, banned, banReason, banExpires, twoFactorEnabled
-- auth_session: id, userId, token, expiresAt, createdAt, updatedAt, ipAddress, userAgent,
--               impersonatedBy (unused), activeAccountId (nullable TEXT)
-- auth_account: credential/provider accounts, NOT Noctua mailboxes; password hash for
--               providerId='credential', accountId=user.id, userId=user.id
-- auth_verification: short-lived challenges/recovery values
-- auth_two_factor: encrypted TOTP secret/backupCodes, userId, verified, lockout fields
-- auth_passkey: credentialID, publicKey, counter, userId, metadata
-- Better Auth dates are ISO text in SQLite date columns; booleans are INTEGER 0/1.

-- Optional e-mail binding for targeted invites; existing generic invite codes remain valid.
ALTER TABLE invite_codes ADD COLUMN email TEXT;

-- Noctua-owned invite/recovery saga state, separate from plugin-owned tables.
CREATE TABLE IF NOT EXISTS user_provisioning (
  id TEXT PRIMARY KEY,                    -- operation id / idempotency key
  userId TEXT NOT NULL,
  normalizedEmail TEXT NOT NULL,
  inviteCode TEXT,
  kind TEXT NOT NULL,                     -- signup | migration | recovery
  state TEXT NOT NULL,                    -- reserved | auth_created | complete | cleanup_required | cancelled
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_provisioning_active_email
  ON user_provisioning(normalizedEmail)
  WHERE state IN ('reserved','auth_created','cleanup_required');

-- Serialize administrator role/disable/delete and per-user security operations across awaits.
CREATE TABLE IF NOT EXISTS admin_lifecycle_operations (
  id TEXT PRIMARY KEY,
  slot TEXT UNIQUE,                       -- 'admin-lifecycle' or 'security:<userId>'; NULL when done
  actorUserId TEXT NOT NULL,
  targetUserId TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,                           -- secret-free intent for retry/reconciliation
  state TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_reauth_grants (
  tokenHash TEXT PRIMARY KEY,             -- one-use random capability, never plaintext at rest
  userId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  purpose TEXT NOT NULL,                  -- operation-specific purposes in §4.4
  generation INTEGER NOT NULL,
  challengeId TEXT,                       -- reserved WebAuthn ceremony, if any
  state TEXT NOT NULL DEFAULT 'issued',    -- issued | reserved (delete on consumption)
  expiresAt INTEGER NOT NULL              -- unix ms, at most five minutes
);

-- user_accounts: membership role
ALTER TABLE user_accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'manager';  -- existing links were self-created
ALTER TABLE user_accounts ADD COLUMN grantedByUserId TEXT;
ALTER TABLE user_accounts ADD COLUMN grantedAt INTEGER;
CREATE INDEX IF NOT EXISTS idx_user_accounts_account ON user_accounts(accountId);

-- per-user UI preferences per mailbox (sparse JSON)
CREATE TABLE IF NOT EXISTS user_account_prefs (
  userId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  prefs TEXT NOT NULL,
  updatedAt INTEGER NOT NULL,
  PRIMARY KEY (userId, accountId)
);

-- admin audit trail
CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  actorUserId TEXT NOT NULL,
  action TEXT NOT NULL,          -- user.create | user.update | user.disable | user.enable | user.delete | user.password_reset
                                 -- | user.mfa_reset | user.passkey_remove | user.sessions_revoke | user.recovery_issue
                                 -- | account.create | account.delete | member.grant | member.update | member.revoke
  targetUserId TEXT,
  targetAccountId TEXT,
  payload TEXT,                  -- JSON, never contains secrets
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit(createdAt DESC);

-- mcp_tokens: reserved, not enforced in v1 (NULL = legacy behaviour)
ALTER TABLE mcp_tokens ADD COLUMN scopes TEXT;
```

E-mail normalisation migration (runs once, before any index work):

1. `UPDATE users SET email = lower(trim(email))` is attempted per row inside the transaction; a row
   whose lowercased value collides with another row is left as is.
2. `SELECT lower(trim(email)) AS k, COUNT(*) n FROM users GROUP BY k HAVING n > 1`. If empty:
   `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email))`. Otherwise log
   the duplicates with ids and create a non-unique `idx_users_email_lower`; uniqueness is then
   enforced by `insertUser` / admin create (409) until an admin resolves the duplicates.
3. Startup must never fail because of this migration.

Rules

- `users.email` is stored lowercased and trimmed from now on. Lookups use `lower(email)`.
- The DELETE-all savers (`saveUsers`, `saveUserAccounts`) are removed; `saveAccounts` and
  `saveInviteCodes` stay for existing callers but are not used by new code. Signup is rewritten to
  single-row writes. The asynchronous Better Auth operations use the recoverable provisioning
  flow in §4.3; never hold a synchronous Noctua transaction open across an await.
- `addUserAccountLink(userId, accountId, role = 'manager')` becomes
  `INSERT ... ON CONFLICT(userId, accountId) DO NOTHING` (never resets a role). Role changes go
  only through `setUserAccountRole(userId, accountId, role, grantedByUserId)` (`DO UPDATE`).
- `User` is an explicit client DTO, never a spread of an auth row: `{ id, email, name, role,
  createdAt, hasPassword, twoFactorEnabled, passkeyCount, disabled }`. Name and auth status come
  from `auth_user`; `disabled` means an active ban; `createdAt` remains Noctua unix ms.
  `hasPassword` is `EXISTS auth_account WHERE providerId='credential' AND password IS NOT NULL`,
  never a selected hash. Public mailbox member DTOs omit security fields.
- Revise slice 1 (`6fee1b8`): stop adding/reading its password/forced-change/disable/name columns.
  Existing development columns may remain inert; migrate any real disabled state to a permanent
  Better Auth ban before serving requests. Name comes from auth_user, not two writable copies.
- Migration explicitly preserves existing user IDs and role. A public invite cannot claim an
  existing users e-mail. Only the operator migration command may create its auth_user identity;
  ambiguous normalized e-mails block that identity's activation (§8).
- Better Auth owns its schema: run `initMasterSchema` → `migrateAuthSchema(options)` →
  `betterAuth(options)`, before request handling, in `instrumentation.ts`. Its additive migrations
  are idempotent on the second start (named spike test). Keep schema validation on; review generated
  DDL on every pinned upgrade instead of maintaining duplicate hand-written auth DDL.
- Better Auth holds a dedicated connection to the same `db/main.db` (the existing runtime path;
  “mail.db” here means the master logical DB). Configure WAL + foreign_keys on both connections.
  Both master writers use `PRAGMA busy_timeout=0` once auth starts: otherwise the synchronous
  Noctua handle can block the event loop while waiting for an async auth transaction on the other
  handle to commit. Retain `withDbWriteRetry` on every Noctua write and retry only the whole
  synchronous Noctua transaction. On Better Auth contention, fail the operation explicitly and
  reconcile provisioning state; do not replay a whole auth request after possible partial success.
  All local Noctua master writes must use the existing retry helper. Shard timeout behaviour stays.
  Never perform IMAP/SMTP or other network calls inside database hooks/SQLite transactions.
  Reuse the spike's connection/rollback tests and add concurrent real-flow stress checks (§10).
- Profile mirroring uses SQLite triggers installed after auth migrations (§3.1.1), not raw SQL in
  queued `databaseHooks.user.*.after`. The spike hooks are a rejected prototype to replace.
- Audit every master `.run`/`.exec` write outside migrations: particularly the lazy
  `resolveAccountDbPath` backfill in `lib/db/connection.ts`. Put its conditional UPDATE and re-read
  inside `withDbWriteRetry`; a concurrently populated nonblank path wins. Include a blank legacy
  dbPath under a held auth-writer test. Do not change shard busy timeouts.
- Membership role resolution for `(userId, accountId)`:
  `accounts.ownerUserId === userId` → `manager`; else `user_accounts.role`; else no access.
  Roles are ordered `viewer < editor < manager`.
- `mergeAccount` (lib/db/rowParsers.ts) whitelists patchable fields. `id`, `ownerUserId`, `dbPath`,
  and `email` can never be patched from a request body. Blank `imap.password`/`smtp.password`
  means "unchanged" (clients receive blanked secrets).

### 3.1.1 Transactional profile mirror

`lib/db/authPolicy.ts` exports `installAuthControlPlane(db)`; call it on a startup-only handle
between `migrateAuthSchema(noctuaAuthOptions(config))` and `betterAuth(options)`, before serving.
It creates Noctua-owned sidecars and versioned triggers in one immediate transaction. Install on
both instrumentation and route-graph startup idempotently; upgrades compare `sqlite_master.sql`
against expected definitions and replace changed triggers transactionally. Fail startup if absent,
malformed or backfill fails. Auth DDL still belongs to Better Auth.

Core mirror definitions (exact SQL behavior; production tests use actual generated auth tables):

```sql
CREATE TRIGGER noctua_user_insert AFTER INSERT ON auth_user BEGIN
  INSERT INTO users(id,email,role,createdAt)
  VALUES(NEW.id,lower(trim(NEW.email)),CASE WHEN NEW.role='admin' THEN 'admin' ELSE 'user' END,
    CAST(round((julianday(NEW.createdAt)-2440587.5)*86400000) AS INTEGER))
  ON CONFLICT(id) DO UPDATE SET email=excluded.email,role=excluded.role;
  INSERT INTO auth_security_state(userId,generation) VALUES(NEW.id,0);
END;
CREATE TRIGGER noctua_user_update AFTER UPDATE OF email,role ON auth_user BEGIN
  UPDATE users SET email=lower(trim(NEW.email)),
    role=CASE WHEN NEW.role='admin' THEN 'admin' ELSE 'user' END WHERE id=NEW.id;
END;
```

Create `auth_security_state` before these triggers. Backfill existing auth rows with the same
upsert preserving existing `users.createdAt`; reject ID/e-mail ambiguity. ISO conversion is tested
against package-created rows (integer milliseconds, millisecond rounding). Mirror constraint errors
abort the auth statement/transaction; there is no successful auth commit with an unmirrored profile.
No delete trigger removes Noctua users: the lifecycle saga cleans domain references before
`removeUser`; auth deletion alone leaves an inaccessible profile until reconciliation.
The old automatic “match a legacy e-mail in a before hook” is forbidden for public creation. A scoped
operator/provisioning context supplies an explicitly reserved ID; only migration may bind a legacy ID.

Required concurrent rollback test: hold a real adapter transaction that updates auth_user (observe
its mirror on that handle), queue another createUser, abort the first transaction, then let queued
creation finish. The aborted user's auth and mirror revert together; the queued user's mirror
persists. Inject a failing mirror trigger to prove the auth write aborts; throw in a later callback
to prove an already-committed auth/profile pair remains consistent. Throwaway v4 tests verified the
trigger core with the installed adapter; port them into adjacent production tests in Slice 1.

### 3.1.2 Security generations, sessions and challenge state

These are Noctua-owned tables, not additional Better Auth model names. No raw client can write them.
Use unix milliseconds for their times. Foreign keys reference actual auth tables and use CASCADE
where appropriate; install after the six Better Auth tables exist.

```sql
CREATE TABLE IF NOT EXISTS auth_login_epoch (
  id INTEGER PRIMARY KEY CHECK(id=1),
  generation INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO auth_login_epoch(id,generation) VALUES(1,0);
CREATE TABLE IF NOT EXISTS auth_security_state (
  userId TEXT PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS auth_session_security (
  sessionId TEXT PRIMARY KEY REFERENCES auth_session(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  generation INTEGER NOT NULL,
  assurance TEXT NOT NULL CHECK(assurance IN ('setup','mfa')),
  authenticatedAt INTEGER NOT NULL,
  method TEXT NOT NULL                 -- password | imap | password_totp | imap_totp | backup | passkey_uv
);
CREATE TABLE IF NOT EXISTS auth_pending_challenges (
  identifier TEXT PRIMARY KEY,          -- Better Auth verification identifier / WebAuthn challenge key
  userId TEXT REFERENCES auth_user(id) ON DELETE CASCADE, -- NULL only for discoverable passkey_login
  generation INTEGER,                  -- required for known-user ceremonies
  loginEpoch INTEGER,                  -- required for discoverable passkey_login
  authenticatedAt INTEGER NOT NULL,     -- first-factor start, cannot refresh at completion
  kind TEXT NOT NULL,                   -- two_factor | passkey_login | passkey_reauth | passkey_register
  sourceSessionId TEXT,                 -- NULL for anonymous login; session-bound for settings
  expiresAt INTEGER NOT NULL,
  CHECK((userId IS NOT NULL AND generation IS NOT NULL) OR
        (kind='passkey_login' AND loginEpoch IS NOT NULL))
);
ALTER TABLE mcp_tokens ADD COLUMN securityGeneration INTEGER;
-- NULL is invalid, including legacy tokens. Existing hash/expiry/binding migration remains §4.7.
```

`installAuthControlPlane` also creates these triggers using `OLD.password IS NOT NEW.password`
(null-safe), and `providerId='credential'` predicates. Credential INSERT with nonnull password,
UPDATE changing password/provider/user identity, and DELETE of a credential account advance the
corresponding user's generation in the **same SQLite statement/transaction**; an identity move
invalidates both old and new users. A missing security-state row aborts the credential write with
`RAISE(ABORT,...)`, rather than a silent zero-row UPDATE. Creating a user inserts its state before
its credential. Reset therefore commits password, reset-token consumption, session revocation and
generation together. Credential DELETE triggers advance only while their auth_user parent exists:
ON DELETE CASCADE of the parent must not fail because auth_security_state has already cascaded.
A live parent with missing state still aborts; an absent creator is rejected by every guard/MCP
lookup. Test parent delete and standalone credential delete separately. Keep
`revokeSessionsOnPasswordReset:true`. `onPasswordReset` deletes stale MCP
rows and audits as retryable cleanup; it is not the authorization boundary.

Other generation advances: login-mailbox credential/identity change (same master transaction as
mailbox patch), ban, MFA reset/replacement, initial enrollment finalization and explicit user-wide
security revocation. Ban-state changes also have an auth_user trigger as a backstop; ordinary name,
role, last-used metadata, failed TOTP counters and backup-code consumption do not advance generations.
Passkey removal and backup-code regeneration advance via the reviewed operation before mutation.
All these operations invalidate grants/challenges by generation mismatch even if deletion cleanup
fails. A revoke-one-session deletes its sidecar/grants/source-bound ceremonies and invalidates all
pending login challenges for that user; revoke-all advances the user generation too.

`advanceSecurityGeneration`, `readSessionSecurity`, `finalizeAuthentication` and
`invalidateUserChallenges` are **new** helpers in `lib/db/authPolicy.ts`; the spike does not have them.
Noctua writes use its dedicated master handle + whole synchronous `withDbWriteRetry` transaction.
Never perform raw writes on the auth connection around adapter transactions. Trigger effects are
intrinsic to adapter statements and need no JavaScript connection mutex.

Serialize each user's sign-in verification, challenge completion, credential mutation and security
revocation with a durable `admin_lifecycle_operations.slot='security:<userId>'` reservation. It is
a DB intent across awaits, not an open transaction or a module-global mutex (Next has separate
module graphs). Nested services reuse a request-scoped operation ID. Admin operations acquire the
global admin-lifecycle slot before the user slot, never the reverse. Conflict is 409 with retry;
never wait holding SQLite's writer. Keep the slot on interruption; startup reconciles it, revokes
partial sessions/challenges and requires fresh proof before releasing. No other security operation
may start for that user meanwhile. Regular guards can read but fail closed for unfinished destructive
security operations; the initiating setup session can access only the setup allowlist.

Capture generation **before** first-factor verification under this slot. Register `2fa-...` state
when the stock twoFactor bridge creates its verification value, using a Noctua database before-hook
and the request's immutable user/generation/time context. Do not rewrite the library's stored userId.
Missing metadata fails the operation. Before verify-totp/verify-backup-code, read the signed cookie
using the plugin context's `createAuthCookie('two_factor')` + `getSignedCookie`, load both records,
and require matching user, generation and expiry. Bind WebAuthn login/options and settings
ceremonies similarly; registration additionally binds sourceSessionId and proof grant. No browser
query/userId may supply this metadata. A generation check after verification and before finalizing
assurance closes credential-change races. Missing registry entry never falls back to stock behavior.
Delete stale library verification rows and sidecars on revocation; rejection does not depend on cleanup.

Anonymous discoverable passkey options are a special case: PK/index.mjs:265–288 has no user until
an assertion selects a credential. Do not invent a userId at options time. Snapshot the singleton
auth_login_epoch.generation into auth_pending_challenges.loginEpoch with kind=passkey_login;
userId/generation are NULL until the assertion identifies the candidate. An AFTER UPDATE OF generation
trigger on auth_security_state increments auth_login_epoch in that same transaction. Revoke-one-
session also increments this epoch when invalidating pending logins. Under the candidate's user
security slot, before verification and again at finalization, require the saved epoch still match,
then bind the record to the cryptographically verified user and that user's current generation.
This conservatively cancels all outstanding anonymous passkey ceremonies when either household
user revokes credentials; it does not revoke the other user's existing sessions. Failed/used
challenges cannot be rebound. Options issuance snapshots epoch before the plugin call and inserts
its registry entry before returning; a racing revocation leaves a rejected old epoch. Registration
and reauth have a known source user/session and use their generation instead. Include anonymous
options→password reset/revoke→assertion rejection in browser and concurrency acceptance.


Every newly created auth_session is unusable for mail without an `auth_session_security` row.
Only the successful path's policy finalizer can insert/promote that row, conditional on the expected
current generation and live auth session. Errors between plugin writes leave an unusable session;
expire/delete it and require retry. Password/IMAP without enrolled MFA creates `setup`, never `mfa`.
Stock password provisional sessions deleted by twoFactor must never be promoted. After TOTP/backup
login or UV passkey login, finalize only the returned live session, not all of the user's sessions.
A new complete login sets authenticatedAt to the ceremony's first-factor time. Cookie refresh,
password change, TOTP enable/disable rotation and registration `createSession` preserve the original
authenticatedAt and assurance ceiling; deny public registration `createSession:true` to avoid an
extra rotation path. Missing predecessor metadata cannot be reconstructed from a new createdAt.

### 3.2 Account shard DB (`db/accounts/<accountId>.db`)

Shard message identity is the composite `(accountId, id)`. `buildImapMessageRowId`
returns an account-local id derived from the RFC Message-ID (or fallback metadata);
`messages.messageId` preserves the external header separately. A copy in another
folder of the same account can still receive a mailbox/UID collision variant.
Message ids and account-scoped source/attachment paths do not change on migration.
All message lookups, joins and mutations include the account. The durable keys are:

- `messages`: `(accountId, id)`; `threads`: `(accountId, threadId)`.
- `attachments`: `(accountId, messageId, id)`; `message_translations`:
  `(accountId, messageId, targetLang, format)`; `message_calendar_events`:
  `(accountId, messageId, eventUid)`. Each has an account-scoped message foreign
  key with `ON DELETE CASCADE`. Attachment metadata, ids and removal additionally
  check the owning message before preview, bytes, ETag/304, or cache handling.
- `message_fts_v3` stores `accountId` and the local row id (both unindexed), with stable
  integer rowids from `message_fts_identity(accountId,messageId)`. Search matches the pair;
  sync/deletion replaces only that account's FTS entries.
- `thread_topics`: `(accountId, threadId, topicId)`. Topic filters and remaps
  include accountId. Collaboration state already uses `(accountId, threadId)`;
  comments/activity use generated unique ids plus account-scoped thread queries.
  `sent_by` continues to use `(accountId, messageId)` with the external RFC header.

Message, attachment, thread and translation upserts use `ON CONFLICT` on their
complete key. Updating a message does not delete its dependent translation cache.
Watcher, full/repair/resync and cross-account copy ingestion use the same store.

Existing shards are migrated at first open. `CREATE TABLE IF NOT EXISTS` and
`PRAGMA table_info` identify the layout after additive column migrations. The
account-key rebuild rechecks under a single immediate transaction, copies rows
and child ownership from the legacy globally unique message id, preserves indexes
and triggers, rebuilds FTS from surviving messages, then checks foreign keys
before commit. SQLite foreign-key enforcement is disabled only around the atomic
rebuild and restored even on failure; failures roll back all table swaps. Repeated
opens do not rebuild or acquire a writer lock for the key/format check.

Shard `PRAGMA user_version = 3` is installed in that same transaction, together
with database-enforced legacy-writer rejection. Every ordinary table containing
`accountId` has BEFORE INSERT/UPDATE/DELETE triggers requiring the connection-local
`noctua_writer_v3()` SQL function. `configureAccountDb` registers it immediately
on open, before schema/data writes, including the separate membership-cleanup
handle; sync workers, recompute CLIs, watcher ingestion and maintenance scripts
use the common account connection API. Schema initialization also registers it
for explicit migration handles. Connections refuse a `user_version` newer than
the binary supports before configuration/schema writes.

SQLite forbids persistent triggers referencing TEMP tables, and forbids triggers
on virtual tables and FTS shadow tables. Therefore the guard uses a SQL function
instead of a TEMP marker, and FTS is physically named `message_fts_v3`.
The legacy `message_fts` and `message_fts_v2` names become read-only views. Legacy ordinary-table
mutations fail at statement preparation with `no such function:
noctua_writer_v3`; legacy FTS mutations fail with `cannot modify message_fts
because it is a view`. This also invalidates statements prepared before the
migration. Legacy reads may work or fail; an old binary cannot safely resume
writing this format. Direct shard writers must use `configureAccountDb` and
the current FTS table name; the marker is a format compatibility boundary, not
protection against an operator deliberately changing the schema.

Stop all app, watcher, sync and recompute worker processes before upgrading.
Back up the master DB, each actual physical shard (including WAL state using
SQLite backup or a clean shutdown), and account-scoped files together. Run the
collision inventory below before migrating, start only the new binary to migrate
each shard at first open, then resync all accounts that used a legacy shared file.
To roll back to an old binary, stop the new processes and restore the coordinated
pre-upgrade backup; never remove the guards or lower `user_version` in place.

Before opening an existing shared shard with the new version, run this read-only
inventory once for each actual file (paths are deduplicated by realpath):

```sh
bun scripts/checkShardMessageCollisions.ts /absolute/path/to/shared-shard.db
```

The JSON report includes `sharedMessageIdCount` and `sharedMessageRowCount` (rows
whose normalized Message-ID survives in more than one account), stored account
count and legacy-key status. It does not open the application's connection layer
or migrate the file. **A zero count cannot rule out past replacement**: an already
replaced row is absent. Resync every account that used a shared legacy file even
when the count is zero. Migration preserves surviving rows and metadata; it cannot
recover overwritten messages, attachments, FTS entries or missing thread indexes.
Normal duplicate delivery after migration is supported and is not evidence of
prior replacement. Account mappings and backups are needed to identify all former
users of a file; the surviving-row count alone is insufficient.

```sql
CREATE TABLE IF NOT EXISTS thread_collab_state (
  accountId TEXT NOT NULL,
  threadId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',      -- open | in_progress | waiting | closed
  assigneeUserId TEXT,                      -- master users.id, no FK (different DB)
  assignedByUserId TEXT,
  assignedAt INTEGER,
  statusChangedAt INTEGER,
  statusChangedByUserId TEXT,
  commentCount INTEGER NOT NULL DEFAULT 0,
  lastActivityAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  updatedByUserId TEXT,
  PRIMARY KEY (accountId, threadId)
);
CREATE INDEX IF NOT EXISTS idx_thread_collab_state_assignee ON thread_collab_state(accountId, assigneeUserId);
CREATE INDEX IF NOT EXISTS idx_thread_collab_state_status ON thread_collab_state(accountId, status);

CREATE TABLE IF NOT EXISTS thread_comments (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  threadId TEXT NOT NULL,
  authorUserId TEXT NOT NULL,
  body TEXT NOT NULL,                       -- markdown source, 1..20000 chars
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  deletedAt INTEGER                         -- soft delete
);
CREATE INDEX IF NOT EXISTS idx_thread_comments_thread ON thread_comments(accountId, threadId, createdAt);

CREATE TABLE IF NOT EXISTS thread_activity (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  threadId TEXT NOT NULL,
  type TEXT NOT NULL,                       -- assigned | unassigned | status_changed | comment_added | comment_deleted | reply_sent | threads_merged
  actorUserId TEXT,                         -- NULL for system
  actorClientId TEXT,                       -- 'web:<clientId>' | 'mcp:<tokenId>' | 'system'; clientId clamped to 64 chars of [A-Za-z0-9_-]
  payload TEXT,                             -- JSON
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_thread_activity_thread ON thread_activity(accountId, threadId, createdAt);
```

Rules

- Every read and write filters on `accountId AND threadId` (and `AND id` for comment deletes).
  Two mailboxes can share one shard file and the same Message-ID can appear in both.
- A state row is created lazily on first mutation with `INSERT ... ON CONFLICT(accountId, threadId) DO UPDATE`.
  There is never a SELECT-then-INSERT. Absence means `open`, unassigned.
- Each mutation is one synchronous `db.transaction(fn).immediate()` wrapped in `withDbWriteRetry`,
  containing: the thread existence check (`EXISTS (SELECT 1 FROM messages WHERE accountId = ? AND threadId = ? AND COALESCE(deleted,0) = 0)`,
  otherwise the request returns 404 and nothing is written), the upsert, the comment insert or
  soft delete, `UPDATE thread_collab_state SET commentCount = (SELECT COUNT(*) FROM thread_comments WHERE accountId = ? AND threadId = ? AND deletedAt IS NULL)`,
  and the activity insert. All master-DB validation (membership, role, assignee is a member) happens
  before the shard transaction.
- Remap. `remapThreadCollab(db, accountId, pairs)` is synchronous and runs inside the caller's
  transaction. Callers: `recomputeThreadIdsForAccount` (lib/db/threads.ts), `upsertMessages`
  (lib/db/messages/upsert.ts; `findMessageById` must also select `threadId` so a changed id is
  detected), and `resyncMessage` through the same upsert path. Pairs are derived from the rows being
  rewritten: `{ oldThreadId: row.threadId, newThreadId: next.threadId }` where they differ, grouped
  by old id. Policy per old id, evaluated after the messages UPDATE:
  1. If the old id still has non-deleted messages, leave its collaboration rows alone.
  2. If it maps to exactly one new id, move to it.
  3. If it split, follow the new thread that contains the message whose `messageId` header equals
     the old id (the former root); if none, the oldest message formerly in the old thread.
  4. Moving into a target that already has a state row merges in JS: newest `updatedAt` wins for
     `updatedByUserId`; status is `closed` only if every merged row is `closed`, otherwise the
     most recent non-closed status; assignee = the most recently assigned non-null assignee;
     write the merged row with `ON CONFLICT(accountId, threadId) DO UPDATE`, then `DELETE` the old rows. Comments and
     activity rows get the new `threadId` via plain `UPDATE` (their PK is `id`). Then recompute
     `commentCount` from `thread_comments`. Write one `threads_merged` activity row with
     `payload.mergedFromThreadIds` and `actorClientId = 'system'`.
  5. `thread_topics` (PK `accountId, threadId, topicId`) is remapped the same way: `INSERT OR IGNORE ... SELECT`
     then `DELETE`. This also fixes the upstream gap where topics were lost on recompute.
- Threads without a Message-ID fall back to row ids (lib/threading.ts); collaboration on those is
  best effort and not remapped on folder moves.
- The collab DB module runs inside the recompute and sync worker subprocesses. It must be importable
  without Next or request context and must not touch the credential cache or sessions.
- No pruning. Orphaned state rows (thread lost all messages) are invisible in lists and counts
  because every filter is applied to `messages` rows.

## 4. Authentication

### 4.1 Better Auth sessions, liveness and enrollment gate

`lib/betterAuth.ts` exports `AUTH_BASE_PATH="/api/ba"`, options, migrations and async `getAuth()`.
`app/api/ba/[...all]/route.ts` mounts `toNextJsHandler(async request => (await getAuth()).handler(request))`.
Client `lib/authClient.ts` uses `createAuthClient` from `better-auth/react`, basePath `/api/ba`,
`twoFactorClient` and `passkeyClient`. Keep `nextCookies()` last on the server. Set:

```ts
emailAndPassword: {
  enabled: true, disableSignUp: true, minPasswordLength: 10, maxPasswordLength: 256,
  password: argon2idPassword, revokeSessionsOnPasswordReset: true
},
user: { modelName: "auth_user" },
account: { modelName: "auth_account" },
verification: { modelName: "auth_verification" },
session: {
  modelName: "auth_session", expiresIn: 259200, updateAge: 3600, freshAge: 300,
  cookieCache: { enabled: false },
  additionalFields: { activeAccountId: { type: "string", required: false, input: false } }
},
advanced: { cookiePrefix: "noctua", disableOriginCheck: false, disableCSRFCheck: false },
telemetry: { enabled: false }
```

Two-factor config: `twoFactor({issuer:"Noctua", allowPasswordless:true,
schema:{twoFactor:{modelName:"auth_two_factor"}}})`. `allowPasswordless` permits migrating IMAP-only
users to enroll, but does not waive the Noctua re-authentication rule (§4.4). `skipVerificationOnEnable`
stays false; email/SMS OTP is not configured. Plugin default lockout (10 failed verifications, 15 min)
and challenge attempts (5) remain. Deny `trustDevice:true` on all verification paths and do not reuse
old trusted-device records at cutover. TOTP itself accepts adjacent time windows and has no used-code
replay ledger; do not describe it as replay-proof.

Passkey config: `passkey({rpID: PASSKEY_RP_ID, rpName:"Noctua", origin: BETTER_AUTH_URL,
authenticatorSelection:{residentKey:"preferred", userVerification:"required"},
registration:{requireSession:true}, authentication:{afterVerification},
schema:{passkey:{modelName:"auth_passkey"}}})`. The callback must reject unless
`verification.authenticationInfo.userVerified === true`, before session creation. Also enforce
`verification.registrationInfo?.userVerified === true` during registration via `registration.afterVerification`.
The library asks for preferred UV and verifies with `requireUserVerification:false` by default;
changing the registration browser hint alone is insufficient. In 1.7.12 the authentication-options
endpoint hardcodes userVerification:"preferred"; authenticatorSelection changes registration only.
The server-side authentication callback is therefore the enforcement boundary. Do not invent an
unsupported authentication.userVerification config option. A non-UV authenticator must be rejected
and the UI offers password+TOTP; browser acceptance must confirm the intended devices perform UV. Full authenticator verification is an implementation
acceptance requirement, not something the spike's options-only passkey test proves.

`requireActiveUserSession(request)` in `lib/auth.ts` awaits
`(await getAuth()).api.getSession({headers:request.headers, returnHeaders:true})`. It yields only a
small internal context `{userId, sessionId, sessionToken, activeAccountId, role, expiresAt}` and
response headers, never credentials. Every caller must await; a Promise passing `instanceof
NextResponse` is a known bypass hazard. Reject missing/expired sessions, missing Noctua users,
incomplete provisioning and active bans with 401 `Unauthorized`; role/status is read from the DB.
No cookie-existence check or client-side redirect replaces the guard.

`isMfaEnrollmentComplete(userId)` requires BOTH `auth_user.twoFactorEnabled=1` AND exactly one
`auth_two_factor` row with `verified=1` and a nonempty secret. Any mismatch fails closed and exposes
`mfa_state_inconsistent` to the security screen; startup/lifecycle reconciliation returns that user
to restricted setup, never silently marks the factor verified. Admin onboarding also requires
`hasPassword=true`. The mail/admin/MCP-minting gate additionally requires this **session's**
`auth_session_security.assurance='mfa'`, generation equal to `auth_security_state.generation`, and a
live matching session/profile. An unassured session cannot inherit another session's enrollment.

After initial real TOTP verification, `finalizeAuthentication` holds the user's security slot and
in one Noctua immediate transaction rechecks both enrollment records, advances generation, deletes
all other sessions/setup grants/pending challenges and promotes only the actual verifying session.
Forward its rotation cookie. Failure between the stock user-flag write and verified-record write
or before finalization never authorizes mail. Two-session enrollment and each fault boundary are
mandatory regressions. Restricted access is only /me, logout, /reauth and the explicitly approved
setup/verification endpoints; sensitive raw BA endpoints run the same policy plugin.

Sessions expire after three days of inactivity, with no absolute age ceiling (user decision,
2026-10-25). Better Auth refreshes `expiresAt` and the cookie to now + 259200 seconds once
`updateAge:3600` has elapsed. `authenticatedAt` survives rotations as factor-proof metadata;
its age does not expire a session. Better Auth `freshAge:300` still applies separately.
See [Authentication: session lifetime](AUTHENTICATION.md#session-lifetime-three-days-of-inactivity).
The guard returns sidecar assurance/time/generation only
internally, never session tokens to the UI. `lib/auth.ts` owns ensureActiveAccountId; lib/authPolicy.ts
owns isMfaEnrollmentComplete and operation proof, while lib/db/authPolicy.ts owns the persisted state.

`GET /api/auth/me` returns `{ok:true,user,accountId:string|null,accounts,exp,ttlSeconds:259200,
mailboxState:"selected"|"none"|"unselected"|"enrollment",
security:{enrollmentRequired:boolean,reauthRequired:boolean}}`. During restricted enrollment return
minimal identity, no mailbox details, `accounts:[]`, `accountId:null`, mailboxState=enrollment.
For full users, a new/null/revoked selection with nonempty memberships is resolved server-side:
`ensureActiveAccountId` sorts accessible accounts by display name, normalized e-mail, id, chooses
the first and persists it through `setActiveAccountId` before responding. Re-read membership after
the write; a concurrently revoked choice retries once, then returns mailboxState=unselected, and responds with
403 `mailbox_selection_required` on selection-dependent APIs until explicit switch succeeds.
Zero memberships alone means mailboxState=none, accounts=[], accountId=null (“No mailbox yet”).
The UI must not locally pick accounts[0] and start calendar/import with an unpersisted selection.
Selection-dependent handlers use the same helper; explicit account routes always recheck membership.
`exp` is Unix seconds of the sliding library expiry. Forward every getSession Set-Cookie.
`POST /api/auth/logout` accepts a bodyless mutation (§4.6), invokes signOut with returnHeaders,
forwards every deletion cookie and removes the DB session/sidecar and its proof state. The client
clears local state only on success (already-absent session may return idempotent success).
`POST /api/auth/switch-account` checks membership then `setActiveAccountId`; public update-session
cannot set it (`input:false`). Selection never grants authority.

### 4.2 Login methods and the optional IMAP first factor

Primary methods:

- `POST /api/ba/sign-in/email` `{email,password,rememberMe?}` uses the person's app password.
  An enrolled user receives `{twoFactorRedirect:true,twoFactorMethods:["totp"]}` and a short-lived
  challenge cookie, with no session. `POST /api/ba/two-factor/verify-totp` `{code}` or
  `/two-factor/verify-backup-code` `{code}` completes it. Backup codes are single use.
- `authClient.signIn.passkey({autoFill})` uses WebAuthn; user verification is required as in §4.1.
  Better Auth intentionally does not apply TOTP to passkey authentication. A verified passkey is
  accepted as the complete login, provided the user's mandatory TOTP enrollment is still active.
- Remove the old `/api/auth/login` implementation (return 410 during client migration, then remove).
  No route may resolve a session user from `ownerUserId ?? firstLink ?? account.id`.

Optional personal-mailbox method: `POST /api/ba/sign-in/imap` `{email,password,rememberMe?}`.
It is OFF by default. An unset or empty `NOCTUA_IMAP_LOGIN_HOSTS` disables login and IMAP-based
credential proof: reject before network work, provisional session creation or password write-back.
Expose only method availability to the client, never the allowlist; hide the IMAP action when off.
Normalize e-mail and first load an existing auth_user and its Noctua users row. If there is no user,
including an empty installation, answer generic 401 without any IMAP connection. Resolve exactly one
login mailbox by all of these conditions, never by “first linked mailbox”:

1. `ownerUserId === user.id`.
2. `lower(trim(account.email)) === lower(trim(account.imap.user)) === user.email`.
3. `imap.secure === true`; use the existing TLS-verifying IMAP helper.
4. The exact normalized IMAP hostname is in operator-configured `NOCTUA_IMAP_LOGIN_HOSTS`; absent
   or empty allowlist disables the method. Do not accept request-supplied hosts/ports/usernames.
5. `shared === false` under the §5.3 member-count rule (`memberCount <= 1`). A mailbox shared with
   another member, even a viewer, is ineligible for IMAP first factor and IMAP-based credential proof.

Zero or multiple candidates fails closed. Shared mailbox credentials never authenticate a person.
Granting a second membership disables this optional method for that mailbox; app-password/UV-passkey
login remains available. A shared address must never be used as a personal user identity.
Admin/invite validation forbids assigning an existing shared mailbox's address to a new user, and
migration rejects shared-address user rows until the operator supplies personal identities. A shared mailbox whose address differs from the person's can never satisfy condition 2.
For this installation, confirm that the mail provider's IMAP username is the full mailbox address; otherwise this
method stays off until a separately reviewed explicit login-name mapping exists.

Reuse `verifyImapCredentials` and `accountIdFromEmail` for canonical new ids, but locate existing
mailboxes by the verified fields rather than assuming every historical id uses today's hash. Check a
per-IP and per-normalized-user IMAP-attempt limiter immediately before the network LOGIN; credential
verification bypasses the usual connection breaker. Every failure returns the same 401/message; do
not reveal which eligibility check failed. Equalize the local unknown-user path with a bounded dummy
password hash and cap input lengths; a network-timing difference is not a claimed secrecy guarantee.
Keep an independent app password for every admin and recommend it for both people; IMAP is an
optional convenience and may be disabled without losing the ability to administer the instance.

The spike proves that twoFactor does NOT match custom sign-in paths. The custom plugin must create
its provisional session with `internalAdapter.createSession` and `setSessionCookie`, then explicitly
reuse the *same* twoFactor instance's `hooks.after[0].handler` on `/sign-in/imap`, before `nextCookies`.
The hook deletes provisional session + cookie and returns the standard challenge. Use exported plugin
APIs; do not store `imap:<id>` as a fake password hash, squat on `/sign-in/username`, or copy the
challenge's internals. At startup assert exactly one twoFactor after-hook; pin its expected matcher
in a canary. The HTTP integration test must prove no response token, no live cookie and no DB
session before MFA, followed by valid TOTP and backup-code completion. A version bump must pass the
negative control and real flow; otherwise disable IMAP login pending review. Typed public hooks
make this the smallest supported extension, but the other plugin's internal hook layout is not a
stable documented cross-plugin contract. The bridge is consciously version-coupled.

After a successful IMAP credential check, write back only that login mailbox's password (never any
shared mailbox) through the common credential service in §5.3. A changed stored password deletes
that user's existing sessions and MCP tokens, then the current sign-in proceeds to its normal MFA
challenge; no password is stored in the pending challenge. A wrong TOTP must still never yield mail
access. Initialize request generation/time **after** this service's credential write-back and before
creating the first-factor challenge, under the same user security slot; never issue a challenge with
the generation intentionally revoked by this login itself. The three-day idle lifetime in §4.1 also applies to sessions established with mailbox passwords.

### 4.3 Bootstrap, invites and provisioning

Public Better Auth sign-up is disabled (`emailAndPassword.disableSignUp:true`); this also disables
server `signUpEmail`, as the spike proves. Use the admin plugin's server-side `createUser` only in
`lib/userProvisioning.ts`, never a public no-session creation endpoint. That server API can run
without headers; this is a privilege boundary to enforce in Noctua, not a bootstrap permission check.

Every signup requires a valid invite, including bootstrap; the former desktop invite exemption is
removed. Empty installation: retain the startup admin invite code printed only while users is empty.
The operator gives it to the first person out of band. A valid first-admin invite plus that person's own
chosen app password creates the first admin; an existing mailbox password alone never does.
Serialize the empty-users check and invite reservation so two requests cannot both become first
admin. Disable startup bootstrap when an enabled admin already exists. Noctua does not ship a shared
initial password; therefore there is no forced-temporary-password-change field.

`POST /api/auth/signup` JSON `{inviteCode,email,password,name,account?}`. Optional `account` is a new
mailbox with its own IMAP/SMTP credentials; `password` is always the app password, not inferred from
the mailbox. Order and failures:

1. Same-origin JSON and rate checks; normalize e-mail, validate required name and password 10..256.
   Reject an existing normalized user e-mail (409), including a legacy profile awaiting migration.
2. If account is present, derive the id server-side with `accountIdFromEmail`; if that mailbox id or
   normalized mailbox e-mail already exists, return 409 `{code:"mailbox_exists"}` BEFORE IMAP verify
   and BEFORE claiming the invite. Existing mailboxes can be granted only through membership APIs.
3. BEFORE any IMAP/SMTP/DNS/network work, validate invite existence, expiry, remaining capacity
   including active reservations, role/bootstrap eligibility and normalized personal e-mail binding.
   Invalid/expired/exhausted/wrong-person invites cause **zero** outbound calls. Only after that
   precheck verify optional new mailbox credentials. This precheck does not claim the invite;
   step 4 atomically revalidates every condition, so a race during verification can still reject.
4. Reserve the invite and normalized e-mail plus a stable intended userId in one immediate Noctua
   transaction (`user_provisioning`). Re-check user/mailbox uniqueness and first-admin state there.
   Count active reservations against invite capacity (`uses + reserved < maxUses`) so concurrent
   requests cannot reserve the same remaining use. This is an atomic reservation, not an async
   transaction containing Better Auth calls.
5. The service invokes server createUser with the intended id through a scoped creation hook, chosen
   password, name and authorized role. Enforce the minimum here: 1.7.12 admin createUser skips it.
   The SQLite trigger mirrors the Noctua profile in the auth write. Deny sessions until provisioning is complete.
6. In a second immediate Noctua transaction insert the optional *new* mailbox (`INSERT`, never replace
   an existing row), add manager membership, finalize invite usage and mark complete. On failure
   delete the newly created auth identity/Noctua rows and release only this operation's reservation.
   Persist `cleanup_required` if compensation fails. Startup retries cleanup/reconciliation before
   login; never decrement another request's invite claim. An operation ID makes retries idempotent.
7. Sign in via Better Auth, forward Set-Cookie and return `{ok:true,accountId:null,
   security:{enrollmentRequired:true}}`. The enrollment gate runs before any mailbox data is returned.

`user_provisioning` is a recovery journal, not a second password store. Do not persist plaintext
passwords or MFA secrets there. If a crash loses the chosen password before auth creation, release
that reservation safely and let the person retry; if auth creation succeeded, reconcile by the
recorded userId. Active uniqueness uses `idx_user_provisioning_active_email` only while reserved,
auth_created or cleanup_required. Complete/cancelled history stays by operation ID and does not reserve
an address. Deleting a completed user never deletes history or blocks a new invite. One active recovery
per address is allowed; a subsequent recovery after completion gets a new operation ID and revokes
older unredeemed reset links. A mailbox collision in the final transaction rolls back/compensates and returns 409.
This replaces the old claim-then-upsert route, which could burn invites and replace mailbox owners.

Admin creation: `POST /api/admin/users` `{email,name,role}` issues a single-use email-bound onboarding
invite; it does not create a usable credential or choose another person's password. The person
redeems it via signup and chooses their own secret. Extend `invite_codes` with nullable `email` and
use it for targeted onboarding; generic invites remain supported for deliberate operator use.
No email delivery infrastructure is needed: show the invite once for out-of-band handover. Require
actual personal addresses; explicitly reject an address belonging to an existing shared mailbox.

### 4.4 Security settings, re-authentication and recovery

The Security page is independent of an active mailbox. `lib/authPolicy.ts` implements the matrix
below and `/api/auth/reauth` returns a <=5-minute one-use `auth_reauth_grants` capability after fresh
proof. The grant binds userId, sessionId, generation, purpose, expiry and any WebAuthn challenge;
store only its hash. Consume by conditional DELETE in an immediate transaction; exactly one caller
wins. A failed downstream write spends the grant and asks for fresh proof. A session or freshAge
alone never substitutes for proof. Capture generation before verification; reject if it changes.

“Password” means current app password when hasPassword=true, otherwise the strict eligible login
mailbox password (only if D3 is enabled). “Factor” means a freshly verified current TOTP or same-user
UV passkey assertion, not a prior login timestamp. A backup code is accepted only where listed.

| Operation / purpose | Fresh proof required | Stock API constraint / HTTP boundary |
|---|---|---|
| Initial TOTP / `totp.enroll` | Password, setup session | `enableTwoFactor` requires body.password if a credential exists; guard raw `/two-factor/enable` with grant |
| Replace TOTP / `totp.replace` | Password + Factor, OR Password + newly consumed backup code | Reviewed `/api/auth/totp/replace`; internal `disableTwoFactor` then `enableTwoFactor` still require app password when present |
| Add passkey / `passkey.enroll` | Password + Factor, OR fresh UV passkey | Passkey registration requires library fresh session; proof reserved at options GET, bound to challenge, consumed at verified registration; reject createSession:true |
| Set first app password / `password.set` | Eligible IMAP password + Factor (Factor waived only for restricted first onboarding) | `setPassword` is server-only; Noctua wrapper `/api/auth/security/password` enforces grant and 10..256 |
| Change app password / `password.change` | App password + Factor | Wrapper calls changePassword with currentPassword and forced revokeOtherSessions:true; UV cannot replace currentPassword |
| Regenerate backup codes / `backup.regenerate` | Password + Factor | `/api/auth/security/backup-codes` consumes grant, calls generateBackupCodes with body.password if hasPassword; no session-only regeneration |
| Remove passkey / `passkey.remove` | Password + Factor, OR another same-user UV passkey | Reviewed wrapper; cannot remove fallback required by D13/admin policy |
| Admin recovery/MFA reset / `admin.recovery` | Admin app password + Factor, plus out-of-band target verification | Reviewed lifecycle service / local explicit operator command; never a public recovery bypass |

UV can substitute for the extra password prompt on passkey enrollment/removal, but **cannot waive**
Better Auth's password requirement on TOTP enable/disable/backup generation when hasPassword=true.
The UI must collect that password. IMAP-only users still prove their mailbox password to Noctua;
allowPasswordless merely lets the stock plugin run after this proof. No unsupported password override.

The policy plugin guards raw credential endpoints as well as wrappers. Disable raw HTTP
`/api/ba/change-password`, `/api/ba/two-factor/disable`, `/api/ba/two-factor/get-totp-uri`,
`/api/ba/two-factor/generate-backup-codes`, `/api/ba/update-user` and mutating admin paths.
There is **no enrolled-seed export**; only a proof-authorized enable response returns a new QR/manual
secret. `getTOTPURI` and `viewBackupCodes` are not called by application services. Backup regeneration
returns new codes once, invalidates old ones and advances generation; keep only the proved current
session under the new generation, preserving authenticatedAt, or force full login on partial failure.
Never infer that HTTP disabledPaths restricts server APIs: only reviewed services import them.

Passkey registration is two requests. Reserve the one-use grant at options generation, attach its
in-memory `x-noctua-reauth` header through the shared lib/authClient.ts request hook on options and
verification, and bind to the exact stored challenge. Consume on successful UV verification; reject
wrong user/session/generation/challenge/purpose, expiry and replay. No grant in query strings.
Failed/cancelled ceremonies release no reusable verified proof; require a new grant after expiry.
Normal TOTP/backup-code login uses its first-factor challenge, not an enrollment grant.

UV reauth uses the installed `/api/ba/passkey/generate-authenticate-options` and
`/api/ba/passkey/verify-authentication` under a source-session-bound passkey_reauth intent created by
`POST /api/auth/reauth` (returns ceremonyRequired for that mode). Before verification require the
live source session; afterVerification asserts UV and same user, and records only request-scoped
verified metadata. The stock endpoint will create a new session; capture it in the outer handler,
**after its DB transaction finishes**, preserve the source authenticatedAt/assurance ceiling,
forward its cookie and bind the resulting proof grant to that resulting session ID. Retire the old
source session; other sessions are not promoted. The grant response/cookie must arrive together.
Use the same post-handler boundary for finalizing normal passkey login and TOTP activation: the UV
callbacks may run inside an adapter transaction and must not write on the separate master handle.
Registration reserves proof before entering the plugin and validates it in the callback using
request metadata; consume/finalize only after commit. Failure leaves a durable security intent,
quarantines/removes any partly-created credential/session and cannot expose an assured session.
Tests inject failure in that boundary. Trusted server API calls carry a non-client-settable scoped
operation context; never let an HTTP header impersonate this internal authorization.

Initial enrollment: password proof → enable → QR/manual secret → real TOTP verify → §4.1 atomic
finalization → show backup codes once/saved acknowledgement → optional passkey. A leaked fresh setup
cookie alone cannot export a seed, regenerate codes or enroll a factor. TOTP verification failure
stays restricted. Clearing one record or partial activation cannot bypass enrollment.

Lost-device recovery with backup codes is executable:

1. Password login followed by stock `/api/ba/two-factor/verify-backup-code` consumes one code and
   creates an assured session. This login does not itself authorize credential replacement.
2. `/api/auth/reauth` `{purpose:"totp.replace",currentPassword,backupCode}` verifies the current
   first factor, then invokes `auth.api.verifyBackupCode({headers,body:{code,disableSession:true}})`
   for a **new** code. Its encrypted backupCodes compare-and-swap consumes the code atomically;
   concurrent requests with that code yield at most one grant. Check generation/session again and
   conditionally insert the grant. Crash after consumption but before grant issuance fails closed;
   another unused code or admin recovery is needed. A previous login's code cannot be reused.
3. `/api/auth/totp/replace` consumes the grant and reserves a secret-free security-operation intent
   under the user slot. Advance generation and revoke all other sessions, tokens and challenges;
   retain only a restricted setup continuation. Call stock disableTwoFactor server-side (body.password
   when present), capture its rotated cookie and recreate **setup**, preserving authenticatedAt.
   Then enableTwoFactor with password and a continuation bound to that operation/session; its new
   seed/codes are displayed once. Subsequent verify-totp finalization uses §4.1, revokes all remaining
   setup sessions and authorizes only the verifying session. Re-enter the password if needed; never
   persist it in the intent. The continuation is a newly hashed capability in auth_reauth_grants with purpose=totp.enroll,
   generation=current and sessionId=the rotated setup session, bound through challengeId to the
   replacement intent. It expires in five minutes and cannot authorize anything except this
   enrollment. Enable reserves it for this seed; verify consumes/finalizes it once. Those requests
   may reuse the durable user slot only by validating this continuation and expected operation phase,
   never by trusting a client-supplied operation ID. Interrupted/expired replacement remains restricted and is reconciled;
   retry requires fresh proof or audited operator recovery, never a session-only resume.
4. Show/save the replacement codes and test next password+new-TOTP login. Old codes/seed, the two
   consumed codes, old sessions and old MCP tokens must all fail. A user with only one remaining
   code may use operator handover instead of assuming one code proves two operations.

Password changes always go through `/api/auth/security/password` with same-origin JSON, a
password.change grant and forced `revokeOtherSessions:true`, regardless of absent/false caller flags
(reject unknown fields). The credential trigger invalidates all old MCP generations and challenges
atomically; explicit token deletion is cleanup. Forward the rotated cookie, preserve authenticatedAt,
rebind only the proved current session to the new generation, and never upgrade its assurance.
Test raw HTTP absent/false flags are blocked and wrapper absent/false cannot opt out. Admin
setUserPassword stays unexposed; triggers still protect against internal credential writes.

Password-reset redemption contract (team-auth owns server, ui-shell owns page/client):

- `POST /api/admin/users/[userId]/recovery` verifies fresh admin proof and target identity, targets
  one known user and issues a 15-minute single-use link for personal handover by the admin.
  `scripts/recoverTeamAuth.ts --user-id` is the audited local operator equivalent for lockout recovery.
  `auth.api.requestPasswordReset({body:{email,redirectTo:BETTER_AUTH_URL+"/reset-password"}})` runs
  with a request-scoped delivery sink in sendResetPassword; show the link once in that authorized
  response/terminal, never a global variable, ordinary logs or audit payload. The operator command
  requires local data/key access and records actor=operator. The callback is a handover sink only;
  it never sends SMTP. SMTP recovery delivery is an explicit non-goal for this stage.
  `/api/auth/recovery/request` is not implemented; issuance is restricted to admin/operator paths.
- Configure `emailAndPassword.resetPasswordTokenExpiresIn:900`, sendResetPassword and
  revokeSessionsOnPasswordReset:true. Raw `/api/ba/request-password-reset` stays HTTP-disabled in
  this stage (the Noctua admin wrapper enforces issuance/limits). Keep **public** GET
  `/api/ba/reset-password/:token?callbackURL=<canonical /reset-password>` and POST
  `/api/ba/reset-password` enabled when the policy handler is enabled. Token possession authorizes
  redemption; no session, MFA gate or reauth grant is required on these two routes. Fix callbackURL
  to `https://mail.example.org/reset-password` in the production policy hook; general trustedOrigins
  is not an open callback list. Isolated preview/localhost instances use only their own exact
  BETTER_AUTH_URL + "/reset-password" callback, never cross-origin callbacks.
- Public `app/reset-password/page.tsx` (ui-shell) consumes `?token=` or `?error=INVALID_TOKEN` from
  the Better Auth callback, copies the token to ephemeral memory, immediately history.replaceState
  to `/reset-password`, and renders new-password+confirmation. Set Referrer-Policy:no-referrer,
  Cache-Control:no-store on callback/page, exclude analytics and redact reset URL paths/queries in
  proxy/app logs. Reload after clearing the URL requires reopening the handover link; no token in
  localStorage. POST JSON `{token,newPassword}` only, same-origin checks + rate limits, to
  `/api/ba/reset-password`. Clear token/passwords on completion/unmount, show expiry/reuse inline.
- Success signs no one in: return to login, require existing TOTP/passkey/backup code. MFA state
  remains intact; pending pre-reset challenges fail generation checks. A callback failure after
  password commit may produce an error response; new password still works, old tokens do not.
  UI says to try login or request a new link, never replay mutations silently. Record cleanup for
  audit/token deletion independently of the consumed reset token.
- Audited MFA reset is separate: out-of-band identity verification, revoke all sessions/MCP/challenges,
  remove/reset factors and return to restricted enrollment with chosen-password recovery as needed.
  No public “lost phone” bypass. `listSessions` and passkey registration still require library freshAge;
  offer full login instead of manipulating createdAt. Revoke-session wrappers perform challenge cleanup.

### 4.5 Admin user management and lifecycle

`requireAdminSessionOr403` uses the async active-session/MFA guard and authoritative auth_user.role.
Keep Noctua routes as the only HTTP management boundary. Disable all mutating `/api/ba/admin/*`
endpoints and route clients through `/api/admin/*` services; Better Auth `disabledPaths` affects HTTP,
not `auth.api.*`, so these services can still invoke its admin APIs server-side. Explicitly list
create-user, set-role, update-user, ban-user, unban-user, remove-user, set-user-password,
revoke-user-session(s), impersonate-user and stop-impersonating. Disable Better Auth public delete-user
and change-email as well; this first release keeps login e-mail immutable except operator migration.
Self name updates use a whitelisted Noctua security-profile wrapper. Admin permission definitions
exclude impersonation, and `adminUserIds` is not set (it bypasses permission checks).

- `GET /api/admin/users` → `{ok,users:[User & {accounts:[{id,name,email,role,isOwner}]}]}` using the
  explicit DTO (§3.1). Name/password/2FA/passkey/session status comes from Better Auth, no hashes.
- `POST /api/admin/users` issues the targeted invite in §4.3; role is exactly admin|user. Duplicate
  personal e-mail → 409. Never expose no-header server createUser through a generic proxy.
- `PATCH /api/admin/users/[userId]` `{name?,role?,disabled?}` calls `auth.api.adminUpdateUser({headers,body:{userId,data:{name}}})` for target name,
  `setRole` for role and `banUser`/`unbanUser` for status. `updateUser` is self-profile only.
  SQLite triggers mirror compatibility fields. Audit the result; test actor ≠ target. A permanent ban represents
  disable (no expiry); banUser deletes DB sessions. Disable additionally deletes all MCP tokens.
  Enabling never resurrects tokens/sessions.
- Refuse self-demotion, self-disable, self-delete and any operation leaving zero enabled admins.
  Serialize these decisions with the unique active slot in admin_lifecycle_operations: reserve in
  an immediate transaction before checking enabled-admin counts, then call the plugin, audit and
  release the slot. Another lifecycle mutation returns a retryable conflict while it is active.
  Startup reconciles interrupted intent before releasing the slot; no concurrent last-admin race.
- `DELETE /api/admin/users/[userId]` `{reassignOwnerTo?}` requires a valid target if the user owns
  mailboxes. Ban first, revoke sessions/MCP, then perform Noctua's transactional cleanup (memberships,
  prefs, owner reassignment), unassign shard work (§5.4), and finally plugin removeUser (auth children
  cascade). Keep the banned identity and durable cleanup status until all cleanup succeeds. Do not
  claim cross-shard atomicity; retries are idempotent and mail stays inaccessible on partial failure.
- `/api/admin/users/[userId]/recovery`, `/mfa-reset`, `/passkeys/[id]` DELETE and `/sessions` DELETE
  use the fresh proof/last-admin policy and audit. Validate passkey/session ownership of the target.
- `GET /api/admin/audit?limit=&before=` returns the existing immutable audit history. Each successful
  mutation has an audit row; lifecycle journal records incomplete operations for retry. Never log
  plaintext credentials, reset/invite URLs, recovery codes, TOTP seeds or full bearer/session tokens.

### 4.6 Request hygiene, origins and limits

Better Auth's HTTP router enforces its origin/CSRF checks at `/api/ba`. Set a fixed path-free
BETTER_AUTH_URL, exact trusted origins and both checks explicitly enabled even in tests. Foreign
origin sign-in is 403 `INVALID_ORIGIN`; cookie POST without Origin/Referer is 403
`MISSING_OR_NULL_ORIGIN` (spike tests). Programmatic `auth.api.*` calls do not inherit HTTP origin
checks or rate limiting. Any Noctua wrapper must enforce them itself.

`requireJsonSameOrigin` in `app/api/_helpers/requestOrigin.ts` requires application/json and a
non-null Origin (or validated same-origin Referer) against the configured public origin, not an
untrusted forwarded Host header. Reject foreign Origin even if Sec-Fetch-Site claims same-origin;
Fetch Metadata can strengthen checks, never override them. Apply to mutating auth/admin/member/
prefs/collab routes that carry JSON. Bodyless mutations (logout, DELETE session/passkey/member/comment)
use `requireBodylessSameOrigin`: the identical origin/fetch checks, zero body and no required content
type; reject an unexpected body with 400. Choose the convention per route, never parse JSON from
logout. Bearer-only `/api/mcp` is exempt and must never accept cookie fallback.

Enable Better Auth `rateLimit.enabled:true`, memory storage for the single process. Sign-in paths
include custom `/sign-in/imap` when explicitly enabled: 3 attempts/10 seconds/IP; twoFactor paths
3/10 seconds. Admin reset-link issuance is limited to 3/min in its reviewed server-API wrapper;
public reset-request issuance remains disabled. Noctua wraps signup (3/min/IP), credential proof (5/min/user + IP), recovery and admin sensitive
operations. IMAP attempt limiter is additionally 5/min/personal identity immediately before the
network call. Configure `advanced.ipAddress.ipAddressHeaders` and `trustedProxies` from actual TLS
proxy addresses; align Noctua TRUSTED_PROXY_HOPS. The proxy must overwrite untrusted forwarded
headers, and Next must listen only behind it. Do not trust arbitrary XFF from a publicly reachable
Next port. Memory limits reset at restart; that is explicit for this one-process deployment.

Permission/MFA/proof failures are 403 with stable codes; invalid sessions are 401 Unauthorized.
A wrong password/code on `/api/ba` is a local form error, not a global logout. MailClient's 401
heuristic is narrowed to `/api/auth/me` or the explicit Noctua Unauthorized contract. Mailbox credential failures return `code:"mailbox_credentials_invalid"`, `accountId`,
`repairAllowed` and `reauthRequired` only for managers (owner/admin login-identity restrictions still
apply). Managers may open AccountReloginDialog; viewers/editors receive `repairAllowed:false`,
`reauthRequired:false`, and “Mailbox unavailable; contact a manager”, with no credential dialog or
/relogin attempt. A role downgrade while a repair dialog is open closes it. Keep this separate from
personal-auth 401/403; never globally log out because an IMAP credential failed. Clamp x-noctua-client to 64 characters of
`[A-Za-z0-9_-]`. Never record submitted credentials as request diagnostics.

### 4.7 MCP tokens

MCP bearer auth remains Noctua's, independent of Better Auth sessions. New tokens are
`mcp_` + 32 cryptographically random bytes (base64url), looked up by SHA-256 hash in mcp_tokens;
show the secret once. No encrypted session payload, IMAP secret, role snapshot or browser cookie is
embedded. Creation takes authenticated userId/accountId, not SessionData, and requires completed
MFA plus editor or manager membership. TTL/expiry remains explicit. Tokens can cover several own/shared mailboxes selected
at creation, with the current creator membership/role checked for each mailbox.
Creation modes are read only (`read`), read and drafts (`read,drafts`, default), and
full access (`read,drafts,manage,send`). Scopes are stored as a JSON array in
`mcp_tokens.scopes` and enforced centrally. Legacy NULL scopes mean read/drafts,
without sending or sender identity/preferences management. Empty mailbox mappings
mean primary only. `mcp_token_accounts(tokenId,accountId)` stores new sets; deleting
tokens removes their mappings, deleting a mailbox preserves tokens with remaining
mailboxes and promotes the remaining mailbox with the creator's highest live role (ties by ID) as primary. No MCP send tool exists; the outbound
boundary requires `send` for token-based transmission and rechecks before effects.
Mailbox sets and modes are immutable; create a new token to change them.

Every request checks token hash/expiry, the creator's existing enabled auth_user + Noctua profile,
completed MFA (both records), `token.securityGeneration === auth_security_state.generation` and
current role on the selected covered mailbox. Mint only from a session with per-session mfa assurance;
store its current generation in the token row atomically, rechecking membership and generation. Each tool accountId must belong to the token's set;
omission selects its primary mailbox. Reject a deleted/banned creator or revoked
membership immediately, irrespective of session age. Disabling/deleting, password reset/change,
MFA reset and login-mailbox credential changes delete that user's tokens. Membership revoke removes the mailbox from that user's tokens: tokens with no
mailbox left are deleted, multi-mailbox tokens keep their other memberships and get a new
primary (highest live role, ties by ID; `removeUserAccountLink` runs the same cleanup unless the user still holds the mailbox, e.g. as its owner); re-adding the member does not restore the token's access to that mailbox. Role downgrade is enforced at use time. Expiry and token deletion never
depend on session cookie crypto. Generation mismatch rejects immediately even if
onPasswordReset, token deletion, audit or process shutdown interrupts cleanup. A NULL generation
never matches. Fault-inject callback failure after committed reset; the old bearer must fail before
any cleanup/restart, while the new password works. Existing sealed tokens are invalidated at migration (§8).

## 5. Authorization

### 5.1 Role resolution helper (`lib/accountAccess.ts`, new)

```ts
export type AccountRole = "viewer" | "editor" | "manager";
export const ACCOUNT_ROLE_ORDER: Record<AccountRole, number> = { viewer: 1, editor: 2, manager: 3 };
export function roleAtLeast(role: AccountRole | null | undefined, min: AccountRole): boolean;
export async function resolveAccountRole(userId: string, accountId: string): Promise<AccountRole | null>;
export async function listAccessibleAccountsForUser(userId: string): Promise<Array<{ account: Account; role: AccountRole; isOwner: boolean; memberCount: number }>>;
export async function listAccountMembers(accountId: string): Promise<Array<{ userId: string; email: string; name: string | null; role: AccountRole; isOwner: boolean; disabled: boolean }>>;
export function teamFeaturesSupported(): boolean;   // true after supported web/db startup; false in unsupported modes
```

`requireAccountContext(request, accountId, { minRole?: AccountRole })`:

1. `await requireActiveUserSession(request)`, which obtains the user from
   `(await getAuth()).api.getSession({headers:request.headers})` as in §4.1, including MFA/liveness.
2. `role = await resolveAccountRole(session.userId, accountId)`; `null` → 403 `{ ok:false, message:"Forbidden" }`.
3. Active mailbox is `auth_session.activeAccountId` (`input:false`), only a default for UI and
   calendar/import. It never substitutes for checking the route's requested mailbox.
4. `minRole` defaults to `viewer`. Below it → 403 `{ ok:false, message:"Insufficient mailbox role", requiredRole }`.
5. Return `AccountContext` with `role`, `userId` and the small session context, preserving
   `context.session.userId` for current reminder/calendar callers; forward refresh headers.

`requireSessionAccountOr403` is deleted; all direct callers (`accounts/route.ts`, `compose/recipients`,
`attachments`, `html`, `source`, `sender-icon`, `_helpers/recomputeJobs.ts`, `_helpers/syncJobs.ts`,
`messages/listMessagesHandler.ts`, `calendar/import`) move to `requireAccountContext` with the role
from §5.2. `requireOwnedAccountContext` becomes `requireAccountContext(..., { minRole: "editor" })`
on the destination account.


Streaming authorization is continuous. `lib/authStreams.ts` (team-auth) registers every mail or
per-user SSE stream with `{userId,sessionId,accountId?,generation,authenticatedAt,expiresAt}` and an
idempotent abort/cleanup callback. Revoke, ban, delete, membership revoke/downgrade, credential or
MFA change publishes a local close event **after DB commit**. Each emitter independently awaits
`assertStreamAuthorized` immediately before every sensitive enqueue (including fetchNew envelopes,
counts, comments and delayed polls), checking the live DB session, sidecar generation/assurance,
verified factor and current membership/role. No awaits between that check's final result and enqueue;
queued messages are checked anew. This bounds delivery at the authorization-check linearization
point; already-delivered network bytes cannot be recalled. Callback failure does not keep data flowing:
a <=5-second liveness timer rechecks even idle streams against the live session expiry.
An expired session closes the stream within that interval; the stream itself does not refresh it. Clear timers, unsubscribe and close IMAP watchers on request abort/close.
Do not abort a shared server mailbox watcher when a single browser loses access. Stage 3 per-user
SSE must reuse this seam. Tests hold an open stream then revoke session, membership, ban, generation
and expiry; no subsequent fetched envelope/summary may enqueue, all stream resources are released.

### 5.2 Role matrix

| Capability | viewer | editor | manager |
|-----------|--------|--------|---------|
| Read folders, messages, threads, search, attachments, sources, calendar, topics, aliases, reminders (own) | ✓ | ✓ | ✓ |
| Trigger sync / new-mail check / recompute, open IMAP stream | ✓ | ✓ | ✓ |
| Own reminders create/delete, own UI prefs | ✓ | ✓ | ✓ |
| Collaboration read (state, comments, activity, members) | ✓ | ✓ | ✓ |
| Collaboration write (assign, status, comment) | – | ✓ | ✓ |
| Flags, move, archive, delete, spam, categories, topics assign, drafts, send, calendar edits/RSVP, translate, unsubscribe | – | ✓ | ✓ |
| Topics/aliases create/edit/delete (non-destructive) | – | ✓ | ✓ |
| Topics/aliases transfer import (replace-all), folders create/rename/delete, `PUT folders` | – | – | ✓ |
| Account settings (team-level), credentials, relogin, DeepL/CalDAV config | – | – | ✓ |
| `POST /api/accounts` for an existing account id (attach/overwrite) | – | – | ✓ (goes through `patchAccount` with the whitelist, never `upsertAccount` with a request body) |
| Members: view | ✓ | ✓ | ✓ |
| Members: grant/update/revoke (§5.4 limits) | – | – | ✓ |
| Delete the mailbox | – | – | owner or admin only; other managers get 403 "Only the owner can delete this mailbox" |
| MCP tokens: create/list/delete own | – | ✓ | ✓ |
| MCP tokens: list/delete all | – | – | ✓ |

An MCP token acts with the creator's current role at use time. Mutating MCP tools throw
`Insufficient mailbox role` for viewers.

### 5.3 Account payload for clients

`sanitizeAccountForClient(account, { role, viewerUserId, memberCount })` adds `accessRole`,
`isOwner`, `shared` (true when `memberCount > 1`, owner counted once as a member) and, for viewers
and editors, blanks `imap.host/user`, `smtp.host/user`, `caldav`, and `deepl` (only `enabled` and
`targetLang` stay).

`PUT /api/accounts/[accountId]` (manager): `email` is immutable (400). Any change to
`imap.host|port|secure|user` or `smtp.host|port|secure|user` must include the corresponding password
in the same request and is verified with `verifyImapCredentials` (IMAP) / an SMTP connection test
(SMTP) against the new endpoint before persisting; without a password such changes are rejected
with 400. `relogin` keeps requiring the password and no longer accepts a different `imap.user`
unless the password is provided for it.

Use one `lib/mailboxCredentials.ts` helper for relogin, PUT and POST-existing-id (and optional IMAP
login write-back). When IMAP password changes, copy it to `smtp.password` only if normalized SMTP
and IMAP usernames match and the old SMTP password was empty or equalled the old IMAP password.
Compare old values before patching. Preserve an explicitly different SMTP password and validate any
explicit SMTP change. This fixes fit-report blocker 6: repairing receive must also repair sending
when both credentials were coupled. Return sanitized settings; never reissue a browser cookie with
mailbox credentials. If the mailbox is a login mailbox, host/user identity changes are owner/admin
only, and any stored credential/identity change revokes its owner's sessions and MCP tokens. The
active caller may have to log in again; a successful custom IMAP login creates its new challenge
only after revocation. Blank passwords remain “unchanged”. Test all four entry points.

Account lists sort by display name then normalized e-mail/id. An admin-provisioned owner-less
mailbox with one member is personal in the sidebar (`shared=false`); this presentation rule does not
make it an eligible login mailbox (ownership is still required in §4.2).

### 5.4 Members and admin mailbox management

Manager routes (`requireAccountContext(minRole: "manager")`):

- `GET /api/accounts/[accountId]/members` (viewer) → `{ ok, members }` (no disabled users for viewers/editors; managers see `disabled` (active Better Auth ban)).
- `PUT /api/accounts/[accountId]/members/[userId]` body `{ role }`: target must be an existing,
  enabled user; cannot modify the owner; cannot change own role; cannot grant above `manager`.
- `DELETE /api/accounts/[accountId]/members/[userId]`: cannot remove the owner; cannot remove the
  last remaining manager (owner counts as manager); may remove self otherwise.
- Both write `member.*` audit rows (actor = the manager) and, on revoke, unassign the user in the
  account shard: `UPDATE thread_collab_state SET assigneeUserId = NULL, assignedAt = NULL, updatedAt = ?, lastActivityAt = ? WHERE accountId = ? AND assigneeUserId = ?`
  plus one `unassigned` activity row per affected thread with `actorClientId = 'system'`.
  Invoke `cleanupUserAccountAccess(accountId,userId,actor)` from new
  `lib/membershipCleanup.ts` (team-auth), never import a not-yet-created threadCollab module.
  Stage 1 implementation opens an existing shard without creating collaboration tables, inspects
  sqlite_master, and returns successful `not_installed` if **both** thread_collab_state and
  thread_activity are absent. If only one exists, fail/retain durable cleanup intent; do not silently
  skip a broken schema. When both exist, the seam performs the above unassignment/activity in a
  retry-wrapped immediate transaction. Stage 2 supplies `unassignUserInAccount` behind the same seam
  and tests default + installed schemas. Commit membership/token revoke first and invalidate streams
  immediately; shard failure never restores access. Persist a secret-free cleanup step in
  admin_lifecycle_operations for retry. User deletion enumerates all formerly accessible accounts
  before removing links, then calls the same seam; it remains banned until every step completes.

Admin routes (`requireAdminSessionOr403`, override for everything above, same audit):

- `GET /api/admin/accounts` → the admin's member mailboxes (manager view, sanitized) with `members`.
  Since 2026-10-25 every admin mailbox route is limited to member mailboxes (doc/AUTHENTICATION.md,
  "Administrators: own mailboxes only").
- `POST /api/admin/accounts` body: `Account` without id. Verifies IMAP, requires
  `teamFeaturesSupported()`, `ownerUserId = <creating admin>`. 201 `{ ok, account }`.
- `PUT/DELETE /api/admin/accounts/[accountId]/members/[userId]` (same limits except self-rules).
- `DELETE /api/admin/accounts/[accountId]` → deletes the mailbox (audit `account.delete`).

## 6. Collaboration

### 6.1 Library module `lib/threadCollab.ts` (+ `lib/db/threadCollab.ts`)

```ts
export type ThreadStatus = "open" | "in_progress" | "waiting" | "closed";
export type ThreadCollabState = { accountId; threadId; status; assigneeUserId: string|null; assignedAt: number|null; statusChangedAt: number|null; commentCount; lastActivityAt; updatedAt };
export type ThreadComment = { id; threadId; authorUserId; body; createdAt; updatedAt; deletedAt: number|null };
export type ThreadActivity = { id; threadId; type; actorUserId: string|null; actorClientId; payload: Record<string, unknown>; createdAt };
export type CollabActor = { userId: string | null; clientId: string };

getThreadCollabState(accountId, threadId): Promise<ThreadCollabState>            // default when absent
getThreadCollabStates(accountId, threadIds[]): Promise<Map<string, ThreadCollabState>>
updateThreadCollabState(accountId, threadId, { status?, assigneeUserId?: string|null }, actor): Promise<ThreadCollabState | null>  // null = thread has no messages (404)
addThreadComment(accountId, threadId, body, actor): Promise<{ comment, state } | null>
deleteThreadComment(accountId, threadId, commentId, actor, { allowAnyAuthor }): Promise<{ deleted: boolean; state }>
listThreadComments(accountId, threadId): Promise<ThreadComment[]>
listThreadActivity(accountId, threadId, { limit? }): Promise<ThreadActivity[]>
recordReplySent(accountId, { messageId, inReplyTo, references }, actor)        // resolves threadId, no-op if unknown
unassignUserInAccount(accountId, userId, actor)                                 // §5.4 revoke hook
remapThreadCollab(db, accountId, pairs)                                         // synchronous, §3.2
```

Assigning the same user or setting the same status is a no-op (no activity row, no `updatedAt`
change). Validation of `status` and that `assigneeUserId` is a current enabled member happens in
the route/tool before the shard transaction.

Slice A details: equal merge timestamps are resolved by lexical source `threadId`
(ascending), so the result is independent of input order. Status recency uses
`statusChangedAt` (falling back to `updatedAt`), assignment recency uses `assignedAt`.
A comment edit emits `comment_edited`; editing the same body is a no-op. Comment
edit/delete author overrides require a manager and explicit `allowAnyAuthor`.
An unknown thread returns `null` from mutations for HTTP 404 mapping; list reads
hide orphan comments/activity. Slice B supplies the reply/send hook.

### 6.2 Enrichment and filters

- `Message.collab?: { status: ThreadStatus; assigneeUserId: string | null; commentCount: number; updatedAt: number }`
  (lib/data.ts). Absent means default.
- `app/api/_helpers/enrichMessagesWithThreadCollab.ts`: batched by unique threadId, mutates in
  place, injectable loader for tests. Call sites, explicitly: `listMessagesHandler.ts` (after the
  topics enrichment), `threads/route.ts`, `related/route.ts`, `thread/related/route.ts`,
  `lib/mcpServer.ts` `listMessagesForFolder` and the three `searchMessages` branches. Single-message
  sites use `getThreadCollabState`: `messages/[messageId]/route.ts` and every MCP tool that returns
  one message.
- `applyBadgeFilters(where, args, badges, { viewerUserId })` in `lib/db/messages/query.ts` learns:
  `assigned-to-me` (`0 = 1` when `viewerUserId` is absent), `unassigned`, `open` (no row or status
  not `closed`), `closed`, `in-progress`, `waiting`, all as `EXISTS`/`NOT EXISTS` sub-selects on
  `thread_collab_state tc WHERE tc.accountId = m.accountId AND tc.threadId = m.threadId`. Thread the
  option through `listMessages`, `listThreads`, `getTotalCount`, `getGroupCounts`,
  `listRelatedMessages`, and pass `session.userId` / MCP user id from the handlers.
- Virtual folders (client, `useSearchState.ts`): `virtual:assigned-to-me`, `virtual:unassigned`,
  `virtual:open` with counts. Fix the count request parameter name (`excludeFolderIds`).

### 6.3 REST

All under `app/api/accounts/[accountId]/threads/[threadId]/...`. `threadId` is URL-encoded by
clients (it is usually a Message-ID). Reads need `viewer`, writes `editor`; same-origin JSON check
on writes.

| Route | Method | Body | Response |
|-------|--------|------|----------|
| `.../collab` | GET | – | `{ ok, state, comments, activity, members }` |
| `.../collab` | PATCH | `{ status?, assigneeUserId?: string \| null }` | `{ ok, state }`; 400 unknown status / non-member assignee; 404 thread without messages |
| `.../comments` | POST | `{ body }` | 201 `{ ok, comment, state }` |
| `.../comments/[commentId]` | DELETE | – | `{ ok, state }` (author, or manager) |
| `.../activity` | GET | `?limit=` (default 100, max 500) | `{ ok, activity }` |
| `/api/accounts/[accountId]/members` | GET | – | `{ ok, members }` |

Send integration (fit 12–13, owned by thread-collaboration): direct smtp/send, sendDraftForAccount
and calendar/events/[eventId]/respond return `sentCopy:'appended'|'failed'|'no-sent-folder'` after
SMTP acceptance. Retry APPEND once on a new pooled connection, re-LIST if Sent is missing; prefer
SPECIAL-USE \Sent and restrict fallback to exact top-level/INBOX-child names, excluding Outbox and
substring “sent”. Never retry SMTP after SMTP success. Report Sent-copy failure visibly, not an
unqualified send failure that invites duplicate delivery. After APPEND, ingest the Sent copy on the
server; use UID SEARCH Message-ID if APPEND has no UID. Propagate actor through draft and calendar
send, set \Answered/$Forwarded server-side for replies/forwards from all send entry points, then
recordReplySent; no automatic collaboration status change. Add shard `sent_by(accountId,messageId,
userId,sentAt)` with primary key(accountId,messageId) for new outbound messages as well as replies.
The direct-send/draft/calendar regressions and A→B shared Sent acceptance are go-live checks.

### 6.4 Per-user preferences (`user_account_prefs`)

`GET /api/accounts/[accountId]/prefs` uses the Better Auth-derived `context.userId` plus viewer
membership, never a userId supplied in the body. These rows retain the Noctua users.id mirrored from
auth_user; no preferences move into Better Auth. It returns the stored sparse object. `PUT` has PATCH semantics:
a sparse deep-merge where only present keys are written and `null` deletes a key. The client
sends only keys the user explicitly changed. Shape: `{ layout?: { defaultView? }, appearance?: { dateFormat?, topicColorRows?, senderIcons? }, calendar?: { weekStartsOn? }, threading?: { includeAcrossFolders? }, defaultSignatureId?, notifications?: { newMail? } }`.
Client resolution: defaults < `account.settings` < user prefs, kept in an `effectiveSettings`
value that is never written back to `/settings`. `PUT /settings` and `PUT /api/accounts/[id]` strip
the per-user keys unless the body carries `teamDefaults: true` (the manager "team defaults" form).

### 6.5 MCP tools (`lib/mcpServer.ts`)

Register with `server.registerTool` and output schemas. Apply §4.7 token/account binding before
resolving tools; optional accountId may only repeat the token's mailbox. Actor is
`{ userId: tokenRecord.createdByUserId, clientId: "mcp:<tokenId>" }`. `resolveAccountContext` returns
`role`; mutating tools throw `Insufficient mailbox role` for viewers.

| Tool | Input | Output |
|------|-------|--------|
| `list_mailbox_members` | `{ accountId? }` | `{ ok, members }` |
| `get_thread_collaboration` | `{ accountId?, threadId? \| messageId? }` | `{ ok, threadId, state, comments, activity }` |
| `set_thread_status` | `{ accountId?, threadId? \| messageId?, status }` | `{ ok, state }` |
| `assign_thread` | `{ accountId?, threadId? \| messageId?, assigneeUserId: string \| null }` (`"me"` allowed) | `{ ok, state }` |
| `add_internal_comment` | `{ accountId?, threadId? \| messageId?, body }` | `{ ok, comment, state }` |
| `list_thread_activity` | `{ accountId?, threadId? \| messageId?, limit? }` | `{ ok, activity }` |

Existing `search_messages` / `list_messages_by_folder` gain the new badges and the `collab`
field in their message output schema. `list_accounts` returns `accessRole`. `doc/API.md`
documents REST and MCP.

## 7. UI shell

### 7.1 Stack and setup

Dependencies: `tailwindcss@4`, `@tailwindcss/postcss`, `postcss`, `next-themes`,
`react-resizable-panels`, `class-variance-authority`, `cn` (the generated registry helper), `cmdk` (via shadcn
`command`). `radix-ui` primitives are already present through `@radix-ui/themes`.

Setup order (verified on 2026-10-22 in a throwaway worktree with shadcn 4.22.1, tailwindcss 4.3.3,
next-themes 0.4.6; `bun run build`, `bun run lint`, `bun run test:ci` and the standalone output all
stayed green). ui-shell Slice 1 uses the generated `radix-nova` style and pins `radix-ui` to
1.4.3 so the shell and Radix Themes share one primitive instance; preserve that pin after
`shadcn add`. These are the accepted implementation details for D10:

1. `bun add tailwindcss @tailwindcss/postcss next-themes`; write `postcss.config.mjs`
   (`export default { plugins: { "@tailwindcss/postcss": {} } }`); put the four-line CSS header
   below at the top of `app/globals.css`, wrap the rest in `@layer legacy { ... }`, and delete the
   `import "@radix-ui/themes/styles.css"` line from `app/layout.tsx`. Turbopack accepts
   `@import "..." layer(radix)` in dev and prod.
2. `bunx --bun shadcn@latest init --yes --defaults --css-variables`. The 4.x CLI has no
   `--base-color`; the default preset already writes `baseColor: neutral`. Prefer
   `-b radix` (Radix primitives through the `radix-ui` package, which `@radix-ui/themes` already
   depends on) and fall back to the default preset (`@base-ui/react`) only if `-b radix` fails
   non-interactively; with Base UI, mount its `TooltipProvider` in the layout.
3. The CLI writes `components/ui`, `lib/utils.ts`, and rewrites `app/layout.tsx` with a Geist
   `next/font/google` import. Revert the layout change (no `next/font`), set the aliases in
   `components.json` to `components: "@/app/components"`, `ui: "@/app/components/ui"`,
   `hooks: "@/app/hooks"`, `utils: "@/lib/utils"`, `lib: "@/lib"`, delete the stray `components/`
   directory, then `bunx --bun shadcn@latest add --yes button input label dialog sheet dropdown-menu select tabs badge avatar tooltip separator scroll-area sidebar resizable switch textarea card popover toggle-group skeleton alert table command`.
4. The CLI appends four unlayered blocks to `globals.css` (`@theme inline`, `:root`, `.dark`,
   `@layer base`) and inserts `@import "tw-animate-css"` and `@import "shadcn/tailwind.css"`. Keep
   the imports; replace the appended `:root`/`.dark` values with the Radix-scale mapping below
   (the raw oklch values override the legacy `--border`/`--accent`/`--muted`); delete the
   self-referential `--font-sans: var(--font-sans)` and `--font-heading` lines from `@theme inline`
   and set `--font-sans` explicitly; drop `@import "tailwindcss"` in favour of the two partial
   imports (no preflight).
5. Lint the generated `app/components/ui/**` once and fix warnings so `bun run lint` stays clean.
6. Local dev needs `.env.local` with `IMAP_CREDENTIALS_STORAGE=db`, a random `IMAP_SECRET_KEY`,
   a separate random `BETTER_AUTH_SECRET` (each >=32 characters), `BETTER_AUTH_URL=http://localhost:3000`
   (or the actual local port) and `BETTER_AUTH_TELEMETRY=0`. Leave `NOCTUA_IMAP_LOGIN_HOSTS` unset.
   Production uses `https://mail.example.org`; the preview is separate (§8).

`app/globals.css` structure (no preflight):

```css
@layer theme, base, radix, legacy, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
@import "@radix-ui/themes/styles.css" layer(radix);
@custom-variant dark (&:where(.dark, .dark *));

@font-face { font-family: "Inter"; src: url("/fonts/InterVariable.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }

@theme inline static { /* shadcn colour/radius/font mapping: --color-background: var(--background) ... --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif; --radius-sm: calc(var(--radius) - 4px); --radius-md: calc(var(--radius) - 2px); --radius-lg: var(--radius); */ }
:root { /* shadcn tokens from :root-scoped Radix scales: --background: #fff; --card: #fff; --popover: #fff; --sidebar: var(--gray-2); --foreground: var(--gray-12); --primary: var(--iris-9); --primary-foreground: #fff; --muted: var(--gray-3); --muted-foreground: var(--gray-11); --border: var(--gray-6); --input: var(--gray-6); --ring: var(--iris-9); --radius: 0.5rem; ... never --accent-N / --space-N here */ }
.dark { /* same names; --background: oklch(0.145 0 0); --card/--popover/--sidebar: oklch(0.205 0 0); --border/--input/--sidebar-border: rgb(255 255 255 / 10%); other neutral steps from gray-dark */ }
:root { /* legacy aliases: --bg, --surface, --surface-1/2/3, --text, --muted-foreground, --link, --input-bg/fg, --mail-view-bg/fg, --list-row-* (from --iris-*/--gray-*), --shadow, --quote-2 */ }
.radix-themes { --color-background: var(--background); --color-panel-solid: var(--card); --color-surface: var(--card); --default-font-family: "Inter", system-ui, sans-serif; }

@layer base {
  /* minimal, scoped reset so Tailwind border utilities work without preflight */
  :where([data-shell], [data-slot]), :where([data-shell], [data-slot]) *, :where([data-shell], [data-slot]) ::before, :where([data-shell], [data-slot]) ::after { box-sizing: border-box; border-width: 0; border-style: solid; border-color: var(--border); }
  :where([data-shell], [data-slot]) button { cursor: pointer; }
}

@layer legacy { /* the remaining upstream globals.css content, with the shell rules (.app-shell, .content-grid, .pane, .resizer, .auth-*) removed */ }
```

Rules:

- Codemod before anything else, anchored: `\bvar\(--muted\)` → `var(--muted-foreground)`,
  `\bvar\(--accent\)` → `var(--link)` (never touch `--accent-N`/`--accent-aN`), `--accent-2` →
  `--quote-2`; delete the unused `--accent-2-strong/-bg/-border`. Legacy `--radius-sm/md/lg` are
  redefined from the shadcn radius (4/6/8px); the slight change for md/lg is accepted.
- Palette: pure neutral gray; white light surfaces and a gray-2 sidebar on the near-white
  canvas. The single soft accent is iris: primary/sidebar-primary = iris-9 with white text
  (sRGB `#5b5bd6`, 5.37:1 contrast), ring/sidebar-ring = iris-9 in light / iris-11 in dark, chart-1..5 = iris-6/8/9/10/11,
  link = iris-11. Limit accent to primary buttons, active sidebar indicators, focus rings, links,
  unread dots/badges and selected rows. Selected rows use iris-3/4 tints with subtle borders;
  navigation hovers stay gray. Legacy surface/list/input/quote aliases follow the same palette.
- Fonts: vendor Inter Variable (OFL) at `public/fonts/InterVariable.woff2` with the licence file next
  to it. No `next/font` (server builds must stay hermetic). `HtmlMessage.tsx` injects the
  same `@font-face` with the absolute `/fonts/...` URL into the srcdoc and uses the family; the
  compose editor uses the family through the token.
  Superseded in 2026-10: the app uses the platform UI font stack (`-apple-system, BlinkMacSystemFont,
  "SF Pro Text", …` in `--font-sans` and `lib/ui/fonts.ts`); Inter and `public/fonts` were removed.
- `<Theme accentColor="iris" grayColor="gray" panelBackground="solid">` stays in the root layout.
  `<html suppressHydrationWarning>`, `ThemeProvider attribute="class" storageKey="noctua:theme" enableSystem`
  (users without a stored value follow the OS theme); the header menu offers light / dark / system. `darkMode` for the kept renderers comes
  from a `useSyncExternalStore` over `document.documentElement.classList` (correct on the first
  client render, so the HtmlMessage iframe is built once). Remove the manual `.dark` toggling in
  MailClient and the detached windows.
- Portals: shadcn `Sheet`/`Dialog`/`Popover` content that hosts kept Radix components wraps its
  children in Radix `<Theme asChild>` so `.radix-themes`-scoped tokens exist inside the portal.
  Custom `createPortal` calls keep `document.querySelector(".radix-themes")` as container.
- z-index ladder (document it in globals.css): calendar panel 9990 < shadcn overlays and dialog
  content `z-[9994]` < Radix dialog overlay 9995 < shadcn and Radix popper content 9998. The dead
  `.auth-overlay` 9999 rule is removed with `LoginOverlay`.
- `100vh` → `100dvh` everywhere in the shell.
- A bun test compiles `app/globals.css` through `@tailwindcss/postcss` and asserts the layer order
  and that `.rt-BaseDialogOverlay { z-index: 9995 }` survives.

### 7.2 Layout

`app/components/shell/AppShell.tsx` replaces the `div.app-shell` / `section.content-grid` markup
in `MailClient.tsx`. MailClient keeps all data state and handler bags; the shell owns layout,
theme, and navigation state. The `data-shell` attribute goes on the shell root, the login screen
root, and the admin panel root.

Desktop (`md` and up), following the shadcn dashboard-01 inset layout:

- `SidebarProvider` defines `--sidebar-width: 18rem` and `--header-height: 3rem` on the
  `data-shell` root (`100dvh`). `Sidebar variant="inset" collapsible="offcanvas"` sits on a
  near-white canvas. `SidebarInset` holds the 48px site header, resizable content and compact
  status bar; it is white, rounded-xl and subtly shadowed in light mode. Content uses an 8px
  grid with calm `bg-card`, subtle borders and shadow-xs pane frames.
- Sidebar header: app mark + title from `lib/appBranding.ts`, then a prominent Compose button
  and a secondary "Check all folders for new mail" icon button calling
  `syncAccount(undefined, "new")`. Drafts remain reachable. Sections: "My mailboxes" (`!shared`),
  "Shared mailboxes" (`shared`), each row = avatar + name with e-mail tooltip and badge slot;
  rows use stable display-name/normalized-e-mail/id order, and sections with more than six mailboxes group by e-mail domain. Optional `accessRole`,
  `isOwner`, `shared` fields arrive with feat/team-auth; absent `shared` means personal.
  Clicking a mailbox calls `switchAccount`, persisting `switch-account` before dependent requests.
  Stage 3 adds watcher-fed summaries (§9). Views: Inbox, Focused, Action queue and Invite deck
  retain their counts; an explicit empty slot reserves Assigned to me / Unassigned / Open for
  feat/collab-ui. Then Topics and the existing folder tree (token styling; desktop drag-and-drop).
- Sidebar footer: NavUser-style avatar, user name and e-mail with Settings, Admin (admin only),
  "Profile & security" entry (disabled only until the Slice 7 Better Auth client lands), developer
  tools "Show thread JSON" / "Evict thread cache", and Log out. The person is separate from the active mailbox.
- List + reading pane: `ResizablePanelGroup` with `useDefaultLayout({ id: "noctua:panes",
  panelIds, storage })` (v4 has no `autoSaveId`/`order`). Stable ids `list`, `reader`, `calendar`
  and fixed render order allow separate persisted layouts with/without the conditional calendar.
  `MessageListPane` fills its panel (`width: 100%`); a `ResizeObserver` on `listPaneRef` feeds
  `listWidth` in MailClient and still drives `listIsNarrow`.
  Pane chrome lives in the CSS modules because those unlayered rules beat utilities.
- Header: SidebarTrigger, vertical Separator, current mailbox name + folder, then the message list's
  toolbar (count, view menu, sort & group menu, expand/collapse all; the header is a
  `@container/header` so the count and sort label drop out when narrow); right-aligned search
  with the existing field/badge filters in a Popover, sync indicator and light/dark/system menu.
  AppShell provides the TooltipProvider (the installed SidebarProvider does not include one).

Mobile (below `md`):

- Navigation state is derived, not tapped: the shell derives `view = "thread"` from
  `viewMessage?.id` even during SSR; an effect on mobile pushes `history.state.noctuaMobileView = "thread"`.
  It derives `view = "list"` when `viewMessage` becomes null or Back leaves the thread entry.
  Each open mobile Sheet (including sidebar and settings) adds an overlay history entry; Back
  dismisses the top Sheet before leaving the thread. Closing a Sheet also removes its history entry.
  The in-app back button calls
  `history.back()` when `history.state?.noctuaMobileView` is set, otherwise `setViewMessage(null)`.
  Both panes stay mounted; visibility is CSS (`hidden md:flex`), so `listPaneRef`, `messageRefs`,
  virtualization, and `noticePaneRightOffset` keep working and nothing flips after hydration.
- `MessageViewPane` shows a compact header with the back button on mobile.
- Sidebar opens as a sheet from the header menu button. The mobile header keeps only the
  trigger, title, the list's view and sort menus (hidden while a message is open), search and
  indicator menu; theme choices move into the user menu.
- Compose: `ComposeOrchestrator` gets an `isMobile` input. On mobile `openCompose` and the
  `setComposeView` wrapper coerce `inline`/`minimized` to `modal`; dock, minimize, and
  open-in-window controls are hidden; `.modal-backdrop`/`.composeModal` become `100dvw × 100dvh`
  below `md` and `composeSize` is ignored. The mobile frame is a labelled modal Dialog with
  trapped focus, Escape dismissal and focus restoration. ui-shell also owns ComposeFields.tsx:
  render the From row in **every** variant (remove inline-only showFrom); add modal DOM regression.
  The fix already in progress on feat/ui-shell satisfies this ownership; auth agents must not
  duplicate it. `sendMailRace.dom.test.tsx` covers the prop.
- Message list rows: sender above subject, date aligned right, a reserved "more" button and
  an 8px unread glyph with an invisible 44px hit area. Thread/table/Compact rows and their virtualizer
  share a 72px mobile height. Below a 600px list-pane width, desktop thread/table rows
  also use the two-line layout and 72px spacing; wider panes keep their desktop density.
  Compact keeps two text lines with separate unread, selection and action hit areas; Table
  retains its per-row selection checkbox. Reader sender/date metadata stacks.
- Status bar hidden. Its panels (process status, mail check, reminders, exceptions) and the
  calendar open from the header indicator menu into a `Sheet`; `openBottomStatusPanel` routes
  there on mobile, including the PWA `?openCalendar=1` handler; the calendar sidebar is a
  full-screen `Sheet` on mobile. Closing a status Sheet returns focus to the header indicator;
  calendar "Find related" clears the selected message so the results list is visible.
- Settings open as a full-screen sheet with a vertical tab list whose long labels wrap.

### 7.3 Collaboration UI (branch `feat/collab-ui`)

- `ThreadCollaborationBar` in the reading-pane header: assignee `Combobox` (members, "Me",
  "Unassigned"), status `Select` (Open / In progress / Waiting / Closed), comment count, and an
  "Internal note" button. Reads and writes through a
  `useThreadCollab(accountId, threadId)` hook (one new file) that also exposes the members list.
- `InternalNoteComposer`: textarea (markdown) + "Add note"; posts to `.../comments`. It is a
  separate component, not a `ComposeMode`.
- `ThreadActivityPanel`: comments and activity in one timeline below the thread; comments render
  markdown through the existing `MarkdownPanel`/`react-markdown` path; author avatar (initials),
  relative time, delete for the author or a manager.
- List rows: assignee avatar (initials, tooltip name) and a status chip after the topic badges,
  shown only when the state is non-default, keyed by `message.threadId`. The data arrives through
  `Message.collab`; MailClient keeps a `threadCollabById` map and an `applyThreadCollabUpdates`
  helper mirroring the topics pattern.
- Colours: open = neutral, in_progress = indigo, waiting = amber, closed = green.
- Revoked or disabled assignees render as "Former member" from a cached members list.

### 7.4 Login, enrollment and security UI (branch `feat/ui-shell`, contract §4)

`app/components/auth/LoginScreen.tsx` replaces LoginOverlay. Visual direction: shadcn `login-01`
style centered Card, max width about 24rem, quiet neutral-gray background/border and the shell's
soft iris accent for the primary button/focus ring. This follows feat/ui-shell's current palette;
§7.1 defines the shared gray/iris palette. Reuse shell tokens, Card, Button, Input, Label,
Alert and InputOTP primitives. No separate brand palette, hero illustration or custom auth theme.
It must work in light/dark mode and on a narrow phone with the keyboard open.

State contract: loading → unauthenticated login/invite → pending TOTP challenge → restricted MFA
enrollment → authenticated/no-memberships, authenticated/unselected, or authenticated/mail. The client never infers success solely
from HTTP 200: inspect `twoFactorRedirect`, then refresh `/api/auth/me`. A challenge is not a session.

- Main form: E-mail (`type=email`, `autoComplete="username webauthn"`) and App password
  (`autoComplete="current-password"`), primary “Sign in”; a separate “Sign in with a passkey” button.
  Start conditional UI only when supported, using `authClient.signIn.passkey({autoFill:true})`;
  cancel its pending request before an explicit passkey action or navigation. If unsupported or the
  user cancels, keep the password form usable without treating cancellation as a server error.
- Optional “Use my personal mailbox password” action selects `/api/ba/sign-in/imap`; hide it by
  default and show it only when the server reports that the operator enabled it with a nonempty
  `NOCTUA_IMAP_LOGIN_HOSTS` allowlist; return availability only, never the allowlist itself.
  Label the method clearly and never silently fall back between IMAP and app passwords. Server-side
  eligibility still excludes every shared mailbox (§4.2); client visibility never authorizes login.
- TOTP challenge Card: single code field (`inputMode=numeric`, `autoComplete="one-time-code"`),
  Verify, “Use a backup code”, Back to sign in. A backup-code view uses a text field. Display wrong
  code inline, distinguish expiry/429 and preserve the challenge. Never set `trustDevice:true`.
- Invite view: invite code, personal e-mail, name, app password + confirmation (`new-password`).
  Keep IMAP credentials out of this form; optional mailbox setup can follow enrollment. A 409
  mailbox_exists message never suggests takeover. No user choice of admin role.
- Mandatory enrollment Card after signup/migration or audited MFA reset: current credential proof → TOTP QR/manual
  setup → verification → backup codes saved → optional passkey. Enrollment cannot dismiss into mail.
  Show codes once with accessible copy/download controls; erase them from component state on exit.
- Only mailboxState=none (zero memberships) after enrollment: render “No mailbox yet”, “Add a mailbox” (reuse AccountTabContent
  in a dialog, POST /api/accounts) and “Ask your admin”. For mailboxState=unselected show the
  accessible mailbox picker/retry, persist selection before calendar/import. This is separate from
  login failure. `/reset-password` is a public page with the exact §4.4 callback/redemption contract;
  ui-shell owns page, ResetPasswordForm.tsx and DOM coverage, including handover→reset→MFA login.
- `SecuritySettings.tsx` is reachable from the user menu even with no active mailbox: passkey list/
  add/rename/remove, TOTP replacement and backup-code regeneration, app-password change, current/
  other sessions and revoke. A re-auth dialog collects the current credential and factor when needed
  and uses the purpose-bound one-use proof (§4.4); stale sessions offer full re-login for Better Auth
  freshness. Never offer to disable mandatory TOTP with a session alone.
- Error handling: generic login error; inline INVALID_CODE/INVALID_PASSWORD in security forms;
  429 with retry feedback; 403 mfa_enrollment_required selects setup; missing /me session selects login.
  Narrow MailClient's old “any /api/auth 401 logs out” heuristic as in §4.6. authClient uses /api/ba;
  Noctua wrappers keep their `{ok,...}` envelopes, while Better Auth's payloads are used directly.
- Keyboard focus moves to the challenge/enrollment heading, pending state prevents duplicate submits,
  errors are announced, and all controls have labels. Do not store passwords/TOTP/backup codes in
  localStorage, URL params or mail compose state.

### 7.5 Settings and admin (branch `feat/collab-ui`)

- Settings dialog keeps the existing tab contents inside a shadcn `Dialog`/`Sheet` frame (wrapped in
  `<Theme asChild>`) with a vertical tab list. Tabs per role: Account (manager), Signatures
  (manager; personal default signature in Preferences), Preferences (all; writes user prefs),
  Categorization, Topics, Calendar (manager), Translation (manager), Recipient aliases, MCP
  (editor+), Members (manager, uses the §5.4 manager routes). Personal security is a user-menu
  destination, not a mailbox-specific tab.
- `AdminPanel` remains available without an active mailbox. Users: issue targeted invite, role,
  enable/disable, security summary (password configured, TOTP active, passkey count), revoke sessions,
  initiate recovery and audited MFA/passkey reset. It calls only Noctua management routes (§4.5).
  No raw Better Auth admin client and no impersonation action. Password resets hand over a single-use
  recovery link for personal handover, not an admin-chosen password or SMTP message. Confirm destructive changes and show last-admin errors.
- Mailboxes, member roles, Invites and read-only Audit log keep their existing scope. Audit entries
  show security/lifecycle outcomes with actor/target/time and no credentials or recovery URLs.

## 8. Compatibility and migration

This fork integrates its feature branches locally; it does not target upstream pull requests.

- Back up the master DB, shards and encryption/auth secrets before cutover. New sessions deliberately
  invalidate `noctua_session` and existing MCP tokens; expire the old browser cookie and remove old
  token rows. Keep IMAP_SECRET_KEY for existing mailbox encryption; removing SESSION_SEAL_KEY does
  not decrypt or migrate mailbox secrets. Credential recovery is part of the runbook before go-live.
- Existing Noctua profiles keep IDs, owner/membership links, audit, prefs and shard references.
  Existing user_accounts links default to manager. An operator-run `scripts/migrateTeamAuth.ts`
  creates auth identities from reviewed personal users, preserving roles and timestamps (converted
  to ISO for Better Auth). Never let an unauthenticated invite claim an existing user e-mail.
  Resolve case/whitespace duplicate identities and shared-address users explicitly; log IDs rather
  than personal addresses. Startup normalization remains nonfatal, but ambiguous identities cannot
  sign in until repaired. Users with no users row (old account-id session fallback) require explicit
  operator identity/membership mapping; never synthesize an admin from a stored mailbox password.
- If a development install already has slice-1 password hashes, import valid argon2id hashes into
  auth_account(providerId=credential), keep user-chosen credentials only, and discard any temporary
  admin-assigned password in favour of recovery. Old auth columns remain inert; don't rebuild users
  just to drop them. Transfer disabledAt to a permanent ban, and read name from auth_user after a
  one-time import. Remove obsolete helpers/reads and test migration twice.
- Each existing person chooses a provider-independent app password through operator-approved
  recovery, or may first authenticate via an eligible login mailbox if D3 is enabled. The latter
  still reaches restricted TOTP enrollment and credential-proof checks. Require the admin's fallback
  app password before completion. All users enroll TOTP; backup codes are handed over/saved offline.
- Cookie credential mode is dropped. Startup rejects IMAP_CREDENTIALS_STORAGE=cookie with an explicit
  migration message. `both` maps to db with a deprecation notice, and db is the default. For a former
  cookie-only install, re-enter and verify mailbox credentials into the encrypted DB before removing
  the old deployment; there is no silent import from arbitrary client cookies. Delete the global
  credential overlay and remove session credential branches from all consumers.

### 8.1 Environment and canonical HTTPS deployment

| Environment / setting | Required deployment value or policy |
|---|---|
| `BETTER_AUTH_SECRET` | Independent random secret, >=32 characters; back up offline; no generated desktop default |
| `BETTER_AUTH_URL` | `https://mail.example.org` (path-free canonical origin) |
| `PASSKEY_RP_ID` / passkey `rpID` | `mail.example.org`; defaults to the canonical hostname, without scheme/port/path |
| Better Auth `trustedOrigins` | Explicit canonical origin `https://mail.example.org`; no wildcard or Host reflection |
| `NOCTUA_TRUSTED_ORIGINS` | Unset; only the configured canonical origin is accepted; extra origins fail startup |
| `IMAP_SECRET_KEY` | Retain the existing independent at-rest encryption key |
| `IMAP_CREDENTIALS_STORAGE` | `db` only; `both` is a deprecated alias for `db`; `cookie` fails startup |
| `NOCTUA_IMAP_LOGIN_HOSTS` | Unset/empty = OFF (deployment default); only a nonempty explicit exact normalized hostname allowlist enables the optional personal IMAP method; shared mailboxes remain forbidden |
| `NOCTUA_DESKTOP_MODE` | Unset/false; `true` fails startup because desktop mode is removed |
| `BETTER_AUTH_TELEMETRY` | `0`, together with `telemetry:{enabled:false}`; keep `BETTER_AUTH_TELEMETRY_ENDPOINT` unset |
| `advanced.ipAddress.trustedProxies` | Configure the actual reverse proxy chain; never trust arbitrary forwarded headers |

- Canonical hostname `mail.example.org` has DNS A `<tailnet-ip>`, the server's Tailscale IP.
  Service access is inside the tailnet only; a public DNS record does not make it publicly reachable.
  Terminate HTTPS at the reverse proxy with a trusted certificate obtained and renewed via DNS-01
  using the DNS provider's API. DNS-01 requires no public HTTP challenge endpoint. Keep DNS API credentials
  in the deployment secret store, never source control or logs; the deploy owner records actual
  proxy addresses and certificate-renewal configuration before cut-over.
- `https://preview.example.org:3790` is a separate, non-canonical development preview origin.
  Do not add it to canonical production trusted origins or use it as the production RP ID. A preview
  instance uses its own `BETTER_AUTH_URL`, hostname RP ID `preview.example.org` (no port),
  explicit preview trusted origin, isolated auth data/secrets and separately enrolled test passkeys.
  Canonical passkeys are used at `https://mail.example.org` only; trusting an origin does not make
  its unrelated hostname equivalent to an RP ID. Localhost test/dev origins (§7.1/§10.1) likewise
  remain isolated exceptions, not alternative production hostnames.
- Enroll real passkeys only at the canonical HTTPS origin, including on both phones/PWAs. Changing
  host/RP ID can require re-enrollment. Back up the Better Auth secret because it also encrypts
  TOTP/backup codes; use Better Auth's supported versioned-secret rotation procedure only after a
  restore/rotation test. Systemd must not set BETTER_AUTH_TELEMETRY=1: the env flag can enable
  telemetry even when the config option is false. Log no secrets.

### 8.2 Supported runtime and migration checks

- Tauri/desktop mode is dropped and unsupported. `NOCTUA_DESKTOP_MODE=true` fails startup with a
  clear supported-mode message. Remove desktop build claims, generated-secret and loopback-origin
  carve-outs, `useIsDesktop` authentication exceptions and the signup invite exemption. No silent
  legacy cookie fallback. Browser windows on a desktop remain part of the supported web UI (§7.2).
- Recovery uses the §4.4 admin/operator 15-minute single-use link with personal handover; no SMTP
  recovery sender/configuration or public reset-request route ships in this stage. Public token
  redemption remains enabled when the completed policy handler is activated.
- Next 16 bundles instrumentation and route graphs separately: getAuth is memoized per module graph,
  not a promise of one instance per OS process. Startup migrates once; the request graph may open
  its own dedicated handle and runs an empty migration plan. Idempotence is required; multiple
  simultaneous processes/schema upgrade races need an external migration step/lock before serving
  and are outside the one-systemd-process target. `nextCookies` is for Server Actions; wrappers
  using auth.api still forward returnHeaders explicitly. No edge runtime for bun:sqlite.
- Every implementation branch passes bun run test:ci, test:stress for concurrency/mock-sensitive
  paths, bun run build, targeted lint with no new warnings and bunx tsc --noEmit compared to the
  baseline (pre-existing bun:test and unrelated test-type errors are not hidden as a clean tsc run).

## 9. Work breakdown (branches)

Sender-identities handoff: [Slice 1 contract and slices 2/3 boundary](SENDER-IDENTITIES.md),
source design `briefs/sender-identities-design.md` §§2–7, 9. Slice 1 is configuration,
metadata and recognition only; outgoing From remains primary. Its fix branch is
not merged wholesale: port it after the integration owner finalizes collaboration
`133bddc`, watcher `bd7eb5f` and collab-ui `1d0f0ce`. Preserve the collaboration writer
lock/remap/messageRowIds contracts; capture exact-copy identity metadata inside
that lock, repair legacy authors before summaries, and preserve watcher summary/
UIDVALIDITY hooks. Run combined identity/collaboration/watcher regressions after
porting. Send/draft/RSVP/MCP authorization belongs to Slice 2; compose/settings/
signature insertion and refresh belong to Slice 3 after prior-owner handoff.
This records the handoff plan, not completed integration acceptance.

Branch names are fixed so parallel agents can reference each other. Integration branch:
`team-inbox`. `main` tracks upstream.

Stage 1 (parallel): `feat/team-auth` and `feat/ui-shell`.
Stage 2 (after `feat/team-auth` merges): `feat/thread-collaboration` and `feat/mailbox-watcher`.
Stage 3 (after Stage 1 and relevant Stage 2 contracts merge): `feat/collab-ui`, conditional
`feat/sender-identities` after compose ownership handoff.
Stage 4: `chore/mailplus-cutover` (integration/deploy owner), after every §1.1 criterion passes.
It owns the executable migration/backup/restore runbook (§11) and final household sign-off.

| Branch | Scope | Owns (no other branch touches these) |
|--------|-------|--------------------------------------|
| `feat/team-auth` | §3.1, §4, §5, §6.4 server side, `doc/AUTHENTICATION.md` | `lib/auth.ts`, `lib/accountAccess.ts`, `lib/betterAuth.ts`, `lib/betterAuthImapSignIn.ts`, `lib/authPolicy.ts`, `lib/authStreams.ts`, `lib/membershipCleanup.ts`, `lib/userProvisioning.ts`, `lib/userLifecycle.ts`, `lib/db/authPolicy.ts`, `lib/db/userProvisioning.ts`, `lib/db/userLifecycle.ts`, `lib/mailboxCredentials.ts`, `lib/testAuthHarness.ts`, `lib/db/connection.ts` (auth handle), `scripts/{migrateTeamAuth,recoverTeamAuth}.ts`, `lib/credentials.ts`, `lib/secret.ts` (storage-mode enforcement), `instrumentation.ts`, `lib/db/users.ts`, `lib/db/userAccountPrefs.ts`, `lib/db/adminAudit.ts`, `lib/db/schema.ts` (master part), `lib/db/rowParsers.ts`, `lib/db/accounts.ts`, `lib/db/mcpTokens.ts`, `lib/accountPresentation.ts`, `app/api/auth/**`, `app/api/ba/**`, `app/api/admin/**`, `app/api/_helpers/accountContext.ts`, `app/api/_helpers/requestOrigin.ts`, `app/api/_helpers/syncJobs.ts`, `app/api/_helpers/recomputeJobs.ts`, `app/api/messages/listMessagesHandler.ts` (guard only), `app/api/accounts/route.ts`, `app/api/accounts/[accountId]/{route.ts,settings,relogin,mcp-tokens,members,prefs,compose/recipients,sender-icon,destination-folders,messages/copy-to-account}/**`, the guard lines of every other route in §5.2, `lib/data.ts` (`User`, `Account.accessRole/isOwner/shared`), auth dependency pins in `package.json`/`bun.lock`, test auth preload and affected route fixtures |
| `feat/ui-shell` | §7.1, §7.2, §7.4, theming, mobile, settings frame, client handling of `accountId: null`, MFA challenge/enrollment and re-authentication | `package.json` shell deps (coordinate with auth pins), `postcss.config.mjs`, `components.json`, `app/globals.css`, `app/layout.tsx`, `public/fonts/**`, `app/components/ui/**`, `app/components/shell/**`, `app/components/auth/**`, `lib/authClient.ts`, `app/reset-password/**`, `app/hooks/**`, `lib/utils.ts`, `MailClient.tsx` (layout, theme, width state, me/no-account handling, render tree), `useAccountController.ts`, `TopBar.tsx` (replaced), `FolderSidebarPane.tsx`/`FolderPane.tsx`/`FolderTree*.css`, `AccountSettingsModal.tsx` (frame), `mailclient/composition/{ComposeOrchestrator,ComposeModal,ComposeMinimized,ComposeFields}.tsx`, `Compose.module.css`, `useComposeController.ts`, `messagelist/{MessageListPane,MessageListOrchestrator,MessageListHeader}.tsx` + css, `message/MessageViewPane.tsx` + css, `status/BottomStatusBar.tsx`, `message/MessageMenu.tsx` (frame only), `status/{ProcessStatusPopover,UpcomingStatusPopover,ExceptionStatusPopover}.tsx` (frame only), `InAppNoticeStack.tsx`, `HtmlMessage.tsx`, the token codemod across CSS modules, `app/{compose,message,calendar}/window/**` theme hookup |
| `feat/thread-collaboration` | §3.2, §6.1–6.3, §6.5, `doc/API.md` | `lib/threadCollab.ts`, `lib/db/threadCollab.ts`, `lib/db/schema.ts` (shard part), `lib/db/threads.ts` (remap), `lib/db/messages/upsert.ts` (remap hook), `lib/db/messages/query.ts`, `app/api/_helpers/enrichMessagesWithThreadCollab.ts`, `app/api/accounts/[accountId]/threads/[threadId]/**`, `lib/mcpServer.ts`, `lib/data.ts` (`Message.collab`), `listMessagesHandler.ts` (viewer id), `threads/route.ts`, `related/`, `thread/related/`, `messages/[messageId]/route.ts`, `smtp/send/route.ts`, `lib/drafts.ts` (full send path), `lib/specialFolders.ts`, `drafts/save/route.ts`, `calendar/events/[eventId]/respond/route.ts`, `lib/crossAccountCopy.ts` (preserve internalDate) |
| `feat/collab-ui` | §7.3, §7.5, mailbox summaries/SSE, default signatures, virtual folders, prefs, role-aware UI | `app/components/collab/**`, `app/components/admin/**`, `app/hooks/useThreadCollab.ts`, `useSearchState.ts`, list row components, `MessageViewOrchestrator.tsx` header, Preferences/Admin/Members tab contents, the `collab` prop bag in MailClient, `app/api/me/{mailboxes/summary,events}/**`, `lib/mailboxSummary.ts`, `DetachedComposeWindowClient.tsx` and `useComposeController.ts` signature behavior after ui-shell handoff |
| `feat/mailbox-watcher` | §1.1 fit 11; bounded sync and background freshness | `lib/mailboxWatcher.ts`, `lib/syncWorkerSemaphore.ts`, `lib/syncJobs.ts` worker admission, `instrumentation.ts` watcher hook after team-auth handoff, extraction of INBOX IDLE/poll core from `imap/stream/route.ts`; reuse authStreams for browser delivery |
| `feat/sender-identities` | §1.1 fit 16 if inventory requires aliases | manager-owned identities/schema/routes, `identityId` validation for direct/draft/calendar send, From Select and one `getOwnAddresses(account)` helper across compose/reply/thread/classifier/calendar; acquire send/compose files after prior owners merge |
| `chore/mailplus-cutover` | §1.1 fit 9,17,18; §11 | `doc/MAILPLUS-CUTOVER.md`, `scripts/backupTeamInbox.ts`, restore acceptance script, systemd example/timer, measured provider inventory and signed acceptance checklist; never another branch's live worktree |

`spike/better-auth` owns the isolated evidence/report, not production integration. feat/team-auth
ports reviewed pieces on top of 6fee1b8 according to `doc/TEAM-AUTH-PLAN.md`; do not cherry-pick
the spike as a finished auth replacement (the old stack still runs there). feat/ui-shell owns the
login/security client (§7.4); feat/collab-ui owns the admin security UI (§7.5). feat/team-auth owns
MCP token validation/minting in lib/auth.ts and the authInfo/account-binding lines in lib/mcpServer.ts;
feat/thread-collaboration keeps the actual tool registrations. Coordinate that small overlap.


Watcher contract: gate startup on `teamFeaturesSupported()` and `NOCTUA_MAILBOX_WATCHER=1`.
One server INBOX IDLE/account plus periodic account-wide `runNewMailCheck` fallback keeps inactive
mailboxes and Sent current. Honor connect-breaker backoff. Before spawning any worker (interactive,
watcher, repair/full), acquire a global process semaphore controlled by `NOCTUA_MAX_SYNC_WORKERS`
(default 2; tune only after measurement); priority interactive > watcher > repair/full, release on
exit/error/timeout/cancel. The cap is global across Next module graphs: the watcher branch adds
master `sync_worker_leases(slot INTEGER PRIMARY KEY,jobId TEXT UNIQUE,ownerInstance TEXT,pid INTEGER,
expiresAt INTEGER)` and atomically reserves a free slot in 1..configured cap before every bun.spawn.
Use the same DB retry boundary; no module-local count bypass. A queued job has no child process yet.
Lease heartbeat/owner-instance recovery must prove the recorded process has exited before reuse;
expiry alone cannot create a fourth live worker. Shutdown/timeout stops only recorded owned PIDs,
releases after exit, and restart reaps stale leases safely. Test four concurrent admission callers
from independently imported graphs plus child-failure/restart scenarios. One account's sync serialization remains. No duplicate schedulers per
Next module graph: one startup owner/DB lease, not a graph-local boolean. Test cap, starvation bound,
restart lease recovery and idle shared-mailbox delivery without a visible browser.

Stage 3 summary contract: `GET /api/me/mailboxes/summary` fans out **only** over
listAccessibleAccountsForUser, returns per-mailbox INBOX unread + assigned-to-me + unassigned-open
counts. `/api/me/events` is per-user SSE guarded through authStreams on each enqueue. Watcher changes
refresh those summaries and non-active-mailbox notices; never expose global listAccountIdsFromMaster.
Per-user default signatures resolve through effectiveSettings at normal and detached compose entry
points and auto-insert for new/reply/forward, not reopened drafts. Expand {{user.name}}/{{user.email}}
using getSignatureBlocks. Handoff these files after ui-shell; keep one owner at a time.

Known trivial conflicts: `lib/data.ts` and `lib/db.ts` (barrel exports) are touched by both
backend branches.

## 10. Testing requirements

Review IDs below refer to the revision log. In addition to the retained suite, add regressions for
S1–S8/F1–F10/I1–I11 in their owning slices: two-session MFA activation; partial verified-record
writes; seed-export/code-regeneration stolen-session rejection; credential-trigger callback failure;
concurrent mirror rollback; pending challenges after password reset/IMAP repair/revoke; rotation
preserves authenticatedAt; lost-phone→two separately consumed backup codes→new TOTP; invite precheck
zero network; deletion/reinvite and repeated recovery journals; open-stream revocation; selected,
unselected and zero-membership states; actor≠target admin name update; absent/false password-change
revocation flag; bodyless logout cookie deletion; role-aware mailbox failures; modal From row.

### 10.1 Executable WebAuthn browser harness (team-auth Slice 4, ui-shell Slice 7 integration)

These paths/commands are **deliverables**, absent from the spike; options unit tests are insufficient.
Add pinned dev dependency `@playwright/test`, `playwright.auth.config.ts`,
`tests/browser/auth/webauthn.spec.ts`, `tests/browser/auth/fixtures.ts`, and
`scripts/runAuthBrowserTests.ts`. package script `test:auth-browser` =
`bun scripts/runAuthBrowserTests.ts`; run after `bunx playwright install chromium`.
The script creates an isolated synthetic NOCTUA_DATA_DIR, sets test secrets, db storage,
BETTER_AUTH_URL=http://localhost:3784 and PASSKEY_RP_ID=localhost, builds/starts Bun Next at port 3784
(or runs the existing freshly built bundle), waits for readiness, runs
`bunx playwright test --config=playwright.auth.config.ts`, and stops only its own child PID in finally.
No reuseExistingServer; fail on occupied port. Seed through an in-process helper before startup,
never add a network test-admin/seed endpoint. No real mailbox connections and no production data.
Use Chromium CDP WebAuthn.enable/addVirtualAuthenticator (ctap2, internal transport,
hasResidentKey:true, hasUserVerification:true, isUserVerified:true). Perform real navigator
credentials.create/get through the client, then setUserVerified(false) for an assertion: expect
server rejection and no assured session. Test registration UV=false rejection using a synthetic
browser ceremony with preferred UV so it reaches server verification (the production required hint
may reject earlier). Check RP-ID/foreign-origin rejection, options/verification grant binding,
wrong-session/replay and post-login /me assurance. Disable HAR, screenshots and traces while passwords, QR/backup codes or reset tokens are visible;
only capture sanitized post-auth states. The minimal fixture is intercepted with Playwright page.route
and fulfilled at the same localhost origin; no server fixture route is installed. `fixtures.ts` drives
navigator.credentials and the BA HTTP endpoints with base64url conversion, not a fake callback. Harness does not replace both-phones canonical HTTPS acceptance.
Release command: `bun run test:auth-browser`; Slice 4 uses a minimal fixture page internal to the
browser harness (no shipped route); Slice 7 exercises actual ui-shell login/security/reset screens.



### 10.2 Required regression and release checks

- Better Auth core: migrations after Noctua master init, identical second-start empty plan, preserved
  master profile dates/IDs, separate auth table names, ISO auth dates; createUser → signInEmail →
  getSession, signup disabled, ban blocks all login methods and revokes live sessions, impersonation
  denied by role and disabledPaths, session additional activeAccountId server set/read/client reject,
  password change replacement cookie + other-session revocation. Reuse named spike tests.
- HTTP/Next: /api/ba mount in production build, /api/auth wrappers coexist, real Set-Cookie refresh
  forwarding, HTTPS Secure cookie prefix, missing/foreign Origin and non-JSON rejection, malicious
  forwarded headers, production rate limits and server-call wrapper limits. Telemetry config + env
  off, missing secret/invalid URL/storage/desktop mode fail startup. Baseline type comparison.
- IMAP first factor: unset/empty allowlist (the default) denies login and IMAP-based proof without
  network calls, provisional sessions or write-back; UI action is hidden. Explicit allowlisting
  enables only eligible personal mailboxes. Negative control without bridge bypasses MFA;
  bridge positive flow over HTTP
  returns challenge with NO token/cookie/DB session before TOTP and backup-code completion. Pin hook
  count/matcher on upgrade. Existing personal identity only, no IMAP call when users empty/unknown,
  owner+address+TLS+allowlist+shared=false, zero/multiple candidates; adding a viewer makes the
  mailbox ineligible. Shared-address/multi-member/member-only/owner-less mailboxes never authenticate.
  Generic errors, network
  limiter and no write-back on invalid credentials; changed password revokes old sessions/tokens;
  stored SMTP follows only the §5.3 rule. Use synthetic credentials and injected IMAP verification.
- Deployment acceptance: canonical BETTER_AUTH_URL/trusted origin and rpID match §8.1; tailnet DNS
  resolves mail.example.org to <tailnet-ip>, the TLS chain/hostname is trusted on both phones, and
  DNS-01 issuance/renewal via the DNS provider's API succeeds. The separate preview is not trusted by
  canonical production and cannot reuse canonical passkeys. Localhost harness settings stay isolated.
- MFA/security: mandatory gate blocks mail/admin/MCP and direct raw BA calls until TOTP verified,
  backup-code one-use, wrong/expired/locked challenges, reject trustDevice=true; passkey registration
  options, real registration/assertion with UV true accepted and UV false rejected server-side.
  Credential enrollment needs a new proof even with a stolen fresh cookie; IMAP-only first-password
  enrollment too. Grants bound to user/session/purpose/challenge, expiring and single-use; raw
  /two-factor/enable, /disable and passkey endpoints cannot bypass. FreshAge failures request login;
  Three-day idle expiry slides on guarded requests and has no absolute age ceiling; authenticatedAt survives session replacement as proof metadata. Wrong code in Security does not globally log out.
- Provisioning/recovery/admin: no mailbox takeover (409 BEFORE IMAP/invite reservation), duplicate
  user 409, first-admin invite only, concurrent first signup and invite maxUses, no bootstrap from
  a stored mailbox; crash/fault injection after every reservation/create/finalize step and idempotent
  compensation. Migration preserves IDs/roles and excludes ambiguous/shared identities. Recovery
  15-minute single-use/expiry and personal admin/operator handover with zero SMTP delivery,
  public issuance absent/raw issuance blocked, canonical callback allowlist, no desktop invite
  exemption, MFA preserved across
  password reset; sessions/MCP revoked. Raw plugin admin endpoints cannot skip audit, last-admin or
  cleanup; concurrent last-admin operations; disable/delete partial failures remain fail-closed.
- MCP: opaque random token/hash only, no credential payload, old tokens rejected at cutover, creator
  liveness/MFA + selected mailbox membership rechecked, accountId cannot escape the token set,
  downgrade takes effect, disable/reset/delete removes tokens; revoke denies that mailbox while
  preserving other covered memberships; token scopes and viewer mutation restrictions are enforced.
- Database concurrency: keep shared-handle rollback as a negative control, dedicated handle test
  with SQLITE_BUSY and async retry; stress actual signup/changePassword/ban versus Noctua writes.
  No auth/network await inside synchronous Noctua transactions, no whole-auth-request retry, busy
  exhaustion reports a controlled error. Startup/mirror faults cannot leave a usable partial user.
- Roles: resolveAccountRole (owner/member/none), async guard/minRole 403 for every direct guard
  caller, member owner/self/last-manager limits, admin override, revoke unassigns, sanitized DTOs,
  manager-only existing-account changes with immutable e-mail; relogin/PUT/POST-existing/login write-back
  SMTP coupling (same user+same/empty old secret follows, distinct secret/user stays), login mailbox
  owner/admin identity-change rule. One-member admin-provisioned mailbox shared=false.
- Collaboration: db module (defaults, upsert, comments, soft delete, commentCount, activity, 404
  for message-less thread), remap/merge policy (merge two threads sharing a topic; two threads
  both with state rows; split; old id keeps messages), remap on resync, enrichment, badge filters
  with and without viewerUserId (messages and threads), REST routes per role, MCP tools, reply
  hook, two accounts sharing one shard file, concurrent first mutations (stress).
  Shared-shard regressions also cover identical RFC Message-IDs, common roots,
  FTS/topic filters, translations, attachments, replacement/deletion, copy
  ingestion, watcher sync and migration rollback/idempotence. Attachment HTTP
  tests cover cross-account preview/bytes/304/removal and membership revocation.
- UI: DOM tests for LoginScreen email/passkey/IMAP forms, TOTP/backup-code challenge, enrollment,
  re-auth and recovery errors, accessible focus/429, /me accountId:null and mandatory gate; no global
  logout on wrong TOTP/password. Browser authenticator acceptance with real UV; phone login/PWA
  on `https://mail.example.org`: install both PWAs, login, switch mailbox, read, reply and attach a camera photo. DOM tests for `ThreadCollaborationBar`, mobile nav, compose
  coercion on mobile, a kept component inside a shadcn Sheet keeping `--space-2`, and the CSS
  layer build test.
- Run `bun run test:ci`, `bun run test:stress`, `bun run lint`, `bun run build` before merging.


## 11. Synology MailPlus cut-over and restore runbook (Stage 4)

`chore/mailplus-cutover` writes `doc/MAILPLUS-CUTOVER.md` from fit-report §5 and the updated auth
policy here. The report's SESSION_SEAL_KEY/generated-password/forced-change steps are superseded;
use BETTER_AUTH_SECRET, targeted invites, chosen passwords and verified MFA. External commands
below are templates requiring installed-tool help/capability confirmation on the actual servers.
Never run an import against household mail as part of implementation-agent tests.

1. Inventory every address: real provider mailbox, alias or forward; map each shared MailPlus mailbox
   to one provider account and both personal memberships/roles. Resolve sender identities (fit 16),
   filter-only folders, duplicate forwards, shared layout, labels/topics and intended Sent/Drafts.
   Confirm mailbox quotas, personal IMAP username rule and English/calendar/contacts decisions.
2. Before any INBOX import/account creation: final MailPlus POP3 fetch, record keep/delete modes,
   disable all fetch entries and the global POP3 switch. Imported messages have new UIDLs; resumed
   delete-mode fetch could erase provider copies which Noctua would mirror locally. Keep MailPlus
   history intact through day 7. Non-INBOX copies may be prepared earlier.
3. Probe each mailbox's TLS hostname, CAPABILITY (UIDPLUS), LIST/SPECIAL-USE, one intended Sent and
   Drafts folder, concurrency/login limits and other phone clients. Measure rather than assuming
   published estimates. Configure spam to move into Spam; recreate server rules/autoresponders and
   check ManageSieve availability if needed.
4. Prepare Linux/systemd + TLS proxy: `BETTER_AUTH_URL=https://mail.example.org`,
   `PASSKEY_RP_ID=mail.example.org`, canonical trusted origin only, DNS A `<tailnet-ip>` inside the
   tailnet and certificate renewal via the DNS provider's API (DNS-01) (§8.1). Keep the preview separate.
   Use DB-only credential storage and independent keys; leave `NOCTUA_IMAP_LOGIN_HOSTS` unset by
   default and enable it only with an explicit reviewed host allowlist for eligible unshared personal
   mailboxes; retain the admin's app-password fallback. Configure the real trusted proxy chain, enough disk (fit estimate >=2.5x mail size must be checked), attachment
   body limit >=40 MB for base64 JSON (verify actual target behavior), watcher flag and worker cap.
   No Docker deployment dependency. Run startup, personal reset-link handover (no SMTP) and canonical
   phone TLS/passkey acceptance.
5. Import LAN MailPlus→provider with a reviewed imapsync template: folder dry-run first, owner-login
   shared copies and shared-prefix exclusion on personal runs; preserve internal dates and map Sent/
   Drafts explicitly, never --delete*. Validate exact installed flags for Message-ID handling,
   --syncinternaldates and folder maps. Second run transfers zero; resolve server duplicates and
   label migration explicitly. Do not assume Noctua can import mbox/PST/IMAP history itself.
6. First person redeems first-admin invite, chooses app password, verifies TOTP and saves codes;
   issues targeted invite for second person, who chooses her password/factors. Add personal and
   eight shared mailboxes with reviewed roles/DB credentials, preserving personal ownership where
   IMAP first factor is explicitly enabled; never enable it for shared mailboxes. Test both people
   independently and manager/editor/viewer restrictions.
7. With browsers/watcher/import writers paused, run full per-folder server sync (not initial UI's
   INBOX-full/other-folders-30-days policy):
   `bun scripts/runSyncJob.ts '{"accountId":"synthetic-id","folderId":"synthetic-id:INBOX","mode":"full","fullSync":true}'`
   replacing identifiers from the actual inventory. Cover Sent and every imported folder; checkpoint/
   timeout handling must finish before comparison. Compare MailPlus, provider/imapsync and local shard
   per-folder counts; a mismatch first requires proving sync finished.
8. Acceptance: A replies/draft-sends/calendar-replies in shared mail, B sees the Sent copy/answered
   state without an active tab; every mailbox sends into its intended Sent, append failure is visible,
   GTUBE moves to Spam, large attachment works, provider login limits/backoff stay bounded. Install
   PWAs on iOS Safari and Android Chrome; login/passkey/TOTP, switch, read, reply and camera attachment.
9. Backup/restore BEFORE approval: `scripts/backupTeamInbox.ts` + systemd timer snapshot master
   `db/main.db` and all actual shard paths (include shared shard files once), auth state, audit/prefs,
   comments/assignments/topics/calendar/reminders and required secrets. Quiesce writes/workers for a
   consistent application-wide checkpoint or stop the service; independent per-file VACUUM INTO while
   cross-file operations run is insufficient. Use SQLite backup/VACUUM with WAL handling, N retained
   generations, offline IMAP/BETTER_AUTH keys and independent nightly mail archive to NAS. sources/
   is a cache, not the archive. Restore in isolated storage with original origin simulated locally,
   verify users/roles/factors/generations/collaboration and read/send against a synthetic mailbox;
   never authenticate restored test workers to real mail unintentionally. Record restore time/data loss.
10. Re-run import for stragglers day 1 and day 7, verify no duplicates/count drift, then user signs
    off each §1.1 row before disabling MailPlus permanently. Keep mail archive + key/app backups.
    Rollback keeps MailPlus history; re-enable POP3 only after removing imported provider INBOX copies
    or deliberate keep-copy mode. Preserve Noctua-only shard state and keys through any rollback.


## Appendix A. Rejected alternatives

Rejected by the user on 2026-10-22; these are historical rationale, not configuration switches.

| Rejected alternative | Rationale for the selected policy |
|---|---|
| Any enrolled MFA method instead of mandatory TOTP (D13) | Every user needs the same verified TOTP enrollment and backup-code recovery baseline; UV passkeys remain convenient login after enrollment. |
| Remove personal IMAP first factor entirely (D3) | Retain the implementation as an explicitly allowlisted convenience, OFF by default, with no shared-mailbox authentication. |
| Browser-only/cookie mailbox credentials (D2) | Shared inboxes and background workers require server-accessible encrypted DB credentials; the global credential overlay is removed. |
| Retain Tauri/desktop mode or its invite/secret/origin exemptions (D15) | This is a Linux/systemd web fork; desktop support and its separate security architecture are dropped. |
| SMTP reset sender and generic public recovery requests (D17) | This stage uses personal admin/operator handover of a 15-minute single-use link; SMTP recovery delivery is a non-goal. |
| Preview hostname, LAN IP or a separately selected hostname as canonical RP ID | The user fixed `mail.example.org` over tailnet DNS A `<tailnet-ip>` with DNS-01 TLS via the DNS provider; the preview is a separate origin. |
