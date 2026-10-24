Round 2 fixes implemented on `fix/sync-folder-account-mismatch` in `/home/monkey/code/noctua-mail/wt-sync-folder`, starting from clean `20d93cf4bca6df4d7c128ae173710f188882d6b4`. Full review r1 read before implementation. No push.

Final head: `1ee8d6470c6cc00573b8d7bd244751b8f15d113f`.

- `c9f45a4` — Preserve empty-folder repair across folder refreshes. The effect depends on account/folder identity and the derived eligibility boolean, rather than array identity. Record the once-only attempt immediately before launching recompute or sync, allowing checks cancelled before launch to retry. Existing old-account cancellation remains intact. Adapted all four r1 repair probes into the committed suite; added two eligibility-cancellation/retry/once-only cases. The two array-refresh regressions fail before the change and pass after it. Final repair suite: 9/0.
- `1ee8d64` — Carry structured cancellation reason codes (`mailbox_selection_changed`, `folder_account_mismatch`, default `confirmation_declined`) and translate complete notices with de/en catalog entries at the UI boundary. Keep diagnostic exception text and HTTP `folder_account_mismatch` unchanged. Extract the existing MailClient API error reader into `useApiErrorMessage`, preserving existing diagnostics/auth/credential behavior and giving mismatch errors specific translated copy. Six extended r1 notice DOM cases cover both locales for selection change, declined confirmation and the actual HTTP-to-UI reader; catalog parity/ICU tests pass. German uses du and the documented terminology.

Both commits have the requested `Co-Authored-By: Codex gpt-6.1-sol <noreply@openai.com>` trailer and status-bar qualification in their bodies: this branch marks mismatched jobs failed/non-retrying; persistent failed-status display depends on `feat/status-bar-compact`'s `retainSyncFailure`. This branch alone still clears failed progress in `waitForSyncJob`.

Validation evidence is retained in `briefs/sync-folder-regressions-r2/` (probes, command logs, exact merge hunks, fetched SHAs).

| Gate | Result |
| --- | --- |
| `nice -n 15 bun run typecheck` | Exit 0; 1,209 files, zero type errors |
| Affected suites ×3 | Every run: 59 server + 29 DOM, zero failures. Includes the original 42 server / 17 DOM affected suites, all 26 route + 5 library/queue + 7 DOM additions from r1, plus catalog/sentinel suites and the 12 new DOM cases |
| Copied reviewer probes ×3 | Every run: 39 guard + 2 real worker + 6 notice (de/en) + 4 repair, zero failures |
| `nice -n 15 timeout 1800 bun run test:ci` | Exit 0; **2,835 server / 306 files / 356.88s + 481 DOM / 61 files / 68.66s; zero failures** |
| `nice -n 15 timeout 600 bun run lint` | Exit 1, unchanged 1 error / 23 warnings; error `app/components/calendar/useCalendarConflicts.ts:58` (`react-hooks/set-state-in-effect`); zero new findings |
| `nice -n 15 timeout 1200 bun run build` | Exit 0; compile 25.4s, TypeScript 41s, 31 static pages |
| Branch Playwright spec, app 3845 / fixture 3846–3848 | Exit 0; **1 passed, 0 skipped** (6.1s), production app; `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64 ... nice -n 15 timeout 600 bun x playwright test --config=playwright.sync-folder.config.ts` |
| `nice -n 15 git diff --check` | Exit 0 for both `20d93cf..HEAD` and working tree; final worktree clean |

The real worker probe proves one failed/non-retrying mismatch, advancement of the next same-account job to done, and durable lease/queue counts of zero. The independent genuine connection-failure probe still emits retry attempt 1 / maxRetries 10. Probes use only synthetic data, with import paths and assigned fixture configuration adapted for this worktree; no assertions in the guard/worker/repair copies were relaxed.

`git fetch origin` succeeded and a second fetch at 11:23 UTC confirmed all six heads unchanged. Pairwise `git merge-tree --write-tree <ref> HEAD` results against the fetched heads:

| Reference | Fetched SHA | Result |
| --- | --- | --- |
| `origin/integration/stage` | `11dc3c5f50826aec73f7547990e3b89def1dd08b` | Clean, exit 0 |
| `origin/deploy/dev-stage` | `580ee852fc436fa0f2266e8d99b044c321bcfd8b` | Clean, exit 0 |
| `origin/fix/i18n-views` | `4d812228be2e447e1181caa1c808a5ea437e0bba` | Exit 1; MailClient, 2 blocks |
| `origin/feat/status-bar-compact` | `5809d898b7077793be30bfde7262d4977862d2b2` | Exit 1; MailClient, 2 blocks |
| `origin/feat/reader-focus` | `14a1f8ef8ba54cb5eab0cf75de72606746d70a10` | Exit 1; MailClient, 1 block |
| `origin/feat/sender-identities-3` | `26d82d81126639afd82cf5d0d53ff1093b9959c7` | Exit 1; 5 files, 10 blocks |

