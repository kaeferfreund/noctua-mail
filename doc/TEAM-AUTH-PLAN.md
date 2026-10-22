# feat/team-auth replan for Better Auth

Status: replan v3, resolved and promoted, 2026-10-22. Base: `6fee1b89b93785333ae113736bfa2dbc6e2c1b46`
on feat/team-auth. Target: `doc/TEAM-INBOX.md` **design v5**, resolved by the user on 2026-10-22.
Better Auth 1.7.12 is pinned; evidence is spike/better-auth commit `98f04ad` and its
`doc/SPIKE-BETTER-AUTH.md`. Review IDs S1–S8/F1–F10/I1–I11 are recorded in
`doc/TEAM-AUTH-REVIEW-LOG.md`.

Decided: mandatory TOTP before any mailbox access; UV passkeys for convenient login and backup codes for recovery (user, 2026-10-22).

Decided: optional personal IMAP first factor is OFF by default, enabled only by `NOCTUA_IMAP_LOGIN_HOSTS`, never for shared mailboxes (user, 2026-10-22).

Decided: encrypted DB-only credentials; cookie-only mode and Tauri/desktop mode are dropped, including desktop invite exemptions (user, 2026-10-22).

Decided: admin personally hands over a 15-minute single-use reset link; SMTP recovery delivery is a non-goal (user, 2026-10-22).

Decided: canonical origin `https://mail.example.org`, RP ID `mail.example.org`, DNS A `203.0.113.10` inside the tailnet, TLS via mailprovider API DNS-01; preview-host preview remains separate (user, 2026-10-22).

v2→v3: resolve the five user decisions and canonical deployment, promote repo paths, and preserve
Slice 1 verbatim. Rejected alternatives and rationale are in design Appendix A; this plan implements
only the selected policies. Unqualified section and D-number references below point to
`doc/TEAM-INBOX.md`; Slice numbers point to this plan.

v1→v2: preserve the disposition; split core from retirement; disable signup in the same slice as
its imported helpers disappear; implement the generation/assurance boundary before HTTP activation;
assign reset redemption/UI and WebAuthn commands; separate backend activation from final UI acceptance.
No cherry-pick of the whole spike (its old auth still runs). This plan authorizes only each assigned
implementation slice; promotion changes documents, not application behavior.

## 1. Disposition of 6fee1b8, checked against git show

Read `git show 6fee1b8` in the assigned feat/team-auth checkout: 19 files, 2511 additions, 67 deletions. The inventory's
keep/revise/revert classification is correct with the following precise choices. Do not revert
the whole commit; most of it is still needed for mailbox authorization and collaboration.

