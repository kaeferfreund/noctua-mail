**PIN+fix — retain for integration round 10, but do not merge 14a1f8e unchanged.** Fix the three new P2 regressions and the archive continuation gap below. The main interaction meets the requested MailPlus direction. No P1 found.

Reviewed e9d2428 and 14a1f8e against round 8, 11dc3c5. The supplied detached checkout remained unchanged. Gates and synthetic fixtures ran in a source snapshot under `briefs/reader-focus-regressions-r1/`; `.env.local` was not read or copied.

**UX assessment**

The folder sidebar stays, the middle list disappears, and the reader uses the available width. The back arrow is the first toolbar control. Archive/spam/delete/move/topics/done/menu and window/print/navigation controls follow the reference closely. Subject, sender, mailbox badge, date and reply actions remain available through the existing reader. The collaboration bar remains usable, and an inline reply appears below its message in the reader's scroll area.

All eight de/en × 1280/1024 px × light/dark layout combinations fit without horizontal overflow. The 13 `Reader.focus` keys have identical German/English structure; German terminology and informal style follow `doc/I18N.md`.

The visible “Vergrößern” / “Expand reading view” control and one-time double-click tip make entry discoverable. Back, Escape and “Liste anzeigen” / “Show message list” save split mode, so reversing the preference requires no settings visit. Sidebar navigation temporarily returns to split while retaining the focus preference. The tip stays dismissed across reloads. Explicit expansion/back and a settled saved-preference round trip preserve list scroll and selection.

Five-row paging traversed pages 1–17, from `1 / 5+` to `85 / 85`, with Next disabled at the real end. Counters describe unique rendered rows, respecting collapsed threads/groups, rather than the folder's raw message count. The committed suite checks Previous disabled at the beginning. Split j/k/n/p remain inert as on the baseline; r/u/t still issue the expected seen/unseen/todo mutations, and Delete advances. Escape closes a message menu or move dialog before leaving focus.

**P2 findings — required before merge**

1. **Floating success notices and Undo disappear outside the viewport.** `app/components/MailClient.tsx:4954` and `:5998`, triggered by `app/components/shell/ShellPanes.module.css:22`. Repro: open focus, collapse the folder sidebar, delete a synthetic message. The next message opens, but the notice has `right:1280px`, bounding box `x=-470, right=0` in a 1280 px viewport. Its Undo button is inaccessible. Hiding the list makes its measured right edge zero. Fix: measure the visible reader/workspace in focus, or use a bounded reader-side inset; retain the list anchor in split and update it on layout transitions. Evidence: `reader-focus-regressions-r1/actions-observations.json`, `delete-missing-undo.png`.

2. **“Print message” prints the unsent reply and internal reader UI.** `app/components/mailclient/message/MessageViewPane.module.css:85`, with the print root at `MessageViewPane.tsx:27`. Repro: open a message, Reply, type `UNSENT SYNTHETIC PRIVATE DRAFT example.test`, then print. The textarea, Send/Cancel, collaboration controls, message action controls and activity area remain printable. Both the print screenshot and generated PDF contain the draft. Fix: scope printing to message content and its mail header; explicitly exclude composers, internal notes/activity, collaboration controls and message action chrome. Do not make every descendant of the reader visible. Evidence: `reader-focus-regressions-r1/reply-print.png`, `reply-print.pdf`, and `browser-observations.json` → `print-scope`.

3. **Saved-preference entry loses keyboard focus.** `lib/ui/useReaderFocus.ts:17`, `app/components/MailClient.tsx:2748` and `:2888`. Repro: save focus, click Inbox to return temporarily to split, then single-click a visible message. After settling, layout is focus and the counter is valid, but `document.activeElement` is BODY. This path bypasses `openReaderFocus`, which focuses the back button for explicit entry. Fix: centralize focus placement for every split→focus transition. On exit, provide a focusable list-container fallback when the selected row is outside the virtualized DOM (`MailClient.tsx:2901`). Preserve scroll. Evidence: `reader-focus-regressions-r1/stable-focus-observations.json`; scroll was 310 before entry and after exit.

