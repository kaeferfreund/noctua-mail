<<<<<<< origin/feat/reader-focus
# Mail shell and reader layouts

On desktop (at least 768 px), `MailClient` supplies a device-only `readerLayout`
(`split` or `focus`) to the shell. Split shows the resizable message list and
reader. Focus hides the list and its splitter; the reader fills that space while
the folder sidebar and optional calendar remain available. Both mail panes stay
mounted: the list selection, virtualization and splitter widths survive. Back
restores the list scroll position and focuses the selected row without scrolling.
Below 768 px, the existing single-pane view and history remain derived from
`viewMessage` (TEAM-INBOX D11). Focus controls and shortcuts do not run there.

Open a message large with a double-click, Enter on a focused row, the labelled
**Vergrößern / Expand reading view** button, or **Shift+Enter**. Return using the
leading back arrow, **Escape**, **Liste anzeigen / Show message list**, or
**Shift+Enter**. Clicking a mailbox, folder, topic or view returns to split so the
new list is visible. Navigation keeps the preferred layout for the next message;
explicit back/toggle-to-list records split as the preference. Typing, composition,
menus and dialogs keep their existing keyboard handling.

Device storage uses `noctua:readerLayout` (`split` or `focus`), with a safe split
fallback when storage is unavailable or invalid. No server preference is added.
`noctua:readerFocusHintSeen` (`1`) records the one-time, dismissible split-reader
double-click hint when it is first shown. The reusable device-state hook lives in
`lib/ui`; MailClient owns its use and wires all shell/list/reader actions.

In focus, **j / k** or the arrow buttons select the next / previous rendered row.
The counter follows the active list renderer, including group, thread and nested
collapse state; duplicate message IDs count once. It shows `n / loaded+` while
more pages exist and `n / total` at the real end. The tooltip explains that the
loaded total is provisional: a server message count cannot describe collapsed
thread rows on unloaded pages. Reaching a page boundary requests the next page
through the existing data controller, waits for the renderer's new rows, and
continues. Pages entirely hidden by collapsed groups are skipped. A folder
change, load error, changed selection or leaving focus cancels pending navigation.
Delete / Entf retains the existing selection-action and successor behavior.

The focus toolbar reuses the list orchestrator's archive, spam, delete, move,
topic, flag and message-menu handlers, and the existing detached-window opener.
Mark done/undone uses the existing keyword mutations. Printing calls
`window.print()` with print CSS restricted to the reader. The existing thread
reader continues to supply subject, sender, mailbox/folder badges, date, replies,
remote-content controls and collaboration bar.

## Verification and integration

The focused DOM suites are `lib/ui/readerFocus.dom.test.tsx` and
`lib/ui/readerNavigation.dom.test.tsx`. Browser coverage is
`tests/browser/ui/qa-reader-focus.spec.ts`, included in
`playwright.qa-round2.config.ts` and compatible with the existing synthetic QA
fixture/session. `READER_FOCUS_EVIDENCE_DIR` optionally overrides the screenshot
destination (default `artifacts/reader-focus`).

### Merge rehearsal notes

Rehearsed with `git merge-tree --write-tree <ref> HEAD` (no worktree/index merge).
The integration baseline is `origin/integration/stage` at `11dc3c5`; it merges
cleanly. The following notes describe each conflict hunk against the requested
other branch tips. These are instructions for the integrator, not changes to
those branches.

Against `origin/feat/sender-identities-3` (`e63a306`):

- `app/components/MailClient.tsx`, import hunk immediately after `"use client"`:
  retain `useSenderMessages` and all four reader imports. Sender refresh effects,
  signature save behavior and reader state/slots are independent and must remain.
- `app/components/account-settings/tabs/PreferencesTabContent.tsx`, import hunk:
  keep `useLocale`/`useTranslations` and import `ReactNode` alongside React hooks.
  This conflict already comes from integration's localized preferences.
- Same preferences file, default-signature label hunk: keep the sender branch's
  `!senderPreferences` condition and the integration branch's translated
  `t("preferences.signature")` label. Preserve its matching conditional close.
- `lib/mail/resyncMessage.senderKey.test.ts`, first isolation-helper hunk: select
  one fresh-process isolation implementation, preserving both protocol tests
  and their assertions plus the unchanged 20-second child budget. Do not combine
  two environment flags/helpers. The integration `runIsolated` implementation
  already isolates the global IMAP mock and is suitable to retain.
- Same test file, second test declaration hunk: retain its `test(...)` declaration
  and `NOCTUA_RESYNC_TEST_CHILD` guard if retaining `runIsolated`; use the sender
  branch's `realResyncTest(...)` declaration only with that branch's helper.