| Disposition | File / symbol from 6fee1b8 | Required treatment |
|---|---|---|
| Keep | lib/db/schema.ts `ensureTableColumns`, `isDuplicateColumnError`, immediate transaction around ALTER | Preserve for Noctua schema. Auth schema comes from pinned Better Auth programmatic migrations after initMasterSchema; do not duplicate its DDL. |
| Keep | schema user_accounts.role/grantedByUserId/grantedAt, idx_user_accounts_account; mcp_tokens.scopes | Independent of personal authentication. Existing links retain default manager. |
| Keep | schema user_account_prefs/admin_audit + indexes; lib/db/userAccountPrefs.ts and tests; lib/db/adminAudit.ts and tests | Same Noctua user IDs. Extend audit actions for security recovery/reset/passkey/session events; explicitly redact tokens, URIs and codes as well as password-like keys. |
| Keep | schema `normalizeUserEmails` and lower(email) index logic | Remains nonfatal on startup; identity activation must reject ambiguous normalized e-mails rather than arbitrarily choosing the oldest row. |
| Keep | lib/db/users.ts membership insert/set/get/remove/list/delete functions, listAccessibleAccountIdsForUser | ON CONFLICT DO NOTHING must not reset existing role. Ownership plus membership role remains §5.1. |
| Keep | Removal of saveUsers/saveUserAccounts DELETE-all savers; lib/db.ts barrel exports for memberships/prefs/audit | Do not reintroduce whole-table rewrites while porting auth. |
| Keep | lib/db/mcpTokens.ts deleteMcpTokenRowsForUser/deleteMcpTokensForUser + tests | Disable/delete/reset/password-change flows still revoke tokens. Add user/account-specific revoke for membership removal. |
| Keep | lib/db/accounts.ts deleteAccountControlPlane prefs cleanup | Preserve alongside membership and token cleanup. |
| Keep | lib/db/rowParsers.ts mergeAccount whitelist and mergeMailServerForPatch + their tests | Never patch id, ownerUserId, dbPath or email from a body; blank secrets mean unchanged. Add the §5.3 shared IMAP/SMTP credential-update service above this merge. |
| Keep | lib/data.ts AccountRole/ACCOUNT_ROLES/isAccountRole/UserAccountLink/UserAccountPrefs/SparsePatch/AdminAuditEntry; row parser membership/prefs/audit helpers | Domain types independent of Better Auth; expand AdminAuditAction only as required. |
| Keep | types/bun-sqlite.d.ts Transaction<T>, immediate/deferred/exclusive and close() | Needed by the existing synchronous Noctua transactions and test teardown. |
| Revise | schema users.name | Do not add it for new DBs. One-time import from existing slice-1 DB into auth_user.name, then read through Better Auth; old column stays inert. |
| Revise | schema users.disabledAt, setUserDisabled | Stop using the column/helper as an independent authority. Import real disabled state to a permanent auth_user ban; Noctua service invokes banUser/unbanUser, deletes MCP tokens, audits. Client DTO uses disabled:boolean. |
| Revise | lib/db/users.ts NewUser/insertUserRow/insertUser/DuplicateUserEmailError | Remove request-time mirror insertion helpers; installAuthControlPlane triggers/backfill own explicit ID/email/role/integer-createdAt mirroring; no raw after-hook mirror writes. Public provisioning rejects existing e-mail; operator migration alone binds a legacy profile ID. |
| Revise | updateUserProfile | Remove independent writable name/role: Better Auth is authoritative. Invoke adminUpdateUser for an admin target, updateUser only for self-profile, setRole for role; SQLite triggers mirror compatible fields. Login e-mail changes are operator-only in this release. |
| Revise | deleteUser | Retain Noctua cascade/owner reassignment. Ban/revoke first, durable lifecycle journal, retry shard unassignments, then removeUser to cascade auth children. Do not wrap awaited Better Auth calls in a synchronous SQLite transaction. |
| Revise | USER_ROW_SELECT/mapUserRow + lib/data.ts User + tests | Explicit joined DTO: name, role, active ban, twoFactorEnabled, hasPassword via credential existence, passkeyCount; no hash selection/spreading. Preserve Noctua integer createdAt. |
| Replace | app/api/auth/signup/route.ts interim insertUser/addUserAccountLink rewrite | It still calls saveAccounts and claims the invite before duplicate failure; therefore it is not the new signup contract. Replace with §4.3 reservation/create/finalize/compensation and 409 mailbox_exists before IMAP or invite reservation. |
| Revise | lib/db.ts auth exports and tests schema.master/users/rowParsers | Remove retired auth helpers, preserve useful domain assertions, replace password/liveness assertions with Better Auth integration and DTO secrecy checks. |
| Remove | lib/passwords.ts and lib/passwords.test.ts | Better Auth owns policy/hashing integration; retain only a small `Bun.password` argon2id hash/verify adapter in lib/betterAuth.ts, without a second independent auth API. Helpers must not reject dummy timing hashes. |
| Remove | users.passwordHash/passwordUpdatedAt additions and reads | Password hashes live only on auth_account(providerId='credential'); DB sessions are revoked explicitly. Existing dev columns can remain unused after any intentional migration. |
| Remove | users.mustChangePassword column/use | No shared/admin-set initial passwords; targeted invite and reset link let the person choose. The mandatory MFA gate is different and remains explicit Noctua policy. |
| Remove | UserAuthRecord/getUserAuthByEmail, UserLiveness/getUserLiveness, updateUserPassword, nowUnixSeconds | Better Auth credential APIs/getSession and lifecycle service replace them. Remove their barrel exports/tests, not the membership functions next to them. |

