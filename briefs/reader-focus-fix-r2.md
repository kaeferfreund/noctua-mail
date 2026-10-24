**R2 fixed locally — integration round 10 handoff.**

Branch: `feat/reader-focus`; worktree: `/home/monkey/code/noctua-mail/wt-reader-focus`.
Original clean head: `14a1f8ef8ba54cb5eab0cf75de72606746d70a10`.
New head: **`ccddc4dafc3007f6235db6f27f98b585139fbf4b`**. All product changes are committed in separate finding/follow-up commits with the requested co-author trailer. Working tree clean. **No push performed.**

R1 was read in full before implementation. The R1 evidence remains unchanged. New evidence is under `ROOT/briefs/reader-focus-evidence/r2/`.

**Per-finding fixes and evidence**

1. **Floating notices / Undo.** `MailClient` measures the visible `#reader` in focus and the list pane in split, with a bounded inset. Resize observation follows layout transitions and sidebar resizing. In the final collapsed-sidebar delete probe, Undo is fully inside the 1280×900 viewport (`x=1173`, `y=807.5`, `46×23`); the notice stack is `x=786`, width `470`. Clicking Undo restores the message. Evidence: [notice measurements](reader-focus-evidence/r2/reader-focus-delete-notice.json), [screenshot](reader-focus-evidence/r2/delete-visible-undo.png).

2. **Print privacy and scope.** Explicit print zones cover subject, mail metadata and message content. Other reader subtrees are removed from print layout: composers, notes, activity, collaboration and action chrome. Embedded display/translation/remote-content controls are excluded too. The real production probe types `UNSENT SYNTHETIC PRIVATE DRAFT example.test`, asserts the live draft value, generates a print screenshot and `page.pdf()`, and verifies that the draft and controls are hidden. Independent PDF extraction confirms one page with subject, sender, recipients, date and mail body; the private marker and collaboration text are absent. Evidence: [PDF](reader-focus-evidence/r2/reply-print-private-excluded.pdf), [print screenshot](reader-focus-evidence/r2/reply-print-private-excluded.png), [PDF extraction and SHA-256 proof](reader-focus-evidence/r2/pdf-proof.json), [typed-draft observation](reader-focus-evidence/r2/reader-focus-print.json).

3. **Keyboard focus on every entry / exit.** `useReaderFocusPlacement` follows the actual focus-layout transition, including a single-click entry using the saved preference. Back receives focus with `preventScroll`. Exit restores the saved list scroll and focuses the selected row, or the list container (`tabIndex=-1`) if virtualization removed that row. The final browser observation is `BUTTON`, accessible name `Back to messages`; the DOM regression covers both row restoration and the virtualized-row fallback. Evidence: [saved-preference observation](reader-focus-evidence/r2/reader-focus-saved-entry.json), [DOM run](reader-focus-evidence/r2/dom-final-snapshot-1.log), [production suite](reader-focus-evidence/r2/playwright-final.log).

4. **Successful archive / delete continuation.** Row and reader actions use one successful-removal continuation and the same order helper. Each operation preserves its renderer navigation order, then checks the current committed reader selection when the HTTP operation completes. It selects next, else previous, else ends at the list. This handles selection finishing during the request and a move already removing the target row. An unrelated reader selection is preserved. The delete fallback also reuses the helper. DOM cases cover next/previous/end, failures, selection changes and a removed target row. The production archive probe leaves the intended next row active in focus at `2 / 265`: another representative of the partially archived thread occupies row 1. Evidence: [archive state](reader-focus-evidence/r2/reader-focus-archive-state.json), [screenshot](reader-focus-evidence/r2/archive-next-focus.png), [removal snapshot regressions](reader-focus-evidence/r2/removal-snapshot.log), [final DOM repetitions](reader-focus-evidence/r2/dom-final-snapshot-3.log).

5. **Baseline archive HTTP contract.** The shared message-command helper sends `Content-Type: application/json` and `{}` for bodyless archive/spam/not-spam/unsubscribe commands. Their existing `requireMutationSameOrigin` guards accept this contract. There is no toolbar-specific fetch. Real browser requests from the row menu and focus toolbar each return HTTP 200; HTTP GET verifies the message moved from INBOX to Archive. Evidence: [row HTTP result](reader-focus-evidence/r2/reader-focus-archive-row.json), [toolbar HTTP result](reader-focus-evidence/r2/reader-focus-archive-toolbar.json), [production suite](reader-focus-evidence/r2/playwright-final.log).