4. **Successful archive terminates the focus reading sequence.** Toolbar wiring: `app/components/MailClient.tsx:5852`; shared transition: `app/components/mailclient/useMessageMutations.ts:215`. Repro: archive an Inbox message in focus after correcting only the baseline request header in a browser probe. HTTP 200 is followed by split layout, no selected message and “Select a message to view the thread.” Delete correctly selects the next row. This reuses existing list behavior, but fails the requested archive→next focus workflow. Fix: add a shared successful-removal continuation using the renderer's navigation order, with previous/end fallback; keep the mutation handler shared with list actions. Evidence: `reader-focus-regressions-r1/actions-observations.json` → `archive-response`, `archive-success`.

**Existing baseline issue exposed by the new toolbar**

- **P2: archive currently returns `400 {"code":"json_required"}` before any move.** `app/components/mailclient/useMessageMutations.ts:255` sends the POST without a JSON content type; the real Next route rejects it. The same code exists at 11dc3c5, so this is not introduced by reader-focus. Adding the header at the browser boundary yielded HTTP 200 and exposed finding 4. Repair the shared request/bodyless-command contract and add a real HTTP regression check; do not add a toolbar-specific fetch. The unchanged baseline row action has the same defect.

**P3 recommendations**

- `app/components/mailclient/message/ReaderToolbar.tsx:50`: move the permanent 10 px shortcut row into tooltips/help, or show only applicable shortcuts. It adds persistent visual noise and advertises j/k in split where they do nothing. This is cosmetic, not a merge blocker.
- `ReaderToolbar.tsx:21` and `:37`: add a localized accessible group name. The buttons already have good accessible names and the counter has `aria-live="polite"`; expose its descriptive position text accessibly rather than only through `title`.
- `artifacts/reader-focus/reader-focus-dark-1024.png` and its four sibling PNGs: move review evidence to `briefs/` and update the default evidence path/documentation. They add 641,507 bytes to product history. No screenshot move was performed in this read-only review.

**Code and test assessment**

State ownership is reasonable: MailClient owns integration state/refs, while `lib/ui` owns reusable presentation/navigation hooks. The toolbar delegates archive, spam, delete, move, topics, done and window opening to existing handlers; no second network mutation implementation was added. The list remains mounted, preserving virtualization and pane layout. Data attributes cover layout, toolbar, position, active rows and selection. Mobile focus controls are gated out. The 390 px browser case passed with a saved desktop focus preference, preserving the existing single-pane reader and back history.

The `lazyAdmin.dom.test.tsx:199` change does not weaken the test: async `act` flushes the Retry identity change, and the same exact Admin-absence/idle-count assertions run inside the existing `waitFor`. Cold-import, authorization and subsequent cleanup checks remain. Timeouts and retries are unchanged. Comparison with fetched `origin/fix/i18n-views` 992b220 and local `fix/i18n-views` a60d607 found the old unawaited cancellation assertion in both; no separate r2 fix is present in those committed tips. Preserve reader-focus's synchronization fix when integrating any newer r2 version, and reconcile against that version explicitly if supplied.

**Merge notes for round 10**

`git fetch origin` succeeded. These are pairwise `git merge-tree --write-tree <ref> 14a1f8e` results; they do not prove an entire multi-branch integration stack builds.

