# Noctua Mail codebase map (generated 2026-10-22 by 8 parallel reader agents)

Repo: /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail


# AREA: auth-session-users

## Summary
Repo root: /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail. All paths below are relative to it.

Auth has no server-side session store and no middleware. The only session is the stateless `noctua_session` cookie: AES-256-GCM-sealed JSON with key sha256(SESSION_SEAL_KEY || "dev-session-key") (lib/auth.ts:8-116). Each route handler calls a guard itself.

There is no app-level password. Login (app/api/auth/login/route.ts) finds an account by email, imap.user or user_accounts link, then checks the password against the IMAP server (lib/mail/imapAuth.ts). It then resolves a userId, preferring the account owner: ownerUserId, then the email user, then the first linked user, then account.id. The session it issues is bound to exactly one active `accountId`.

Signup (app/api/auth/signup/route.ts) needs an invite code, except in desktop mode. It verifies IMAP and creates the user, account and user_accounts link with three bulk "DELETE all + reinsert" saves. The first user ever becomes admin.

Authorization is almost entirely "session.accountId === route accountId" (requireSessionAccountOr403, lib/auth.ts:159-169). requireAccountContext (app/api/_helpers/accountContext.ts:38-58) wraps it. Only destination-folders and copy-to-account use requireOwnedAccountContext (user owns or is linked to the account). Only the two admin routes check users.role, and they read it fresh from the DB (app/api/admin/_auth.ts).

Where IMAP/SMTP passwords live depends on IMAP_CREDENTIALS_STORAGE (cookie|db|both, default both; lib/secret.ts):
- In the DB, encrypted with IMAP_SECRET_KEY: `enc:` + base64(iv|tag|ct).
- In the cookie.
- Overlaid in a process-global in-memory cache keyed by accountId. requireSessionOr401 fills it (lib/credentials.ts) and every account read in lib/db/accounts.ts applies it.

Sync workers are separate `bun run scripts/runSyncJob.ts <json>` subprocesses. They load credentials only from the DB, so cookie-only storage breaks background sync.

MCP uses bearer tokens of the form "mcp_" + sealed session (with creds only when cookie storage is on). The tokens are hashed into the mcp_tokens table and checked in requireMcpAccountContext.

Master schema (lib/db/schema.ts:584-695): accounts(ownerUserId), users(id, email UNIQUE, role, createdAt), user_accounts(userId, accountId) PK, invite_codes, mcp_tokens. Columns are added through a PRAGMA table_info + ALTER TABLE pattern. When the users table is empty, startup creates and logs an admin invite code.

There are no tests for auth/signup/me/switch-account/admin routes or accountContext. Existing route tests build sealed cookies by hand with sealSession.

## Key files
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/auth.ts — Session cookie crypto, payload type, guards, MCP bearer auth [8-37 (cookie name/TTL/SessionData), 44-90 (seal/unseal + MCP seal), 96-116 (set/clear cookie), 118-146 requireSessionOr401, 159-169 requireSessionAccountOr403, 171-186 sessionFromCookie, 188-206 buildSessionPayload, 208-251 MCP token payload, 253-271 mergeAccountCredentials, 289-329 requireMcpAccountContext]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/secret.ts — IMAP_CREDENTIALS_STORAGE mode switch + AES-GCM at-rest encryption of IMAP/SMTP/CalDAV/DeepL secrets [3-8 env parsing, 22-26 assertImapSecretKeyConfigured, 37-43 shouldStorePasswordInDb/shouldIncludeSessionCredentials, 56-98 encode/decodeSecret]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/credentials.ts — Process-global Map<accountId,{imap,smtp}> cache filled from session cookies, overlaid on every DB account read [1-38]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/users.ts — users + user_accounts persistence [6-17 getUsers/getUserById, 19-30 saveUsers (DELETE ALL + reinsert id,email,role,createdAt), 32-36 getUserAccounts, 38-52 listAccessibleAccountIdsForUser, 54-65 saveUserAccounts (DELETE ALL), 67-75 addUserAccountLink]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/inviteCodes.ts — Invite code persistence [7-11 getInviteCodes, 13-53 createInviteCode (role admin|user, default maxUses 1), 55-78 saveInviteCodes, 85-101 claimInviteCode (atomic UPDATE)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/accounts.ts — Account persistence; every read passes through applyCachedCredentials [26-30 getAccounts, 32-44 getAccountsForUser (owner OR user_accounts), 46-68 saveAccounts (DELETE ALL), 70-75 getAccountById, 92-106 upsertAccount, 108-120 patchAccount, 122-149 deleteAccountControlPlane]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/rowParsers.ts — Row mappers for users/invites/accounts [22-32 mapInviteRow, 34-41 mapUserRow, 68-117 mapAccountRow (decodeSecret at 106/113), 162-203 persistAccountRow (stores '' password when DB storage off)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/schema.ts — Master DB schema + additive migrations [539-582 admin invite helpers, 584-695 initMasterSchema (users 606-611, user_accounts 613-617, invite_codes 619-627, mcp_tokens 629-639, ALTER migrations 647-688, admin invite log 690-694)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/auth/login/route.ts — IMAP-credential login [9 limiter, 27-39 account resolution, 43 IMAP verify, 47-58 password write-back, 60-70 userId resolution, 72-81 session]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/auth/signup/route.ts — Invite-based signup (user+account creation) [23 limiter, 37 desktopMode, 40-41 password derivation, 50-64 invite precheck, 72 accountIdFromEmail, 88 IMAP verify, 97-103 claim, 111 role, 136-140 bulk saves, 142-151 session]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/auth/me/route.ts — Session check + sliding refresh; 403 when session lacks accountId [11-40]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/auth/switch-account/route.ts — Rebinds session.accountId to another accessible account; re-derives cookie creds [5-48]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/auth/logout/route.ts — Clears cookie only (no server revocation) [4-8]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/_helpers/accountContext.ts — Standard per-account route guard returning {session, accountId, account, clientId} [38-58 requireAccountContext, 67-86 requireOwnedAccountContext, 88-97 requireAccountContextFromParams]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/admin/_auth.ts — requireAdminSessionOr403 (DB role lookup) [5-13]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/admin/users/route.ts — Admin: list users with their accounts (spreads full User object) [6-59]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/admin/invites/route.ts — Admin: list invites / create single-use 'user' invite [5-35]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/route.ts — GET accounts for session user; POST create/attach account (owner = session user) [8-41]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/[accountId]/relogin/route.ts — Re-verify IMAP creds, write to DB, reissue session [20-75]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/accountPresentation.ts — sanitizeAccountForClient blanks imap/smtp/caldav passwords + DeepL key [3-34]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/accountId.ts — accountIdFromEmail = 'acc-' + sha256(lowercased email)[0:24] [3-7]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/rateLimit.ts — In-memory per-IP limiter (login 5/min, signup 3/min, probe 10/min) [28-58 createRateLimiter, 86-99 parseTrustedProxyHops, 113-153 IP resolver]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/mail/imapAuth.ts — verifyImapCredentials: one-shot ImapFlow connect/logout with given password [10-39]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/mail/imapClientOptions.ts — Where IMAP auth is taken from the Account object [417-509 buildImapFlowOptions (auth from account.imap.user/password)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/syncJobs.ts — Spawns sync subprocess with JSON payload argv (no creds) [378-395 spawnSyncWorker]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/workers/runSyncJob.ts — Worker entry: runSyncOperation with retries [17-23 NON_RETRYABLE_PATTERNS, 25-115]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/syncOperation.ts — Worker loads account via getAccounts() from master DB [230-259]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/testDbHarness.ts — Temp NOCTUA_DATA_DIR + isolated db module import for tests [1-56]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/testSetupEnv.ts — bunfig preload: IMAP_SECRET_KEY test key, IMAP_CREDENTIALS_STORAGE=db [1-13]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/auth/LoginOverlay.tsx — Client login/signup UI [32-140 (submitLogin 45-66, submitSignup 68-92, desktop needs-setup 102-120)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/MailClient.tsx — Client auth state owner [470-490 global 401 handling, 615-617 authState/currentUser/isAdminUser, 4080-4105 /api/auth/me poll, 5217-5219 LoginOverlay mount, 5657 isAdminUser prop]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/useAccountController.ts — Client bootstrap + account switching [31-36 AuthMeResponse, 131-160 initial /api/auth/me + /api/accounts, ~222 switch-account]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/account-settings/tabs/AdminTabContent.tsx — Admin UI (users/invites, desktop storage info) [97-254, 337, 420]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/doc/AUTHENTICATION.md — Docs of current auth model [1-54]

## Extension points
- A) Schema: lib/db/schema.ts:606-611 users table, plus the additive migration block at 647-688. Add e.g. `const userColumns = PRAGMA table_info(users)`, then `ALTER TABLE users ADD COLUMN passwordHash TEXT` and optionally `passwordUpdatedAt INTEGER` / `disabledAt INTEGER`. Also make the email lookup case-insensitive, e.g. an index on lower(email).
- A) lib/db/users.ts: add getUserAuthByEmail(email) → {id, email, role, passwordHash}. Add setUserPassword(userId, hash) and insertUser(user) as single-row writes. Export them through the lib/db.ts barrel (lines 134-142). Keep mapUserRow (lib/db/rowParsers.ts:34-41) hash-free, or at most add hasPassword:boolean. Its output is sent to the browser by /api/auth/me (me/route.ts:32) and /api/admin/users (users/route.ts:50 `...user`).
- A) app/api/auth/login/route.ts:27-78: add a branch before the IMAP fallback. Look up the user by lowercased email. If passwordHash is set, check it with `(globalThis as any).Bun.password.verify(password, hash)` (there are no @types/bun, so follow the pattern at lib/syncJobs.ts:380). Pick the account from listAccessibleAccountIdsForUser(user.id) (lib/db/users.ts:38-52). Build the session with no IMAP creds. Otherwise fall back to the existing IMAP flow.
- A) lib/auth.ts:188-206 buildSessionPayload requires `account` and imapPass/smtpPass. Add an overload or new builder for app-password sessions: {userId, role, accountId?, exp}. Also relax app/api/auth/me/route.ts:17-20, which returns 403 when there is no accountId; the client treats any !ok as unauth (useAccountController.ts:143-147).
- A) app/api/auth/signup/route.ts:35-152: accept a separate app password and hash it with Bun.password.hash(pw, {algorithm:'argon2id'}). Replace the bulk saveUsers/saveAccounts/saveUserAccounts (136-140) with single-row inserts so passwordHash and other users are not wiped. Client side: LoginOverlay.tsx:68-92 currently sends `password: account.imap.password`.
- A) Admin password reset/creation: new routes under app/api/admin/users/[userId]/..., guarded by requireAdminSessionOr403 (app/api/admin/_auth.ts:5-13). Then extend AdminTabContent.tsx.
- B) Schema: lib/db/schema.ts:613-617 user_accounts. Add `ALTER TABLE user_accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'manager'` via the PRAGMA pattern. Update getUserAccounts / addUserAccountLink / saveUserAccounts (lib/db/users.ts:32-75), which currently only know (userId, accountId).
- B) Central authz point: requireSessionAccountOr403 (lib/auth.ts:159-169) only compares session.accountId. requireAccountContext (app/api/_helpers/accountContext.ts:38-58) is where to load the membership role (owner → manager; user_accounts.role otherwise) and return it in AccountContext. Then add a helper like requireAccountRole(ctx, 'editor'|'manager'). Also update the handlers that bypass requireAccountContext: _helpers/syncJobs.ts:14-24,73-91; _helpers/recomputeJobs.ts:21-27,44-59; messages/listMessagesHandler.ts:23-43; plus the direct S401+SA403 routes listed in the inventory.
- B) Destructive account routes currently need only the session-account guard. app/api/accounts/[accountId]/route.ts:33-41 DELETE (deleteAccountControlPlane) and :12-31 PUT (credentials/settings), settings/route.ts:11-21, mcp-tokens routes, and relogin all need a manager-role check.
- B) Admin grant APIs: add e.g. app/api/admin/users/[userId]/accounts (POST/DELETE/PATCH role) next to app/api/admin/users/route.ts. That route already builds the user→accounts map from user_accounts + ownerUserId (lines 9-54).
- B) requireMcpAccountContext (lib/auth.ts:289-329) checks only that the token row exists and is not expired. Add a check that tokenRecord.createdByUserId still has access to tokenRecord.accountId (and its role) so that revoking access also kills MCP tokens.
- C/E) Actor identity for assignee/comments/activity: in REST routes use accountContext.session.userId, as reminders/route.ts:22,76 already do. In MCP tools use ctx.tokenRecord.createdByUserId or authInfo.extra.userId (app/api/mcp/route.ts:55-65). Tools are registered in lib/mcpServer.ts around lines 882-1164 (executeMcpHttpRequest + server.registerTool/server.tool).
- C) The 'Assigned to me' virtual folder needs the current user id on the client. It is available as currentUser.id from /api/auth/me (MailClient.tsx:616), and on the server as session.userId.
- D) Client auth shell to replace: MailClient.tsx:615-617 (authState/currentUser/isAdminUser), 5217-5219 (LoginOverlay mount), 4080-4105 (me poll); useAccountController.ts:131-160 and ~222 (switch-account); AccountSettingsModal.tsx:141 (Admin tab gating).

## Gotchas
- saveUsers, saveUserAccounts, saveAccounts and saveInviteCodes all do DELETE FROM <table> and then reinsert the passed array (lib/db/users.ts:19-30, 54-65; lib/db/accounts.ts:46-68; inviteCodes.ts:55-78). saveUsers inserts only (id, email, role, createdAt), so any new users column (passwordHash) is wiped on the next signup. Signup runs three of these concurrently and not in one transaction (signup/route.ts:136-140), so concurrent signups can lose rows.
- Signup's saveAccounts re-persists every account from getAccounts(), and that list has applyCachedCredentials applied. In 'both'/'db' mode this can write session-cached passwords for other accounts into the DB. A signup whose email maps to an existing accountId replaces that row with INSERT OR REPLACE (last wins), so ownerUserId moves to the new user.
- Login resolves userId with ownerUserId first (login/route.ts:65-69). Today anyone who logs in with a shared mailbox's IMAP creds becomes the owner user. If there is no users row, userId falls back to account.id; then getUserById returns null, the admin gate fails and /api/auth/me returns user:null.
- users.email is UNIQUE and case-sensitive. Signup stores account.email as typed (signup:114), while login compares lowercased (login:22,32). Signing up with an existing user email throws inside saveUsers after the invite is already claimed, which burns the invite.
- Every session is bound to one active accountId. requireSessionAccountOr403 rejects any other account even if the user has access, which is why switch-account exists and why requireOwnedAccountContext was added for copy/move. Shared-mailbox features must either use switch-account or move to a membership-based guard.
- session.role is written but never used for authorization. The admin check re-reads users.role from the DB (admin/_auth.ts:8). Sessions cannot be revoked: logout only clears the cookie and there is no server session table. /api/auth/me rotates the cookie on every poll (sliding TTL, default 24h).
- credentials.ts sessionCache is process-global and keyed by accountId, not user. Whoever last hit requireSessionOr401 or an MCP call for an account supplies the IMAP/SMTP creds for all in-process use of that account: other users, the IMAP stream, the move queue (lib/messageMoveJobs.ts:104), CalDAV (lib/caldav/sync.ts:76). With shared mailboxes plus cookie/both storage, users would use each other's creds. IMAP_CREDENTIALS_STORAGE=db makes the cache a no-op because session.imap and smtp are undefined.
- Sync workers (lib/syncJobs.ts:378-395 → scripts/runSyncJob.ts → lib/syncOperation.ts:254) get only the JSON payload {accountId, folderId, mode, ...} as an argv argument and inherit process.env (Bun.spawn has no env option). They read the password from the master DB via mapAccountRow→decodeSecret, using the inherited IMAP_SECRET_KEY. Their own sessionCache is empty. With IMAP_CREDENTIALS_STORAGE=cookie, persistAccountRow stores '' (rowParsers.ts:186,191) and decodeSecret returns '' (secret.ts:80). ImapFlow then throws AuthenticationFailure('No password configured') (node_modules/imapflow/lib/imap-flow.js:1285), which is non-retryable in runSyncJob.ts:17-23, so the worker exits 1 and background sync never works in cookie mode. Recompute workers (lib/workerJobRegistry.ts:94-100) take only accountId and don't need IMAP.
- The default IMAP_CREDENTIALS_STORAGE is 'both', not 'db' (secret.ts:4). Startup throws if DB storage is on and IMAP_SECRET_KEY is shorter than 32 chars (instrumentation.ts:9-10 → secret.ts:22-26). The Tauri sidecar sets IMAP_CREDENTIALS_STORAGE=db but sets neither IMAP_SECRET_KEY nor SESSION_SEAL_KEY (src-tauri/src/main.rs:146-156), so the session key falls back to 'dev-session-key' (auth.ts:45). It is also not set in NODE_ENV=production, which makes the cookie `secure` on http://127.0.0.1.
- In cookie/both mode, MCP tokens embed IMAP/SMTP creds inside the sealed bearer token (auth.ts:225-235). Minting one throws if the current session lacks creds. Tokens with no expiry use exp=253402300799. A token stays valid after a user loses account access, because only the token row and expiry are checked.
- There is no Next middleware: every route must call its guard. Unauthenticated routes: auth/login, auth/logout, auth/signup, auth/me (manual cookie parse), version, probe (unauthenticated outbound TCP probe, rate-limited only), desktop/* (env-gated only).
- The rate limiters are module-level singletons. getRequestIp returns 'unknown' when there is no X-Forwarded-For/X-Real-IP, so all test requests share one bucket: more than 5 login calls per minute in one test process returns 429. The login limiter counts every attempt, not just failures, despite the comment at login/route.ts:8.
- Bun.password is available because the app runs under `bun --bun next` (package.json:17-19; Dockerfile uses oven/bun). There is no @types/bun; access it via `(globalThis as typeof globalThis & { Bun?: any }).Bun`, as lib/syncJobs.ts:380 does. bun:sqlite is imported with a webpackIgnore dynamic import (lib/db/connection.ts:21).
- lib/serverDb.ts, lib/serverImap.ts and lib/testDbHarness.ts import './db.ts?server-runtime' / '?test-harness' query specifiers to get separate module instances, so Bun mock.module('@/lib/db') in tests cannot replace them. New auth DB helpers that routes call via '@/lib/db' can be mocked by other test files, and mock.module leaks across files.
- PUT /api/accounts/[id]/settings has no role check, so a non-admin can set settings.sync (performance). The client hides it for non-admins (PreferencesTabContent.tsx:144, lib/accountSettings.ts:91). The client's isAdminUser comes from /api/auth/me user.role (DB), not from the cookie.
- LoginOverlay.tsx:18-26 has its own client-side accountIdFromEmail (32-bit hash). It differs from the server's lib/accountId.ts, which uses sha256. The server always overrides it (signup:72, accounts POST:26).

## Q&A
### 1. Exact session cookie payload shape and every place that reads session.imap/session.smtp or session.role/userId.
Cookie name: `noctua_session` (lib/auth.ts:9). Value: base64(iv[12] | GCM tag[16] | ciphertext), AES-256-GCM over JSON, key = sha256(SESSION_SEAL_KEY || "dev-session-key") (auth.ts:44-55). Attributes (setSessionCookie, auth.ts:96-106): httpOnly, sameSite=lax, secure only when NODE_ENV=production, path=/, maxAge=SESSION_TTL_SECONDS (default 86400, auth.ts:12-17).

Payload type SessionData (auth.ts:30-37):
`{ userId: string; accountId?: string; role?: string; exp: number /* unix seconds */; imap?: {user: string; pass: string}; smtp?: {user: string; pass: string} }`
- imap/smtp are only added when shouldIncludeSessionCredentials(), i.e. IMAP_CREDENTIALS_STORAGE is cookie or both (secret.ts:7-8,41; auth.ts:201-204).
- exp is checked on unseal (auth.ts:68).
- MCP variant McpSessionData = SessionData + {kind:'mcp', tokenId} (auth.ts:39-42), sent as `Authorization: Bearer mcp_<sealed>` (auth.ts:83-90, 208-251).

Writers:
- buildSessionPayload (auth.ts:188-206): login/route.ts:72-80, signup/route.ts:142-150, accounts/[accountId]/relogin/route.ts:64-73.
- refreshSession (auth.ts:23-28): auth/me/route.ts:29-38, auth/switch-account/route.ts:28-46.

Readers of session.imap / session.smtp:
- auth.ts:139: requireSessionOr401 → cacheSessionCredentials (credentials.ts:14-20). The cache is consumed by applyCachedCredentials (credentials.ts:22-38) in lib/db/accounts.ts:29, 43, 74, 104, 118.
- auth.ts:226-229: buildMcpSessionPayload.
- auth.ts:266-269: mergeAccountCredentials, used at auth.ts:327.
- auth.ts:311: cacheSessionCredentials for MCP sessions.
- app/api/auth/switch-account/route.ts:25-27.

Readers of session.role: none for authorization. It is only copied: auth.ts:197, 218; relogin/route.ts:68. It is set at login:74 and signup:144.

Readers of session.userId:
- app/api/accounts/route.ts:11, 35, 39
- auth/me/route.ts:23, 25
- auth/switch-account/route.ts:15
- _helpers/accountContext.ts:79 (requireOwnedAccountContext)
- admin/_auth.ts:8
- mcp/route.ts:62 (authInfo.extra.userId)
- accounts/[accountId]/mcp-tokens/route.ts ~63 (createdByUserId)
- relogin/route.ts:67
- reminders/route.ts:22, 76, 112, 119, 132
- calendar/invites/process/route.ts:47
- messages/delete/associations/route.ts:42
- messages/delete/linked-calendar/route.ts:46
- auth.ts:217

Readers of session.accountId: auth.ts:150 (listSessionAccountIds, unused), 161 (requireSessionAccountOr403), 296-327 (MCP); me/route.ts:17; calendar/import/route.ts:30.

Unused helpers: getSessionFromRequest (auth.ts:113), requireAccountAccessOr403 (auth.ts:155).

### 2. How does an IMAP connection obtain credentials at request time vs in the sync worker subprocess? Does the worker read the DB password? What happens with IMAP_CREDENTIALS_STORAGE=cookie for a worker?
All IMAP clients use account.imap.user/password from an Account object (buildImapFlowOptions, lib/mail/imapClientOptions.ts:417-509; SMTP lib/mail/smtp.ts:75-77).

Request time (Next process):
1. requireSessionOr401 unseals the cookie and calls cacheSessionCredentials(session) (auth.ts:136-140). This stores {imap, smtp} from the cookie in a process-global Map keyed by accountId (lib/credentials.ts:9-20).
2. requireAccountContext then calls getAccountById (accountContext.ts:52). That runs mapAccountRow, where decodeSecret decrypts imapPassword/smtpPassword using IMAP_SECRET_KEY (rowParsers.ts:106,113; secret.ts:78-98).
3. applyCachedCredentials overlays the cached cookie creds when present (credentials.ts:22-38; lib/db/accounts.ts:74).

In 'db' mode the cookie has no creds, so the cache entry is empty and the DB password is used. MCP calls do the same with creds from the bearer token via mergeAccountCredentials (auth.ts:311-327). Other in-process jobs (messageMoveJobs.ts:104 getAccounts, caldav/sync.ts:76) also see whatever the cache last held.

Worker:
1. startSyncJob → spawnSyncWorker (lib/syncJobs.ts:378-395) runs `bun run scripts/runSyncJob.ts '<JSON {accountId, folderId, fullSync, mode, ..., clientId}>'` with no creds and inherited env.
2. scripts/runSyncJob.ts → lib/workers/runSyncJob.ts:62 → runSyncOperation → runSyncOperationBatched calls getAccounts() from the master DB (lib/syncOperation.ts:254-259).

So yes, the worker reads and decrypts the DB password itself, with IMAP_SECRET_KEY inherited from the parent env. Its own credentials cache is always empty.

With IMAP_CREDENTIALS_STORAGE=cookie:
- persistAccountRow writes '' for imap/smtp passwords (rowParsers.ts:186,191), and decodeSecret returns '' unconditionally (secret.ts:80).
- The worker builds ImapFlow with an empty pass, and imapflow throws AuthenticationFailure('No password configured') (node_modules/imapflow/lib/imap-flow.js:1285).
- runSyncJob treats that as non-retryable (runSyncJob.ts:17-23,81-88) and exits 1, so the job fails. For in-process paths, imapError.ts:69-75 maps this to 401 {code:'imap_password_missing', reauthRequired:true}, and the client opens the relogin dialog (MailClient.tsx:475-478).

Net effect: background/worker sync only works in db or both mode. Recompute workers (lib/workerJobRegistry.ts:94-100) get only accountId and never touch IMAP.

### 3. Where is 'role' checked (admin gating) on server and client?
Server (the only check): app/api/admin/_auth.ts:5-13 requireAdminSessionOr403 → requireSessionOr401, then getUserById(session.userId), then `user.role !== 'admin'` → 403. Used by app/api/admin/invites/route.ts:6,30 (GET/POST) and app/api/admin/users/route.ts:7 (GET).

Role is normalized to 'admin'|'user' by mapUserRow (rowParsers.ts:38) and createInviteCode (inviteCodes.ts:32).

Role assignment:
- signup/route.ts:49 (desktop default 'admin'), :63 and :102 (invite role), :111 (the first user ever is always admin).
- The admin invite is auto-created when users is empty (schema.ts:539-582, 690-694), and its code is logged to the console.
- POST /api/admin/invites always creates role 'user', maxUses 1 (invites/route.ts:30).

There is no server role check on PUT /api/accounts/[id]/settings, so the admin-only settings.sync can be written by anyone.

Client:
- MailClient.tsx:616-617 `isAdminUser = currentUser?.role === 'admin'`. currentUser comes from /api/auth/me (useAccountController.ts:149; MailClient.tsx:4103).
- That flag is passed to AccountSettingsModal (MailClient.tsx:5657):
  - Admin tab added only if isAdminUser (AccountSettingsModal.tsx:141); hasSavable* checks at 104-126.
  - PreferencesTabContent.tsx:144: Performance/IDLE settings.
  - lib/accountSettings.ts:68-91,125-128: sync settings only diffed for admins.
  - AdminTabContent.tsx:145-254: fetches /api/admin/users and /api/admin/invites; POSTs invites at 194.
- Role is displayed at AdminTabContent.tsx:337 and 420.

### 4. How are users created today (signup + invite), and what would a password-based login need to add minimally (schema columns, mapUserRow, login route branch)?
Today users are created only by POST /api/auth/signup (app/api/auth/signup/route.ts):
1. Rate limit, 3/min per IP (23-32).
2. Body {inviteCode, account, password?}. The password is account.imap.password, falling back to body.password (40-41).
3. Unless NOCTUA_DESKTOP_MODE=true: invite pre-check for exists, uses<maxUses and not expired (50-64).
4. accountId = accountIdFromEmail(account.email) (72).
5. verifyImapCredentials (88).
6. userId = randomUUID() (93).
7. Atomic claimInviteCode (97-103; inviteCodes.ts:85-101).
8. role = 'admin' if no users exist, else the invite role (111).
9. Bulk saveUsers / saveAccounts (ownerUserId=userId; password stored only if DB storage) / saveUserAccounts (+{userId, accountId}) (118-140).
10. Session cookie (142-151).

POST /api/accounts (accounts/route.ts:15-41) adds further accounts for an existing user (owner = session.userId + user_accounts link) but never creates users. There is no admin 'create user' route. Admins can only mint invites.

Minimal additions for app-password login:
(a) Schema, in initMasterSchema's migration block (schema.ts:647-688):
  - `ALTER TABLE users ADD COLUMN passwordHash TEXT`, via a PRAGMA table_info(users) check, plus optionally passwordUpdatedAt INTEGER.
  - Consider normalizing email to lowercase (signup stores it as typed, signup:114).
  - For B: `ALTER TABLE user_accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'manager'`.
(b) Data layer:
  - Keep the User type (lib/data.ts:413-418) and mapUserRow (rowParsers.ts:34-41) without the hash, because User is serialized to clients in auth/me:32 and admin/users:50. Add `hasPassword?: boolean` if the UI needs it.
  - Add lib/db/users.ts functions getUserAuthByEmail(emailLower) returning {id, email, role, passwordHash}, setUserPassword(userId, hash) and insertUser(user). Export them from lib/db.ts:134-142.
  - Stop using saveUsers in signup: it DELETEs and reinserts only 4 columns and would wipe hashes.
(c) Login route branch, in app/api/auth/login/route.ts after the payload checks (24-26):
  1. Load the user by email.
  2. If user?.passwordHash, verify with Bun.password.verify(password, hash). On failure return 401 'Invalid credentials'.
  3. accountIds = listAccessibleAccountIdsForUser(user.id) (users.ts:38-52). Pick the first, or a remembered one.
  4. Issue the session {userId: user.id, role: user.role, accountId, exp} with no imap/smtp. buildSessionPayload needs an account-less/cred-less variant, or call it with imapPass ''. With IMAP_CREDENTIALS_STORAGE=db it already omits creds.
  5. Otherwise keep the existing IMAP flow as a fallback/migration path, and optionally set the password on first login.
(d) Signup: accept an app password, hash it with Bun.password.hash(pw, {algorithm:'argon2id'}) and insert it with the user. Decouple it from the IMAP password (LoginOverlay.tsx:70-74 sends the IMAP password).
(e) /api/auth/me (me/route.ts:17-20) returns 403 if the session has no accountId. Allow it for users with zero accounts, or ensure an accountId is always present.
(f) IMAP creds must then come from the DB, so require IMAP_CREDENTIALS_STORAGE=db and a valid IMAP_SECRET_KEY. Relogin (accounts/[accountId]/relogin/route.ts) remains the path for updating stored IMAP passwords.

### 5. Full inventory of API routes under app/api with the guard each uses.
Legend:
- AC = requireAccountContext (requireSessionOr401 → requireSessionAccountOr403 → getAccountById; accountContext.ts:38-58)
- ACP = requireAccountContextFromParams (same as AC)
- AMC = requireAccountAndMessageContext (→AC; _helpers/message/routeHelpers.ts:58-123)
- IMMC = requireImapMessageMutationContext (→AMC; routeHelpers.ts:125-144)
- S+SA = direct requireSessionOr401 + requireSessionAccountOr403
- OWNED = requireOwnedAccountContext
- ADMIN = requireAdminSessionOr403
- MCP = requireMcpAccountContext

Routes (`.../` = accounts/[accountId]/):
- accounts/route.ts GET: requireSessionOr401 only (getAccountsForUser(session.userId)); POST: requireSessionOr401, plus requireSessionAccountOr403 only if the account id already exists
- accounts/[accountId]/route.ts PUT, DELETE: ACP
- .../calendar/conflicts/[eventId]/resolve POST: AC
- .../calendar/conflicts GET: AC
- .../calendar/events/[eventId]/respond POST: AC
- .../calendar/events/[eventId] GET/PUT/DELETE: AC
- .../calendar/events/participation GET: AC
- .../calendar/events GET/POST/DELETE: AC
- .../calendar/invites/process POST: AC
- .../calendar/sync POST/GET: AC
- .../categories/debug GET: AC
- .../categories/model/reset POST: AC
- .../categories/recompute POST: handleRecomputeStartRequest = S+SA (_helpers/recomputeJobs.ts:21-27)
- .../categories/recompute/status GET: handleRecomputeStatusRequest = S+SA (recomputeJobs.ts:44-59)
- .../compose/recipients GET: S+SA
- .../destination-folders GET: OWNED
- .../drafts/[draftId]/discard POST: AC
- .../drafts/[draftId]/send POST: AC
- .../drafts/save POST: AC
- .../folders/[folderId]/consistency POST: AC
- .../folders/[folderId]/delete POST: AC
- .../folders/[folderId]/rename POST: AC
- .../folders/create POST: AC
- .../folders GET/PUT: AC
- .../imap/poll GET: AC
- .../imap/stream GET: AC
- .../mcp-tokens/[tokenId] DELETE: AC
- .../mcp-tokens GET/POST: AC
- .../message-topics/explain GET: AC
- .../message-topics GET/POST: AC
- .../message-topics/suggest GET: AC
- .../messages/[messageId]/archive POST: IMMC
- .../messages/[messageId]/attachments/[attachmentId] GET: S+SA (lines 23-35); DELETE: AMC (line 127)
- .../messages/[messageId]/calendar-diff GET: AC
- .../messages/[messageId]/category POST: AMC
- .../messages/[messageId]/delete POST: IMMC
- .../messages/[messageId]/flags POST: IMMC
- .../messages/[messageId]/html GET: S+SA (lines 71-80)
- .../messages/[messageId]/not-spam POST: IMMC
- .../messages/[messageId]/resync POST: AMC
- .../messages/[messageId] GET: AC
- .../messages/[messageId]/source GET: S+SA (handleGetMessageSourceRequest, lines 19-27)
- .../messages/[messageId]/spam POST: IMMC
- .../messages/[messageId]/translate POST: AMC
- .../messages/[messageId]/unsubscribe POST: AMC
- .../messages/copy-to-account POST: AC on the source + OWNED on the destination (lines 69-72)
- .../messages/delete/associations POST: AC
- .../messages/delete/bulk POST: AC
- .../messages/delete/linked-calendar POST: AC
- .../messages/flags/bulk POST: AC
- .../messages/move POST: AC
- .../messages GET: handleListMessagesRequest = S+SA (app/api/messages/listMessagesHandler.ts:23-43)
- .../recipient-aliases/[aliasId] PUT/DELETE: AC
- .../recipient-aliases GET/POST: AC
- .../recipient-aliases/transfer GET/POST: AC
- .../related GET: AC
- .../relogin POST: ACP
- .../reminders GET/POST/DELETE: AC
- .../search GET: handleListMessagesRequest = S+SA
- .../sender-icon GET: S+SA
- .../settings PUT: ACP
- .../smtp/send POST: AC
- .../sync/new-candidates POST: AC
- .../sync POST: handleSyncStartRequest = S+SA (_helpers/syncJobs.ts:14-24)
- .../sync/status GET: handleSyncStatusRequest = S+SA (syncJobs.ts:73-91)
- .../thread/related POST: AC
- .../threads/recompute POST: handleRecomputeStartRequest = S+SA
- .../threads/recompute/status GET: handleRecomputeStatusRequest = S+SA
- .../threads GET: AC
- .../topics/[topicId] PUT/DELETE: AC
- .../topics/[topicId]/signals DELETE: AC
- .../topics/[topicId]/suggestions GET: AC
- .../topics GET/POST: AC
- .../topics/stats GET: AC
- .../topics/transfer GET/POST: AC
- .../translation/compose POST: AC
- .../translation/test POST: AC
- admin/invites GET/POST: ADMIN
- admin/users GET: ADMIN
- auth/login POST: none (rate limit 5/min + IMAP verify)
- auth/logout POST: none
- auth/me GET: manual sessionFromCookie (401 if none, 403 if no accountId; does not cache creds)
- auth/signup POST: none (rate limit 3/min + invite code unless desktop mode)
- auth/switch-account POST: requireSessionOr401 + listAccessibleAccountIdsForUser membership check
- calendar/import POST: S+SA (accountId from body or session.accountId)
- calendar/test POST: requireSessionOr401 only
- desktop/needs-setup GET: none (404 unless NOCTUA_DESKTOP_MODE=true)
- desktop/storage-info GET: none (same env gate)
- mcp POST: MCP bearer token; GET/DELETE return 405
- probe POST: none (rate limit 10/min only)
- version GET: none

### 6. How does the desktop (Tauri) mode affect auth (NOCTUA_DESKTOP_MODE)?
Server env NOCTUA_DESKTOP_MODE=true is read in only three places:
- app/api/auth/signup/route.ts:37,43,47-64,96-103: the invite code is optional and skipped entirely; claimedInviteRole defaults to 'admin' (line 49); the first user is admin anyway (111).
- app/api/desktop/needs-setup/route.ts:5: returns {needsSetup: users.length===0}, else 404.
- app/api/desktop/storage-info/route.ts:5: data paths, else 404.

Login, sessions and guards are identical to web mode. Same cookie and same IMAP-verified login.

The Tauri sidecar (src-tauri/src/main.rs:146-156) sets PORT, HOSTNAME=127.0.0.1, NODE_ENV=production (so the cookie is `secure`), NOCTUA_DESKTOP_MODE=true, IMAP_CREDENTIALS_STORAGE=db and NOCTUA_DATA_DIR. It does not set SESSION_SEAL_KEY, so the key falls back to 'dev-session-key', or IMAP_SECRET_KEY, which the db mode startup assert requires (secret.ts:22-26 via instrumentation.ts:9-10). The dev equivalent is package.json:27 `desktop:dev-server`.

The client does not read the env var. It detects Tauri via window.__TAURI_INTERNALS__ (lib/desktop.ts:37-53).
- LoginOverlay.tsx:98-140: in desktop it calls /api/desktop/needs-setup and opens account setup directly if there are no users; 'Got an invite code?' becomes 'Set up new account' (205) and skips the invite dialog.
- AdminTabContent.tsx:229-262,368-380: storage info shown instead of invite management.

The desktop app is single-user by assumption. Multi-user/shared-inbox features should probably be hidden or no-op there.

### 7. How do tests exercise auth routes (lib/testDbHarness.ts, cookie building helpers)?
No tests exist for app/api/auth/*, app/api/admin/*, app/api/_helpers/accountContext.ts, lib/auth.ts, lib/credentials.ts, lib/db/users.ts or lib/db/inviteCodes.ts. Related tests: lib/secret.test.ts (round-trip; spawns `bun -e` subprocesses with altered env to test key asserts), lib/rateLimit.test.ts, lib/db.accounts.test.ts (getAccountById/getAccounts/patchAccount).

Pattern used by route tests: app/api/accounts/[accountId]/mcp-tokens/route.test.ts, messages/[messageId]/source/route.test.ts, messages/flags/bulk/route.test.ts, calendar/import/route.test.ts, translation/compose/route.test.ts, sync/new-candidates/route.test.ts, folders/[folderId]/consistency/route.pendingMoves.test.ts, app/api/mcp/route.test.ts.
1. `import { dbModulePromise } from '@/lib/testDbHarness'` and `const { upsertAccount, ... } = await dbModulePromise`. The harness (lib/testDbHarness.ts:1-56) creates a shared mkdtemp NOCTUA_DATA_DIR, sets ACCOUNT_DB_IDLE_MS=0, cleans up on exit, and imports './db.ts?test-harness' so mock.module('@/lib/db') elsewhere can't replace it.
2. Seed accounts with upsertAccount(buildAccount(id)).
3. Build a SessionData literal, e.g. {userId:'user-x', accountId, role:'user', exp: now+3600, imap?/smtp?}, and seal it: `cookie: \`noctua_session=${encodeURIComponent(sealSession(session))}\`` (mcp-tokens test lines 41-58; source test 73-80).
4. Call the exported handler directly: `POST(new Request(url, {method, headers:{cookie, 'content-type':'application/json'}, body}), { params: Promise.resolve({ accountId }) })`, or helper functions like handleGetMessageSourceRequest(request, {accountId, messageId}).
5. IMAP/DB side effects are stubbed with bun `mock.module('@/lib/serverImap' | '@/lib/serverDb' | '@/lib/mail/imap' | '@/lib/db', () => ({...actual, fn}))`. These mocks leak across files (see comments in flags/bulk test 10-17), and mcp route test calls mock.restore() after import.

