# Better Auth v4 revision log

2026-10-22. Scope: design v3→v4 and team-auth replan v1→v2 for kaeferfreund/noctua-mail.
All 29 numbered review findings were checked against the installed source and the fork before
acceptance. These are design corrections and implementation acceptance requirements, not a claim
that production controls already exist. No finding was rebutted. Overlapping findings retain their
own IDs so every original review item has a disposition.

| Review | Accepted | Rebutted | Total |
|---|---:|---:|---:|
| Security (S) | 8 | 0 | 8 |
| Feasibility (F) | 10 | 0 | 10 |
| Integration/requirements (I) | 11 | 0 | 11 |
| Total | 29 | 0 | 29 |

Evidence anchors are relative to ROOT:
`/home/monkey/.t3/scratch/2026-10-22-https-github-com-paulwellnerbou-noctua-8f78a215`.

- **BA** = wt-spike-better-auth/node_modules/better-auth/dist/ (installed 1.7.12).
- **CORE** = wt-spike-better-auth/node_modules/@better-auth/core/dist/ (1.7.12).
- **PK** = wt-spike-better-auth/node_modules/@better-auth/passkey/dist/ (1.7.12).
- **DIALECT** = wt-spike-better-auth/node_modules/@better-auth/kysely-adapter/dist/ (1.7.12).
- **SP** = wt-spike-better-auth/ at commit 98f04ad.
- **N** = noctua-mail/ (team-inbox, read-only); **T** = wt-team-auth/ (read-only).
- Original review references mean design v4 and replan v2. Their promoted successors are
  doc/TEAM-INBOX.md v5 and doc/TEAM-AUTH-PLAN.md v3; the 29 dispositions/evidence below are historical.
  Package and fork line anchors are to inspected source, not to changing design line numbers.

Read completely: both original briefs, all three reviews, requirements-fit-report.md including §2
items 1–18/§3/§5, SP/doc/SPIKE-BETTER-AUTH.md, SP/lib/betterAuth.ts,
SP/lib/betterAuthImapSignIn.ts and supporting tests/helpers. Read N/AGENTS.md and verified
`git -C wt-team-auth show 6fee1b8 --stat`: 19 files, +2511/−67. Preserve its disposition table;
the retained domain work is not replaced wholesale by the spike.

## Security review: 8 accepted, 0 rebutted

### S1 — per-session assurance during initial MFA enrollment: accepted

Evidence: BA/plugins/two-factor/totp/index.mjs:205–222 changes the user flag, creates a replacement
for the current session and deletes only that predecessor; it does not delete another password-only
session. BA/db/internal-adapter.mjs:259–289 creates ordinary session rows without application assurance.
A throwaway two-session test reproduced the surviving session seeing twoFactorEnabled=true.

Change: §3.1.2 introduces auth_session_security and generation-bound finalization. §4.1 requires
that session's mfa assurance plus both verified enrollment records. Initial verification advances
generation and deletes all other sessions/setup proof in one immediate transaction, promoting only
the live verifying session. Faults remain restricted. Slices 2/4; two-session and partial-write checks.

### S2 — TOTP seed export / backup regeneration with stolen session: accepted

Evidence: BA/plugins/two-factor/totp/index.mjs:90–133 exposes getTOTPURI with session middleware;
password is conditional at 126. BA/plugins/two-factor/backup-codes/index.mjs:250–302 similarly permits
regeneration without a credential password. BA/utils/password.mjs:72–75 returns false for a
passwordless account with allowPasswordless=true. Throwaway test reproduced both exports after
removing only the synthetic credential account.

Change: §4.4 disables HTTP get-totp-uri entirely and exposes no service seed-export function.
Only proof-authorized enable returns the new seed. Raw generate-backup-codes is disabled; reviewed
security/backup-codes needs backup.regenerate fresh Password+Factor grant and stock password body
when present. Negative raw-path stolen-session tests. Slice 4.

### S3 — already-open streams outlive revocation: accepted

Evidence: N/app/api/accounts/[accountId]/imap/stream/route.ts:43–51 checks access once;
:82–85 enqueues without another check; :251–290 fetches and emits message envelope data later.
No Better Auth library session check can retroactively cancel this application ReadableStream.

