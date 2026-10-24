# Sync-folder fix round 2 — verification review

**Verdict: PIN.** Round 9 can use `1ee8d64` (`fix/sync-folder-account-mismatch`, fix round 2 `20d93cf..1ee8d64`: `c9f45a4`, `1ee8d64`). Both round-1 P2s are closed. The review found no new findings at any severity (P1/P2/P3).

Evidence is in `briefs/sync-folder-regressions-r2/review/`: `probes/`, `probes-baseline-20d93cf/`, `logs/`, the `source/` archive of 1ee8d64 (`git archive`, `node_modules` symlinked to the worktree), and the status and load snapshots. All data is synthetic: first-example-test / second-example-test.

## Environment note (not a code finding)

`wt-review-auth/node_modules` was stale. It had **nodemailer 8.0.11** installed while `bun.lock` pins **10.2.1**, plus 15 other outdated packages. With these, `bun run typecheck` failed with TS7016 on `nodemailer/lib/addressparser/index.js`, in `lib/db/messages/utility.ts:16` and `lib/mail/imap/parser.ts:14`.

- I stopped my own first test:ci run (PID 2870909, signalled by PID only). Its log is kept as `logs/test-ci-aborted-stale-deps.log`.
- I ran `bun install --frozen-lockfile`, which installed 16 packages. This changed only the ignored `node_modules`.
- I then reran every gate.

**Integrator:** run `bun install --frozen-lockfile` before the round-9 gates.

## Checks

### 1. Repair P2 (r1 a) — closed

The once-only marker is now added after the `cancelled` check, immediately before `recompute`/`syncFolder` (`useEmptyFolderRepair.ts:44`). Effect deps are `accountId`, `folderId`, the `eligible` boolean, `apiFetch` (memoized on `clientId`) and the refs, so the array identity is no longer a dependency.

- The four r1 repair probes run unchanged: **4/4 pass** (r1 result was 2 pass / 2 fail).
- New edge probes in `probes/edge-repair.dom.test.tsx`: **10/10 pass, ×3**. The same probe against 20d93cf fails **6/10**, so the probes do detect the r1 bug.

| Edge case | Result at 1ee8d64 |
| --- | --- |
| (i) 5 folder-array refreshes during A's in-flight GET, total 0 and 2 | 1 GET; exactly one `sync:A` or `recompute:A`; no rerun after 5 more refreshes |
| (ii) switch A→B during A's GET, then back to A | A's continuation cancelled; no `A:INBOX` mark left; switching back starts a new GET and repairs A exactly once. Holds with and without the account-switch set reset (`useSyncController.ts:234`), and whether the old GET resolves before or after the switch back |
| (ii-b) switch to an eligible B during A's GET | Only `recompute:B`, using B's callbacks |
| (iii) once-only mark | Survives re-renders, `enabled` false→true, folder-array refreshes, an unrelated prop change, and navigating Archive → INBOX. The second repair is only Archive's own |
| (iii-b/c) eligibility flips during the GET (`enabled`, or folder briefly missing from the array) | Retries, launches exactly once |

Account switch still resets the marker set by design (`useSyncController.ts:234`). This is pre-existing and not a stale-mark risk.

### 2. Notices P2 (r1 b) — closed

- **No English literals left in the visible cancellation path.** The title and description come from `tn(...)` in `useSyncController.ts:445-450`. The English reason strings at `:379/:386/:401` stay as `Error.message` diagnostics only and are never shown.
- **HTTP mismatch translated.** `useApiErrorMessage.ts:53` maps HTTP `code === "folder_account_mismatch"` to `tn("folderAccountMismatch")`.
- **Catalogs.** de and en each gain 4 keys under `Notifications`: `fullSyncCancelled`, `syncCancelledSelectionChanged`, `folderAccountMismatch`, `syncCancelledBeforeStart`.
- **Tests.** The catalog parity/ICU tests (`lib/i18n/catalogs.test.ts`, `format.test.ts`) pass in the focused runs. The r1 notice probe, adapted to both locales, passes 2/2: the description matches the catalog text exactly, and the output contains no `Reason:` and no English diagnostic.
- **Server side byte-identical to 20d93cf.** `git diff --stat 20d93cf..1ee8d64 -- app/api lib scripts workers build-scripts` is empty. The 400 `{ ok: false, code: "folder_account_mismatch" }` envelope (`app/api/_helpers/folderAccount.ts:6`) and the worker fast-fail diagnostics (`lib/folderAccount.ts`) are therefore unchanged.

### 3. Text-as-logic — OK

- The UI compares `reasonCode` (`useSyncController.ts:446/448`) and HTTP `data.code` (`useApiErrorMessage.ts:53`) as codes, never as text.
- `isFullSyncDebugCancelledError` checks `name` only.
- Unknown or missing codes fall back to `syncCancelledBeforeStart`.
- A grep found no comparisons against translated or diagnostic text in non-test code.

### 4. Gates

| Gate | Result |
| --- | --- |
| `bun run typecheck` | Exit 0; no type errors in 1,207 files (after the frozen-lockfile reinstall) |
| Focused server ×3: `lib/folderAccountGuard`, `app/api/_helpers/folderAccount`, `lib/i18n/catalogs`, `lib/i18n/format` | 40/0 on every run |
| Focused DOM ×3: `useEmptyFolderRepair`, `useSyncController`, `useSyncController.notice`, `useAccountController`, `AccountReloginDialog` | 32/0 on every run |
| Review probes ×3 (r1 repair, edge repair, r1 notice de/en) | 16/0 on every run |
| ESLint on the 4 touched hook/type files | Exit 0 |
| `nice -n 15 timeout 1800 bun run test:ci` | Exit 0: **2,835/0 server (306 files, 493.59 s) + 481/0 DOM (61 files, 71.47 s)**. The known flakes (lazyAdmin:201, slice-3 corruption fixtures) did not occur |