The MCP tests mint tokens through the real POST route and use unsealMcpSession/hashOpaqueToken to assert. Env comes from bunfig.toml preload lib/testSetupEnv.ts: IMAP_SECRET_KEY test value and IMAP_CREDENTIALS_STORAGE=db, so cookies carry no creds unless a test adds them; shouldIncludeSessionCredentials() can be checked to branch. SESSION_SEAL_KEY is unset, so 'dev-session-key' is used. DOM tests (*.dom.test.tsx) run separately via `bun run test:dom`.

When testing login/signup, mock '@/lib/mail/imapAuth' verifyImapCredentials. Mind the module-level rate limiters: all requests without XFF share the 'unknown' bucket, giving 429 after 5 logins or 3 signups per minute.



# AREA: write-routes-inventory

## Summary
Repo root: /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail. In the answers below, "…/" means app/api/accounts/[accountId]/. Every route under app/api/accounts is authorized by one rule: the sealed session cookie's single `session.accountId` must equal the route's accountId (lib/auth.ts:159-170 requireSessionAccountOr403). Nothing checks user_accounts and nothing checks a role, so in practice each user can only act on the account they logged in with. Guards are reached in six ways. (1) RAC = requireAccountContext (app/api/_helpers/accountContext.ts:38-58): session check, then the accountId check, then getAccountById. (2) RACFP = requireAccountContextFromParams (accountContext.ts:88-97), which just calls RAC. (3) RAMC = requireAccountAndMessageContext (app/api/_helpers/message/routeHelpers.ts:58-123): RAC plus a getMessageById lookup. (4) RIMMC = requireImapMessageMutationContext (routeHelpers.ts:125-144): RAMC plus a required IMAP uid and mailboxPath. (5) RSA = requireSessionOr401 (lib/auth.ts:119) and requireSessionAccountOr403 called directly in the route, or through the shared handlers recomputeJobs.ts, syncJobs.ts and app/api/messages/listMessagesHandler.ts. (6) ROAC = requireOwnedAccountContext (accountContext.ts:67-86): allows ANY account the user owns or is linked to via user_accounts. Only copy-to-account and destination-folders use ROAC. The master DB (getDb, lib/db/connection.ts:176) holds accounts, users, user_accounts, invite_codes and mcp_tokens (lib/db/schema.ts:584-640). Everything else is in a per-account shard DB (getAccountDb/withAccountDb, connection.ts:219-250; schema.ts:697+): folders, messages, attachments, translations, threads, mailbox_state, category model, topics, recipient_aliases, calendar_*, draft_tombstones. Only 6 routes write the master DB: POST /api/accounts, PUT/DELETE …/ (account root), PUT …/settings, POST …/relogin, and POST …/mcp-tokens plus DELETE …/mcp-tokens/[tokenId]. MCP's requireMcpAccountContext also updates mcp_tokens.lastUsedAt. All other mutating routes write the shard and/or change IMAP/SMTP/CalDAV state, or call DeepL or an unsubscribe URL. Today the only role concept is users.role 'admin'|'user' (lib/data.ts:416), and only app/api/admin/* checks it (app/api/admin/_auth.ts:5-12). Several POST routes are read-only and some GET routes write caches, so role gating must be decided per handler, not by HTTP method.

## Key files
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/_helpers/accountContext.ts — requireAccountContext / requireOwnedAccountContext / requireAccountContextFromParams: the central guard and the main place to add a minRole option [38-97]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/auth.ts — SessionData shape (userId, accountId, role, imap/smtp creds); requireSessionOr401; requireSessionAccountOr403 (accountId equality only); MCP token payload with sealed creds; requireMcpAccountContext [30-36,119-170,188-241,283-328]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/_helpers/message/routeHelpers.ts — requireAccountAndMessageContext / requireImapMessageMutationContext wrappers; trashMessageInAccount (move to Trash, or hard-delete if already there) [58-144,220-269]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/_helpers/recomputeJobs.ts — Separate guard path (RSA) for categories/threads recompute start + status [15-67]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/_helpers/syncJobs.ts — Separate guard path (RSA) for sync start/status [10-95]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/messages/listMessagesHandler.ts — Separate guard path (RSA) for …/messages and …/search GET [13-60]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/accountPresentation.ts — sanitizeAccountForClient: blanks imap/smtp/caldav passwords and the DeepL apiKey (adds deepl.hasApiKey). Usernames, hosts, ownerUserId and settings are still sent. [3-34]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/schema.ts — initMasterSchema (accounts, users, user_accounts(userId,accountId) with no role column, invite_codes, mcp_tokens) and the migration pattern (PRAGMA table_info + ALTER). initAccountSchema starts at 697 (shard tables). [584-697]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/accounts.ts — getAccountsForUser (user_accounts OR ownerUserId), upsertAccount, patchAccount, deleteAccountControlPlane (deletes master rows + shard file) [32-149]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/rowParsers.ts — mapAccountRow (decrypts secrets), mergeAccount (spreads the raw payload, including ownerUserId and id), persistAccountRow (INSERT OR REPLACE) [68-116,138-155,162-190]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/users.ts — listAccessibleAccountIdsForUser, addUserAccountLink: where a user_accounts.role would be read and written [38-75]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/mcpTokens.ts — listMcpTokens/insert/delete/touch, all on the master DB [10-94]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/admin/_auth.ts — requireAdminSessionOr403: the only role check today (users.role === 'admin', re-read from DB) [5-13]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/secret.ts — IMAP_CREDENTIALS_STORAGE (db|cookie|both, default both): decides whether creds are stored in the DB (encrypted) and/or the session cookie/MCP token [3-43]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/credentials.ts — In-memory credential cache keyed only by accountId; it overlays every getAccountById result [9-38]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/mcpServer.ts — MCP tools today: list_accounts, list_folders, list_mailing_list_aliases, search_messages (all read-only) [910-1015]

## Extension points
- app/api/_helpers/accountContext.ts:38 requireAccountContext(request, accountId, options): add options.minRole ('viewer'|'editor'|'manager'). Replace the requireSessionAccountOr403 call at line 50 with a lookup of user_accounts.role by session.userId, and put role on the returned AccountContext (type at lines 7-12). RAMC/RIMMC (routeHelpers.ts:90) and RACFP (accountContext.ts:96) pick this up automatically if they forward options.
- lib/auth.ts:159 requireSessionAccountOr403 has direct callers that skip RAC: app/api/accounts/route.ts:29, …/compose/recipients/route.ts:20, …/messages/[messageId]/attachments/[attachmentId]/route.ts:34, …/messages/[messageId]/html/route.ts:80, …/messages/[messageId]/source/route.ts:27, …/sender-icon/route.ts:20, app/api/_helpers/recomputeJobs.ts:27,59, app/api/_helpers/syncJobs.ts:24,91, app/api/messages/listMessagesHandler.ts:43. Either make it DB-backed and role-aware, or move these callers onto RAC.
- app/api/_helpers/accountContext.ts:67 requireOwnedAccountContext: used for copy-to-account (…/messages/copy-to-account/route.ts:71) and …/destination-folders/route.ts:14. It must require editor on the destination account once accounts are shared.
- lib/db/schema.ts:613-617 user_accounts(userId, accountId): add a role TEXT column using the PRAGMA table_info/ALTER pattern from schema.ts:645-686, and backfill existing rows plus ownerUserId as 'manager'.
- lib/db/accounts.ts:32 getAccountsForUser and lib/db/users.ts:38 listAccessibleAccountIdsForUser: return role so GET /api/accounts (app/api/accounts/route.ts:8-13) and MCP list_accounts can show it.
- lib/db/rowParsers.ts:138 mergeAccount: whitelist the patchable fields (drop id/ownerUserId/dbPath). Credential fields (imap/smtp/caldav/deepl) should be writable by managers only.
- lib/accountPresentation.ts:3 sanitizeAccountForClient: make it role-aware. Non-managers should not get imap/smtp/caldav user and host, ownerUserId, or deepl.hasApiKey.
- lib/auth.ts:283-328 requireMcpAccountContext: re-check the token creator's current role at use time via tokenRecord.createdByUserId and user_accounts before allowing the planned mutating MCP tools (assign/status/comment).
- app/api/admin/_auth.ts:5 requireAdminSessionOr403: reuse it for the new admin 'grant user access to mailbox' routes (place next to app/api/admin/users/route.ts).
- New collaboration REST routes (e.g. …/threads/[threadId]/assignment|status|comments|activity) should use RAC with minRole 'editor' for writes and 'viewer' for reads, and store data in the shard DB (add tables in initAccountSchema, lib/db/schema.ts:697+). Comment and activity rows need a userId column that references master users.id.

## Gotchas
- Today the guard is session.accountId === route accountId (lib/auth.ts:159-170). user_accounts is NOT consulted for per-route access; only GET /api/accounts (list) and ROAC use it. A user linked to several accounts still has to switch the session (app/api/auth/switch-account) to act on another one.
- PUT /api/accounts/[accountId] calls patchAccount(accountId, payload) with the raw client payload. mergeAccount (lib/db/rowParsers.ts:146-148) spreads ...payload, so a client can overwrite ownerUserId and even id. persistAccountRow then does INSERT OR REPLACE keyed by the payload id, which can write over another account's row. Whitelist fields before shipping shared mailboxes.
- …/drafts/[draftId]/discard (route.ts:20-70) never checks that the message is a draft. Any message id is tombstoned, IMAP-deleted and removed locally, so it bypasses the Trash flow. …/drafts/[draftId]/send does check the \Draft flag (lib/drafts.ts:340).
- Some POST routes are read-only: …/messages/delete/associations, …/thread/related, …/sync/new-candidates, …/folders/[folderId]/consistency. Some GET routes write: attachments GET caches extracted bytes (saveAttachmentData); messages list with sortBy=size backfills sizes; imap/stream GET writes mailbox_state and deletes local rows on IMAP expunge. Gate per handler, not by HTTP method.
- Message row ids change on move/archive/spam/not-spam/delete-to-trash (relocateMovedMessage previousId→nextId in routeHelpers.ts:146-186). Key collaboration state (assignee/status/comments) by threadId or the RFC Message-ID, not by local message id.
- calendar_reminders are per-user (column userId; routes pass session.userId: reminders/route.ts, delete/linked-calendar/route.ts:43-47). calendar_events, topics, aliases, flags and categories are account-wide, so a viewer could reasonably manage their own reminders.
- AccountSettings (lib/data.ts:60-86) mixes per-user UI preferences (layout.defaultView, appearance.*, calendar.weekStartsOn) with account-level config (sync intervals, threading, signatures). PUT …/settings shallow-merges into master accounts.settings, so in a shared mailbox one user's UI change would affect everyone. Split into per-user preferences before gating settings to manager.
- Flags such as \Seen are written to IMAP and are shared by every user of the mailbox. The read state is not per-user.
- MCP tokens: POST …/mcp-tokens returns `secret: rawToken` once (route.ts:73). When IMAP_CREDENTIALS_STORAGE includes 'cookie' (the default is 'both', lib/secret.ts:4), the token embeds IMAP/SMTP user+password sealed with SESSION_SEAL_KEY (lib/auth.ts:224-236). With IMAP_CREDENTIALS_STORAGE=db there are no creds in the token. GET …/mcp-tokens lists every token on the account (all creators) and DELETE can revoke any of them; neither filters by createdByUserId.
- The credential cache in lib/credentials.ts:9-20 is keyed only by accountId and overlays every getAccountById/getAccountsForUser result. With several users on a shared mailbox in cookie mode, the last request's creds win. Use IMAP_CREDENTIALS_STORAGE=db for shared mailboxes.
- RAC's context.account contains decrypted IMAP/SMTP/CalDAV passwords and the DeepL key (mapAccountRow plus applyCachedCredentials). Pass it through sanitizeAccountForClient before returning it; only the accounts root, settings and relogin routes do this today.
- Recompute and sync status routes return 404 instead of 403 when access is denied (recomputeJobs.ts:59-61), and jobs live in in-memory maps. calendar/sync uses a module-level syncInProgress Map (calendar/sync/route.ts:9).
- Topics import (POST …/topics/transfer) and recipient-alias import (POST …/recipient-aliases/transfer) are destructive replace-all operations (lib/topics/transfer.ts:358-362; lib/recipientAliases.ts:196). Treat them as manager actions.
- PUT …/folders replaces the whole local folders table with client data (lib/db/folders.ts:63-85) and has no UI caller (only GET usages of buildAccountFoldersPath were found). Gate it to manager or remove it.
- POST /api/accounts: any logged-in user can create a brand-new account. For an existing id, the session's active account must match (route.ts:27-31). It also inserts a user_accounts link (route.ts:39), which is master-DB grant logic that the new admin-grant feature must supersede.

## Q&A
### /api/accounts — GET, POST (app/api/accounts/route.ts)
GET (L8): reads getAccountsForUser(session.userId), i.e. user_accounts OR ownerUserId, and returns sanitizeAccountsForClient (passwords and DeepL key blanked; imap/smtp/caldav user and host and ownerUserId still sent). Guard: requireSessionOr401 only. Proposed: viewer (any authenticated user, filtered to granted accounts plus their role). POST (L15): creates or overwrites a full account including IMAP/SMTP/CalDAV/DeepL credentials (upsertAccount) and inserts a user_accounts link (addUserAccountLink). Writes MASTER DB. Guard: requireSessionOr401; for an existing account also requireSessionAccountOr403 (L29). Proposed: create = admin, or any user who then becomes manager of the new account; overwriting an existing account = manager.

### …/ (account root) — PUT, DELETE (app/api/accounts/[accountId]/route.ts)
PUT (L12): patchAccount can change any Account field: name/email/avatar, imap/smtp host/user/password, caldav credentials, DeepL key/enabled/lang, settings, and via mergeAccount's ...payload also ownerUserId/id. Writes MASTER DB. Returns sanitizeAccountForClient. Rejects a DeepL key unless DB storage is on (L20-25). DELETE (L33): deleteAccountControlPlane deletes the user_accounts, mcp_tokens and accounts rows in MASTER and also deletes the shard DB file and artifacts (lib/db/accounts.ts:122-149). Guard: RACFP. Proposed: manager for both (DELETE maybe owner/admin only).

### …/settings — PUT (settings/route.ts)
PUT (L11): patchAccount({settings}) shallow-merges AccountSettings: sync intervals, threading, layout, appearance, calendar.weekStartsOn, signatures, defaultSignatureId. Writes MASTER accounts.settings. Returns the sanitized account. Guard: RACFP. Proposed: manager for account-level keys (sync, threading, signatures). Move per-user UI keys to per-user preferences so viewers can change their own.

### …/relogin — POST (relogin/route.ts)
POST (L20): verifies the IMAP credentials, then patchAccount updates imap.user and imap.password (password stored only if shouldStorePasswordInDb). Writes MASTER. Re-issues the session cookie with the IMAP/SMTP pass when cookie storage is on (L64-73). Returns sanitizeAccountForClient. Guard: RACFP. Proposed: manager (it changes mailbox credentials; under app-level login it becomes 'update stored IMAP creds').

### …/mcp-tokens — GET, POST (mcp-tokens/route.ts)
GET (L19): listMcpTokens reads MASTER and returns every token on the account from all creators (metadata only, no hash). POST (L30): createMcpAccessToken plus insertMcpToken writes MASTER mcp_tokens. RETURNS A SECRET: `secret: rawToken` (L73), a bearer token that embeds sealed IMAP/SMTP creds when IMAP_CREDENTIALS_STORAGE includes cookie (lib/auth.ts:224-236). Guard: RAC. Proposed: manager (or editor limited to their own tokens, filtered by createdByUserId).