`6fee1b8` does not yet implement async Better Auth guards, takeover prevention, the new MFA gate,
new MCP format or the SMTP-follow rule. Do not mistake its generic merge helper for those fixes.
The spike was based on upstream users(id,email,role,createdAt), so its mirrors/tests need adapting
to this branch's DTO and migration reality rather than blindly copying the file.

## 2. Seven sequential implementation slices

Each slice is one implementation-agent handoff, with no commits/push/PR/deploy authority implied.
Work only in its assigned checkout. Keep unrelated changes and the other branches' files alone.
All slices must compile with no new type errors and pass their checks. Before Slice 1 capture
`bunx tsc --noEmit --incremental false` and lint/test baseline: known upstream type diagnostics must
be compared and reported, not called clean. Every slice runs `bun run test:ci`, `bun run build`,
targeted eslint (no new warnings) and type-delta checks; concurrency/mock-sensitive changes also run
`bun run test:stress`. Repair fixtures/callers in the slice that changes their contract.

Exposure contract: Slice 1 adds the mounted /api/ba route returning 503
`{code:"auth_integration_pending"}` for unfinished production exposure. Slice 2 retires legacy auth
and makes unfinished Noctua mutation routes controlled 503 too. Slices 2–5 are an integration branch,
not a runnable production cut-over: no fallback to the legacy cookies. Unit/HTTP tests construct the
reviewed handler directly in-process; there is no test-admin route or deployed environment bypass.
Slice 6 removes the hardcoded readiness guard only after all backend controls exist. Slice 7 accepts
the actual UI against that enabled API. ui-shell can develop from DTOs earlier; its full acceptance
waits for **Slice 6**, not the old Slice 4/Slice 5 contradiction. Do not deploy intermediate slices.

### Slice 1 — pinned core, transaction-safe mirrors and credential barrier

Owner: feat/team-auth. Design: D1/D14/D16, §3.1–3.1.2, §4.1 configuration, §8, §10.
Closes F1, F9; provides S5/F8 barrier (end-to-end closure in Slice 5). Parent-delete cascade must remain valid.

Deliver `lib/betterAuth.ts` options/getAuth/migrateAuthSchema, exact 1.7.12 pins, dedicated auth
connection, zero master busy timeouts and safe close/reopen reset. Add `lib/db/authPolicy.ts`
installAuthControlPlane: sidecar schema, exact SQLite mirror triggers/backfill, credential-generation
triggers (INSERT/UPDATE/DELETE with missing-state abort), migration-before-construction and startup
validation. Do not port raw `databaseHooks.user.*.after` mirrors or public e-mail→legacy-ID claim.
Keep slice-1 password helpers/DTOs temporarily intact here; removing them belongs to Slice 2 with
all importing routes. The new auth stack remains HTTP-unavailable. Add shared testAuthHarness that
can issue a real library cookie and seed explicit sidecars/factors for later policy tests.

Wrap resolveAccountDbPath's lazy master backfill in withDbWriteRetry with conditional UPDATE/re-read;
audit other runtime direct master writes. Keep shard timeout policy. Add startup secret/origin,
telemetry and supported-mode validation, but do not add a second auth/session implementation.
Startup order is initMasterSchema → migrateAuthSchema → installAuthControlPlane → betterAuth;
route graph repeats an empty idempotent plan. No network in hooks or transactions.

**Checks:** focused core/mirror/security-trigger/connection tests plus common slice checks. Real
adapter transaction rollback + queued creation, mirror constraint error, later after-hook failure,
second startup, date conversion, blank dbPath under auth contention, teardown/reopen and shared-handle
negative control. Port the v4 throwaway proofs into permanent adjacent tests.

**Acceptance:** both auth and mirror commit/rollback together; committed password writes advance
security generation even if a callback later throws. No raw mirror write can join another auth
transaction. Existing domain behavior remains testable; /api/ba exposure is still 503.

### Slice 2 — atomic legacy retirement and asynchronous session guards

Owner: feat/team-auth. Design: D2/D4/D5/D15, §3.1 DTOs, §4.1, §4.6, §5.1, §8, §10.
Closes F2/I1 (retirement half), I3, I8; establishes the fail-closed sidecar gate for S1/F7/S7.

