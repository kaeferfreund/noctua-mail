# Shell

## Mail shell and reader layouts

On desktop (at least 768 px), `MailClient` supplies a device-only `readerLayout`
(`split` or `focus`) to the shell. Split shows the resizable message list and
reader. Focus hides the list and its splitter; the reader fills that space while
the folder sidebar and optional calendar remain available. Both mail panes stay
mounted: the list selection, virtualization and splitter widths survive. Back
restores the list scroll position and focuses the selected row without scrolling;
if virtualization has removed that row, the list container receives focus. Every
split-to-focus entry, including a saved-preference single click, focuses Back.
Below 768 px, the existing single-pane view and history remain derived from
`viewMessage` (TEAM-INBOX D11). Focus controls and shortcuts do not run there.

Open a message large with a double-click, Enter on a focused row, the labelled
**Vergrößern / Expand reading view** button, or **Shift+Enter**. Return using the
leading back arrow, **Escape**, **Liste anzeigen / Show message list**, or
**Shift+Enter**. Clicking a mailbox, folder, topic or view returns to split so the
new list is visible. Navigation keeps the preferred layout for the next message;
explicit back/toggle-to-list records split as the preference. Typing, composition,
menus and dialogs keep their existing keyboard handling. A tooltip closing on
Escape (Back shows one after keyboard entry) does not consume that key press, so
one Escape always returns to the list. The saved preference applies only while a
message is open: with none open the list is shown, and list paging, scroll capture
and the notice anchor follow that shown layout.

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
Archive and Delete / Entf share successful-removal continuation: next rendered
row, otherwise previous, otherwise back to the list. Failed commands retain the
current message. If the focused control disappears or is disabled (a busy Delete,
a dismissed Undo notice), focus returns to Back instead of the page body.
Shortcuts appear in the applicable controls’ tooltips. The
localized toolbar group and live counter expose a descriptive accessible position.

The focus toolbar reuses the list orchestrator's archive, spam, delete, move,
topic, flag and message-menu handlers, and the existing detached-window opener.
Mark done/undone uses the existing keyword mutations. Printing calls
`window.print()` with print CSS restricted to explicitly marked mail headers and
message content. Unsent composers, notes, activity, collaboration controls and
action chrome are excluded, as are sender avatars (their initials are decoration).
Floating notices measure the visible reader in focus
(including with a collapsed sidebar) and the list in split. The existing thread
reader continues to supply subject, sender, mailbox/folder badges, date, replies,
remote-content controls and collaboration bar.

## Reader layouts: verification and integration

The focused DOM suites are `lib/ui/readerFocus.dom.test.tsx` and
`lib/ui/readerNavigation.dom.test.tsx`. Browser coverage is
`tests/browser/ui/qa-reader-focus.spec.ts`, included in
`playwright.qa-round2.config.ts`. It uses the synthetic QA session and requires
the round-two fixture (`QA_ROUND2_FIXTURE=1`, 300 synthetic INBOX messages); without
it the saved-preference paging and print cases fail:

```sh
QA_ROUND2_FIXTURE=1 QA_SHELL_PORT=<port> bun scripts/runQaShellBrowserTests.ts \
  --config=playwright.qa-round2.config.ts qa-reader-focus
```

Screenshots and PDFs go to the untracked `<checkout>/.tmp/reader-focus-evidence`,
resolved from the spec file. `READER_FOCUS_EVIDENCE_DIR` redirects them, for
example to a preserved review directory outside the checkout.

### Merge rehearsal notes

`origin/integration/stage` `e70c30b` (round 9) is merged into this branch. Its
conflicts were the MailClient import hunk (both import sets kept), the lazy-admin
Retry hunk (this branch's async `act` kept) and the round-two `testMatch` (both
`qa-admin-self-grant` and `qa-reader-focus` kept); the round-8 notes for
`feat/sender-identities-3` and `fix/admin-mailbox-self-grant` are resolved there.

Rehearsed with `git merge-tree --write-tree HEAD <ref>` (no worktree/index merge).
These are instructions for the integrator, not changes to those branches:

- `origin/feat/build-info` `6307539` and `origin/fix/sidebar-views-row` `94f1a31`
  merge cleanly.
