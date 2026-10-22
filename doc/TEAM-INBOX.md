# Team Inbox: app login, mailbox roles, shared-inbox collaboration, new shell

Design document for the `kaeferfreund/noctua-mail` fork. It is the single source of truth for the
implementation branches listed in §9. Everything not mentioned here stays as upstream.

Status: design v2, 2026-10-22. v1 was reviewed by three independent critics (security, data
integrity, frontend/mobile); every blocker and major finding is folded into this version.

## 1. Goals and non-goals

Goals

1. Personal app login. A person signs in with their own e-mail address and their own password. The
   login no longer proves IMAP credentials. IMAP/SMTP credentials belong to a mailbox, are stored
   encrypted in the master DB, and are entered once by a manager.
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
- OAuth for MCP clients. Bearer tokens stay; token scopes are reserved but not enforced yet.
- Unified multi-account inbox. One mailbox is active at a time; the sidebar switches between them.
- Replacing Radix Themes inside the kept components. They keep working under the new tokens.
- Desktop (Tauri) mode changes. Multi-user features are hidden there, nothing else changes.

## 2. Architecture decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Password hashing with `Bun.password` (argon2id), wrapped in `lib/passwords.ts` (`hashPassword`, `verifyPassword`, `PASSWORD_MIN=10`, `PASSWORD_MAX=256`). | No new dependency; the app already requires Bun. There are no `@types/bun`; use the `globalThis` pattern from `lib/syncJobs.ts`. |
| D2 | Team features (password login, signup with app password, admin mailbox creation, member grants) require DB credential storage: `teamFeaturesSupported() = shouldStorePasswordInDb()` (mode `db` or `both`). When DB storage is on, session cookies and MCP tokens never embed IMAP/SMTP credentials and the process-global credential overlay (`lib/credentials.ts`) is disabled. In cookie-only mode everything behaves exactly as upstream. | The overlay is keyed by account and overwritten by whoever made the last request. That is unsafe with several users. The sync worker already reads only the DB. Treating `both` as "DB is authoritative" keeps the upstream default working. The fork documents `db` as the deployment default. |
| D3 | Legacy IMAP login stays only as a migration path for a user row without a password hash, and only for mailboxes that user alone owns (§4.2). It never resolves a session user from an account. | v1 kept the upstream resolution (`ownerUserId ?? firstLinkedUser ?? …`), which hands the owner's identity to anyone who knows a shared mailbox's IMAP password. |
| D4 | Authorization becomes membership based. `requireAccountContext` resolves the caller's role for the account and enforces a minimum role per route. The "active account must equal route account" rule is only kept when credentials live in cookies only. | Lets a user act on any mailbox they have access to without switching the session cookie. `switch-account` stays as "set my active mailbox". |
| D5 | Sessions and MCP tokens carry `iat`. Every guard loads the user row and rejects disabled users, missing users, and sessions issued before `passwordUpdatedAt`. Admin-set passwords force a change on next login. Admin actions are written to a master-DB audit table. | A stateless cookie that `/api/auth/me` refreshes forever has no revocation otherwise; "disable user" must evict live sessions and tokens. |
| D6 | Admin role (`users.role = admin`) grants management rights through `/api/admin/*`. It does not grant implicit read access to mail; an admin reads a mailbox only after a membership exists, and every grant, including self-grants, is audited. Managers manage members of their mailbox within limits (§5.4). Only the owner or an admin can delete a mailbox. | Least privilege with a real audit trail. |
| D7 | Collaboration state lives in the per-account shard DB, keyed by `(accountId, threadId)`. Rows are remapped whenever a message's `threadId` changes (sync upsert, resync, recompute) and are never pruned. All mutations are single immediate SQLite transactions with upserts. | Same key as `thread_topics`, `thread:` search, and MCP thread addressing. `EXISTS` joins on `messages.threadId` work without `ATTACH`. Accounts can share one shard file, so `accountId` is part of every key. |
| D8 | Collaboration status values: `open`, `in_progress`, `waiting`, `closed`. Never `done`. | Upstream has per-message `$Todo`/`$Done` keywords labelled "Mark as Done". |
| D9 | Per-user UI preferences per mailbox move to `user_account_prefs` (master DB, sparse deep-merge). Theme stays a device preference (next-themes, localStorage). | `AccountSettings` mixes team config with personal UI prefs; shared mailboxes need the split. One source of truth per preference. |
| D10 | UI: shadcn/ui (style `radix-nova`, base `neutral`, CSS variables) + Tailwind v4 without preflight + next-themes. Radix Themes stays loaded for kept components, imported into a CSS cascade layer. | Incremental migration. Preflight would strip list bullets, heading sizes and inline SVG layout from the editor and markdown surfaces. |
| D11 | Mobile: below `md` the shell shows one pane at a time, derived from `viewMessage` (not from taps), with both panes kept mounted and CSS-hidden. Compose is always a full-screen modal on mobile. | Deep links, notices and reminders also set `viewMessage`; unmounting panes loses the virtualization and scroll refs. |
| D12 | Tests: every new route and DB module gets a bun test next to it, following the existing harness (`lib/testDbHarness.ts`, sealed cookie helpers, `mock.module` on wrapper seams only). Concurrency cases run under `bun run test:stress`. | AGENTS.md rules. |