### …/mcp-tokens/[tokenId] — DELETE (mcp-tokens/[tokenId]/route.ts)
DELETE (L9): deleteMcpToken(accountId, tokenId) revokes any token on the account, whoever created it. Writes MASTER. Guard: RAC. Proposed: manager (or the token's creator).

### …/calendar/conflicts — GET (calendar/conflicts/route.ts)
GET (L17): read-only; lists unresolved CalDAV write-back conflicts with diffs. Guard: RAC. Proposed: viewer.

### …/calendar/conflicts/[eventId]/resolve — POST (calendar/conflicts/[eventId]/resolve/route.ts)
POST (L96): 'local' force-pushes the event's ICS to the CalDAV server (updateRemoteEvent); 'remote' adopts the server version. Both upsertCalendarEvent and deleteCalendarEventConflict. Writes SHARD and the remote CalDAV server. Guard: RAC (L108). Proposed: editor.

### …/calendar/events — GET, POST, DELETE (calendar/events/route.ts)
GET (L25): read list or event by uid. POST (L54): creates or upserts a local calendar event (snapshot from source email) via upsertCalendarEvent. DELETE (L140): deleteCalendarEventAndRelatedData (event, reminders, suppression). Writes SHARD. Guard: RAC. Proposed: GET viewer; POST and DELETE editor.

### …/calendar/events/[eventId] — GET, PUT, DELETE (calendar/events/[eventId]/route.ts)
GET (L34): read. PUT (L57): edits event fields, sets pendingRemoteSync (CalDAV write-back on next sync) and reschedules reminders. DELETE (L144): deletes the event and related data (?soft=true supported). Writes SHARD. Guard: RAC. Proposed: GET viewer; PUT and DELETE editor.

### …/calendar/events/[eventId]/respond — POST (calendar/events/[eventId]/respond/route.ts)
POST (L65): RSVP. Sends an SMTP reply with ICS as the account (sendSmtpMessage), IMAP-appends it to Sent, updates myPartstat or participation overrides, and marks the invite processed with processedByUserId=session.userId. Writes SHARD plus SMTP/IMAP. Guard: RAC (L81). Proposed: editor.

### …/calendar/events/participation — GET (calendar/events/participation/route.ts)
GET (L10): read-only (resolveCalendarParticipation). Guard: RAC. Proposed: viewer.

### …/calendar/invites/process — POST (calendar/invites/process/route.ts)
POST (L11): processCalendarInviteForMessage(process:true). Upserts calendar events from the ICS, creates reminders for session.userId, and marks invite states processed (processedByUserId). Writes SHARD. Guard: RAC (L22). Proposed: editor.

### …/calendar/sync — POST, GET (calendar/sync/route.ts)
POST (L11): syncCalendarEvents does a CalDAV pull and also pushes pending local edits (lib/caldav/sync.ts:204-260). Writes SHARD and remote CalDAV. Uses an in-memory syncInProgress map. GET (L34): in-memory status. Guard: RAC. Proposed: POST editor (it pushes edits); GET viewer.

### …/categories/debug — GET (categories/debug/route.ts)
GET (L9): read-only category-model debug snapshot. Guard: RAC. Proposed: viewer (or manager, since it is internal/debug data).

### …/categories/model/reset — POST (categories/model/reset/route.ts)
POST (L9): resetCategoryLinearModel wipes the learned categorization model. Writes SHARD category_model_state. Guard: RAC. Proposed: manager.

### …/categories/recompute — POST (categories/recompute/route.ts)
POST (L5): startCategoryRecomputeJob re-derives message categories in a background job. Writes SHARD messages. Guard: handleRecomputeStartRequest (app/api/_helpers/recomputeJobs.ts:15-37, RSA). Triggered from the FolderPane menu. Proposed: editor (manager if treated as maintenance).

### …/categories/recompute/status — GET (categories/recompute/status/route.ts)
GET (L5): in-memory job status. Guard: handleRecomputeStatusRequest (recomputeJobs.ts:39-67, RSA; returns 404 instead of 403). Proposed: viewer.

### …/compose/recipients — GET (compose/recipients/route.ts)
GET (L7): read-only recipient autocomplete. Guard: RSA (L14, L20). Proposed: viewer (only useful to editors).

### …/destination-folders — GET (destination-folders/route.ts)
GET (L12): read-only folder list for any account the user owns or is linked to (copy/move destination picker). Guard: ROAC (requireOwnedAccountContext). Proposed: editor on the target account, since it only feeds copy/move.

### …/drafts/save — POST (drafts/save/route.ts)
POST (L9): saveDraftForAccount IMAP-APPENDs the draft to Drafts (replacing the previous version) and writes local rows. Writes SHARD plus IMAP. Guard: RAC (L14). Proposed: editor.

### …/drafts/[draftId]/send — POST (drafts/[draftId]/send/route.ts)
POST (L25): sendDraftForAccount sends via SMTP (requires the \Draft flag, lib/drafts.ts:340), appends to Sent and removes the draft. Writes SHARD plus SMTP/IMAP. Guard: RAC (L32). Proposed: editor.

### …/drafts/[draftId]/discard — POST (drafts/[draftId]/discard/route.ts)
POST (L20): recordDraftTombstone, IMAP delete (best effort), deleteMessageById and file deletion. Writes SHARD plus IMAP. It does NOT verify the message is a draft, so it can hard-delete any message. Guard: RAC (L27). Proposed: editor, and add a \Draft/Drafts-folder check.

### …/folders — GET, PUT (folders/route.ts)
GET (L10): read folder list. PUT (L17): saveFoldersForAccount replaces the entire local folders table with the client payload (no IMAP). Writes SHARD. No UI caller found. Guard: RAC. Proposed: GET viewer; PUT manager (or remove the endpoint).

### …/folders/create — POST (folders/create/route.ts)
POST (L11): IMAP CREATE folder, relist, saveFoldersForAccount. Writes SHARD plus IMAP. Guard: RAC (L21). Proposed: manager, since folder structure is shared mailbox config (editor if teams want self-service).

### …/folders/[folderId]/rename — POST (folders/[folderId]/rename/route.ts)
POST (L15): IMAP RENAME, updateMessagesFolderPrefix, saveFoldersForAccount. Writes SHARD plus IMAP. Guard: RAC (L27). Proposed: manager.

### …/folders/[folderId]/delete — POST (folders/[folderId]/delete/route.ts)
POST (L26): if the folder is inside Trash: IMAP unsubscribe and DELETE, plus deleteMessagesByFolderPrefix. Otherwise renames the folder into Trash. Also notifyFolderDeleted and saveFoldersForAccount. Writes SHARD plus IMAP (destructive). Guard: RAC (L34). Proposed: manager.

### …/folders/[folderId]/consistency — POST (folders/[folderId]/consistency/route.ts)
POST (L139, handler L18): read-only comparison of local state with IMAP STATUS (needsRepair/recommendedMode). No writes. Guard: RAC (L22). Proposed: viewer.

### …/imap/poll — GET (imap/poll/route.ts)
GET (L28): read-only IMAP fetch of envelopes newer than the local highest UID. No DB writes. Guard: RAC (L34). Proposed: viewer.

### …/imap/stream — GET (imap/stream/route.ts)
GET (L43): SSE IMAP IDLE watcher. Reconciliation-only writes: saveMailboxState (L221, L298) and deleteMessageByFolderUid on server expunge (L329). Writes SHARD; no IMAP mutation. Guard: RAC (L47). Proposed: viewer.

### …/message-topics — GET, POST (message-topics/route.ts)
GET (L16): read topics per thread. POST (L37): set/add/remove topics on a thread (setThreadTopics/addThreadTopic/removeThreadTopic, which also feed topic learning). Writes SHARD thread_topics. Guard: RAC. Proposed: GET viewer; POST editor.

### …/message-topics/explain — GET (message-topics/explain/route.ts)
GET (L12): read-only topic-suggestion explanation for a thread. Guard: RAC (L15). Proposed: viewer.

### …/message-topics/suggest — GET (message-topics/suggest/route.ts)
GET (L12): read-only topic suggestions for a thread. Guard: RAC (L15). Proposed: viewer.

### …/messages — GET (messages/route.ts)
GET (L4): message list via handleListMessagesRequest (app/api/messages/listMessagesHandler.ts:13-60). With sortBy=size it backfills sizes (harmless SHARD write). Guard: RSA (listMessagesHandler.ts:23, 43). Proposed: viewer.

### …/search — GET (search/route.ts)
GET (L4): same handler as …/messages with defaultQuery ''. Read-only. Guard: RSA via listMessagesHandler. Proposed: viewer.

### …/messages/[messageId] — GET (messages/[messageId]/route.ts)
GET (L15): read one message plus thread topics and suggestions. Guard: RAC (L19). Proposed: viewer.

### …/messages/[messageId]/html — GET (messages/[messageId]/html/route.ts)
GET (L70): read sanitized HTML page. Guard: RSA (L71, L80). Proposed: viewer.

### …/messages/[messageId]/source — GET (messages/[messageId]/source/route.ts)
GET (L56, handler L12): read the raw RFC822 source. Guard: RSA (L19, L27). Proposed: viewer.

### …/messages/[messageId]/attachments/[attachmentId] — GET, DELETE (attachments/[attachmentId]/route.ts)
GET (L22): read the attachment; caches extracted bytes to storage (saveAttachmentData). Guard: RSA (L23, L34). DELETE (L121): removeMessageAttachmentEverywhere rewrites the message: IMAP APPEND of a stripped copy, then deletes the original (lib/mail/removeMessageAttachment.ts). Writes SHARD plus IMAP. Guard: RAMC with requireImapMetadata (L127). Proposed: GET viewer; DELETE editor.

### …/messages/[messageId]/calendar-diff — GET (messages/[messageId]/calendar-diff/route.ts)
GET (L27): read-only invite-update diff. Guard: RAC (L31). Proposed: viewer.

### …/messages/[messageId]/archive — POST (messages/[messageId]/archive/route.ts)
POST (L14): IMAP MOVE to Archive and relocate the local row and files (the message id changes). Writes SHARD plus IMAP. Guard: RIMMC (L18). Proposed: editor.

### …/messages/[messageId]/delete — POST (messages/[messageId]/delete/route.ts)
POST (L12): trashMessageInAccount (routeHelpers.ts:220-269) moves the message to Trash, or hard-deletes it (IMAP expunge plus local row and files) if it is already in Trash. Writes SHARD plus IMAP. Guard: RIMMC (L18). Proposed: editor.

### …/messages/[messageId]/flags — POST (messages/[messageId]/flags/route.ts)
POST (L10): applyFlagMutationsToMessage does an IMAP STORE of \Seen/\Answered/\Flagged/\Deleted/\Draft or a custom keyword (lib/messageFlagMutation.ts:10-16) and updates local flags. Writes SHARD plus IMAP. Guard: RIMMC (L28). Proposed: editor (\Seen is shared across users).

### …/messages/[messageId]/spam — POST (messages/[messageId]/spam/route.ts)
POST (L17): clears non-junk flags, IMAP-moves to Junk, updates local flags and row. Writes SHARD plus IMAP. Guard: RIMMC. Proposed: editor.

### …/messages/[messageId]/not-spam — POST (messages/[messageId]/not-spam/route.ts)
POST (L22): clears junk flags, sets the not-junk flag, IMAP-moves to Inbox, updates local flags and row. Writes SHARD plus IMAP. Guard: RIMMC (L26). Proposed: editor.

### …/messages/[messageId]/category — POST (messages/[messageId]/category/route.ts)
POST (L11): applyCategoryFeedback sets messages.category (newsletter/notification/transactional/null) and trains the shared category model (feedback events). Writes SHARD. Guard: RAMC (L23). Proposed: editor.

### …/messages/[messageId]/resync — POST (messages/[messageId]/resync/route.ts)
POST (L11): resyncImapMessageIntoDb re-fetches the message from IMAP and rewrites the local row (repair; no IMAP mutation). Writes SHARD. Guard: RAMC (L15). Proposed: viewer.

### …/messages/[messageId]/translate — POST (messages/[messageId]/translate/route.ts)
POST (L21): calls the DeepL API with the account's stored key (costs quota) and caches the result (putCachedTranslation, L95). Writes SHARD message_translations. Guard: RAMC (L26). Proposed: viewer (consider rate-limiting); never echoes the key.

### …/messages/[messageId]/unsubscribe — POST (messages/[messageId]/unsubscribe/route.ts)
POST (L127): RFC 8058 one-click: the server sends an HTTP POST to the sender's unsubscribe URL (an external side effect on behalf of the mailbox). Otherwise it returns a browser or mailto URL. No DB writes. Guard: RAMC (L131). Proposed: editor.

### …/messages/copy-to-account — POST (messages/copy-to-account/route.ts)
POST (L40): copies or moves messages or a whole thread to another account: IMAP APPEND into the destination and ingestion into the destination SHARD. In 'move' mode it then trashes the source (trashMessageInAccount). Writes both shards plus both IMAP servers. Guard: source RAC (L69), destination ROAC (L71, any linked account). Proposed: editor on the source AND editor on the destination.

### …/messages/delete/associations — POST (messages/delete/associations/route.ts)
POST (L26): read-only lookup of the calendar events and reminders linked to messages before delete (uses POST for the body). No writes. Guard: RAC (L32). Proposed: viewer (in practice called from the editor delete flow).

### …/messages/delete/bulk — POST (messages/delete/bulk/route.ts)
POST (L19): hard-deletes messages that are already in Trash: IMAP expunge (deleteImapMessages), deleteMessagesByIds, file cleanup. Rejects messages outside Trash. Writes SHARD plus IMAP. Guard: RAC (L32, re-exported from routeHelpers). Proposed: editor.

### …/messages/delete/linked-calendar — POST (messages/delete/linked-calendar/route.ts)
POST (L27): deletes reminders (scoped to session.userId) and calendar events (account-wide, deleteCalendarEventAndRelatedData). Writes SHARD. Guard: RAC (L33). Proposed: editor (the reminder part alone could be viewer).

### …/messages/flags/bulk — POST (messages/flags/bulk/route.ts)
POST (L18): bulk flag/keyword mutation (IMAP STORE plus local flags) via applyFlagMutationsToMessages. Writes SHARD plus IMAP. Guard: RAC (L44). Proposed: editor.

### …/messages/move — POST (messages/move/route.ts)
POST (L24): stageMessageMoves (local relocation) plus enqueueMessageMoveJobs (async IMAP MOVE). Thread moves expand via getThreadMessageIdsForMove. Writes SHARD plus IMAP. Guard: RAC (L42). Proposed: editor.

### …/recipient-aliases — GET, POST (recipient-aliases/route.ts)
GET (L13): read mailing-list aliases. POST (L22): createRecipientAlias. Writes SHARD recipient_aliases. Guard: RAC. Proposed: GET viewer; POST editor.

### …/recipient-aliases/[aliasId] — PUT, DELETE (recipient-aliases/[aliasId]/route.ts)
PUT (L17): updateRecipientAlias. DELETE (L60): deleteRecipientAlias. Writes SHARD. Guard: RAC. Proposed: editor.

### …/recipient-aliases/transfer — GET, POST (recipient-aliases/transfer/route.ts)
GET (L12): exports alias data. POST (L21): importRecipientAliasTransferData REPLACES all aliases (DELETE FROM recipient_aliases, lib/recipientAliases.ts:196). Writes SHARD. Guard: RAC. Proposed: GET viewer/editor; POST manager.

### …/related — GET (related/route.ts)
GET (L6): read-only related messages. Guard: RAC (L16). Proposed: viewer.

### …/reminders — GET, POST, DELETE (reminders/route.ts)
GET (L16), POST (L26) and DELETE (L96): list, upsert and delete calendar reminders, all scoped to (accountId, session.userId), so this is personal data. Writes SHARD calendar_reminders. Guard: RAC (L18, L45, L106). Proposed: viewer (own reminders only).

### …/sender-icon — GET (sender-icon/route.ts)
GET (L7): resolves a sender icon/favicon (may fetch and cache). No account mutation. Guard: RSA (L8, L20). Proposed: viewer.

### …/smtp/send — POST (smtp/send/route.ts)
POST (L30): sends mail via SMTP as the account, IMAP-appends to Sent (L171), and for invites upsertCalendarEvent (L182). Writes SHARD plus SMTP/IMAP. Guard: RAC (L55). Proposed: editor.

### …/sync — POST (sync/route.ts)
POST (L4): handleSyncStartRequest (app/api/_helpers/syncJobs.ts:10-51) starts an IMAP-to-local sync job (folderId, fullSync, mode, recategorizeFolder, backfillUids). Writes SHARD. The Drafts sync can delete tombstoned server drafts. Guard: RSA (syncJobs.ts:14, 24). Proposed: viewer for plain pulls; optionally require editor for recategorizeFolder/fullSync.

### …/sync/status — GET (sync/status/route.ts)
GET (L4): handleSyncStatusRequest returns in-memory job status. Guard: RSA (syncJobs.ts:73, 91). Proposed: viewer.

### …/sync/new-candidates — POST (sync/new-candidates/route.ts)
POST (L16): read-only plan of which folders have new mail (IMAP STATUS via planImapNewSyncFolders). No writes. Guard: RAC (L19). Proposed: viewer.

### …/thread/related — POST (thread/related/route.ts)
POST (L11): read-only thread message list (uses POST for the body). Guard: RAC (L26). Proposed: viewer.

### …/threads — GET (threads/route.ts)
GET (L12): read-only thread list with topics. Guard: RAC (L21). Proposed: viewer. This is the natural list on which to overlay assignee/status for collaboration.

### …/threads/recompute — POST (threads/recompute/route.ts)
POST (L5): startThreadRecomputeJob rebuilds the threads table in a background job. Writes SHARD. Guard: handleRecomputeStartRequest (recomputeJobs.ts:15-37, RSA). Proposed: editor (manager if treated as maintenance). Recomputing could re-key threads, so collaboration data keyed by threadId needs to survive it.

### …/threads/recompute/status — GET (threads/recompute/status/route.ts)
GET (L5): in-memory job status. Guard: handleRecomputeStatusRequest (RSA). Proposed: viewer.

### …/topics — GET, POST (topics/route.ts)
GET (L11): list topics. POST (L20): createTopic. Writes SHARD topics. Guard: RAC. Proposed: GET viewer; POST editor.

### …/topics/[topicId] — PUT, DELETE (topics/[topicId]/route.ts)
PUT (L15): updateTopic (name/color/shortName). DELETE (L49): deleteTopic, which also removes the topic's thread_topics rows (lib/topics/core.ts:160-165). Writes SHARD. Guard: RAC. Proposed: editor (DELETE arguably manager).

### …/topics/[topicId]/signals — DELETE (topics/[topicId]/signals/route.ts)
DELETE (L10): excludeTopicLearningSignal adds a signal exclusion. Writes SHARD topic_signal_exclusions. Guard: RAC (L14). Proposed: editor.

### …/topics/[topicId]/suggestions — GET (topics/[topicId]/suggestions/route.ts)
GET (L14): read-only thread suggestions for a topic. Guard: RAC (L18). Proposed: viewer.

### …/topics/stats — GET (topics/stats/route.ts)
GET (L9): read-only topic stats. Guard: RAC (L11). Proposed: viewer.

### …/topics/transfer — GET, POST (topics/transfer/route.ts)
GET (L9): exports topics. POST (L18): importTopicTransferData REPLACES all topics, thread_topics, learning signals and exclusions (lib/topics/transfer.ts:358-362). Writes SHARD (destructive). Guard: RAC. Proposed: GET viewer/editor; POST manager.

### …/translation/compose — POST (translation/compose/route.ts)
POST (L22): calls DeepL with the account's stored key to translate compose text. No DB write. Guard: RAC (L25). Proposed: editor (compose-only).

### …/translation/test — POST (translation/test/route.ts)
POST (L9): checks a DeepL key's usage, using either the key typed in the form or the account's saved key; it does not send the key back. No writes. Guard: RAC (L12). Proposed: manager (settings UI).

### Which routes write the MASTER DB vs the account SHARD DB?
MASTER (getDb, lib/db/connection.ts:176; tables accounts/users/user_accounts/invite_codes/mcp_tokens): POST /api/accounts (upsertAccount + addUserAccountLink); PUT …/ and PUT …/settings and POST …/relogin (patchAccount); DELETE …/ (deleteAccountControlPlane, which also deletes the shard file); POST …/mcp-tokens and DELETE …/mcp-tokens/[tokenId]. MCP requests also touch mcp_tokens.lastUsedAt (lib/auth.ts:320). Every other mutating route writes only the SHARD (getAccountDb/withAccountDb, connection.ts:219-250), and some also mutate IMAP/SMTP/CalDAV or call DeepL or an unsubscribe URL. Collaboration tables (assignment/status/comments/activity) belong in the shard (initAccountSchema, schema.ts:697+) with userId references to master users.id. The user_accounts.role column belongs in MASTER (schema.ts:613).

### Which routes return credentials or secrets to the client?
Only POST …/mcp-tokens returns a secret: the raw bearer token `secret: rawToken` (mcp-tokens/route.ts:73), once. When IMAP_CREDENTIALS_STORAGE is cookie or both (the default is both), it embeds the IMAP/SMTP user and password sealed with SESSION_SEAL_KEY (lib/auth.ts:224-236). GET /api/accounts, PUT …/, PUT …/settings and POST …/relogin return accounts through sanitizeAccountForClient / sanitizeAccountsForClient (lib/accountPresentation.ts:3-34). These blank imap/smtp/caldav passwords and the DeepL apiKey (exposing only deepl.hasApiKey), but still send imap/smtp/caldav usernames, hosts and ports, ownerUserId and the full settings including signatures. POST …/relogin also sets a session cookie that carries the IMAP/SMTP passwords in cookie mode; the cookie is httpOnly and sealed (lib/auth.ts:97-107, 188-206). No other route returns context.account, although it holds decrypted secrets server-side.



# AREA: mailclient-state-and-list

## Summary
MailClient.tsx (5966 lines) is one client component that owns nearly all UI state and passes it down to orchestrators. It holds the auth state (authState/currentUser, lines 615-617), the account list (accounts/activeAccountId, 338-340), layout widths (351-356), dark mode (345) and the per-thread topics map (360). Search and virtual-folder state live in useSearchState.ts. MailClient derives `effectiveSearchBadges`, the excluded folder ids and a `messagesKey` cache key from that state (918-1037), then feeds useMessageData.ts. useMessageData builds the request URL with the pure function buildMessageListQueryUrl (messageListQueryUrl.ts) and pages through results. The endpoint is chosen in this order: /related if a related search is active, else /threads if threads mode is on, else /search if there is a query, else /messages. All of these end up in lib/db/messages/query.ts (listMessages / listThreads / listRelatedMessages). In those functions, `badges` become SQL WHERE clauses through one private helper, applyBadgeFilters (query.ts:826-880). That helper has no user context today. After the DB query, the route handlers add per-thread topics to the rows in place with enrichMessagesWithThreadTopics (app/api/_helpers), which runs one batched `thread_topics` query keyed by threadId. On the client, MailClient re-derives a threadId→Topic[] map from `messages` (2010-2019) and passes it to the list views via listViewState.messageTopicsById. MessageListView picks a list layout: MessageCardList (card/compact, which renders memoized MessageRow), MessageTable or MessageThreadList. Each of them renders badges inline next to the subject. threadId is computed by lib/threading.ts and is usually the root (earliest-known ancestor) Message-ID header string. It is stable across ordinary syncs, but a full thread recompute can rewrite it (recomputeThreadIdsForAccount). Topic assignments are not moved to the new id when that happens. Each mail account has its own SQLite file (getAccountDb). The users, accounts and user_accounts tables live in the master DB (getDb). The session is tied to a single active account (session.accountId), and every /api/accounts/[accountId]/* route only allows that account.

## Key files
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/MailClient.tsx — Root client component: all UI state, derived query state, render tree [338-360 accounts/activeAccountId/darkMode/leftWidth/listWidth/dragging/messageTopicsById; 384-408 apiFetch; 615-620 authState/currentUser/isAdminUser/sessionTtl; 747-794 exclusion folder sets; 869-907 useSearchState wiring; 918-954 currentSearchExcludedFolderIds + messagesKey; 995-1037 selectedSearchBadges/effectiveSearchBadges/effectiveGroupBy/hasFilteredSearchCriteria; 1260-1318 supportsThreads + useMessageData; 1672-1700 useAccountController; 1892 currentAccount; 2010-2027 topics map derivation + getAssignedThreadTopics; 2081-2120 applyThreadTopicUpdates/persistThreadTopics; 2356 handleToggleTopic; 2622 includeDoneGroup for action-queue; 2895-2987 evaluateMessageInCurrentResults (client-side badge re-check/prune); 3494 otherAccounts; 3909-3915 theme init; 4082-4110 /api/auth/me refresh poll; 4826-4843 resizer drag; 5098-5143 auto-repair → recomputeThreads; 5147-5206 virtualFoldersForPane; 5210-5215 handleToggleDarkMode; 5217-5274 LoginOverlay branch; 5276-5966 render tree]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/useSearchState.ts — Search scope/fields/badges + virtual folder definition, activation and sidebar counts [18-37 DEFAULT_SEARCH_FIELDS/BADGES; 39-69 VirtualFolderDefinition + VIRTUAL_FOLDERS; 154-159 activeVirtualFolder memo; 161-184 clearSearch; 186-201 activateVirtualFolder; 203-248 virtual-folder count fetches; 250-263 auto-clear]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messageListQueryUrl.ts — Pure URL builder: endpoint precedence + query params [49-56 page sizes; 58-113 buildMessageListQueryUrl]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/useMessageData.ts — Message list fetch/paging/refresh state hook [101-115 reset on messagesKey; 159-176 buildQueryUrl; 179-283 paginated load; 285-354 refreshMailboxData; 365-367 markMessagesMutated]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/messages/listMessagesHandler.ts — Shared GET handler for /messages and /search: parses params, auth, listMessages, topic enrichment [13-77]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/[accountId]/threads/route.ts — GET threads list: listThreads + enrichMessagesWithThreadTopics(includeSuggestions) [7-56]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/[accountId]/messages/route.ts — GET /messages → handleListMessagesRequest (search/route.ts does the same with defaultQuery "") [1-7]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/messages/query.ts — SQL list/search/thread queries and badge filter translation [826-880 applyBadgeFilters; 882-899 excluded/visible filters; 978 getGroupCounts; 1224 getTotalCount; 1418 listRelatedMessages; 1851 listMessages; 2154-2678 listThreads (2215-2271 WHERE build incl. thread:/topic: filters, 2401 threadFilterSql, 2586-2647 Message row mapping)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/_helpers/enrichMessagesWithThreadTopics.ts — Server-side per-thread enrichment template (batched by threadId, DI seams for tests) [1-56]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/topics/core.ts — thread_topics read/write (per-account DB) [185-209 getTopicsForThreads; 211-290 setThreadTopics/add/remove]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/threading.ts — Thread id/parent resolution algorithm [49-174 resolveThreadingForItems (137-168 threadId resolution)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/threads.ts — Thread table + threadId recompute; where collab-state remap would hook [156-180 pruneThreadTopicsWithoutMessages; 279-356 recomputeThreadsForAccountInternal (rebuilds threads table); 358-383 recomputeThreadsForAccount; 399-449 recomputeThreadIdsForAccount (rewrites messages.threadId); 451-495 getThreadIdsByMessageIds; 530-552 resolveThreadingForAccountMessages]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/workers/recomputeThreads.ts — Worker: full threadId recompute then threads table rebuild (spawned via lib/threadRecomputeJobs.ts and /threads/recompute route) [1-20]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/messageIds.ts — Row id = imap-<sha1(lowercased Message-ID)> (stable across folders/moves) [26-40 buildImapMessageRowId]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/connection.ts — Master DB vs per-account DB split [176-197 getDb (master); 219-248 getAccountDb (per-account file + runtime schema ensures)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/schema.ts — Schema; place for new collaboration tables [584-617 master accounts/users/user_accounts; 697+ initAccountSchema; 800-809 threads; 858-863 thread_topics; 244-266 ensureThread/TopicRuntimeSchema]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/MessageRow.tsx — Card/compact row renderer with badges [1-75 props; 465-535 subjectMeta badges; 544-588 memo areEqual]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/MessageCardList.tsx — Card/compact list → MessageRow [223 topic row color; 254 thread badge union; 280-440 <MessageRow> props (436 messageTopics)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/MessageThreadList.tsx — Threads view rows [226 thread badge union; 257 topic color; 314-438 row cells; 361-438 subject badges (436-438 topics)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/MessageTable.tsx — Table view rows [333 topic color; 516-520 subject cell (folder badges + subject + TopicBadge)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/MessageListView.tsx — View-mode switch (table/threads/card|compact) [6-29]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/messageListViewTypes.ts — Props contract for list views (where threadCollabById would be added) [18-36 view modes/isThreadsScopeAvailable; 38-65 MessageListViewState; 71-125 actions/helpers]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/threadBadgeUnion.ts — Aggregates badges across collapsed thread [23-57]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/MessageViewOrchestrator.tsx — Thread view header: home for assignee/status/comments UI [140-152 header props; 655-724 thread header (subject, view toggle, TopicBadge row, ThreadTopicSuggestionsRow)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/folder/FolderSidebarPane.tsx — Left sidebar (virtual folders, topics, folder tree) [11-79 props; 89-183 component]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/folder/FolderPane.tsx — Virtual folder list rendering [57 aside.pane width; 60-92 virtual folder rows (69 onClick activateVirtualFolder)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/TopBar.tsx — Top bar (search, account switcher, theme toggle, logout) [~60-120 TopBarProps; 204 header]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/globals.css — Global layout CSS [1-55 :root/.dark vars; 60-75 html/body; 105-108 main; 118-140 Radix overrides under .app-shell; 142-155 .app-shell; 422-434 notice media; 436-459 .content-grid/.pane; 750-763 @media(max-width:900px); 1415-1431 .resizer]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/useAccountController.ts — Initial load (/api/auth/me, /api/accounts, folders) and account switching [31 AuthMeResponse; 130-215 loadInitialData; 217-281 switchAccount; 283+ saveAccount]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/auth/me/route.ts — Current user + accessible accounts + session rotation [11-40]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/auth/switch-account/route.ts — Re-seal session for another accessible account [5-48]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/auth.ts — Session + per-account authorization [30-42 SessionData/McpSessionData; 118 requireSessionOr401; 155-169 requireAccountAccessOr403/requireSessionAccountOr403; 289-329 requireMcpAccountContext]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/_helpers/accountContext.ts — Route helpers returning {session, accountId, account} [38-57 requireAccountContext; 67-85 requireOwnedAccountContext]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/accounts.ts — Account visibility = user_accounts link OR ownerUserId [32-43 getAccountsForUser]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/data.ts — Shared types [33-56 Account (38 ownerUserId); 110-164 Message (162-163 topics/topicSuggestions); 413-418 User]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/mcpServer.ts — MCP tools reuse listMessages/listThreads + enrichment [147-148 badges schema; 600-630 list tool → listMessages + enrich; 681-751 other enrich call sites]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/ui/searchFilters.ts — User-toggleable badge list (TopBar filter menu) [9-20 SEARCH_BADGE_OPTIONS]

## Extension points
- app/components/mailclient/useSearchState.ts:39-69 VirtualFolderDefinition.id union + VIRTUAL_FOLDERS: add {id:'virtual:assigned-to-me', queryBadges:['assigned-to-me']}, {id:'virtual:unassigned', queryBadges:['unassigned']}, {id:'virtual:open', queryBadges:['open']}
- app/components/mailclient/useSearchState.ts:135-138,203-248 add count state + fetchCount calls for new virtual folders (and fix the param name: send 'excludeFolderIds', not 'currentSearchExcludedFolderIds')
- app/components/MailClient.tsx:5147-5206 virtualFoldersForPane: extend the per-id ternaries for count/countLabel/countAriaLabel/emphasize/icon
- app/components/MailClient.tsx:918-924 activeVirtualExcludedFolderIds: choose which folders the new virtual folders exclude
- app/components/MailClient.tsx:2925-2969 evaluateMessageInCurrentResults: add client-side checks for 'assigned-to-me'/'unassigned'/'open' so assign/status mutations remove rows from the current results (needs Message.collab + currentUser.id)
- app/components/MailClient.tsx:2010-2019 + 2081-2106: mirror messageTopicsById/applyThreadTopicUpdates with a threadCollabById map + applyThreadCollabUpdates (patch messages, viewMessage, thread cache)
- app/components/MailClient.tsx:5440-5465 listViewState: pass threadCollabById (and the users map for avatars) to MessageListOrchestrator
- app/components/mailclient/messagelist/messageListViewTypes.ts:38-65 MessageListViewState: add threadCollabById
- app/components/mailclient/messagelist/MessageRow.tsx:465-535 subjectMeta (after TopicBadge) for the assignee avatar and status chip; add the new prop to the render condition at 465-471 and to areEqual at 544-588
- app/components/mailclient/messagelist/MessageCardList.tsx:436 pass collab={threadCollabById.get(message.threadId)} next to messageTopics
- app/components/mailclient/messagelist/MessageThreadList.tsx:436-438 render the chip after the topic badges in cellSubject
- app/components/mailclient/messagelist/MessageTable.tsx:516-520 render the chip in the subject cell (or add a new column)
- app/components/mailclient/message/MessageViewOrchestrator.tsx:655-724 thread header: assignee picker, status select, comments/activity panel trigger (add getThreadCollab/onChange* to header props 140-152)
- app/api/_helpers/enrichMessagesWithThreadTopics.ts: add a sibling enrichMessagesWithThreadCollaboration(items,{accountId, load...}) or generalize it; call it at listMessagesHandler.ts:68, threads/route.ts:133, related/route.ts:40, thread/related/route.ts, messages/[messageId]/route.ts:34, lib/mcpServer.ts:626/687/721/751
- lib/db/messages/query.ts:826-880 applyBadgeFilters: add a viewerUserId param (or a context object) and SQL EXISTS clauses on the collab table keyed by m.threadId; update the 5 call sites (1077 getGroupCounts, 1321 getTotalCount, 1556 listRelatedMessages, 1961 listMessages, 2266 listThreads) and the params of listMessages(1851)/listThreads(2154)
- app/api/messages/listMessagesHandler.ts:23-67 pass session.userId to listMessages; threads/route.ts:105-132 pass context.session.userId; lib/mcpServer.ts list tools pass context.session.userId
- lib/db/schema.ts initAccountSchema (697+) / a new ensureCollabRuntimeSchema called from lib/db/connection.ts:229-233: create thread_collab (threadId PK, accountId, assigneeUserId, status, updatedAt...), thread_comments, thread_activity in the per-account DB next to thread_topics
- lib/db/threads.ts:399-449 recomputeThreadIdsForAccount: remap collab rows old→new threadId using the computed `updates` (and fix thread_topics the same way)
- lib/db/threads.ts:156-180 + lib/db/messages/upsert.ts:629/642/659: decide orphan policy for collab rows (do not delete comments/activity the way thread_topics are pruned)
- lib/db/schema.ts:613-617 user_accounts: add role column (viewer/editor/manager); lib/db/accounts.ts:32-43 and lib/db/users.ts:38-52 queries; lib/auth.ts:159-169 requireSessionAccountOr403 for role checks
- app/api/auth/me/route.ts:17-20 (403 when session has no accountId) and useAccountController.ts:138-155: the decoupled app login must allow a session without an active account
- app/components/MailClient.tsx:5276-5348 render tree root (div.app-shell/section.content-grid) is the seam for the new shadcn/Tailwind shell; TopBar (5279-5322) and FolderSidebarPane (5349-5389) are the swap-in points

## Gotchas
- Virtual-folder count requests (useSearchState.ts:208-216) send the excluded folders as `currentSearchExcludedFolderIds`, but the server only reads `excludeFolderIds` (listMessagesHandler.ts:31, threads/route.ts:114). So sidebar counts silently include Trash/Junk/Spam/Sent. Fix this, or copy it knowingly, when you add new counts.
- activeVirtualFolder is only non-null when searchScope==='all', the query is empty and no related search is active (useSearchState.ts:154-159). An effect clears it as soon as any user badge is toggled (250-263). Virtual folders and manual badges never combine; effectiveSearchBadges is either the folder's queryBadges or the user's badges (MailClient.tsx:1002-1005).
- applyBadgeFilters(where,args,badges) (query.ts:826) has no user or account context. 'assigned-to-me' needs a userId passed through listMessages, listThreads, getTotalCount, getGroupCounts and listRelatedMessages (5 call sites). The MCP context and the REST session both carry session.userId.
- There are two DBs. users/accounts/user_accounts live in the master DB (getDb); messages/threads/thread_topics live in a per-account SQLite file (getAccountDb, connection.ts:219). Put collab tables in the per-account DB so that `EXISTS (... WHERE tc.threadId = m.threadId)` works without ATTACH. Assignee emails/names then need a separate master-DB lookup (e.g. getUsers).
- threadId is NOT guaranteed stable. Sync (syncOperation.ts:640-660) only threads the incoming batch against existing rows and never rewrites older messages. A full recompute (recomputeThreadIdsForAccount, threads.ts:399-449) rewrites messages.threadId. It runs on the manual 'Recompute threads' action, via /api/accounts/[id]/threads/recompute, and automatically from the MailClient auto-repair effect when a folder shows 0 rows but the DB has some (MailClient.tsx:5098-5123). thread_topics is never remapped. Upsert paths delete thread_topics rows whose threadId no longer has messages (pruneThreadTopicsWithoutMessages, called from upsert.ts:629/642/659), including full-folder replace resyncs. Collab state needs explicit remap/orphan handling.
- The `threads` table is fully DELETEd and re-INSERTed on recompute (threads.ts:290-355). Never store assignee/status as columns there. threads.rootMessageId is the internal row id (m.id), not the Message-ID header.
- Message row ids are `imap-<sha1(lowercased Message-ID)>` (messageIds.ts:26-40). They are stable across moves and folders, but copies of the same message in several folders get collision variants `<id>-<12hex>`. Do not key collab state by row id.
- /messages `total` counts messages, not threads. /threads also returns `total` as a message count (getTotalCount); the thread total is computed internally but not returned. Thread-level 'Open'/'Unassigned' counts need their own count query or a new response field.
- The /threads route ignores `sortBy`, and its badge filter works per thread: a thread is included if any of its messages matches (threadFilterSql query.ts:2401), and then all messages of that thread are returned (excluded folders still filtered). That fits thread-level collaboration filters naturally. In non-thread /messages mode the filter works per message.
- Any non-empty `badges` list disables 'flagged threads first' ordering and the unfiltered fast path in listThreads (query.ts:2276-2297). New badges get this behaviour automatically.
- evaluateMessageInCurrentResults (MailClient.tsx:2925-2969) keeps a message when it sees an unknown badge. Without explicit cases, rows won't disappear from 'Open' after being marked done until the next refresh.
- MessageRow is memo'd with a hand-written areEqual (MessageRow.tsx:544-588). New props (collab, assignee) must be added there or rows won't re-render. Also, the subjectMeta block only renders when showFolderBadgesInSubjectMeta/showThreadIndicator/attachments/calendar/categoryIcon is truthy (465-471); MessageCardList always passes showFolderBadgesInSubjectMeta=true.
- messagesKey (MailClient.tsx:933-953) includes activeVirtualFolder.id. Switching between virtual folders resets list state (useMessageData.ts:101-115), so a new virtual folder needs no extra cache key.
- VirtualFolderDefinition.id is a string-literal union (useSearchState.ts:40), and virtualFoldersForPane (MailClient.tsx:5147-5206) hard-codes per-id ternaries. Both must be extended. isThreadsScopeAvailable treats any active virtual folder as scoped (messageListViewTypes.ts:30-36), so threads mode 'scope' turns threads on for them. useSyncController skips some folder-scoped sync work while a virtual folder is active (useSyncController.ts:491,762).
- Sessions are scoped to one account. requireSessionAccountOr403 (auth.ts:159-169) only allows session.accountId, so every /api/accounts/[accountId]/* call needs a prior POST /api/auth/switch-account. /api/auth/me returns 403 when the session has no accountId (me/route.ts:17-20), and loadInitialData treats any non-OK response as 'unauth' (useAccountController.ts:138-145). Both must change for app-level login without an account.
- currentUser is only used to compute isAdminUser for AccountSettingsModal (MailClient.tsx:617, 5657). TopBar does not receive currentUser. Account.ownerUserId reaches the client (sanitizeAccountForClient keeps it), but no client code reads it; it is only declared in the AdminTabContent.tsx:50-55 type.
- Dark mode is a `.dark` class on <html> plus localStorage 'noctua:theme' (MailClient.tsx:3909-3915, 5210-5215). CSS variables switch in globals.css:1-55. This is compatible with a Tailwind v4 class-based dark variant. Radix <Theme> wraps everything in app/layout.tsx. body has overflow:hidden and .app-shell is a 100vh grid. The only responsive rule is @media(max-width:900px), which stacks panes vertically and hides resizers; there is no single-pane mobile navigation.
- Test conventions (AGENTS.md): don't mock.module('@/lib/db'); mock wrappers such as '@/lib/serverDb'. enrichMessagesWithThreadTopics shows the DI seam pattern (loadTopicsForThreads/loadTopicSuggestionsForThreads options) used by its tests. AGENTS.md also says to keep UI state in MailClient.tsx unless it belongs in lib/.

## Q&A
### 1. How is a 'virtual folder' defined and resolved into a server query, which query/filter parameters does the server support, and what would adding 'assigned-to-me', 'unassigned' and 'open' require?
Definition: useSearchState.ts:39-69. Type `VirtualFolderDefinition {id: 'virtual:focused'|'virtual:action-queue'|'virtual:invite-deck', name, description, badgeLabel, queryBadges}`. The three current folders map to queryBadges ['focused'], ['attention'] and ['calendar'].

Resolution path:
(1) FolderPane.tsx:69 onClick → activateVirtualFolder(id) (useSearchState.ts:186-201). It stores lastFolderId, sets activeVirtualFolderId, query='', default fields, searchScope='all', activeFolderId='' and default badges.
(2) The activeVirtualFolder memo (154-159) is non-null only when scope is 'all', there is no query and no related search.
(3) MailClient derives the rest:
- effectiveSearchBadges = activeVirtualFolder.queryBadges (1002-1005).
- currentSearchExcludedFolderIds (918-928): Focused excludes trash/junk/spam/sent/archive (774-790); other virtual folders exclude trash/junk/spam/sent (759-772).
- effectiveGroupBy: Invite Deck switches 'date' to INVITE_DECK_GROUP_BY (1007-1017).
- messagesKey includes the virtual folder id (933-953).
- includeDoneGroup is set for action-queue (2622).
(4) useMessageData (1293-1318) → buildMessageListQueryUrl (messageListQueryUrl.ts:58-113).

Endpoint precedence: relatedSearch → /related?relatedId; else supportsThreads → /threads (+threadDateSource, +q if present); else q → /search?q; else /messages.

Client params: page; pageSize (200 for invite deck, 600 for scope all, 300 for folder); groupBy; threadDateSource (threads only); sortBy (only if not 'date'); fields (only with a query); attachments=1; badges (comma list); folderId (scope 'folder'); excludeFolderIds (scope 'all'); q; relatedId.

Server params:
- listMessagesHandler.ts:17-39 (/messages and /search): q, folderId, fields, badges, excludeFolderIds, attachments=1, page, pageSize (1..1000, default 200), groupBy (default 'date'), sortBy.
- threads/route.ts:97-118: q, page, pageSize (default 300), groupBy, threadDateSource, fields, folderId, badges, excludeFolderIds, attachments. No sortBy.
- Both call lib/db/messages/query.ts listMessages(1851) / listThreads(2154), which call applyBadgeFilters (826-880). Supported badges: unread, unanswered, flagged, todo, done, ai-modified, attention (flagged OR todo OR done), calendar, newsletter, focused (unread AND unanswered AND category<>newsletter), notification, transactional. 'attachments' is handled separately via attachmentsOnly ?? badges.includes('attachments').
- The query string also has a mini-language parsed by parseSearchInput (583): from:, to:, with:, in:, thread:<threadId>, topic:<id>, a no-topic sentinel, and invite-UID terms (see the threadTerms/topicTerms handling at 2221-2234).

Sidebar counts: useSearchState.ts:203-248 calls /messages with page=1, pageSize=1, groupBy=date, searchScope=all, badges=focused|todo|calendar|calendar,unread and reads `total` (a message count). It is re-run on syncCompletionVersion.

To add 'assigned-to-me', 'unassigned' and 'open':

Client:
- Extend the id union and VIRTUAL_FOLDERS with queryBadges ['assigned-to-me'] / ['unassigned'] / ['open'].
- Add count state and fetches in useSearchState, and fix the param name to excludeFolderIds.
- Extend virtualFoldersForPane (MailClient.tsx:5147-5206) with counts, labels and icons.
- Pick an exclusion set (918-924).
- Add badge cases to evaluateMessageInCurrentResults (2925-2969), using message.collab and currentUser.id, so assign/status changes remove rows from the list.
- Optionally group by status.

Server:
- Give applyBadgeFilters a viewer context, e.g. applyBadgeFilters(where, args, badges, {viewerUserId}).
- Thread it through the listMessages/listThreads/getTotalCount/getGroupCounts/listRelatedMessages params (call sites 1077, 1321, 1556, 1961, 2266).
- Pass session.userId from listMessagesHandler (session at line 23), threads/route.ts (context.session.userId) and the MCP list tools (context.session.userId).
- SQL sketch, with the collab table in the per-account DB:
  - assigned-to-me: `AND EXISTS (SELECT 1 FROM thread_collab tc WHERE tc.threadId = m.threadId AND tc.assigneeUserId = ?)`
  - unassigned: `AND NOT EXISTS (SELECT 1 FROM thread_collab tc WHERE tc.threadId = m.threadId AND tc.assigneeUserId IS NOT NULL)`
  - open: `AND COALESCE((SELECT tc.status FROM thread_collab tc WHERE tc.threadId = m.threadId),'open') <> 'done'`, or IN ('open','pending','in_progress') depending on product semantics.
- New badges automatically disable the flagged-first ordering and the unfiltered fast path in listThreads. The MCP `badges` arg (mcpServer.ts:147) would expose them for free once userId is passed.

### 2. How do Message objects get enriched with per-thread data (topics) between DB and client, and where would assignee/status for a thread be attached most cheaply?
Server: after listMessages/listThreads returns `items: Message[]` (rows mapped in query.ts:2586-2647; no topic data comes from SQL), the route calls `enrichMessagesWithThreadTopics(items, {accountId, accountEmail?, includeSuggestions?})` (app/api/_helpers/enrichMessagesWithThreadTopics.ts:23-56).
- It collects the unique trimmed threadIds and calls getTopicsForThreads(accountId, threadIds). That is one SELECT on topics JOIN thread_topics WHERE threadId IN (...) in the per-account DB (lib/topics/core.ts:185-209).
- It mutates each item in place: `item.topics = map.get(threadId) ?? []`. The threads route also fills `item.topicSuggestions` for threads that have no topics.
- Loaders are injectable (loadTopicsForThreads/loadTopicSuggestionsForThreads) for tests.
- Call sites: listMessagesHandler.ts:68 (/messages, /search), threads/route.ts:133-137, related/route.ts:40, thread/related/route.ts, and lib/mcpServer.ts:626/687/721/751. The single-message route uses getTopicsForThread (messages/[messageId]/route.ts:34).

Client:
- Message.topics / topicSuggestions (lib/data.ts:162-163) arrive with each row.
- MailClient.tsx:2010-2019 rebuilds `messageTopicsById: Map<threadId, Topic[]>` from `messages` on every change.
- getAssignedThreadTopics (2021-2027) serves the thread view header.
- Mutations go through persistThreadTopics → applyThreadTopicUpdates (2081-2120), which patches messages, viewMessage and the thread content cache.
- The map reaches the list views via listViewState.messageTopicsById (5452).

Cheapest attachment point: a sibling helper `enrichMessagesWithThreadCollaboration(items, {accountId, loadCollabForThreads?})`, or generalize the existing one into a thread-data enricher, called at exactly the same call sites.
- One batched `SELECT threadId, assigneeUserId, status, updatedAt, (comment count) FROM thread_collab WHERE threadId IN (...)` against getAccountDb(accountId).
- Set `item.collab = {assigneeUserId, status, commentCount, updatedAt}`; add this optional field to Message in lib/data.ts.
- Resolve assignee display data from the master `users` table (getUsers), either once per response or via a client-side cached users list for the account.
- On the client, mirror the topics pattern: derive threadCollabById from messages, add an applyThreadCollabUpdates that patches messages, viewMessage and the thread cache, and pass the map through listViewState.
- Because the list response already carries per-thread data, no extra round-trip is needed.

### 3. How do MessageRow, MessageThreadList, MessageCardList and MessageTable render per-row badges, and where would an assignee avatar and status chip go?
MessageListView.tsx:13-28 picks the layout: 'table' → MessageTable, 'threads' → MessageThreadList, otherwise MessageCardList (card/compact), which renders MessageRow for each row (MessageCardList.tsx:280-440). For collapsed thread roots, getCollapsedThreadBadgeUnion (threadBadgeUnion.ts:23-57) ORs flags, categories, attachments and calendar across the thread. It is computed in MessageCardList.tsx:254 and MessageThreadList.tsx:226.

- MessageRow.tsx:465-535 renders a `styles.subjectMeta` div after the subject line, in this order: folderBadges, thread size badge (GitBranch), attachment badge, calendar badge, CategoryBadge (thread union or message.category), TopicBadge for each messageTopics entry, FlagBadge (clickable), MessageBadge todo/done (clickable), ai-modified. The props are threadHas*/threadCategories/messageTopics (MessageCardList.tsx:428-436 passes messageTopics={messageTopicsById.get(message.threadId)}). The row is memo'd with areEqual (544-588).
- MessageThreadList.tsx:314-438: thread size badge, then cellFrom (SenderIcon + from text), then cellSubject (unread dot, subject, folder badges, attachments, calendar, categories, flag, todo, done, ai-modified, TopicBadge at 436-438), then cellSize.
- MessageTable.tsx:516-520: the subject cell has only folder badges, subject text and TopicBadge. Flags and categories are not shown in that cell. topicColorRows tints rows by the first topic color (333).
- Thread view: MessageViewOrchestrator.tsx:655-724 header shows the root subject, the Compact/Full SegmentedControl, a TopicBadge row and ThreadTopicSuggestionsRow.

Placement:
- Add `threadCollabById` to MessageListViewState (messageListViewTypes.ts:38-65) next to messageTopicsById.
- MessageRow: add a `collab` prop and render the avatar and status chip in subjectMeta right after the TopicBadges, or in a right-aligned slot near the date/quick actions. Add it to the render condition (465-471) and to areEqual.
- MessageThreadList: after the TopicBadge map at 436-438.
- MessageTable: after the TopicBadge map at 518-520, or as a dedicated narrow column.
- Thread view header (MessageViewOrchestrator.tsx ~695-720): assignee picker, status select and a comments/activity entry point.
- Key everything by message.threadId so a collapsed thread root shows it once.

### 4. What is the threadId for a message, is it stable across syncs and recomputes, and should collaboration state be keyed by threadId or by root messageId (Message-ID header)?
threadId is computed by resolveThreadingForItems (lib/threading.ts:137-168):
1. Walk the local parent chain (In-Reply-To, then References from last to first, among the items being resolved) up to the root's thread.
2. Otherwise use a known thread id: for each Reference in order, then In-Reply-To, look it up in externalThreadIds (DB lookup by Message-ID or threadId, getThreadIdsByMessageIds threads.ts:451-495, oldest copy wins) or among other items' threadIds.
3. Otherwise fall back to In-Reply-To ?? last Reference ?? own Message-ID ?? the existing threadId ?? the row id.
In practice it is the raw, trimmed Message-ID header of the earliest-known ancestor. That can be a message that is not in the DB.

Stability:
- Ordinary sync (syncOperation.ts:640-660), resync (resyncMessage.ts:51), drafts and cross-account copy only resolve the new or changed messages against the DB. Existing rows are never rewritten. So threadIds are stable across normal syncs, but out-of-order arrival can split a conversation. Example: C replying to B arrives before B, so C gets threadId=<B>, while B later gets <A>.
- A full recompute (lib/workers/recomputeThreads.ts → recomputeThreadIdsForAccount threads.ts:399-449 → recomputeThreadsForAccount) re-resolves every message and UPDATEs messages.threadId and parentId. That merges such splits and changes the ids. It is triggered by the manual 'Recompute threads' action (FolderPane menu → useSyncController.recomputeThreads:862 → /api/accounts/[id]/threads/recompute → worker), and automatically by MailClient's empty-folder auto-repair (5098-5123).
- The `threads` table is deleted and rebuilt (279-356); its rootMessageId is the internal row id, not the header.
- thread_topics (PK threadId+topicId, schema.ts:858-863) is never remapped when threadIds change. Rows for vanished threadIds are deleted by pruneThreadTopicsWithoutMessages (threads.ts:156-180) in upsert paths (upsert.ts:629/642/659). So topics can already be lost on recompute.
- Row ids (`imap-<sha1(lowercased Message-ID)>`, messageIds.ts:26-40) are stable across moves but have per-folder collision variants.

Recommendation: key collaboration state by threadId, consistent with thread_topics, the `thread:` search filter, enrichment, EXISTS joins on m.threadId and the existing MCP/REST thread addressing.
- Keying by the 'root Message-ID header' gains little: threadId already is that header, and it changes exactly when the known root changes.
- Make it safe instead:
  (a) In recomputeThreadIdsForAccount, build the old→new threadId map from `updates` and migrate collab rows in the same transaction. When two threads merge into one, define a merge policy (keep the non-done or most recently updated assignment, concatenate comments/activity, log a 'merged' activity). Do the same for thread_topics.
  (b) Do not hard-delete collab rows via a prune like pruneThreadTopicsWithoutMessages; soft-orphan them instead.
  (c) Optionally store an anchor (the root Message-ID header / first message row id) in the collab row so it can be re-attached after a recompute.
- State is per account DB, so the same conversation in two mailboxes has independent collab state.

### 5. Which props and state would a new shell (sidebar/header/layout) need from MailClient? List the exact props passed today to TopBar and FolderSidebarPane and the layout CSS classes used (.app-shell, resizer, panes) in globals.css.
Render tree (MailClient.tsx:5276-5963):
- AccountDateFormatProvider > div.app-shell containing:
  - TopBar (5279-5322)
  - InAppNoticeStack (style right=noticePaneRightOffset)
  - DialogsHost (confirm, buildRefresh, topicPicker)
  - section.content-grid ref=containerRef containing:
    - FolderSidebarPane (5349-5389)
    - div.resizer onPointerDown → setDragging('left')
    - MessageListOrchestrator (5399-5548; MessageListPane = aside styles.pane, width listWidth)
    - div.resizer → setDragging('list')
    - MessageViewOrchestrator (5558-5629; MessageViewPane = section styles.pane)
    - an optional calendar sidebar (inline width calendarSidebarWidth=400)
  - AccountSettingsModal, AccountReloginDialog, RecipientAliasDialog, ComposeOrchestrator, ThreadJsonModal, MoveToDialog, CopyToAccountDialog, BulkActionContextMenu
  - BottomStatusBar (the third grid row)

TopBar props, exact:
- buildVersionLabel
- state: {query, searchScope, includeSentInEverywhere, sentFolderName: sentFolderBySpecialUse?.name ?? null, searchFields, searchBadges, darkMode, isRelatedSearch, accounts, currentAccount: currentAccount ?? null, draftsFolder, draftsCount, activeFolderId, lastFolderId, accountFolders, isSyncing}
- ui: {searchFieldsLabel, searchBadgesLabel}
- actions: {setQuery, setSearchScope, setIncludeSentInEverywhere, setSearchFields, setSearchBadges, clearSearch, toggleDarkMode: handleToggleDarkMode, openCompose, setActiveFolderId, setLastFolderId, startEditAccount, deleteAccount, switchAccount: id => void switchAccount(id), syncAccount, logout: POST /api/auth/logout then setAuthState('unauth')}
- currentUser and isAdminUser are not passed.

FolderSidebarPane props, exact:
- leftWidth, accountFolderCount: accountFolders.length, virtualFolders: virtualFoldersForPane
- isRecomputingThreads, isRecomputingCategories, activateVirtualFolder, syncAccount, recomputeThreads, recomputeCategories
- allTopics, topicMessageCountById, activeTopicId, onTopicClick (inline: toggles query `topic:<id>` and sets scope 'all')
- rootFolders, folderTree, folderById
- searchScope, activeFolderId, setActiveFolderId, setSearchScope, clearSearch
- syncingFolders, deletingFolderIds, draggingMessageIds, dragOverFolderId, setDragOverFolderId
- handleMoveMessages, handleCreateSubfolder, handleRenameFolderItem, handleDeleteFolderItem, folderSpecialIcon
- Local state inside it: folderQuery, collapsedFolders, topicSidebarCollapsed.
- virtualFolders items have the shape {id, name, description, active, count, countLabel, countAriaLabel, countTitle, rowTitle, emphasize, icon}.

Layout state in MailClient:
- darkMode (345); leftWidth=270, listWidth=840, dragging, calendarSidebarWidth=400, containerRef (351-356)
- listIsNarrow = listWidth < 360 (683)
- pointer-drag effect (4826-4843): left minimum 140, list minimum 200, list width = x - leftWidth - 6
- noticePaneRightOffset is recomputed from a ResizeObserver on listPaneRef (~4680-4704)
- theme init from localStorage 'noctua:theme' (3909-3915); handleToggleDarkMode toggles the `dark` class on <html> (5210-5215)
- the MessageListOrchestrator header also uses activeFolderName, activeVirtualFolder?.name, loadedMessageCount/totalMessages, groupBy, messageSort, threadsMode etc. (5404-5433)

globals.css:
- :root light vars (1-30) and .dark vars (32-55)
- html/body height 100%; body overflow hidden with a gradient background (60-75); main height 100vh (105-108)
- Radix surface-button overrides scoped to .app-shell (118-140)
- .app-shell (142-155): display grid, grid-template-rows auto 1fr auto, height 100vh, overflow hidden, border, floatIn animation
- .content-grid (436-441): flex, min-height 0, height 100%, overflow hidden
- .pane (443-459): padding 18px 10px, border-right gray-4, background gray-2 (dark: gray-3), flex-shrink 0, overflow-y scroll, scrollbar-gutter stable; :last-child has no border
- @media (max-width: 900px) (750-763): content-grid becomes column, .pane gets border-bottom, .resizer is hidden
- @media (max-width: 860px) (422-434): notice stack positioning
- .resizer (1415-1431): 6px wide, col-resize, with an ::after 2px line
- The pane CSS modules (FolderTree.module.css, MessageListPane.module.css, MessageViewPane.module.css) each define their own `.pane`. FolderPane uses className `pane ${styles.pane}` with style width=leftWidth.
- The Radix <Theme grayColor='sand' panelBackground='solid'> wrapper is in app/layout.tsx.
- There is no real mobile single-pane navigation today.

### 6. How does the app know the current user (currentUser, /api/auth/me) and the list of accounts (accounts, switchAccount), and where is 'ownerUserId' used client-side?
Current user:
- MailClient.tsx:615-617 holds `authState: 'loading'|'ok'|'unauth'` and `currentUser: User|null`. User is {id, email, role: 'admin'|'user', createdAt} (lib/data.ts:413-418). `isAdminUser = currentUser?.role === 'admin'`.
- It is populated by useAccountController.loadInitialData (useAccountController.ts:130-215): GET /api/auth/me → setAuthState('ok'), setCurrentUser(me.user), setSessionTtlSeconds(ttlSeconds), preferredAccountId = me.accountId. Any non-OK response becomes 'unauth'.
- Also populated by the LoginOverlay onAuthenticated handler (5217-5274) and by the session keep-alive poll (4082-4110, which re-fetches /api/auth/me every min(30 min, ttl/3)).
- readErrorMessage sets 'unauth' on session-like 401s (470-490).
- /api/auth/me (app/api/auth/me/route.ts:11-40) reads the sealed session cookie and returns 401 without a session and 403 when the session has no accountId. It then loads getUsers() + getAccountsForUser(session.userId), returns {ok, user, accountId, accounts, exp, ttlSeconds} and rotates the cookie.
- SessionData is {userId, accountId?, role?, exp, imap?, smtp?} (lib/auth.ts:30-37).
- currentUser is only consumed as isAdminUser → AccountSettingsModal (5657).

Accounts:
- loadInitialData calls GET /api/accounts (app/api/accounts/route.ts:8-13 → getAccountsForUser, lib/db/accounts.ts:32-43: `user_accounts.userId = ? OR accounts.ownerUserId = ?`, sanitized of passwords).
- It then calls setAccounts and setActiveAccountId(resolveActiveAccountId(accounts, preferred, prev)) and loads folders for that account.
- Derived values: currentAccount = accounts.find(id === activeAccountId) (1892); otherAccounts (3494-3497).
- switchAccount (useAccountController.ts:217-281):
  1. POST /api/auth/switch-account {accountId}. The server checks listAccessibleAccountIdsForUser (lib/db/users.ts:38-52) and re-seals the session with accountId plus IMAP/SMTP credentials (switch-account/route.ts:5-48).
  2. It resets messages, paging, active message, query, scope, fields, badges, virtual folder and folder ids.
  3. setActiveAccountId, then loadInitialData({skipAuthCheck: true, preferredAccountId}).
- TopBar triggers it via actions.switchAccount. Deep links/notifications call it at 4003, 4046, 4559 and 4917.
- Server-side, every account route authorizes with requireSessionAccountOr403 (auth.ts:159-169: accountId must equal session.accountId) or requireAccountContext (accountContext.ts:38-57). requireOwnedAccountContext (67-85) allows any owned or linked account for cross-account features.

ownerUserId client-side:
- It is declared on Account (lib/data.ts:38) and is present in the /api/accounts and /api/auth/me payloads, because sanitizeAccountForClient does not strip it.
- No client logic reads it. The only client reference is the type AdminUserDirectoryAccount in app/components/account-settings/tabs/AdminTabContent.tsx:50-55, which types the /api/admin/users response.
- Server-side uses:
  - accounts POST (route.ts:35): ownerUserId = existing ?? session.userId
  - auth/login (64-66)
  - auth/signup (77, 123)
  - admin/users (36-38)
  - syncOperation.ts:861-862 (reminder/processed-by user)
  - the OR clause in getAccountsForUser and listAccessibleAccountIdsForUser



# AREA: thread-view-and-compose

## Summary
The right-hand pane is assembled by MessageViewOrchestrator (forwardRef with an imperative handle). It renders MessageViewPane, which has three parts: a debug toolbar (shortcut hint plus "Show JSON" and "Evict Thread Cache" buttons), an optional `header` slot shown in `.threadHeader`, and a scrollable `.threadView` for its children. The orchestrator builds the header inline: the root subject, a Compact/Full SegmentedControl, the thread's TopicBadges and a ThreadTopicSuggestionsRow. The body is an optional inline compose card at the top, followed by ThreadView. ThreadView takes `activeMessage`, `activeThread` and `threadContentById` and works out the rendered message list with getRenderedThreadMessages. It renders one ThreadMessageCard per message, and may render the inline compose card directly below the message being replied to. MailClient.tsx (about 5,970 lines) owns almost everything else. It derives `activeMessage`, `activeThread`, `inlineComposePlacement` and `composeThreadFocusMessageId`, and it passes a large `messageCardProps` bag that includes the render-props `renderQuickActions` and `renderMessageMenu` (built by RenderHelpers.tsx). Thread messages are fetched by a MailClient effect that POSTs to /api/accounts/{id}/thread/related and stores the result in `threadContentById`, an LRU cache in useThreadContent keyed by threadId. ComposeOrchestrator owns all compose state through useComposeState and useComposeController. It exposes `renderInlineCard()` on its handle. That returns an empty slot div, and ComposeOrchestrator portals ComposeInlineCard into the div, so the card can be placed anywhere in the thread. Compose state is mirrored back to MailClient via `onComposeMirrorChange`. Opening a message never sets \Seen automatically. Read state only changes through explicit flag mutations (menu, unread dot, r/u keys, bulk menu) and as a side effect of sending a reply (answered implies \Seen). All styling uses Radix Themes components with per-component CSS modules that rely on Radix tokens (--gray-*, --space-*, --radius-*).

## Key files
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/MessageViewOrchestrator.tsx — Assembles the message pane. Owns threadViewMode, zoom, tabs, collapse and translation state. Builds the thread header and places the inline composer. This is the main place to insert collaboration UI. [140-231 (header/body input types), 237-243 (local view state), 655-721 (header JSX), 723-777 (body: top compose slot + ThreadView + merged messageCardProps)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/MessageViewPane.tsx — Layout shell: toolbar, `header` (div.threadHeader), and children in div.threadView with the link-preview overlay. It has a `hideToolbar` prop that nothing currently passes. [9-15 props, 31-55 debug toolbar, 56 header slot, 57-71 scroll area]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/ThreadView.tsx — Renders the visible thread messages as ThreadMessageCards and renders the composer under `composeReplyMessageId`. [84-96 props, 115-137 thread id + visible list, 141-162 per-message rows, 159 inline reply slot]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/threadViewState.ts — Pure helpers that decide which messages render and where the inline composer mounts. Unit tests live in threadViewState.test.ts. [18-48 getRenderedThreadMessages, 50-68 getInlineComposePlacement, 70-79 getComposeThreadFocusMessageId]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/ThreadMessageCard.tsx — Per-message card: badges (IMAP flags, $Todo/$Done, folder, priority), header actions, recipients and the body tabs (HTML/Text/Markdown/Source). [65-142 props, 706-818 compact collapsed row, 820-1071 full card; 853-944 badges, 946-951 quick actions + menu]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/MessageQuickActions.tsx — Icon-button actions. Reply calls openCompose('reply', message). [7-15 local ComposeMode/action types, 118-197 reply/replyAll/forward/related/delete]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/MessageMenu.tsx — Kebab menu per message (Radix Themes DropdownMenu with submenus). It is a natural place for 'Assign to…' and 'Set status' items. [47-76 action union, 78-122 props, 180-232 buildItem/todo items, 234-575 DropdownMenu, 297-301 Mark as read/unread]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/RenderHelpers.tsx — Factory functions that turn MailClient callbacks into MessageQuickActions and MessageMenu elements. [11-35 renderQuickActions, 37-110 renderMessageMenu (positional args)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/MailClient.tsx — Shell that owns selection, activeThread derivation, thread fetching and all callbacks passed to the pane. [633-654 composeMirror, 1980-1987 openCompose, 2649-2672 handleBeforeSelectMessage, 2793-2896 showComposeInline/activeMessage/activeThread/inlineComposePlacement, 3619-3678 renderQuickActions/renderMessageMenu, 4354-4530 thread content fetch effect, 5558-5634 <MessageViewOrchestrator>, 5715-5763 <ComposeOrchestrator>]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/composition/ComposeOrchestrator.tsx — Owns compose state, sending, drafts and views (inline/modal/minimized). Exposes renderInlineCard and openCompose on its handle. [107-136 handle type, 548-568 useComposeController wiring, 641 useComposeDraftAutoSave, 874-990 handleSendMail, 1171-1191 openCompose wrapper, 1231-1262 mirror effect, 1454-1506 renderInlineCard portal + InlineComposeSlot]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/composition/ComposeInlineCard.tsx — Inline composer card. Reuses ThreadMessageCard.module.css classes and reads all state from ComposeContext. [12-60 context read, 62-73 mode label, 75-172 card layout]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/composition/useComposeController.ts — Turns openCompose(mode, message) into compose state. [316-403 openCompose (resets state, computeComposeInitState, setComposeMode, setComposeView('inline'), setComposeOpen(true))]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/composition/composeTypes.ts — Canonical ComposeView and ComposeMode unions. [5-13]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/useThreadContent.ts — Thread cache (threadContentById, an LRU capped at THREAD_CACHE_LIMIT), loading and error state, and message hydration. [46-51 state, 75-87 upsertThreadCache, 138-152 evictThreadCache, 330-369 ensureMessageContent]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/[accountId]/thread/related/route.ts — POST {threadIds, messageIds, groupBy, threadDateSource} returns {items}. Uses requireAccountContext, then listThreadMessages, then enrichMessagesWithThreadTopics. [11-51]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/[accountId]/threads/route.ts — GET thread list for the message list (folderId, page, badges, q, …). Returns {items, groups, total, baseCount, hasMore}. Same enrichment hook. [11-61]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/messageFlagMutation.ts — Server-side flag mutation used by the flags routes and by lib/mcpServer.ts:31. [10-16 MESSAGE_FLAG_MAP (seen -> \Seen), 29-47 buildFlagMutations (answered implies \Seen), 76+ applyFlagMutationsToMessage]

## Extension points
- Thread-level collaboration toolbar (assignee, status, note button): add a row to the header Flex column in MessageViewOrchestrator.tsx:682-718, right after <ThreadTopicSuggestionsRow> (704-717), or next to the SegmentedControl in the subject row (683-696). Make it a self-contained component (for example ThreadCollaborationBar) that takes {accountId, threadId = activeMessage.threadId ?? activeMessage.messageId ?? activeMessage.id} and fetches its own data with `body.apiFetch`/`activeAccountId`, which are already available at MessageViewOrchestrator.tsx:377-378. That way only one new prop at most goes through MessageViewOrchestratorHeaderInputs (140-152). The header renders in MessageViewPane.tsx:56 (div.threadHeader).
- Comments and activity timeline: render inside the MessageViewPane children in MessageViewOrchestrator.tsx:738-776, either after <ThreadView/> (a section at the end of the thread) or before it. To interleave comments by date between messages, ThreadView.tsx:141-162 is the per-row loop (each row is div.threadItem wrapping ThreadMessageCard plus an optional composer).
- Per-message status/assign entry points: add DropdownMenu items in MessageMenu.tsx (action union 47-76, items in the Content block 246-574, buildItem helper 180-195). Thread new callbacks through RenderHelpers.renderMessageMenu (positional args at RenderHelpers.tsx:37-110) and MailClient.renderMessageMenu (MailClient.tsx:3636-3678). For quick icon buttons use MessageQuickActions.tsx:118-197 with the `actionVisibility` map.
- Badges on cards (assignee avatar, status pill): ThreadMessageCard.tsx full-card badges at 853-944 and compact row badges at 774-799. New data can arrive on the Message object (enriched server-side) or through a new messageCardProps entry (type ThreadMessageCardProps 65-142; MailClient passes it at 5590-5632).
- Server enrichment so thread/list payloads carry collaboration fields: follow enrichMessagesWithThreadTopics (app/api/_helpers/enrichMessagesWithThreadTopics.ts), which is called in thread/related/route.ts:45-49 and threads/route.ts:100-104. Add an equivalent enrichMessagesWithThreadCollaboration after it. requireAccountContext (route.ts:26 and 72) is where mailbox-permission checks plug in.
- Internal-comment composer option A (low coupling, recommended): a separate InternalNoteComposer that does not use ComposeOrchestrator, rendered at the same places the inline card goes (top slot MessageViewOrchestrator.tsx:740-741, or under a message via ThreadView.tsx:159). It would post to a new REST endpoint, which avoids SMTP, IMAP drafts and recipient validation.
- Internal-comment composer option B (reuse the editor): add 'internalNote' to ComposeMode (composeTypes.ts:7-13) and to the label switch in ComposeInlineCard.tsx:62-73. It must also be handled in computeComposeInitState (composeInitState.ts), shouldThreadComposeForMode (composeThreading.ts:3-11) and buildSendPayload. handleSendMail (ComposeOrchestrator.tsx:874) would need to branch: no recipients check at 886, no SMTP POST at 924, no answered flag at 971-976. useComposeDraftAutoSave (641) and handleSaveDraft (useDraftManager.ts:327) must be disabled for that mode. ComposeFields would hide To/Cc/Bcc. Open it with openCompose('internalNote', message), passed from a new MessageQuickActions/MessageMenu item.
- Virtual folders 'Assigned to me' / 'Unassigned' / 'Open' affect the thread view only through `activeThread`. activeThread is derived in MailClient.tsx:2819-2859 from threadContentById plus threadScopeMessages, so the thread view needs no change as long as list items carry correct threadId/accountId values.

## Gotchas
- Thread identity is always computed as `message.threadId ?? message.messageId ?? message.id` (ThreadView.tsx:115-116, MailClient.tsx:2741-2742/2821/4380-4381, threadViewState.ts:37, useThreadContent.ts:123, ComposeOrchestrator.tsx:946-949). Thread ids are only unique within an account (comment at MessageViewOrchestrator.tsx:573-576), so collaboration rows must be keyed by (accountId, threadId). threadId comes from the DB threading algorithm and threads are recomputed (lib/db/threads.ts:279 recomputeThreadsForAccountInternal; /threads/recompute job in useSyncController.ts:866). The existing per-thread metadata table thread_topics (lib/db/schema.ts:858-864, PK threadId+topicId) is the precedent, but plan for threadId changes when messages are re-threaded.
- The name 'done' already exists: IMAP keywords $Todo/$Done (lib/messageFlags.ts:4-5), the badges kind=todo/done in ThreadMessageCard (787-790, 861-874), the menu items 'Mark as Done'/'Mark as To-Do' (MessageMenu.tsx:204-232), and the 't' shortcut (MessageViewPane.tsx:37). Collaboration status (open/pending/in_progress/done) should be separate DB state with distinct UI wording, or the mapping to $Done must be explicit.
- Opening a message does NOT set \Seen. Selection goes useMessageListSelectionController.handleSelectMessage (messagelist/useMessageListSelectionController.ts:104-129), then MailClient.handleBeforeSelectMessage (2649-2672, which just calls setViewMessage), then the thread content effect (MailClient.tsx:4354-4530). Hydration calls POST .../resync and GET message detail (useThreadContent.ts:172-240). The IMAP fetch uses imapflow `source: true` (lib/mail/imap/sync.ts:1374-1384), which imapflow sends as BODY.PEEK, so no implicit \Seen.
- Composer placement depends on `composeReplyMessage` being in the rendered list: getInlineComposePlacement (threadViewState.ts:50-68) uses getRenderedThreadMessages. If the reply target isn't rendered (threads disabled, or thread still loading), the composer goes to the top slot instead. ThreadView hides the draft being edited (getVisibleThreadMessages, threadViewState.ts:3-13).
- renderInlineCard returns an empty <InlineComposeSlot> div. The real ComposeInlineCard is portalled into it from ComposeOrchestrator (1454-1487). Only ONE slot can be active at a time (single inlineSlotEl state), so a second editor such as a note composer cannot reuse renderInlineCard at the same moment as a reply.
- When the user opens compose inside the active thread, MessageViewOrchestrator collapses all sibling messages once per focus change (626-653). A comments section placed between messages has to account for that collapse behaviour.
- ComposeMode is defined in composeTypes.ts:7-13 but is duplicated as local string unions in MessageQuickActions.tsx:7 and MessageMenu.tsx:47. Adding a mode means updating all three (RenderHelpers imports the canonical type).
- `activeMessage` is undefined while a 'new' compose is open (MailClient.tsx:2797), so the header and toolbar disappear. A collaboration bar keyed on activeMessage will hide during new-message compose.
- Draft autosave starts as soon as compose is open (useComposeDraftAutoSave at ComposeOrchestrator.tsx:641; useDraftManager.ts:327-360 is gated only on composeOpen and activeAccountId). Any reuse of ComposeOrchestrator for internal notes must bypass this, otherwise notes become IMAP drafts. handleSendMail always requires recipients (886-889) and posts to SMTP (924).
- Sending a reply sets 'answered' (ComposeOrchestrator.tsx:971-976), and buildFlagMutations adds \Seen whenever answered=true (lib/messageFlagMutation.ts:43-45). So a reply marks the message read, but nothing changes the assignment or status. A collaboration 'auto set pending on reply' hook belongs here.
- MessageViewPane's debug toolbar (Show JSON / Evict Thread Cache / shortcut hint, 31-55) is always shown because the orchestrator never passes hideToolbar. A new shell or mobile layout probably wants to hide it or replace it with the collaboration toolbar.
- Dark mode is a prop passed down (MailClient.tsx:345 `darkMode` state into messageCardProps.darkMode into HtmlMessage at ThreadMessageCard.tsx:463), not just a CSS theme. The Radix <Theme> is in app/layout.tsx:33, and globals.css defines custom vars such as --muted (lines 19/46). A shadcn light/dark theme must keep feeding `darkMode` to HtmlMessage.
- messageCardProps is a large prop bag: Omit<ThreadMessageCardProps,'message'> in ThreadView, with more Omits in MessageViewOrchestrator (200-219) because the orchestrator injects its own state. A new card prop must be added to ThreadMessageCardProps, passed in MailClient.tsx:5590-5632, and must not be in the orchestrator's Omit list unless the orchestrator owns it.
- AGENTS.md: keep UI state in MailClient.tsx unless it belongs in lib/. Avoid mock.module on @/lib/db; mock wrappers such as @/lib/serverDb instead. Don't duplicate components. Run `bun run test:ci`. threadViewState.test.ts covers the placement helpers.

## Q&A
### 1. Where is the thread header / action bar rendered for the active thread? Where would an 'assignee + status + internal note' toolbar be inserted with minimal coupling?
MessageViewPane.tsx renders two bars. (a) A debug toolbar at lines 31-55, with the shortcut hint plus 'Show JSON' and 'Evict Thread Cache' Buttons. (b) `header` inside div.threadHeader at line 56 (CSS at MessageViewPane.module.css:63-71). The header content is built inline in MessageViewOrchestrator.tsx:659-721 when activeMessage is set: a Flex column containing the subject span (684) plus the Compact/Full SegmentedControl (687-695), the TopicBadges row (697-703) and ThreadTopicSuggestionsRow (704-717). Its inputs come from `header` props (MessageViewOrchestratorHeaderInputs, 140-152). Per-message actions are not in the header; they are on each card (ThreadMessageCard.tsx:946-951, renderQuickActions plus renderMessageMenu).

Minimal-coupling insertion point: add one more child to that Flex column after ThreadTopicSuggestionsRow (around line 717), for example <ThreadCollaborationBar accountId={activeAccountId} threadId={activeMessage.threadId ?? activeMessage.messageId ?? activeMessage.id} apiFetch={apiFetch} />. The component would load and mutate its own data (assignee, status, notes count) through new REST endpoints. activeAccountId and apiFetch are already destructured in the orchestrator (377-378), so MailClient does not need new state. The only change MailClient might need is passing current-user and member-list info through `header` if those are not fetched by the component itself. The comments/activity timeline would go in the pane children (738-776), either after <ThreadView/> or interleaved per row in ThreadView.tsx:141-162. Per-message 'Assign/Status' entries belong in MessageMenu (DropdownMenu.Content 246-574) through RenderHelpers.renderMessageMenu.

### 2. How is the inline reply composer placed relative to the thread (renderComposeInlineCard, inlineComposePlacement)? How could an 'Internal comment' mode be added alongside 'Reply' (what state/props drive the composer mode)?
Placement: MailClient computes `showComposeInline = composeOpen && composeView === 'inline'` (MailClient.tsx:2793). It then computes `inlineComposePlacement = getInlineComposePlacement({activeThread: getRenderedThreadMessages(...), showComposeInline, composeReplyMessage})` (2862-2887; helper at threadViewState.ts:50-68). The helper returns {showComposeAtTop, composeReplyMessageId, replyMessageInThread}. The composer goes under the reply target when that message is rendered; otherwise it goes at the top. MessageViewOrchestrator defines renderComposeCard = composeHandleRef.current?.renderInlineCard(wrapperClassName) (726-727). It renders the card at the top when showComposeAtTop is true (740-741), and otherwise passes it to ThreadView as `renderComposeInlineCard` (752-754). ThreadView then renders it inside the matching row after the ThreadMessageCard (ThreadView.tsx:159). renderInlineCard (ComposeOrchestrator.tsx:1457-1463) returns an empty InlineComposeSlot div (1489-1506). ComposeOrchestrator portals <ComposeInlineCard/> into that div (1478-1483) with ComposeContext. composeThreadFocusMessageId (MailClient.tsx:2888-2896; threadViewState.ts:70-79) makes the orchestrator collapse siblings (MessageViewOrchestrator.tsx:626-653).

What drives the mode: `composeMode` state in useComposeState.ts:22 (type ComposeMode in composeTypes.ts:7-13: new|reply|replyAll|forward|edit|editAsNew), together with composeOpen, composeView and composeReplyMessage. They are set by useComposeController.openCompose (useComposeController.ts:316-403: setComposeMode at 347, computeComposeInitState at 352, setComposeView('inline') at 401, setComposeOpen(true) at 402). Entry is MessageQuickActions/MessageMenu `openCompose('reply', message)`, then MailClient.openCompose (1980-1987), then composeHandleRef.current.openCompose, then ComposeOrchestrator.openCompose/initializeCompose (1171-1191, ~1100-1165). The state is mirrored back to MailClient via onComposeMirrorChange (ComposeOrchestrator.tsx:1231-1262 into MailClient composeMirror 633-654). ComposeInlineCard reads composeMode from context and maps it to a label badge (62-73).

Adding an 'Internal comment' mode:
- Option A (recommended, low coupling): a separate InternalNoteComposer component with its own small state. Mount it in the same spots, at the top slot or under a message (ThreadView row), or in the collaboration bar. Toggle it with a 'Reply | Internal note' segmented control in the header or quick actions. It posts to a new comments endpoint. This avoids SMTP, drafts and recipients. Note that only one renderInlineCard slot can be active at a time.
- Option B: extend ComposeMode with 'internalNote', update the duplicate unions in MessageQuickActions.tsx:7 and MessageMenu.tsx:47, and add the label to ComposeInlineCard.tsx:62-73. Then special-case computeComposeInitState, shouldThreadComposeForMode (composeThreading.ts:3-11) and ComposeFields (hide To/Cc/Bcc/Subject). Branch handleSendMail (ComposeOrchestrator.tsx:874), whose recipient check is at 886 and SMTP POST at 924, and skip the answered flag at 971-976. Disable draft autosave (useComposeDraftAutoSave at 641) and manual save (useDraftManager.ts:327) for that mode. Option B touches many places that assume email semantics.

### 3. How are messages within a thread fetched (threadContentById) and what identifies a thread for the view (activeThread, activeMessage.threadId)?
Identity: the thread key is `activeMessage.threadId ?? activeMessage.messageId ?? activeMessage.id`. It is used in ThreadView.tsx:115-116, threadViewState.ts:37, MailClient.tsx:2821 and 4380, and ComposeOrchestrator.tsx:946-949. Message.threadId is a required string (lib/data.ts:112), unique only per account. MailClient also builds activeMessageThreadKey = `${accountId}|${messageId??id}|${threadId}` (MailClient.tsx:2802-2808), which triggers the fetch effect.

Fetching: useThreadContent (useThreadContent.ts:46) holds `threadContentById: Record<threadId, Message[]>`. upsertThreadCache (75-87) is an LRU bounded by THREAD_CACHE_LIMIT. The other state is threadContentLoading (48, the id of the thread currently loading) and threadContentErrorById (49). The MailClient effect at 4354-4530 runs on activeMessageThreadKey/threadEvictVersion/etc. It reads activeMessageRef.current. If the active message has no body, it hydrates first via hydrateMessageOnOpenIfNeeded (POST /messages/{id}/resync, then GET /messages/{id}; useThreadContent.ts:172-240, 306-328). It skips the request when the cached thread already covers the local thread (doesCachedThreadCoverMessages). Otherwise it POSTs to /api/accounts/{id}/thread/related with {threadIds (from local thread when supportsThreads), messageIds, groupBy, threadDateSource} (4466-4475), filters out excluded folders, and calls upsertThreadCache(threadId, filtered) (4503). The route (thread/related/route.ts:11-51) calls requireAccountContext, then listThreadMessages, then enrichMessagesWithThreadTopics, and returns {items}. evictThreadCache (useThreadContent.ts:138-152) bumps threadEvictVersion to force a refetch; it is called after send (ComposeOrchestrator.tsx:950).

activeThread (MailClient.tsx:2819-2859) merges threadContentById[threadId] with activeLocalThread. activeLocalThread is built from list data with buildThreadTree/findThreadRootByMessageId (2812-2817). The merged list is ordered with flattenThread, with fallbacks to getThreadMessages(threadScopeMessages, threadId). Excluded folders such as Trash/Spam restrict the thread to the same folder. getRenderedThreadMessages (threadViewState.ts:18-48) then shows only the active message when threads are disabled or still loading, and hides the draft being edited. The list endpoint /threads (threads/route.ts) returns thread rows for the message list, not thread content.

### 4. What CSS modules/Radix components do these files use (so a shadcn restyle knows the surface area)?
- MessageViewPane.tsx: Button (@radix-ui/themes); MessageViewPane.module.css (124 lines: pane, threadViewShell, toolbar, toolbarActions, shortcutHint, keycap, threadHeader, threadView, linkPreviewOverlay).
- MessageViewOrchestrator.tsx: Flex, SegmentedControl (themes); inline styles for the subject (684); ThreadView.module.css (threadItem); TopicBadge; ThreadTopicSuggestionsRow (Flex, Popover, Text plus QuestionMarkCircledIcon from @radix-ui/react-icons).
- ThreadView.tsx: Text (themes); ThreadView.module.css (31 lines: threadItem, compactThreadItem, loading, empty).
- ThreadMessageCard.tsx: Badge, Button, Card, Flex, Select, Tabs, Text (themes); CaretRightIcon (@radix-ui/react-icons); @radix-ui/react-collapsible primitive; lucide-react icons; ThreadMessageCard.module.css (608 lines; classes include card, cardMenuOpen, cardDisabled, header, topRow, topRowLead, badges, actions, messageActions, info, metaLine/metaSegment*, tabsBar/tabsList/tabTrigger, zoomControls, buttonGroup, panel, textView, bodyLoading*, bodyLoadError*, collapsibleContent/Inner, unsubscribeBanner, compactRow/compact*); MessageBadge.module.css. Child components: TooltipIconButton (themes IconButton plus Tooltip), HtmlMessage, QuoteRenderer, AttachmentsList, CalendarEventPreview (CSS module), FolderBadges, SenderIcon (CSS module), CategoryBadge, FlagBadge, MessageBadge, MessageRecipientMetaField, InReplyToReferenceRow (CSS module). Badge colours come from lib/ui/badgeColors, which uses Radix colour names.
- MessageQuickActions.tsx: TooltipIconButton only, plus lucide icons.
- MessageMenu.tsx: DropdownMenu from themes (Root/Trigger/Content/Item/Sub/SubTrigger/SubContent/Label/Separator); MessageMenu.module.css (41 lines); MoveToSubmenu; TopicBadge.
- ComposeInlineCard.tsx: Badge, Card (themes); it reuses ThreadMessageCard.module.css classes (card, header, topRow, badges, actions, info) and also uses ComposeInlineCard.module.css (33 lines) and Compose.module.css (445 lines). Its children: ComposeFields (Button, Text, TextField), ComposeActions (Button, Text), ComposeMessageField (Collapsible primitive, DropdownMenu, Select, Tabs, Flex, Button, Text; ComposeMessageField.module.css plus ThreadMessageCard.module.css), ComposeModal (Heading, Text, MinusIcon), ComposeMinimized.
- The CSS relies on Radix tokens (--gray-1..12, --gray-a4, --space-*, --radius-3, --color-panel-solid) and globals.css custom vars (--muted, lines 19/46). Theme root is app/layout.tsx:33. Global class 'resizer' is used in MailClient.tsx:5551.

### 5. How does 'mark as read' happen when a message is opened (so we can keep read vs done separate)? Cite the code path that sets \Seen.
There is no automatic mark-as-read when a message is opened. The selection path is MessageList row click, then useMessageListSelectionController.handleSelectMessage (messagelist/useMessageListSelectionController.ts:104-129), then MailClient.handleBeforeSelectMessage (MailClient.tsx:2649-2672, which only sets pending collapse/scroll, may minimize compose, and calls setViewMessage). After that the thread-content effect (4354-4530) hydrates and fetches the thread. None of these touch flags. Server hydration (resync) uses imapflow fetchOne with `source: true` (lib/mail/imap/sync.ts:1374-1384). imapflow issues that as BODY.PEEK[], so IMAP does not set \Seen implicitly.

\Seen is only set explicitly:
(a) MessageMenu 'Mark as read/unread': updateFlagState(message,'seen',!message.seen) (MessageMenu.tsx:297-301).
(b) The unread dot in the list (messagelist/useMessageListHelpers.tsx:66-73).
(c) The r/u keyboard shortcuts (MailClient.tsx:3810-3833 via updateFlagStateByIds).
(d) The bulk context menu (MailClient.tsx:5804-5813, updateFlagStateBulk).

All of these go through MailClient.updateFlagState (3320-3328), which calls listHandleRef, then useMessageMutations.updateFlagState (useMessageMutations.ts:474-487), then requestMessageFlagMutation (130-142). That POSTs to /api/accounts/{id}/messages/{messageId}/flags {flag:'seen', value}. The route (app/api/accounts/[accountId]/messages/[messageId]/flags/route.ts:37) calls applyFlagMutationsToMessage (lib/messageFlagMutation.ts:76+), which maps seen to '\\Seen' (line 11) and calls updateImapFlags plus the updateMessageFlags DB write.

There is also an implicit path. Sending a reply calls updateFlagState(composeReplyMessage,'answered',true) (ComposeOrchestrator.tsx:971-976), and buildFlagMutations adds \Seen whenever answered=true (messageFlagMutation.ts:43-45). The MCP server uses the same applyFlagMutationsToMessage (lib/mcpServer.ts:31).

So read/unread is per-message IMAP \Seen, while the existing 'done' is the per-message IMAP keyword $Done (lib/messageFlags.ts:5). A per-thread collaboration status stored in SQLite will naturally stay independent of both.



# AREA: settings-admin-mcp-ui

## Summary
The settings UI is one Radix Themes `Dialog`, `AccountSettingsModal` (app/components/AccountSettingsModal.tsx). It opens only when `manageOpen && editingAccount` in MailClient (MailClient.tsx:5647). It holds one local copy of the account in `localAccount` (line 86) and renders a controlled `Tabs.Root` (231-235). The tab id `ManageTab` (18-28) lives in MailClient state (`manageTab`, MailClient.tsx:347). The tab header is `OverflowTabsList`: it measures each tab's width and moves tabs that don't fit into a "more" `DropdownMenu`. Each tab is a separate `*TabContent` component under app/components/account-settings/tabs/. Every tab draws its own footer with Close/Cancel/Save. There are two kinds of tab. Form tabs edit `localAccount` and call `onSave(localAccount)`; MailClient sends that to `saveAccount` on the account tab, otherwise to `saveAccountSettings` (MailClient.tsx:5655). Self-saving tabs (categorization, topics, MCP, recipient-aliases, admin) call their own REST endpoints straight away through the injected `apiFetch` prop. Whether a form tab has changes is a JSON snapshot diff in lib/accountSettings.ts (`hasSavableAccountSettingsChanges`). The Admin tab is pushed into the tab list only when `isAdminUser` is true, i.e. `currentUser?.role === "admin"` from /api/auth/me (MailClient.tsx:617). Today it is read-mostly: a user directory with linked mailboxes (GET /api/admin/users), invite codes (GET/POST /api/admin/invites), and desktop-only storage paths. Login today is IMAP-only. `LoginOverlay` posts {email, password} to /api/auth/login, which finds an account by email or imap.user and checks the password against the IMAP server. Signup is invite code → full `AccountSettingsModal` (account tab) → POST /api/auth/signup, which uses the IMAP password as the user's password. `AccountReloginDialog` re-enters IMAP credentials for one mailbox via POST /api/accounts/[id]/relogin. It opens automatically when `readErrorMessage` sees a 401 with `reauthRequired`. Dark mode is a `.dark` class on <html>, toggled in MailClient and saved in localStorage key `noctua:theme`. Radix `<Theme>` has no `appearance` prop, so it defaults to "inherit" and follows the `.dark` class.

## Key files
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/AccountSettingsModal.tsx — Settings modal shell. Owns the local account draft, per-tab dirty flags, tab list, IMAP/SMTP security probe, and wires props into each tab. [18-28 ManageTab; 41-64 Props; 86 localAccount; 98 fetchFn; 100 handleSave; 102-127 canSave* memos; 129-143 tabItems (admin gating 141); 147-152 handleUpdateSettings; 154-199 runProbe (/api/probe); 202-220 Dialog (outside-click/Esc blocked 214-215); 231-397 Tabs.Root + per-tab Tabs.Content]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/account-settings/OverflowTabsList.tsx — Responsive tab strip. Tabs that don't fit go into a '...' DropdownMenu. Styled via .settings-tabs-list/.settings-tabs-overflow in app/globals.css:1269-1300. [5-16 types; 19 OVERFLOW_TRIGGER_WIDTH; 36-57 width measurement; 60-69 ResizeObserver; 73-83 font-swap remeasure; 85-100 visibleCount; 106-138 render (Tabs.List/Trigger + DropdownMenu RadioGroup)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/account-settings/tabs/AdminTabContent.tsx — Admin tab. Users directory with linked mailboxes, invite code generation and list, desktop storage paths. [9-14 StorageInfo; 50-93 directory/invite types; 95-103 Props; 129-142 request/readError fallback; 144-187 loadAdminData; 189-213 generateInviteCode; 236-244 desktop storage-info (bare fetch); 260-285 header buttons; 319-366 Users card; 368-378 Storage card; 380-437 Invite codes card; 441-451 footer]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/account-settings/tabs/McpTabContent.tsx — MCP token management for the active account. Server URL is `${origin}/api/mcp`, with Bearer tokens. [14-21 Props; 36-42 EXPIRY_PRESETS; 98-101 own readError; 103-123 loadTokens (GET mcp-tokens); 157-191 handleCreate (POST); 193-213 handleDelete (window.confirm + DELETE); 215-217 hidden for new accounts; 219-378 UI]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/account-settings/tabs/AccountTabContent.tsx — Mailbox (IMAP/SMTP) form. Reused by the logged-in 'Add account' flow and by the signup flow. [6-23 Props; 46-268 name/email + IMAP/SMTP host/port/security/user/password; 270-288 footer (Delete Account / Cancel / Save)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/accountSettings.ts — Per-tab dirty detection: a JSON diff of a tab-specific snapshot. Tabs that return a null snapshot are never dirty. [4-27 normalizeAccountSettings; 29-39 AccountSettingsSaveTab (duplicate of ManageTab); 68-119 getTabSaveSnapshot; 121-130 hasSavableAccountSettingsChanges]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/useAccountController.ts — Client account CRUD and session bootstrap. Called from MailClient.tsx:1673-1690. [130-215 loadInitialData (/api/auth/me, /api/accounts, folders); 217-281 switchAccount (/api/auth/switch-account); 283-329 saveAccount; 331-358 saveAccountSettings; 360-381 deleteAccount; 383-389 startEditAccount]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/utils/accountControllerHelpers.ts — Pure helpers for the controller. Unit-tested in accountControllerHelpers.test.ts. [16-27 resolveActiveAccountId; 33-40 resolveSwitchedAccountId; 54-74 buildAccountSaveRequest (POST /api/accounts vs PUT /api/accounts/[id]); 80-86 normalizeCaldavForSave; 94-105 normalizeDeeplForSave; 112-121 createBlankEditAccount]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/auth/LoginOverlay.tsx — Unauthenticated UI: login, invite-code entry, and signup (which creates a mailbox). [16-26 client accountIdFromEmail (cosmetic); 32-42 state; 44-66 submitLogin; 68-91 submitSignup; 102-119 desktop needs-setup; 121-139 startInviteFlow; 141-159 openSignupModal; 164-216 Sign-in dialog; 218-280 Invite-code dialog; 282-305 signup via AccountSettingsModal + floating error]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/AccountReloginDialog.tsx — Re-enter IMAP credentials for one mailbox after a 401 with reauthRequired. [11-20 Props; 38-44 reset on open; 46-81 handleSubmit -> POST buildAccountReloginPath(id) {imap:{user,password}}; 83-146 UI]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/MailClient.tsx — Owns all state for these dialogs and wires them up. [345 darkMode; 346-350 manageOpen/manageTab/editingAccount/reloginAccountId/reloginDescription; 384-410 apiFetch; 435-503 readErrorMessage (401 -> relogin 476-478 / unauth 480-487); 616-617 currentUser/isAdminUser; 1919-1934 handleOpenReloginFromException; 3908-3915 theme restore effect; 5207-5209 isExistingAccount; 5210-5215 handleToggleDarkMode; 5217-~5250 LoginOverlay; 5288 darkMode to TopBar; 5311 startEditAccount to TopBar; 5317-5320 logout; 5647-5679 AccountSettingsModal; 5681-5693 AccountReloginDialog]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/TopBar.tsx — Entry points into the settings modal, add-account, logout, and the dark toggle. [470-522 account DropdownMenu (switch account, 'Account settings' 500-505, 'Delete account' 506-512, '+ Add account' 515, Logout 517-520); 525-535 theme toggle button]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/admin/users/route.ts — Admin user directory API. [6-59 GET: users + accounts via user_accounts links and accounts.ownerUserId]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/admin/invites/route.ts — Admin invites API. [5-27 GET (adds isUsed, usedByUserEmail); 29-35 POST createInviteCode({role:'user',maxUses:1,expiresAt:null})]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/admin/_auth.ts — Admin guard for all /api/admin routes. [5-13 requireAdminSessionOr403 (re-reads role from DB)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/auth/login/route.ts — Current IMAP-based login. Must become an app-password login. [9 rate limiter 5/min; 21-26 payload; 32-42 account lookup; 43-46 verifyImapCredentials; 47-58 store pw if DB storage; 60-70 resolve user; 72-81 session cookie]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/auth/signup/route.ts — Invite-based signup. Creates a user, a mailbox and a user_accounts link. [23 limiter; 35 payload {inviteCode, account, password}; 37 NOCTUA_DESKTOP_MODE; 40-45 IMAP pw required; 50-64 invite precheck; 72 accountIdFromEmail; 88-91 IMAP verify; 98-103 claimInviteCode; 111 first user => admin; 136-140 saveUsers/saveAccounts/saveUserAccounts (full table rewrite); 142-151 session]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/route.ts — Logged-in add mailbox. No IMAP verification. [8-13 GET getAccountsForUser; 15-41 POST (id = accountIdFromEmail, 403 if existing and not session account, ownerUserId, upsertAccount, addUserAccountLink)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/auth/me/route.ts — Session bootstrap. Blocks sessions that have no mailbox. [17-20 returns 403 if session has no accountId; 21-39 user + accounts + ttl]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/auth.ts — Session cookie model and per-account guard. [30-37 SessionData {userId, accountId, role, exp, imap?, smtp?}; 159-169 requireSessionAccountOr403 (only session.accountId allowed); 188-205 buildSessionPayload]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/_helpers/accountContext.ts — Account-scoped route guard. This is where a per-mailbox role check would go. [~38-57 requireAccountContext; 66-86 requireOwnedAccountContext; 88-97 requireAccountContextFromParams]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/users.ts — User and user_accounts persistence. [6-10 getUsers; 12-17 getUserById; 19-30 saveUsers (DELETE all + INSERT id,email,role,createdAt); 32-36 getUserAccounts; 38-52 listAccessibleAccountIdsForUser; 54-65 saveUserAccounts (DELETE all); 67-75 addUserAccountLink]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/schema.ts — SQLite schema and the column-migration pattern. [~100-110 getDbTableColumns; 112-125 ensure*Columns ALTER TABLE pattern; 591 accounts.ownerUserId; 606-611 users; 613-617 user_accounts; 619-627 invite_codes; 629-639 mcp_tokens (createdByUserId)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/secret.ts — Credential storage mode (db/cookie/both). [4 IMAP_CREDENTIALS_STORAGE (default 'both'); 22-26 assertImapSecretKeyConfigured; 37-39 shouldStorePasswordInDb]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/layout.tsx — Root Radix Theme. [28-48 <html lang=en> (no class), <Theme grayColor='sand' panelBackground='solid'> with no appearance prop]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/globals.css — Global theme tokens and settings/auth styles. [1-30 :root tokens; 32-55 .dark tokens; 76-96 .radix-themes + rt-BaseDialogOverlay z 9995 / rt-PopperContent z 9998; 129-140 .dark .app-shell overrides; 157-165 .auth-overlay z 9999; 215-221 .auth-error-floating; 1261-1300 .account-settings-modal/.settings-tabs-*]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/PasswordField.tsx — TextField with a show/hide toggle (TextField.Slot + TooltipIconButton). [1-26]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/dialogs/useConfirmDialogs.ts — Promise-based confirm dialogs (delete/full-sync/unsubscribe), rendered by DialogsHost.tsx. Not settings-related, but the pattern can be reused for revoke/reset confirms. [17-40 types; 55+ useConfirmDialogs]

## Extension points
- AccountSettingsModal.tsx:18-28 `ManageTab` and lib/accountSettings.ts:29-39 `AccountSettingsSaveTab`: add new tab ids (e.g. 'admin-users', 'mailbox-access') in BOTH, and add a case to getTabSaveSnapshot (68-119, return null for self-saving tabs). The switch has no default, so TS will flag a missing case.
- AccountSettingsModal.tsx:129-143 `tabItems`: role/permission gating of tabs (currently `if (isAdminUser) items.push({value:'admin', disabled: !isExistingAccount})`). Add a 'Members' tab gated on the mailbox role (manager) here.
- AccountSettingsModal.tsx:382-397 `<Tabs.Content value="admin">`: add callbacks like the existing `onInviteGenerated -> onNotifySuccess`, e.g. onUserCreated or onPasswordReset.
- AdminTabContent.tsx:266-284 header button group: add a 'Create user' button next to 'Generate invite code' that opens a Dialog (email, password, role admin/user), plus an 'Add shared mailbox' button.
- AdminTabContent.tsx:331-361 per-user Card: add a 'Reset password' action and a mailbox-access editor. Accounts are already listed at 342-359: add a role Select (viewer/editor/manager) per account, revoke, and 'Grant mailbox' (account Select + role Select). Extend `AdminUserDirectoryAccount` (50-55) with `role` and `AdminUserDirectoryEntry` (57-63) with e.g. `hasPassword`.
- AdminTabContent.tsx:144-187 `loadAdminData`: also load all accounts (new GET /api/admin/accounts) for the grant picker. Keep the `request = apiFetch ?? fetch` + `readError` pattern.
- app/api/admin/users/route.ts: add POST (create user, Bun.password.hash argon2id). New routes app/api/admin/users/[userId]/password/route.ts (reset), app/api/admin/users/[userId]/accounts/route.ts (grant/update role/revoke), app/api/admin/accounts/route.ts (list/create shared mailbox). All guarded by requireAdminSessionOr403 (app/api/admin/_auth.ts:5-13).
- app/api/admin/invites/route.ts:29-35 POST: hardcodes role 'user', maxUses 1, expiresAt null. Accept a body to set the role, expiry, and optional pre-granted mailboxes.
- lib/db/schema.ts:606-617: add `users.passwordHash` and `user_accounts.role` columns. Migrate existing DBs with the getDbTableColumns + ALTER TABLE pattern (schema.ts ~100-125). Default role for existing links is probably 'manager' (owner).
- lib/db/users.ts:19-30 saveUsers and 54-65 saveUserAccounts: these rewrite the whole table with a fixed column list. Extend them or add targeted helpers (setUserPassword, setUserAccountRole, removeUserAccountLink, getUserAccountRole) so new columns are not wiped.
- app/api/auth/login/route.ts:32-81: replace verifyImapCredentials with a user lookup by email + Bun.password.verify(users.passwordHash). Pick session accountId from listAccessibleAccountIdsForUser (lib/db/users.ts:38-52). With IMAP_CREDENTIALS_STORAGE=db, pass the stored account.imap.password/smtp.password into buildSessionPayload (lib/auth.ts:188-205) instead of the login password.
- app/api/auth/signup/route.ts:35-151: take a separate app `password` (hash it) and make `account` optional/decoupled. Note it currently prefers account.imap.password over payload.password (line 40).
- app/api/auth/me/route.ts:17-20: allow sessions without accountId (a user who has no mailbox yet). useAccountController.ts:142-146 treats a non-ok /me as 'unauth', which would loop back to login.
- app/api/_helpers/accountContext.ts requireAccountContext (~38-57) and lib/auth.ts:159-169 requireSessionAccountOr403: add a per-mailbox role lookup (viewer/editor/manager) here so every account-scoped REST route, and MCP via the token session, can enforce permissions.
- LoginOverlay.tsx:174-213 sign-in form: relabel 'IMAP password' as 'Password', use PasswordField with autoComplete username/current-password, change the description at 170-172. 218-280 invite dialog: add email + password + confirm fields. 68-91 submitSignup: send {inviteCode, email, password, account?}.
- useAccountController.ts:383-389 startEditAccount and 283-329 saveAccount: the logged-in add-mailbox flow (POST /api/accounts). An admin 'add shared mailbox' can reuse AccountTabContent inside a separate admin dialog that posts to a new admin endpoint and then grants access.
- MailClient.tsx:3908-3915 and 5210-5215 (theme restore/toggle, key 'noctua:theme'): replace with a ThemeProvider (e.g. next-themes, attribute='class') for the shadcn shell. Keep the `.dark` class on <html> so Radix (appearance inherit) and globals.css `.dark` stay in sync. Add a pre-hydration script in app/layout.tsx.
- McpTabContent.tsx:103-123 and app/api/accounts/[accountId]/mcp-tokens/route.ts GET: listMcpTokens(accountId) (lib/db/mcpTokens.ts:10-21) returns every user's tokens for a mailbox. For shared mailboxes, filter by createdByUserId = session.userId (mcp_tokens.createdByUserId exists, schema.ts:632).

## Gotchas
- Saving any form tab closes the whole modal. saveAccount and saveAccountSettings both call setManageOpen(false) and setEditingAccount(null) (useAccountController.ts:306-307, 353-354).
- MailClient picks the save handler from the ACTIVE tab: `onSave={manageTab === 'account' ? saveAccount : saveAccountSettings}` (MailClient.tsx:5655). saveAccount PUTs the full Account; saveAccountSettings PUTs only {settings, caldav, deepl}.
- `localAccount` is seeded once from props via useState (AccountSettingsModal.tsx:86). It works only because MailClient remounts the modal (`manageOpen && editingAccount`). Keep that remount behaviour if the modal moves into a sheet or route.
- Tabs whose snapshot is null (categorization, mcp, recipient-aliases, admin) are never dirty. They persist immediately through their own API calls. The Categorization Save button is hard-disabled (CategorizationTabContent.tsx:317).
- Every non-account tab, including Admin, is disabled when `!isExistingAccount` (AccountSettingsModal.tsx:132-141). The modal itself needs an `editingAccount`. TopBar's 'Account settings' item is disabled without a currentAccount (TopBar.tsx:500-505). So an admin with no mailbox cannot reach the Admin tab. Admin/user management should get its own entry point that does not depend on a mailbox.
- `apiFetch` is optional everywhere and tabs fall back to bare `fetch`. MailClient's apiFetch (MailClient.tsx:384-410) adds the X-Noctua-Client header that login/IMAP routes read as clientId. Bare fetch is still used by CalendarTabContent.tsx:63 (/api/calendar/test), AdminTabContent.tsx:238 (/api/desktop/storage-info) and all of LoginOverlay (no clientId is sent on login/signup).
- MailClient's `readErrorMessage` (MailClient.tsx:435-503) has side effects. A 401 with `reauthRequired` + accountId opens AccountReloginDialog. Other 401s that look like a session failure (path /api/auth/* or message 'unauthorized') set authState='unauth'. New admin/permission endpoints should return 403 (not 401) for role failures, or they will log the user out.
- Server access control is single-account. requireSessionAccountOr403 (lib/auth.ts:159-169) only allows `session.accountId`. Switching mailbox re-issues the cookie through /api/auth/switch-account (it checks listAccessibleAccountIdsForUser). Shared-mailbox visibility already works via user_accounts rows (getAccountsForUser in lib/db/accounts.ts:32-44 unions links and ownerUserId). Roles are not modelled anywhere yet.
- POST /api/accounts derives the id from the email: accountIdFromEmail = sha256 → `acc-<24hex>` (lib/accountId.ts). The same email always gives the same id. Adding an existing mailbox returns 403 unless it is the session's active account (accounts/route.ts:27-31). It then upserts (overwrites) the row. It never verifies IMAP credentials, unlike login/signup/relogin.
- DELETE /api/accounts/[id] (deleteAccountControlPlane) removes the mailbox for EVERYONE. TopBar exposes 'Delete account' to any user (TopBar.tsx:506-512). With shared mailboxes this needs manager/admin gating or 'leave/unlink' semantics.
- saveUsers, saveUserAccounts and saveAccounts all do DELETE-all + reinsert inside a transaction (lib/db/users.ts:19-30, 54-65; lib/db/accounts.ts:46-68). Signup uses all three. New columns (passwordHash, role) will be silently dropped unless these writers include them.
- IMAP_CREDENTIALS_STORAGE defaults to 'both' (lib/secret.ts:4). 'db'/'both' requires IMAP_SECRET_KEY of 32 or more characters, checked at boot (assertImapSecretKeyConfigured, called from instrumentation.ts). Decoupled login needs DB-stored IMAP creds: switch-account falls back to session creds when account.imap.password is empty (switch-account/route.ts:25-43).
- The login route reveals whether an account exists: 404 'Account not found' vs 401 'Invalid IMAP credentials' (login/route.ts:40-46). A password login should return one generic 401. It is rate-limited to 5/min/IP (429). LoginOverlay only reads `message` from JSON and has no special 429 handling.
- The first user ever created becomes admin regardless of invite role (signup/route.ts:111). In desktop mode (NOCTUA_DESKTOP_MODE=true) invites are skipped and LoginOverlay jumps straight to account setup via /api/desktop/needs-setup (LoginOverlay.tsx:102-119, 121-136).
- Signup errors appear in a fixed floating Callout (.auth-error-floating, globals.css:215-221) because AccountSettingsModal has no error slot. The modal's onInteractOutside/onEscapeKeyDown are preventDefault'ed (AccountSettingsModal.tsx:214-215), and the sign-in Dialog is `open` with no onOpenChange, so it cannot be dismissed.
- LoginOverlay has its own 32-bit-hash `accountIdFromEmail` (LoginOverlay.tsx:16-26). It is only a placeholder; the server re-derives the id with sha256. Don't rely on it.
- Dark mode: `.dark` is toggled on document.documentElement only in MailClient after mount (MailClient.tsx:3908-3915), so a light theme flashes first. There is no prefers-color-scheme fallback. Detached windows (app/message/window/page.tsx:63-65, DetachedComposeWindowClient.tsx:95-97) read localStorage 'noctua:theme' but never set the html class; they only pass `darkMode` to inner renderers. Radix Themes 3.3.0 CSS keys dark tokens off `:is(.dark, .dark-theme)`. <Theme> uses the default appearance 'inherit'. Inline styles rely on Radix CSS vars (--space-N, --gray-a5, --default-mono-font-family, --tab-height, --tab-padding-x). These disappear if Radix Themes styles are removed.
- z-index layering is hand-tuned: .rt-BaseDialogOverlay 9995, .rt-PopperContent 9998, .auth-overlay 9999 (globals.css:76-96, 157-165). shadcn/Radix-primitive portals must fit into the same stack or popovers inside dialogs will render behind them.
- OVERFLOW_TRIGGER_WIDTH=32 in OverflowTabsList.tsx:19 must stay in sync with the .settings-tabs-overflow width in globals.css:1278-1290. Widths are measured with offsetWidth because the dialog's open animation scales the modal.
- The MCP tab uses window.confirm for deletes (McpTabContent.tsx:195) and has its own readError (98-101), not the injected readErrorMessage. MCP tokens embed the creating session (userId, role, accountId) via createMcpAccessToken, so MCP tools already know which user is calling (useful for 'assigned to me').
- No component/DOM tests cover AccountSettingsModal, LoginOverlay, AdminTabContent or AccountReloginDialog. Only lib/accountSettings.test.ts and utils/accountControllerHelpers.test.ts exist. DOM tests run with `bun run test:dom` (happy-dom, bunfig.dom.toml, files named *.dom.test.tsx).

## Q&A
### 1. Describe the tab architecture (OverflowTabsList, tab content props, apiFetch injection, how save works per tab, isAdminUser gating).
Shell: AccountSettingsModal.tsx renders a Radix Themes Dialog.Root/Content (202-220; className 'account-settings-modal', size 4, 94vw/980px, height min(86vh,900px); outside-click and Esc are blocked at 214-215). Inside it is a controlled Tabs.Root (231-235): value={manageTab}, onValueChange -> onTabChange. manageTab lives in MailClient (MailClient.tsx:347, passed as onTabChange={setManageTab}). The ManageTab union is at 18-28. tabItems (129-143) is an OverflowTabItem[] of {value,label,disabled}: every tab except 'account' is disabled when !isExistingAccount, and 'admin' is pushed only if isAdminUser (141).

OverflowTabsList (account-settings/OverflowTabsList.tsx) renders Tabs.List/Tabs.Trigger with data-tab-value. It measures trigger widths (offsetWidth, 36-57), watches the list width with a ResizeObserver (60-69), re-measures after a font swap (73-83), and computes visibleCount against availableWidth minus OVERFLOW_TRIGGER_WIDTH=32 (85-100). Tabs that don't fit go into a DropdownMenu with a RadioGroup/RadioItem bound to activeValue/onSelect (113-136).

Tab content props (two families):
(a) Form tabs get editingAccount=localAccount, isExistingAccount, onClose, onSave=handleSave, canSave, plus an updater: onUpdateAccount=setLocalAccount (Account, Calendar, Translation) or onUpdateSettings=handleUpdateSettings (Signatures, Preferences, Topics). handleUpdateSettings (147-152) shallow-merges into localAccount.settings. The Account tab also gets the probe state (imapDetecting/smtpDetecting, imapProbe/smtpProbe, imapSecurity/smtpSecurity + setters, onRunProbe=runProbe -> POST /api/probe, 154-199) and onDelete.
(b) Self-saving tabs get accountId, isActive (manageTab===X, used to lazy-load), isExistingAccount, apiFetch, and sometimes readErrorMessage/onNotifySuccess-derived callbacks: Categorization, Topics (+onTopicsChanged), MCP, RecipientAliases (+onCreate/Update/DeleteAlias, onAliasesChanged), Admin (isActive, isAdminUser, accountDateFormat, onInviteGenerated, apiFetch, readErrorMessage).

apiFetch injection: MailClient's apiFetch (MailClient.tsx:384-410) adds the X-Noctua-Client header and annotates network errors. It is passed as an optional prop. The modal uses `fetchFn = apiFetch ?? fetch` (98), and each tab does `const request = apiFetch ?? fetch`. readErrorMessage (MailClient.tsx:435-503) is also injected. It has side effects (opens relogin on 401 reauthRequired, or logs out on a session 401). Tabs without it build a local fallback that reads {message|error} (AdminTabContent.tsx:130-142; McpTabContent.tsx:98-101).

Save per tab: each form tab renders its own footer. Save calls onSave -> handleSave -> props.onSave(localAccount) (100). MailClient routes that by tab: `manageTab === 'account' ? saveAccount : saveAccountSettings` (MailClient.tsx:5655).
- saveAccount (useAccountController.ts:283-329) uses buildAccountSaveRequest: POST /api/accounts for a new account (id stripped), PUT /api/accounts/[id] with the full account otherwise.
- saveAccountSettings (331-358) PUTs {settings, caldav: normalizeCaldavForSave, deepl: normalizeDeeplForSave}.
- Both re-fetch /api/accounts and close the modal.
- The enabled state is canSave = hasSavableAccountSettingsChanges(initial, local, tab, {isAdminUser}) (102-127; lib/accountSettings.ts:121-130), a JSON diff of getTabSaveSnapshot (68-119). The account tab also requires a non-empty email.
- Self-saving tabs return a null snapshot and call REST directly. Topics combines both: it calls the topic APIs directly and uses onSave for appearance.topicColorRows.

isAdminUser gating:
- Client: isAdminUser = currentUser?.role === 'admin' (MailClient.tsx:617; currentUser comes from /api/auth/me in useAccountController.ts:138-155).
- In the modal it controls the Admin tab (141), the Preferences 'Performance' (sync) section (PreferencesTabContent.tsx:144), and whether settings.sync is part of the preferences snapshot (lib/accountSettings.ts:91). AdminTabContent also checks isAdminUser before loading and clears state when it is false (144-150, 246-254).
- Server: every /api/admin route calls requireAdminSessionOr403 (app/api/admin/_auth.ts:5-13), which re-reads users.role from the DB.

### 2. What does the Admin tab do today (users directory, invites, storage info)? Which APIs does it call? Where would 'create user with password', 'grant mailbox access with role', 'reset password' fit?
Today (AdminTabContent.tsx):
- When the tab is active and the user is admin, loadAdminData (144-187) calls GET /api/admin/users and GET /api/admin/invites in parallel (both with cache:'no-store'). It validates {ok, users[]} / {ok, invites[]}.
- Header (260-285): a 'Refresh' button. 'Generate invite code' (web only) calls POST /api/admin/invites (189-213), shows the latest code with a copy button (295-317), fires onInviteGenerated (MailClient turns that into a success notice via onNotifySuccess) and reloads.
- Users card (319-366): each user shows email, role (admin|user), created date, user id, and linked accounts (name/email/account id).
- Invite codes card (380-437, web only): code + copy, Used/Unused, role, uses/maxUses, used by, created/expires.
- Desktop (Tauri) only: a Storage card (368-378) fed by a bare fetch('/api/desktop/storage-info') (236-244) showing dataDir/dbPath/attachmentsDir/sourcesDir, each with a copy button.
- Footer: Close only (441-451).

Server side:
- GET /api/admin/users (app/api/admin/users/route.ts:6-59) joins getUsers + getAccounts (sanitized) + getUserAccounts and also counts accounts.ownerUserId.
- GET /api/admin/invites (invites/route.ts:5-27) adds isUsed and usedByUserEmail.
- POST /api/admin/invites (29-35) is hardcoded to createInviteCode({role:'user', maxUses:1, expiresAt:null}).
- There are no mutation endpoints for users or links.
- DB: users(id,email,role,createdAt) and user_accounts(userId,accountId) at schema.ts:606-617; helpers in lib/db/users.ts.

Where the new features fit:
- 'Create user with password': a new button in the header group (AdminTabContent.tsx:266-284) next to 'Generate invite code'. It opens a Dialog with email, password (PasswordField), confirm, and role (admin/user). It posts to a new POST /api/admin/users (same route file), which hashes with Bun.password.hash(pw, {algorithm:'argon2id'}) into a new users.passwordHash column, then calls loadAdminData() and onNotifySuccess.
- 'Grant mailbox access with role': inside each user Card (331-361), next to the linked-accounts list (342-359). Give each linked account a role Select (viewer/editor/manager) and a revoke button, plus a 'Grant mailbox' row (account Select fed by a new GET /api/admin/accounts listing all mailboxes, + role Select). Back it with new routes such as PUT/DELETE /api/admin/users/[userId]/accounts/[accountId] that write user_accounts.role. Extend the AdminUserDirectoryAccount type (50-55) with role, and have GET /api/admin/users return it.
- 'Reset password': a button per user Card that opens a small dialog, posts to POST /api/admin/users/[userId]/password, and optionally shows a generated temp password with a copy button (reuse CopyButton/copyInviteCode).
- Optionally extend the invite POST to accept a role and pre-granted mailboxes.

Caveats:
- The Admin tab is disabled when !isExistingAccount and is only reachable from a mailbox's settings. Consider a standalone Admin dialog/page in the new shell.
- saveUsers/saveUserAccounts rewrite whole tables with fixed columns, so the new columns must be added there.

### 3. How is a new account (mailbox) added by a logged-in user (startEditAccount, saveAccount, POST /api/accounts)? How would an admin add a shared mailbox and link it to users?
Current logged-in flow:
1. TopBar account menu '+ Add account' (TopBar.tsx:515) calls startEditAccount() (useAccountController.ts:383-389).
2. That builds a blank Account via createBlankEditAccount (accountControllerHelpers.ts:112-121: placeholder id `acc-xxxxxx`, IMAP 993/TLS, SMTP 587/STARTTLS), then setEditingAccount, setManageOpen(true), setManageTab('account').
3. MailClient computes isExistingAccount=false (MailClient.tsx:5207-5209), so every other tab is disabled. The user fills in AccountTabContent (name, email, IMAP/SMTP host/port/security/user/password, optional 'Detect security' -> POST /api/probe).
4. Save calls saveAccount (useAccountController.ts:283-329). It requires an email, uses buildAccountSaveRequest(account, exists=false), and sends POST /api/accounts with the body minus the id.
5. Server (app/api/accounts/route.ts:15-41):
   - requireSessionOr401; 400 if no email.
   - id = accountIdFromEmail(email) (sha256 -> acc-<24hex>).
   - If that id already exists, requireSessionAccountOr403 means only the session's active account may be overwritten (else 403).
   - accountToSave keeps the existing ownerUserId or uses session.userId; then upsertAccount and addUserAccountLink(session.userId, id).
   - Returns 201 {id}. There is NO IMAP verification.
6. Client: GET /api/accounts, close the modal, switchAccount(newId) (POST /api/auth/switch-account re-issues the session cookie with that accountId, checked against listAccessibleAccountIdsForUser), refreshFolders(newId), then runSyncJob({fullSync:true, mode:'full'}).

Visibility model: GET /api/accounts -> getAccountsForUser (lib/db/accounts.ts:32-44) returns accounts where user_accounts.userId = me OR ownerUserId = me. So linking a user to a mailbox only needs a user_accounts row.

Admin shared mailbox (suggested):
- Add an admin-only endpoint, e.g. POST /api/admin/accounts (guarded by requireAdminSessionOr403). It reuses accountIdFromEmail + verifyImapCredentials (lib/mail/imapAuth) + upsertAccount, with ownerUserId null (or the admin), and stores IMAP/SMTP passwords encrypted in the DB (requires IMAP_CREDENTIALS_STORAGE=db or both, and IMAP_SECRET_KEY >= 32 chars).
- Then add user_accounts rows {userId, accountId, role} through a grant endpoint. Users see it immediately in /api/accounts and can switch to it. switch-account uses the stored account.imap.password (switch-account/route.ts:25-27), so DB storage is required for shared mailboxes.
- UI: reuse AccountTabContent (it is fully controlled; it needs its probe props, so lift runProbe out of AccountSettingsModal.tsx:154-199 into a hook) inside an admin 'Add shared mailbox' dialog in the Admin tab, followed by a 'Grant to users' multi-select with role. Alternatively, reuse startEditAccount + saveAccount and then call the grant API, but saveAccount auto-links the creating admin and switches the session to the new mailbox.
- Server enforcement: add a role lookup to requireAccountContext (app/api/_helpers/accountContext.ts ~38-57). Gate DELETE /api/accounts/[id] (deletes for everyone), PUT credentials, relogin, and MCP token creation by role. Today any user linked to a mailbox can delete it (TopBar.tsx:506-512).

### 4. What does LoginOverlay need to change for password login (fields, error handling, signup flow with invite code + password)?
Current state (LoginOverlay.tsx):
- The sign-in Dialog (164-216) has Email (TextField type=email) and 'IMAP password' (plain TextField type=password), with the description 'Use your IMAP credentials to access mail.' (170-172).
- submitLogin (44-66) uses bare fetch POST /api/auth/login with {email,password} and credentials:'include'.
- On !ok it shows the JSON `message` or 'Login failed' in a red Callout (198-202). Network failures show 'Network error'. On success it calls onAuthenticated(), which in MailClient (5217-~5250) resets state and calls loadInitialData.
- The server (login/route.ts) finds an account by email / imap.user / linked user, verifies the password against IMAP, stores it in the DB if DB storage is on, and builds the session with imapPass=smtpPass=password.
- Status codes: 400 Missing credentials, 404 Account not found, 401 Invalid IMAP credentials, 429 rate limited.

Changes needed:
- Fields: label 'Password' (app password). Use PasswordField (app/components/PasswordField.tsx) with autoComplete='username' / 'current-password'. Update the description. Optionally use apiFetch-style X-Noctua-Client headers (bare fetch currently sends no clientId).
- Server: look up the user by email and use Bun.password.verify against users.passwordHash. Return one generic 401 'Invalid email or password' instead of 404/401 variants. Choose session accountId from listAccessibleAccountIdsForUser (it may be none), and use DB-stored IMAP/SMTP passwords for the session creds (buildSessionPayload, lib/auth.ts:188-205).
- Error handling: handle 429 ('Too many login attempts') explicitly. Handle the 'logged in but no mailbox' case: /api/auth/me currently returns 403 when the session has no accountId (me/route.ts:17-20), and useAccountController.ts:142-146 treats that as unauth, which loops back to the login screen. Allow an accountId-less session and render an empty or 'ask your admin' state. Also handle a missing password hash for legacy users: either keep an IMAP fallback or tell them to ask the admin to reset.
- Signup: today 'Got an invite code?' (204-206) opens the invite dialog (218-280; invite code only). openSignupModal (141-159) then pre-fills an Account and renders a full AccountSettingsModal (282-304, no apiFetch, no isAdminUser). Its onSave=submitSignup (68-91) posts {inviteCode, account, password: account.imap.password || account.smtp.password || password}. The server (signup/route.ts) requires and verifies the IMAP password and uses it as the identity. Errors show in the floating `.auth-error-floating` Callout (284-290).
- New flow: the invite dialog collects invite code + email + password + confirm password (validate match/length on the client). Make the mailbox step optional, or a second step that reuses AccountTabContent. submitSignup sends {inviteCode, email, password, account?}. The server validates the invite (unchanged precheck/claim, 50-64 / 98-103), hashes the password (argon2id), creates the user (first user => admin, line 111), and creates and links the account only if one was provided (verify IMAP then). It must not pass the app password as IMAP creds.
- Keep desktop mode (NOCTUA_DESKTOP_MODE / /api/desktop/needs-setup, 102-136): it skips the invite. Decide whether desktop users need an app password at all.
- Remove or ignore the client-side accountIdFromEmail (16-26); the server derives ids.

### 5. How is the dark mode toggle implemented (class .dark on html? localStorage key?) and how does Radix Theme appearance get set? Cite code.
Yes, it is a `.dark` class on <html>, saved in localStorage key 'noctua:theme' ('dark' | 'light').
- State: `const [darkMode, setDarkMode] = useState(false)` (MailClient.tsx:345).
- Restore on mount (MailClient.tsx:3908-3915): `const stored = localStorage.getItem("noctua:theme"); if (stored) { const isDark = stored === "dark"; setDarkMode(isDark); document.documentElement.classList.toggle("dark", isDark); }`.
- Toggle (MailClient.tsx:5210-5215): `handleToggleDarkMode = () => { const next = !darkMode; setDarkMode(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("noctua:theme", next ? "dark" : "light"); }`. It is passed to TopBar as toggleDarkMode with darkMode in state (MailClient.tsx:5288); the button is at TopBar.tsx:525-535 (Sun/Moon icon).
- darkMode is also passed to ComposeOrchestrator (MailClient.tsx:5722) and the message renderers.

Radix appearance:
- app/layout.tsx:33-45 renders `<Theme grayColor="sand" panelBackground="solid" style={{--color-background: var(--sand-2), --color-panel-solid: var(--sand-3), --color-surface: var(--sand-2)}}>` with NO appearance prop. Radix Themes 3.3.0 defaults appearance to 'inherit' (node_modules/@radix-ui/themes/dist/esm/components/theme.props.js).
- Its stylesheet switches dark tokens on `:is(.dark, .dark-theme)` ancestors, so the html.dark class flips Radix tokens.
- App-level tokens: :root (globals.css:1-30, color-scheme light) and .dark (globals.css:32-55, color-scheme dark), plus `.dark ...` overrides (e.g. 129-140, 390-420, 456).

Caveats:
- The class is applied only after hydration, so light flashes first; there is no inline script.
- There is no prefers-color-scheme fallback.
- <html lang="en"> has no suppressHydrationWarning (only <body> does).
- Detached windows (app/message/window/page.tsx:63-65, DetachedComposeWindowClient.tsx:95-97) read 'noctua:theme' into darkMode but never add the html class, so their Radix chrome stays light.
- The effect runs even in the unauthenticated branch, because hooks run before the `if (authState === "unauth")` return at 5217. LoginOverlay therefore gets dark mode after mount.

### 6. List all Radix Themes components used across app/components/account-settings/** and the login overlay (for the shadcn migration).
Per file (all from '@radix-ui/themes'):
- AccountSettingsModal.tsx: Dialog (Root, Content, Title), Flex, Tabs (Root, Content).
- account-settings/OverflowTabsList.tsx: Tabs (List, Trigger), DropdownMenu (Root, Trigger, Content, RadioGroup, RadioItem).
- account-settings/Field.tsx: Flex, Text.
- account-settings/MailtoHandlerSection.tsx: Button, Flex, Text.
- tabs/AccountTabContent.tsx: Button, Flex, Grid, Select (Root, Trigger, Content, Item), Text, TextField.Root.
- tabs/AdminTabContent.tsx: Button, Card, Flex, Text.
- tabs/CalendarTabContent.tsx: Badge, Button, Callout, Flex, Grid, Select, Text, TextField.
- tabs/CategorizationTabContent.tsx: Button, Card, Flex, Grid, Text.
- tabs/ImportReplaceConfirmDialog.tsx: AlertDialog, Button, Flex (plus mailclient/message/AlertDialogContent.tsx, which wraps AlertDialog).
- tabs/McpTabContent.tsx: Badge, Button, Card, Flex, Select, Text, TextField.
- tabs/PreferencesTabContent.tsx: Button, Flex, Grid, Select, Switch, Text, TextField.
- tabs/RecipientAliasesTabContent.tsx: Button, Flex, Text (plus mailclient/RecipientAliasManager.tsx: Button, Card, Flex, Text, TextArea, TextField).
- tabs/SignaturesTabContent.tsx: Button, Card, Flex, Grid, Select, Text, TextArea, TextField.
- tabs/TopicsTabContent.tsx: Badge, Button, Card, Flex, Switch, Text, TextField (TopicColorPicker uses no Radix, only a CSS module).
- tabs/TranslationTabContent.tsx: Badge, Button, Callout, Flex, Select, Switch, Text.
- auth/LoginOverlay.tsx: Button, Callout (Root, Text), Dialog (Root, Content, Title, Description), Flex, Text, TextField.Root.
- Shared helpers used by these: PasswordField.tsx uses TextField (Root, Slot); TooltipIconButton.tsx uses IconButton and Tooltip. AccountReloginDialog.tsx uses Button, Callout, Dialog, Flex, Text, TextField (plus Field and PasswordField).

Unique set to replace: AlertDialog, Badge, Button, Callout, Card, Dialog, DropdownMenu, Flex, Grid, IconButton, Select, Switch, Tabs, Text, TextArea, TextField (incl. Slot), Tooltip.

Also coupled to Radix Themes:
- Inline CSS vars: --space-1..4, --gray-a5/--gray-a11/--gray-12, --red-a6, --default-mono-font-family, --tab-height, --tab-padding-x.
- Radix prop styling: size/variant/color/weight props, Grid columns responsive objects {initial, sm}.
- globals.css overrides of .rt-BaseDialogOverlay (z 9995), .rt-PopperContent (z 9998), and .rt-Button/.rt-IconButton.rt-variant-surface in .app-shell.



# AREA: css-layout-responsive

## Summary
Styling has three layers. (1) Radix Themes 3.3.0 (`@radix-ui/themes/styles.css`, imported unlayered in app/layout.tsx:7) supplies the component styles and the color, space and radius scales. (2) One large unlayered app/globals.css (1495 lines, imported at layout.tsx:8) holds the legacy tokens (--bg/--surface/--text/--muted/--border/--accent/... on :root and .dark), the app shell (.app-shell grid, .content-grid flex, .pane, .resizer, .bottom-bar), and many semantic global classes (notices, popovers, markdown-view, attachments, modals). (3) About 45 CSS Modules co-located with components; these mostly use the Radix scales (--gray-N, --accent-N, --space-N), plus some legacy vars and `:global(.dark)` / `:global(.rt-*)` overrides. Tailwind, PostCSS config, next/font and @font-face are all absent. The root layout wraps everything in <Theme grayColor="sand" panelBackground="solid"> and overrides --color-background/--color-panel-solid/--color-surface inline. Dark mode is a `.dark` class on <html>, toggled in MailClient.tsx (localStorage key "noctua:theme"). Radix follows it through its `:is(.dark,.dark-theme)` selectors. The desktop shell is `.app-shell`, a 3-row grid: TopBar / section.content-grid / BottomStatusBar. content-grid is a horizontal flex row: folder pane (inline width leftWidth=270) | resizer | list pane (inline width listWidth=840) | resizer | message view (flex:1), plus an optional fixed 400px calendar sidebar. Pane widths live only in React state: they are not persisted, have only minimum clamps (140/200), and drive JS 'narrow' modes (listWidth<360, <720). Responsiveness is minimal: four width media queries (1260/900/860/760). At ≤900px the content grid just flips to column and hides the resizers, while the inline pixel widths stay, so the app is unusable on phones. The detached windows (compose/message/calendar) are separate App Router pages under the same root layout and Theme. They share globals.css but not the shell, and they never apply the `.dark` class.

## Key files
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/globals.css — Global token definitions, app shell layout, semantic global classes, Radix overrides [1-54 tokens(:root/.dark); 56-116 base resets (button nowrap 99-101, main 100vh 104-107); 86-97 .rt-BaseDialogOverlay/.rt-PopperContent z-index; 118-140 .rt-Button/.rt-IconButton surface overrides; 142-155 .app-shell; 157-221 auth-* (mostly dead); 255-434 in-app notices (+@media 860 at 422); 436-459 .content-grid/.pane; 507-572 .markdown-view; 720-734 quote levels; 750-763 @media 900; 765-796 keyframes; 799-899 .bottom-bar; 901-1210 popovers/reminders; 1212-1259 .modal-backdrop/.detached-compose-*/.modal; 1415-1431 .resizer; 1482-1495 .drag-ghost]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/layout.tsx — Root layout: imports Radix styles then globals.css; <Theme grayColor=sand panelBackground=solid> with inline --color-background/--color-panel-solid/--color-surface overrides; <main>; viewport themeColor only; no next/font [1-49]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/MailClient.tsx — Owns all layout state and renders the shell (5966 lines) [351-355 width/drag/calendar state; 683 listIsNarrow; 3908-3915 theme restore; 4666-4704 notice offset ResizeObserver; 4821-4843 resizer drag effect; 5210-5215 toggle dark; 5278 .app-shell; 5348-5645 content-grid children; 5391-5397 & 5550-5556 resizers; 5631-5644 calendar sidebar; 5933 BottomStatusBar]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/folder/FolderPane.tsx — Folder sidebar pane; virtual folders section [57 (aside.pane style width:leftWidth); 58-80 virtual folder rows]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/MessageListPane.tsx — List pane scroll container (listPaneRef, infinite scroll) [19 (aside style width:listWidth)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/MessageViewPane.tsx — View pane: toolbar (shortcut hints), threadHeader slot, threadViewShell/threadView scroller, link preview overlay; reused by detached message window [30-70]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/TopBar.module.css — Header styling; only file with real layout breakpoints [1-10 topBar; 64-96 search (min-width 200px); 102-104 select min 160; 148-152 filterButton; 187-231 account button/menu; 274-290 @media 1260; 292-337 @media 900]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/MessageListPane.module.css — List pane padding/border/bg (gray-1, dark gray-2), flex-shrink 0, overflow-y auto [1-12]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/MessageViewPane.module.css — View pane flex column, toolbar/threadHeader gray-2, threadView gray-1, :global(.dark) variants [1-124]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/folder/FolderTree.module.css — Folder tree rows, virtual folder styling, hover-revealed actions [1-7 pane bg; 34-46 virtualRow; 100-131 treeRow; 170-210 hover-only treeActions; 248-268 :global(.rt-BaseMenu*)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/composition/Compose.module.css — Compose modal/inline/minimized styling (kept component) [1-15 composeModal 980x820; 121-133 composeGridRow 84px label; 146-158 :global(.rt-TextField*); 200-216 composeMinimized fixed; 405-426 composeResizer]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/MessageTable.module.css — Table list view (fixed-width columns) [8-27 grid cols minmax(44px,auto) 1.5fr 2.4fr 138px auto, height 44px]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/MessageThreadList.module.css — Thread list rows; place for assignee/status cells [45-48 hover; 308-372 cellFrom min 140/max 200, cellDate min 80, cellSize min 68, cellActions]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/messagelist/MessageRow.module.css — Card-row list item styling [58-130 active/selected/hover using --list-row-* vars]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/message/ThreadMessageCard.module.css — Message card in thread view (kept); heavy Radix scale usage (28 scale + 45 space/radius refs) [1-110 card header; 282-322 :global(.rt-Button/.rt-IconButton/.rt-BaseTabListTriggerInner)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/status/BottomStatusBar.tsx — Bottom status bar (.bottom-bar) with process/mail-check/calendar/exception/upcoming popovers [121-167]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/calendar/CalendarPopover.tsx — Floating draggable/resizable calendar panel (fixed z 9990) [37-40 PANEL 860x660, MIN 480x360; 356 .bottom-center-time trigger; 365 createPortal into .radix-themes]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/calendar/CalendarSidebarPanel.module.css — Calendar sidebar panel (surface/border/surface-2) [1-23]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/calendar/fullcalendar-theme.css — Maps FullCalendar --fc-* vars to legacy (--border/--muted/--surface/--text/--accent) and Radix scales; imported by CalendarView.tsx:29 [1-34]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/HtmlMessage.tsx — Email HTML rendered in iframe (isolated from global CSS/preflight) [382-421 (hardcoded #1847d5/#b8d5ff link/quote colors, Sora font inside iframe srcdoc); 427-533 iframe]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/compose/window/page.tsx — Detached compose window page [76-101; page.module.css 1-15]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/message/window/page.tsx — Detached message window page [63-65 darkMode from localStorage; 345-358 MessageViewPane hideToolbar + ThreadView; page.module.css 1-15]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/calendar/window/page.tsx — Detached calendar window page [54-62; page.module.css 1-22]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/mailclient/composition/DetachedComposeWindowClient.tsx — Detached compose client using global detached-compose classes [95-104 darkMode; 397 .detached-compose-shell; 486 .detached-compose-card-slot; 501 .detached-compose-state]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/ui/openDetachedWindow.ts — window.open / Tauri webview popup opener [35-48 default size min 760x620]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/node_modules/@radix-ui/themes/styles.css — Reference for where Radix vars are scoped (unlayered, no @layer) [1 :root color scales; 1621 .dark scales; 3339/3385-3400 --color-background etc; 3444-3483 .radix-themes focus/background/panel; 3785 [data-accent-color='indigo'] --accent-N; 4415-4520 .radix-themes (--space-N, --default-font-family 4465, font-family 4517); 4561-4574 --radius-N; 4777-4860 .rt-reset]

## Extension points
- app/layout.tsx:7-8 (CSS imports): add the Tailwind v4 entry here and choose the layer order. Suggested: in globals.css `@layer theme, base, radix, legacy, components, utilities; @import "tailwindcss"; @import "@radix-ui/themes/styles.css" layer(radix);` and drop the separate Radix import from layout.tsx.
- app/layout.tsx:28-45 (<html>/<Theme>): add next-themes ThemeProvider (attribute="class", storageKey="noctua:theme", which matches the existing 'dark'/'light' values) and `suppressHydrationWarning` on <html>. Move the inline --color-background/--color-panel-solid/--color-surface overrides (layout.tsx:36-41) into CSS that maps them to the shadcn tokens. Add next/font here and expose it as a CSS variable on <html>.
- app/globals.css:1-54 (:root/.dark legacy tokens): replace with a shadcn token block plus a legacy alias block (mapping in answer 3) so kept components inherit the theme.
- app/components/MailClient.tsx:5278-5645 (.app-shell / .content-grid JSX): this is the seam for the new responsive AppShell. FolderSidebarPane (5349), MessageListOrchestrator (5399) and MessageViewOrchestrator (5558) are already self-contained slots. The calendar sidebar slot (5631-5644) can become a right-side panel for comments/activity.
- app/components/MailClient.tsx:351-355 + 4821-4843 + 5391-5397/5550-5556 (leftWidth/listWidth/dragging): replace with a resizable-panels component (shadcn Resizable / react-resizable-panels with autoSaveId persistence). Also remove the inline widths in FolderPane.tsx:57 and MessageListPane.tsx:19.
- app/components/MailClient.tsx:683 (listIsNarrow = listWidth<360) and messagelist/MessageListHeader.tsx:149 (collapseViewSwitcher = listWidth<720): feed these from a measured pane width (ResizeObserver) or use CSS container queries once the pane width is no longer state.
- app/components/MailClient.tsx:3908-3915 and 5210-5215 (theme restore/toggle) + TopBar actions.toggleDarkMode: replace with next-themes useTheme.
- app/components/mailclient/folder/FolderPane.tsx:58-80 (virtualFolders rows, prop virtualFoldersForPane from MailClient.tsx:5352) + FolderTree.module.css:34-46 (.virtualRow): render 'Assigned to me' / 'Unassigned' / 'Open' here.
- MailClient.tsx ~5470-5490 listViewHelpers (renderFolderBadges, renderSelectIndicators, renderQuickActions) and the row CSS in MessageRow.module.css / MessageThreadList.module.css:308-382 / MessageTable.module.css:8-27 (fixed grid columns): add assignee/status chips to list rows here.
- MailClient.tsx:5566-5571 MessageViewOrchestrator `header` prop -> MessageViewPane.tsx:56 `.threadHeader` (MessageViewPane.module.css:63-71): put the thread status/assignee controls here.
- app/components/mailclient/status/BottomStatusBar.tsx:121 (.bottom-bar, globals.css:799-899): collapse or hide this on mobile.
- app/compose/window/page.tsx, app/message/window/page.tsx, app/calendar/window/page.tsx + their page.module.css: these get dark mode automatically once the ThemeProvider sits in the root layout.
- CalendarPopover.tsx:365 shows the existing pattern of portaling into `document.querySelector('.radix-themes')`. Reuse it as the `container` for shadcn portals that host kept components.

## Gotchas
- CSS cascade layers: Radix Themes styles.css, globals.css and every CSS module are UNLAYERED. Tailwind v4 puts preflight and utilities in @layer base/utilities, so any unlayered rule beats every Tailwind utility regardless of specificity. Example: `whitespace-normal` on a <button> loses to globals.css:99 `button{white-space:nowrap}`, and `px-2` on a Radix <Button> loses to .rt-Button. Fix by importing Radix with layer(radix) and wrapping legacy globals in a layer, or never put Tailwind utilities on Radix- or legacy-styled elements.
- Name collisions with shadcn: legacy `--muted` is a TEXT color (#5d5b55, 21 uses), but shadcn `--muted` is a BACKGROUND. Legacy `--accent` is the strong brand/link blue (#1847d5, 18 uses including lexical/ImageNode.tsx inline), but shadcn `--accent` is a subtle hover background. `--border` collides too, but the meaning matches. Rename the legacy vars first (codemod var(--muted)->var(--muted-foreground) and var(--accent)->var(--primary) or a new --link) in globals.css, Compose.module.css, fullcalendar-theme.css, MessageViewPane.module.css, ComposeEditor.module.css, QuotedMessageNode.module.css, InReplyToReferenceRow.module.css, ThreadMessageCard.module.css and ImageNode.tsx.
- Collisions with Tailwind v4's default theme: legacy `--radius-sm/md/lg` are all 4px (49 uses) and sit in Tailwind's --radius-* namespace. The unlayered legacy :root values win over Tailwind's @layer theme values, so rounded-sm/md/lg would all be 4px. `--font-sans` gets defined by Tailwind, so the body fallback `var(--font-sans,"Sora")` (globals.css:71) stops applying. `--default-font-family` is defined by both Tailwind and Radix (Radix wins inside .radix-themes). Radix defines `--color-background/--color-surface/--color-panel/--color-panel-solid/--color-panel-translucent/--color-overlay/--color-transparent`, so shadcn color mappings must use `@theme inline`, otherwise bg-background/bg-popover resolve to Radix's values.
- Radix vars are SCOPED, not global. `--accent-1..12`, `--accent-a*` and `--focus-*` exist only on [data-accent-color] elements (styles.css:3444, 3785). `--space-N`, `--radius-N`, `--scaling` and `--default-font-family` exist only on .radix-themes (4415+). `--gray-N` at :root is the neutral gray scale; it is remapped to sand only inside the Theme div. `--sand-N`/`--indigo-N`/`--red-N` ARE defined at :root and flip under .dark (styles.css:1, 1621). Any :root token must therefore reference --sand-N/--indigo-N, never --gray-N/--accent-N/--space-N.
- Likely existing bug from that scoping: globals.css:15-17 and 42-44 define `--list-row-active-bg/--list-row-active-border/--list-row-focus-ring` on :root/.dark using var(--accent-*), which is undefined at <html>. They therefore compute to guaranteed-invalid and inherit as such. `--list-row-hover-bg: var(--gray-3)` resolves to neutral gray, not sand. Check in devtools. Redefining them over :root-scoped shadcn tokens fixes this.
- Legacy `--accent-2` (yellow, used in globals.css:565, 727 for level-2 quotes) is shadowed inside the Theme by Radix `[data-accent-color='indigo']{--accent-2:var(--indigo-2)}`, so level-2 quotes currently render in pale indigo. Rename it (e.g. --quote-2). `--accent-2-strong/-bg/-border` have 0 uses. `--surface-1` is used 3 times (globals.css:602, 624, 1488) but never defined.
- Portals: shadcn components (Radix primitives) portal to document.body, outside `.radix-themes`, so they lose --space-N, --accent-N, sand --gray-N, --radius-N and the Radix font. Kept components (message cards, compose, calendar) mounted in a shadcn Sheet/Dialog on mobile will break unless the portal container is `.radix-themes` (pattern at CalendarPopover.tsx:365) or the content is wrapped in <Theme>.
- z-index ladder: Radix dialog overlay 9995 and poppers 9998 (globals.css:86-97), calendar floating panel 9990, auth overlay 9999, ComposeImageDropMenu 1000/1001, in-app notices 60, inline compose suggestions 50, compose minimized 40, .modal-backdrop 10. shadcn defaults (z-50) render BELOW Radix overlays and the calendar panel.
- `.app-shell` runs `animation: floatIn ... forwards` (globals.css:154, keyframes 765-774), which leaves a non-none `transform` on it. That makes .app-shell the containing block and stacking context for its position:fixed descendants (InAppNoticeStack, ComposeModal .modal-backdrop, ComposeMinimized). CalendarPopover escapes by portaling into .radix-themes.
- The .app-shell grid `auto 1fr auto` (globals.css:151) assumes exactly 3 in-flow children: TopBar, section.content-grid, BottomStatusBar (MailClient.tsx:5279, 5348, 5933). Every other child is a portal or position:fixed. Adding an in-flow element breaks the rows.
- Theme bootstrap: `.dark` is applied in a useEffect after hydration (MailClient.tsx:3908-3915), so dark users see a light flash. prefers-color-scheme is not supported. `suppressHydrationWarning` is on <body>, not <html>. Detached windows never add `.dark` to <html> (they only pass darkMode into email/editor rendering), so their chrome is always light.
- Pane widths are not persisted: no localStorage key, and they reset to 270/840 on reload. The only UI localStorage keys are noctua:theme, noctuaClientId, noctua:lastNotifiedUid:<id>, the topic-suggestion collapsed key, the calendar view key and session date (CalendarView.tsx:102-110), recent move folders, and the DeepL target language. The calendar sidebar width is a constant 400 (useState with no setter, MailClient.tsx:355).
- Responsive behaviour is JS-width-driven, not viewport-driven: listIsNarrow (listWidth<360, MailClient.tsx:683) and collapseViewSwitcher (listWidth<720, MessageListHeader.tsx:149) read React state. syncNoticePaneRightOffset (MailClient.tsx:4666-4704) positions notices from the list pane's bounding rect.
- Emails render in an iframe srcdoc (HtmlMessage.tsx:427-533), so Tailwind preflight cannot affect email HTML. Link and quote colors are hardcoded there (HtmlMessage.tsx:390-391: #1847d5/#b8d5ff, duplicating --accent) and the iframe font is 'Sora'. These will not follow new tokens unless passed in explicitly.
- Dead global CSS: .auth-overlay/.auth-modal/.auth-form/.auth-grid/.auth-header/.auth-close (globals.css:157-205) are unused. LoginOverlay uses Radix Dialog; only .auth-error-floating is used (LoginOverlay.tsx:285). This matters for the new login page (feature A).
- The body radial-gradient background (globals.css:67-69) is never visible: the Theme root paints --color-background (sand-2 via layout.tsx:38) and .app-shell paints --surface.
- AGENTS.md conventions: 'Styling is in app/globals.css with semantic class names', 'Keep UI state in app/components/MailClient.tsx', avoid duplicate code and hacks. A Tailwind/shadcn migration departs from the first rule and should be stated explicitly.

## Q&A
### 1. Describe the layout system: grid/flex structure of .app-shell, the three panes, resizers, widths persisted where, min/max constraints, the bottom status bar, the calendar sidebar.
Root: app/layout.tsx renders body > <Theme> (div.radix-themes, min-height 100%, globals.css:76-78) > <main> (height 100vh, globals.css:104-107). body has overflow:hidden (globals.css:73).

.app-shell (globals.css:142-155; rendered at MailClient.tsx:5278): `display:grid; grid-template-rows:auto 1fr auto; height:100vh; overflow:hidden; border:1px solid var(--border); background:var(--surface); box-shadow:var(--shadow)`, plus the floatIn animation. In-flow children: row 1 TopBar (TopBar.module.css .topBar, flex, padding var(--space-4), gradient gray-4 to gray-2); row 2 section.content-grid (MailClient.tsx:5348, ref containerRef); row 3 BottomStatusBar (MailClient.tsx:5933). Everything else in the shell is a portal or fixed: InAppNoticeStack, DialogsHost, ComposeOrchestrator, ThreadJsonModal, MoveToDialog, CopyToAccountDialog, BulkActionContextMenu, AccountSettingsModal, the relogin and alias dialogs.

.content-grid (globals.css:436-441) is a horizontal flex row with min-height:0, height:100% and overflow:hidden. Children in order:
(a) FolderSidebarPane -> FolderPane `<aside className="pane ..." style={{width:leftWidth}}>` (FolderPane.tsx:57). Global .pane (globals.css:443-459): padding 18px 10px, border-right gray-4, flex-shrink 0, overflow-y scroll, scrollbar-gutter stable. Module bg gray-1, dark gray-2 (FolderTree.module.css:1-7).
(b) div.resizer (MailClient.tsx:5391-5397).
(c) MessageListOrchestrator -> MessageListPane `<aside style={{width:listWidth}} ref={listPaneRef}>` (MessageListPane.tsx:19; MessageListPane.module.css:1-12: padding 18px 10px, border-right gray-5, flex-shrink 0, overflow-y auto). This aside is the list's scroll container.
(d) div.resizer (5550-5556).
(e) MessageViewOrchestrator -> MessageViewPane section (MessageViewPane.module.css:1-7: flex column, flex:1, min-width 0) containing an optional .toolbar with shortcut hints, the .threadHeader slot, and .threadViewShell > .threadView as the scroller (padding space-4, bg gray-1).
(f) Optional calendar sidebar (MailClient.tsx:5631-5644, shown when calendarSidebarOpen && activeAccountId): a non-interactive resizer (`cursor:default; pointerEvents:none`) plus a div with inline `width: calendarSidebarWidth (400), flexShrink 0, flex column, overflow hidden` wrapping CalendarSidebarPanel (CalendarSidebarPanel.module.css: surface bg, border-left, surface-2 header). It opens from the bottom bar or the upcoming popover (onOpenCalendarSidebar, MailClient.tsx:5957) and closes with its own close button. There is also a separate floating calendar panel: CalendarPopover, portaled into .radix-themes (CalendarPopover.tsx:365), position:fixed z 9990, default 860x660, min 480x360, draggable header, 8 resize handles (CalendarPopover.module.css:1-60).

Resizers: .resizer (globals.css:1415-1431) is 6px wide with cursor col-resize and a 2px ::after line in var(--border). onPointerDown sets `dragging` to 'left' or 'list'. The effect at MailClient.tsx:4821-4843 attaches window pointermove/pointerup and computes x relative to containerRef: left = max(140, x); list = max(200, x - leftWidth - 6). There is no max clamp (panes can push the view pane to 0 or overflow), no pointer capture, no keyboard support and no double-click reset.

State: useState(270) / useState(840) at MailClient.tsx:351-352. Widths are NOT persisted anywhere (no localStorage or DB key) and reset on reload. listWidth also drives listIsNarrow (<360, MailClient.tsx:683) and the list header's collapseViewSwitcher (<720, MessageListHeader.tsx:149).

Bottom status bar: BottomStatusBar.tsx:121 renders div.bottom-bar (globals.css:799-811): flex, space-between, padding 6px 14px, min-height 32px, border-top, bg --surface-2, 11px muted text. It contains ProcessStatusPopover, a 'Mail check' BottomStatusSection, the CalendarPopover trigger (rendered as .bottom-center-time, absolutely centered at left 50%, globals.css:875-885), ExceptionStatusPopover and UpcomingStatusPopover. Sections use .bottom-section/.bottom-right (margin-left auto)/.bottom-wide (flex 1 1 320px, max 460px) (BottomStatusSection.tsx:20-28). Popovers use .bottom-popover (z 6), plus -reminders (min(560px,100vw-24px)) and -process (min(460px,100vw-24px)).

### 2. What existing @media rules exist and what do they do? What breaks on a 390px wide phone?
All @media rules in app CSS:
- globals.css:422-434 `(max-width:860px)`: re-centers the .inapp-notice-stack and sets bottom 40px.
- globals.css:750-763 `(max-width:900px)`: .content-grid gets flex-direction column; .pane drops border-right and gains border-bottom; .resizer is display:none.
- TopBar.module.css:274-290 `(max-width:1260px)`: the top bar wraps and search moves to its own full-width row (order 3).
- TopBar.module.css:292-337 `(max-width:900px)`: smaller padding; search becomes a column; filters wrap; .select flex 1 1 170px; filter buttons flex; action and account groups go width 100%, right-aligned.
- MessageListHeader.module.css:76-82 `(max-width:760px)`: only align-items:flex-start on the info/actions rows.
- ThreadMessageCard.module.css:596 `prefers-reduced-motion`.
There is no prefers-color-scheme rule, no hover/pointer media query and no container queries.

Problems inferred on a 390px phone:
1) Inline pixel widths survive the 900px rule: the folder pane is 270px (FolderPane.tsx:57), the list pane 840px (MessageListPane.tsx:19) and the calendar sidebar 400px (MailClient.tsx:5634). In column mode the list pane is 840px wide inside a 390px viewport and gets clipped, because .content-grid, .app-shell and body all have overflow:hidden. There is no horizontal scroll.
2) In column mode the panes have flex-shrink:0 (globals.css:447, MessageListPane.module.css:5) and no height limit, so the folder pane and list pane take their full content height. The message view (flex:1, min-height 0) is squeezed to nothing and is unreachable. There is no single-pane navigation.
3) JS 'narrow' modes key off pane state, not the viewport: listWidth stays 840, so listIsNarrow is false and the wide header and view switcher render.
4) 100vh on main, .app-shell and the detached .page elements: on iOS Safari the bottom bar ends up behind the browser UI. Use 100dvh.
5) TopBar stacks into brand + full-width action group + account group + a column search with wrapping filters, roughly 200px+ tall. .searchInput has min-width 200px (TopBar.module.css:92), .accountMenu min-width 260px, account meta max 220px. There is no hamburger or drawer.
6) Global `button{white-space:nowrap}` (globals.css:99-101): button labels never wrap, so long labels overflow (compose actions, list header buttons, dialog footers).
7) Fixed list columns: MessageTable grid `minmax(44px,auto) 1.5fr 2.4fr 138px auto` with fixed 44px row height (MessageTable.module.css:9,25). MessageThreadList .cellFrom has min 140px, .cellDate min 80px, .cellSize min 68px (MessageThreadList.module.css:309,358,366). MessageListHeader triggers have min-widths of 160/118/170/108px, and .meta is nowrap.
8) Hover-only affordances: folder .treeActions are opacity 0 / visibility hidden unless hovered, active or menu-open (FolderTree.module.css:170-210). .reminder-delete-btn is opacity 0 until hover (globals.css:1061-1069). FromAddressHoverCard is a Radix HoverCard with no tap equivalent (used by MessageRow, MessageThreadList and MessageTable). The attachment image preview and the link preview overlay are hover-driven. Keyboard shortcut hints sit in the view toolbar (MessageViewPane.tsx:33-38).
9) Drag/drop: message rows use HTML5 `draggable` (MessageRow.tsx:316, MessageThreadList.tsx:284, MessageTable.tsx:344, MessageCardList.tsx:339) onto folder drop targets (FolderTreeNode.tsx:147, useMessageDragDrop.ts). Touch browsers mostly do not fire HTML5 DnD, so moving needs MoveToDialog or the menus. The resizers use pointer events but are hidden at ≤900px. BulkActionContextMenu needs right-click, and long-press is unreliable on iOS.
10) Compose modal: 980x820 with max 95vw/90vh, min-height 520, padding var(--space-6)=32px, and an 84px label column (Compose.module.css:1-15, 128-133). It is cramped and needs a full-screen sheet. ComposeMinimized is fixed at right 18px with min-width 220.
11) The calendar floating panel has a MIN_WIDTH of 480 (CalendarPopover.tsx:39), wider than the phone. The calendar sidebar is fixed at 400px.
12) The bottom bar's absolutely centered .bottom-center-time overlaps the left and right sections; .bottom-wide has a flex-basis of 320px.
13) Detached windows use window.open with a minimum of 760x620 (openDetachedWindow.ts:35-48), so on mobile they become new tabs.
14) .pane uses overflow-y:scroll with a stable gutter, so the scrollbar gutter is always reserved.

