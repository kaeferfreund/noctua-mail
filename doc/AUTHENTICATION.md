# Authentication

Team-Auth slices 5–7 and the administration UI are integrated. Better Auth and its passkey plugin
are pinned at 1.7.12. The public mount uses the reviewed policy handler; no activation bypass remains.
This document consolidates the current contracts. Earlier verification records describe their
historical snapshots and do not override this contract. Stage 1 integration is not household go-live.

## Contracts after integration

Design v5 remains authoritative. Every user must complete TOTP enrollment; UV passkeys provide
convenient later login and backup codes support recovery. Instance administration grants no mailbox
membership, and administrators see and manage only mailboxes they are a member of (see
"Administrators: own mailboxes only"). Sync, recompute, calendar sync and related-thread lookup are viewer capabilities even
where their HTTP method is POST.

The shell uses `lib/authClient.ts`, LoginScreen, TwoFactorChallenge, EnrollmentScreen,
SecuritySettings, ReauthDialog and ResetPasswordForm. Auth/admin/security work without a selected
mailbox. Signup honors `loginRequired` without replaying a committed creation. Grants, reset tokens,
backup codes and one-time handover values remain in component/call memory, never browser storage.
AdminPanel replaces the retired account-settings admin tab; Members and Preferences use canonical
role guards. Admin security actions use `admin.recovery` through the same ReauthDialog, including
password plus UV; only the final rotated-session grant goes in `x-noctua-reauth`.

The no-mailbox gate shows “Add a mailbox” only to instance admins, using the existing admin creation
dialog. Other users see “Ask your admin”. The creating admin becomes the owner, so the new mailbox
appears in the sidebar after the reload; creation never selects, loads folders or syncs it. Further
members are granted separately.

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
Admin mailbox creation verifies IMAP/SMTP and makes the creating admin the owner; no other user is
linked. Only the owner or an admin who is a member can delete a mailbox; another manager receives the
explicit owner-only 403.

### Administrators: own mailboxes only

User decision of 2026-10-25: an administrator sees and manages only mailboxes they are a member of
(owner or any role, resolved by `resolveAccountRole` exactly like `requireAccountContext`; the viewer
role is enough). The admin role itself stays global. Enforcement is server-side in every admin route;
the admin UI only renders the filtered data.

| Surface | Rule |
|---|---|
| `GET /api/admin/accounts` | lists member mailboxes only (`listMemberAccounts`) |
| `PUT/DELETE /api/admin/accounts/[id]/members/[userId]` | foreign or unknown mailbox → 404 `account_not_found` (checked in the member transaction) |
| `DELETE /api/admin/accounts/[id]` | foreign or unknown → 404 `account_not_found`; the delete transaction rechecks the membership |
| `GET/PUT /api/admin/accounts/[id]/spam-settings` | foreign or unknown → 404 `account_not_found` |
| `GET /api/admin/users` | users stay global; each user's `accounts` only lists the admin's member mailboxes |
| `DELETE /api/admin/users/[userId]` | 409 `foreign_mailbox_membership` when the target owns or is a member of a mailbox the admin is not a member of, before anything is banned, detached or reassigned |
| role, status, sessions, MFA, passkeys, recovery, invites | global, unchanged |
| `GET /api/admin/audit` | hides entries whose `targetAccountId` is not a member mailbox; entries without a mailbox and the admin's own actions stay. Filtered in SQL before the limit, so pages stay full |
| `GET /api/admin/spam-settings` | global settings unchanged; `trust` counters only for member mailboxes |
| `GET /api/admin/domain-icons`, `GET/PUT/DELETE /api/admin/domain-icons/[domain]` | domains of member mailboxes; a domain only foreign mailboxes use → 404 `unknown_domain` and not listed. An upload whose domain no mailbox uses any more stays listed and resettable for every admin |

Foreign and unknown mailboxes answer the same 404, so the response does not confirm that a mailbox
exists. Mail routes, members/candidates for managers, collaboration, the sidebar and MCP are unchanged:
they already follow the membership.