## 3. Data model

All DDL is additive. Use the existing idioms: `CREATE TABLE IF NOT EXISTS`, `PRAGMA table_info` +
`ALTER TABLE ADD COLUMN`. Master DB changes go in `initMasterSchema`; shard tables are created in
`initAccountSchema` (not only in a runtime guard), with an `ensureThreadCollabRuntimeSchema` for
later column additions (see `ensureTopicRuntimeSchema`). The `ALTER` block of each migration runs
inside `db.transaction(() => { /* re-read PRAGMA table_info here */ }).immediate()` and tolerates
`duplicate column name` errors (CLI scripts can race a server restart).

### 3.1 Master DB (`mail.db`)

```sql
-- users: new columns
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN passwordHash TEXT;        -- argon2id; NULL = legacy IMAP login only
ALTER TABLE users ADD COLUMN passwordUpdatedAt INTEGER; -- unix seconds; sessions with iat < this are invalid
ALTER TABLE users ADD COLUMN mustChangePassword INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN disabledAt INTEGER;        -- NULL = active

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
  single-row writes inside one transaction.
- `addUserAccountLink(userId, accountId, role = 'manager')` becomes
  `INSERT ... ON CONFLICT(userId, accountId) DO NOTHING` (never resets a role). Role changes go
  only through `setUserAccountRole(userId, accountId, role, grantedByUserId)` (`DO UPDATE`).
- `User` (client-facing type) never contains `passwordHash`. It gains `name?: string`,
  `hasPassword: boolean`, `mustChangePassword: boolean`, `disabledAt: number | null`.
- Membership role resolution for `(userId, accountId)`:
  `accounts.ownerUserId === userId` → `manager`; else `user_accounts.role`; else no access.
  Roles are ordered `viewer < editor < manager`.
- `mergeAccount` (lib/db/rowParsers.ts) whitelists patchable fields. `id`, `ownerUserId`, `dbPath`,
  and `email` can never be patched from a request body. Blank `imap.password`/`smtp.password`
  means "unchanged" (clients receive blanked secrets).

### 3.2 Account shard DB (`db/accounts/<accountId>.db`)

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
     write the merged row with `INSERT OR REPLACE`, then `DELETE` the old rows. Comments and
     activity rows get the new `threadId` via plain `UPDATE` (their PK is `id`). Then recompute
     `commentCount` from `thread_comments`. Write one `threads_merged` activity row with
     `payload.mergedFromThreadIds` and `actorClientId = 'system'`.
  5. `thread_topics` (PK `threadId, topicId`) is remapped the same way: `INSERT OR IGNORE ... SELECT`
     then `DELETE`. This also fixes the upstream gap where topics were lost on recompute.
- Threads without a Message-ID fall back to row ids (lib/threading.ts); collaboration on those is
  best effort and not remapped on folder moves.
- The collab DB module runs inside the recompute and sync worker subprocesses. It must be importable
  without Next or request context and must not touch the credential cache or sessions.
- No pruning. Orphaned state rows (thread lost all messages) are invisible in lists and counts
  because every filter is applied to `messages` rows.

## 4. Authentication

### 4.1 Session payload and liveness

`SessionData` gains `iat: number` (unix seconds). Password logins never set `imap`/`smtp`.
`accountId` becomes optional end-to-end:

- `GET /api/auth/me` returns 200 for a session without `accountId`, with `accountId: null` and the
  user's accessible accounts (each with `accessRole`, `isOwner`, `shared`). It no longer returns
  403 for that case. It also returns `mustChangePassword`.
- The client shows a "no mailbox yet" state instead of looping to login.

`requireActiveUserSession(request)` (lib/auth.ts, async) replaces direct `requireSessionOr401`
use in every guard: `requireAccountContext`, `requireAdminSessionOr403`, `/api/auth/me`,
`/api/auth/password`, `/api/auth/switch-account`, `/api/accounts` GET/POST. It unseals the
cookie, loads `{ disabledAt, passwordUpdatedAt, mustChangePassword, role }` for `session.userId`
(one indexed SELECT, no caching) and returns 401 when the user row is missing, `disabledAt` is set,
or `iat < passwordUpdatedAt`. When `mustChangePassword` is set, only `/api/auth/me`,
`/api/auth/password`, and `/api/auth/logout` are allowed (403 `{ code: "password_change_required" }`
elsewhere). Sessions whose `userId` is not a users row (upstream's `account.id` fallback) are
rejected; those users log in again.

`requireMcpAccountContext` additionally rejects tokens whose `createdByUserId` is missing or
disabled, and re-checks membership on the bound account on every request. Disabling or deleting a
user deletes that user's MCP tokens.

`SESSION_SEAL_KEY`: `instrumentation.ts` refuses to start when the key is shorter than 32
characters, unless `NOCTUA_DESKTOP_MODE=true`, in which case a random key is generated once and
persisted at `$NOCTUA_DATA_DIR/session-seal.key` (mode 0600). The literal `dev-session-key`
fallback is removed. Document in `doc/AUTHENTICATION.md`.

### 4.2 Login: `POST /api/auth/login`

Body `{ email, password, preferredAccountId? }`. Same-origin JSON check (§4.6). Rate limit per IP
as today plus a per-e-mail limiter (5/min) for the password branch.

1. `email = lower(trim(email))`. Load the auth row (`getUserAuthByEmail`): `{ id, role, passwordHash, disabledAt, mustChangePassword }`.
2. Disabled user, or any failure below → `401 { ok:false, message:"Invalid email or password" }`.
   This is the only failure response besides `400 Missing credentials` and `429`.
3. User with `passwordHash`: verify (argon2id). On success, accessible accounts =
   `listAccessibleAccountsForUser(userId)` (owned first, then by name). `accountId` =
   `preferredAccountId` if accessible, else first, else undefined. Session `{ userId, role, accountId, iat, exp }`.
   Response `{ ok:true, accountId: string | null, mustChangePassword }`.
4. Legacy path, entered only when (a) the user row exists with `passwordHash IS NULL`, or (b) the
   users table is empty and an account with that e-mail exists (upstream bootstrap). The candidate
   accounts are `listAccessibleAccountsForUser(user.id)` filtered to `email === typed || imap.user === typed`
   and `ownerUserId === user.id` and exactly one member. Verify the typed password against that
   account via IMAP. Session `userId` is always `user.id`; the `ownerUserId`/first-linked/`account.id`
   fallbacks are deleted. Password write-back to the account row happens only here and only in DB
   storage mode. Shared mailboxes never authenticate anyone.
5. Rotate: every successful login issues a fresh `iat`.

### 4.3 Signup: `POST /api/auth/signup`

Body `{ inviteCode, email, password, name?, account? }`. `account` is optional and, if given, is a
full `Account` with IMAP/SMTP credentials.

Order: validate payload and password policy → `getUserAuthByEmail` duplicate check (409) → verify
IMAP for the optional account → hash → one immediate transaction: claim invite (null → roll back,
400), `insertUser`, `upsertAccount` (`ownerUserId = userId`), `addUserAccountLink(role manager)`.
First user ever is `admin` (unchanged). `account` requires `teamFeaturesSupported()`; otherwise 400
with a clear message. Desktop mode: invite optional, otherwise the same flow. Session as in 4.2.
Response `{ ok:true, accountId: string | null }`.

### 4.4 Password management

- `POST /api/auth/password` body `{ currentPassword?, newPassword }`. Per-user limiter (5/min).
  If the user has a hash, `currentPassword` must verify. Legacy users (no hash) may set one without
  it. Writes `passwordHash`, `passwordUpdatedAt = now`, clears `mustChangePassword`, and re-issues
  the caller's cookie with a fresh `iat` so their own session survives while all others die.
- Admin: `POST /api/admin/users/[userId]/password` body `{ password }` or `{ generate:true }`
  (returns a random 16-char password once). Sets `mustChangePassword = 1`, bumps
  `passwordUpdatedAt`, deletes the user's MCP tokens, writes `user.password_reset` to the audit.
- `lib/passwords.ts` rejects passwords shorter than 10 or longer than 256 characters (400).

### 4.5 Admin user management (`requireAdminSessionOr403`, which now uses `requireActiveUserSession`)

- `GET /api/admin/users` → `{ ok, users:[{ id, email, name, role, createdAt, hasPassword, mustChangePassword, disabledAt, accounts:[{ id, name, email, role, isOwner }] }] }`.
- `POST /api/admin/users` body `{ email, password?, name?, role }` → 201 `{ ok, user }`. 409 on
  duplicate e-mail. `role` must be `admin` or `user` (400). A password set here forces a change.
- `PATCH /api/admin/users/[userId]` body `{ name?, role?, disabled? }`. Refuse any change that would
  leave zero enabled admins, and self-demotion or self-disable (400). Disabling deletes the user's
  MCP tokens.
- `DELETE /api/admin/users/[userId]` body `{ reassignOwnerTo? }`. Refuse self-delete and
  last-admin deletion. If the user owns accounts, `reassignOwnerTo` is required (409 otherwise).
  Removes memberships, prefs, MCP tokens, and unassigns the user in every account shard (§5.4).
- `GET /api/admin/audit?limit=&before=` → `{ ok, entries }`.
- Every mutation writes one `admin_audit` row.

### 4.6 Request hygiene

- `requireJsonSameOrigin(request)` (app/api/_helpers/requestOrigin.ts): for mutating JSON routes
  (auth, admin, members, prefs, collab) require `content-type` starting with `application/json` and
  either `Sec-Fetch-Site` in `same-origin`/`none` or an `Origin` whose host equals the request host.
  Violations return 403 `{ code: "cross_origin" }`. `/api/mcp` (Bearer auth) is exempt.
- Permission failures return 403, never 401 (the client treats session-like 401s as logout).
- `x-noctua-client` is clamped to 64 characters of `[A-Za-z0-9_-]` before it is logged or stored.

## 5. Authorization

### 5.1 Role resolution helper (`lib/accountAccess.ts`, new)

```ts
export type AccountRole = "viewer" | "editor" | "manager";
export const ACCOUNT_ROLE_ORDER: Record<AccountRole, number> = { viewer: 1, editor: 2, manager: 3 };
export function roleAtLeast(role: AccountRole | null | undefined, min: AccountRole): boolean;
export async function resolveAccountRole(userId: string, accountId: string): Promise<AccountRole | null>;
export async function listAccessibleAccountsForUser(userId: string): Promise<Array<{ account: Account; role: AccountRole; isOwner: boolean; memberCount: number }>>;
export async function listAccountMembers(accountId: string): Promise<Array<{ userId: string; email: string; name: string | null; role: AccountRole; isOwner: boolean; disabledAt: number | null }>>;
export function teamFeaturesSupported(): boolean;   // === shouldStorePasswordInDb()
```

`requireAccountContext(request, accountId, { minRole?: AccountRole })`:

1. `requireActiveUserSession`.
2. `role = await resolveAccountRole(session.userId, accountId)`; `null` → 403 `{ ok:false, message:"Forbidden" }`.
3. If `!shouldStorePasswordInDb()` (cookie-only credentials) additionally require
   `session.accountId === accountId`.
4. `minRole` defaults to `viewer`. Below it → 403 `{ ok:false, message:"Insufficient mailbox role", requiredRole }`.
5. Returned `AccountContext` gains `role: AccountRole` and `userId: string`.

`requireSessionAccountOr403` is deleted; all direct callers (`accounts/route.ts`, `compose/recipients`,
`attachments`, `html`, `source`, `sender-icon`, `_helpers/recomputeJobs.ts`, `_helpers/syncJobs.ts`,
`messages/listMessagesHandler.ts`, `calendar/import`) move to `requireAccountContext` with the role
from §5.2. `requireOwnedAccountContext` becomes `requireAccountContext(..., { minRole: "editor" })`
on the destination account.

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
`isOwner`, `shared` (true when `memberCount > 1` or `ownerUserId !== viewerUserId`) and, for viewers
and editors, blanks `imap.host/user`, `smtp.host/user`, `caldav`, and `deepl` (only `enabled` and
`targetLang` stay).

`PUT /api/accounts/[accountId]` (manager): `email` is immutable (400). Any change to
`imap.host|port|secure|user` or `smtp.host|port|secure|user` must include the corresponding password
in the same request and is verified with `verifyImapCredentials` (IMAP) / an SMTP connection test
(SMTP) against the new endpoint before persisting; without a password such changes are rejected
with 400. `relogin` keeps requiring the password and no longer accepts a different `imap.user`
unless the password is provided for it.

### 5.4 Members and admin mailbox management

Manager routes (`requireAccountContext(minRole: "manager")`):

- `GET /api/accounts/[accountId]/members` (viewer) → `{ ok, members }` (no disabled users for viewers/editors; managers see `disabledAt`).
- `PUT /api/accounts/[accountId]/members/[userId]` body `{ role }`: target must be an existing,
  enabled user; cannot modify the owner; cannot change own role; cannot grant above `manager`.
- `DELETE /api/accounts/[accountId]/members/[userId]`: cannot remove the owner; cannot remove the
  last remaining manager (owner counts as manager); may remove self otherwise.
- Both write `member.*` audit rows (actor = the manager) and, on revoke, unassign the user in the
  account shard: `UPDATE thread_collab_state SET assigneeUserId = NULL, assignedAt = NULL, updatedAt = ?, lastActivityAt = ? WHERE accountId = ? AND assigneeUserId = ?`
  plus one `unassigned` activity row per affected thread with `actorClientId = 'system'`.

Admin routes (`requireAdminSessionOr403`, override for everything above, same audit):

- `GET /api/admin/accounts` → all accounts (manager view, sanitized) with `members`.
- `POST /api/admin/accounts` body: `Account` without id. Verifies IMAP, requires
  `teamFeaturesSupported()`, `ownerUserId = null`. 201 `{ ok, account }`. Not auto-linked.
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

Reply hook: after a successful send in `smtp/send/route.ts` and `sendDraftForAccount`
(lib/drafts.ts), call `recordReplySent`. No automatic status change.

### 6.4 Per-user preferences (`user_account_prefs`)

`GET /api/accounts/[accountId]/prefs` returns the stored sparse object. `PUT` has PATCH semantics:
a sparse deep-merge where only present keys are written and `null` deletes a key. The client
sends only keys the user explicitly changed. Shape: `{ layout?: { defaultView? }, appearance?: { dateFormat?, topicColorRows?, senderIcons? }, calendar?: { weekStartsOn? }, threading?: { includeAcrossFolders? }, defaultSignatureId? }`.
Client resolution: defaults < `account.settings` < user prefs, kept in an `effectiveSettings`
value that is never written back to `/settings`. `PUT /settings` and `PUT /api/accounts/[id]` strip
the per-user keys unless the body carries `teamDefaults: true` (the manager "team defaults" form).

### 6.5 MCP tools (`lib/mcpServer.ts`)

Register with `server.registerTool` and output schemas. Actor is
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
stayed green). Slice 1 uses the generated `radix-nova` style and pins `radix-ui` to
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
6. Local dev needs `.env.local` with `IMAP_CREDENTIALS_STORAGE=db`, a 64-hex `IMAP_SECRET_KEY`,
   and a 64-hex `SESSION_SEAL_KEY` (the instrumentation hook refuses to start otherwise).

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
  to it. No `next/font` (Docker and Tauri builds must stay hermetic). `HtmlMessage.tsx` injects the
  same `@font-face` with the absolute `/fonts/...` URL into the srcdoc and uses the family; the
  compose editor uses the family through the token.
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
  "Shared mailboxes" (`shared`), each row = avatar + name with e-mail tooltip; rows sort by name,
  and sections with more than six mailboxes group by e-mail domain. Optional `accessRole`,
  `isOwner`, `shared` fields arrive with feat/team-auth; absent `shared` means personal.
  Clicking a mailbox calls `switchAccount`. Views: Inbox, Focused, Action queue and Invite deck
  retain their counts; an explicit empty slot reserves Assigned to me / Unassigned / Open for
  feat/collab-ui. Then Topics and the existing folder tree (token styling; desktop drag-and-drop).
- Sidebar footer: NavUser-style avatar, user name and e-mail with Settings, Admin (admin only),
  disabled "Profile & security" placeholder for Better Auth, developer tools "Show thread JSON"
  / "Evict thread cache", and Log out. The person is separate from the active mailbox.
- List + reading pane: `ResizablePanelGroup` with `useDefaultLayout({ id: "noctua:panes",
  panelIds, storage })` (v4 has no `autoSaveId`/`order`). Stable ids `list`, `reader`, `calendar`
  and fixed render order allow separate persisted layouts with/without the conditional calendar.
  `MessageListPane` fills its panel (`width: 100%`); a `ResizeObserver` on `listPaneRef` feeds
  `listWidth` in MailClient and still drives `listIsNarrow` and `collapseViewSwitcher`.
  Pane chrome lives in the CSS modules because those unlayered rules beat utilities.
- Header: SidebarTrigger, vertical Separator, current mailbox name + folder; right-aligned search
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
- `MessageViewPane` receives `hideToolbar` on mobile and a compact header with the back button.
- Sidebar opens as a sheet from the header menu button. The mobile header keeps only the
  trigger, title, search and indicator menu; theme choices move into the user menu.
- Compose: `ComposeOrchestrator` gets an `isMobile` input. On mobile `openCompose` and the
  `setComposeView` wrapper coerce `inline`/`minimized` to `modal`; dock, minimize, and
  open-in-window controls are hidden; `.modal-backdrop`/`.composeModal` become `100dvw × 100dvh`
  below `md` and `composeSize` is ignored. The mobile frame is a labelled modal Dialog with
  trapped focus, Escape dismissal and focus restoration. `sendMailRace.dom.test.tsx` covers the prop.
- Message list rows: sender above subject, date aligned right, a reserved "more" button and
  an 8px unread glyph with an invisible 44px hit area. Thread/table/Compact rows and their virtualizer
  share a 72px mobile height. Below a 600px list-pane width, desktop thread/table rows
  also use the two-line layout and 72px spacing; wider panes keep their desktop density. Reader sender/date metadata stacks.
- Status bar hidden. Its panels (process status, mail check, reminders, exceptions) and the
  calendar open from the header indicator menu into a `Sheet`; `openBottomStatusPanel` routes
  there on mobile, including the PWA `?openCalendar=1` handler; the calendar sidebar is a
  full-screen `Sheet` on mobile. Closing a status Sheet returns focus to the header indicator;
  calendar "Find related" clears the selected message so the results list is visible.
- Settings open as a full-screen sheet with a vertical tab list whose long labels wrap.

### 7.3 Collaboration UI (branch `feat/collab-ui`)

- `ThreadCollaborationBar` in the reading-pane header: assignee `Combobox` (members, "Me",
  "Unassigned"), status `Select` (Open / In progress / Waiting / Closed), comment count, and an
  "Internal note" button. Hidden in the Tauri desktop build. Reads and writes through a
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

### 7.4 Login and signup (branch `feat/ui-shell`, against the API contract in §4)

`app/components/auth/LoginScreen.tsx` replaces `LoginOverlay`: centred `Card` with e-mail and
password (`autoComplete` set), generic error alert, 429 handling, "I have an invite code" link →
signup form (invite code, name, e-mail, password, confirm; client validates length and match).
After login or signup with no mailbox, the shell shows "No mailbox yet" with "Add a mailbox"
(reuses `AccountTabContent` in a dialog, `POST /api/accounts`) and "Ask your admin". A
`mustChangePassword` session shows only the password-change form.

### 7.5 Settings and admin (branch `feat/collab-ui`)

- Settings dialog keeps the existing tab contents inside a shadcn `Dialog`/`Sheet` frame (wrapped in
  `<Theme asChild>`) with a vertical tab list. Tabs per role: Account (manager), Signatures
  (manager; personal default signature in Preferences), Preferences (all; writes user prefs),
  Categorization, Topics, Calendar (manager), Translation (manager), Recipient aliases, MCP
  (editor+), Members (manager, uses the §5.4 manager routes).
- `AdminPanel` reachable from the user menu without an active mailbox. Sections: Users (create,
  reset password, role, disable), Mailboxes (add shared mailbox, members and roles), Invites,
  Audit log (read-only). Built with shadcn components.

## 8. Compatibility and migration

- Existing installs: users keep logging in with IMAP credentials until they set a password
  (Preferences → "Set app password") or an admin resets one, but only for mailboxes they own alone.
  Existing `user_accounts` links become `manager`.
- `IMAP_CREDENTIALS_STORAGE=cookie` keeps working for single-user installs; team features refuse
  with a clear 400 and a startup warning. `both` works but the DB is authoritative (no overlay).
  The fork's deployment docs set `db`.
- Tauri desktop: unchanged behaviour; team features hidden by `useIsDesktop()`; a persisted
  session seal key is generated automatically.
- Upstream PR slicing: (1) schema + auth + roles, (2) thread remap for topics (bug fix),
  (3) collaboration backend + MCP, (4) shell. Each branch must pass `bun run test:ci`,
  `bun run lint` (no new warnings; the one pre-existing error in `useCalendarConflicts.ts` is
  upstream's), and `bunx tsc --noEmit` (ignoring the pre-existing `bun:test` type errors).

## 9. Work breakdown (branches)

Branch names are fixed so parallel agents can reference each other. Integration branch:
`team-inbox`. `main` tracks upstream.

Stage 1 (parallel): `feat/team-auth` and `feat/ui-shell`.
Stage 2 (after `feat/team-auth` is merged): `feat/thread-collaboration`.
Stage 3 (after all three are merged): `feat/collab-ui`.

| Branch | Scope | Owns (no other branch touches these) |
|--------|-------|--------------------------------------|
| `feat/team-auth` | §3.1, §4, §5, §6.4 server side, `doc/AUTHENTICATION.md` | `lib/auth.ts`, `lib/accountAccess.ts`, `lib/passwords.ts`, `lib/credentials.ts`, `lib/secret.ts` (predicate only), `instrumentation.ts`, `lib/db/users.ts`, `lib/db/userAccountPrefs.ts`, `lib/db/adminAudit.ts`, `lib/db/schema.ts` (master part), `lib/db/rowParsers.ts`, `lib/db/accounts.ts`, `lib/db/mcpTokens.ts`, `lib/accountPresentation.ts`, `app/api/auth/**`, `app/api/admin/**`, `app/api/_helpers/accountContext.ts`, `app/api/_helpers/requestOrigin.ts`, `app/api/_helpers/syncJobs.ts`, `app/api/_helpers/recomputeJobs.ts`, `app/api/messages/listMessagesHandler.ts` (guard only), `app/api/accounts/route.ts`, `app/api/accounts/[accountId]/{route.ts,settings,relogin,mcp-tokens,members,prefs,compose/recipients,sender-icon,destination-folders,messages/copy-to-account}/**`, the guard lines of every other route in §5.2, `lib/data.ts` (`User`, `Account.accessRole/isOwner/shared`) |
| `feat/ui-shell` | §7.1, §7.2, §7.4, theming, mobile, settings frame, client handling of `accountId: null` and `mustChangePassword` | `package.json` deps, `postcss.config.mjs`, `components.json`, `app/globals.css`, `app/layout.tsx`, `public/fonts/**`, `app/components/ui/**`, `app/components/shell/**`, `app/components/auth/**`, `app/hooks/**`, `lib/utils.ts`, `MailClient.tsx` (layout, theme, width state, me/no-account handling, render tree), `useAccountController.ts`, `TopBar.tsx` (replaced), `FolderSidebarPane.tsx`/`FolderPane.tsx`/`FolderTree*.css`, `AccountSettingsModal.tsx` (frame), `mailclient/composition/{ComposeOrchestrator,ComposeModal,ComposeMinimized,ComposeFields}.tsx`, `Compose.module.css`, `useComposeController.ts`, `messagelist/{MessageListPane,MessageListOrchestrator,MessageListHeader}.tsx` + css, `message/MessageViewPane.tsx` + css, `status/BottomStatusBar.tsx`, `message/MessageMenu.tsx` (frame only), `status/{ProcessStatusPopover,UpcomingStatusPopover,ExceptionStatusPopover}.tsx` (frame only), `InAppNoticeStack.tsx`, `HtmlMessage.tsx`, the token codemod across CSS modules, `app/{compose,message,calendar}/window/**` theme hookup |
| `feat/thread-collaboration` | §3.2, §6.1–6.3, §6.5, `doc/API.md` | `lib/threadCollab.ts`, `lib/db/threadCollab.ts`, `lib/db/schema.ts` (shard part), `lib/db/threads.ts` (remap), `lib/db/messages/upsert.ts` (remap hook), `lib/db/messages/query.ts`, `app/api/_helpers/enrichMessagesWithThreadCollab.ts`, `app/api/accounts/[accountId]/threads/[threadId]/**`, `lib/mcpServer.ts`, `lib/data.ts` (`Message.collab`), `listMessagesHandler.ts` (viewer id), `threads/route.ts`, `related/`, `thread/related/`, `messages/[messageId]/route.ts`, `smtp/send/route.ts`, `lib/drafts.ts` (hook only) |
| `feat/collab-ui` | §7.3, §7.5, virtual folders client side, list chips, prefs client resolution, role-aware UI gating | `app/components/collab/**`, `app/components/admin/**`, `app/hooks/useThreadCollab.ts`, `useSearchState.ts`, list row components, `MessageViewOrchestrator.tsx` header, Preferences/Admin/Members tab contents, the `collab` prop bag in MailClient |

Known trivial conflicts: `lib/data.ts` and `lib/db.ts` (barrel exports) are touched by both
backend branches.

## 10. Testing requirements

- Auth: password login ok / wrong / disabled / unknown e-mail (all 401 generic); legacy fallback
  for an owned single-member mailbox; legacy refused for shared mailbox (scenarios A–C from the
  review: mailbox e-mail with IMAP password, member e-mail, owner-less mailbox); bootstrap with empty
  users table; signup (invite, first-user admin, duplicate e-mail 409 before invite claim,
  with/without mailbox, transaction rollback); password change re-issues cookie and invalidates
  older `iat`; admin reset forces change and kills MCP tokens; disabled user with live cookie → 401;
  live MCP token after disable → 401; `mustChangePassword` gate; e-mail migration with pre-seeded
  case duplicates; `SESSION_SEAL_KEY` assertion; same-origin check (text/plain form post rejected).
- Roles: `resolveAccountRole` (owner, member, none), `requireAccountContext` minRole 403 paths,
  cookie-only mode restriction, member routes limits (owner, self, last manager, above-manager),
  admin override, revoke unassigns in shard, sanitize per role, `POST /api/accounts` existing id
  needs manager and preserves host/role, `PUT` immutable e-mail and host change requires password.
- Collaboration: db module (defaults, upsert, comments, soft delete, commentCount, activity, 404
  for message-less thread), remap/merge policy (merge two threads sharing a topic; two threads
  both with state rows; split; old id keeps messages), remap on resync, enrichment, badge filters
  with and without viewerUserId (messages and threads), REST routes per role, MCP tools, reply
  hook, two accounts sharing one shard file, concurrent first mutations (stress).
- UI: DOM tests for `ThreadCollaborationBar`, `LoginScreen`, the mobile nav derivation, compose
  coercion on mobile, a kept component inside a shadcn Sheet keeping `--space-2`, and the CSS
  layer build test.
- Run `bun run test:ci`, `bun run test:stress`, `bun run lint`, `bun run build` before merging.