Change: §5.1 defines authStreams registration, per-sensitive-enqueue live authorization, post-commit
close events, <=5s idle liveness, absolute expiry and resource cleanup; future per-user SSE reuses it.
Tests revoke an open stream's session/membership/generation or ban user, then deny subsequent data.
Slice 3, Stage 3 integration.

### S4 — pending first-factor challenges survive credential revocation: accepted

Evidence: BA/plugins/two-factor/index.mjs:292–304 stores verification value=userId;
BA/plugins/two-factor/verify-two-factor.mjs:16–31 loads that value then creates a session after
consumption. BA/utils/password.mjs:31–46 revokes sessions and mutates credential but does not revoke
unrelated 2fa verification values. Source establishes the stale-challenge boundary directly.

Change: §3.1.2 adds auth_pending_challenges bound to generation, first-factor time and source session
where applicable. Validate before and after verification, serialize user security operations with a
durable slot, require metadata on all completions, invalidate on reset/change/IMAP write-back/revoke.
Anonymous passkey options have no user (PK/index.mjs:265–288), so auth_login_epoch snapshots
invalidate them on revocation before binding the eventual verified user. Physical cleanup is not
required for rejection. Slices 3/4/5, tests for every credential/revoke trigger.

### S5 — post-commit reset callback cannot guarantee MCP revocation: accepted

Evidence: BA/api/routes/password.mjs:160–163 awaits resetCredentialPassword then invokes
onPasswordReset. BA/utils/password.mjs:31–46 wraps credential/reset-token/session work in a
transaction; CORE/context/transaction.mjs:77–109 commits before queued hooks. Throwaway fault
injection proved the new password works and reset token is spent even when the callback throws.

Change: §3.1.2 credential INSERT/UPDATE/DELETE triggers advance auth_security_state.generation inside
the credential transaction. §4.7 requires mcp_tokens.securityGeneration match on every use; null or
old generations fail closed. onPasswordReset is retryable deletion/audit cleanup only. Throwaway
trigger test verified generation advanced despite callback failure. Slices 1/3/5.

### S6 — invite authority must precede outbound verification: accepted

Evidence: v3 §4.3 step 3 verified mailbox credentials before validating the invite;
N/lib/mail/imapAuth.ts:17–28 connects using the supplied account and skipBreaker:true.
N/app/api/auth/signup/route.ts:51–64 already prechecks an invite before IMAP at :88; v3 regressed it.
Better Auth disableSignUp does not guard Noctua's custom provisioning/network service.

Change: §4.3 checks invite existence/expiry/capacity including active reservations/e-mail binding and
bootstrap role BEFORE any IMAP/SMTP/DNS work, then retains atomic recheck/reservation after network
verification. Test invalid/expired/exhausted/wrong-person invites make zero outbound calls. Slice 5.

### S7 — absolute age must survive session replacement: accepted

Evidence: BA/api/routes/update-user.mjs:161–177 verifies password and optionally replaces the session;
BA/db/internal-adapter.mjs:286 stamps a new createdAt. TOTP activation also replaces a session at
BA/plugins/two-factor/totp/index.mjs:209–213. createdAt cannot represent original authentication age.

Change: §3.1.2/§4.1 sidecar authenticatedAt is captured at complete login/first-factor ceremony and
preserved across cookie refresh, password/TOTP rotations and reauth. Guards expire at min(library
expiresAt, authenticatedAt+24h). New complete login alone can restart age. Slices 2/4.

### S8 — backup-code login lacks TOTP replacement authority: accepted

Evidence: v3 §4.4 required current TOTP or UV passkey for replacement, excluding a lost-device/no-
passkey user. BA/plugins/two-factor/backup-codes/index.mjs:202–227 compares encrypted backupCodes
and atomically updates them; :229–233 supports disableSession:true for fresh proof consumption.

Change: §4.4 gives the full path: password+backup login, then current password+newly consumed backup
code for totp.replace; one-use grant; restricted disable/enable continuation; verified replacement,
new codes and subsequent login. Login's consumed code cannot stand in for replacement proof. Race
same-code requests (one winner), old-factor/code/session/MCP rejection and interruption tests. Slice 4.

## Feasibility review: 10 accepted, 0 rebutted

### F1 — raw mirror after-hooks are not transactional: accepted

