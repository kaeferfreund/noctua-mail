# Reviews of feat/team-auth ad6db7a (slice 2) — Codex gpt-6.1-sol, 2026-10-22 ~13:20 UTC. Paths relative to the worktree.

## Security lens — findings (for fix round 2, after team-auth-fix-r1)
1. MEDIUM — Global import marker skips identities created later — lib/db/authPolicy.ts:179. Startup marks `legacy-profile-v1` complete even when disabled legacy profiles have no auth_user yet; identities mapped later never receive ban/name (probe: disabledAt set, banned:0, name "Migration Placeholder"). Fix: track import completion per profile, or transfer atomically when the operator migration binds each identity; startup-before-identity regression.
2. MEDIUM — /api/probe is an unauthenticated outbound connection oracle — app/api/probe/route.ts:98 (inherited): connects to submitted host/port without any session (loopback probe 200 without cookie). Fix: full session gate before network activity, or controlled 503 until the authorized setup flow exists (slice 5 provisioning).
3. MEDIUM — Admin invite creation lacks origin validation — app/api/admin/invites/route.ts:32 (inherited): same-site form POST with Lax cookie created an invite (201). Fix: requireJsonSameOrigin before the admin guard; foreign-origin regression.
4. LOW — Sync helpers log unclamped x-noctua-client — app/api/_helpers/syncJobs.ts:18 and :60 (215-char id logged even unauthorized). Fix: one shared validator (1–64 chars [A-Za-z0-9_-]) before forwarding/logging (§4.6).

Verified sound: 92 route files / 118 handlers inventoried, all guard calls awaited; MFA access 200 / no session 401 / stale generation 401 after credential change; enrollment /me minimal, mailbox + switch-account 403; four-state /me, persisted selection, revocation retry, factor consistency, provisioning/ban rejection, absolute expiry regressions pass; cross-origin logout 403, HTTPS logout deletes __Secure- cookies, next /me 401, idempotent; DTOs never select hashes; sanitizers blank IMAP/SMTP/CalDAV/DeepL secrets; test:ci 1,760 + 12 DOM.

## Plan-conformance lens — findings (fix round 2)
5. MEDIUM — Admin invite mutation bypasses origin checks (same as security #3): app/api/admin/invites/route.ts:32 — missing Origin/Referer AND foreign Origin both 201 with a real MFA admin session. Fix: same-origin/body convention or controlled 503 until the lifecycle slice.
6. MEDIUM — Watcher integration will not compile after slice 2 (for the watcher fix round / merge): wt-mailbox-watcher app/api/_helpers/mailboxSummary.ts:2 imports requireSessionOr401; lib/teamFeatures.ts:1 imports shouldStorePasswordInDb — both removed in ad6db7a. Fix at integration: await requireActiveUserSession, forward headers, obtain accessible mailbox ids (not session.accountId), replace the storage predicate with the supported-runtime seam.
7. LOW — Docs advertise unavailable auth: README.md:166, doc/AUTHENTICATION.md:7, doc/DEPLOYMENT.md:19 (cookie mode, sealed sessions, SESSION_SEAL_KEY, legacy login, sliding lifetime, Tauri). Fix: short transitional notice now; full rewrite stays slice 6.
8. LOW — Logout test overstates grant cleanup: app/api/auth/me/route.test.ts:100 seeds only a pending challenge, never an auth_reauth_grants row. Fix: seed + assert deletion with another session's state as surviving control.

## Slice-7 shell change list (from the plan reviewer; shell at bff923c)
- useAccountController.ts: AuthMeResponse gains nullable accountId, accounts, mailboxState, security, restricted identity; consume states before fetching mailbox data; clear stale mailbox state when selection becomes null.
- utils/accountControllerHelpers.ts: remove the automatic accounts[0] fallback; unselected sessions must persist an explicit selection first.
- MailClient.tsx: same state handling at initial load / after auth / during /me polling; render enrollment, "No mailbox yet" and an unselected picker separately; mailbox effects only in selected state; check logout response before clearing local state; narrow the broad 401 heuristic; handle MFA codes and role-aware mailbox repair separately.
- ShellUserMenu.tsx: mailbox-independent "Profile & security"; remove the active-mailbox prerequisite for Admin (+ MailClient callback).
- LoginOverlay.tsx / new auth components: Better Auth password/passkey, challenge, enrollment, proof, recovery, reset UI; remove desktop exceptions and IMAP credentials from personal signup.
- Shell tests: four mailbox states, failed logout, persisted switching, restricted enrollment after reload, mailbox-independent security/admin.
Current shell behaviour vs new /me: selected compatible (ignores /me.accounts, refetches /api/accounts); enrollment → /api/accounts 403, empty/error view, no login loop; none → empty shell, Admin disabled; unselected → local accounts[0] while server selection null; logout + switch requests compatible.

## Merge notes
ad6db7a + 30ca640 (watcher): 4 conflicts — instrumentation.ts (DB → auth → gated watcher, keep success-flag placement), lib/db.ts (auth cleanup + watcher/summary exports, retired exports stay removed), lib/serverDb.ts (both wrapper sets), imap/stream/route.ts (watcher's extracted IDLE + awaited guard + header forwarding) + the two semantic import fixes (#6). ad6db7a + bff923c (shell): package.json (shell deps + exact 1.7.12 pins), bun.lock (regenerate, verify pins); auth UI merges textually, semantics = slice 7.
Ownership: LoginOverlay.tsx narrow desktop-exemption removal (ui-shell-owned, coordinate); guard/header-only edits in thread-collaboration routes are allowed by §9.
Verified: test:ci 1,760 + 12; tsc 151/0 new; lint baseline; guard inventory 123 calls / 0 unawaited; legacy sweep clean; gate and /me tests active.