Replace lib/auth.ts with async requireActiveUserSession and explicit response-header propagation;
await every direct/helper caller, remove requireSessionAccountOr403. **In this same slice** replace
app/api/auth/signup/route.ts with a controlled 503 handler that imports no retired helper; retire
/api/auth/login (410). Then remove buildSessionPayload/setSessionCookie legacy exports,
lib/passwords.ts/tests, custom password/liveness helpers/exports and obsolete auth DTO reads.
Any import of a removed symbol must be fixed now, including MCP/admin tests and helper paths.
Unsupported unfinished routes return explicit 503 until their owner slice replaces them.

Remove cookie credential overlays/lib/credentials.ts and all session/MCP credential payload branches;
encrypted DB-only storage (db default, both deprecated alias); cookie/desktop rejected, including
all desktop signup invite exemptions. Preserve membership/prefs/audit/safe merges from
6fee1b8. Joined DTOs read authoritative auth_user; initialization uses narrow profile-only readers
before auth schema exists. Migrate every hand-sealed-cookie fixture to testAuthHarness.

Implement the gate that denies missing sidecar, stale generation, non-mfa assurance, inconsistent
user flag/verified TOTP record or absolute authenticatedAt age. Security sidecar issuance/finalization
is completed in Slice 4; no live public login is enabled yet. /me separates enrollment/none/unselected/
selected, persists a deterministic default through ensureActiveAccountId/setActiveAccountId, retries
revoked selection once and never returns local-only accounts[0]. Selection-dependent calendar/import
uses the same helper. Implement switch-account, bodyless same-origin logout, signOut Set-Cookie
forwarding and success semantics; no nonexistent /api/auth/password route is introduced.

**Checks:** common checks + affected route fixtures, guard await inventory, legacy-symbol rg sweep,
me/default-selection/zero-memberships/revoked-selection/race tests, cookie refresh/deletion and next
/me rejection, restricted gate tests with forged/stale/absent sidecars. Test signup's new 503 handler
and ensure it compiles before deleting imports; stress fixture order.

**Acceptance:** no legacy session or credential overlay can authorize any route, and no route
imports a removed helper. Fresh login selection is persisted; zero memberships and selection failure
are distinct. Logout works with the shell's bodyless POST and origin checks. Public BA remains 503.

### Slice 3 — mailbox roles, credential service, MCP and revocable streams

Owner: feat/team-auth. Design: §4.6–4.7, §5.1–5.4, §6.4 server prefs, §9 stream seam, §10.
Closes S3, F10, I9; supports S4/S5 with mailbox-generation writes.

Implement accountAccess/accountPresentation, role matrix per handler (including destination editor
checks), owner/admin boundaries, member routes and sparse per-user prefs. Reuse retained membership
DB helpers. shared=memberCount>1; stable name/e-mail/id sorting and secret-free role-specific payloads.
lib/mailboxCredentials.ts is the only repair/write-back path for relogin/PUT/POST-existing-id and
later explicitly enabled personal IMAP login (never a shared mailbox): endpoint verification, immutable fields, blank-secret unchanged, exact SMTP-follow
rule. Changing a login mailbox's credential/identity advances the owner's generation in the same
master transaction, revokes sessions/tokens/challenges and closes streams. Restrict identity changes
to owner/admin. Do not silently make ownerless shared mailboxes personal login identities.

Replace MCP mint/hash validation and account binding; NULL/old generations are invalid. Gate minting
on session mfa assurance; each use checks live creator, both MFA records, current generation and bound
mailbox role. Keep tool-registration edits for thread-collaboration. Add lib/authStreams.ts and wire
open IMAP stream through pre-enqueue DB checks, revocation events, <=5s liveness and expiry timers;
clean up only that stream's resources. Add role-aware mailbox failure DTOs for managers versus viewers/
editors and no personal-auth logout on IMAP failure.

Add lib/membershipCleanup.ts cleanupUserAccountAccess seam: absent-both tables is not_installed,
partial schema is an error, installed schema unassigns/audits idempotently. Membership revoke commits
before shard cleanup and persists failures in admin_lifecycle_operations; deletion later reuses it.
No import of a future threadCollab module. Stage 2 activates unassignUserInAccount through this seam.