Evidence: SP/lib/betterAuth.ts:113–128 directly calls db.prepare().run in user after-hooks.
BA/db/with-hooks.mjs:34–40,70–76 queues those hooks; CORE/context/transaction.mjs:77–109 executes
them after commit. DIALECT/bun-sqlite-dialect-DoOVo4ja.mjs:22,33–47 owns a connection mutex; raw SQL
bypasses it. Separate Noctua/auth handles alone do not fix writes on the auth handle itself.

Change: §3.1.1 chooses SQLite triggers with exact insert/update mirror SQL, startup install/version
validation and preserved integer createdAt; removes raw mirrors/public legacy e-mail claim. Missing/
failing mirror aborts auth write. Throwaway real-adapter tests cover queued creation versus a held
rollback, rollback of auth+mirror together and mirror-trigger constraint failure. Production Slice 1
adds after-commit-failure and migration backfill tests; no network/await transaction is introduced.

### F2 — signup imports helpers removed two slices earlier: accepted

Evidence: T/app/api/auth/signup/route.ts:2 imports buildSessionPayload/setSessionCookie;
:136–144 invokes both. The original replan removed them in Slice 2 but replaced signup only in 4.
Better Auth's route mount does not repair TypeScript imports in the legacy static route.

Change: replan Slice 1 retains old helpers temporarily; Slice 2 atomically disables legacy signup
with a clean-import 503 handler, retires legacy login and removes all importing helpers/fixtures
in the same slice. Full provisioning replaces that handler in Slice 5. Every slice builds/tests.

### F3 — backup-code replacement recovery gap: accepted

Evidence: same installed CAS/disableSession path as S8,
BA/plugins/two-factor/backup-codes/index.mjs:215–233; v3 matrix omitted that capability.
Change: §4.4 complete lost-device flow and newly consumed-code totp.replace grant. Slice 4, S8 tests.

### F4 — admin target-name API is adminUpdateUser: accepted

Evidence: BA/api/routes/update-user.mjs:58 updates session.user.id, irrespective of an intended target.
BA/plugins/admin/routes.mjs:233–235,303–306 defines adminUpdateUser and uses body.userId/body.data;
BA/plugins/admin/admin.mjs:69–72 registers setRole and adminUpdateUser as distinct API names.

Change: §4.5 explicitly calls auth.api.adminUpdateUser({headers,body:{userId,data:{name}}}); updateUser
is self-profile only, setRole remains the exact admin role API. Replan disposition and Slice 5 agree;
actor≠target test proves only target changed.

### F5 — UV reauth cannot waive stock password requirements: accepted

Evidence: BA/utils/password.mjs:72–75 uses credential existence, independent of Noctua grant;
BA/plugins/two-factor/index.mjs:99–105 checks password on enable,
BA/plugins/two-factor/totp/index.mjs:126–128 and backup-codes/index.mjs:279–281 do likewise.

Change: §4.4 operation/purpose/proof/API matrix retains password prompts for TOTP operations and
backup regeneration whenever hasPassword=true. UV substitution is limited to operations that accept
it; changePassword still needs currentPassword. No invented override option or copied crypto. Slice 4.

### F6 — reset link redemption page/routes undefined: accepted

Evidence: BA/api/routes/password.mjs:80–81 generates /reset-password/:token?callbackURL;
:92–127 redirects to callback with token or INVALID_TOKEN; :129–160 expects POST token/newPassword.
No public reset page exists in the inspected fork file inventory.

Change: §4.4 and §7.4 assign team-auth issuance, canonical callback and public BA redemption routes;
ui-shell owns app/reset-password/page.tsx, ResetPasswordForm and secret clearing/no-store/no-referrer.
Replan Slices 5/6/7 separate internal policy, public activation and actual page acceptance.

### F7 — user flag is not enough for verified TOTP enrollment: accepted

Evidence: BA/plugins/two-factor/totp/index.mjs:205–222 updates user, rotates session, then writes
verified:true; those statements are not enclosed in one transaction here. A failure can split state.

Change: §4.1 isMfaEnrollmentComplete requires flag AND exactly one verified factor/secret, plus
session assurance. Mismatch is mfa_state_inconsistent and restricted reconciliation, never auto-
verification. Finalization after both writes promotes only one session. Slices 2/4; fault each boundary.

### F8 — reset callback failure can leave old MCP valid: accepted