GET prefs returns `{ok:true,prefs}` for the current user. PUT accepts the sparse preference object
itself; absent fields stay unchanged and null deletes a field. Unknown/userId keys are rejected.
The shape is layout, appearance, calendar, threading, defaultSignatureId and notifications.newMail.
PUT account/settings strips those personal keys unless `teamDefaults:true` is explicitly supplied.
New member/prefs/credential/token/admin mutations enforce JSON same-origin hygiene; bodyless member,
token and mailbox DELETE use the same-origin/bodyless convention. `x-noctua-client` uses the shared
64-character allowlist helper. No submitted credential is recorded as request metadata.

### Manager candidates and membership failures

`GET /api/accounts/[accountId]/members/candidates?q=&limit=` requires an actual manager membership;
admins do not bypass it. It returns `{ok:true,candidates:[{id,name,email}]}`, with `name:string|null`.
Only enabled, completely provisioned non-members appear, excluding the implicit owner. `q` is a
trimmed case-insensitive literal substring of name/email, maximum 128 characters (400
`invalid_request` beyond that). Empty search is allowed. `limit` defaults to 25, floors fractions,
clamps to 1..100 and uses 25 for non-finite values. Sort: lowercased name/email fallback, email, id.
The capped search has no cursor, read audit or read limiter. Responses are no-store.

Both `PUT/DELETE /api/accounts/[accountId]/members/[userId]` and their `/api/admin/accounts` variants
return policy failures as `{ok:false,code,message}`:

| Code | Status | Meaning |
|---|---|---|
| `owner_immutable` | 403 | Owner cannot be changed |
| `self_role_change` | 403 | Manager cannot change own role; admin route overrides this rule |
| `last_manager` | 403 | Keep an enabled manager, counting the owner |
| `target_disabled` | 400 | Disabled or incompletely provisioned target |
| `target_missing` | 400 | Unknown target |
| `above_manager` | 400 | Unsupported role |
| `not_member` | 404 | DELETE target has no membership |

Missing userId is 400 `invalid_request`; service account/authority errors use
`account_not_found`/`insufficient_role`. Shared guard errors retain their status, refresh headers and
extra fields, adding the same code/message envelope. Explicit `invalid_origin`/`json_required` codes
are preserved. The Members tab maps these codes and uses the manager candidates search; dedicated
admin membership management may use its admin user directory.

## Mailbox credential repair

`lib/mailboxCredentials.ts:updateMailboxCredentials(accountId, patch, actor, verification?)` is the
single repair/write-back service. PUT account, relogin and POST-existing use the shared HTTP handler
in `app/api/_helpers/mailboxPatch.ts`; the optional IMAP bridge calls the service after its
strict eligibility/allowlist checks. The public repair routes are active; admin mailbox creation uses the separate creation contract (creator becomes owner). Identity/id/e-mail/dbPath cannot be patched.
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

`POST /api/accounts` is repair-only: an absent mailbox returns 404
`{ok:false,code:"account_not_found"}` before IMAP/SMTP calls. Use admin creation for the shell's
new-mailbox flow; the reviewed optional personal mailbox supplied at identity signup remains supported.

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
  revoke/downgrade, mailbox deletion and login-mailbox repair are wired here. Factor,
  password and lifecycle finalizers call it after their authoritative commits. DB checks already
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
this seam without importing threadCollab into team-auth. Lifecycle deletion enumerates formerly
accessible accounts and reuses this seam before removing the banned identity.

## Optional IMAP first factor

`NOCTUA_IMAP_LOGIN_HOSTS` is unset by default. Unset/empty rejects before network/session/write-back
and hides the UI method; when explicitly enabled, only an owned personal login address with one
member and an exact normalized allowed host qualifies. Shared mailboxes never qualify. IMAP is a
first factor only; mandatory verified TOTP and session assurance still gate mail. Credential repair
uses the shared service, preserving generation and owner/admin checks.

## Assurance and security operations

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
| `admin.recovery` | Admin app password + TOTP/UV; administration additionally verifies the target out of band |

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
| `POST /api/ba/two-factor/enable` | `{password?,method?:"totp"}` + `totp.enroll` header → stock `{method:"totp",totpURI,backupCodes}` once; proof reserved for this seed |
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

`GET /api/auth/me` returns its identity/accounts/selection plus
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

### Finalization and onboarding continuity