### 3. Which CSS custom properties are the de-facto theme tokens? Which are consumed by the kept components? Propose a mapping from shadcn tokens to legacy vars.
Legacy tokens (globals.css:1-54; .dark overrides at 32-54), with use counts across app CSS/TSX: --bg 1 (body only), --surface 13, --surface-2 13, --surface-3 1, --surface-1 3 (UNDEFINED), --text 19, --muted 21 (a text color), --border 43, --accent 18 (link/brand blue #1847d5, dark #b8d5ff), --accent-2 2 (shadowed by Radix, see gotchas), --accent-2-strong/-bg/-border 0, --shadow 5, --radius-sm 27, --radius-md 21, --radius-lg 1 (all 4px), --input-bg 8, --input-fg 10, --mail-view-bg 5, --mail-view-fg 6, --list-row-hover-bg/-border 4/4, --list-row-selected-bg/-border 14/8, --list-row-active-bg/-border 7/26, --list-row-focus-ring 5.

Radix tokens (the larger share): --gray-1..12 (~230 refs), --gray-a*, --space-N (~139), --accent-1..12 and --accent-a*, --red/--green/--amber/--blue-N, --radius-1..6, --shadow-1..6, --color-panel-solid (6), --accent-contrast, --font-size-N, --line-height-N, --sand-N (layout.tsx).

Consumers among the kept components:
- ThreadMessageCard.module.css: mostly Radix (28 scale + 45 space/radius/shadow refs), plus --accent x1, --border x3, --mail-view-bg x3, --mail-view-fg x1.
- HtmlMessage.module.css: --border, --mail-view-bg, --mail-view-fg. HtmlMessage.tsx uses --mail-view-fg/--text inline and hardcodes the link colors.
- Compose.module.css: 23 Radix scale + 17 other Radix refs, plus --accent x3, --muted x2, --surface, --border, --shadow, --text, --input-fg.
- ComposeEditor.module.css: --accent x2, --input-bg, --input-fg, plus Radix grays. ComposePlainTextEditor: --input-bg/fg. ComposeMarkdownEditor: --border. QuotedMessageNode: --accent.
- Calendar: fullcalendar-theme.css (--border x6, --muted x2, --text x3, --surface, --accent + 22 Radix), CalendarPopover.module.css (--border x6, --surface, --surface-2), CalendarSidebarPanel (--border, --surface, --surface-2), EventDetailPanel (--border, --surface, --text), EventDetailView (Radix only).
- List rows (likely restyled but may be kept): MessageRow, MessageTable and MessageThreadList use all the --list-row-* vars plus Radix grays.
- globals.css semantic classes used by kept parts: .markdown-view, .quote-block, .attachment-* (--muted, --border, --surface-2, --accent, --mail-view-*), .icon-button, .bottom-*.

Proposed mapping. The shadcn tokens are the source of truth, defined on :root and .dark (next-themes `.dark` on <html>). Their values should reference :root-scoped Radix scales so the Radix and shadcn palettes stay in sync. Do NOT reference --gray-N/--accent-N here (see gotchas).
```css
:root{ --background:var(--sand-2); --foreground:var(--sand-12); --card:#fff /*or var(--sand-1)*/; --card-foreground:var(--sand-12); --popover:var(--sand-1); --popover-foreground:var(--sand-12); --primary:var(--indigo-9); --primary-foreground:#fff; --secondary:var(--sand-4); --secondary-foreground:var(--sand-12); --muted:var(--sand-3); --muted-foreground:var(--sand-11); --accent:var(--sand-4); --accent-foreground:var(--sand-12); --destructive:var(--red-9); --border:var(--sand-6); --input:var(--sand-7); --ring:var(--indigo-8); --radius:0.5rem; }
.dark{ /* same names; Radix --sand-N/--indigo-N flip automatically under .dark (styles.css:1621) — override only where the old dark palette (#24272f etc.) should be preserved */ }
/* legacy aliases (after renaming legacy --muted/--accent usages) */
:root{ --bg:var(--background); --surface:var(--card); --surface-1:var(--card); --surface-2:var(--muted); --surface-3:var(--secondary); --text:var(--foreground); /* legacy --muted -> */ --muted-foreground:…; /* legacy --accent -> */ --link:var(--primary);
 --input-bg:var(--background); --input-fg:var(--foreground); --mail-view-bg:var(--card); --mail-view-fg:var(--card-foreground);
 --list-row-hover-bg:var(--accent); --list-row-hover-border:var(--border); --list-row-selected-bg:var(--secondary); --list-row-selected-border:var(--input);
 --list-row-active-bg:color-mix(in oklab, var(--primary) 12%, var(--card)); --list-row-active-border:var(--primary); --list-row-focus-ring:var(--ring);
 --shadow:0 20px 40px rgb(0 0 0 / .08); --quote-2:#ffcf5a; }
.radix-themes{ --color-background:var(--background); --color-panel-solid:var(--card); --color-surface:var(--card); --default-font-family:var(--font-sans-app); }
@theme inline{ --color-background:var(--background); …; --radius-sm:calc(var(--radius) - 4px); --radius-md:calc(var(--radius) - 2px); --radius-lg:var(--radius); }
```
Notes:
(a) The shadcn names --muted and --accent cannot coexist with the legacy ones. Codemod first: var(--muted) to var(--muted-foreground) (21 uses) and var(--accent) to var(--primary) or a new --link (18 uses, including the --fc-* mappings in fullcalendar-theme.css).
(b) --radius 0.5rem keeps --radius-sm at 4px (the legacy value); md becomes 6px and lg 8px.
(c) Keep Theme accentColor='indigo' and grayColor='sand' (or switch both together) so the --gray-N/--accent-N used by the kept components match --primary/--muted.
(d) Redefining --list-row-* over :root-safe tokens also fixes the current resolution bug.

### 4. Which Radix Themes CSS classes are overridden globally (.rt-*)? Will loading Tailwind v4 preflight conflict with Radix Themes styles?
Global overrides in globals.css:
- `.rt-BaseDialogOverlay{z-index:9995}` (86-88)
- `.rt-PopperContent{z-index:9998}` (95-97)
- `.app-shell :where(.rt-Button.rt-variant-surface, .rt-IconButton.rt-variant-surface)`, with hover and `.dark` variants (118-140), which changes the surface-variant button bg and border to gray-3/4/5.

Scoped `:global(.rt-*)` overrides in CSS modules:
- TopBar.module.css: .rt-TextFieldInput (98), .rt-BaseMenuItemIndicator/.rt-BaseMenuCheckboxItem/.rt-BaseMenuRadioItem/.rt-BaseMenuItem (110-118), .rt-DropdownMenuItem[data-highlighted] (261-268).
- FolderTree.module.css: .rt-TextFieldInput (85), .rt-BaseMenuItem/.rt-BaseMenuItemIndicator/.rt-BaseMenuContent/.rt-BaseMenuSeparator (252-268).
- MessageMenu.module.css: the same four BaseMenu classes (25-38).
- MoveToDialog.module.css: .rt-TextFieldInput (40).
- Compose.module.css: .rt-DropdownMenuItem (117), .rt-TextFieldInput (146-147), .rt-TextFieldRoot (157).
- ThreadMessageCard.module.css: .rt-BaseTabListTriggerInner (282), .rt-Button/.rt-IconButton button-group joins (303-322).
- settings-tabs uses Radix vars --tab-padding-x/--tab-height/--accent-indicator (globals.css:1269-1306).

Preflight conflict analysis. Radix ships NO global reset; its `.rt-reset` (styles.css:4777-4860) only applies to Radix elements. Radix CSS is unlayered and preflight sits in @layer base, so Radix's own declarations win over preflight wherever Radix sets a property. Radix components are therefore mostly safe. The real risks are elements that rely on UA defaults, plus the cascade order:
1) `*{margin:0;padding:0;border:0 solid}` plus `ol,ul,menu{list-style:none}`: bullets, numbering and indentation disappear in the Lexical compose editor (ComposeEditor.module.css has no list or heading styles), .markdown-view (globals.css:520 sets only margins), QuotedMessageNode content, compose quoted HTML (Compose.module.css:336-351), MarkdownPanel/react-markdown, @uiw/react-md-editor previews and signatures. p, blockquote and pre margins vanish where not set explicitly.
2) `h1-h6{font-size:inherit;font-weight:inherit}`: headings in the compose editor and markdown view become body text (.markdown-view sets weight 600 but no size).
3) `img,svg,video,canvas,iframe{display:block;vertical-align:middle}` plus `img{max-width:100%;height:auto}`: inline lucide or Radix icon SVGs inside non-flex text (Text spans, badges, labels) drop to their own line. Inline images in the editor and markdown change. Lexical ImageNode explicit sizing can be overridden by height:auto. Radix Buttons are inline-flex, so icons inside them are fine.
4) `button,input,select,textarea{font:inherit;color:inherit;background-color:transparent;border-radius:0}` plus `border:0 solid`: raw <button>/<select>/<input> elements that relied on UA chrome lose their borders and backgrounds. Most legacy buttons reset explicitly (.treeAction, .bottom-status-trigger, .reminder-open-button, .composeSuggestion, .sortButton), but check any unstyled native controls and checkboxes.
5) Border color: v4 defaults to currentColor. shadcn's base `*{border-color:var(--border)}` (layered) only affects elements whose border-color is not set by unlayered CSS. Legacy rules with `border:1px solid transparent` keep transparent. Tables and <hr> inside quoted content change.
6) `::placeholder` becomes 50% currentColor. Radix and .form-field set their own, so these are mostly fine.
7) `html{line-height:1.5;font-family:var(--default-font-family,…)}` and `-webkit-tap-highlight-color:transparent`. Content outside .radix-themes (shadcn portals) gets Tailwind's font stack.
8) Cascade order, the biggest practical issue: unlayered Radix, globals.css and CSS-module rules beat ALL Tailwind utilities. Import Radix as `@import "@radix-ui/themes/styles.css" layer(radix)` with `@layer theme, base, radix, legacy, components, utilities;` and wrap legacy globals in @layer legacy. CSS modules stay unlayered and keep winning, which is fine for kept components.
9) Tailwind's `dark:` variant defaults to prefers-color-scheme. Add `@custom-variant dark (&:where(.dark, .dark *));` to match the `.dark` class used by globals.css, Radix `:is(.dark,.dark-theme)` and `:global(.dark)` in modules.
10) Variable collisions: --radius-*, --font-sans, --default-font-family, --default-mono-font-family, and --color-background/--color-surface/--color-panel* (see gotchas). Use `@theme inline` for shadcn colors.
11) Email HTML is inside an iframe (HtmlMessage.tsx:427-533) and is not affected.