Evidence: BA/api/routes/password.mjs:160–163 plus BA/utils/password.mjs:31–46; same root cause as
S5. Consumed reset tokens cannot simply retry the committed callback through reset-password.
Change: credential-generation triggers + per-use MCP generation comparison (§3.1.2/§4.7), cleanup
separate from security correctness. Throwaway callback-failure test passed. Slices 1/3/5.

### F9 — resolveAccountDbPath bypasses write retry: accepted

Evidence: N/lib/db/connection.ts:203–216 reads an empty legacy dbPath and directly UPDATEs at :215.
SP's dedicated auth connection uses nonblocking writers, so this write must participate in retry.
Better Auth does not own or retry this Noctua shard-resolution path.

Change: §3.1 requires conditional backfill + re-read within withDbWriteRetry and audits other runtime
master writes. Slice 1 tests opening a blank-dbPath mailbox while auth holds a write lock; another
writer's nonblank value wins. No blocking busy-timeout workaround.

### F10 — cleanup depends on future collaboration tables: accepted

Evidence: N/lib/db/schema.ts and T/lib/db/schema.ts contain no thread_collab_state; neither tree
has lib/threadCollab.ts. v3 §5.4 nevertheless required UPDATE of that future table during revoke.
Auth plugin removeUser cannot clean application shard assignments across files.

Change: §5.4 lib/membershipCleanup.ts seam works before Stage 2 (both tables absent => not_installed),
performs transactional unassignment/activity when installed, errors on half-installed schema and
persists retry intent after access revocation. Deletion reuses the seam while banned. Slice 3.

## Integration review: 11 accepted, 0 rebutted

### I1 — removal order / handler activation contradict UI dependencies: accepted

Evidence: T/app/api/auth/signup/route.ts:2,136–144 confirms F2. Original replan Slice 3 supplied
security UI API contracts, Slice 4 was called the full UI prerequisite, but /api/ba only enabled in 5.
SP/app/api/ba/[...all]/route.ts is a mounted handler, not proof of production policy readiness.

Change: same-slice retirement in Slice 2; hardcoded production-unavailable handler through Slice 5;
Slice 6 activates all backend routes after policy/lifecycle; Slice 7 accepts real client flows. No
unsafe runtime toggle or legacy fallback. The exposure contract and UI dependency now agree.

### I2 — recovery UI/callback contract absent: accepted

Evidence: same installed callback/POST behavior as F6 (BA/api/routes/password.mjs:80–81,92–164).
Restricted reset issuance and unauthenticated token redemption are separate boundaries; disabling
all reset endpoints prevents the handed-over link from working.

Change: §4.4/§7.4 canonical public /reset-password page, GET /api/ba/reset-password/:token and POST
/api/ba/reset-password; raw request-password-reset stays disabled, reviewed issuance wrapper only.
Slices 5–7 own backend/page; test admin handover→password reset→existing MFA login.

### I3 — null selected account does not mean zero memberships: accepted

Evidence: N/app/components/mailclient/useAccountController.ts:147–169 loads /me then chooses locally;
utils/accountControllerHelpers.ts:16–26 falls back to accounts[0]. SP/lib/betterAuth.ts:activeAccountId
additional field is optional, and setActiveAccountId writes it only when called. New sessions can
have memberships without a stored selection; existing calendar/import consumes session selection.

Change: §4.1 explicit mailboxState selected/none/unselected/enrollment, persisted deterministic
server default via ensureActiveAccountId/setActiveAccountId with revoked-selection race handling.
§7.4 UI never conflates zero memberships with a missing selection. Slices 2/7.

### I4 — MailPlus replacement has unowned go-live blockers: accepted

Evidence: full requirements-fit-report.md §2 items 9,11–18 and §5; N/instrumentation.ts:3–13 has
no server watcher; N/lib/syncJobs.ts:388–395 spawns workers without a global cap. Existing Sent-copy
best-effort paths do not implement the fit report's reliability requirements. No Better Auth option
supplies mailbox watching, Sent semantics or application backup.

Change: §1.1 maps ALL 18 items to acceptance and owners; §6.3 expands direct/draft/calendar Sent,
server ingest and flags; §9 adds mailbox-watcher/semaphore, Stage 3 summaries/signatures, conditional
sender identities and Stage 4 chore/mailplus-cutover; §11 rewrites the runbook for Better Auth and
consistent backups. Replan handoff names these owners, never claims auth alone completes go-live.