Acquire admin-lifecycle authority before target security slots and reuse request-scoped operations,
never a client operation ID. Bodyless logout and internal sign-out reserve the user slot, revoke
source sidecars/proofs/pending logins before cookie writes and preserve another session's ceremonies.
A 409 does not authorize clearing local identity. Generation/challenge/finalization helpers use
Noctua immediate transactions; publish stream revocation after commit. Startup reconciliation uses
process-start cutoff, so another Next module graph cannot cancel live operations. Manual
reconciliation requires the application stopped.

The first-onboarding password.set factor waiver requires a completed signup/migration journal, no
recovery history and no mfa-enrolled receipt. Initial MFA finalization writes that receipt and admin
MFA reset preserves it. Migration records completed provenance. Restricted setup alone never grants
this waiver; an admin needs an independent app password before completion.

## Provisioning

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
every successful mutation records secret-free audit. All admin read responses are no-store.

`GET /api/admin/users` returns exactly:

```ts
{ok:true, users:Array<{
  id:string; email:string; name:string|null; role:"admin"|"user"; createdAt:number;
  hasPassword:boolean; disabled:boolean; twoFactorEnabled:boolean; passkeyCount:number;
  passkeys:Array<{id:string; name:string|null; createdAt:number|null}>;
  accounts:Array<{id:string; name:string; email:string; role:"viewer"|"editor"|"manager"; isOwner:boolean}>;
}>}
```

Read timestamps are Unix milliseconds unless explicitly nullable. Users sort by creation time,
accounts by email. Passkey ids are opaque resources accepted by the audited DELETE route, never
WebAuthn credential ids. `name`/`createdAt` can be null. `lastUsedAt` is omitted because pinned
Better Auth stores none. No public keys, counters, transports or backup metadata are exposed. Each account describes the **target user's**
membership: owners are manager/isOwner:true even without a link; non-owners use their stored
membership role and isOwner:false. Unrelated accounts and mailboxes the viewing admin is not a member
of are absent. No connection credentials,
password hashes, session tokens or viewer-admin role overrides appear in this DTO.

`GET /api/admin/invites` returns exactly:

```ts
{ok:true, invites:Array<{
  id:string; email:string|null; issuedBy:string|null;
  createdAt:number; expiresAt:number|null;
  status:"issued"|"redeemed"|"revoked"|"expired";
}>}
```

The id is a stable, domain-separated SHA-256 history identifier and cannot redeem an invite.
`issuedBy` is the issuer id or null for operator/legacy records. Status precedence: redeemed
(`uses>0`), revoked (`revokedAt`), expired (`expiresAt<=now`), issued. History sorts by createdAt
descending then history id ascending. No code, role, uses, maxUses, redeemer, provenance or revokedAt
is returned, even for still-issued invitations. Codes appear once in POST issuance responses only.

`GET /api/admin/audit?limit=&before=` returns exactly:

```ts
{ok:true, entries:Array<{
  id:string; actorUserId:string; action:string;
  targetUserId:string|null; targetAccountId:string|null;
  payload:Record<string,unknown>|null; createdAt:number;
}>, nextCursor:string|null}
```

`limit` defaults to 100, clamps to 1..500 and defaults for non-finite values. Order and comparison
use `(createdAt DESC,id DESC)`. Pass the opaque `nextCursor` URL-encoded as `before`; never construct
one from a timestamp. Timestamps and malformed/oversized cursors return 400
`{ok:false,code:"invalid_cursor",message:"Invalid audit cursor"}`. A full page returns its last-row
cursor; shorter/empty pages return null, so a full final page can lead to one empty request.
This avoids losing equal-timestamp rows. Numeric before survives only in the legacy storage API.
Entries of mailboxes the admin is not a member of are left out before the limit (own actions and
entries without a mailbox stay).
Payload secret keys are recursively removed by the writer; action names remain displayable as stored.

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
- `DELETE /api/admin/users/[userId]` JSON `{reassignOwnerTo?:userId}` → `{ok:true}`. A target with a
  mailbox the admin is not a member of is refused first (409 `foreign_mailbox_membership`). An owner needs
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
  `{ok:true}`. Passkey ownership is checked (404 `passkey_not_found`); all old target access is revoked. Successful
  `user.passkey_remove` audit payload contains `{operationId,passkeyId}`.

`GET /api/admin/accounts` (mailboxes the admin is a member of):

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