6. **Shortcut clutter.** The permanent 10 px shortcut row and its CSS are removed. Applicable shortcuts appear in the controls' tooltips and `aria-keyshortcuts`; j/k are advertised only on focus navigation controls. Evidence: [toolbar implementation](../wt-reader-focus/app/components/mailclient/message/ReaderToolbar.tsx), [DOM run](reader-focus-evidence/r2/dom-final-snapshot-1.log).

7. **Toolbar accessibility / localization.** The group has a localized `Reader.focus.toolbarLabel` in de/en. The counter retains `aria-live="polite"` and references its descriptive, visually hidden position text through `aria-describedby`. German copy follows `doc/I18N.md`. Evidence: [catalog gate](reader-focus-evidence/r2/catalogs.log), [accessible-name/position DOM assertions](reader-focus-evidence/r2/dom-final-snapshot-1.log).

8. **Evidence outside the product tree.** All five tracked PNGs were removed with `git rm` and copied byte-for-byte to `ROOT/briefs/reader-focus-evidence/` (641,507 bytes total). SHA-256 verification confirms every original is preserved. The browser default and `doc/SHELL.md` now reference `../briefs/reader-focus-evidence`; new R2 captures go into its `r2/` directory. Evidence: [preservation manifest](reader-focus-evidence/r2/moved-evidence.json).

**Preserved behavior and scope**

The sidebar remains available, the list stays mounted and hidden in focus, Back remains first, explicit Back/Escape/Show message list records split, sidebar navigation only temporarily returns to split, and the one-time double-click tip remains. Counters continue to use unique rendered rows. The 390 px single-pane reader/back-history browser case passes. The lazy-admin synchronization fix is byte-for-byte unchanged from `14a1f8e`; its newer upstream conflict is documented below. No dependency, lockfile, environment file, other worktree or application credential was changed. All new commits carry the requested co-author trailer. See [source proof](reader-focus-evidence/r2/source-proof.json).

**Development and process notes**

Exploratory browser runs exposed and then verified the asynchronous selection/removal cases above. Test setup was corrected to use immediate single-message deletion (no confirmation dialog), a known synthetic print subject, and the actual successor position when a thread representative remains. Existing assertions, timeouts and retry budgets were not weakened. Earlier probe outputs remain in the evidence directory; only the final gate files listed below are the release results.

The QA runner uses production port 3870 and fixture ports 3872/3873, isolated synthetic storage, and `nice -n 15`. Its temporary adaptation is recorded in [runner port overrides](reader-focus-evidence/r2/qa-runner-port-overrides.patch). One early Playwright CLI was interrupted after its invalid dialog precondition; the exact process ancestry was verified and recorded before SIGINT. Only recorded, owned processes were stopped, never by pattern. The final QA runner/server are stopped and ports 3870–3873 are free. Evidence: [stopped CLI ownership chain](reader-focus-evidence/r2/stopped-owned-playwright.json), [final process cleanup](reader-focus-evidence/r2/process-cleanup.json).

**Final gates**

All gate processes used `nice -n 15`; test budgets, retry settings and existing assertions remain unchanged.

- `bun run typecheck`: exit 0, zero errors in 1,207 files. [Log](reader-focus-evidence/r2/typecheck-final-snapshot.log).
- Five relevant DOM suites, three repetitions: **40 passed / 0 failed / 160 assertions per run**; **120 passed / 480 assertions total**. Includes reader focus/navigation, list orchestrator, message mutations and delete actions. [Run 1](reader-focus-evidence/r2/dom-final-snapshot-1.log), [run 2](reader-focus-evidence/r2/dom-final-snapshot-2.log), [run 3](reader-focus-evidence/r2/dom-final-snapshot-3.log).
- `timeout 1800 bun run test:ci`: **exit 0**. Server: **2805 passed, 0 failed**, 305 files, 15,332 assertions, 339.62s. DOM: **486 passed, 0 failed**, 60 files, 2,768 assertions, 63.27s. [Complete log](reader-focus-evidence/r2/test-ci-release.log).
- `timeout 600 bun run lint`: expected exit 1, **1 existing error / 24 warnings / 0 new findings**. The error remains `app/components/calendar/useCalendarConflicts.ts:58`. One prior warning was resolved by the corrected shared-mutation dependency list. [Log](reader-focus-evidence/r2/lint-final-snapshot.log).
- `timeout 1200 bun run build`: exit 0; optimized compilation, production type checking, route generation and standalone preparation completed. Final production suite uses this build. [Log](reader-focus-evidence/r2/build-final-snapshot.log).
- Production `qa-reader-focus` Playwright suite on 3870: **exit 0, 6 passed (1.8m)**, 0 failed. Both archive HTTP surfaces and all requested new browser regressions are included. [Log](reader-focus-evidence/r2/playwright-final.log).
- `lib/i18n/catalogs.test.ts`: **7 passed, 0 failed, 3,542 assertions**, including de/en key parity and valid ICU. [Log](reader-focus-evidence/r2/catalogs.log).
- `git diff --check`: exit 0. [Log](reader-focus-evidence/r2/diff-check.log). Final source/commit/process verification also passes. [Machine-readable gate summary](reader-focus-evidence/r2/verification.json).

