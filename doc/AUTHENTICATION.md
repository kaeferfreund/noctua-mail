# Authentication

> Better Auth migration: cookie credential mode, sealed sessions, SESSION_SEAL_KEY, legacy IMAP login and Tauri desktop are retired; see [TEAM-INBOX.md](TEAM-INBOX.md) and [TEAM-AUTH-PLAN.md](TEAM-AUTH-PLAN.md).

This branch implements Team-Auth through Slice 5. Better Auth is pinned at 1.7.12.
`/api/ba/**` still returns 503 `auth_integration_pending`; backend activation belongs to Slice 6.
Legacy sealed cookies, credential overlays and cookie-only storage are retired. Signup uses the
invite provisioning saga; optional IMAP login stays OFF unless an explicit host allowlist enables it.
Nothing in this slice enables public Better Auth HTTP sign-in or deploys the integration branch.
Design v5 wins over plan shorthand: member GET is viewer-accessible; sync, recompute,
calendar sync and related-thread lookup are viewer capabilities even when their HTTP method is POST.

## Sessions and selection

`requireActiveUserSession(request)` uses Better Auth's real session plus the Noctua generation/
assurance sidecar, live enabled profile and both mandatory TOTP records. Restricted setup sessions
cannot access mail. Cookie refresh/deletion headers are forwarded. Absolute authentication age is
24 hours, independent of refresh. `/api/auth/me` retains enrollment/none/unselected/selected states.
Active mailbox selection is a UI preference and never authorizes the route's requested mailbox.

## Roles and account DTOs

`lib/accountAccess.ts` exports `AccountRole`, `ACCOUNT_ROLE_ORDER`,
`roleAtLeast(role: AccountRole | null | undefined, min: AccountRole): boolean`,
`resolveAccountRole(userId: string, accountId: string): Promise<AccountRole | null>`,
`listAccessibleAccountsForUser(userId: string)` (account, role, isOwner, memberCount),
`listAccountMembers(accountId: string)` (userId, email, name, role, isOwner, disabled), and
`teamFeaturesSupported(): boolean` (re-export of `lib/teamFeatures.ts`). Ownership grants manager;
ordinary membership takes its stored role. Admin overrides use the dedicated admin routes.
Missing membership returns 403 Forbidden; insufficient role returns 403 with
`message: "Insufficient mailbox role"` and `requiredRole`.
`AccountContext` includes `userId`, `role`, `account`, `accountId`, bounded `clientId`, and
`session.userId` for existing calendar/reminder callers. It carries refresh headers.

Account lists sort by display name (falling back to e-mail), normalized e-mail, then id.
`sanitizeAccountForClient(account, { role, viewerUserId, memberCount })` adds accessRole/isOwner/shared;
shared means memberCount > 1, counting an owner once. All secrets are blanked; viewer/editor also
lose IMAP/SMTP hosts and users, CalDAV, and all DeepL fields except enabled/targetLang.
An ownerless account with one member looks personal but never becomes a login identity.

## Members, preferences and administration

GET members permits viewers; viewer/editor responses omit disabled users and the disabled field.
PUT members requires an existing enabled target, a valid viewer/editor/manager role, and refuses
owner changes and self-role changes. DELETE permits self-removal but refuses the owner and last
remaining enabled manager (owner counts). Changes and audit rows share an immediate transaction.
Admin member routes apply the same owner/last-manager limits, with the documented self-rule override.
Admin mailbox creation verifies IMAP/SMTP, creates ownerless mailboxes, and never auto-links a user.
Only owner/admin can delete a mailbox; another manager receives the explicit owner-only 403.

GET prefs returns `{ok:true,prefs}` for the current user. PUT accepts the sparse preference object
itself; absent fields stay unchanged and null deletes a field. Unknown/userId keys are rejected.
The shape is layout, appearance, calendar, threading, defaultSignatureId and notifications.newMail.
PUT account/settings strips those personal keys unless `teamDefaults:true` is explicitly supplied.
New member/prefs/credential/token/admin mutations enforce JSON same-origin hygiene; bodyless member,
token and mailbox DELETE use the same-origin/bodyless convention. `x-noctua-client` uses the shared
64-character allowlist helper. No submitted credential is recorded as request metadata.

## Mailbox credential repair

`lib/mailboxCredentials.ts:updateMailboxCredentials(accountId, patch, actor, verification?)` is the
single repair/write-back service. PUT account, relogin and POST-existing use the shared HTTP handler
in `app/api/_helpers/mailboxPatch.ts`; Slice 4's optional IMAP bridge must call the service after its
strict eligibility/allowlist checks. POST-new remains pending provisioning; admin mailbox creation
uses its separate ownerless creation contract. Identity/id/e-mail/dbPath cannot be patched.
An IMAP/SMTP host, port, secure flag or username change requires a nonblank corresponding password.
Verification uses the new endpoint before persistence. Blank secrets preserve stored values.
Concurrent mailbox changes during verification produce 409; no verified stale patch is written.
SMTP follows a changed IMAP password exactly when the old normalized usernames match and the old
SMTP password was empty or equal to the old IMAP password; an explicit SMTP secret wins and is verified.
Explicit SMTP changes are always verified. Relogin accepts only the IMAP repair fields.

For an owned personal login address, host/user changes require owner/admin and stored credential
changes advance the owner's generation, delete sessions/tokens/challenges/grants in the same master
transaction, then close streams. This barrier also applies while optional IMAP login is disabled.
Ownerless/differently addressed shared mailboxes never acquire a personal identity through repair.
A manager can repair a shared mailbox without logging out its members' personal identities.

IMAP authentication failure returns 503, never the personal-auth Unauthorized contract:
`{ok:false,code:"mailbox_credentials_invalid",accountId,repairAllowed,reauthRequired,message}`.
Managers receive repairAllowed/reauthRequired true. Viewer/editor receive false and
"Mailbox unavailable; contact a manager", with enabled manager name/e-mail contacts. Credentials and raw
upstream errors are excluded. The shell owns dialog closure on downgrade and must never globally
log out for this mailbox DTO. Transport unavailability remains a separate 503.

## MCP

Tokens are `mcp_` plus 32 random base64url bytes. Only their SHA-256 hash and six-character suffix
are stored; the secret is shown once. Mint requires a live MFA-assured session, current generation,
complete TOTP enrollment and editor/manager access, atomically rechecked. POST accepts label and
optional ttlSeconds (default 30 days; range 60 seconds through 365 days).
Editor token GET/DELETE covers own tokens; managers can list/delete all mailbox tokens.
Every bearer request and tool use checks the live creator/profile/ban, both MFA records, non-NULL
current generation, expiry and current role. No cookie fallback. Each requested tool accountId must
repeat the bound mailbox; cross-mailbox calls require another token. Mutation tools require editor;
viewer downgrades retain read tools only. `list_accounts` exposes current accessRole. Tool registration
changes are limited to the binding/role checks, leaving thread-collaboration's tools to its branch.

## Stream and cleanup handoff

`lib/authStreams.ts` exports:

- `AuthStreamIdentity = {userId,sessionId,accountId?,generation,authenticatedAt,expiresAt,minRole?}`.
- `assertStreamAuthorized(identity): Promise<void>`: one coherent live DB snapshot of session,
  generation/assurance, verified factor and current role. Await immediately before sensitive enqueue;
  no intervening await. Queued/fetched events are checked anew.
- `registerAuthStream(identity, cleanup): {close():void, readonly closed:boolean}`: idempotent disposal,
  5-second idle liveness and absolute-expiry timers. It clears timers before invoking cleanup.
- `revokeAuthStreams({userId?,sessionId?,accountId?}): void`: publish after commit. Logout, membership
  revoke/downgrade, mailbox deletion and login-mailbox repair are wired here. Slice 4/5 factor,
  password and lifecycle finalizers must call it after their authoritative commits. DB checks already
  reject those changes even if notification/cleanup fails.

The IMAP SSE emitter guards fetched envelopes/counts/flags/removals and delayed polls. Cancellation,
abort and authorization failure dispose only this stream's clients/registry entry/timers. It never
stops a shared server mailbox watcher. Later per-user SSE must reuse this seam.

`lib/membershipCleanup.ts` exports
`cleanupUserAccountAccess(accountId:string,userId:string,actor:{userId:string|null,clientId:string})`
returning `Promise<{status:"not_installed"|"complete",unassigned:number}>`, and
`retryMembershipCleanup(operationId:string): Promise<boolean>`.
It opens the existing shard with create:false, never manufactures collaboration schema, and returns
not_installed when both tables are absent (including no shard yet). One table only, or a broken
installed schema, fails. With both installed it unassigns and writes one system unassigned activity
per affected thread in a retry-wrapped immediate transaction; repeated cleanup produces no duplicates.
Membership/token/prefs removal, audit and a secret-free admin_lifecycle_operations cleanup_pending
intent commit before shard work. Failure retains the intent and access stays revoked. Completion
clears the slot and preserves history. Stage 2 can substitute its unassignment implementation behind
this seam without importing threadCollab into team-auth. Slice 5 deletion must enumerate formerly
accessible accounts and reuse this seam before removing the banned identity.