### 5. Merge readiness — `git merge-tree --write-tree 1ee8d64 <ref>`

| Ref | SHA | Result | Compared with 20d93cf |
| --- | --- | --- | --- |
| integration/stage | 11dc3c5 | Clean | Same |
| feat/sender-identities-3 | 26d82d8 | Exit 1: MailClient (2), PreferencesTabContent (2), resyncMessage.senderKey.test (2), de.json (2), en.json (2) | Same files and counts |
| feat/sender-identities-2 | 327f6d9 | Exit 1: `lib/db/messages/upsert.ts` (3) | Same; the conflict is pre-existing against stage |
| chore/deps-next-16-4 | 4547815 | Clean | — |
| admin-self-grant | b6c1ba9 | Clean | — |
| fix/i18n-views | 4d81222 | Exit 1: MailClient (2) | **New in r2**; was clean at 20d93cf |
| feat/status-bar-compact | 5809d89 | Exit 1: MailClient (2) | **New in r2**; was clean |
| feat/reader-focus | 14a1f8e, and the current origin head **ccddc4d** | Exit 1: MailClient (1) | Same; the origin head moved from 14a1f8e to ccddc4d |

In every textually merged tree, `useSyncController` has a single `useTranslations` import and a single `tn`, and keeps the reasonCode mapping. The status-bar tree also keeps `retainSyncFailure`. MailClient has exactly one `authState` declaration and one `readErrorMessage = useApiErrorMessage(...)`. Each catalog key appears once.

**Per-hunk notes for the integrator** (round 9 order: sender-3, sender-2, next-16-4, admin-self-grant, sync-folder, i18n-views):

- **sender-3, MailClient block 1 (imports, line 3):** union `useSenderMessages` with `useStartupSync`, `useEmptyFolderRepair`, `isAccountFolder`, `findInboxFolder`.
- **sender-3, MailClient block 2 (around line 4286):** keep sender-3's `noctua:sender-settings-changed` refresh effect, followed by `useStartupSync({...})`. Drop sender-3's old inline "Initial sync on login" effect.
- **sender-3, PreferencesTabContent blocks 1–2:** keep `ReactNode` plus `useLocale`/`useTranslations`. Keep the `!senderPreferences` guard with the localized `t("preferences.signature")`.
- **sender-3, resyncMessage.senderKey.test blocks 1–2:** use one isolation scheme (`runIsolated` with `NOCTUA_RESYNC_TEST_CHILD`) and keep both assertion sets. Do not nest or duplicate the wrappers.
- **sender-3, de/en block 1:** merge the Settings objects by key.
- **sender-3, de/en block 2:** the ours side (~lines 130–1040) carries all the Shell/Search/Views/**Notifications** catalogs, including r2's 4 new keys at lines 976–979. Do **not** take the theirs side wholesale. Add sender-3's Compose sender/signature keys into it, then rerun `lib/i18n/catalogs.test.ts`.
- **sender-2, upsert blocks 1–3:** as in r1. Keep round-8 `prepareFtsIdentityWriter` with `ftsWriter.remove`/`insert`, and keep the sender-identity columns and binds.
- **i18n-views, MailClient block 1 (around line 383):** use a single `import { useLocale, useTranslations } from "next-intl"`, plus `getFolderDisplayName` and `useApiErrorMessage`.
- **i18n-views, MailClient block 2 (around line 395):** keep `tv`, `tshell`, `ts`, `tl`, `locale` **and** r2's moved `const [authState, setAuthState] = useState<...>("loading")`. The `authState` line must stay above `useApiErrorMessage(...)`. Do not restore the old lower declaration near `currentUser`.
- **status-bar-compact, if merged later:** same two resolutions as i18n-views.
- **reader-focus (ccddc4d), block 1 (imports, line 2):** union `ReaderToolbar`, `useReaderFocusPlacement`, `useReaderFocus`, `useReaderNavigation`, `readerShortcut` with the four sync/folder imports.
- **After integrating:** rerun `probes/edge-repair.dom.test.tsx` and the notice tests on the integrated tree. Pairwise checks do not cover the stack.

## Observations (non-blocking, no fix required)

- The declined-confirmation notice is now generic (`syncCancelledBeforeStart`) instead of showing the debug reason. The reason is still logged in `console.warn`.
- The mismatch HTTP message no longer includes the request path. The stable code stays in the response body.
- A persistently failing repair GET (non-ok or invalid JSON) no longer marks the folder. It retries only when eligibility or selection changes, so it cannot loop on its own.

## Cleanup

- Tracked files unchanged: `git status --porcelain` is empty before and after; HEAD is 1ee8d64, detached.
- Worktree `.tmp` removed (381 MB of test temp data). No `undefined/` directory was created, because TMPDIR was set.
- No servers started; ports 3886–3889 are not listening.
- Only my own PID was signalled.
- Load (1/5/15): start 7.30 / 7.49 / 8.76 (11:44 UTC); end 10.15 / 9.66 / 9.66 (11:57 UTC).
