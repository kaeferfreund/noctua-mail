# Review of briefs/TEAM-INBOX.better-auth.md + team-auth-replan.md — lens: security (Codex gpt-6.1-sol, 2026-10-22 ~09:57 UTC)

8 design gaps, incl. two MFA blockers. The 39 spike tests pass; in-memory checks reproduced findings 1, 2 and 4. Package-source paths relative to `wt-spike-better-auth/node_modules/better-auth/dist`.

1. **High — Enrollment silently upgrades other password-only sessions.** Draft §4.1 line 366.
   An attacker obtains a password-only session before initial TOTP enrollment. When the legitimate user finishes enrollment elsewhere, the attacker's unchanged session passes the proposed `auth_user.twoFactorEnabled=true` gate and can access mail or mint MCP tokens without MFA. Evidence: `plugins/two-factor/totp/index.mjs:205` updates the user flag and replaces only the enrolling session; reproduction showed the second session retaining its token. **Fix:** record authorization assurance per session; on initial enrollment revoke every other setup session and authorize only the session that completed verification; enforce for REST, admin and MCP-token creation; add a two-session enrollment regression test.

2. **High — The existing TOTP secret can escape the credential-proof policy.** Draft §4.4 line 504.
   A holder of an IMAP-only user's session calls `/api/ba/two-factor/get-totp-uri` without credential proof and obtains the enrolled TOTP seed; can also regenerate backup codes without a password. Evidence: `plugins/two-factor/totp/index.mjs:90` requires a session, then skips the password check when `allowPasswordless` applies; `plugins/two-factor/backup-codes/index.mjs:250` permits session-only regeneration. **Fix:** disable post-enrollment seed retrieval over HTTP, or require purpose-bound fresh proof including an existing factor; explicitly protect backup-code regeneration; negative tests for both raw endpoints with stolen passwordless sessions.

3. **Medium — Open mail streams survive authorization revocation.** Draft §5.1 line 655; `app/api/accounts/[accountId]/imap/stream/route.ts:43`.
   The event stream checks authorization once at entry; `fetchNew` emits envelopes (lines 275–290) with no later check. **Fix:** bind streams to user/session/account identity, close them on lifecycle events, recheck before emitting, enforce an expiry timer; test revocation against an open stream.

4. **Medium — Pending first-factor challenges survive password reset.** Draft §4.4 line 553.
   `plugins/two-factor/index.mjs:294` stores the challenge against only the user ID; `verify-two-factor.mjs:19` creates a new session on completion; `utils/password.mjs:31` revokes sessions during reset but leaves challenges intact. Reproduced. **Fix:** invalidate outstanding challenges on credential changes and security revocation, or bind them to a credential generation checked at completion; cover password reset, IMAP credential change and explicit revocation in tests.

5. **Medium — MCP revocation after password reset can fail after the password commits.** Draft §4.4 line 553.
   `api/routes/password.mjs:160` completes `resetCredentialPassword` before `onPasswordReset` at line 163 (outside the transaction). **Fix:** atomically advance a security generation alongside the credential mutation and reject MCP tokens from older generations; token deletion becomes cleanup; fault injection at the callback boundary.

6. **Medium — Signup performs outbound verification before establishing invite authority.** Draft §4.3 line 471.
   Step 3 verifies mailbox credentials, then validates the invite; `lib/mail/imapAuth.ts:17` connects with `skipBreaker:true` to any host/port. Upstream prechecks the invite first. **Fix:** validate invite existence, expiry, capacity and e-mail binding before any network work, keep the later atomic reservation/recheck; test that invalid invites cause zero IMAP/SMTP calls.

7. **Medium — Session replacement defeats the claimed absolute authentication age.** Draft §4.1 line 374 and §4.4.
   `api/routes/update-user.mjs:161` verifies the current password without TOTP; with `revokeOtherSessions:true` it creates a replacement session (line 177) with a new `createdAt` (`db/internal-adapter.mjs:286`), restarting the 24h boundary. **Fix:** preserve an original `authenticatedAt` across rotations and enforce absolute age against it; advance assurance only after a complete password-plus-factor or UV-passkey login.

8. **Medium — Backup-code login cannot complete the specified TOTP recovery flow.** Draft §4.4 line 507 vs 551.
   Replacing TOTP requires "the current TOTP" or a UV-passkey assertion; a user who lost the device and has no passkey cannot restore the factor. **Fix:** accept a newly submitted, atomically consumed backup code together with current first-factor proof for a `totp.replace` grant; test the full lost-device path.

Overall: strong direction; the MFA session boundary and secret-export paths need correction before implementation acceptance. Keep IMAP login disabled until the complete policy, recovery and revocation tests pass.

Verified as sound: IMAP bridge removes its provisional session before returning the challenge (negative control shows why); password sign-in challenges enrolled users; backup-code reuse rejected; ban revokes DB sessions and blocks password/IMAP sign-in; impersonation denied; cookie cache disabled; `activeAccountId` rejects public writes; origin checks; separate auth tables preserve IDs; separate SQLite handles prevent foreign-write rollback; passkey callbacks enforce UV at the right boundary (real WebAuthn acceptance still outstanding); opaque mailbox-bound MCP tokens; cookie-cache MFA advisory GHSA-xg6x-h9c9-2m83 addressed by version/config; GHSA-fmh4-wcc4-5jm3 concerns the excluded organization plugin; 1.7.12 changelog checked.
