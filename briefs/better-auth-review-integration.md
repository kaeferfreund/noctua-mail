# Review of briefs/TEAM-INBOX.better-auth.md + team-auth-replan.md — lens: integration + requirements (Codex gpt-6.1-sol, 2026-10-22 ~09:56 UTC)

Static review; no files changed, no tests executed. Draft = TEAM-INBOX.better-auth.md, Replan = team-auth-replan.md.

1. **High — Slice 2 removes helpers that signup still imports until Slice 4.** Replan:102, Slice 4; `wt-team-auth/app/api/auth/signup/route.ts:2,136`.
   **Fix:** disable and remove the old signup implementation in Slice 2 (controlled unavailable response) until Slice 4 supplies provisioning; reconcile "full acceptance waits for backend Slice 4" with enabling `/api/ba` only in Slice 5.

2. **High — Recovery links have no defined redemption UI or complete route contract.** Draft §4.4:540, §7.4; Replan:162,259.
   No reset callback destination, token-redemption screen or completion endpoint is assigned, while Slice 3 says direct reset endpoints stay blocked. **Fix:** assign the reset screen and exact callback/completion routes to ui-shell/team-auth; distinguish restricted link issuance from unauthenticated token-authorized redemption; test admin handover → new password → MFA login.

3. **High — `accountId:null` conflates no selection with no memberships.** Draft §4.1:378, §5.1; `useAccountController.ts:162`, `utils/accountControllerHelpers.ts:16`.
   New Better Auth sessions have no selected mailbox even with twelve memberships; the shell silently picks `accounts[0]` locally without persisting; calendar/import uses the session's active mailbox. **Fix:** separate empty-membership and unselected-mailbox states; select and persist a valid default server-side, or require `/switch-account` before mailbox-dependent features; test fresh login, revoked selection, zero memberships.

4. **High — The single source of truth still omits essential MailPlus replacement work.** Draft §9:1139; fit report §2 items 9, 11–18.
   No watcher branch, worker-cap ownership or cutover stage; `lib/drafts.ts` only "hook only"; Replan:297 disclaims watcher, Sent reliability and MailPlus cutover without assigning replacements. **Fix:** add go-live criteria and owners/dependencies from the fit report (watcher/worker cap, Sent reliability, mailbox summaries, cutover/restore acceptance).

5. **Medium — Password-change revocation is a caller option, not an enforced server invariant.** Draft §4.4:529, §4.7; `dist/api/routes/update-user.mjs:161–176`.
   Raw endpoint accepts optional `revokeOtherSessions`; no mandatory hook for MCP revocation. **Fix:** disable raw HTTP password changes and expose a reviewed wrapper, or enforce both revocations through server hooks regardless of options; test with the flag absent/false.

6. **Medium — Backup-code login does not provide a complete lost-phone recovery path.** Draft §4.4:504, 550–558. (Same as security 8 / feasibility 3.)

7. **Medium — The provisioning journal permanently reserves completed users' addresses.** Draft §3.1:104, §4.5.
   `user_provisioning.normalizedEmail` unconditionally UNIQUE while completed operations remain; no journal cleanup on deletion. **Fix:** uniqueness only for active operations; keep history by operation ID; define deletion/reinvitation and repeated-recovery behaviour with tests.

8. **Medium — Logout's new JSON requirement conflicts with the existing shell request.** Draft §4.6:604; `MailClient.tsx:5326`.
   The shell sends logout with only `{method:"POST",credentials:"include"}` and ignores failure. **Fix:** specify the bodyless-mutation convention, update logout, check success before local logout; test cookie deletion and subsequent `/me` rejection.

9. **Medium — Viewer/editor credential failures still open a manager-only repair dialog.** Draft §4.6:621, §5.2; Replan:270.
   `reauthRequired` keeps triggering the credential dialog that submits `/relogin`, which now needs manager. **Fix:** role-aware credential-error responses: managers get repair; others get "mailbox unavailable, contact a manager".

10. **Medium — Stage-1 mobile sender visibility and acceptance remain incomplete.** Draft §7.2:980, §9/§10; `ComposeFields.tsx:310`.
    `showFrom = variant === "inline"` while mobile compose is always a full-screen modal (fit-report item 8); `ComposeFields.tsx` not assigned. **Fix:** assign `ComposeFields.tsx` to ui-shell, show From in every variant, add its modal DOM test; restore the full installed-PWA acceptance sequence (read/reply/camera attachment) on both phones.

11. **Medium — Real WebAuthn acceptance lacks an executable harness and check command.** Replan:169, Draft §10.
    **Fix:** assign browser fixture/test/config paths and a reproducible command; include it in release checks; keep real-phone acceptance separate.

Overall: substantially coherent; not ready for implementation handoff until sequencing, recovery and account-selection contracts are resolved; incomplete MailPlus replacement plan until deferred go-live work has owners.

Verified as consistent: old sealed-cookie/iat/passwordUpdatedAt/mustChangePassword/lib/passwords.ts/SESSION_SEAL_KEY//api/auth/password references describe retirement or migration; `auth_user` authority, mirrored IDs, integer dates, separate auth tables and `/api/ba` agree across decisions/schema/migration/replan; `requireActiveUserSession` retained as an async Better Auth guard with per-request liveness + membership checks; fit-report blockers 3–6 addressed, item 1 corrected, item 2's sorting specified; shell 9009bc5 supplies domain grouping, e-mail tooltips and item 7's account-wide check action; MCP tokens opaque, hash-backed, mailbox-bound, checked against creator status/role; prefs keep stable user IDs; DB-only credentials support workers; provider-independent app credentials/passkeys allow login during a netcup outage; canonical HTTPS origin/RP-ID guidance correct; "Profile & security" opens mailbox-independent SecuritySettings (the checked shell still gates Admin on `currentAccount`); replan follows AGENTS.md.