Per-hunk resolution notes (numbering follows `logs/hunks-<branch>.txt`):

- **i18n-views, MailClient block 1:** union `useLocale, useTranslations`, `getFolderDisplayName` and the new `useApiErrorMessage` import. Keep a single next-intl import.
- **i18n-views, MailClient block 2:** retain its `tv`, `tshell`, `ts`, `tl` and `locale` declarations plus this branch's moved `authState`/`setAuthState` declaration. The latter must precede `useApiErrorMessage`; do not restore its old lower declaration. Keep the extracted error hook and translated mismatch handling.
- **status-bar-compact, MailClient block 1:** same import union as i18n-views block 1.
- **status-bar-compact, MailClient block 2:** same declaration union as i18n-views block 2. Its sync-controller changes merge textually: the merge tree retains `retainSyncFailure`, requested-folder propagation into `waitForSyncJob`, and this round's cancellation translations. Retain these together. Verify failure retention, cancellation and repair on the integrated result.
- **reader-focus, MailClient block 1:** union its `ReaderToolbar`, `useReaderFocus`, `useReaderNavigation`, `readerShortcut` imports with this branch's `useStartupSync`, `useEmptyFolderRepair`, `isAccountFolder`, `findInboxFolder`. Keep reader navigation/focus wiring and both guarded sync hooks.
- **sender-identities-3, MailClient block 1:** union `useSenderMessages` with the four guarded sync/folder imports above.
- **sender-identities-3, MailClient block 2:** retain its `noctua:sender-settings-changed` refresh effect and dependencies, followed by this branch's extracted `useStartupSync(...)`; remove the older inline startup effect. Keep the extracted error reader and repair hook from the textual merge.
- **sender-identities-3, PreferencesTabContent block 1:** retain `ReactNode` alongside `useEffect/useState`, and retain `useLocale/useTranslations`.
- **sender-identities-3, PreferencesTabContent block 2:** keep the `!senderPreferences` condition and use the localized `t("preferences.signature")` label for the signature select, preserving sender preferences content.
- **sender-identities-3, resyncMessage.senderKey.test block 1:** keep one subprocess-isolation scheme: this branch's `runIsolated` and `NOCTUA_RESYNC_TEST_CHILD`, along with the existing real-IMAP test/assertions. Drop the alternative `realResyncTest` wrapper and redundant imports.
- **sender-identities-3, resyncMessage.senderKey.test block 2:** retain the normal `test(...)` with its `runIsolated` child guard and the collision-variant assertions. Do not nest or duplicate subprocess wrappers.
- **sender-identities-3, de.json block 1 and en.json block 1:** merge Settings objects by key, preserving sender identities/preferences keys and localized Admin members/preferences/roles keys. Keep one balanced object structure.
- **sender-identities-3, de.json block 2 and en.json block 2:** union Compose sender/signature keys with the full existing Shell/Search/Views/Notifications catalogs, including this round's four new Notifications keys (`fullSyncCancelled`, `syncCancelledSelectionChanged`, `folderAccountMismatch`, `syncCancelledBeforeStart`). Preserve matching locale leaf sets and re-run catalog parity/ICU tests.

Browser evidence: `sync-folder-regressions-r2/browser-evidence.json` records B's first request as full mailbox sync without an old folder ID; every captured folder-specific sync belongs to its request account. Sync, new-candidates and poll reject A's folder against B with 400 and stable `folder_account_mismatch`. The new tests supplement this with both locales at the UI error-reader boundary.

Harness notes: the first browser invocation forced the CLI through Bun and failed before test execution with `Cannot find module ...playwright.sync-folder.config.ts.esm.preflight`. Running the repository's normal `bun x playwright` CLI (Node shebang) passed the unmodified spec; both logs are retained. The initial pre-commit typecheck and external-probe alias fixes are documented in the evidence README. The full CI command ran once to completion. Its 14 synthetic SMTP capture files under an untracked `undefined/` path (fixtures interpolate unset `TMPDIR`) were preserved in ignored `.tmp/r2-ci-generated-undefined`; no fixture code was changed.

These are pairwise textual merge checks only. No merges or conflict resolutions were applied to the branch, and an integrated build remains a separate gate. `deploy/dev-stage` currently merges cleanly; if interim deploy 8.7 brings in sender-identities-3, apply the MailClient and catalog union rules above against the actual resulting tree rather than taking either side wholesale.

Load averages (1/5/15 min): start **10.21 / 14.05 / 13.65** at 11:06:25 UTC; end **13.33 / 10.43 / 11.16** at 11:23:58 UTC. All gates used `nice -n 15`. Only the assigned worktree was edited; report/probe artifacts were written to the explicitly requested ROOT/briefs paths. No push, deployment, destructive git, other-worktree edits, or pattern-based process termination. Owned app PID 2813554 and fixture PID 2780173 were verified against their worktree/command and stopped with SIGTERM. All four assigned ports are no longer listening. No other PIDs were signalled.