**Checks:** common checks + role/MCP/credential/prefs/stream tests and stress. Open stream then
revoke/ban/delete/expire/generation-change; reject the next sensitive enqueue and release timers.
Both collaboration schema states plus partial-schema failure. All SMTP coupling permutations through
all service entry points; no secrets/repair dialog payload for viewer/editor. MCP foreign-account,
role downgrade, creator ban and stale generation cases.

**Acceptance:** all mailbox operations use current membership and explicit role. Revoke takes effect
for REST, existing streams and MCP even when cleanup fails. Backend credential-error/selection DTOs
are stable for ui-shell. No public authentication activation yet.

### Slice 4 — assurance, fresh proof, factors, lost-device recovery and browser harness

Owner: feat/team-auth. Design: D3/D13, §3.1.2, §4.1–4.2, §4.4 proof matrix/replacement,
§10.1. Closes S1/S2/S7/S8,
F3/F5/F7 and I6. S4 closes for all factor/revoke boundaries; reset boundary finishes in Slice 5.

Implement lib/authPolicy.ts and /api/auth/reauth, operation-specific grant purposes from the matrix,
durable security:<userId> slots using admin_lifecycle_operations, request-scoped metadata and challenge
registry. No global mutable proof context. UV reauth binds its grant to the resulting rotated session;
finalizers run outside adapter transactions as specified in §4.4. Capture generation before credential verification, bind
login challenges to generation/first-factor time and anonymous passkey options to auth_login_epoch; missing registry means rejection. Finalize assurance
only for the live resulting session; preserve authenticatedAt across refresh/rotation. On initial
TOTP verification, require both records, atomically advance generation, revoke every other setup
session and promote only the verifying session. Faults at any library write leave restricted access.

Guard raw enable/verify/passkey requests; HTTP-disable enrolled seed export, raw disable, raw backup
regeneration, raw change-password/update-user and mutating admin operations. Implement reviewed
security/password, security/backup-codes and totp/replace wrappers, forcing server revocations and
respecting the library's current-password requirements. Finish backup login → new password+backup
code proof → one-use totp.replace → restricted replacement → real new TOTP → subsequent login.
Atomic code consumption uses auth.api.verifyBackupCode with disableSession:true and installed CAS;
never reuse the login's consumed code as the replacement grant.

Passkey registration/authentication verify UV server-side; keep registration.requireSession:true,
deny registration createSession:true and trustDevice:true. Port only the version-coupled IMAP bridge
from the spike with strict eligibility/limiter/write-back; unset/empty NOCTUA_IMAP_LOGIN_HOSTS keeps
it OFF by default. Only a nonempty exact host allowlist enables it; shared=false is required and adding
a viewer makes that mailbox ineligible. Use the same gate for IMAP-based credential proof.
No user means no network; no provisional session before MFA. Preserve positive/negative canaries.
Publish /me and proof/factor DTOs for ui-shell in doc/AUTHENTICATION.md.

Deliver §10.1's pinned Playwright config/spec/fixture and scripts/runAuthBrowserTests.ts; package
command test:auth-browser. Use a minimal in-memory fixture page supplied by the harness to exercise
real WebAuthn against the handler before the production client exists; no shipped test route.

**Checks:** unset/empty IMAP allowlist rejects before network/session/write-back and hides the UI
action; an explicit allowlist enables only eligible personal mailboxes, never shared ones. Common
checks + core/policy/IMAP HTTP tests, test:stress and
`bunx playwright install chromium && bun run test:auth-browser` on localhost:3784. Include UV=false
server rejection, real registration/assertion, RP/origin mismatch, anonymous options invalidation by reset/revoke, and grant binding; options-only
unit tests are insufficient. Two sessions before enrollment, stolen passwordless session seed/code
attempts, verified-record fault, challenge invalidation, age through password rotation, two concurrent
backup-code proofs (one winner), interrupted replacement and full lost-phone/new-factor login.

**Acceptance:** user-wide factor enrollment cannot authorize an unproved session, credential knowledge
is required per matrix, no raw endpoint bypass exists, and lost-device recovery can complete. IMAP
stays OFF unless explicitly allowlisted and all canaries pass; mandatory TOTP gates every user. Public /api/ba remains 503 until lifecycle/reset controls land.

