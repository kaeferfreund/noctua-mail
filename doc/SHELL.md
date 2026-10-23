# Mail shell and reader layouts

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

## Verification and integration

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
