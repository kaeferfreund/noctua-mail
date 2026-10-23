# perf-admin-panel-lazy — round 2

## Summary

Implemented and committed as `db595c5f4f5eb6633b4b1055c4af8167baae5c79` (`perf(admin): lazy-load admin panel and mailbox creation`) on `perf/admin-panel-lazy`, based on `ddf5406794441283e881361f1fe78bc84f7012b3`. The worktree is clean; exactly one commit was created. No push, merge, rebase, stash, branch change, or hotfix-branch work.

The main route now needs **31,200 fewer raw JS bytes / 8,998 fewer gzip JS bytes**. AdminPanel, AdminMailboxes, AdminAuditLog, AccountTabContent, and MembersTabContent are all absent from its eager chunks. Admin entry and mailbox creation remain available without a selected mailbox, with the original role gates and props preserved.

## What changed

- `app/components/MailClient.tsx:300`: AdminPanel loads through the existing `next/dynamic` import, with SSR disabled and a styled loading overlay.
- `app/components/MailClient.tsx:304`: CreateMailbox loads through `import("./admin/AdminMailboxes").then(module => module.CreateMailbox)`, with SSR disabled. Its existing conditional mount and every prop are unchanged.
- `app/components/shell/ShellUserMenu.tsx:23`: the second AdminPanel import is also dynamic. No menu logic, props, or conditional mounts changed.
- `app/components/MailClient.tsx:662`: admin-only idle warm-up uses the existing deferUntilIdle helper. It imports AdminPanel and AdminMailboxes only while `isAdminUser` is true, catches speculative import failures, and cancels pending work on unmount or role loss. The existing settings warm-up retains its behavior and now sits alongside it.
- `app/components/LazyDialogLoading.tsx`: one small shared component reuses the settings spinner overlay. For mailbox creation it renders the existing Dialog/DialogContent primitives, the same `sm:max-w-3xl` width and 75dvh body limit, a filled 75dvh loading body, Theme-scoped spinner, visible title, and an aria-busy status labelled “Postfach hinzufügen”. The cold dialog contains its loading state immediately.
- `app/components/mailclient/lazyAdmin.dom.test.tsx`: seven isolated DOM scenarios use real next/dynamic imports and a fresh Bun module cache per scenario, following lazyAccountSettings.dom.test.tsx. Only browser network transports are stubbed with synthetic data.

AdminMailboxes.tsx and AdminPanel.tsx were not edited. All three original conditional mounts remain byte-for-byte unchanged. The preview-only `fix/mailbox-create` branch was ignored.

## Before/after bytes

Exact bytes for `/`, using the supplied ddf5406 baseline and the final replacement production build:

| Asset | Before raw | Before gzip | After raw | After gzip | Raw change | Gzip change |
|---|---:|---:|---:|---:|---:|---:|
| JS | 2,263,657 | 684,470 | 2,232,457 | 675,472 | −31,200 | −8,998 |
| CSS | 909,995 | 120,788 | 910,021 | 120,802 | +26 | +14 |
| JS + CSS | 3,173,652 | 805,258 | 3,142,478 | 796,274 | −31,174 | −8,984 |

The final route has 25 unique eager JS assets and 5 eager CSS assets. The loading body's height utility adds 26 raw CSS bytes. These are observed asset-set deltas, including bundler allocation and compression changes.

Method matches perf-client-bundle.md: deduplicate `.next/diagnostics/route-bundle-stats.json` → root route `firstLoadChunkPaths`; obtain and deduplicate root CSS via `.next/server/app/page_client-reference-manifest.js` → `entryCSSFiles`; sum file lengths and individual `zlib.gzipSync(bytes, {level: 6}).length`. No concatenated-stream compression, polyfills, fonts, HTML/RSC, API responses, or interaction chunks enter these totals. The baseline was supplied, not rebuilt.

Reproduction script: `/tmp/perf-admin/measure.cjs`. Final asset lists, sizes, marker matches and eager-membership flags: `/tmp/perf-admin/measurements-final.json`. Run from `/home/monkey/code/noctua-mail/wt-perf-admin` with `nice -n 10 bun /tmp/perf-admin/measure.cjs`.

## Eager-membership check per module

All matching emitted JS chunks were checked against the final root first-load asset set. Fingerprints exist in deferred chunks; none of the following modules remains eager:

| Module | In eager root chunks? | Retained content fingerprint | Matching deferred chunk count |
|---|---|---|---:|
| AdminPanel | No | `Administration sections`, `Issue targeted invite`, `Close admin` | 2 |
| AdminMailboxes, including CreateMailbox | No | `Refresh mailboxes`, `Creates an ownerless mailbox. Grant members after creation.` | 4 |
| AdminAuditLog (AuditLog) | No | `/api/admin/audit?limit=50`, `Load older entries`, `Refresh audit` | 2 |
| AccountTabContent | No | `Manage IMAP/SMTP credentials for syncing and sending.`, `IMAP (Incoming Server)`, `SMTP (Outgoing Server)` | 6 |
| MembersTabContent | No | `Owners cannot be changed here. Keep at least one enabled manager. You may remove yourself when another manager remains.`, `Add existing enabled user` | 6 |