### 5. How are fonts loaded (--font-sans, Sora)? Any next/font usage?
No fonts are loaded at all. There is no next/font import, no @font-face, no Google Fonts link (public/ has only icons, favicon.png, sw.js and build-version.json), and layout.tsx has no font className.
- globals.css:71 sets `body{font-family:var(--font-sans,"Sora",sans-serif)}`. --font-sans is never defined, so this resolves to the literal 'Sora', which only works if Sora is installed locally, otherwise sans-serif.
- In practice everything sits inside <Theme>, and `.radix-themes` sets `font-family:var(--default-font-family)` (styles.css:4517), the Radix system stack (-apple-system, BlinkMacSystemFont, 'Segoe UI (Custom)', Roboto, ..., system-ui; styles.css:4465). The effective UI font is therefore the system font, and body's Sora is overridden.
- 'Sora' is applied explicitly in ComposeEditor.module.css:90 (.composeEditorInput: "Sora", system-ui, -apple-system) and inside the email iframe CSS (HtmlMessage.tsx:421). Both fall back to system-ui on machines without Sora, so compose and email bodies may differ from the chrome.
- .markdown-view uses `var(--font-body,"IBM Plex Sans",system-ui,sans-serif)` (globals.css:508). --font-body is undefined, so this is 'IBM Plex Sans' if installed, else system-ui.
- Monospace is hardcoded `ui-monospace, SFMono-Regular, …` (TopBar.module.css:57, MessageViewPane.module.css:54, globals.css:544). McpTabContent.tsx:229/299 uses var(--default-mono-font-family), which is currently undefined; once Tailwind v4 is added it will resolve to Tailwind's mono stack.