Auth startup, migration and recovery acquire the same Linux `flock(LOCK_EX|LOCK_NB)` on
`<canonical database directory>/main.db.auth.lock` **before auth initialization or reconciliation**.
Both operator commands pass the acquired handle to `getAuth({operatorLock})` and release in finally.
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

## Reset redemption and client handling

Production `BETTER_AUTH_URL` is `https://mail.example.org`; the sole callback is exactly
`https://mail.example.org/reset-password`. Isolated preview/test data uses its own configured
origin plus `/reset-password`, never another trusted origin/path/query. Issuance calls server
`requestPasswordReset` with a request-scoped `sendResetPassword` handover sink. No global delivery
variable, SMTP sender configuration or `/api/auth/recovery/request` exists. Raw issuance stays blocked.

The following policy-controlled redemption routes are active at the mounted `/api/ba/**`
(through the active policy mount):

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

The integrated reset page implements this contract. Copy the token to ephemeral memory, immediately replace browser
history with `/reset-password`, exclude analytics, and clear token/password state on success/unmount.
Next sets no-store/no-referrer on the page; both handler redemption paths carry those headers too,
including errors/redirects. Next request logs ignore reset paths; `redactAuthUrl` strips capabilities
for future logging callers. The proxy example suppresses auth/reset access logs and omits query strings elsewhere; verify the deployed chain. Never persist links/tokens in logs, localStorage, audit or crash diagnostics.
After success return to normal login and existing MFA. A post-commit callback failure can return 5xx
although the new password is committed: offer login or a new personally handed-over link, never
silently retry the password mutation. Slot reconciliation is independent of the spent reset token.

## Final environment

```sh
BETTER_AUTH_URL=https://mail.example.org
PASSKEY_RP_ID=mail.example.org
BETTER_AUTH_SECRET=<independent-random-secret-at-least-32-characters>
IMAP_SECRET_KEY=<retain-existing-independent-encryption-key>
IMAP_CREDENTIALS_STORAGE=db
BETTER_AUTH_TELEMETRY=0
NOCTUA_DATA_DIR=/srv/noctua/data
# NOCTUA_TRUSTED_ORIGINS unset (only the configured canonical origin is accepted).
# NOCTUA_IMAP_LOGIN_HOSTS unset: optional IMAP first factor OFF.
# BETTER_AUTH_TELEMETRY_ENDPOINT and NOCTUA_DESKTOP_MODE unset.
```

`PASSKEY_RP_ID` defaults to the configured hostname; it must match. DB storage is the default,
`both` is a deprecated DB-only alias, `cookie` and `NOCTUA_DESKTOP_MODE=true` fail startup.
Additional `NOCTUA_TRUSTED_ORIGINS` values now fail startup; canonical trust cannot include preview.
DNS A `<tailnet-ip>` is tailnet-only; TLS is issued/renewed via your DNS provider (DNS-01). Bind the Bun backend
to loopback and overwrite Host/X-Forwarded-* at the sole reverse proxy. The pinned Better Auth
IP reader uses the proxy-sanitized `x-forwarded-for`; Noctua limits default to one trusted hop
(`TRUSTED_PROXY_HOPS=1`). See `deploy-scripts/nginx-auth.conf`: auth/reset access logs are disabled,
other access logs omit query strings, request errors cannot log reset URLs. Recovery links are
handed over personally, never SMTP. Do not record the private operator terminal.

The preview `https://preview.example.org:3790` is a separate instance with isolated auth
data, auth/encryption secrets, preview-only URL/trust and RP ID `preview.example.org`.
Enroll separate preview passkeys. Canonical passkeys are not reusable there. Actual tailnet DNS,
DNS-01 renewal and physical phone/PWA acceptance belong to deployment/Stage 4 and Slice 7.

## Offline migration and bootstrap runbook

1. Stop the application (one process only). Back up the master (`db/main.db` in this runtime), all shards and both independent
   auth/encryption keys consistently; retain `IMAP_SECRET_KEY`. For former cookie-only installs,
   re-enter and verify mailbox credentials into encrypted DB storage first. Never import client
   cookies or turn mailbox passwords into app passwords.