## Route inventory

All paths in the following table are relative to `/api/accounts/[accountId]`.
Counts refer to HTTP handlers, including shared guards: 45 viewer, 40 editor, 14 manager.
The parameterized HTTP test (`lib/accountRouteRoles.test.ts`) inventories every exported handler
and exercises viewer→403 for every editor handler and editor→403 for every manager handler.
Mailbox DELETE additionally requires owner/admin; copy/move checks editor on both mailboxes.

| Method | Path | Minimum role |
|---|---|---|
| DELETE | `/` | manager |
| PUT | `/` | manager |
| GET | `calendar/conflicts` | viewer |
| POST | `calendar/conflicts/[eventId]/resolve` | editor |
| DELETE | `calendar/events` | editor |
| GET | `calendar/events` | viewer |
| POST | `calendar/events` | editor |
| DELETE | `calendar/events/[eventId]` | editor |
| GET | `calendar/events/[eventId]` | viewer |
| PUT | `calendar/events/[eventId]` | editor |
| POST | `calendar/events/[eventId]/respond` | editor |
| GET | `calendar/events/participation` | viewer |
| POST | `calendar/invites/process` | editor |
| GET | `calendar/sync` | viewer |
| POST | `calendar/sync` | viewer |
| GET | `categories/debug` | manager |
| POST | `categories/model/reset` | editor |
| POST | `categories/recompute` | viewer |
| GET | `categories/recompute/status` | viewer |
| GET | `compose/recipients` | viewer |
| GET | `destination-folders` | editor |
| POST | `drafts/[draftId]/discard` | editor |
| POST | `drafts/[draftId]/send` | editor |
| POST | `drafts/save` | editor |
| GET | `folders` | viewer |
| PUT | `folders` | manager |
| POST | `folders/[folderId]/consistency` | viewer |
| POST | `folders/[folderId]/delete` | manager |
| POST | `folders/[folderId]/rename` | manager |
| POST | `folders/create` | manager |
| GET | `imap/poll` | viewer |
| GET | `imap/stream` | viewer |
| GET | `mcp-tokens` | editor |
| POST | `mcp-tokens` | editor |
| DELETE | `mcp-tokens/[tokenId]` | editor |
| GET | `members` | viewer |
| GET | `members/candidates` | manager |
| DELETE | `members/[userId]` | manager |
| PUT | `members/[userId]` | manager |
| GET | `message-topics` | viewer |
| POST | `message-topics` | editor |
| GET | `message-topics/explain` | viewer |
| GET | `message-topics/suggest` | viewer |
| GET | `messages` | viewer |
| GET | `messages/[messageId]` | viewer |
| POST | `messages/[messageId]/archive` | editor |
| DELETE | `messages/[messageId]/attachments/[attachmentId]` | editor |
| GET | `messages/[messageId]/attachments/[attachmentId]` | viewer |
| GET | `messages/[messageId]/calendar-diff` | viewer |
| POST | `messages/[messageId]/category` | editor |
| POST | `messages/[messageId]/delete` | editor |
| POST | `messages/[messageId]/flags` | editor |
| GET | `messages/[messageId]/html` | viewer |
| POST | `messages/[messageId]/not-spam` | editor |
| POST | `messages/[messageId]/resync` | viewer |
| GET | `messages/[messageId]/source` | viewer |
| POST | `messages/[messageId]/spam` | editor |
| POST | `messages/[messageId]/translate` | editor |
| POST | `messages/[messageId]/unsubscribe` | editor |
| POST | `messages/copy-to-account` | editor |
| POST | `messages/delete/associations` | editor |
| POST | `messages/delete/bulk` | editor |
| POST | `messages/delete/linked-calendar` | editor |
| POST | `messages/flags/bulk` | editor |
| POST | `messages/move` | editor |
| GET | `prefs` | viewer |
| PUT | `prefs` | viewer |
| GET | `recipient-aliases` | viewer |
| POST | `recipient-aliases` | editor |
| DELETE | `recipient-aliases/[aliasId]` | editor |
| PUT | `recipient-aliases/[aliasId]` | editor |
| GET | `recipient-aliases/transfer` | viewer |
| POST | `recipient-aliases/transfer` | manager |
| GET | `related` | viewer |
| POST | `relogin` | manager |
| DELETE | `reminders` | viewer |
| GET | `reminders` | viewer |
| POST | `reminders` | viewer |
| GET | `search` | viewer |
| GET | `sender-icon` | viewer |
| PUT | `settings` | manager |
| POST | `smtp/send` | editor |
| POST | `sync` | viewer |
| POST | `sync/new-candidates` | viewer |
| GET | `sync/status` | viewer |
| POST | `thread/related` | viewer |
| GET | `threads` | viewer |
| POST | `threads/recompute` | viewer |
| GET | `threads/recompute/status` | viewer |
| GET | `topics` | viewer |
| POST | `topics` | editor |
| DELETE | `topics/[topicId]` | editor |
| PUT | `topics/[topicId]` | editor |
| DELETE | `topics/[topicId]/signals` | editor |
| GET | `topics/[topicId]/suggestions` | viewer |
| GET | `topics/stats` | viewer |
| GET | `topics/transfer` | viewer |
| POST | `topics/transfer` | manager |
| POST | `translation/compose` | editor |
| POST | `translation/test` | manager |

Additional entry points: GET /api/accounts lists current viewer-or-better memberships;
POST /api/accounts existing-id requires manager. listMessagesHandler, syncJobs and recomputeJobs
all use viewer context. POST /api/calendar/import resolves selection then requires editor on it.
Admin GET/POST /api/admin/accounts, DELETE /api/admin/accounts/[accountId], and PUT/DELETE
/api/admin/accounts/[accountId]/members/[userId] require a live MFA admin session.

## Remaining slice boundaries

Slice 4 now supplies challenge/assurance finalization, fresh proof/factor operations, strict optional
IMAP login, and the real WebAuthn browser harness described below. Slice 5 supplies the user provisioning/lifecycle/reset sagas below.
Slice 6 owns migration (reuse importLegacyProfileFields), canonical deployment documentation and
activation. Slice 7 owns actual auth/reset UI and phone/PWA acceptance. This slice does not activate
/api/ba, deploy, or claim end-to-end login acceptance. Slice 5's Noctua signup/admin wrappers are
implemented; successful signup remains restricted until Slice 6 activates factor-enrollment HTTP.

## Slice 3 verification (2026-10-22)

Parent baseline: 8ff60ed. Runtime: Bun 1.4.4; Better Auth 1.7.12; Next.js 16.2.4.

- `timeout 900 bun run test:ci`: exit 0; 1,872 server tests passed (213 files,
  4,726 assertions, 134.86s), then 12 DOM tests passed (3 files, 141 assertions, 10.45s).
- `timeout 1800 bun run test:stress`: exit 0; seed 1337, rerun-each=3;
  5,616 passed, zero failed (213 files, 14,178 assertions, 409.43s).
- Focused role/credential/MCP/prefs/stream/cleanup tests: 83 passed, zero failed
  (3 files, 413 assertions, 32.09s). The independent route inventory covers all 99 handlers;
  every editor/manager handler is exercised through its HTTP handler with a lower role.
- Additional live synthetic IMAP/SMTP fixture checks: 50 passed, zero failed. This runs
  all 48 SMTP coupling combinations across PUT, relogin, POST-existing and the future IMAP
  bridge's service entry, plus actual IMAP/SMTP rejection with unchanged persisted secrets.
  Only loopback servers and synthetic accounts were used; fixture processes were stopped.
- `timeout 600 bun run lint`: exit 1 at the exact baseline: one existing
  `react-hooks/set-state-in-effect` error in useCalendarConflicts.ts and 27 warnings;
  zero new errors or warnings.
- `bunx tsc --noEmit 2>&1 | grep -v 'bun:test'`: 151 existing diagnostics, zero new
  against a fresh `git archive HEAD` baseline (diagnostic comparison ignores shifted line numbers).
- `timeout 1200 bun run build`: exit 0; production compilation and all 22 static pages succeed.
- `git diff --check`: clean. `/api/ba` remains 503 and no public authentication activation occurred.

The remaining lint/type baseline is intentionally unchanged. Real WebAuthn, public optional IMAP
login, user lifecycle/reset, production activation and UI/phone acceptance remain in their assigned
later slices. Factor/lifecycle owners must publish post-commit stream notifications through the seam;
live DB checks already reject revoked state independently of those notifications.


## Slice 4: assurance and security operations

The source of truth is design v5 in the integration checkout (`repo/doc/TEAM-INBOX.md`),
§3.1.2, §4.1–4.4 and §10.1. Design wins over the plan's shorthand. The branch's older
TEAM-INBOX document is not an alternative policy. `/api/ba/**` remains externally 503;
Slice 6 alone activates the completed backend. No UI-shell files or deployment were changed.