Recommendation: load the chosen face with next/font (e.g. `Sora({subsets:['latin'], variable:'--font-sora'})`) and put the class on <html>. Then set `@theme inline{--font-sans:var(--font-sora), ui-sans-serif, system-ui}` and `.radix-themes{--default-font-family:var(--font-sora), system-ui, sans-serif}` so Radix, shadcn and legacy text share one font. Pass the same family into the HtmlMessage iframe and the compose editor explicitly. Avoid naming the next/font variable --font-sans, which would self-reference with Tailwind's theme var.

### 6. How are detached windows (app/compose/window, app/message/window, app/calendar/window) styled; do they share the shell?
They are separate App Router client pages under the same root layout (app/layout.tsx). They therefore share the Radix styles, globals.css, the <Theme grayColor=sand> wrapper, `main{height:100vh}`, `body{overflow:hidden}` and the global token vars. They do NOT render MailClient, .app-shell, TopBar, the content grid or BottomStatusBar.
- Compose window (app/compose/window/page.tsx:76-101): `.page{width:100%;height:100vh;background:var(--gray-1);overflow:hidden}` and `.state` (page.module.css:1-15). DetachedComposeWindowClient renders global `.detached-compose-shell` (flex, padding var(--space-4)), `.detached-compose-card-slot` and `.detached-compose-state` (globals.css:1222-1247; DetachedComposeWindowClient.tsx:397, 486, 501), and reuses the inline compose card renderer (renderInlineCard).
- Message window (app/message/window/page.tsx:345-358): `.page{height:100vh;background:var(--gray-1);display:flex;flex-direction:column;overflow:hidden}`. It reuses MessageViewPane with hideToolbar plus ThreadView, MessageMenu and MessageQuickActions, so it shares the view-pane CSS modules.
- Calendar window (app/calendar/window/page.tsx:54-62): the same .page pattern plus `.detailContainer{flex:1;min-height:0;overflow:hidden;position:relative}` hosting CalendarEventBrowser and CalendarDropOverlay.