2. Review every legacy person and stable user ID. Duplicate case/whitespace addresses and identities
   using shared-mailbox addresses are rejected before any import: repair those legacy profiles
   explicitly to personal identities first, preserving IDs and ownership/membership references.
   Legacy profiles must all be mapped unless already Better Auth identities. The migration never
   infers an admin or identity from an account-ID cookie or a mailbox secret.
3. Write a private JSON manifest (names/addresses are operator data, not committed). Example uses
   synthetic values. `createdAt` is the exact legacy unix millisecond timestamp, role must match;
   `legacyUserId` must equal `userId` for an existing profile. Name imports from the old column if
   omitted; supply it when the old table has none. Password provenance is explicitly reviewed:

```json
{"version":1,"users":[{"userId":"legacy-person","legacyUserId":"legacy-person","email":"person@example.test","name":"Synthetic Person","role":"admin","createdAt":1234567890000,"passwordProvenance":"recovery"}],"memberships":[]}
```

   A person from an old account-ID-only session has `legacyUserId:null`, an explicitly chosen stable
   `userId`, personal email/name/role/timestamp, `passwordProvenance:"recovery"`, and explicit
   `memberships:[{"userId":"personal-id","accountId":"existing-mailbox-id","role":"manager"}]`.
   Existing membership roles cannot be silently replaced. Existing owner/prefs/audit/shard IDs stay.
   `passwordProvenance:"user-chosen"` imports only a valid bounded Argon2id hash from the legacy
   `users.passwordHash`; any temporary-password marker rejects it. Choose `recovery` to discard an
   admin/temporary/unknown credential. Never put hashes/passwords into the manifest or use a common
   temporary password. `disabledAt` imports as a permanent Better Auth ban; recovery never unbans.
4. Both operator commands acquire the existing lifetime lock before auth startup; no precondition
   stub or second lock implementation remains. Add `--override-stale-lock` only after checking the
   service is stopped; overrides are audited and cannot bypass a held OS lock. Run twice with the exact same manifest and environment:

```sh
bun --env-file=.env.local scripts/migrateTeamAuth.ts --application-stopped --confirm-reviewed-identities --manifest /private/reviewed.json
bun --env-file=.env.local scripts/migrateTeamAuth.ts --application-stopped --confirm-reviewed-identities --manifest /private/reviewed.json
```

   One adapter transaction creates identities, chosen hashes, completed migration provenance,
   memberships, audit and the manifest receipt. Failure rolls it all back. First success revokes
   every old session, MCP token and challenge; the second reports `already_complete` without
   revoking newly created access. A different manifest after cutover is rejected; later people use
   invites. Operator output contains IDs/count/status only; no email/hash/password/link.
5. For a recovery-only identity use the personally verified local recovery command documented in Admin lifecycle and personal handover.
   It prints the single-use 15-minute URL once, preserves MFA and ban status, and never sends SMTP.
   Initial IMAP-only onboarding has completed migration provenance for the first-password proof
   waiver; admins still require a provider-independent app password before mail access.
6. On an empty install, startup creates the bootstrap invite but logs only readiness. Retrieve its
   code explicitly in a private terminal, with the app stopped, for personal handover:

```sh
bun --env-file=.env.local scripts/recoverTeamAuth.ts --application-stopped --confirm-personal-handover --bootstrap-invite
```

   This fails once any profile exists. Ordinary startup, including separate Next route graphs,
   never logs the invite secret. Restart, enroll/verify TOTP and save offline backup codes, then
   enroll passkeys at the correct origin. Complete mandatory enrollment through the integrated UI; canonical phone/PWA acceptance remains release work.

## Production and restore smoke

`bun scripts/smokeTeamAuth.ts` uses only port 3799 (`AUTH_SMOKE_PORT`) and fresh worktree-local `.tmp` storage,
canonical origin/proxy headers with real Secure cookies, the compiled production mount and
production limits. `bun run test:auth-browser` starts compiled Next on port 3799 (`AUTH_BROWSER_PORT`, default 3799), seeds offline,
and exercises all real wrappers/mounts. It contains no custom HTTP auth interception or disabled
runtime limits. Install the browser once per Playwright version with `bunx playwright install chromium`;
reuse the fresh build with `AUTH_BROWSER_USE_BUILD=1`. Both runners stop only their own child processes.
The auth/master/shard/key restore probe is synthetic Stage 1 evidence; application-wide restore
and household go-live stay Stage 4 (TEAM-INBOX.md §11).