- `messages/de.json` and `messages/en.json`, hunk 1 in `Settings`: merge sender
  settings keys into the existing translated settings object, preserving both
  key trees. Do not choose one complete object over the other.
- Both catalogs, hunk 2 at the top-level `Compose`/`Errors` insertion: merge the
  sender `Compose.sender`/`Errors.sender` subtrees and associated Compose keys
  into integration's complete catalogs. Retain `Reader.focus` in both locales,
  preserve other namespaces and rerun catalog parity/JSON parsing.

Against `origin/fix/admin-mailbox-self-grant` (`b6c1ba9`):

- `playwright.qa-round2.config.ts`, `testMatch` hunk: keep both alternatives,
  `qa-admin-self-grant|qa-reader-focus`, alongside the existing specs. MailClient's
  admin access-refresh props merge automatically with reader changes.

The full CI run also exposed an existing lazy-admin DOM test synchronization
issue: Retry resolves identity asynchronously, but the test inspected idle-task
cancellation without an async `act` boundary. The test now flushes the identity
update and its passive effects before asserting both the missing Admin entry
and cancellation. No admin production behavior, assertion or timeout was changed.

A failed page blocks only the unloaded next boundary until the existing folder
refresh clears the error. Already loaded rows stay navigable; another next click
must never increment past a page that failed to load.

Final reader-focus gates on the dedicated worktree: frozen install and unchanged
`bun.lock`; typecheck zero errors; the two new DOM suites repeated three times
(45 passes, zero failures); complete `test:ci` (2,804 server tests / 304 files /
15,327 assertions, 477 DOM tests / 60 files / 2,748 assertions, zero failures).
Lint retains exactly the supplied baseline: one `useCalendarConflicts.ts:58`
error and 25 warnings, with no new diagnostics. Production build passes. All
three QA browser cases pass on 3870 with the dev protocol fixture on 3871–3873;
this includes full-width reader printing, detached-window opening, done/undone,
keyboard navigation, persisted layout and unchanged 390 px mobile history.

Screenshots in `artifacts/reader-focus/`: `reader-focus-light-1280.png`,
`reader-focus-dark-1280.png`, `reader-focus-light-1024.png`,
`reader-focus-dark-1024.png`, and `reader-mobile-390.png`. All correspondence and
accounts in these artifacts are synthetic.

The final focused stress command (`test:stress` with `bunfig.dom.toml`, the two
reader suites and the isolated lazy-admin suite) passes 72 tests with 225
assertions, seed 1337 and three repetitions; zero failures. The final browser
screenshots clear incidental text selection before capture.
=======
# Shell

## Status indicator

The header owns one compact activity control, replacing the permanent desktop
footer and its clock. Idle shows only the icon; active synchronization or
recomputation shows a spinner and “Synchronisiert …”. Attention takes priority:
the badge counts exceptions plus sync jobs that failed or reached retry 3.
State changes never open a panel. Failed job progress remains available until a
replacement job reports progress for the same mailbox/folder.

Desktop uses a shadcn Popover with four explained sections: Hintergrundaufgaben,
Posteingangsprüfung, Fehler and Demnächst. The existing mobile menu and Sheets
remain the responsive presentation. `openBottomStatusPanel` stays in
`MailClient.tsx`: `process`, `mail-check`, `exception` and `reminder` select their
respective sections (`exceptions` and `reminders` are accepted aliases); `calendar` selects Demnächst and mounts the calendar browser.
The PWA `?openCalendar=1` route opens that same calendar view, consuming only its
flag and preserving other query parameters and the hash. Calendar sidebar toggle
and open-only actions are distinct, so following a reminder never hides an
already open calendar sidebar.

Process rows resolve mailbox/folder display names, including progress samples
that contain only a mailbox path. Raw protocol paths, identifiers and backend
progress text are never rendered as process copy. Attention rows offer retry via
the existing sync controller and expandable structured details. Exceptions keep
timestamps, details, re-login where applicable and clear-all. Mail checks show
actual polling activity, the last attempt and next scheduled check, or explain
IMAP IDLE delivery. No successful poll is invented for a newly connected stream.
All status copy is in both catalogs under `Shell.status`.

Desktop density (768px and wider) is scoped to `ShellPanes.module.css`:
`--shell-gutter: 0px`, `--pane-padding-x/y: 12px`, and
`--reader-padding-x/y: 16px`. The existing outer 8px inset remains, preserving the
header/sidebar placement. The main panes have no card border, radius or shadow;
one 1px separator supplies the divider and an 11px pointer target keeps resizing
usable. Reader/header/collaboration/compose internals are unchanged; detached
windows do not inherit these variables. Mobile spacing and row heights are
unchanged. Notice positioning still measures the list pane's actual right edge.