- **origin/integration/stage 11dc3c5: clean**, exit 0, tree `66a542b056dfd42351307091156aa822adb2c3c4`.
- **origin/feat/status-bar-compact 7a96887: conflicts in two files.** `AppShell.tsx`, the ShellHeader toolbar/indicators hunk: retain reader-focus's combined mobile-thread/desktop-focus condition for hiding `header.toolbar`, and compact status's `indicators={statusBar}`. Preserve compact's `styles.workspace` import/class and footer removal, plus reader's `onReaderNavigate` prop/wiring. `doc/SHELL.md` is add/add: combine the status/density documentation and reader-layout documentation under one coherent document; correct the notice/printing claims after fixing the findings. `ShellPanes.tsx`, `ShellPanes.module.css`, `MessageViewPane.module.css` and MailClient auto-merge: retain compact separator classes and spacing variables alongside focus hiding/resize persistence and corrected print rules. Recheck focus with the sidebar collapsed, the status popover, both desktop widths and 390 px after resolution.
- **origin/fix/i18n-views 992b220: clean**, exit 0, tree `e90aa531e427ac2d4917078b28705da567662fbc`. Additional check against local a60d607 is also clean, tree `3d3667703ae441ba4f5fe7e48821ed5a1dc7fd61`. Preserve its newer localized folder/view copy, all `Reader.focus` keys and the lazy-admin synchronization fix described above.
- **origin/feat/sender-identities-3 e63a306: five conflicted files.** `MailClient.tsx`, top import hunk: keep `useSenderMessages` and all four reader imports. `PreferencesTabContent.tsx`, imports: keep next-intl hooks and React's `ReactNode` type. Its signature-label hunk: combine `!senderPreferences` with `t("preferences.signature")` and the matching conditional closing brace. `lib/mail/resyncMessage.senderKey.test.ts`, isolation-helper/first-test hunk and second-test declaration hunk: choose one complete isolation scheme, preferably round 8's existing `runIsolated`/`NOCTUA_RESYNC_TEST_CHILD`; retain both real IMAP cases, all assertions and the 20-second test/child budgets. Do not combine both flags/helpers. Each catalog has two conflict regions: merge `Settings.sender`/`Settings.edit` into the complete translated Settings object, preserving members/preferences/roles; merge sender Compose/Errors additions into the complete existing namespaces, retaining `Reader.focus` and all other catalogs. Parse JSON and verify de/en key parity afterwards.
- **origin/fix/admin-mailbox-self-grant b6c1ba9: one conflict.** `playwright.qa-round2.config.ts`, `testMatch`: retain both `qa-admin-self-grant|qa-reader-focus` alternatives and every existing spec. MailClient/catalog changes auto-merge.

Raw merge outputs and conflict hunks are under `reader-focus-regressions-r1/*.merge.txt` and `merges/`.

**Gates**

- `nice -n 15 bun run typecheck`: exit 0; zero errors in 1,202 files.
- New DOM suites, three repetitions: **45 pass, 0 fail**, 198 assertions.
- Focused randomized stress, including lazy-admin: **72 pass, 0 fail**, 225 assertions.
- `nice -n 15 timeout 1800 bun run test:ci`: exit 0; **2,804 server tests / 304 files / 15,327 assertions / 532.73 s** and **477 DOM tests / 60 files / 2,748 assertions / 66.15 s**.
- `nice -n 15 timeout 600 bun run lint`: expected exit 1; **1 existing error / 25 warnings**, no added findings. Error remains `app/components/calendar/useCalendarConflicts.ts:58`.
- `nice -n 15 timeout 1200 bun run build`: exit 0, 91.44 s; production type checking and standalone generation completed.
- Committed `qa-reader-focus` Playwright suite against the production server on 3895: exit 0, **3 passed (1.1 min)**; includes the 390 px single-pane reader/back history with no desktop focus controls.
- Additional corrected browser probes completed the eight-layout matrix, saved-focus/scroll check, archive/delete/notice check, print/PDF check, 17-page traversal and keyboard/overlay check. These are observational probes; their successful execution does not negate the recorded P2 findings.
- `git diff --check` and `git fsck --connectivity-only --no-dangling 14a1f8e`: exit 0. Checkout status clean.

An early CI attempt was discarded because replacing the dependency symlink during that run temporarily broke package resolution. It was stopped by its verified owned PID and rerun completely after copying dependencies. Early browser probes were corrected for the fixture's textarea editor, asynchronous action completion and the distinction between a disabled loading button and the true paging end. The final gate results above use the corrected runs.

**Process incident and scope**

The implementer's SIGTERM to PID 2363146 before checking ownership remains a process finding, not a code finding. That PID was absent during review. The clean checkout, intact Git connectivity and complete passing test/fixture suites show no observed repository or fixture damage. They cannot establish what that earlier process owned or whether work outside this checkout was affected; that impact remains unknown.

Review servers used app port 3895 and fixture ports 3897–3899. Only recorded, review-owned processes were stopped. No push, source fix, commit or other worktree change was performed. Load average at start: **6.08 / 12.03 / 16.93**; at end: **15.83 / 15.82 / 14.51** (10:46:42 UTC).