Theme: the message window (page.tsx:63-65) and compose window (DetachedComposeWindowClient.tsx:95-97) read localStorage 'noctua:theme' only to pass a darkMode boolean into the email/editor rendering. None of them toggles `document.documentElement.classList('dark')`, and the calendar window never reads the theme. The window chrome (Radix + legacy vars) is therefore always light, even when the main app is dark. A ThemeProvider (next-themes, storageKey 'noctua:theme') in the root layout would fix all three at once.

They are opened through lib/ui/openDetachedWindow.ts (window.open, or a Tauri WebviewWindow on desktop; default size max(760, 64% of screen) x max(620, 78%)). Handoff runs over localStorage (lib/ui/detachedComposeHandoff.ts, lib/ui/detachedMessageEvents.ts). Any new app-level login gate (feature A) must also cover these routes, because they fetch /api/* with credentials:'include' directly.



# AREA: mcp-and-api-patterns

## Summary
The MCP endpoint is a stateless JSON-RPC-over-HTTP POST at app/api/mcp/route.ts. Every request builds a new McpServer in lib/mcpServer.ts (executeMcpHttpRequest, lines 882-1187), registers all tools, connects a custom StatelessJsonResponseTransport (lines 806-880) and dispatches the body. Auth happens in lib/auth.ts requireMcpAccountContext (lines 289-329). The bearer token is `mcp_` + an AES-256-GCM sealed McpSessionData payload ({kind:'mcp', tokenId, userId, role, accountId, exp, optional imap/smtp creds}). It is checked against the master-DB table mcp_tokens by sha256 hash, tokenId, accountId and expiry. lastUsedAt is updated fire-and-forget. Each token is bound to one account (mcp_tokens.accountId NOT NULL; tokens are created and listed per account under /api/accounts/[accountId]/mcp-tokens). However, tools take an optional `accountId` arg that resolveAccountContext (lines 322-340) lets switch to any account returned by getAccountsForUser(userId), where userId comes from authInfo.extra. Scopes are not modeled: route.ts passes `scopes: []` in AuthInfo. Tool handlers throw plain Errors, and the SDK (v1.29.0, zod ^4.3.6) turns thrown errors, input-validation errors and output-validation errors into `{content:[{type:'text',text}], isError:true}` results with HTTP 200. REST routes use manual body parsing with no zod (zod is imported only in lib/mcpServer.ts) and return `{ok:false,message}` errors or `{ok:true,...}` success, via NextResponse.json or the optional okResponse/errorResponse helpers. Tests run with `bun test`, preloading lib/testSetupEnv.ts (IMAP_CREDENTIALS_STORAGE=db, a fixed IMAP_SECRET_KEY). They share one temp data dir per process (lib/testDbHarness.ts), keep tests apart with randomUUID account ids, call route handlers directly with sealed-cookie or Bearer requests, and stub IMAP/SMTP through the wrapper seams @/lib/serverImap, @/lib/serverSmtp, @/lib/mail/imap and @/lib/serverDb with mock.module + mock.restore. Schema lives in lib/db/schema.ts. initMasterSchema (lines 584-695) covers main.db, and initAccountSchema (lines 697-1194) covers the per-account shard DBs. Both use CREATE TABLE/INDEX IF NOT EXISTS plus PRAGMA table_info-guarded ALTER TABLE ADD COLUMN. Shards also get WeakMap-signature-gated ensure*RuntimeSchema calls on every getAccountDb (lib/db/connection.ts lines 219-248).

## Key files
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/mcpServer.ts — MCP server: tool definitions, zod schemas, account resolution, stateless transport [49-58 (McpAccountContext), 91-93 (ACCOUNT_ID_ARG), 95-320 (input/output zod raw shapes), 322-340 (resolveAccountContext), 373-378 (buildToolResult), 476-499 (resolveThreadTarget), 806-880 (StatelessJsonResponseTransport), 882-1187 (executeMcpHttpRequest + all tool registrations)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/mcp/route.ts — HTTP entry for MCP (JSON-RPC, Bearer auth) [43-85 POST (auth -> AuthInfo{scopes:[], extra:{accountId,userId,tokenId}} -> executeMcpHttpRequest; 202 on notification-only), 87-93 GET/DELETE 405]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/auth.ts — Session + MCP token sealing/validation [30-42 SessionData/McpSessionData, 83-94 seal/unseal MCP + hashOpaqueToken, 159-169 requireSessionAccountOr403 (only session.accountId allowed), 208-237 buildMcpSessionPayload, 239-251 createMcpAccessToken, 253-271 mergeAccountCredentials, 289-329 requireMcpAccountContext]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/mcpTokens.ts — mcp_tokens CRUD on master DB [1-94 (list/getByHash/insert/delete/touchLastUsed; explicit column lists at 14-17, 27-31, 53-56)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/rowParsers.ts — Row -> McpTokenMetadata mapping [43-66 StoredMcpTokenRow + mapMcpTokenRow]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/data.ts — Shared token types (also used by UI) [210-224 McpTokenMetadata, McpTokenCreatePayload]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/[accountId]/mcp-tokens/route.ts — Token management REST (per account, cookie session) [19-28 GET list, 30-86 POST create (manual validation, 201 {ok,token,secret})]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/[accountId]/mcp-tokens/[tokenId]/route.ts — Token revoke [5-28 DELETE (nested param read pattern)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/components/account-settings/tabs/McpTabContent.tsx — UI for MCP tokens (uses lib/accountApiPaths.ts:224-233 buildAccountMcpTokensPath/buildAccountMcpTokenPath)
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/_helpers/response.ts — Canonical REST envelope helpers [17-20 ErrorResponseBody, 27-32 errorResponse(message,status), 44-57 okResponse(body?) (always 200)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/_helpers/accountContext.ts — Route param + session/account authorization helpers [7-18 AccountContext/AccountRouteParams, 29-36 getAccountIdFromParams, 38-58 requireAccountContext, 67-86 requireOwnedAccountContext, 88-97 requireAccountContextFromParams]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/admin/_auth.ts — Admin gate (users.role === 'admin') [5-13 requireAdminSessionOr403]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/serverDb.ts — Lazy wrapper over ./db.ts?server-runtime; the mockable seam for DB calls used by auth/mcpServer/accountContext [1-134]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/dbWriteRetry.ts — Wrap every DB write [48-100 withDbWriteRetry(operation, fn, opts) retries SQLITE_BUSY/LOCKED with jittered backoff (5 attempts, 120ms base, 2s max)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/schema.ts — Master + shard schema/migrations [18-58 WeakMap signature trackers, 101-110 getDbTableColumns, 232-266 ensureThread/Topic Optional+Runtime pattern, 584-695 initMasterSchema, 697-1194 initAccountSchema (tables 698-1098, migrations 1101-1193)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/connection.ts — Connection management [65-69 PRAGMAs (WAL, busy_timeout, foreign_keys ON), 176-197 getDb (initMasterSchema once), 219-248 getAccountDb (initAccountSchema once per dbPath + ensure*RuntimeSchema every call), 250-253 withAccountDb]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db.ts — Barrel: new db/*.ts modules must be re-exported here (and in serverDb.ts if used by auth/mcp code) [134-151 re-exports of users/mcpTokens]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/db/users.ts — user_accounts access (target of role column) [38-52 listAccessibleAccountIdsForUser, 54-75 saveUserAccounts/addUserAccountLink (INSERT OR REPLACE)]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/testDbHarness.ts — Shared temp NOCTUA_DATA_DIR + dbModulePromise (./db.ts?test-harness) [1-56]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/lib/testSetupEnv.ts — bun test preload: IMAP_SECRET_KEY, IMAP_CREDENTIALS_STORAGE=db [1-13]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/bunfig.toml — [test] preload + ignore *.dom.test.tsx (run via bun run test:dom / bunfig.dom.toml) [1-9]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/mcp/route.test.ts — Reference MCP integration test [26-89 mocks+imports, 186-226 createStoredToken/postMcp helpers, 238-295 seedMailbox, 297-340 beforeEach resets, 402-? tools/list assertions, 1048-1081 isError assertion]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/[accountId]/sync/new-candidates/route.test.ts — Reference REST route test with IMAP seam mock [9-23 mock pattern w/ comment, 48-66 cookie request builder, 86-88 direct handler call]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/[accountId]/messages/flags/bulk/route.test.ts — Reference test mocking @/lib/db, @/lib/serverImap AND @/lib/serverDb [1-46]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/app/api/accounts/[accountId]/mcp-tokens/route.test.ts — Reference test with no mocks (pure DB harness + sealed cookie) [1-141]
- /home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215/noctua-mail/AGENTS.md — Repo rules incl. mock.module seams + test:ci/test:stress [36-43]

## Extension points
- lib/mcpServer.ts:1173 (before `const transport = ...` at 1175) — register new collaboration tools (get_thread_state, set_thread_assignee, set_thread_status, add_thread_comment, list_thread_activity, list_assigned_threads) with server.registerTool + zod raw-shape input/output schemas declared next to TOPIC_MUTATION_SCHEMA (lines 196-201).
- lib/mcpServer.ts:476 resolveThreadTarget(context,{threadId?,messageId?}) — reuse it to accept threadId or messageId for thread-scoped collab tools.
- lib/mcpServer.ts:322 resolveAccountContext — the place to enforce per-account role (viewer/editor/manager) and token account allowlist/scopes when switching accountId.
- lib/mcpServer.ts:52 McpAccountContext — add `userId`, `scopes`, `role` fields so handlers can check permissions and record the actor for the activity log (actor clientId convention: `mcp:${tokenRecord.id}`, see lines 554, 787, 986).
- lib/mcpServer.ts:633/758 listMessagesForFolder/searchMessages — after enrichMessagesWithThreadTopics, add a sibling enrichment (assignee/status) so message rows returned by MCP include collaboration fields; extend SEARCH_RESULT_MESSAGE_SCHEMA (266-302) accordingly or output validation fails silently into isError.
- app/api/mcp/route.ts:55-65 AuthInfo — populate `scopes` from tokenRecord (currently `[]`) and keep extra.userId.
- lib/auth.ts:289-329 requireMcpAccountContext — add check that session.userId still has access to session.accountId (listAccessibleAccountIdsForUser) and surface tokenRecord.scopes.
- lib/auth.ts:208-237 buildMcpSessionPayload — only if scopes must be sealed into the token; DB column is preferable (revocable).
- lib/db/schema.ts:629-645 mcp_tokens table + index; add `scopes`/`accountIds` columns via PRAGMA-guarded ALTER after line 645.
- lib/db/schema.ts:613-617 user_accounts — add `role TEXT` via ALTER in initMasterSchema; lib/db/users.ts:54-75 INSERT OR REPLACE statements must carry role.
- lib/db/mcpTokens.ts:14-17, 27-31, 52-77 + lib/db/rowParsers.ts:43-66 + lib/data.ts:210-224 — every place token columns are enumerated.
- app/api/accounts/[accountId]/mcp-tokens/route.ts:30-86 POST — accept and validate `scopes`/`accountIds` in CreateTokenBody.
- lib/db/schema.ts:697-1098 initAccountSchema db.exec block — add shard tables thread_collab_state / thread_comments / thread_activity + indexes; optional ensureThreadCollabRuntimeSchema wired in lib/db/connection.ts:233-236.
- lib/db.ts (barrel, e.g. near 134-151) + lib/serverDb.ts — re-export new db functions; add serverDb wrappers for any called from mcpServer/auth so tests can mock the wrapper path.
- app/api/accounts/[accountId]/threads/[threadId]/... (new) — REST for collab using getAccountIdFromParams + requireAccountContext + errorResponse/okResponse.

## Gotchas
- Tool errors are never HTTP errors: anything thrown in a handler, plus zod input or output validation failures, comes back as HTTP 200 `{result:{isError:true, content:[{type:'text', text}]}}`. That comes from SDK node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js:125-162. Only auth failures give 401 (with `WWW-Authenticate: Bearer`), and an invalid JSON body gives 400 JSON-RPC ParseError.
- If a tool declares an outputSchema, every returned structuredContent must match it. A mismatch turns a successful call into an isError 'Output validation error'. Tools registered with the legacy `server.tool(name, desc, shape, handler)` have no outputSchema (list_topics, check_new_mail, list_messages_by_folder, assign/unassign_topics, create_draft_message, flag/unflag, todo tools).
- The MCP server is rebuilt on every HTTP request (stateless; no sessions, no SSE; GET/DELETE return 405). Do not keep state in closures across requests.
- The token is bound to one account in mcp_tokens.accountId and in the sealed payload. But resolveAccountContext already lets a token act on any account the creating user can reach (getAccountsForUser = user_accounts link OR ownerUserId). That is implicit multi-account access with no allowlist and no role check. After a switch it also skips mergeAccountCredentials, so in cookie-only credential mode a switched account may lack IMAP creds.
- requireMcpAccountContext never re-checks that the user still has access to the bound account. Once role-based sharing exists, a user removed from a shared mailbox could keep using an old MCP token. Add a listAccessibleAccountIdsForUser check.
- The sealed MCP payload carries imap/smtp creds only when shouldIncludeSessionCredentials() is true (IMAP_CREDENTIALS_STORAGE=cookie|both; the default is 'both', lib/secret.ts:4-8). Tests preload IMAP_CREDENTIALS_STORAGE=db, so tokens there carry no creds. With app-level login and db storage, buildMcpSessionPayload no longer needs session creds.
- Cookie sessions authorize only session.accountId (requireSessionAccountOr403, lib/auth.ts:159-169). requireAccountContext therefore returns 403 for any account other than the active one, and the token management routes are scoped to the active account. requireOwnedAccountContext (accountContext.ts:67-86) allows any linked or owned account. Shared-mailbox permissions need a new helper or an extension here.
- okResponse() always returns status 200 and has no status argument. For 201 or 202 use NextResponse.json directly, as mcp-tokens POST does. Only 4 route files use the helpers; most call NextResponse.json({ok:false,message},{status}) inline.
- REST bodies are validated by hand: `(await request.json().catch(() => null)) as T | null`, then typeof checks returning 400. zod (^4.3.6) is a dependency but only lib/mcpServer.ts imports it.
- user_accounts writes use `INSERT OR REPLACE` (users.ts:58, 70), and saveUserAccounts DELETEs every row before reinserting. Adding a role column means updating these statements, or roles get reset to the default or dropped.
- Test DB isolation is per process, not per test. All files share one mkdtemp dir (memoized on globalThis.__mywebmailSharedDbHarness) and one main.db, so use unique ids (`${prefix}-${randomUUID()}`). Avoid helpers that wipe global tables (saveUsers/saveUserAccounts DELETE all rows) or assert global counts.
- mock.module registrations outlive the test file. Pattern: `const actual = await import(path)`, then `mock.module(path, () => ({...actual, fn}))`, then dynamic `await import('./route')`, then `mock.restore()`. Mocks should default to the real implementation and be overridden with mockResolvedValueOnce/mockRejectedValueOnce (new-candidates test lines 11-13), or reset in beforeEach (mcp test 298-340).
- Mock the path production code actually imports. lib/drafts.ts and lib/messageFlagMutation.ts import @/lib/serverImap and @/lib/serverSmtp; auth.ts, mcpServer.ts and accountContext.ts import @/lib/serverDb; app/api/_helpers/newMailCheck.ts and message routeHelpers import @/lib/mail/imap and @/lib/db directly. AGENTS.md:40-41 says to prefer narrow wrappers over mocking @/lib/db.
- serverDb.ts, serverImap.ts, serverSmtp.ts and testDbHarness use query-string specifiers (./db.ts?server-runtime, ?test-harness) so mocks of '@/lib/db' cannot hijack them. Submodules (./db/connection) are still shared, so all of them see the same SQLite connections.
- Run `bun run test:ci` and `bun run test:stress` (randomized, rerun-each=3) for mock-sensitive changes (AGENTS.md:42). DOM tests (*.dom.test.tsx) are excluded by bunfig.toml and run via `bun run test:dom`.
- Shard schema: initAccountSchema runs once per dbPath per process (accountDbInitialized), while ensure*RuntimeSchema runs on every getAccountDb behind a WeakMap signature. New columns that must appear without a restart (HMR/dev) belong in an ensureXOptionalColumns + ensureXRuntimeSchema pair.
- foreign_keys=ON (connection.ts:68). Thread ids are not permanent anchors: thread_topics rows are pruned when no message has that threadId any more (lib/db/threads.ts:156-178, called from messages/upsert.ts:629-659 and messages/delete.ts). Collaboration state keyed by threadId needs the same pruning or remapping logic, and no FK to threads.
- MCP server name is 'mywebmail-mcp' (mcpServer.ts:900) and the test asserts it. The tools/list test uses arrayContaining, so adding tools does not break it.
- Every DB write in lib/db/* is wrapped in withDbWriteRetry('opName', async () => {...}). Shard writes go through withAccountDb(accountId, db => ...) (e.g. lib/topics/core.ts:259-273).

## Q&A
### 1. How are MCP tools registered, how is accountId resolved against the token, how are errors returned? Template for a new tool.
Tools are registered inside executeMcpHttpRequest (lib/mcpServer.ts:882-1187) on a fresh `new McpServer({name:'mywebmail-mcp',version:'0.1.0'},{capabilities:{tools:{}}})`. Two styles are used:
- Preferred: `server.registerTool(name, {description, inputSchema, outputSchema}, handler)`, used by list_accounts, list_folders, list_mailing_list_aliases and search_messages.
- Legacy: `server.tool(name, description, rawShape, handler)`, with no outputSchema.

Schemas are zod RAW SHAPES (plain objects of zod types, not z.object). They spread `ACCOUNT_ID_ARG = { accountId: z.string().trim().optional() }` (line 91) and may add `.describe()` text. Output schemas are raw shapes too, e.g. `{ ok: z.boolean(), folders: z.array(z.object(FOLDER_SCHEMA)) }` (215-218).

Account resolution: every handler starts with `const ctx = await resolveAccountContext(context, args.accountId)` (322-340).
- If accountId is missing or equals the token's account, the base context is used.
- Otherwise userId is read from `authInfo.extra.userId` (set in app/api/mcp/route.ts:60-64) and checked against `getAccountsForUser(userId)`. Failure throws `Account "x" not found or not accessible.`

Results use `buildToolResult(summaryText, structuredContent)` (373-378), which returns `{content:[{type:'text',text}], structuredContent}`. Errors are plain `throw new Error('...')`; the SDK converts them into `{isError:true, content:[{type:'text', text: message}]}` with HTTP 200. Zod input-validation failures become `Input validation error: ...` isError results the same way.

Template (place schemas near lines 196-320 and registration before line 1175):
```ts
const THREAD_STATUS = z.enum(["open","pending","in_progress","done"]);
const SET_THREAD_STATE_SCHEMA = {
  ...ACCOUNT_ID_ARG,
  threadId: z.string().trim().optional().describe("Thread id. Provide threadId or messageId."),
  messageId: z.string().trim().optional().describe("Any message id in the thread."),
  status: THREAD_STATUS.optional(),
  assigneeUserId: z.string().trim().nullable().optional().describe("null to unassign")
};
const THREAD_STATE_OUTPUT_SCHEMA = {
  ok: z.boolean(),
  threadId: z.string(),
  status: THREAD_STATUS,
  assigneeUserId: z.string().nullable(),
  updatedAt: z.number()
};

server.registerTool(
  "set_thread_state",
  { description: "Set status and/or assignee of a conversation.", inputSchema: SET_THREAD_STATE_SCHEMA, outputSchema: THREAD_STATE_OUTPUT_SCHEMA },
  async (args) => {
    const ctx = await resolveAccountContext(context, args.accountId);
    const { threadId } = await resolveThreadTarget(ctx, args); // throws 'Provide either threadId or messageId.'
    const actorUserId = ctx.authInfo?.extra?.["userId"] as string | undefined;
    const state = await updateThreadCollabState(ctx.accountId, threadId, {
      status: args.status, assigneeUserId: args.assigneeUserId,
      actorUserId, clientId: `mcp:${ctx.tokenRecord.id}`
    });
    return buildToolResult(`Updated thread ${threadId}.`, { ok: true, ...state });
  }
);
```
With registerTool the handler args are typed from the shape, so no manual arg type is needed (the legacy server.tool calls annotate args by hand, e.g. 999-1008). Tests assert tool errors via `body.result?.isError === true` and `body.result?.content?.[0]?.text` (route.test.ts:1076-1080).

### 2. Current tool names and purposes
All are in lib/mcpServer.ts. Every tool accepts optional `accountId`.
- list_accounts (910-929, registerTool+output): accounts accessible to the token's userId as {id,name,email,avatar}.
- list_folders (931-946, registerTool+output): folders of the account.
- list_topics (948-960, tool): topics of the account.
- list_mailing_list_aliases (962-978, registerTool+output): saved recipient aliases.
- check_new_mail (980-993, tool): runs runNewMailCheck (app/api/_helpers/newMailCheck.ts) and waits for sync jobs.
- list_messages_by_folder (995-1013, tool): paged folder listing with groupBy, badges, attachmentsOnly and excludedFolderIds; max pageSize 200, default 50.
- search_messages (1015-1028, registerTool+output): exactly one of three modes:
  - standard: query, topics, from, recipients, participants, folderId, fields, badges, ...
  - related: relatedId or `related:` query
  - thread-related: threadIds/messageIds (+groupBy)
- assign_topics / unassign_topics (1030-1050): add or remove topics on a thread resolved by threadId or messageId. Marks the thread's messages with AI_MODIFIED_FLAG.
- create_draft_message (1052-1084): new, reply or forward draft via lib/drafts.ts (buildDraftInputForMode + saveDraftForAccount; IMAP append). Marks it AI-modified.
- flag_message / unflag_message (1086-1140): IMAP \\Flagged via applyFlagMutationsToMessage, plus the AI-modified flag.
- mark_message_todo / mark_message_done / clear_message_todo (1142-1173): TODO_FLAG/DONE_FLAG keyword state via updateTodoState (528-597).

There is no send tool, so a 'send' scope would gate a future tool.

### 3. MCP token scoping: how could scopes and multi-account access be added minimally?
Current model:
- Table mcp_tokens (lib/db/schema.ts:629-640): id PK, accountId NOT NULL, createdByUserId, label, tokenHash UNIQUE, tokenSuffix, createdAt, expiresAt, lastUsedAt. Index idx_mcp_tokens_account_created(accountId, createdAt DESC) at 642-645.
- The raw token is `mcp_` + sealed McpSessionData {kind:'mcp', tokenId, userId, role, accountId, exp (or NEVER_EXPIRES 253402300799), optional imap/smtp}, built by buildMcpSessionPayload (lib/auth.ts:208-237). Only its sha256 is stored.
- requireMcpAccountContext (auth.ts:289-329) checks that the unsealed tokenId and accountId match the DB row and that it has not expired. Because the DB row is read on every request, it is the natural place for scopes.
- app/api/mcp/route.ts:55-65 builds AuthInfo with `scopes: []`.

Minimal plan:
(a) In initMasterSchema after line 645, add `const mcpTokenColumns = getDbTableColumns(db, "mcp_tokens"); if (!mcpTokenColumns.has("scopes")) db.prepare(`ALTER TABLE mcp_tokens ADD COLUMN scopes TEXT`).run(); if (!mcpTokenColumns.has("accountIds")) db.prepare(`ALTER TABLE mcp_tokens ADD COLUMN accountIds TEXT`).run();`. Both are JSON arrays. NULL scopes means legacy full access (read+write); NULL accountIds means only the bound account, or all of the user's accounts to keep today's behavior (decide explicitly). Alternatively use a join table `mcp_token_accounts(tokenId, accountId, PRIMARY KEY(tokenId, accountId))`.
(b) Update the SELECT and INSERT column lists in lib/db/mcpTokens.ts (14-17, 27-31, 52-77), StoredMcpTokenRow/mapMcpTokenRow (rowParsers.ts:43-66) and McpTokenMetadata/McpTokenCreatePayload (data.ts:210-224).
(c) Validate `scopes` (subset of ['read','write','send']) and `accountIds` (each must be in listAccessibleAccountIdsForUser(session.userId), or pass a role check) in mcp-tokens POST route.ts:37-52, and pass them to insertMcpToken.
(d) In app/api/mcp/route.ts:58, set `scopes: tokenRecord.scopes ?? ['read','write']`.
(e) In mcpServer, add a `scopes`/`allowedAccountIds` field to McpAccountContext. Either check `requireScope(ctx, 'write')` at the top of mutating handlers, or use a wrapper `registerScopedTool(scope, name, config, handler)` that skips registering tools the token lacks, which also hides them from tools/list. Extend resolveAccountContext (322-340) to reject account ids outside allowedAccountIds and to compute the effective permission as intersect(token scopes, user_accounts.role for that account), e.g. viewer means read only.
(f) buildMcpSessionPayload needs no change unless scopes must be tamper-evident offline; the DB row is authoritative and revocable. Keep `accountId` in the payload as the default account.
(g) Also check in requireMcpAccountContext that session.userId still has access to session.accountId.

### 4. REST conventions
Response shapes (app/api/_helpers/response.ts):
- `errorResponse(message, status)` returns `{ok:false, message}`.
- `okResponse()` returns `{ok:true}`, and `okResponse(body)` returns `{...body, ok:true}`, always with status 200 (no status parameter).
- Many routes still call `NextResponse.json({ok:true, ...})` / `NextResponse.json({ok:false,message},{status})` inline. Bare payloads, e.g. sanitizeAccountForClient, also use NextResponse.json.

Status codes in use:
- 400: missing or invalid input ('Missing accountId', 'Missing label', 'Missing flag mutation value')
- 401: `{ok:false,message:'Unauthorized'}` from requireSessionOr401. IMAP auth failures use 401 with `{code, reauthRequired, accountId}` (new-candidates test 124-140).
- 403: 'Forbidden' from requireSessionAccountOr403, requireOwnedAccountContext and requireAdminSessionOr403
- 404: 'Account not found' / 'Token not found'
- 201: create (mcp-tokens POST returns `{ok:true, token, secret}`)
- 502: upstream IMAP mutation failure (flags route.ts:52-56)
- 503: MAIL_SERVER_UNREACHABLE_MESSAGE from app/api/_helpers/imapUpstreamError.ts
- 202: MCP notification-only requests

Params: handlers are `export async function POST(request: Request, { params }: AccountRouteParams)`. AccountRouteParams = `{ params: Promise<Record<string, string|string[]|undefined>> }` (accountContext.ts:16-18). Read the account with `const accountId = await getAccountIdFromParams(params)` (trims, takes the first array element). For nested segments, declare `type Params = AccountRouteParams & { params: Promise<{ accountId?: string; tokenId?: string }> }`, then `const { tokenId: raw } = await params; const tokenId = typeof raw === 'string' ? raw.trim() : ''` (mcp-tokens/[tokenId]/route.ts:5-20, flags/route.ts:6-13).

Auth: `const context = await requireAccountContext(request, accountId); if (context instanceof NextResponse) return context;`. It yields {session, accountId, account, clientId (from the x-noctua-client header)}. Variants:
- requireAccountContextFromParams
- requireOwnedAccountContext (any account the user owns or is linked to)
- requireImapMessageMutationContext / requireAccountAndMessageContext (app/api/_helpers/message/routeHelpers.ts), which also load the message
- admin routes: requireAdminSessionOr403 (app/api/admin/_auth.ts)

Body validation is manual, never zod: `const body = (await request.json().catch(() => null)) as CreateTokenBody | null;`, then trim and typeof checks returning 400 (mcp-tokens/route.ts:37-52, flags/route.ts:14-26). Route files often export `runtime = 'nodejs'` and `dynamic = 'force-dynamic'` (mcp/route.ts:7-8).

### 5. Test harness
Isolated DB setup:
- bunfig.toml [test] preloads lib/testSetupEnv.ts, which sets IMAP_SECRET_KEY (≥32 chars) and IMAP_CREDENTIALS_STORAGE='db' when unset. As a result shouldIncludeSessionCredentials() is false and MCP tokens carry no creds.
- `import { dbModulePromise } from '@/lib/testDbHarness'` runs mkdtempSync(os.tmpdir()/'mywebmail-test-db-') ONCE per process, memoized on globalThis.__mywebmailSharedDbHarness. It sets process.env.NOCTUA_DATA_DIR to that dir and ACCOUNT_DB_IDLE_MS='0', registers rm -rf on process exit, and exports `dbModulePromise = import('./db.ts?test-harness')`. The query specifier keeps a stray global mock.module('@/lib/db') in another file from replacing it.
- main.db lives at $NOCTUA_DATA_DIR/db/main.db and shards at db/accounts/<id>.db (lib/runtimePaths.ts:9-45).
- Isolation between tests comes only from unique ids: `uniqueAccountId(prefix) = `${prefix}-${randomUUID()}``. Seed with `const { upsertAccount, saveFoldersForAccount, upsertMessages, insertMcpToken, ... } = await dbModulePromise`.

Calling handlers directly: `const { POST } = await import('./route');` (dynamic import, AFTER mock.module). Then:
`await POST(new Request(`http://localhost/api/accounts/${accountId}/...`, { method:'POST', headers:{ 'content-type':'application/json', cookie:`noctua_session=${encodeURIComponent(sealSession(session))}` }, body: JSON.stringify(...) }), { params: Promise.resolve({ accountId }) })`
where session is `{userId, accountId, role:'user', exp: now+3600}` (new-candidates test 48-66; mcp-tokens test 41-58).

MCP tests mint a token with `createMcpAccessToken({tokenId, session, account, expiresAt})` plus `insertMcpToken({...tokenHash, tokenSuffix})` and send `authorization: Bearer ${rawToken}` with a JSON-RPC body {jsonrpc:'2.0', id, method:'tools/call', params:{name, arguments}} (route.test.ts:186-226, 1061-1074).

IMAP/SMTP mocks, with the exact pattern:
```ts
const actualServerImap = await import('@/lib/serverImap');
const updateImapFlags = mock(async () => {});
mock.module('@/lib/serverImap', () => ({ ...actualServerImap, updateImapFlags }));
const { POST } = await import('./route');
mock.restore();
```
Seams in use:
- @/lib/serverImap (appendImapMessage, deleteImapMessage, syncImapMessage, updateImapFlags, updateImapFlagsBulk)
- @/lib/serverSmtp (buildRawMessage, sendRawSmtpMessage)
- @/lib/mail/imap (planImapNewSyncFolders etc., for code that imports it directly)
- @/lib/serverDb (wrapper DB fns; bulk flags test)
- @/lib/db (discouraged)

Rules:
- Because registrations outlive the file, mocks should delegate to the real implementation by default and be overridden with *Once (new-candidates test 11-13), or be mockReset()+re-implemented in beforeEach (mcp test 298-340).
- AGENTS.md:40-42: avoid mock.module on shared modules like @/lib/db when a narrower seam exists. When production code imports a wrapper such as @/lib/serverDb, mock that wrapper path. Run `bun run test:ci` and `bun run test:stress`.
- A new route test should import: bun:test {describe, expect, test, mock?, beforeEach?}; crypto randomUUID; type Account/SessionData; sealSession (or createMcpAccessToken/hashOpaqueToken); dbModulePromise from @/lib/testDbHarness; and the route via dynamic import. Use only example.test style data.

### 6. Where and how to evolve master and shard schema (exact idioms)
MASTER (lib/db/schema.ts initMasterSchema 584-695, called once from getDb, connection.ts:192-195).
(1) New table: add to the `db.exec(` ... `)` block (585-641), e.g.
```sql
CREATE TABLE IF NOT EXISTS app_user_credentials (
  userId TEXT PRIMARY KEY,
  passwordHash TEXT NOT NULL,
  updatedAt INTEGER NOT NULL
);
```
(2) Index: follow 642-645:
```ts
db.prepare(`CREATE INDEX IF NOT EXISTS idx_user_accounts_account ON user_accounts(accountId)`).run();
```
(3) Column migration: follow 647-688 (or use the private getDbTableColumns helper at 101-110 in the same file):
```ts
const userAccountColumns = getDbTableColumns(db, "user_accounts");
if (!userAccountColumns.has("role")) {
  db.prepare(`ALTER TABLE user_accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'editor'`).run();
}
```
The inline form used today is `const inviteColumns = new Set((db.prepare(`PRAGMA table_info(invite_codes)`).all() as Array<{ name?: string }>).map((row) => String(row.name ?? "")));`. Backfills go right after the ALTER, as at 652-655 (`UPDATE invite_codes SET createdAt = ? WHERE createdAt IS NULL`).

ACCOUNT SHARD (initAccountSchema 697-1194, called once per dbPath per process in getAccountDb, connection.ts:229-232; every table has an accountId column).
(1) New tables and indexes: add inside the first `db.exec(` block (698-1098) next to thread_topics (858-864), with indexes in the index section (918-994):
```sql
CREATE TABLE IF NOT EXISTS thread_collab_state (
  threadId TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  assigneeUserId TEXT,
  updatedAt INTEGER NOT NULL,
  updatedByUserId TEXT
);
CREATE INDEX IF NOT EXISTS idx_thread_collab_state_account_assignee ON thread_collab_state(accountId, assigneeUserId);
CREATE INDEX IF NOT EXISTS idx_thread_collab_state_account_status ON thread_collab_state(accountId, status);
```
(2) Column migration, simple form (as for messages, 1101-1147, plus a follow-up db.exec of CREATE INDEX IF NOT EXISTS at 1148-1157):
```ts
const cols = getDbTableColumns(db, "thread_collab_state");
if (cols.size > 0 && !cols.has("dueAt")) db.prepare(`ALTER TABLE thread_collab_state ADD COLUMN dueAt INTEGER`).run();
```
(3) Runtime-ensured form, for columns that must apply on already-open connections or HMR. Mirror ensureTopicOptionalColumns/ensureTopicRuntimeSchema (252-266) and THREAD_SCHEMA_SIGNATURE (47-48):
```ts
const threadCollabSchemaSignatureByDb = new WeakMap<object, string>();
const THREAD_COLLAB_SCHEMA_SIGNATURE = ["dueAt"].join("|");
export function ensureThreadCollabOptionalColumns(db: any) {
  const cols = getDbTableColumns(db, "thread_collab_state");
  if (cols.size === 0) return;
  if (!cols.has("dueAt")) db.prepare(`ALTER TABLE thread_collab_state ADD COLUMN dueAt INTEGER`).run();
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_thread_collab_state_account_due ON thread_collab_state(accountId, dueAt)`).run();
}
export function ensureThreadCollabRuntimeSchema(db: any) {
  if (threadCollabSchemaSignatureByDb.get(db) === THREAD_COLLAB_SCHEMA_SIGNATURE) return;
  ensureThreadCollabOptionalColumns(db);
  threadCollabSchemaSignatureByDb.set(db, THREAD_COLLAB_SCHEMA_SIGNATURE);
}
```
Call ensureThreadCollabOptionalColumns at the end of initAccountSchema (next to 1158-1160), and ensureThreadCollabRuntimeSchema in getAccountDb (lib/db/connection.ts:233-236, plus the import list at 10-18). Bump the signature string whenever columns are added.

Data access: new lib/db/<x>.ts modules use `withAccountDb(accountId, db => ...)` for the shard or `getDb()` for master, wrap writes in `withDbWriteRetry('opName', ...)`, and are re-exported from lib/db.ts. If auth.ts, mcpServer.ts or routes need them in a mockable way, add a lib/serverDb.ts wrapper.



# AREA: sync-and-imap-identity

## Summary
Everything in IMAP and SMTP is scoped to the account. No IMAP session, connection, local message state or setting is kept per user. All users of an account share one IMAP/SMTP login (account.imap.user / account.smtp.user), one per-account SQLite shard (messages, threads, flags, topics, categories) and one settings JSON blob on the accounts row.

Credentials come from the accounts row, where mapAccountRow calls decodeSecret. A process-global Map keyed only by accountId (lib/credentials.ts) is then laid over that row. The Map is refilled from the caller's session cookie on every authenticated request, and when it holds a password that password wins over the DB.

Sync runs as a Bun subprocess per job (lib/syncJobs.ts spawnSyncWorker -> scripts/runSyncJob.ts -> runSyncOperation). Jobs are serialized and deduplicated per accountId in a process-global queue. The worker receives only {accountId, folderId, mode}, with no credentials or user. It re-reads the account from the DB with an empty credential cache, so it always uses the DB-stored password.

Interactive IMAP operations (flag changes, moves, appends, poll) use a single-slot idle connection pool keyed by [accountId, host, port, secure]. Live updates use /imap/stream, an SSE route that opens its own IMAP IDLE connections for each browser tab (INBOX plus the active folder, LRU-capped by maxIdleSessions, default 3) and opens a fresh connection for each background poll.

Flag changes (\Seen, \Flagged, \Answered, $Todo/$Done and the NONJUNK keyword) are written to IMAP first with UID STORE, then to the shared local DB. The change is therefore global for everyone. Other browsers learn about it through the IDLE 'flags' SSE event or the next sync's flag diff.

Sending goes through nodemailer with From hard-coded to {account.name, account.email}. The raw message is APPENDed to the IMAP Sent folder with \Seen. Drafts are stored in the shared IMAP Drafts folder. The acting user is not recorded anywhere, even though session.userId is available in every route context.

The relogin flow asks any user for the IMAP username and password. It then overwrites the shared DB credentials, with no role check.

## Key files
- lib/credentials.ts — Process-global sessionCache Map keyed only by accountId; applyCachedCredentials lays cookie credentials over the DB credentials, and cached values win [9-37]
- lib/auth.ts — SessionData (userId, accountId, role, optional imap/smtp creds); requireSessionOr401 caches session creds on every request; requireSessionAccountOr403 only allows session.accountId; buildSessionPayload embeds IMAP/SMTP passwords when the storage mode includes cookie; MCP context merges token creds [30-37,118-169,188-206,253-270,289-328]
- lib/secret.ts — IMAP_CREDENTIALS_STORAGE=cookie|db|both; encodeSecret/decodeSecret return an empty string when DB storage is off [4-8,37-43,56-98]
- lib/db/accounts.ts — getAccounts/getAccountsForUser/getAccountById all call applyCachedCredentials; patchAccount reads the raw row and calls mergeAccount + persistAccountRow [26-44,70-75,108-120]
- lib/db/rowParsers.ts — mapAccountRow decrypts imap/smtp passwords; mergeAccount does a shallow merge of settings and imap/smtp, so a blank password in the payload wipes the stored one [68-116,138-155,162-200]
- lib/syncJobs.ts — Per-account in-memory job queue (one running worker per accountId, deduplicated by intent, max 64 queued); spawnSyncWorker passes only the payload JSON to the subprocess [31-55,85,119-131,378-395,594-670]
- lib/workers/runSyncJob.ts — Worker retry loop (up to 11 attempts, 10-60s backoff). Only 'No password configured' / 'Account not found' / 'requires a folderId' count as non-retryable, so IMAP auth failures ARE retried [12-23,55-114]
- lib/syncOperation.ts — runSyncOperationBatched loads the account via getAccounts() (DB creds in the worker); diffLocalAndRemoteWithFlags copies remote IMAP flags into local rows and keeps only the calendar-invite flag [74-133,249-259,304-345,409-490]
- lib/mail/imap/connectionPool.ts — Single-slot idle IMAP connection cache per account identity, shared by all users in the Next process; each sync subprocess drains its own pool [1-52,157-237,256-270]
- lib/mail/imapClientOptions.ts — buildImapIdentityKey; retry and circuit breaker (auth errors are non-retryable and do NOT trip the breaker); buildImapFlowOptions uses account.imap.user/password [151-158,186-236,288-402,417-425]
- lib/mail/imapAuth.ts — verifyImapCredentials(account, password) used by login and relogin (skipBreaker) [10-39]
- app/api/accounts/[accountId]/imap/stream/route.ts — SSE route: one set of IMAP IDLE connections per request/tab (INBOX + active folder, LRU maxIdleSessions), events new/flags:update/message:removed/folder:update, background poll connection, registerStream hook [30-63,100-154,168-182,204-246,315-359,385-448]
- lib/mail/imapStreamRegistry.ts — In-memory accountId -> Set<StreamControl> registry of open SSE streams; currently only removeFolder. Natural fan-out hub for collaboration events [1-29]
- app/api/accounts/[accountId]/imap/poll/route.ts — Polling fallback; uses the pooled client, read-only mailboxOpen, envelope fetch [28-113]
- lib/messageFlagMutation.ts — Flag mutation service: maps seen/answered/flagged/deleted/draft to IMAP system flags (or a raw keyword), runs updateImapFlags(Bulk) and then the local DB update plus thread recompute [10-47,76-114,134-206]
- lib/mail/imap/mutations.ts — appendImapMessage (Sent/Drafts) and updateImapFlagsBulk (mailboxOpen + messageFlagsAdd/Remove, UID STORE) [36-55,168-226]
- lib/messageFlags.ts — $Todo/$Done/$NoctuaAI/NONJUNK/calendar-invite constants; LOCAL_ONLY_FLAGS = calendar-invite and $NoctuaAI; preserveLocalOnlyMessageFlags [3-10,169-205]
- lib/topics/core.ts — Topics live in the local thread_topics table only; imapKeyword column exists but IMAP keyword sync is marked 'Future' [28-33,53-60,211-292]
- lib/mail/smtp.ts — buildMailOptions: From = {account.name, account.email}, extra headers supported; transport uses account.smtp creds; sendSmtpMessage builds the Sent-copy raw separately (line 107); sendRawSmtpMessage for drafts [10-81,83-116,135-155]
- app/api/accounts/[accountId]/smtp/send/route.ts — Compose send: builds Message-ID <uuid@account-domain>, sends via SMTP, APPENDs raw to Sent with \Seen (errors swallowed), returns sentFolderId/sentMessageUid/messageId [24-28,54-59,138-175,194-202]
- lib/drafts.ts — saveDraftForAccount APPENDs to the shared IMAP Drafts folder (\Draft \Seen) and deletes the previous draft; sendDraftForAccount relays the stored raw with envelope from account.email, appends Sent, tombstones the draft [204-279,309-455]
- lib/accountSettings.ts — normalizeAccountSettings defaults; per-tab save snapshot (sync settings are admin-only) [4-27,68-119]
- lib/data.ts — Account and AccountSettings types (sync, threading, layout, appearance, calendar, signatures, defaultSignatureId) [33-86]
- app/api/accounts/[accountId]/settings/route.ts — PUT settings -> patchAccount (top-level shallow merge, no role check) [11-21]
- app/api/accounts/[accountId]/route.ts — PUT whole account (incl. imap/smtp host/user/password) and DELETE account, with no role check [12-42]
- app/api/accounts/[accountId]/relogin/route.ts — Relogin: needs IMAP user+password, verifies, writes them to the shared DB row, re-seals the caller's cookie [20-75]
- app/components/mailclient/AccountReloginDialog.tsx — Modal asking for IMAP user + IMAP password, POSTs to /relogin [22-147]
- app/components/MailClient.tsx — Relogin trigger (401 + reauthRequired), exception-toast relogin, isAdminUser = currentUser.role === 'admin', dialog mount [349,470-489,617,1893,1919-1933,5681-5693]
- app/api/_helpers/imapUpstreamError.ts — Maps IMAP auth errors to 401 {code, reauthRequired:true, accountId}, connect failures to 503 [19-46]
- lib/mail/imapError.ts — getImapHttpError: imap_password_missing / imap_auth_failed classification [65-99]
- app/api/auth/login/route.ts — Current login = IMAP credential check; overwrites BOTH the imap and smtp DB passwords with the login password; resolves userId from owner/links [20-82]
- app/api/auth/switch-account/route.ts — Switches session.accountId; copies account.imap.password (DB or another user's cached session) into the caller's cookie [5-48]
- app/api/_helpers/accountContext.ts — requireAccountContext returns {session, accountId, account, clientId}; the account comes from getAccountById (cached creds). The single choke point for authorization [38-86]
- app/components/mailclient/useSyncController.ts — Client opens the EventSource per tab, handles folder:update/new/flags:update (UI-only flag patch) [1129-1190,1191-1283]
- lib/db/schema.ts — accounts (settings JSON, encrypted passwords), users (no password column), user_accounts (no role), messages (flags JSON + seen/flagged bits), threads, mailbox_state [586-617,710-756,800-819]

## Extension points
- lib/credentials.ts:9-37 (sessionCache/applyCachedCredentials): remove or bypass the cookie overlay so IMAP/SMTP creds come only from the DB when IMAP_CREDENTIALS_STORAGE=db; then lib/db/accounts.ts:29,43,74,104,118 return DB creds unchanged
- lib/auth.ts:188-206 buildSessionPayload and lib/auth.ts:30-37 SessionData: stop embedding imap/smtp creds once app-level login exists; lib/auth.ts:155-169 requireSessionAccountOr403: replace the session.accountId equality check with a user_accounts lookup (lib/db/users.ts:38-52 listAccessibleAccountIdsForUser) that returns the role
- app/api/_helpers/accountContext.ts:38-58 requireAccountContext: add a minRole option (viewer/editor/manager) and expose userId/role so every route (send, flags, relogin, settings, account PUT/DELETE) can authorize and attribute actions
- app/api/accounts/[accountId]/smtp/send/route.ts:165-193: after a successful send, write an activity-log row {accountId, threadId (resolve from inReplyTo/references), messageId (line 138), userId: session.userId, type:'reply_sent'}
- lib/drafts.ts:375-400 (sendDraftForAccount) and lib/drafts.ts:255-277 (saveDraftForAccount): same 'sent by' logging, plus optional draft-owner mapping keyed by draft Message-ID, since drafts sit in the shared IMAP Drafts folder
- lib/mail/smtp.ts:33-68 buildMailOptions / MailPayload.headers (lines 10-31): optional per-user From display name or an internal header. The Sent-copy raw is built separately at smtp.ts:107, so a header could go on the Sent copy only
- lib/messageFlagMutation.ts:76-114 and 134-206: central place to hook actor attribution and activity entries for read/flag/todo changes (both REST and MCP go through it: lib/mcpServer.ts:544,1096,1124)
- lib/mail/imapStreamRegistry.ts:1-29: extend StreamControl with emit(event, data) and add a notifyAccount(accountId, event, payload) helper to push collaboration events (assignment/status/comment) to every open SSE stream of the account; register at imap/stream/route.ts:102-107 and emit through send() at :82-89
- app/components/mailclient/useSyncController.ts:1189-1283: add EventSource listeners for new collaboration event types next to flags:update
- app/api/accounts/[accountId]/relogin/route.ts:20-30: gate to the manager/admin role; app/components/MailClient.tsx:470-489 + AccountReloginDialog.tsx: show a non-actionable 'credentials invalid, contact a manager' state for viewer/editor (response could carry canRelogin:false)
- lib/workers/runSyncJob.ts:17-23 NON_RETRYABLE_PATTERNS: add 'Invalid credentials'/'AUTHENTICATIONFAILED'/'Authentication failed' so a bad shared password doesn't trigger 11 LOGIN attempts per job
- lib/syncJobs.ts:378-395 spawnSyncWorker: only {payload, clientId} cross the process boundary; any per-user attribution for sync (none needed) or creds must be resolved in the worker from the DB
- lib/accountSettings.ts:4-27, lib/data.ts:60-86, app/api/accounts/[accountId]/settings/route.ts:11-21, app/components/mailclient/useAccountController.ts:331-344: split per-user preferences (new user_account_prefs table + endpoint) from account-level settings
- app/api/auth/login/route.ts:36-58 and app/api/auth/signup/route.ts:39-44: replace the IMAP-credential login (and its overwriting of DB imap+smtp passwords) with Bun.password verification against a new users.passwordHash column (lib/db/schema.ts:606-611)
- lib/db/schema.ts:613-617 user_accounts: add a role column; lib/db/users.ts:54-75 saveUserAccounts/addUserAccountLink must carry the role
- app/api/accounts/[accountId]/imap/stream/route.ts:54-63: clamp the maxIdleSessions query param, or move to one server-owned IDLE watcher per account fanned out to N SSE subscribers

## Gotchas
- The credential cache is keyed only by accountId and is process-global (lib/credentials.ts:9-20). With IMAP_CREDENTIALS_STORAGE=both or cookie, every request from any user overwrites it with that user's cookie creds, and the cache beats the DB. After a password rotation, one user with a stale cookie makes IMAP fail for everyone until that user logs in again. Use IMAP_CREDENTIALS_STORAGE=db for shared accounts and drop the overlay.
- The sessionCache is never cleared on logout (app/api/auth/logout/route.ts only clears the cookie), so creds stay in server memory after every user has logged out.
- The sync worker subprocess never sees session creds (lib/syncJobs.ts:384-395 passes only the payload), so it always uses the DB password. In cookie-only mode background sync cannot authenticate at all.
- The /imap/stream route is NOT shared. Each browser tab opens its own IMAP connections (INBOX + active folder, up to maxIdleSessions=3, route.ts:30,140-154) plus a fresh poll connection per interval (385-448). Add the pooled connection and the sync-worker connection, and N users x tabs quickly exceed provider per-login connection limits (e.g. Dovecot mail_max_userip_connections=10 per user+IP; all traffic comes from the server IP). A shared watcher per account is advisable.
- maxIdleSessions comes from the query string with no upper bound (stream/route.ts:54-57). The client currently doesn't send it, but it's an abuse vector once there are multiple tenants.
- Auth failures don't trip the IMAP circuit breaker (imapClientOptions.ts:354-357) and are retried by the sync worker (runSyncJob.ts:17-23). With a bad shared password, every user's stream reconnects and syncs hammer the IMAP server with failed LOGINs, which risks provider lockout or fail2ban. Add an account-level auth-failure latch.
- The local message store is per account (shared shard), so there is no per-user read/unread. \Seen is written to IMAP and to the shared messages row (messageFlagMutation.ts:100-112), and the thread unreadCount is recomputed globally. Per-user read state would need a new table, plus a decision on whether to keep writing \Seen.
- Setting 'answered' also sets \Seen (messageFlagMutation.ts:43-45), and compose sets \Answered on the original after a reply (ComposeOrchestrator.tsx:975). Both are shared IMAP state.
- Sync fetches use BODY.PEEK (imapflow) and there is no auto-mark-read on open. Read state changes only through explicit actions (MessageMenu.tsx:301, useMessageListHelpers.tsx:73, MailClient.tsx:3820/3832/5807/5812).
- The existing $Todo/$Done IMAP keywords (messageFlags.ts:4-5; UI useMessageMutations.ts:662-725; MCP mcpServer.ts:528-590) overlap with the planned per-thread status (open/pending/in_progress/done). Decide whether 'done' maps to $Done or the two stay independent. $Todo/$Done are per-message IMAP keywords, while planned status is per thread and local.
- syncOperation APP_LOCAL_FLAGS (syncOperation.ts:76) only covers calendar-invite, but LOCAL_ONLY_FLAGS (messageFlags.ts:10) also includes $NoctuaAI. A sync flag diff can drop $NoctuaAI. Don't store collaboration state as pseudo-flags in messages.flags; use dedicated tables.
- Thread IDs are derived from headers (lib/threading.ts:136-170: root Message-ID / In-Reply-To / References) and can shift when threads are recomputed or merged (threadRecomputeJobs). Message row ids are sha1 of the Message-ID (lib/messageIds.ts:27-40). Collaboration state keyed by threadId needs a merge/migration strategy. Keying sent-activity by Message-ID is stable.
- patchAccount/mergeAccount (rowParsers.ts:138-155) shallow-merges settings top-level keys, and the client always PUTs the full settings object (useAccountController.ts:331-344). Concurrent edits by two users are last-writer-wins. A full account PUT with blank imap/smtp passwords (client accounts are sanitized to '') overwrites the stored password with ''.
- PUT/DELETE /api/accounts/[accountId] (route.ts:12-42), /settings and /relogin have no role checks. Today any session whose active account matches can change IMAP host/user/password or delete the shared account. All of these need manager/admin gating.
- The relogin route lets the caller change imap.user (relogin/route.ts:26-49). It only verifies the creds against the same host, so a non-manager could repoint a shared account to a different mailbox. It also never updates the SMTP password.
- The current login (login/route.ts:47-57) overwrites BOTH the IMAP and SMTP DB passwords with the login password, assuming they are identical. This must go when login is decoupled.
- switch-account (switch-account/route.ts:25-43) copies account.imap.password (from the DB or from another user's cached session) into the caller's cookie when cookie-cred mode is on.
- The sync job registry and status route are per account, not per user (app/api/_helpers/syncJobs.ts:53-110). Two browsers syncing the same account are serialized and deduplicated (syncJobs.ts:594-670), which is safe. clientId (x-noctua-client, per browser, localStorage) is used only for logs and queue entries.
- The IDLE flags:update SSE event only patches client UI state (useSyncController.ts:1256-1283) and only for watched folders. The shared DB is updated by the request that made the change, so other users' views of other folders update only after a reload or sync.
- The SMTP From is always {account.name, account.email} (smtp.ts:37-40), and drafts are built the same way. Drafts are in the shared IMAP Drafts folder with no owner, so any user can open, edit or send another user's draft.
- Theme is per browser (localStorage 'noctua:theme', MailClient.tsx:96,3909). The compose translation target language is localStorage too (useComposeTranslation.ts:12). These aren't per user yet.
- Calendar reminders, the category model/feedback, topics, recipient aliases, DeepL config and CalDAV config are all per account, so with shared accounts every user sees and changes the same data. Reminders will notify every user.

## Q&A
### 1. How does a sync job obtain the account's IMAP password (session cache vs DB)? With two different users logged in to the same shared account, are there per-user IMAP sessions or per-account? Any shared-state hazards (idle session limits, maxIdleSessions per account, concurrency of two browsers syncing the same account)?
How credentials are resolved: accounts are loaded from the DB by mapAccountRow (lib/db/rowParsers.ts:68-116), which calls decodeSecret on imapPassword/smtpPassword. decodeSecret returns '' when IMAP_CREDENTIALS_STORAGE=cookie (lib/secret.ts:78-81). Every getAccounts/getAccountById/getAccountsForUser call then runs applyCachedCredentials (lib/db/accounts.ts:29,43,74). That function reads a process-global Map keyed only by accountId (lib/credentials.ts:9-37). The Map is filled by cacheSessionCredentials(session) on every authenticated request (lib/auth.ts:136-140) and on MCP requests (lib/auth.ts:311). If the cache has a password it wins (`cached.imap?.pass ?? account.imap.password`).

Sync jobs: startSyncJob (lib/syncJobs.ts:594-670) spawns `bun run scripts/runSyncJob.ts <json>` (spawnSyncWorker, syncJobs.ts:378-395). The JSON carries only {accountId, folderId, mode, fullSync, recategorizeFolder, backfillUids, clientId}: no credentials and no userId. In the child, runSyncOperationBatched calls getAccounts() with an empty cache (lib/syncOperation.ts:254-255), so the worker ALWAYS uses the DB-stored password. With cookie-only storage the worker gets an empty password.

Sessions are per account, not per user. Every user connects with the same account.imap.user and password. The interactive pool (lib/mail/imap/connectionPool.ts:157-216) is a single idle slot keyed by buildImapIdentityKey = [accountId, host, port, secure] (imapClientOptions.ts:151-158), shared by all users in the Next process. Each sync subprocess has its own pool and drains it on exit (runSyncJob.ts:74).

Hazards:
(a) Credential flapping. In 'both'/'cookie' mode the last request's cookie creds overwrite the cache for everyone, so a user with a stale password breaks IMAP for all users. The cache is never cleared on logout.
(b) Connection limits. /imap/stream is one SSE per browser tab, and each opens its own IDLE connections: INBOX + active folder, LRU-capped at maxIdleSessions (DEFAULT_MAX_IDLE=3, route.ts:30,54-57,140-154; read from account.settings.sync or an unbounded query param). It also opens a fresh poll connection every backgroundPollIntervalMs (default 900000ms server-side, route.ts:385-448). N users x tabs x roughly 3-4 connections on the same IMAP login quickly exceeds provider limits (Dovecot mail_max_userip_connections default 10, Gmail 15; all from the server's single IP).
(c) Each stream also writes mailbox_state (route.ts:221-231, 298-310) concurrently with other streams and the sync worker.
(d) Two browsers syncing the same account is safe. accountStates (syncJobs.ts:31-55) allows one running worker per account, joins identical intents (isSameSyncIntent 119-131, used at 633-645), prioritizes 'new' over 'full' (569-592) and caps the queue at 64 (85). The sync status endpoint checks only account access, not the user (app/api/_helpers/syncJobs.ts:53-110).
(e) A bad shared password is retried. The worker doesn't treat auth failures as fatal (runSyncJob.ts:17-23: up to 11 attempts) and the breaker ignores auth errors (imapClientOptions.ts:354-357), so every user's stream and sync keeps trying to LOG IN.

Recommendation: IMAP_CREDENTIALS_STORAGE=db, no creds in the session, remove the cache overlay, one server-owned IDLE watcher per account fanned out through lib/mail/imapStreamRegistry.ts, and an account-level auth-failure latch.

### 2. When user A marks a message read in a shared account, does it set \Seen on IMAP (shared for everyone)? Cite the flag update path. Which per-message states are IMAP-backed (seen, flagged, TODO/DONE keywords, topics keywords) vs local-only?
Yes. \Seen is set on the IMAP server and in the shared local DB, so it is global for all users. There is no per-user read state anywhere.

Flag update path:
- UI: updateFlagState / updateFlagStateBulk / updateFlagStateByIds (MessageMenu.tsx:301, useMessageListHelpers.tsx:73, MailClient.tsx:3820/3832 keyboard, 5807/5812 bulk).
- REST: POST /api/accounts/[accountId]/messages/[messageId]/flags (route.ts:10-58), or POST .../messages/flags/bulk (bulk/route.ts:96).
- applyFlagMutationsToMessage (lib/messageFlagMutation.ts:76-114) or applyFlagMutationsToMessages (134-206).
- buildFlagMutations (29-47) maps seen->'\\Seen' (MESSAGE_FLAG_MAP 10-16). 'answered'=true also adds \Seen (43-45).
- updateImapFlags / updateImapFlagsBulk (lib/serverImap.ts -> lib/mail/imap/mutations.ts:168-226): pooled client, mailboxOpen, then messageFlagsAdd/Remove with {uid:true}, i.e. UID STORE.
- After IMAP succeeds: updateMessageFlags / bulkUpdateMessageFlags (lib/db/messages/flags.ts:26-110) write the flags JSON and the seen/unread bits in the shared per-account shard, and the thread unreadCount is recomputed.

How other users see the change: IMAP IDLE 'flags' event -> SSE 'flags:update' (imap/stream/route.ts:338-346 -> useSyncController.ts:1256-1283; UI only, and only for watched folders), or the next sync's diffLocalAndRemoteWithFlags (syncOperation.ts:88-133). Sync fetches use BODY.PEEK, and there is no auto-mark-read when a message is opened.

IMAP-backed (shared on the server):
- \Seen.
- \Answered (also set after a reply, ComposeOrchestrator.tsx:975).
- \Flagged (the legacy 'pinned' keyword is normalized to \Flagged, messageFlags.ts:9,176).
- \Deleted and \Draft.
- $Todo / $Done keywords (messageFlags.ts:4-5), written through the same path with `keyword` (useMessageMutations.ts:662-725, MailClient.tsx:3763-3767, MCP updateTodoState mcpServer.ts:528-590).
- The NONJUNK keyword (messages/[messageId]/not-spam/route.ts:38-46).
- Folder membership (moves/deletes), Drafts, and Sent copies.

Local-only (stored in the shared per-account SQLite, still shared between users of the account):
- The 'calendar-invite' and '$NoctuaAI' flags inside messages.flags (LOCAL_ONLY_FLAGS messageFlags.ts:10, preserved by preserveLocalOnlyMessageFlags 197-205). Note that the sync diff only preserves calendar-invite (syncOperation.ts:76).
- Topics: thread_topics table, assigned per thread. topics.imapKeyword is generated (topics/core.ts:28-33,100) but IMAP keyword sync is explicitly not implemented (core.ts:53-60).
- Categories: messages.category/categoryScore/categoryManualState plus the category model.
- Calendar invite states, translations, reminders.
- xComposeFormat / quotedHtmlEdited / draftInvite (lib/messageLocalState.ts).

The planned assignee/status/comments should be new local tables keyed by accountId + threadId. They should not be IMAP keywords or entries in messages.flags.

### 3. How does sending work: From address, SMTP identity, Sent folder append. For a shared inbox reply, the From is the account email; where would 'sent by user X' be recorded (headers? local activity log)?
Compose send: POST /api/accounts/[accountId]/smtp/send (route.ts:30-203).
1. requireAccountContext (route.ts:54-59) gives {session, account, clientId}. session.userId is available but currently unused.
2. Message-ID is generated as `<uuid@domain-of-account.email>` (24-28, 138).
3. sendSmtpMessage(account, mail) (lib/mail/smtp.ts:103-116) is called. buildMailOptions (33-68) hard-codes From = {name: account.name, address: account.email}, adds User-Agent/X-Mailer and an optional X-Forwarded-Message-Id, and supports extra `headers` (MailPayload 10-31). The nodemailer transport authenticates with account.smtp.user/password (70-81).
4. The raw copy for Sent is built separately with buildRawMessage (smtp.ts:107). The route finds the Sent folder (findSentFolder) and calls appendImapMessage(account, sentMailbox, raw, ['\\Seen']) (route.ts:165-175; append errors are swallowed).
5. The response returns sentFolderId, sentMessageUid and messageId. Reply threading uses the client-supplied inReplyTo/references. The client then sets \Answered on the original.

Drafts:
- saveDraftForAccount (lib/drafts.ts:204-279) builds the raw with the same account From and APPENDs it to the shared IMAP Drafts folder with \Draft \Seen (255), deleting the previous draft UID. Drafts have no owner, so all users see and can send them.
- sendDraftForAccount (309-455) relays the stored raw through sendRawSmtpMessage with envelope.from = account.email (375-378), appends the same raw to Sent (386-400), then tombstones and deletes the draft.

The acting user is not recorded anywhere today.

Recommendation: record 'sent by user X' in a local activity log as the source of truth. Write a row right after a successful send in smtp/send/route.ts (after line 163) and in sendDraftForAccount (after line 378), containing {accountId, userId: session.userId, messageId, threadId resolved from inReplyTo/references, sentAt, type:'reply_sent'}. Message-ID is the stable join key: the Sent copy synced later gets row id buildImapMessageRowId(messageId) (lib/messageIds.ts:27-30), which is deterministic.

A header such as X-Noctua-Sent-By would leak internal identities to recipients if it went on the wire copy. It could go on the Sent copy only in the compose path, because raw is built separately at smtp.ts:107. That is not possible for draft-send, which uses one rawSource for both.

Optional: per-user From display name (e.g. 'Alice via Support'), set through buildMailOptions, and per-user signatures. The SMTP identity remains the shared account login.

### 4. Are there any per-user settings stored on the account (settings JSON) that would collide between users sharing an account (layout.defaultView, appearance, signatures, defaultSignatureId)? List them and suggest which should become per-user+account preferences.
Storage: AccountSettings (lib/data.ts:60-86) is stored as JSON in accounts.settings (schema.ts:586-604) and normalized by normalizeAccountSettings (lib/accountSettings.ts:4-27). It is written by PUT /api/accounts/[id] or /settings (settings/route.ts:11-21) through patchAccount -> mergeAccount. That merge is only a shallow merge of top-level keys (rowParsers.ts:153), and the client always PUTs the whole settings object (useAccountController.ts:331-344). The result is last-writer-wins between users, and none of these routes has a role check.

Keys and recommendations:
- sync.maxIdleSessions / backgroundPollIntervalMs / pollIntervalMs: consumed on the server by imap/stream/route.ts:54-63 and admin-only in the UI (accountSettings.ts:91; isAdminUser at MailClient.tsx:617). KEEP per account, manager/admin only.
- threading.includeAcrossFolders (MailClient.tsx:1975): per-user preference.
- layout.defaultView: 'card'|'table'|'compact'|'threads' (MailClient.tsx:5403). Per-user, and the new mobile layout will want its own value anyway.
- appearance.dateFormat (MailClient.tsx:1977): per-user, ideally global across accounts.
- appearance.senderIcons and appearance.topicColorRows (MailClient.tsx:5462-5464, 5618-5620): per-user.
- calendar.weekStartsOn: per-user.
- signatures[] and defaultSignatureId (compose: ComposeOrchestrator.tsx:143,266,558; useComposeController.ts:14-110). Split these: shared team signatures on the account, managed by managers, plus personal signatures and a per-user defaultSignatureId in user+account preferences.

Preferences stored outside the settings JSON:
- Theme is per browser in localStorage 'noctua:theme' (MailClient.tsx:96,3909). It should become a per-user preference for the light/dark work in D.
- The compose translation target language is in localStorage (useComposeTranslation.ts:12).

Other account-level shared data that users will share: CalDAV config, DeepL config/API key, topics, recipient aliases, category model and feedback, calendar reminders (these notify every user), and MCP tokens (which have createdByUserId).

Suggested shape: a new table user_account_prefs(userId, accountId, prefsJson, updatedAt) with a GET/PUT endpoint. Resolve with the order defaults < account.settings < user prefs. Settings are consumed on the server only for sync, so most of this change is client-side.

### 5. How does the relogin flow (AccountReloginDialog, /relogin route) behave when IMAP auth fails — does it require the IMAP password from the user? How should that work for a shared account where a non-manager user cannot know the password?
Current behaviour:
- Routes that call imapUpstreamErrorResponse (app/api/_helpers/imapUpstreamError.ts:19-46) map auth errors through getImapHttpError (lib/mail/imapError.ts:65-99) to HTTP 401 {code:'imap_auth_failed'|'imap_password_missing', reauthRequired:true, accountId}.
- In MailClient's error reader (MailClient.tsx:470-489), a 401 with reauthRequired and an accountId sets reloginAccountId. A plain 401 without reauthRequired logs the user out (authState 'unauth').
- Exception toasts can also open relogin: shouldOfferExceptionRelogin (clientHelpers.ts:75-109) -> handleOpenReloginFromException (MailClient.tsx:1919-1933).
- AccountReloginDialog (AccountReloginDialog.tsx:22-147) REQUIRES an IMAP user (prefilled) AND the IMAP password. It POSTs {imap:{user,password}} to /api/accounts/[id]/relogin.
- relogin/route.ts:20-75 checks only that the account is the session's active account (no role check). It runs verifyImapCredentials against the account's host with the supplied user (imapAuth.ts:10-39, skipBreaker), then patchAccount writes imap.user and imap.password to the shared DB row (only when DB storage is on). Finally it re-seals the caller's cookie with the new IMAP creds and the old SMTP password; the SMTP password is never updated.
- The login route (auth/login/route.ts:43-58) likewise verifies IMAP creds and overwrites both the IMAP and SMTP DB passwords.

Problems for shared accounts:
- Any user can rotate the shared credentials, or repoint imap.user to a different mailbox on the same host.
- PUT/DELETE /api/accounts/[id] are equally ungated.
- A failing password keeps being retried by every user's streams and syncs, which risks a provider lockout.

Proposed behaviour:
1. Treat credential failure as account-level state. Persist something like account.credentialStatus / lastAuthErrorAt, or an in-memory latch that stops sync workers (add auth patterns to runSyncJob.ts NON_RETRYABLE_PATTERNS) and stream reconnects until the creds change.
2. Gate /relogin, PUT/DELETE /api/accounts/[id] and the credential fields to manager/admin, via the role from user_accounts in requireAccountContext.
3. Return 401 reauthRequired with canRelogin:false for viewer/editor, or a distinct code such as 'mailbox_credentials_invalid'. The client then shows a non-actionable banner ('Mailbox credentials for X are invalid — a manager has been notified') instead of the password dialog. Managers get the dialog, extended to SMTP creds and without silently changing imap.user, or with a confirmation for it.
4. Since app login is now decoupled, IMAP auth failures must never log the user out. Keep the reauthRequired-vs-session-401 split at MailClient.tsx:475-488.
5. With IMAP_CREDENTIALS_STORAGE=db and no creds in cookies, a manager's fix takes effect for all users immediately. The fix should also reset the latch and the breaker (resetImapConnectFailureState, imapClientOptions.ts:251-257).