### I5 — password change caller controls revocation: accepted

Evidence: BA/api/routes/update-user.mjs:93 makes revokeOtherSessions optional;
:173–177 revokes/rotates only when truthy. No mandatory MCP revocation is included there.

Change: §4.4 raw /api/ba/change-password disabled; /api/auth/security/password always supplies true,
requires password.change proof and rejects caller revocation flags. Credential triggers invalidate
MCP/challenges independent of caller options/callbacks. Slices 4/5; absent/false raw/wrapper tests.

### I6 — lost-phone recovery cannot finish: accepted

Evidence: BA/plugins/two-factor/backup-codes/index.mjs:215–233 supports atomic new-code proof;
v3 required unavailable current TOTP/UV for replacement. Same root as S8/F3.
Change: §4.4 complete narrowly scoped replacement, §7.4 UI and Slices 4/7 checks. No session-only bypass.

### I7 — completed provisioning journal reserves e-mail forever: accepted

Evidence: v3 §3.1 declared user_provisioning.normalizedEmail NOT NULL UNIQUE with retained completed
operations; deletion contract did not remove them. No installed Better Auth schema owns this journal
or releases its uniqueness. Application journal policy must resolve deletion/reinvite/recovery.

Change: §3.1 partial unique index only for reserved/auth_created/cleanup_required; complete/cancelled
history by operation ID. §4.3 specifies delete/reinvite and repeated recovery, revoking earlier reset
links. Slice 5 adds concurrent active-operation and post-completion reuse tests.

### I8 — JSON-only logout breaks existing bodyless call: accepted

Evidence: N/app/components/MailClient.tsx:5317–5318 sends POST with credentials but no body/content-
type. Original §4.6 required application/json for every mutation. BA signOut can be called by the
wrapper; the incompatibility is the proposed Noctua boundary, not a need to invent a request body.

Change: §4.6 requireBodylessSameOrigin shares origin checks with JSON helper, requires zero body,
and defines bodyless DELETE/logout conventions; §4.1/§7.4 client checks logout success before state
clear. Slices 2/7; deletion cookie + next /me unauthorized regression.

### I9 — non-managers are offered a forbidden credential repair: accepted

Evidence: N/app/components/MailClient.tsx:467–478 treats any mailbox reauthRequired as a dialog
trigger. N/app/api/accounts/[accountId]/relogin/route.ts:41 responds to failed verification; v3 role
matrix makes repair manager-only. Library auth errors cannot distinguish mailbox repair privileges.

Change: §4.6 manager repairAllowed/reauthRequired versus viewer/editor unavailable/contact-manager
response, no repair dialog/attempt, no global identity logout; close a stale dialog on downgrade.
Slices 3/7 test both roles and mid-dialog downgrade.

### I10 — mobile From row and PWA acceptance incomplete: accepted

Evidence: N/app/components/mailclient/composition/ComposeFields.tsx:310 gates From on inline;
:352 renders conditionally. v3 D11/§7.2 mandates modal mobile compose, so sender is hidden there.
The already-in-progress feat/ui-shell fix remains its owner's work, not an auth edit.

Change: §7.2/§9 explicitly assign ComposeFields.tsx to ui-shell and all variants/modal DOM test;
§1.1 fit 10/§10/§11 require installed iOS+Android PWA login/switch/read/reply/camera-attachment sequence.
Slice 7 accepts that existing fix and records phone evidence; do not duplicate work.

### I11 — real WebAuthn acceptance has no runnable harness: accepted

Evidence: PK/index.mjs:278 asks preferred UV for authentication; :483 verifies with
requireUserVerification:false; :487 runs authentication.afterVerification before :500 creates a
session. Registration callback runs at :368 before persistence at :387. SP passkey test only obtains
registration options; file inventory has no browser/WebAuthn harness. Thus unit options alone cannot
prove the UV boundary, registration cryptography or real browser behavior.

Change: §10.1 assigns playwright.auth.config.ts, tests/browser/auth/{fixtures.ts,webauthn.spec.ts},
scripts/runAuthBrowserTests.ts and package script test:auth-browser; fixed localhost:3784, isolated
synthetic data, CDP virtual authenticator, real create/get, UV=false server rejection, RP/origin and
proof binding, own-PID cleanup. Slice 4 implements the harness; Slice 7 runs actual shell flows;
both-phone canonical HTTPS acceptance remains separate. The harness is specified, not claimed run.