### Slice 5 — provisioning, lifecycle and password-reset backend

Implementation status (2026-10-22): provisioning/active-only journals, lifecycle serialization,
targeted invites, admin/operator handover and anonymous reset policy implemented. Contract and
verification evidence: `doc/AUTHENTICATION.md` "Slice 5"; fault/contender tests:
`lib/teamAuthSlice5.test.ts`, HTTP handoff: `app/api/admin/users/route.test.ts`.
Public `/api/ba` activation remains hardcoded 503 until Slice 6; reset UI remains Slice 7.

Owner: feat/team-auth. Design: §3.1 journals/triggers, §4.3–4.5, §8, §10 recovery/admin.
Closes S5/S6, F4/F6/F8, I2 (backend), I5, I7; closes reset edge of S4.

Replace signup's 503 with userProvisioning saga. Validate invite authority/capacity/expiry/e-mail
binding BEFORE IMAP/SMTP, plus existing user/mailbox 409 before network/reservation. Atomically recheck
and reserve first-admin/invite capacity + intended ID; scoped createUser, trigger mirror, finalize
new mailbox/membership/claim. Use active-only journal uniqueness; keep complete/cancelled history by
operation ID. Idempotent compensation/restart reconciliation; reject incomplete users at login.
Min-length validation is explicit before admin createUser; no mailbox password first-admin fallback
or desktop invite exemption. Every signup requires a valid invite.

Implement lifecycle journals/last-admin serialization, targeted invites, correct adminUpdateUser
for target name; updateUser is for self, ban/unban/setRole/removeUser with audit and cleanup seam.
Keep raw HTTP admin paths blocked; no-header server createUser is private to provisioning/migration.
Password-change wrapper and triggers enforce other-session/MCP/challenge revocation independent of
caller flags. onPasswordReset is cleanup only; fault after commit must not revive an old bearer.

Implement restricted admin-issued recovery with personal handover and the audited local operator
lockout equivalent. SMTP recovery delivery is an explicit non-goal; no public recovery-request
wrapper or SMTP sender configuration. Configure sendResetPassword via request-scoped sink, 900s reset TTL and revokeSessionsOnPasswordReset:true.
Expose unauthenticated token-authorized GET /api/ba/reset-password/:token and POST /api/ba/reset-password
in the internal handler policy, while raw issuance stays blocked. Require canonical /reset-password
callback `https://mail.example.org/reset-password` in production (isolated test/preview instances
use their own exact origin), JSON {token,newPassword}, no-store/no-referrer and URL/log redaction.
Issue no auth session on success and preserve existing MFA. Deliver reset contract to ui-shell; its page lands in Slice 7.
The handler still returns 503 externally until Slice 6.

**Checks:** recovery issuance requires admin/operator authority, links expire after 15 minutes and
are single-use, no SMTP delivery or public issuance, no desktop invite exemption. Common checks +
signup/admin/reset/recovery tests and stress. Invalid/expired/exhausted/
wrong-person invites assert zero IMAP/SMTP calls; first-admin/invite contention; crash boundaries;
complete-user delete/reinvite and repeat recovery; actor≠target name update. Test callback destination,
unauthenticated valid-token reset, expiry/reuse/parallel redemption, preserved MFA, pre-reset challenge
rejection and onPasswordReset throw/interruption (old MCP invalid even before deletion). Admin/cleanup
faults remain inaccessible and last-admin cannot race.

**Acceptance:** an identity is usable only after complete provisioning and proved factors. Reset
issuance has an owner and redemption has a complete route contract. Neither post-commit callbacks
nor a caller's revocation flag are security dependencies. Public HTTP activation remains pending.

### Slice 6 — migration, backend activation and production smoke

Owner: feat/team-auth (deployment integration owner coordinates). Design: §7.4 API readiness,
§8–§10, §11 auth/backup contract. Closes I1 exposure half and I4 planning/owner handoff; finishes backend evidence for all S/F IDs.