`lib/authPolicyContext.ts` isolates immutable proof snapshots and verified metadata with
AsyncLocalStorage. HTTP headers cannot create an internal server-API scope. The policy plugin
in `lib/authPolicyHandler.ts` guards requests; its outer handler finalizes only after the library
returns, outside adapter transactions. UV callbacks validate UV and the same user, and only record
request metadata. Never finalize on the library connection or infer assurance from a user flag.

`lib/db/authPolicy.ts` reserves `admin_lifecycle_operations.slot=security:<userId>` before verification,
keeps no writer transaction open across awaits, and returns 409 `security_operation_pending` for
contention. Noctua writes retry whole synchronous immediate transactions on the master connection.
Initial TOTP finalization checks both records, advances generation and revokes other setup sessions,
grants, challenges and MCP tokens atomically. Only the returned live session receives MFA assurance.
Faults retain a durable intent and no newly assured bearer. Active destructive intents block mail,
MCP and streams. Startup cancels interrupted intents, advances generation and revokes their sessions;
current-process operations are not reconciled by later Next module-graph initialization. A stopped
replacement requires fresh login/proof after reconciliation or audited operator recovery, never a
session-only resume. Factor/password finalizers publish `revokeAuthStreams` after commits.

Known-user challenges bind generation and first-factor time. Anonymous passkey options snapshot
`auth_login_epoch` before the library call; credential/reset/revoke generation advances cancel them.
Missing, expired, mismatched or removed registry entries fail before verification and again atomically
at finalization. The registry uses `two_factor_imap` as a distinct two-factor kind to preserve the
first factor's `imap_totp` method without storing a mailbox password. IMAP write-back captures its
new generation/time after the credential service's revocation. Refresh, password changes, factor
rotations and UV reauth preserve `authenticatedAt`; only a complete new login restarts the 24h clock.

### Fresh-proof matrix and requests

`POST /api/auth/reauth` accepts only:
`{purpose,currentPassword?,totpCode?,backupCode?,proofMode?:"passkey"}`.
It enforces JSON same-origin hygiene and limits proof attempts to five/minute per user and IP.
Password means the app password if one exists; otherwise the eligible login-mailbox password,
which is unavailable while the IMAP allowlist is unset/empty. TOTP means a new verification, not the
session's original factor. A backup code is accepted only for `totp.replace`.

| Purpose | Required fresh proof |
|---|---|
| `totp.enroll` | Password and a restricted initial setup session |
| `totp.replace` | Password + current TOTP/UV, or password + a newly consumed backup code |
| `passkey.enroll` | Password + current TOTP, or same-user UV |
| `password.set` | Eligible IMAP password + TOTP/UV; extra factor waived only in restricted first onboarding |
| `password.change` | Current app password + TOTP/UV |
| `backup.regenerate` | Password + TOTP/UV |
| `passkey.remove` | Password + TOTP, or another same-user UV passkey |
| `passkey.rename` | Password + TOTP, or same-user UV passkey (same policy as enrollment) |
| `sessions.revoke` | Current credential + TOTP/UV |
| `admin.recovery` | Admin app password + TOTP/UV; Slice 5 additionally verifies the target out of band |

Password+UV uses `proofMode:"passkey"` with `currentPassword` for purposes that require password.
Only passkey enrollment/removal/rename permit UV without a password. The initial response is
`{ok:true,ceremonyRequired:true,grant,purpose,expiresAt}`: this is a ceremony intent, not a usable
operation grant. Send it as `x-noctua-reauth` on both installed passkey authentication options and
verification requests. Verification returns a replacement cookie and
`{...,ok:true,grant,purpose,expiresAt}` together. That final grant belongs to the resulting rotated
session; the old session is retired. Its absolute age/assurance ceiling is preserved. A UV removal
grant records the proving credential and cannot remove that same key.

For password/TOTP/backup proof, success is
`{ok:true,ceremonyRequired:false,grant,purpose,expiresAt}`. Times are Unix milliseconds; TTL is at
most 300000 ms. Keep capabilities only in memory and send them in `x-noctua-reauth`, never URLs.
Only SHA-256 hashes are stored. User/session/generation/purpose/state/expiry must match. A conditional
consume permits one winner; failed downstream work spends proof and requires fresh proof.

All Noctua mutation bodies reject unknown fields and require same-origin application/json.
`x-noctua-client` follows the shared 64-character allowlist convention. No passwords, codes, seeds,
reset URLs or full bearer tokens appear in journal/audit metadata.

| Endpoint | Body and result |
|---|---|
| `POST /api/auth/security/password` | `{currentPassword?,newPassword}` → `{ok:true}` + replacement cookie when changed; consumes `password.change` or `password.set`; 10..256 characters; server forces other-session revocation |
| `POST /api/auth/security/backup-codes` | `{currentPassword?}` → `{ok:true,backupCodes:string[]}` shown once; consumes `backup.regenerate`; advances generation, retains only proved current session and its age |
| `POST /api/auth/totp/replace` | `{currentPassword?}` → `{ok:true,grant,purpose:"totp.enroll",expiresAt,enrollmentRequired:true}` + rotated restricted cookie; consumes `totp.replace` |
| `POST /api/auth/security/sessions/revoke` | `{sessionId}` revokes exactly that owned session (including current only when explicitly named); `{all:true}` revokes all **other** sessions, retains the current session/absolute age and advances generation (also revoking MCP); consumes `sessions.revoke` → `{ok:true}`; explicit current-session revocation forwards deletion cookies |
| `POST /api/auth/security/passkeys/rename` | `{passkeyId,name}` → `{ok:true}`; consumes `passkey.rename`, checks ownership; trimmed name 1..100 characters, no control characters; no generation/assurance change |
| `POST /api/auth/security/passkeys/remove` | `{passkeyId}` → `{ok:true}`; consumes `passkey.remove`, checks ownership, revokes other sessions/tokens/challenges |
| `POST /api/ba/two-factor/enable` (internal until Slice 6) | `{password?,method?:"totp"}` + `totp.enroll` header → stock `{method:"totp",totpURI,backupCodes}` once; proof reserved for this seed |
| `POST /api/ba/two-factor/verify-totp` | `{code}` + same enrollment header for seed activation; ordinary login uses its signed first-factor challenge without an enrollment header |
| `GET /api/ba/passkey/generate-register-options` | `passkey.enroll` header; reserves the grant and binds it to the exact generated challenge |
| `POST /api/ba/passkey/verify-registration` | `{response,name?}` + same grant header; consumes on real UV success; `createSession:true` is rejected |

The stock library still checks body.password for enable/disable/backup regeneration when an app
password exists. UV never waives that requirement. `trustDevice:true` and public `disableSession`
are rejected. Registration has `requireSession:true`, library freshAge and server UV verification.
Raw enrolled-seed export, backup regeneration, disable, change-password, update-user/change-email,
delete-user, passkey mutation and mutating admin HTTP paths are disabled. Application code never
calls getTOTPURI/viewBackupCodes. Raw self-revoke routes also stay disabled for reviewed cleanup.

Lost-phone sequence: password login → stock backup-code verification consumes code A → assured
session → reauth with password and unused code B for `totp.replace` → replace → retain the returned
restricted cookie and `totp.enroll` continuation → enable with password and that header → verify a
real new TOTP with the same header → save new codes → next password/new-TOTP login. The login's
code A is never replacement proof. Stock `verifyBackupCode({disableSession:true})` uses the installed
encrypted CAS; two simultaneous proofs have at most one winner. Interrupted consumption cannot be
replayed. Old seed/codes, sessions and MCP generations fail after replacement.

Errors are local form responses `{ok:false,code}`. Missing/invalid sessions use 401 Unauthorized;
Noctua wrong password/TOTP/backup proofs consistently return HTTP 403
`{ok:false,code:"invalid_proof"}`, preserving the live session. Other policy failures use 403;
contention uses 409. Proof limits return HTTP 429 `{ok:false,code:"proof_rate_limited"}` with
`Retry-After: 60` (integer seconds, conservatively one full proof window; library account lockout
uses `Retry-After: 900`). Wait that interval before requesting fresh proof. These conventions cover
Noctua wrappers; raw Better Auth login forms retain their library-local error codes/statuses. Stable policy codes include
`reauth_required`, `invalid_proof`, `invalid_credentials`, `factor_proof_required`,
`backup_proof_not_allowed`, `another_passkey_required`, `passkey_uv_required`,
`invalid_challenge`, `security_state_changed`, `security_operation_pending` and
`mfa_state_inconsistent`. Library codes remain local to their form. Do not globally log out on
an incorrect password/TOTP/code. `SESSION_NOT_FRESH` requires full login, never changing createdAt.

### DTOs for ui-shell

`GET /api/auth/methods` is public, no-store, and returns
`{ok:true,methods:{password:true,passkey:true,imap:boolean}}`. Render the IMAP action only if imap
is true. No hostname/allowlist is exposed. Availability does not imply a particular user/mailbox
is eligible; failures remain generic. The production allowlist stays unset.