- `origin/feat/status-bar-compact` `a864dfc`, `app/components/shell/AppShell.tsx`
  ShellHeader hunk: keep this branch's `toolbar` condition (phone thread or
  desktop focus hides `header.toolbar`) and take compact's `indicators={statusBar}`.
- Same branch, `doc/SHELL.md` (add/add): combine both documents under one title,
  reader layout sections first, then the status indicator and its round records.
  Split measures notices against the list, focus against `#reader`; the header
  status stays visible in focus.
- Same branch, `messages/de.json` status hunks: the conflict also occurs between
  `e70c30b` and that branch and is not caused by reader focus; resolve as on
  `deploy/dev-stage`.
- `origin/feat/i18n-slice3` `7c05ea6`, `tests/browser/compose/qa-compose.spec.ts`:
  the same conflict occurs between `e70c30b` and that branch; this branch does
  not touch the file.

The full CI run also exposed an existing lazy-admin DOM test synchronization
issue: Retry resolves identity asynchronously, but the test inspected idle-task
cancellation without an async `act` boundary. The test now flushes the identity
update and its passive effects before asserting both the missing Admin entry
and cancellation. No admin production behavior, assertion or timeout was changed.

A failed page blocks only the unloaded next boundary until the existing folder
refresh clears the error. Already loaded rows stay navigable; another next click
must never increment past a page that failed to load.

Initial reader-focus gates (before the R2 fixes) on the dedicated worktree: frozen install and unchanged
`bun.lock`; typecheck zero errors; the two new DOM suites repeated three times
(45 passes, zero failures); complete `test:ci` (2,804 server tests / 304 files /
15,327 assertions, 477 DOM tests / 60 files / 2,748 assertions, zero failures).
Lint retains exactly the supplied baseline: one `useCalendarConflicts.ts:58`
error and 25 warnings, with no new diagnostics. Production build passes. All
three QA browser cases pass on 3870 with the dev protocol fixture on 3871–3873;
this includes full-width reader printing, detached-window opening, done/undone,
keyboard navigation, persisted layout and unchanged 390 px mobile history.

Screenshots in `../briefs/reader-focus-evidence/`: `reader-focus-light-1280.png`,
`reader-focus-dark-1280.png`, `reader-focus-light-1024.png`,
`reader-focus-dark-1024.png`, and `reader-mobile-390.png`. All correspondence and
accounts in these artifacts are synthetic.

The final focused stress command (`test:stress` with `bunfig.dom.toml`, the two
reader suites and the isolated lazy-admin suite) passes 72 tests with 225
assertions, seed 1337 and three repetitions; zero failures. The final browser
screenshots clear incidental text selection before capture.

R2 adds real archive HTTP checks from both a row menu and the focus toolbar,
archive-to-next continuation, a collapsed-sidebar delete/Undo check, saved-
preference keyboard focus, and a print screenshot/PDF with a typed private draft.
The R2 gate logs and report live outside product history under `../briefs/`.