### Browser acceptance

Pinned Playwright 1.64.1 uses synthetic isolated identities and real Chromium/CDP CTAP2 ceremonies.
The suite exercises actual compiled login/enrollment/reset/security screens and retains real
registration/assertion/replay, server UV=false rejection, RP/origin mismatch, grant/challenge binding,
rotated sessions, reset/revoke invalidation and finalizer quarantine fault cases. A minimal intercepted
fixture page remains only for WebAuthn controls; no signature/callback is mocked. The compiled mount
and production policy limits are active. Offline helper scripts never expose an HTTP test route.
HAR, screenshots, video and traces are disabled to avoid recording capabilities. Both runners fail
on occupied ports and stop only their own processes. Playwright 1.64.1 supports Ubuntu 26.04 on ARM
directly: plain `bunx playwright install chromium` installs Chrome for Testing (chromium v1248), and the
`PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64` workaround in the 1.58.2 evidence below is no
longer needed. Virtual-authenticator results do not replace canonical physical phone/PWA tests.

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
/api/admin/accounts/[accountId]/members/[userId] require a live MFA admin session and, except POST,
membership in the mailbox (404 otherwise).

## Retired modules and follow-on ownership

`/api/ba/**` mounts the reviewed policy handler. Raw admin, password/factor/session/passkey mutations
remain blocked except the paths explicitly documented above. Legacy login and desktop routes are
removed and return 404. `lib/desktop`, LoginOverlay, sealSession, requireSessionOr401 and
claimInviteCode have no runtime consumers. The smoke intentionally asserts retired login returns 404.
The optional fixture verifier now consumes an existing synthetic MFA session. `lib/db/users.ts`
retains deprecated `deleteUser` only for storage tests; production deletion uses removeUserLifecycle.
Old `noctua_session` cookies are never decrypted/accepted and are expired by the mount/guards.

Collab-ui slice 2b owns canonical `/api/me/mailboxes/summary` and `/api/me/events`, cross-account
counts and UI integration. When merging monotonic collaboration revisions, update membershipCleanup's
raw unassignment writer and corruption fixtures to increment revisions. Preserve watcher stream
liveness/resource ownership and canonical role guards. Live IMAP browser acceptance, canonical
physical phone/PWA flows, deployed DNS/TLS/proxy logging/DNS-01 renewal and final application-wide
restore remain later-owner evidence. This work makes no deployment or go-live claim.

## Historical verification

These are snapshots before final integration; earlier pending activation/UI statements are superseded.
Exact final integration results are recorded below after running all gates.

### Slice 3 verification (2026-10-22)

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

### Issuer and operator hardening verification (2026-10-22)

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

### Admin and membership contract verification (2026-10-22)

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

### Slice 6 verification (2026-10-22)

Base: clean `feat/auth-activation` at `54dc833`, directly above `48b1612`; the parallel Slice 5
fix round was deliberately not merged here. All heavy commands used `nice -n 10`,
`TMPDIR=$PWD/.tmp`, synthetic identities and isolated storage. No push, PR or deployment.
Versions read from the installed runtime/packages: Bun 1.4.4 (38afee6c8), Next.js 16.2.4,
Better Auth/passkey 1.7.12, TypeScript 6.0.3, Playwright 1.58.2, Chromium 145.0.7632.0 on ARM.

- `timeout 1500 bun run test:ci`: exit 0; 2,116 server tests, 227 files, 6,113 assertions,
  408.63s; then 69 DOM tests, 13 files, 490 assertions, 19.96s; zero failures.
- `timeout 1800 bun run test:stress`: exit 0; seed 1337, rerun-each=3; 6,348 passed,
  zero failed, 18,339 assertions, 227 files, 1050.31s. Includes all three executions of the final
  one-time legacy profile receipt regression and the active mount/origin inventory.
- Focused auth/migration/mount checks: 13 passed, zero failed, 101 assertions, three files,
  6.61s. `lib/teamAuthMigration.test.ts` covers chosen hashes and reviewed names, stable timestamps,
  completed provenance, second-run session preservation, discarded temporary hashes, permanent
  bans, later name/unban preservation across startup, duplicate/shared addresses, malformed hashes,
  wrong/missing/unmapped IDs, adapter rollback and explicit account-ID-only membership mapping.
  `app/api/ba/[...all]/route.test.ts` calls the actual exported mount twice across process starts.