`GET /api/auth/me` retains the Slice 3 shape, with two additional security fields:
`security:{enrollmentRequired,reauthRequired,hasPassword,imapLoginAvailable,code?}`. Restricted
responses have minimal `{id,email,name}` identity, `accounts:[]`, `accountId:null` and
`mailboxState:"enrollment"`. Fully assured users retain selected/none/unselected states. `exp` is
Unix seconds of the smaller library/absolute expiry; no session token is returned.

`GET /api/auth/security` works without a mailbox and returns
`{ok:true,hasPassword,totpEnrolled,mfaStateInconsistent,enrollmentRequired,reauthRequired,
passkeys:[{id,name:string|null,createdAt:string,deviceType:string,backedUp:boolean}],
sessions:[{id,current:boolean,createdAt:string,updatedAt:string,userAgent?:string,ip?:string}]}`.
Session IDs are database resource IDs, never bearer tokens; user agents/IPs are bounded strings.
Restricted sessions get `passkeys:[],sessions:[]`. It never returns seed, stored backup codes, password hash,
credential public keys or a session token. New codes appear only in enable/regenerate responses.
A revoke-one transaction removes the session, sidecar, grants and source-bound library/Noctua
ceremonies and invalidates pending login challenges; it closes that session's streams after commit.
Revoke-all also invalidates all user challenges/grants and MCP generations. Other users are untouched.
All wrapper mutations require same-origin JSON, reject extra fields, consume one-use purpose-bound
proof and return no-store responses. Raw session list/revoke and passkey update paths stay disabled.

Examples (send the corresponding in-memory grant in `x-noctua-reauth`):

- Revoke another session: `POST /api/auth/security/sessions/revoke {"sessionId":"synthetic-session-id"}`
  → HTTP 200 `{"ok":true}`; an unowned/missing resource → HTTP 404
  `{"ok":false,"code":"session_not_found"}`.
- Revoke other sessions: `POST /api/auth/security/sessions/revoke {"all":true}` → HTTP 200
  `{"ok":true}`; the current cookie stays live. Explicitly name its ID to revoke the current session.
- Rename: `POST /api/auth/security/passkeys/rename {"passkeyId":"synthetic-key-id","name":"Home key"}`
  → HTTP 200 `{"ok":true}`; missing/unowned key → HTTP 404
  `{"ok":false,"code":"passkey_not_found"}`.
- Missing grant → HTTP 403 `{"ok":false,"code":"reauth_required"}`; expired/replayed/wrong-purpose
  grant → HTTP 403 `{"ok":false,"code":"invalid_proof"}`; malformed/mixed selectors, blank/oversized
  name or extra fields → HTTP 400 `{"ok":false,"code":"invalid_request"}`.

A plain `INVALID_PASSWORD` rejection on enable releases the slot only after the pinned library's
pre-write rejection and an unchanged factor/flag snapshot prove nothing was written. The spent
grant is discarded. Retry reauth with the correct credential. A setup session may explicitly abandon
a live/expired seed or replacement continuation by requesting fresh `totp.enroll` proof. Only the
idle `totp_seed_issued`/`replacement_setup` phases with disabled TOTP and no verified factor can be
claimed this way. It verifies the current credential under the slot, then atomically discards the
partial factor and old grants/challenges before issuing new proof. Failed proof restores the idle
phase. In-flight enabling/activation and interrupted writes cannot use this path; reconcile them.
Reconciliation atomically discards unverified/empty partial factors, resets the enabled flag when no
healthy verified factor exists, revokes proof/session/MCP state and releases the slot. The next
password login gets restricted setup and requires fresh credential proof. A healthy verified factor
committed before a finalizer fault is preserved and requires a normal fresh factor login.
An operation-pending code never grants permission to skip proof.

### Executable browser harness

Pinned `@playwright/test@1.58.2`; run `bunx playwright install chromium` followed by
`bun run test:auth-browser`. The runner creates synthetic isolated storage/secrets, builds Next,
starts a harness-only custom Bun Next server on **localhost:3784**, waits for readiness, runs
`playwright.auth.config.ts` and stops only its own child PID in finally. An occupied port fails;
there is no reuseExistingServer. `AUTH_BROWSER_USE_BUILD=1` reuses a freshly built bundle. The
shipped `/api/ba` route remains 503: `scripts/authBrowserServer.ts` supplies the internal handler
only in its own custom server. No application seed/test route or unsafe activation environment
flag exists. Seeds are created in process before listening. Local harness reset/revoke control is
`scripts/authBrowserInvalidate.ts`, never an HTTP endpoint. Production data/mailboxes are untouched.

`tests/browser/auth/fixtures.ts` intercepts a minimal page at the same localhost origin with
page.route; it drives real navigator.credentials.create/get using CDP virtual CTAP2 authenticators.
Tests cover real registration/assertion, server UV=false rejection, RP/origin mismatch, options/grant
binding, replay/wrong session, rotated UV grant binding, /me assurance and anonymous options invalidated
by actual reset-password redemption or explicit revoke. Chromium refuses preferred UV locally when
a UV-capable device reports failure: the negative fixture calls setUserVerified(false), then moves
its virtual keys to a non-UV authenticator so a preferred-UV ceremony reaches the server. Registration
also clears client-side excludeCredentials for that synthetic negative ceremony; production hints
stay required. A specific allowCredential selects the registered key for the negative assertion.
No callback or signature is mocked. Harness burst limits are disabled in its in-process library
context; server policy limiters are tested independently. HAR, screenshots, traces and video are off.