Implement scripts/migrateTeamAuth.ts and recoverTeamAuth.ts: explicit stable ID mappings, duplicate/
shared-address rejection, safe slice-1 chosen-password hash import, disabled→ban, name import, no
shared temporary password, old cookie/MCP invalidation and idempotent second run. Review startup
bootstrap logs/secret redaction. Remove transitional old login/crypto dead code; rg all callers.
Document final env/systemd/TLS/RP ID/recovery in doc/AUTHENTICATION.md, README and deployment examples:
BETTER_AUTH_URL=https://mail.example.org, PASSKEY_RP_ID=mail.example.org, canonical trusted origin
only, DNS A 203.0.113.10 inside the tailnet, TLS certificate/renewal via mailprovider API DNS-01. Leave
NOCTUA_IMAP_LOGIN_HOSTS unset by default, DB-only storage and no desktop mode; recovery links are
handed over personally, never sent by SMTP. The preview https://preview.example.org:3790
is separate, with isolated auth data/secrets and preview-only origin/RP ID; never add it to canonical
production trust or claim canonical passkey reuse (design §8.1).

Enable the /api/ba mounted handler and completed Noctua wrappers only now; no runtime “unsafe auth”
flag remains. A direct API smoke can test reset even before the page merges; advertise the actual
recovery links to users only with Slice 7 installed. Integration owner merges UI and backend before
any deployment. Implement the resolved decisions in doc/TEAM-INBOX.md; no pending policy switch
blocks the assigned slices.

**Checks:** common checks + all auth/migration tests, production build/start at 3785, second startup,
/api/ba/ok, cookie refresh, real proxy-origin simulation, factor/challenge/gate flows, ban/revoke/MCP,
old-cookie rejection and synthetic migration twice. Run `bun run test:auth-browser`. Record exact
versions/output and any known baseline failures. Restore a synthetic auth/master/shard/key backup in
isolated storage and confirm factors/IDs; final application-wide restore is still Stage 4.

**Acceptance:** /api/ba is available with every backend policy and reset route enforced; there is
one auth stack, no temporary bypass. ui-shell can now run full client acceptance. This is Stage 1
backend completion, not MailPlus go-live; §1.1 items 11–18 have their own owners.

### Slice 7 — ui-shell auth/reset integration and release evidence

Owner: feat/ui-shell for UI files, integration owner for check record. No team-auth agent edits its
worktree. Design: §4.1/§4.4/§4.6 client contracts, §7.2/§7.4, §10–§10.1; closes I2 UI, I10, I11
(actual shell harness acceptance); verifies I3/I8/I9 client behavior.

Implement/finish lib/authClient.ts and app/components/auth/{LoginScreen,TwoFactorChallenge,
EnrollmentScreen,SecuritySettings,ReauthDialog,ResetPasswordForm}.tsx. Reuse shell shadcn primitives
and tokens. Main password form, explicit UV passkey action/conditional UI cancellation, optional
explicit IMAP method (hidden unless server availability says the allowlist enables it; never expose
the allowlist itself), mandatory TOTP/backup challenge, reload-safe restricted enrollment and mailbox-independent
security menu. The proof header is in-memory on both passkey options+verification. Matrix-specific
password prompts remain even with UV where the library requires a password. Lost-phone form asks
for the newly consumed replacement code; no “disable mandatory MFA” UI.

Add public app/reset-password/page.tsx and page headers with §4.4 token handling/history clearing,
new-password confirmation, POST reset redemption, expiry/reuse/success states. It works while logged
out and returns to login + existing MFA. /me mailboxState drives distinct enrollment/none/unselected/
selected states; remove local-only first-mailbox selection and keep Admin/Security usable without
mail. Bodyless logout checks success before clearing state. Wrong security-form credentials stay
inline; viewer/editor mailbox failures show contact-manager, manager failures offer repair.

Honor the existing feat/ui-shell ComposeFields.tsx fix: always show From including modal/mobile,
with a DOM regression. Retain account-wide check-all-folders, domain groups/e-mail labels and badge
slots. Extend browser harness fixtures to actual client flows against enabled Slice 6 APIs.

**Checks:** auth/reset/selection/logout/role-error/ComposeFields DOM tests; common checks;
`bun run test:auth-browser` against actual shell. Install PWA on both household phones at canonical
HTTPS https://mail.example.org (never the preview-host preview): password+TOTP, UV passkey,
backup-code/replacement recovery, mailbox switch, read, reply and
camera-photo attachment. Record manual gaps explicitly; simulator/virtual-authenticator checks alone
do not mark phone acceptance passed. No real personal data in fixtures/screenshots.