One preceding final-snapshot CI attempt had **2,804 server passes / 1 failure**: the unchanged sender-identity fixture hit `SQLITE_BUSY` at `lib/testFixtures/verifySenderIdentity.ts:339` while deleting its synthetic membership. No source, assertion, timeout or retry setting was changed for this. The exact test passed unchanged in a targeted control run, and the subsequent complete command above passed all server and DOM tests. [Failed attempt](reader-focus-evidence/r2/test-ci-final-snapshot.log), [targeted control](reader-focus-evidence/r2/sender-fixture-lock-rerun.log).

**Pairwise merge-tree rehearsal**

Final fetch completed at `2026-10-23T11:40:23.304529+00:00`. Each comparison runs `git merge-tree --write-tree <ref> HEAD` without modifying the index or working tree. These are pairwise results, not a resolved multi-branch stack build.

- **origin/integration/stage** (`11dc3c5f50826aec73f7547990e3b89def1dd08b`): exit 0; tree `628f42515fdf09cdca0d802d9489b5610e4d2595`. Conflict files: none. [Raw output](reader-focus-evidence/r2/merges/integration-stage.merge.txt).
- **origin/feat/status-bar-compact** (`5809d898b7077793be30bfde7262d4977862d2b2`): exit 1; tree `d11714ee7f86adadc9b0b1fa7506b793f25d1974`. Conflict files: `app/components/shell/AppShell.tsx`, `doc/SHELL.md`. [Raw output](reader-focus-evidence/r2/merges/feat-status-bar-compact.merge.txt).
- **origin/fix/i18n-views** (`4d812228be2e447e1181caa1c808a5ea437e0bba`): exit 1; tree `b02665ff87924fb9335b56d30d8545cbe526aee0`. Conflict files: `app/components/mailclient/lazyAdmin.dom.test.tsx`. [Raw output](reader-focus-evidence/r2/merges/fix-i18n-views.merge.txt).
- **origin/feat/sender-identities-3 @ 26d82d8** (`26d82d81126639afd82cf5d0d53ff1093b9959c7`): exit 1; tree `5d8329a09da55289e3508601bffe277136eb5a08`. Conflict files: `app/components/MailClient.tsx`, `app/components/account-settings/tabs/PreferencesTabContent.tsx`, `lib/mail/resyncMessage.senderKey.test.ts`, `messages/de.json`, `messages/en.json`. [Raw output](reader-focus-evidence/r2/merges/26d82d8.merge.txt).
- **origin/fix/admin-mailbox-self-grant @ b6c1ba9** (`b6c1ba94019dad49410dba7df623ece2f10a26a8`): exit 1; tree `95d4915429c17686b4ed4473866a68cc070363c9`. Conflict files: `playwright.qa-round2.config.ts`. [Raw output](reader-focus-evidence/r2/merges/b6c1ba9.merge.txt).
- **origin/fix/sync-folder-account-mismatch @ 20d93cf** (`20d93cf4bca6df4d7c128ae173710f188882d6b4`): exit 1; tree `65c942cb72a2ede9b8718f8b827ba2c51846e5ff`. Conflict files: `app/components/MailClient.tsx`. [Raw output](reader-focus-evidence/r2/merges/20d93cf.merge.txt).

Full conflict files/hunks are saved under [reader-focus-evidence/r2/merges/](reader-focus-evidence/r2/merges/). The following are per-hunk resolution instructions, not applied merges:

Pairwise merge resolution notes (R2; no source/index merge performed)

origin/feat/status-bar-compact 5809d898:
- AppShell.tsx, ShellHeader toolbar/indicators hunk: retain reader-focus's combined
  (mobile thread OR desktop focus) condition that hides header.toolbar. Choose
  indicators={statusBar} from compact status for both desktop and mobile. Keep
  compact's styles.workspace and footer removal, plus reader's onReaderNavigate.