On this Ubuntu 26.04 ARM64 host, the plain Chromium install fails because Playwright 1.58.2 has no
ubuntu26.04-arm64 platform entry. The compatible Ubuntu 24.04 ARM64 build installs successfully:
`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 bunx playwright install chromium`.
Use the same override when running the harness. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun install`
is available for environments that install a compatible Chromium in a separate preparation step;
it does not skip browser verification and does not supply a browser by itself. This harness does
not replace canonical HTTPS acceptance on both household phones (Slice 7).

`.github/workflows/build-and-push.yml` installs Chromium with system dependencies and runs
`bun run test:auth-browser` as a CI gate. ARM developers run
`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 AUTH_BROWSER_USE_BUILD=1 bun run test:auth-browser`
after the required fresh build. The custom server still exercises the internal handler; compiled
`/api/ba` activation and full production wrapper routing remain Slice 6/7 acceptance requirements.
Local `scripts/authBrowserFault.ts` injects post-write finalizer faults only in isolated harness
storage; it is never mounted on HTTP. Real ceremonies test credential/session quarantine, another
live session's grant rejection, same-key removal rejection, another-key removal and password+UV
purposes beyond enrollment.

### Slice 5 handoff

Acquire the global admin-lifecycle slot before any target `security:<userId>` slot. Reuse the
request-scoped operation for nested services, not a client operation ID. Keep sensitive server API
calls in reviewed scopes; disabledPaths alone does not restrict server APIs. Both Noctua bodyless
logout and internal raw sign-out reserve the user slot, revoke sidecars/source proofs and pending
logins before the library cookie write, and preserve another session's settings ceremonies.
A security-operation conflict returns 409; the client must not clear local identity on failure.

Use `advanceSecurityGeneration`, `invalidateUserChallenges`, `readSessionSecurity` and
`finalizeAuthentication` on the Noctua handle with immediate transactions and publish stream
revocations after commits. `invalidateUserChallenges(...,true)` is the revoke-one/login-only form;
user-wide lifecycle revocation uses the full form. Reconciliation takes an optional cutoff; startup
passes process start so another Next module graph cannot cancel current-process work. Manual
operator reconciliation must run with the application stopped. Missing/partial factors remain
restricted; do not synthesize verified records or copy assurance from another session.

The `password.set` first-onboarding waiver now additionally requires a complete signup/migration
journal, no recovery history, and no `mfa-enrolled:<userId>` receipt. Initial MFA finalization records
that receipt, and an admin MFA reset preserves it. Slice 6 must record completed migration provenance
for an IMAP-only user's first onboarding; restricted setup alone never grants this waiver.

Slice 5 implements provisioning, admin target lifecycle/last-admin serialization, reset issuance,
request-scoped handover delivery sink and token-redemption policy exceptions below. The internal
handler permits the exact canonical callback/body contract without a session/factor requirement
for redemption. Credential triggers invalidate every
old generation and anonymous WebAuthn epoch; callbacks are cleanup only. Browser reset invalidation
already exercises the real server API redemption against isolated storage. Keep MFA intact on
password reset, reuse membership cleanup for deletion, and do not expose raw admin APIs or activate
`/api/ba` before Slice 6. Actual UI and canonical phone/PWA acceptance remain Slice 7.

### Slice 4 verification (2026-10-22)

Parent baseline: f9e8c73. Bun 1.4.4; Better Auth and passkey 1.7.12; Next 16.2.4.
All commands ran in wt-team-auth with TMPDIR=$PWD/.tmp and synthetic data.

- `timeout 900 bun run test:ci`: exit 0; 1,893 server tests (216 files),
  4,910 assertions, 152.20s; then 12 DOM tests (3 files), 141 assertions, 10.46s.
- `timeout 1800 bun run test:stress`: exit 0; seed 1337, rerun-each=3;
  5,679 passed, zero failed, 14,730 assertions, 216 files, 417.07s.
- Focused final policy and /me regression pass: 24 passed, zero failed, 174 assertions,
  2 files, 27.76s. Full CI/stress also include all six strict IMAP canaries and HTTP wrapper tests.
  Coverage includes two setup sessions, stolen passwordless seed/code attempts, each activation
  write/finalizer fault, challenge removal/generation invalidation, real 23h session age through
  password rotation, simultaneous proof and direct library CAS consumers, interrupted replacement,
  complete lost-phone/new-factor login, grant expiry/session/purpose/replay and old-code rejection.
- `timeout 600 bun run lint`: exit 1 at exactly the existing useCalendarConflicts.ts:58
  set-state-in-effect error plus 27 existing warnings; zero new findings.
- `bunx tsc --noEmit 2>&1 | grep -v 'bun:test'`: unchanged 151 existing TypeScript errors,
  compared with a separate `git archive HEAD` tree at f9e8c73; zero new errors.
- `timeout 1200 bun run build`: exit 0; production build includes the new guarded routes.
- Plain `bunx playwright install chromium`: exit 1, unsupported ubuntu26.04-arm64.
  `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 bunx playwright install chromium`:
  exit 0; Chromium/Headless Shell 145.0.7632.6, revision 1208 installed in the Playwright cache.
  With that override and `AUTH_BROWSER_USE_BUILD=1`, `timeout 900 bun run test:auth-browser`:
  exit 0; all five real WebAuthn scenarios passed in 8.9s against the freshly built custom Next
  harness at localhost:3784. No phone/canonical-production acceptance is claimed.

That earlier verification did not establish complete Slice 4 acceptance: review round 4 found
partial-activation recovery, slot release, missing session/rename contracts and proof-error gaps.
The round-4 changes and verification below supersede that completion claim. Public activation,
provisioning/admin reset controls, production origin/RP rollout, compiled mount coverage and actual
UI/phone acceptance remain assigned to later slices.


### Slice 4 review round 4 verification (2026-10-22)

Starting commit: ea8341b (team-inbox 0beb9a6 merge), clean `feat/team-auth` tree.
All scratch and test storage used worktree-local `TMPDIR=$PWD/.tmp`; no production data or
mailbox connections were used. Both permanent reviewer regressions failed before the fixes.

- `timeout 1500 bun run test:ci`: exit 0; 2,067 server tests, 224 files, 5,821 assertions,
  302.62s; then 53 DOM tests, 10 files, 340 assertions, 14.00s.
- `timeout 1800 bun run test:stress`: exit 0; seed 1337, rerun-each=3; 6,201 passed,
  zero failed, 17,463 assertions, 224 files, 710.71s. Includes all activation boundaries,
  abandoned setup/typo recovery, production library limits, first-password IMAP flows,
  session/rename ownership and proof errors, and full replacement old-TOTP/MCP rejection.
- `timeout 600 bun run lint`: exit 1; exactly the baseline useCalendarConflicts.ts:58 error
  and 27 warnings; zero new findings.
- `bun check` and `bun check --no-pretty --all`: exit 1; 151 non-`bun:test` diagnostics,
  unchanged from the merge baseline; zero new diagnostics.
- `timeout 1200 bun run build`: exit 0; includes the new session-revoke and passkey-rename routes.
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 AUTH_BROWSER_USE_BUILD=1 bun run test:auth-browser`:
  exit 0; 8 real WebAuthn scenarios passed in 15.5s against the freshly built harness.
  The second physical-device model is a separate virtual USB authenticator (Chromium permits
  only one internal authenticator). Registration and UV finalizer faults leave no returned
  usable grant/new session, and retain a quarantined intent until reconciliation.
- `git diff --check`: exit 0. The browser gate is now invoked by CI; compiled public mount
  activation, full UI routing and both-phone acceptance remain later-slice gates.

## Slice 5: provisioning, lifecycle and reset contracts

`lib/userProvisioning.ts` and `lib/db/userProvisioning.ts` implement signup. Every signup requires
an invite, even on an empty installation or a desktop-tagged request. App passwords are explicitly
validated at 10..256 characters before admin `createUser` (the pinned library omits its minimum).
The optional mailbox password never becomes the app password. Names are nonblank, at most 256
characters; personal e-mail is normalized, trimmed and validated, at most 320 characters.

`POST /api/auth/signup` requires same-origin JSON, limited to 3/minute/IP. Its internal setup sign-in forwards the wrapper-resolved trusted IP to the library limiter, so unrelated signup clients do not share an unknown-IP bucket. Example:

```json
{"inviteCode":"synthetic-invite","email":"person@example.test","name":"Synthetic Person","password":"synthetic-app-password","account":{"email":"personal@example.test","name":"Synthetic Mailbox","imap":{"host":"imap.example.test","port":993,"secure":true,"user":"personal@example.test","password":"synthetic-imap-secret"},"smtp":{"host":"smtp.example.test","port":465,"secure":true,"user":"personal@example.test","password":"synthetic-smtp-secret"}}}
```

Omit `account` to onboard without a mailbox. Its server-derived id/email must both be new; existing
mailboxes can only be granted via membership APIs. Existing normalized profiles (including legacy
profiles) return 409 `user_exists`; mailbox/shared-address collisions return 409 `mailbox_exists`,
before reservation or network. Invalid, expired or wrong-person invites return 403 `invalid_invite`;
exhaustion returns 409 `invite_exhausted`, all with zero outbound IMAP/SMTP calls. The empty-install
first person needs the startup admin invite (`bootstrap_invite_required` otherwise). A pending
bootstrap returns 409 `bootstrap_pending`; a generic bootstrap admin invite cannot be used after
bootstrap (`bootstrap_invite_closed`). Targeted admin invitations remain usable only while their issuer remains an enabled admin.

Admin-issued targeted and generic invitations carry `issuedByUserId`, `provenance:"admin"`,
and nullable `revokedAt`. Preflight rejects revoked invites and missing/banned/demoted/incomplete
issuers with 403 `invalid_invite`, before network or reservation. The same live authority check runs
inside reservation and finalization transactions. Demotion/ban revokes the issuer's outstanding
invitations in the **same library write transaction**, with one secret-free `invite.revoke` audit
(count/reason/actor/issuer; no invite capability). Unbanning/promoting never revives them.
Operator/bootstrap invitations have `provenance:"operator"`, no issuer, and retain their existing
bootstrap/email/capacity checks. On provenance-schema adoption, historical unbound bootstrap/generic
invites retain that operator authority; historical email-bound invites with unknown issuers are
revoked and must be reissued. This is additive schema adoption, not an identity migration.

The read-only invite preflight precedes optional IMAP/SMTP verification. A subsequent immediate
transaction rechecks identity/mailbox/invite authority, expiry, e-mail binding and capacity, counting
active reservations, and reserves the exact intended user ID. No transaction crosses an await.
Request-scoped creation metadata supplies that ID to the library create hook; SQLite triggers mirror
the identity. Unauthenticated headerless server creation outside provisioning/migration is rejected
with `provisioning_required`. The final immediate transaction inserts a new mailbox (never REPLACE),
manager membership, invite claim, audit and `complete` together.

201 response is `{ok:true,userId,accountId:null,security:{enrollmentRequired:true},loginRequired:false}`
with a **setup-only** session cookie. If the independent post-commit sign-in fails, the same 201 has
`loginRequired:true` (including a thrown sign-in error); provisioning remains committed and the client proceeds to login. The new mailbox is not selected or returned in this DTO; it is discovered through `/api/auth/me` after enrollment. No mailbox
access exists until fresh proof/TOTP activation finalizes that session. Malformed input is 400
`invalid_request`; contention is 409 `provisioning_pending`; internal failure is 503
`provisioning_failed`. Signup errors use `{ok:false,code}`. All responses are no-store.

Active journal states are `reserved`, `auth_created`, `cleanup_required`; only these reserve e-mail
and invite capacity. `complete`/`cancelled` history remains by operation ID, permitting deletion and
re-invitation. Compensation deletes only the reserved identity; final domain writes/claims are atomic
with completion, so it never decrements another operation's invite. Compensation failure retains
`cleanup_required`; startup reconciles pre-process-start operations and rejects incomplete users at
login/session/MCP boundaries. Manual reconciliation requires the app stopped; never cancel live slots.

### Admin lifecycle and personal handover

All `/api/admin` paths require an active, MFA-assured admin. JSON mutations use same-origin hygiene;
every successful mutation records secret-free audit. `GET /api/admin/audit?limit=&before=` returns
`{ok:true,entries:[...],nextCursor:string|null}` with newest-first `(createdAt,id)` pagination.
`limit` defaults to 100 and is clamped to 1..500; pass `nextCursor` unchanged as `before`.
The complete read schemas and round-6 migration are below.

`GET /api/admin/users` returns exactly:

```ts
{ok:true, users:Array<{
  id:string; email:string; name:string|null; role:"admin"|"user"; createdAt:number;
  hasPassword:boolean; disabled:boolean; twoFactorEnabled:boolean; passkeyCount:number;
  passkeys:Array<{id:string; name:string|null; createdAt:number|null}>;
  accounts:Array<{id:string; name:string; email:string; role:"viewer"|"editor"|"manager"; isOwner:boolean}>;
}>}
```

Users sort by creation time, accounts by email. Each account describes the **target user's**
membership: owners are manager/isOwner:true even without a link; non-owners use their stored
membership role and isOwner:false. Unrelated accounts are absent. No connection credentials,
password hashes, session tokens or viewer-admin role overrides appear in this DTO.

`GET /api/admin/invites` returns metadata only:
`{ok:true,invites:[{id,email,issuedBy,createdAt,expiresAt,status}]}` (full schema below).
The redeemable `code` appears only in the issuance response, never in history.
`POST /api/admin/invites` accepts same-origin JSON `{}` (an empty body with the same JSON hygiene
is also accepted for the existing client). It deliberately issues a generic single-use user invite,
`email:null,expiresAt:null`, via the same authority/serialization/audit service as targeted issuance.
The 201 response is `{ok:true,invite}`; generic redemption still uses ordinary signup. Local
`createInviteCode` is operator-only storage authority; it is never the HTTP issuance boundary.

- `POST /api/admin/users` JSON `{email,name,role:"admin"|"user"}` → 201
  `{ok:true,invite:{code,email,role,maxUses:1,uses:0,createdAt,expiresAt,usedByUserId:null}}`.
  Invitation TTL is one day; additive fields are `issuedByUserId`, `provenance:"admin"`, `revokedAt:null`. Hand over the code personally; no user/password/session is created.
  The invite's e-mail binding is checked again on signup; the person chooses their own name/password.
- `PATCH /api/admin/users/[userId]` sparse `{name?,role?,disabled?}` → `{ok:true}`. Names use
  `auth.api.adminUpdateUser` for the target; `updateUser` remains a self-only library API. Role/status
  use `setRole`, `banUser`, `unbanUser`; disable is permanent. These operations revoke target
  sessions/MCP/challenges; enabling never restores them.
- `DELETE /api/admin/users/[userId]` JSON `{reassignOwnerTo?:userId}` → `{ok:true}`. An owner needs
  another existing enabled target (400 `invalid_owner` / 409 `owner_reassignment_required`). Ban,
  revoke and persist formerly accessible account IDs before domain/shard cleanup. Memberships,
  prefs and ownership are changed transactionally; `cleanupUserAccountAccess` handles each shard
  without installing future collaboration tables. Only then does plugin `removeUser` run. A failed
  cleanup leaves the identity banned and the durable slot held. Startup retries idempotently using
  local adapter authority after shard cleanup; it does not fabricate an admin session.
- `POST /api/admin/users/[userId]/recovery` JSON `{confirmedTarget:true}` additionally requires a
  fresh `admin.recovery` grant in `x-noctua-reauth` (admin app password + freshly verified TOTP/UV).
  `confirmedTarget` is the admin's explicit assertion of personal out-of-band identity verification.
  Response `{ok:true,url,expiresIn:900}` returns the secret link once, for personal handover only.
  Older reset links and existing sessions/MCP/challenges are revoked before a new link is issued.
- `POST /api/admin/users/[userId]/mfa-reset` JSON `{confirmedTarget:true}` uses the same fresh proof,
  revokes access, removes TOTP and returns `{ok:true,enrollmentRequired:true}`. Existing passkeys stay;
  the user still needs fresh first-factor proof and new verified TOTP before mail access. Password
  recovery remains a separate operation. The first-onboarding password waiver cannot reappear.
- Bodyless `DELETE /api/admin/users/[userId]/sessions` and
  `/api/admin/users/[userId]/passkeys/[passkeyId]` require a fresh `admin.recovery` header and return
  `{ok:true}`. Passkey ownership is checked (404 `passkey_not_found`); all old target access is revoked.

The unique `admin-lifecycle` slot is acquired **before** actor/target security slots. Self-demotion,
self-disable and self-delete fail 403 `self_admin_mutation_forbidden`; removing the last enabled
admin fails 403 `last_admin`. Incomplete provisioning cannot count as a replacement admin. Concurrent
requests receive 409 `admin_operation_pending` or `security_operation_pending`. Mutation/audit faults
retain access-denying user slots; startup cancels interrupted updates with an audited reconciliation
and revokes old access, while interrupted deletion must finish cleanup. Never resume a failed mutation
by client operation ID. The service intentionally reports partial downstream failures as 503
`admin_operation_failed`; re-fetch status after operator reconciliation instead of replaying blindly.

All mutations through the user lifecycle wrapper (PATCH, DELETE, targeted/generic invite issuance,
recovery, MFA reset, passkey removal and session revocation) share a 10-attempt/minute **actor**
budget and a separate 30-attempt/minute **IP** budget. Both successful and failed authorized
attempts count, across action types and targets; changing IP cannot evade the actor budget and
changing actor cannot evade the IP budget. Limits precede JSON parsing and service calls, after
same-origin and admin checks. Exhaustion is 429 `{ok:false,code:"admin_rate_limited"}` with
`Retry-After: 60`. IP resolution uses existing `TRUSTED_PROXY_HOPS`; proxy sanitization remains required.
These are process-memory windows, reset by restart.

Recovery/admin-security attempts additionally retain the stricter 3/minute/admin limit: 429 `recovery_rate_limited`,
`Retry-After: 60`. Missing/stale/wrong-purpose grants fail 403 `reauth_required` / `invalid_proof`;
missing explicit target verification fails 400 `target_verification_required`; unknown target is
404 `user_not_found`. Invalid sessions are 401; insufficient authority is 403. Mutations and secret
handover responses set `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.

Local lockout equivalent (local DB/auth/encryption-key access is operator authority): **stop service →
run recovery → start service**. Stop the app,
then run from the worktree, with a private terminal and shell tracing/session recording disabled:

```sh
bun --env-file=.env.local scripts/recoverTeamAuth.ts --application-stopped --confirm-personal-handover --user-id <id>
```

Auth startup and the recovery script acquire the same Linux `flock(LOCK_EX|LOCK_NB)` on
`<canonical database directory>/main.db.auth.lock` **before auth initialization or reconciliation**.
The application holds it for its process lifetime, including DB connection teardown/reopen; the
operator holds it until the script exits. A held lock makes the other process refuse immediately;
`--application-stopped` records intent and cannot bypass this check. Never remove/replace the lock
file while a process might hold its inode. Multiple server processes sharing one datastore are
intentionally refused. The lock requires the Bun Linux FFI/libc runtime, already the server platform.

Normal exit clears metadata and closes the descriptor; crash/SIGKILL releases the OS lock.
An orphaned metadata record is automatically accepted only with a valid PID/acquisition timestamp
and a different/missing `/proc` process start stamp (boot ID + start ticks prevents PID reuse).
Ambiguous metadata, inaccessible liveness data or a future timestamp fail closed. After independently
verifying the service is stopped, the operator may add `--override-stale-lock`; it still cannot
bypass a held OS lock and writes `operator.lock_override` before auth reconciliation. No secret or
reset URL is stored in that audit. Start the service only after recovery has exited.

It reconciles interrupted work, records actor `operator`, and prints the link once. It never changes
MFA, chooses a password, sends SMTP, or logs the link in the audit trail. Restart after successful
reconciliation. A disabled user stays disabled; password recovery never unbans them.

### Reset handoff for ui-shell Slice 7

Production `BETTER_AUTH_URL` is `https://mails.monkeymed.de`; the sole callback is exactly
`https://mails.monkeymed.de/reset-password`. Isolated preview/test data uses its own configured
origin plus `/reset-password`, never another trusted origin/path/query. Issuance calls server
`requestPasswordReset` with a request-scoped `sendResetPassword` handover sink. No global delivery
variable, SMTP sender configuration or `/api/auth/recovery/request` exists. Raw issuance stays blocked.

The following routes are allowed **inside the policy handler**, but the mounted `/api/ba/**` still
returns 503 `auth_integration_pending` externally until Slice 6:

1. Unauthenticated `GET /api/ba/reset-password/:token?callbackURL=<exact callback>` → 302 to
   `/reset-password?token=...` or `/reset-password?error=INVALID_TOKEN` for expiry/missing/reused token.
   A different callback fails 400 `invalid_callback` (foreign origins can fail 403 `INVALID_ORIGIN`).
2. Unauthenticated same-origin JSON `POST /api/ba/reset-password` **only** `{token,newPassword}`
   (10..256 chars). No query token, extra fields, session or MFA grant. 200 `{status:true}` creates
   no session/cookie. Token expiry is 900 seconds; consumption and password change are transactional
   with library session revocation. Expired/reused tokens fail 400 `INVALID_TOKEN`; malformed shape
   fails 400 `invalid_request`; concurrent attempts have one winner (the other may receive retryable
   409 `security_operation_pending`). Redemption is limited to 5/minute/IP by the library. Its 429 response is `{message:"Too many requests. Please try again later."}` with `X-Retry-After` seconds (the pinned library header). Wrapper 429s use `Retry-After`.