- `timeout 600 bun run lint`: exit 1; exactly the existing
  `app/components/calendar/useCalendarConflicts.ts:58` error and 27 warnings; zero new findings.
- `bun check` and `bun check --no-pretty --all`: exit 1; 151 non-`bun:test` diagnostics,
  unchanged from the captured clean baseline. Normalized diagnostic sets add/remove zero entries.
- `timeout 1200 bun run build`: exit 0. The production route inventory includes `/api/ba/[...all]`
  and omits the removed legacy login and desktop APIs. Standalone packaging, live TLS and rollout
  are not asserted by the `next start` smoke.
- `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 AUTH_BROWSER_USE_BUILD=1 timeout 1200 bun run test:auth-browser`:
  exit 0; `8 passed (5.1m)`, compiled Next on localhost:3793. Cases: real registration/assertion/replay
  and rotated UV grant binding, UV=false rejection, RP/origin mismatch, anonymous challenge reset and
  revoke invalidation, management purposes/removal, registration finalizer fault, UV finalizer fault.
  Production proof limits remain enabled; the fixture paces proofs at 12.5 seconds. Expected origin
  mismatch diagnostics contain only the synthetic origin; no HAR/screenshots/traces are recorded.
- `timeout 900 bun scripts/smokeTeamAuth.ts`: exit 0, final `SMOKE PASS`, port 3794 only.
  Transcript milestones: migration CLI `complete` then `already_complete`; stable IDs/chosen hashes
  and old MCP removal; canonical Host/X-Forwarded-* and Secure cookie; foreign origin/raw path/old
  cookie rejection; restricted enrollment and TOTP activation; refresh forwarded through `/me`;
  live MCP then revoke rejection; admin ban and denied login; private operator recovery; mounted
  reset redirect/redemption/reuse and no auto-session; old session rejection and retained MFA;
  empty second-start schema plan; consistent master/auth/shard/key snapshot restored to another
  isolated directory with identical IDs/factor/backup-code bytes, shard marker, decryptable IMAP
  secret, preserved signed MFA session and a new real TOTP login. No known password/hash/key,
  TOTP seed, backup code, session/challenge cookie, MCP token or recovery capability appeared in
  captured production server logs. Auth factory probes run in short-lived offline children, so
  the runner does not retain an application lifetime lock while its Next server is running.
- Missing `--confirm-reviewed-identities`: exit 1 before storage initialization; no data directory
  created. `bash -n deploy-scripts/deploy-instance.sh` and `git diff --check`: exit 0.
  Both reserved ports (3793/3794) were bind-checked free after runner cleanup.

The first CI attempt correctly exposed four obsolete mount-inventory 503 expectations. They now
exercise real library media-type rejection and unavailable paths; the focused origin inventory
passes 94 tests (182 assertions). Operational 503 errors remain where they represent actual
failures; no readiness 503 or legacy login 410 remains in runtime handlers.

## Final integration verification (2026-10-22)

Started clean at `a17ae88` over `ca1fb45`; merged auth-stage `6e480bf`, then admin-ui `6a21154`.
Reconciliation covers restricted signup, target admin/passkey resources, shared reauthentication,
manager candidates/stable membership codes, opaque audit paging, metadata-only invite history,
admin-only mailbox creation in both shell states, shared operator exclusion and retired callers.
The source tree includes the reviewed browser process-group cleanup and awaited DOM focus check.
All commands used `nice -n 10`, worktree-local TMPDIR and synthetic state; no push, PR or deployment.

- `bun install --frozen-lockfile`: exit 0; 1,078 installs / 1,056 packages, no changes;
  lockfile SHA-256 unchanged. Better Auth/passkey 1.7.12, Next.js 16.2.4, Bun 1.4.4,
  Playwright 1.58.2 and radix-ui 1.8.1 remain pinned as required; QR dependencies retained.
- `bun check --no-pretty --all`: exit 1; the requested filtered pipeline returns 151.
  A clean `a17ae88` source archive has the same 151 diagnostic identities and multiplicities:
  zero added/removed diagnostics and no new files. Fresh build regenerated retired route types.