- doc/SHELL.md, entire add/add document: combine status indicator/density and
  reader-layout sections. Preserve compact R2 integration decisions and evidence
  links and reader R2 behavior. Correct compact's obsolete list-only notice claim:
  split measures the list; focus measures #reader. Keep scoped mail-only printing,
  explicit JSON commands, accessible position, focus fallback and archive/delete
  continuation, and external briefs evidence paths.
- Automatic merges need semantic checking: ShellPanes keeps compact spacing and
  separator hit targets alongside focus's hidden mounted list/resize persistence.
  MessageViewPane keeps spacing variables alongside the R2 print allowlist.
  Recheck collapsed-sidebar Undo, status popover, 1024/1280px and 390px after the
  actual stack is integrated; pairwise trees do not establish stack correctness.

origin/feat/sender-identities-3 pinned 26d82d8:
- MailClient.tsx, initial import hunk: keep useSenderMessages and ALL five reader
  imports, including the new useReaderFocusPlacement. Retain sender refresh logic.
- PreferencesTabContent.tsx, import hunk: keep next-intl useLocale/useTranslations
  plus useEffect/useState/type ReactNode from React.
- PreferencesTabContent.tsx, signature label hunk: combine !senderPreferences with
  t("preferences.signature") and preserve the matching conditional closing brace.
- resyncMessage.senderKey.test.ts, helper/first declaration hunk: retain the HEAD
  runIsolated/NOCTUA_RESYNC_TEST_CHILD scheme as one complete implementation.
  Preserve both real IMAP cases and all assertions. Keep the existing 20000ms Bun
  budget and 25000ms process watchdog unchanged; do not combine environment flags.
- Same test, second declaration hunk: retain test(...) plus HEAD's child guard.
- de.json and en.json, Settings hunk (one each): merge sender/edit additions into
  the full localized Settings object, retaining members/preferences/roles.
- de.json and en.json, Compose/Errors hunk (one each): merge Compose.sender,
  Errors.sender and related Compose keys into the complete namespaces. Keep all
  Reader.focus keys, including toolbarLabel, and every other namespace. Parse
  both JSON files and run catalog parity after actual resolution.

origin/fix/admin-mailbox-self-grant pinned b6c1ba9:
- playwright.qa-round2.config.ts, testMatch hunk: keep BOTH qa-admin-self-grant and
  qa-reader-focus alternatives, alongside qa-shell, qa-compose, qa-unread-count,
  qa-translation and qa-admin-breakpoint. Other changes auto-merge.

origin/fix/sync-folder-account-mismatch pinned 20d93cf:
- MailClient.tsx, initial import hunk: retain useStartupSync, useEmptyFolderRepair,
  isAccountFolder and findInboxFolder alongside all five reader imports. Keep
  sync's account-scoped folder/startup/empty-folder logic and reader's selection,
  focus placement, navigation rows and notice observation. All other hunks merge.

origin/integration/stage 11dc3c5:
- Pairwise clean.

origin/fix/i18n-views latest 4d812228 (supersedes the initial 992b220 probe):
- lazyAdmin.dom.test.tsx, role-change Retry/cancellation hunk: retain reader's
  async act around Retry and the combined waitFor assertions for absent Admin
  and idleTasks.size === 1. The i18n R2 change now also awaits idle cancellation;
  reader's stronger effect-flushing synchronization includes that intent.
  Preserve the exact assertions and all existing timeout/retry budgets.
- The translated English Add mailbox loading-dialog assertions auto-merge, as
  do the latest i18n browser cases, catalogs and doc/I18N.md integration notes.
  Keep these newer changes. The reader branch itself retains its lazy-admin
  synchronization file byte-for-byte from 14a1f8e.


**Load and final state**

Load averages (1 / 5 / 15 minutes): start **8.44 / 12.46 / 13.44** at `2026-10-23 10:49:31 UTC`; end **8.26 / 8.09 / 9.18** at `2026-10-23T11:41:34.486958+00:00`.

Final head remains `ccddc4dafc3007f6235db6f27f98b585139fbf4b`. Source worktree clean; test-generated synthetic EML output was preserved in ignored `.tmp/reader-focus-r2-generated-ci-output`. All recorded QA processes are stopped. No push, deployment, PR, credential change or other-worktree modification was performed.