MFA survives password reset. A durable reset intent records the prior generation without the token;
startup can finish stale-row deletion and the missing audit even after the one-use token is spent.
Credential-generation triggers invalidate every old bearer generation,
reauth grant, registered login/settings challenge and anonymous WebAuthn epoch **at password commit**.
`onPasswordReset` only deletes stale MCP rows, writes audit and publishes stream closure. Tests hold
and then throw that callback: the actual bearer validator already rejects the old token while its
row is still present. Raw internal password writes and caller revocation flags cannot bypass the
generation checks. Password-change wrappers force other-session revocation and reject unknown flags.

The reset page belongs to ui-shell. Copy the token to ephemeral memory, immediately replace browser
history with `/reset-password`, exclude analytics, and clear token/password state on success/unmount.
Next sets no-store/no-referrer on the page; both handler redemption paths carry those headers too,
including errors/redirects. Next request logs ignore reset paths; `redactAuthUrl` strips capabilities
for future logging callers. Slice 6 must configure proxy access-log redaction/omission for reset paths
and query strings. Never persist links/tokens in logs, localStorage, audit or crash diagnostics.
After success return to normal login and existing MFA. A post-commit callback failure can return 5xx
although the new password is committed: offer login or a new personally handed-over link, never
silently retry the password mutation. Slot reconciliation is independent of the spent reset token.

### Slice 5 verification (2026-10-22)

Parent `e3aad60`; Bun 1.4.4, Better Auth 1.7.12, Next.js 16.2.4. Heavy commands ran with
`nice -n 10`, scratch in worktree-local `.tmp`, synthetic identities/storage only.

- `timeout 1500 bun run test:ci`: exit 0; 2,104 server tests (226 files, 232.17s),
  then 53 DOM tests (10 files, 12.32s), zero failures.
- `timeout 1800 bun run test:stress`: exit 0; seed 1337, rerun-each=3;
  6,312 passed, zero failed, 18,009 assertions, 226 files, 652.59s.
- `timeout 600 bun run lint`: exit 1; unchanged baseline of one error in
  `app/components/calendar/useCalendarConflicts.ts:58` plus 27 warnings; zero new findings.
- `bun check` and `bun check --no-pretty --all`: exit 1; unchanged 151 non-`bun:test`
  diagnostics. Comparing normalized diagnostic sets with the clean-parent capture adds/removes zero.
