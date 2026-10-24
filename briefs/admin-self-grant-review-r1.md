**PIN — merge `b6c1ba9` and use it for interim preview 8.5.**

P1: none. P2: none. P3: none. No corrective commit required.

Reviewed `b6c1ba94019dad49410dba7df623ece2f10a26a8` over integration round 8, `11dc3c5f50826aec73f7547990e3b89def1dd08b`. The detached review checkout remains clean. Gates ran against an archived copy inside the permitted probe directory, with installed dependencies mounted read-only and synthetic credentials/storage. No merge or deployment performed.

- **Role-selector suspicion rejected.** [AdminMailboxes.tsx:64](/home/monkey/code/noctua-mail/wt-review-collab/app/components/admin/AdminMailboxes.tsx:64) resolves every option through `Admin.roles`. German renders Verwalter/Bearbeiter/Leser; English renders the existing catalog labels manager/editor/viewer. The screenshot therefore shows a resolved English label. Native selects also appear in [MembersTabContent.tsx:104](/home/monkey/code/noctua-mail/wt-review-collab/app/components/account-settings/tabs/MembersTabContent.tsx:104) and AdminPanel’s role controls; this follows the existing role-selector pattern. Both catalogs are complete, parity/ICU checks pass, and the new German copy follows du-form and Postfach terminology.
- **D6 and §5.4 preserved.** Creation leaves the mailbox inaccessible with zero members. Only the explicit grant button calls the existing admin PUT. The route obtains the actor from the authenticated admin session; [accountMembers.ts:52](/home/monkey/code/noctua-mail/wt-review-collab/lib/accountMembers.ts:52) writes membership and audit atomically. Browser evidence verifies one `member.grant`, actor = target = current admin, with the selected role. Authenticated non-admin POST/PUT requests return 403 and expose no creation/self-grant UI.
- **Refresh works through both entry points.** Successful PUT → `onCreated()` reloads the admin list → awaited `onAccessChanged()` invokes MailClient’s `loadInitialData` → `/api/auth/me` → `setAccounts`/`setActiveAccountId` in [useAccountController.ts:136](/home/monkey/code/noctua-mail/wt-review-collab/app/components/mailclient/useAccountController.ts:136). The new sidebar row appears without reload; clicking it returns switch-account 200 and persists the new selection. A separate zero-membership admin successfully uses Add a mailbox → create → explicit grant → selected shell, without a lingering dialog.
- **Failures and dismissal verified.** PUT 403/409/500 remain inline with the follow-up open and no membership change. A delayed double-click produces one PUT and one audit row. While pending, controls are disabled and Escape cannot dismiss. Später/Later, Escape and Close otherwise dismiss without granting; zero members and the hint remain. The hint’s members-editor shortcut opens correctly.
- **UI and tests verified.** English and German at 320/390 px, light/dark: no dialog overflow, actions remain reachable, settled screenshots inspected. Tab cycling stays inside the dialog and keyboard role selection works. [AdminMailboxes.dom.test.tsx:32](/home/monkey/code/noctua-mail/wt-review-collab/app/components/admin/AdminMailboxes.dom.test.tsx:32) asserts encoded account/current-user IDs and exact PUT bodies for all three roles. The submitted Playwright spec covers create → explicit grant → sidebar plus the self-audit; added probes cover actual switching and the remaining cases above.

Gate results:

- `bun run typecheck`: exit 0; zero errors, 1,196 files.
- `AdminMailboxes.dom.test.tsx` ×3: 6/0 each; 18 passes total, 29 assertions per run.
- `bun test lib/i18n/catalogs.test.ts`: 8/0; 3,523 assertions.
- `nice -n 10 timeout 1800 bun run test:ci`: exit 0; 2,805/0 server tests, 15,308 assertions, 450.02s; 468/0 DOM tests, 2,710 assertions, 69.19s.
- `timeout 600 bun run lint`: exit 1 at the unchanged baseline, one error and 25 warnings. Error: `app/components/calendar/useCalendarConflicts.ts:58:5`; zero new findings.
- `nice -n 10 timeout 1200 bun run build`: exit 0; compile 23.0s, production typecheck and standalone preparation pass.
- Production Playwright on 3895, fixtures 3897–3899: submitted spec 1/1; four added scenarios 4/4. Combined run: 5/0 in 1.6m. Settled German screenshot replay: 1/0.
- `git merge-tree --write-tree origin/integration/stage b6c1ba9`: exit 0, conflict-free; tree `d0824d63fa95208c026265704baa6fc15d89f3ca`, identical to the reviewed commit’s tree. Git object writes were redirected into probes.

Evidence and replay scripts: [admin-self-grant-regressions-r1](/home/monkey/code/noctua-mail/briefs/admin-self-grant-regressions-r1). Final gate logs are `logs/ci-rerun.log`, `logs/browser-rerun.log`, and the named focused logs. The first CI attempt was invalidated by my dependency-mount change during execution; the complete rerun above passed. Initial native-cache/browser probe setup and assertion errors were corrected only inside probes. Owned servers were stopped.

UTC load averages: start 08:48:43 — **6.11 / 6.85 / 6.46**; end 09:08:35 — **3.83 / 6.95 / 7.49** (1/5/15 minutes).
