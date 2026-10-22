# Authentication

> Better Auth migration: cookie credential mode, sealed sessions, SESSION_SEAL_KEY, legacy IMAP login and Tauri desktop are retired; see [TEAM-INBOX.md](TEAM-INBOX.md) and [TEAM-AUTH-PLAN.md](TEAM-AUTH-PLAN.md).

This branch implements Team-Auth through Slice 3. Better Auth is pinned at 1.7.12.
`/api/ba/**` still returns 503 `auth_integration_pending`; backend activation belongs to Slice 6.
Legacy sealed cookies, credential overlays, cookie-only storage, signup and IMAP login are retired or
unavailable. Nothing in this slice enables public sign-in or deploys the integration branch.
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

Slice 4 owns challenge/assurance finalization, fresh proof/factor operations, strict optional IMAP
login, and the real WebAuthn browser harness. Slice 5 owns user provisioning/lifecycle/reset sagas.
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