- `timeout 1200 bun run build`: exit 0, including all new admin routes; public BA mount stays 503.
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 AUTH_BROWSER_USE_BUILD=1 bun run test:auth-browser`:
  exit 0; eight actual Chromium/WebAuthn scenarios passed in 14.6s, isolated storage on port 3784.
- `git diff --check`: exit 0. `lib/teamAuthSlice5.test.ts` adds 29 cases (including parameterized
  provisioning write faults); `app/api/admin/users/route.test.ts` adds the full HTTP handoff case.
  Coverage includes owned shared-address rejection, incomplete owner/admin rejection, benign missing
  passkey slot release, two first-admin/invite contenders, retained cleanup, delete/re-invite/recovery,
  target-name separation, real proof issuance, expiry/reuse/parallel reset, preserved MFA, actual MCP
  bearer rejection during a suspended failing callback, and independent restart audit completion.

These results verify backend contracts and the retained WebAuthn harness. Compiled public HTTP
activation/migration/proxy log configuration remain Slice 6; the reset page, complete UI and physical
phone/PWA acceptance remain Slice 7. No push, PR or deployment is part of this slice.


## Fix round 5 contract changes

Slice-7 handoff (signup):

- Old: `{ok:true,userId,accountId:null|string,enrollmentRequired:true,loginRequired:boolean}`.
- New: `{ok:true,userId,accountId:null,security:{enrollmentRequired:true},loginRequired:boolean}`.
  Read the nested security flag; the flat flag is removed. `userId` and `loginRequired` are additive
  extensions to the canonical restricted-enrollment DTO. A mailbox supplied at signup is committed
  but never presented as selected during enrollment. Discover it through `/api/auth/me` after
  enrollment. Failed/throwing post-commit sign-in returns 201 with `loginRequired:true`; proceed to
  login without replaying signup. Successful sign-in still forwards only a setup-session cookie.

Admin consumers: GET users previously reused a sanitized account based on the viewing admin,
with `accessRole:"manager"` and viewer ownership. It now returns target-specific accounts exactly
`{id,name,email,role,isOwner}`; connection presentation fields are removed. Generic invite issuance
now shares the audited lifecycle boundary; both invite DTOs add issuer/provenance/revocation metadata.
Destructive admin wrappers can now return 429 `admin_rate_limited`, `Retry-After:60` (10/minute/actor,
30/minute/IP, shared across actions). The stricter recovery/admin-security 3/minute/actor limit remains.

### Fix round 5 gate ownership

The following §10 gates are exercised in this fix round: issuer revocation before verification and
across both awaits; reservation/finalization collision compensation; exact 403/409 error codes;
application/operator lifetime exclusion, crash/stale-lock handling and audited override; target
membership DTOs; shared audited targeted/generic issuance; actor/IP wrapper 429s across actions and
Next module graphs; canonical signup with/without a mailbox and failed/throwing post-commit sign-in;
real library reset limits, throttled-token preservation and subsequent redemption; desktop-tagged
HTTP signup, including empty installation; recovery reserve/mint/audit/complete/release faults with
two reconciliations; self-demotion/self-disable; and ban/unban/role/delete/disable-audit failures.

Inherited gates are retained and rerun through CI/stress and the reviewer-probe copy: core auth
migration idempotency and transactional mirrors, dedicated-writer contention/rollback controls,
assurance/factor/session/challenge generation, raw-admin-path denial, all nine concurrent last-admin
mutation pairs, MFA-preserving reset, callback-independent MCP revocation, shard cleanup and
secret-free audits. The eight real Chromium/WebAuthn scenarios remain the Slice-4 fixture acceptance,
not the actual Slice-7 screens. The fixture invalidation helper now avoids a second auth startup:
reset redeems via the running server; synthetic revocation abandons only its named fixture user's
ceremony, without startup reconciliation of the live server.

Deferred to the integration/release owners: activated compiled public `/api/ba` smoke (the mount is
still deliberately 503), identity migration/cutover/backup restore, deployed proxy logging and TLS/DNS
acceptance (Slice 6); real login/enrollment/reset UI, both phones and PWA flows (Slice 7); collaboration
and mailbox-watcher integration acceptance; and a dedicated mixed signup/password-change/ban versus
Noctua-write concurrency workload. The inherited dedicated-connection tests and randomized suite
establish their stated controls, not that unimplemented mixed workload. No deployment, production
network/mailbox access, desktop retirement or migration script is included in this round.

The archived reviewer runner hardcodes another worktree, old commit `48b1612` and port 3786.
`tests/runTeamAuthSecurityControls.sh` is its current-worktree adaptation, with a read-only source
copy, isolated network/PID namespace, allowlisted environment, bounded scratch/resources and S1/S2
rejection assertions in `tests/teamAuthSecurityControls.test.ts`. It leaves the retained briefs
unchanged and uses only allowed ports 3784/3785 (the backend probes need no listener).


### Fix round 5 verification (2026-10-22)

Base `2458a09` (merge above `48b1612`); branch `feat/team-auth`. All execution used
worktree-local `.tmp`/TMPDIR and synthetic data; heavy commands used `nice -n 10`.

- `timeout 1500 nice -n 10 bun run test:ci`: exit 0; 2,173 server tests in 228 files
  (423.97s), followed by 69 DOM tests in 13 files (18.53s), zero failures.
- Randomized targeted rate/signup reruns (seed 1337, rerun-each=3): 12 passed, zero failed,
  126 assertions. Valid unique documentation-range IPs prevent retained limiter buckets from
  leaking across Bun module reruns; production setup sign-in forwards the wrapper-resolved IP.
- `timeout 600 nice -n 10 bun run lint`: exit 1, the same pre-existing calendar effect error
  and 27 warnings; no new findings.
- `bun check --no-pretty --all`: exit 1, 151 non-`bun:test` diagnostics. A clean `2458a09`
  archive has the same 151; normalized diagnostic sets add/remove zero. The requested filtered
  `grep ... | wc -l` command also returns 151.
- `timeout 1200 nice -n 10 bun run build`: exit 0.
- ARM override + `AUTH_BROWSER_USE_BUILD=1 bun run test:auth-browser`: exit 0; eight real
  Chromium/WebAuthn scenarios passed in 16.0s on port 3784, with the corrected isolated fixture helper.
- `nice -n 10 bash tests/runTeamAuthSecurityControls.sh`: exit 0; 141 tests in five files,
  zero failures, 778 assertions (91.40s). This includes all original 105 test entries, with S1/S2
  changed from defect observations to rejection assertions, plus the new boundary cases.

- `timeout 1800 nice -n 10 bun run test:stress`: exit 0, seed 1337, rerun-each=3;
  6,519 passed, zero failed, 19,422 assertions in 228 files (1011.94s).
- `git diff --check` and `git diff --cached --check`: exit 0. No push, PR or deployment.

## Fix round 6 contract changes

These are the server contracts for the admin and members clients. Common active-session/MFA
and admin guards remain required; an admin has no implicit membership through manager routes (D6).
All timestamps in the following read DTOs are Unix milliseconds, unless explicitly nullable.

- G1: no manager user directory → `GET /api/accounts/[accountId]/members/candidates?q=&limit=`
  requires an actual manager context and returns
  `{ok:true,candidates:Array<{id:string,name:string|null,email:string}>}`. Only enabled, completely
  provisioned non-members are included; the implicit owner is excluded even without a membership
  row. `q` is a case-insensitive literal substring of name or email, trimmed; maximum 128 characters
  (400 `invalid_request` if exceeded). Empty search is allowed. `limit` defaults to 25, is clamped
  to 1..100, floors fractions, and uses 25 for non-finite values. Results sort by lowercased
  name (email when empty), email, then id. This is a capped search, with no paging cursor.
  Responses carry `Cache-Control:no-store`. Like the existing members GET, no read limiter exists;
  this route adds neither read audits nor a separate limiter.
- G2: message-only membership policy errors → `{ok:false,code:string,message:string}` on both
  `PUT/DELETE /api/accounts/[accountId]/members/[userId]` and
  `PUT/DELETE /api/admin/accounts/[accountId]/members/[userId]`. Existing messages are preserved.
  Codes: `owner_immutable` (403), `self_role_change` (403, manager route only), `last_manager`
  (403), `target_disabled` (400, includes incomplete provisioning), `target_missing` (400),
  `above_manager` (400, unsupported role), `not_member` (404, DELETE without a membership).
  Missing userId is 400 `invalid_request`; service authorization/account errors use
  `insufficient_role`/`account_not_found`. Shared guard failures also gain the code/message
  envelope: `unauthorized`, `forbidden`, `account_not_found`, `invalid_request` as applicable;
  existing explicit guard codes (for example `invalid_origin`, `json_required`) are preserved.
  Refresh headers and additional guard fields are preserved.
  Admin routes still override self-role restrictions, and still enforce owner and last-manager rules.
- G3: `passkeyCount` only → additive `passkeys:[{id,name,createdAt}]` in GET users (schema above).
  `id` is the opaque resource id accepted by
  `DELETE /api/admin/users/[userId]/passkeys/[passkeyId]`, never a WebAuthn credential id.
  `name` and `createdAt` may be null when absent in Better Auth storage. `lastUsedAt` is omitted:
  Better Auth 1.7.12 stores no passkey last-use timestamp. No public key, credential id, counter,
  transports or backup data is exposed. The fresh `admin.recovery` proof is still required;
  ownership mismatch returns 404 `passkey_not_found`. The successful `user.passkey_remove` audit
  now includes `{operationId,passkeyId}` in its payload.
- G4: `before=<timestamp>` and `{ok:true,entries}` → `before=<opaque nextCursor>` and
  `{ok:true,entries,nextCursor}`. The HTTP route now rejects timestamps and malformed/oversized
  cursors with 400 `{ok:false,code:"invalid_cursor",message:"Invalid audit cursor"}`.
  Ordering and cursor comparison both use `(createdAt DESC,id DESC)`, so equal timestamps cannot
  skip rows at a boundary. A full page provides a cursor from its last row; a shorter/empty page
  returns null. A full final page may therefore lead to one empty request. Treat the cursor as
  opaque and URL-encode it. Numeric `before` remains supported only by the legacy storage API.
- G5: history included `code`, role/use counts and redeemer details → metadata-only records:
  `{id,email,issuedBy,createdAt,expiresAt,status}`. This applies to **all** listed invites, including
  still-issued invites. `id` is a stable SHA-256 history identifier domain-separated from the
  random code; it cannot redeem an invite. No schema migration is needed. `issuedBy` is the
  issuer user id or null for operator/legacy invites. Status precedence is redeemed (`uses>0`),
  revoked (`revokedAt` set), expired (`expiresAt<=now`), then issued. Codes remain shown exactly
  once in the successful POST issuance response (both generic and targeted issuance).

### Admin read response schemas

GET users is the explicit schema in “Admin lifecycle and personal handover” above, with the added
passkey resource array. GET users, invites and audit set `Cache-Control:no-store`.

`GET /api/admin/invites`:

```ts
{ok:true, invites:Array<{
  id:string; email:string|null; issuedBy:string|null;
  createdAt:number; expiresAt:number|null;
  status:"issued"|"redeemed"|"revoked"|"expired";
}>}
```

History sorts by createdAt descending, then history id ascending. It never returns `code`,
`usedByUserId`, `usedByUserEmail`, `uses`, `maxUses`, `role`, `provenance` or `revokedAt`.

`GET /api/admin/audit?limit=&before=`:

```ts
{ok:true, entries:Array<{
  id:string; actorUserId:string; action:string;
  targetUserId:string|null; targetAccountId:string|null;
  payload:Record<string,unknown>|null; createdAt:number;
}>, nextCursor:string|null}
```

Limit defaults to 100 and clamps to 1..500; non-finite values use the default. Payload keys that
could hold secrets are recursively removed by the audit writer. Action is read as stored so
older/newer action names remain displayable. Paging is strictly before the composite cursor.

`GET /api/admin/accounts` (mailboxes):

```ts
import type { AccountSettings } from "../lib/data";
{ok:true, accounts:Array<{
  id:string; name:string; email:string; avatar:string; ownerUserId?:string;
  accessRole:"manager"; isOwner:boolean; shared:boolean;
  imap:{host:string,port:number,secure:boolean,user:string,password:""};
  smtp:{host:string,port:number,secure:boolean,user:string,password:""};
  caldav?:{url:string,user:string,password:"",calendarPath?:string,syncIntervalMs?:number};
  deepl?:{enabled?:boolean,targetLang?:string,apiKey:"",hasApiKey:boolean};
  settings?:AccountSettings;
  members:Array<{userId:string,email:string,name:string|null,
    role:"viewer"|"editor"|"manager",isOwner:boolean,disabled:boolean}>;
}>}
```

Settings follow the existing typed mailbox settings (`lib/data.ts:AccountSettings`): sync,
threading, layout, appearance, calendar, signatures, defaultSignatureId and notifications.
The manager presentation includes connection endpoints/usernames with blank secrets.
`isOwner` describes the viewing admin; `shared` counts distinct members including the owner.
This management response grants no mail access. Mailboxes sort by display name (email fallback),
normalized email, then id; members use the same ordering by name/email/id. Disabled members are
included for admin management. GET members/prefs retain their existing documented contracts.

### Fix round 6 verification (2026-10-22)

Base `ca1fb45`, branch `feat/team-auth`. Heavy commands used `nice -n 10`, with TMPDIR in
worktree-local `.tmp`; test data was synthetic. The new candidates route is recorded in both the
route-role fixture and the inventory above, including its generated editor-denial test.

- Focused `bun test --timeout 20000` on `teamAuthContracts`, `accountRouteRoles`,
  `teamAuthSlice3`, `teamAuthSlice5`, DB users/audit, and admin users/invites route tests:
  exit 0; 184 passed, zero failed, 939 assertions, eight files (119.19s).
- `timeout 1500 nice -n 10 bun run test:ci`: exit 0; 2,196 server tests in 229 files
  (323.65s), then 69 DOM tests in 13 files (18.55s), zero failures.
- `timeout 1800 nice -n 10 bun run test:stress`: exit 0; seed 1337, rerun-each=3;
  6,588 passed, zero failed, 19,761 assertions in 229 files (916.97s).
- `timeout 600 nice -n 10 bun run lint`: exit 1; unchanged calendar effect error at
  `app/components/calendar/useCalendarConflicts.ts:58` and 27 warnings, zero new findings.
- `nice -n 10 bun check --no-pretty --all`: exit 1; unchanged 151 non-`bun:test` diagnostics,
  none in touched files. The requested `grep "error TS" | grep -v bun:test | wc -l` pipeline
  independently returns 151 (pipeline exit 0).
- `timeout 1200 nice -n 10 bun run build`: exit 0 (52.96s command wall time).
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 AUTH_BROWSER_USE_BUILD=1 nice -n 10 bun run test:auth-browser`:
  exit 0; eight real Chromium/WebAuthn scenarios passed (13.8s), port 3784, isolated storage.
- `nice -n 10 bash tests/runTeamAuthSecurityControls.sh`: exit 0; all 141 probes in five files
  passed, zero failures, 778 assertions (72.17s).
- `git diff --check`: exit 0. No auth-stage activation, signup, policy-handler, schema,
  harness or script changes; `doc/AUTHENTICATION.md` is the sole overlap in the supplied merge list.
  No push, PR or deployment.
