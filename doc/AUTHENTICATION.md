# Authentication

> Better Auth migration: cookie credential mode, sealed sessions, SESSION_SEAL_KEY, legacy IMAP login and Tauri desktop are retired; see [TEAM-INBOX.md](TEAM-INBOX.md) and [TEAM-AUTH-PLAN.md](TEAM-AUTH-PLAN.md).

This branch implements Team-Auth through Slice 4. Better Auth is pinned at 1.7.12.
`/api/ba/**` still returns 503 `auth_integration_pending`; backend activation belongs to Slice 6.
Legacy sealed cookies, credential overlays and cookie-only storage are retired. Signup is pending
Slice 5; optional IMAP login stays OFF unless an explicit host allowlist enables it. Nothing in this slice enables public sign-in or deploys the integration branch.
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
IMAP login, and the real WebAuthn browser harness described below. Slice 5 owns user provisioning/lifecycle/reset sagas.
Slice 6 owns migration (reuse importLegacyProfileFields), canonical deployment documentation and
activation. Slice 7 owns actual auth/reset UI and phone/PWA acceptance. This slice does not activate
/api/ba or the incomplete auth/admin-user mutations, deploy, or claim end-to-end login acceptance.

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
| `admin.recovery` | Admin app password + TOTP/UV; Slice 5 additionally verifies the target out of band |

Password+UV uses `proofMode:"passkey"` with `currentPassword` for purposes that require password.
Only passkey enrollment/removal permit UV without a password. The initial response is
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
proof/policy failures use 403; contention uses 409; limits use 429. Stable policy codes include
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
passkeys:[{id,name:string|null,createdAt:string,deviceType:string,backedUp:boolean}]}`.
Restricted sessions get `passkeys:[]`. It never returns seed, stored backup codes, password hash,
credential public keys or a session token. New codes appear only in enable/regenerate responses.
An operation-pending code means recovery/reconciliation is required, not permission to skip proof.

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

Slice 5 still owns provisioning, admin target lifecycle/last-admin serialization, reset issuance,
request-scoped handover delivery sink and public token-redemption policy exceptions. The internal
handler currently rejects reset HTTP paths; add the exact canonical callback/body contract there,
without a session/factor requirement for redemption. Credential triggers already invalidate every
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

No Slice 4 implementation issue remains open. Public activation, provisioning/admin reset controls,
production origin/RP rollout and actual UI/phone acceptance remain the explicitly assigned later slices.