Synthetic browser evidence and before/after measurements live in
[briefs/status-bar-compact-evidence](/home/monkey/code/noctua-mail/briefs/status-bar-compact-evidence/). The density baseline was captured after the
footer removal but before the density pass; the original footer separately
occupied 28px. Verification results and merge notes follow below.

At 1280×900, usable list width grows from 342px to 374px (+32px), and
reader width from 540.56px to 570.14px (+29.58px). At 1024×900, usable list
width grows from 235px to 266px (+31px), and reader width from 392.08px to
421.66px (+29.58px). Density alone grows both pane heights from 804px to
836px (+32px); their usable bodies also recover the removed card borders.
A separate browser comparison restores only the former footer's 28px flex
footprint and proves another 28px gain in both panes at both widths and themes.
Header geometry is identical before/after density and while the Popover opens.

Browser coverage checks all section routes, PWA URL consumption, the 390px
menu/Sheet and focus restoration, keyboard resizing, unchanged thread-header,
collaboration and compose styles, standalone-reader isolation and floating notice
alignment after sidebar collapse. Screenshots include all four desktop
size/theme combinations, each Popover, the mobile list/Sheet, a populated reader
and inline compose. The QA runner accepts explicit fixture ports; this branch
used only app port 3875 and fixture ports 3876–3878 and terminates its recorded
server process group before removing fixture storage.

Frozen installation preserved `bun.lock`. Type checking reports zero errors in
1,198 files. Three DOM suites ran three times: 147 passes, zero failures and
570 assertions. Progress/catalog suites add 16 passes and 3,732 assertions;
catalog parity is green with 57 new `Shell.status` keys. Lint stays at the
supplied baseline of one existing error and 25 warnings. Production build and
all four browser scenarios pass. Complete CI and merge results are recorded in
[archived verification.json](/home/monkey/code/noctua-mail/briefs/status-bar-compact-evidence/verification.json).

Integration dry run of implementation commit `bbcec12` against
`origin/integration/stage` (`11dc3c5`) is clean: merge-tree exit 0, tree
`389c6975226d7e663ef9b109a870b5306da14916`. There are no conflict files or
conflict hunks to resolve. `origin/feat/reader-focus` is absent from the remote,
so its requested merge-tree comparison cannot yet run; preserve this “Status
indicator” section alongside that branch's reader section when it is published.

Final `bun run test:ci`: exit 0, **2,806 server tests** (304 files, 15,507
assertions, 632.37s) and **487 DOM tests** (59 files, 2,757 assertions, 87.92s),
zero failures. Two earlier development runs had timeouts in existing auth/lazy
suites and a SQLite contention failure; those tests pass unchanged in the final
complete run. No timeout, retry budget or existing assertion was relaxed.
The implementation and validation notes are committed locally; nothing is pushed.

Round 2 evidence is stored outside the source checkout at
[briefs/status-bar-compact-evidence/round2](/home/monkey/code/noctua-mail/briefs/status-bar-compact-evidence/round2/).
The status browser suite accepts `QA_STATUS_ARTIFACTS` for this destination;
without it, captures stay in ignored `.tmp/qa-status-indicator`.

## Round 2 integration decisions

Merged `origin/fix/i18n-views` at `992b220bd65d8fcb3540b58a3a835d48d47a0e2e`
with `--no-ff`; fetch on 2026-10-23 found no newer head.

- BottomStatusBar (2 hunks): keep compact imports and unified owner, mobile
  routing, bounded calendar body and calendar layer; discard translated old footer.
- ProcessStatusPopover (2): keep compact imports, named mailbox/folder scopes,
  retained failed jobs, retry/details and embedded rendering; keep singular
  `phase`/`mode` keys and absolute localized update times.
- ExceptionStatusPopover (5): keep locale imports/declaration, embedded frame,
  compact trigger/title/heading and `exception.empty`; retain absolute timestamps.
- UpcomingStatusPopover (11): keep locale type, delete error, embedded frame,
  trigger/title/heading/close, source/calendar action labels, duration `{value}`,
  lead `{minutes}`, repeats `{value}`, and `reminder.empty`. Shared handlers stay.
- de (1) / en (3): use exactly the compact `Shell.status` object (57 leaves);
  discard the former status aliases/plural `phases`/`modes`. Keep all other
  i18n-views catalog additions, including Views, Folders, refresh and topic picker.
- MailClient/useSearchState auto-merges retained; verify through DOM/browser gates.

If i18n-views moves again before round 10, repeat the merge using these decisions.
>>>>>>> HEAD