- `timeout 1500 bun run test:ci`: exit 0; 2,206 server/integration tests in 231 files,
  6,689 assertions, 397.69s; 153 DOM tests in 24 files, 788 assertions, 21.70s; zero failures.
- `timeout 1800 bun run test:stress`: exit 0; seed 1337, rerun-each=3; 6,618 passed,
  zero failed, 20,067 assertions, 231 files, 1034.22s. DOM tests run separately by repository design.
- Focused randomized retry of security controls/admin HTTP files: 144 passed, zero failed,
  1,059 assertions, two files, 168.87s, with the same 20-second per-test limit and seed.
- `timeout 600 bun run lint`: exit 1; the pre-existing calendar effect error at
  `app/components/calendar/useCalendarConflicts.ts:58` and 26 warnings. Normalized comparison to
  clean `a17ae88` adds no findings and removes one pre-existing MailClient hook warning.
- `timeout 1200 bun run build`: exit 0; optimized compilation, production type checking and
  route generation passed (final compilation 23.5s).
- ARM override + `AUTH_BROWSER_USE_BUILD=1 AUTH_BROWSER_PORT=3784 bun run test:auth-browser`:
  exit 0; all 19 cases passed (7.4m), zero skipped: 11 actual shell/activation cases plus eight
  real Chromium/WebAuthn controls. Final server and synthetic sync workers shared the runner's
  private process group; no owned Bun process remained after exit. The initial complete run
  also passed 19 cases but revealed orphaned mailbox workers; the final run verifies that fix.
- `bun scripts/smokeTeamAuth.ts`: exit 0, final `SMOKE PASS`, compiled final bundle on 3785.
  Migration twice, canonical proxy/cookies/origins, restricted enrollment, MFA, revoke/MCP/ban,
  operator recovery, reset redemption/reuse, second-start empty schema plan, isolated key/master/
  auth/shard restore and secret-free startup/request logs passed.
- `bash tests/runTeamAuthSecurityControls.sh`: exit 0; 144 tests, zero failures, 787 assertions,
  five files, 79.64s. Includes the activated public mount and both real operator CLI lock probes.
- `git diff --check`: exit 0. Both reserved ports were bind-checked free after browser cleanup;
  final scratch/process cleanup and co-author validation accompany the report commit.

### Failure history and resolutions

The first stress attempt was stopped after nine 20-second test timeouts during a host load burst
(load average 39.35, swap 8,183/8,191 MiB used). Timed-out fixture cleanup produced closed-database
errors; stopping the already-failed run also produced a shutdown failure. The focused randomized
retry and complete stress retry above passed without changing auth server code, assertions or
limits. This records the observed load correlation, not a proof that every future order is safe.

A later full CI run passed all 2,206 server tests but caught one DOM focus assertion reading the
challenge heading before its passive focus effect settled. The assertion now waits for exact
heading identity as the active element; no production behavior or deadline was relaxed. LoginScreen
and ReauthDialog repeated three times passed 36 tests / 117 assertions; the final full CI above
passed all 153 DOM tests. Sidebar admin/non-admin gating has two explicit DOM cases.

### Integration handoff

Read-only merge preview against integration/stage `40cf8b6` predicts five textual/modify-delete
conflicts: MailClient.tsx, doc/DEPLOYMENT.md, playwright.auth.config.ts, scripts/authBrowserServer.ts
and scripts/runAuthBrowserTests.ts. Combine auth/admin gates with the existing collaboration props,
retain watcher deployment settings alongside the canonical auth environment, and keep the compiled
browser runner with its port override, private process group and worktree-local scratch. The obsolete
custom browser server stays deleted. Review the cleanly combined DB/schema/wrapper/role-inventory
and package-lock changes against the retained integration dry-run map.

Collab-ui slice 2b still owns canonical per-user mailbox summaries/events and cross-account counts;
those routes are absent in the previewed stage tree. Stage commit `40cf8b6` already increments
membership-cleanup revisions and updates the corruption fixtures; preserve that fix during this
merge. The earlier `5dce0ac` preview lacked it. Canonical physical
phone/PWA, live IMAP browser flows, deployed DNS/TLS/proxy/certificate renewal and application-wide restore
remain later-owner evidence. The updated optional MFA-session fixture verifier was not exercised
against a live mailbox by this integration.