AdminPanel/AdminAuditLog fingerprints occur in `06fxu01yvft8e.js` and `0l5z~psy4j0-i.js`. AdminMailboxes additionally occurs in `0m-iafbzsm1cl.js` and `0lgcg4dpnbosu.js`; the two tabs additionally occur in `0jseml7tk7sh~.js` and `0dr0f6sh-84z8.js`. All paths are under `.next/static/chunks/`, all are outside the root eager set, and full matches are retained in the measurement JSON.

A generic `IMAP password` label remains eager legitimately through `app/components/mailclient/AccountReloginDialog.tsx:114` and `:116`; it is not a valid fingerprint for AccountTabContent. The module-specific literals above avoid that false attribution.

No remaining eager static-import path outside the allowed files was found. Existing static edges are behind lazy boundaries: `AdminPanel.tsx:12` → AdminAuditLog, `AdminPanel.tsx:13` → AdminMailboxes; `AdminMailboxes.tsx:6` → AccountTabContent and `:7` → MembersTabContent; `AccountSettingsModal.tsx:9` and `:14` → the same tabs. ManageTab imports in `MailClient.tsx:236` and `mailclient/useAccountController.ts:19` are type-only.

## Tests

All long commands used `nice -n 10` in the designated worktree.

- Final `bun run typecheck`: exit 0, no type errors.
- Full `bun run lint`: exit 1, **1 error + 25 warnings**, identical to the supplied baseline. The existing error is `app/components/calendar/useCalendarConflicts.ts:58` (`react-hooks/set-state-in-effect`). No new hook warnings were introduced. Focused ESLint on the final shared fallback and new DOM test also passed with no diagnostics.
- Final focused DOM command: `bun test --config=bunfig.dom.toml app/components/mailclient/lazyAdmin.dom.test.tsx app/components/mailclient/lazyAccountSettings.dom.test.tsx app/components/admin/AdminPanel.dom.test.tsx app/components/shell/Shell.dom.test.tsx`: **36 pass, 0 fail**. Existing AdminPanel and Shell test files needed no changes.
- Final replacement `bun run test:ci`: exit 0, **2,503 unit + 376 DOM pass, 0 failures**. Baseline was 2,503 + 369; the seven new scenarios account for the increase. No identities-route SQLITE_BUSY test failure occurred; no isolated retry was needed.
- Final replacement `bun run build`: exit 0, Next.js 16.2.4 / Turbopack production build, including TypeScript and route generation.
- `git diff --check` and staged diff checks passed. Clean tree verified after the sole commit.

The seven new scenarios cover: non-admin imports and idle callbacks leave all three admin modules unloaded and both gate/menu entries absent; cold AdminPanel open from the mailbox gate; cold CreateMailbox open from the mailbox gate with the populated, correctly sized dialog loading frame; cold AdminPanel open from the user menu with `currentAccount=null`, followed by role-loss removal; admin idle imports without mounting or admin API reads; cancellation on unmount; and cancellation plus hidden gate/menu entries on admin role loss. Every admin scenario checks that imports remain cold before opening or idle execution.

Verification logs: `/tmp/perf-admin-test-ci-final.log`, `/tmp/perf-admin-build-final.log`, `/tmp/perf-admin-dom-final.log`, `/tmp/perf-admin-typecheck-final.log`, `/tmp/perf-admin-lint.log`, and `/tmp/perf-admin-lint-final.log`.

The original full CI had passed and the single production build was already running when the owner added the requirement for a dialog-framed mailbox loading state. That build completed before the addition was implemented. After implementing it and passing focused checks, the user explicitly approved **one replacement CI run and production build**. Thus two full CI runs and two production builds ran in total; the numbers and full-suite results above are from the final replacement. No further build was run.

## New strings

- **“Admin”**: new aria-label usage for the AdminPanel loading status at both import sites; reuses existing application wording.
- **“Postfach hinzufügen”**: new visible title and aria-label for the mailbox loading dialog/status, as requested by the integration owner.
- **“Settings”**: existing settings loading aria-label moved into the shared fallback without changing its wording.

No other user-visible or accessible application strings were added.

## Risks

Cold opening requires a chunk fetch and shows the styled loading state until it resolves. Idle warm-up intentionally downloads admin code for admins after idle; it does not mount the panel/dialog or fetch admin data. Existing settings warm-up can still download shared settings tabs for non-admins, while the three admin modules remain unloaded.

Bundle measurements describe initial asset budgets, not browser latency or total bytes across later interactions. DOM tests verify the dialog primitive, frame sizing classes, themed spinner, transitions and role behavior; no browser timing or pixel-level geometry measurement was performed. The existing lint failure remains outside this task's scope.

No dev/start server was launched, no process was killed, and no real mailbox data was inspected or changed. Tests used synthetic fixtures. No configuration, dependency, protected implementation, API, hook, or other worktree was modified.

## Files touched

Tracked in the single commit:

- `app/components/MailClient.tsx`
- `app/components/shell/ShellUserMenu.tsx`
- `app/components/LazyDialogLoading.tsx` (new, 34 lines)
- `app/components/mailclient/lazyAdmin.dom.test.tsx` (new)

External deliverable: `/home/monkey/code/noctua-mail/briefs/perf-admin-panel-lazy.md` (this brief, replacing round 1). Scratch measurement artifacts and logs are under `/tmp/perf-admin/` and `/tmp/perf-admin-*.log`.
