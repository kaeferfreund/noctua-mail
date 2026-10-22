# Review of briefs/TEAM-INBOX.better-auth.md + team-auth-replan.md — lens: feasibility (Codex gpt-6.1-sol, 2026-10-22 ~09:58 UTC)

10 feasibility issues. Spike suite 39 pass / 0 fail; spike worktree clean.

1. **High — Raw mirror writes reintroduce transaction coupling.** Draft §3.1 mirror rules (line 215).
   "Mirrors run on the auth connection within the auth operation" is not atomic. Spike `lib/betterAuth.ts:113–128` executes mirror SQL via `db.prepare()`, bypassing the Bun dialect's connection mutex; Better Auth `dist/db/with-hooks.mjs:34,70` queues after-hooks and `@better-auth/core/dist/context/transaction.mjs:77–109` runs them after commit. A concurrent auth transaction can capture a raw mirror write and roll it back. **Fix:** transaction-safe mirroring (reviewed SQLite triggers) or serialize auth operations + mirror execution with durable reconciliation; add concurrent mirror/rollback and post-commit-failure tests.

2. **High — Slice 2 removes helpers that signup still imports until Slice 4.** Replan Slice 2 (line 102), Slice 4 (line 188).
   `6fee1b8:app/api/auth/signup/route.ts:2,136–144` imports and invokes `buildSessionPayload` and `setSessionCookie`. **Fix:** replace or temporarily disable signup in Slice 2 (controlled unavailable response), removing obsolete imports immediately; full provisioning in Slice 4.

3. **High — Backup-code recovery cannot complete TOTP replacement.** Draft §4.4 (lines 504, 550).
   Same as security finding 8. **Fix:** accept a newly consumed backup code plus first-factor proof for a narrowly scoped `totp.replace` grant; test lost-device → backup login → replacement → subsequent login.

4. **Medium — Admin name updates cite the wrong server API.** Draft §4.5 PATCH user (line 576).
   Core `dist/api/routes/update-user.mjs:58` always updates `session.user.id`. The admin API is `adminUpdateUser` (`dist/plugins/admin/routes.mjs:233`, `{userId,data}`). **Fix:** specify `auth.api.adminUpdateUser({headers, body:{userId,data:{name}}})`; reserve `updateUser` for self-profile; test actor ≠ target.

5. **Medium — UV proof does not waive Better Auth's TOTP password checks.** Draft §4.4 (line 506).
   `dist/utils/password.mjs:72–75`: `shouldRequirePassword` depends on credential existence; TOTP enable/disable and backup-code generation still demand the password when `hasPassword=true`, regardless of a Noctua grant. **Fix:** publish an operation-specific proof matrix; retain the password prompt for stock plugin operations when a password exists, or design and test a trusted replacement operation.

6. **Medium — Recovery links have no planned redemption screen or callback contract.** Draft §4.4 (line 540), replan line 249.
   `dist/api/routes/password.mjs:80–81,122–127` requires a callback destination and redirects with the token; `POST /reset-password` needs `{token,newPassword}`; no consumer exists. **Fix:** assign a public reset page, trusted `redirectTo`, token handling/clearing, submission contract and expiry/reuse tests to the UI slice.

7. **Medium — The MFA gate checks only one half of enrollment state.** Draft §4.1 (line 366).
   `dist/plugins/two-factor/totp/index.mjs:205–222` sets the user flag and replaces the session before writing `auth_two_factor.verified=true`, without a transaction. **Fix:** require an existing verified TOTP record as well as the user flag; reconcile inconsistent activation state; fault injection between the writes.

8. **Medium — `onPasswordReset` cannot guarantee MCP revocation after failure.** Draft §4.4 (line 553).
   `dist/api/routes/password.mjs:160–163` commits the new password before the callback; retrying cannot repair (token consumed). **Fix:** revoke MCP tokens before committing, or persist a revocation barrier atomically with the credential change and check it during MCP auth; test callback failure and interruption.

9. **Medium — An existing master write is outside the required retry boundary.** Draft §3.1 zero busy timeout (line 205), replan line 73.
   `lib/db/connection.ts:203–215` `resolveAccountDbPath` writes a missing legacy `accounts.dbPath` directly; with `busy_timeout=0` ordinary shard access can fail during an auth write. **Fix:** wrap this backfill with `withDbWriteRetry` and audit other direct master writes; test opening a legacy mailbox with blank `dbPath` under auth contention.

10. **Medium — Auth membership/deletion cleanup depends on a later branch's tables.** Draft §5.4 (line 733), §9 (line 1139).
    Membership revoke and user deletion require `thread_collab_state` + `unassignUserInAccount`, which belong to `feat/thread-collaboration`. **Fix:** define an explicit cleanup seam that succeeds when collaboration tables do not yet exist; activate full cleanup with Stage 2; test both schema states.

Verified as correct: exact package versions, configuration names, six `auth_*` model mappings, SQLite ISO dates and integer booleans; programmatic `getMigrations/runMigrations`, migration-before-construction, second-start idempotence; `/api/ba`, `toNextJsHandler`, `nextCookies()` last, separate Next module graphs, explicit wrapper cookie forwarding; signed `noctua.session_token`, `__Secure-` naming, disabled cookie cache, server-only `activeAccountId` with `input:false`; disabled signup also blocks server `signUpEmail`; headerless admin `createUser` works and skips min password length; ban revocation, impersonation restrictions, HTTP-only `disabledPaths`, opt-in password-change session revocation; TOTP defaults, backup-code single use, lockout defaults, IMAP bridge positive + negative controls; passkey `rpID` string, `origin` string/list, registration options and both verification callbacks exist (authentication requests preferred UV, so server enforcement remains necessary); separate connections prevent Noctua writes joining auth transactions; `6fee1b8` is 19 files / +2511 / −67 and its keep/revise/remove classification matches; preserved IDs keep user_accounts, invites, MCP creators, prefs and audit compatible.