In focus the header keeps the compact status indicator (see below); only the
list toolbar is hidden.

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
The running build (`BuildInfo`, "Build <sha7> · <date>, <time>" in the display
zone, full commit and ISO time in the tooltip) sits as a footer line at the
bottom of the desktop status popover and as a label at the end of the phone
status menu; without build data it renders nothing. The sidebar brand shows
the same `BuildInfo` label, so both places read short commit plus Berlin time.
The identity comes from the build artifact: `generateBuildVersion.ts` records
`NOCTUA_BUILD_HASH`/`NOCTUA_BUILD_TIME` (or the Dockerfile's `NEXT_PUBLIC_BUILD_*`)
as `hash`/`builtAt` in `public/build-version.json`, and the page and
`/api/version` read it once per process (`getRunningBuild`). A Docker image
therefore shows its build without runtime variables, and a runtime environment
that describes another build cannot pair a new label with old code. Runtime
variables are read only when the artifact has no commit and always under
`next dev` (`NODE_ENV=development`), so a file left by a local `bun run build`
never labels the live dev server.

Every phone status Sheet (Hintergrundaufgaben, Posteingangsprüfung, Demnächst,
Fehler, Kalender) starts with the same visible title row, `StatusSheetTitle`:
title, count where the section has one, then the Sheet's 44px icon close; the
section description and content follow. Clear-all for Fehler is a labelled
button in the content, not a second icon next to the close. Headings form one
outline: the desktop popover has an h2 title and an h3 per section, each phone
Sheet an h2 title; the calendar's month title (FullCalendar `headingLevel`) is
one level below its container, h4 under "Demnächst" and h3 in the phone Sheet.
Reminder leads use
the largest whole unit (`reminderLeadUnit`: zu Beginn, Minuten, Stunden, Tage)
through one ICU select/plural message.

Radix FocusScope treats every element whose `tabIndex` is 0 or more as a loop
edge. FullCalendar 6 rendered day numbers and column headers as `<a>` without
`href`: browsers skip them, but `tabIndex` reported 0, so Tab left the calendar
popover instead of wrapping. FullCalendar 7 renders those labels as plain,
`aria-hidden` elements, so the desktop popover loops focus in calendar mode
exactly as in section mode, and Shift+Tab from the first control reaches the
last event. `CalendarView.dom.test.tsx` fails if the calendar ever again exposes
an element that reports a tab index without being keyboard-focusable.

Desktop density (768px and wider) is scoped to `ShellPanes.module.css`:
`--shell-gutter: 0px`, `--pane-padding-x/y: 12px`, and
`--reader-padding-x/y: 16px`. The existing outer 8px inset remains, preserving the
header/sidebar placement. The main panes have no card border, radius or shadow;
one 1px separator supplies the divider and an 11px pointer target keeps resizing
usable. Reader/header/collaboration/compose internals are unchanged; detached
windows do not inherit these variables. Mobile spacing and row heights are
unchanged. Notice positioning measures the list pane's actual right edge in split and
the visible reader (`#reader`) in focus.

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

Merge commit: `97d3eff` (parents: status evidence relocation and `992b220`).

### Round 10 merge rehearsal decisions

`origin/feat/reader-focus` is now available at `14a1f8e`. Its shell-pane CSS,
ShellPanes and MailClient changes auto-merge. Inspect the combined result to
retain density tokens and separators together with reader focus visibility.
Two conflict hunks remain:

- AppShell toolbar/indicators hunk: keep the reader branch's desktop-focus
  toolbar suppression expression AND unconditional `indicators={statusBar}`
  from compact status. This preserves the activity control in desktop focus.
- SHELL.md add/add hunk: retain both the reader layout documentation and this
  status section, including evidence locations and integration decisions.

`origin/feat/sender-identities-3` at `26d82d8` has five conflict files:

- AccountSettingsModal, hunk 1: retain `"use client"` as the first statement,
  then both `useTranslations` and `useSenderMessages` imports. Hunk 2: initialize
  both hooks. Hunk 3: retain translated existing tabs plus the sender identities
  tab. Hunk 4: include both `t` and `senderMessages.identitiesTitle` in memo
  dependencies and retain sender's preferences-first active-tab fallback.
- PreferencesTabContent, import hunk: retain next-intl hooks plus ReactNode.
  Signature hunk: retain `!senderPreferences` and the translated signature label,
  together with the matching conditional closing delimiter.
- resyncMessage.senderKey.test, helper/first-case hunk: retain integration's
  `runIsolated`/`NOCTUA_RESYNC_TEST_CHILD` mechanism and both real IMAP assertions.
  Second-case declaration hunk: retain `test` and its same child guard; discard
  the competing `realResyncTest` wrapper. Do not combine isolation mechanisms.
- de/en, first hunk: merge `Settings.sender`/`edit` leaves into the complete
  existing Settings object; keep shared `members.enabled` and preferences keys
  once. Second hunk: merge sender Compose/Errors/Admin additions into their
  existing namespaces; preserve all status, Views, Folders, refresh and topic
  picker keys. Recheck JSON uniqueness, parity and ICU placeholders.

These rehearsals do not merge or modify the reader/sender branches.

## Round 2 calendar validation

The composite calendar sits in a flex/min-height body (`BottomStatusBar.module.css`
`.calendarBody`) in a bounded frame; mobile fills its Sheet. The status popover is at 9990, the
mobile Sheet at 9994, event dialogs at 9995, and their pickers at 9998.
EventDialog now reuses `useDialogFocusRestore` and explicitly focuses its title
on opening; creation/editing returns focus to the calendar action.

Production browser measurements (`.fc-view-harness`): 426.328125px at both
1280×900 and 1024×900; 683.5px at 390×844. All three support actual pointer
clicks to create, open and edit synthetic events, dialog child picker access,
and action/indicator focus restoration. The committed regression cases assert
positive grid height, surface < dialog < picker, and these interactions.

The mobile create/edit/focus gate opens through the normal indicator menu.
An exploratory PWA-open → edit → Escape sequence caused a history return that
remounted the shell, so indicator focus could not survive that remount. This
was not baseline-compared and is retained as an integration follow-up in
`round2/mobile-focus-trace.log`; no shared history behavior was changed.
PWA flag consumption and query/hash preservation are verified separately.

Earlier probes exposed the missing dialog focus return (fixed), an ambiguous
text locator matching both title and success notice (scoped to the heading),
and a retry-count assumption racing a startup sync (now asserts one additional
full-sync POST for the same folder). Original logs remain in external evidence.

Final gates after `f97896c`: typecheck 0 errors (1,201 files); the status, Shell
and MobileFrames DOM suites pass three times (51 tests / 228 assertions each).
Catalog checks pass 9 tests / 5,150 assertions: 1,025 leaves per locale, all ICU
arguments match, 57 status leaves, no duplicate JSON keys, and every non-status
i18n-views message is preserved. Full CI passes 2,816 server tests / 305 files /
16,998 assertions (442.25s), then 492 DOM tests / 60 files / 2,824 assertions
(71.08s). Lint remains the baseline 1 error / 25 warnings. Production build
passes (38.8s optimized compilation). Seven browser cases pass (39.4s), plus
all five reviewer probes: calendar layout/event click, layers, retry wiring,
exception clearing and all mobile routes/PWA flag handling.

The original 12 PNGs and six JSON artifacts are preserved byte-for-byte in
[round1-committed](/home/monkey/code/noctua-mail/briefs/status-bar-compact-evidence/round1-committed/);
new captures are in the parent evidence directory and raw gates/probes in
`round2/`. Browser fixtures use isolated `.tmp/qa-shell-*` storage, synthetic
credentials and only ports 3875–3878. `.env.local` and the configured persistent
data directory were not changed. Servers terminate via their recorded owned
PIDs/process groups; no push or deployment occurs.

## Round 3 phone calendar and layer tokens

Review r2 found the week/day buttons clipped at 320 px: the phone calendar
reused the desktop `.body` frame (`overflow: hidden`), and FullCalendar's
one-row toolbar needed 351 px of a 288 px body. The phone Sheet now uses the
`calendarFrame`/`calendarBody` primitives in `MobileFrames.module.css`; the
desktop popover keeps the shared floating-calendar body. On phones the toolbar
wraps: prev/title/next take the first row, ＋ Event/today and the
month/week/day group share the next one. Every control, including the Sheet
close, has a 44 px target, and week headers fit their columns. The body keeps a
340 px minimum height and the Sheet body scrolls vertically when a shorter
viewport (keyboard) cannot fit it. `data-calendar-frame` marks the route
(`phone`/`popover`).

Production measurements (`.fc-view-harness`, toolbar 96 px): 260 px at
320×568, 224 px at 320×500, 384 px at 360×640 and 588 px at 390×844. In month,
week and day view, every control is inside the viewport and wins hit testing
at its centre. Pointer clicks use raw mouse coordinates, so Playwright cannot
scroll an `overflow: hidden` ancestor into view. The checks find no horizontal
overflow, seven in-viewport columns and no foreign element over the Sheet. The
same check fails on `5809d89` (23.8 px targets; r2 measured the clipped day
button). The density re-measurement against the r2 baseline is unchanged:
list +32/+31 px, reader +29.58 px at 1280/1024, pane height +60 px.

The z-index ladder is now a set of unlayered `--layer-*` tokens in
`app/globals.css`: floating 9990, dialog 9994, dialog overlay 9995, popper 9998
and drag ghost 9999. Status/calendar frames, the compose modal, the Radix
lifts and the shadcn primitives (`z-(--layer-*)`) read those tokens. The
nested dialog arithmetic keeps its JS mirror in `dialogLayers.ts`;
`app/globals.test.ts` asserts the order and the mirror. Measured layers are
unchanged: desktop status 9990 < mobile Sheet 9994 < event dialog 9995 <
picker 9998.