**Acceptance:** signup/setup/login/security and out-of-band reset redemption work end-to-end;
mailbox failures do not lock personal identity out. The real browser harness command is reproducible,
From is visible on mobile, and phone/PWA evidence is recorded before Stage 1 sign-off.

## 3. Handoff and consistency rules

Canonical new route inventory (Noctua paths are not aliases of raw BA endpoints):

| Path / method | Backend slice | Client owner |
|---|---|---|
| GET /api/auth/me; POST /api/auth/switch-account; bodyless POST /api/auth/logout | 2 | ui-shell / 7 |
| POST /api/auth/reauth | 4 | ui-shell / 7 |
| POST /api/auth/totp/replace | 4 | ui-shell / 7 |
| POST /api/auth/security/password | 4 | ui-shell / 7 |
| POST /api/auth/security/backup-codes | 4 | ui-shell / 7 |
| POST /api/auth/signup | disabled 2; provision 5 | ui-shell / 7 |
| POST /api/admin/users/[userId]/recovery | 5 | admin collab-ui / 3rd stage; operator first |
| GET /api/ba/reset-password/:token; POST /api/ba/reset-password | 5, activation 6 | ui-shell / 7 |
| GET /reset-password | backend headers 5; page 7 | ui-shell |
| /api/ba/[...all] sign-in, TOTP verification, passkey options/verification | policy 4–5; activation 6 | ui-shell / 7 |

Raw get-totp-uri, generate-backup-codes, two-factor/disable, change-password, update-user,
request-password-reset and mutating admin HTTP paths stay disabled after activation. Wrappers invoke
reviewed server APIs, not a generic proxy. The exact sign-in/verification paths and policy rules are
in design §4; /api/auth/login stays retired. Stage 3 /api/me/mailboxes/summary and /api/me/events belong
to collab-ui, not these auth slices.


- Existing spike names remain getAuth, noctuaAuthOptions, migrateAuthSchema, setActiveAccountId,
  imapSignIn, AUTH_BASE_PATH and IMAP_SIGN_IN_PATH. installAuthControlPlane, finalizeAuthentication,
  advanceSecurityGeneration, invalidateUserChallenges, readSessionSecurity, isMfaEnrollmentComplete,
  ensureActiveAccountId, cleanupUserAccountAccess, assertStreamAuthorized are **new production work**,
  not claimed spike exports. Match the design's modules and route paths.
- Better Auth owns six auth_* models; Noctua owns auth_login_epoch, auth_security_state, auth_session_security,
  auth_pending_challenges, auth_reauth_grants, user_provisioning and admin_lifecycle_operations.
  mcp_tokens.securityGeneration is compared to auth_security_state.generation. Exact options are
  emailAndPassword.{disableSignUp,minPasswordLength,maxPasswordLength,password,
  revokeSessionsOnPasswordReset,resetPasswordTokenExpiresIn,sendResetPassword,onPasswordReset},
  session.{expiresIn,updateAge,freshAge,cookieCache,additionalFields}, twoFactor allowPasswordless,
  passkey authenticatorSelection/registration.requireSession/registration.afterVerification/
  authentication.afterVerification. Do not invent authentication.userVerification or mandatoryMFA.
- Policy decisions are resolved in doc/TEAM-INBOX.md v5 (§2/§4/§8 and Appendix A). Canonical plan:
  doc/TEAM-AUTH-PLAN.md; review history: doc/TEAM-AUTH-REVIEW-LOG.md. No alternative auth stack,
  SMTP recovery sender, desktop mode or cookie credential mode is part of these slices.
- Stage 2 thread-collaboration and mailbox-watcher, Stage 3 collab-ui and conditional sender-identities,
  Stage 4 chore/mailplus-cutover are required follow-on owners in design §9. team-auth does not implement
  them by implication and cannot claim overall go-live. The cleanup/stream/semaphore handoff seams
  must already work before those branches/tables exist. Files change owners only after merge/handoff.