## Verification performed and limits

- `git -C wt-spike-better-auth rev-parse --short HEAD`: 98f04ad; initial status was empty.
- `timeout 300 bun test lib/betterAuth.test.ts app/api/ba` in the spike: **39 pass, 0 fail,
  140 expectations**, two files, 21.68 seconds. This proves the retained spike claims, not new policy.
- `bun test /tmp/noctua-v4-verification.test.ts`: **5 pass, 0 fail, 15 expectations**, 8.30 seconds.
  Synthetic temp SQLite files and identities only; no HTTP listener/IMAP/SMTP/real data. Exact cases:
  1. Stock initial enrollment leaves second password-only session alive and its user flag flips.
  2. Passwordless stock session exports existing TOTP URI and regenerates backup codes.
  3. Trigger mirror with real adapter held rollback + queued create; aborted user's data rolls back,
     queued user's mirror persists and createdAt is integer.
  4. Auth/mirror updates roll back together; failing mirror trigger aborts the auth write.
  5. Triggered credential generation advances even when onPasswordReset throws; new password works,
     old reset token is spent. Actual MCP per-use comparison is a production acceptance test, not
     present in the spike; the test proves the atomic barrier it will compare against.
- Trigger fixture used §3.1.1's exact insert/update mirror SQL and §3.1.2 credential INSERT/changed-
  password UPDATE rules. Production DELETE/provider-change/missing-state triggers, anonymous passkey login epoch, slots, assurance,
  streams and browser harness are explicit future implementation checks; they were not misrepresented
  as existing spike exports or executed controls. No full production build/lint was needed for edits
  to three external Markdown briefs. No external provider/network behavior was claimed verified.
- Final consistency checks cover all 29 IDs, slice checks/acceptance, API method spelling from the
  installed modules, six model names versus Noctua sidecars, exact route contracts, fixed-port browser
  commands and the five original policy questions (resolved below). No installed option named mandatoryMFA or authentication.
  userVerification was invented. New helper names are explicitly marked production deliverables.
- Removed all scratch files created by this task. Final `git -C wt-spike-better-auth status --short`
  returned empty output; HEAD remains 98f04ad. All other worktrees were
  read-only throughout; doc/TEAM-INBOX.md was never edited. No commit, push, PR or deployment.

## User decisions recorded at promotion (2026-10-22)

The original review's policy questions are resolved in doc/TEAM-INBOX.md v5 and
doc/TEAM-AUTH-PLAN.md v3. The findings and verification history above retain their original scope;
this promotion does not claim any additional implementation tests passed.

1. D13: TOTP is mandatory for every user before mailbox access; UV passkeys provide convenient login;
   backup codes remain available.
2. D3: retain personal IMAP first factor, OFF by default, enabled only by the explicit hostname
   allowlist; never for shared mailboxes. Unknown provider login mappings leave it disabled.
3. D2: encrypted DB-only credentials; cookie-only mode is dropped (`both` is a deprecated db alias).
4. D15: Tauri/desktop mode is dropped and unsupported, including the desktop signup invite exemption.
5. D17: admin issues a 15-minute single-use link and hands it over personally; SMTP recovery delivery
   is a non-goal. Public token redemption remains available.
6. Canonical origin https://mails.monkeymed.de and RP ID mails.monkeymed.de; DNS A 100.92.134.1 inside
   the tailnet, TLS via netcup API DNS-01. The remote-arm HTTPS preview is separate. The deployment
   owner records actual proxy addresses/trusted hops and certificate renewal configuration (§8.1).

## Remaining cut-over inputs (unchanged scope)

7. Inventory: any aliases that must send as aliases? If yes, feat/sender-identities is a pre-cutover
   dependency. Confirm personal/shared address mappings and intended mailbox roles/ownership.
8. Accept English UI or budget translation; decide calendar of record and continuing Synology Contacts.
9. Operator sets backup retention/restore-time/data-loss targets, verifies NAS archive destination,
   and measures netcup capabilities/concurrency/login/body limits. Stage 4 records evidence and user
   sign-off; source review cannot settle provider/account-specific facts or phone compatibility.
