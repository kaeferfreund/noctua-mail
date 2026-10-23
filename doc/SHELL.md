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
Archive and Delete / Entf share successful-removal continuation: next rendered
row, otherwise previous, otherwise back to the list. Failed commands retain the
current message. Shortcuts appear in the applicable controls’ tooltips. The
localized toolbar group and live counter expose a descriptive accessible position.

The focus toolbar reuses the list orchestrator's archive, spam, delete, move,
topic, flag and message-menu handlers, and the existing detached-window opener.
Mark done/undone uses the existing keyword mutations. Printing calls
`window.print()` with print CSS restricted to explicitly marked mail headers and
message content. Unsent composers, notes, activity, collaboration controls and
action chrome are excluded. Floating notices measure the visible reader in focus
(including with a collapsed sidebar) and the list in split. The existing thread
reader continues to supply subject, sender, mailbox/folder badges, date, replies,
remote-content controls and collaboration bar.

## Verification and integration

The focused DOM suites are `lib/ui/readerFocus.dom.test.tsx` and
`lib/ui/readerNavigation.dom.test.tsx`. Browser coverage is
`tests/browser/ui/qa-reader-focus.spec.ts`, included in
`playwright.qa-round2.config.ts` and compatible with the existing synthetic QA
fixture/session. `READER_FOCUS_EVIDENCE_DIR` optionally overrides the screenshot
destination (default `../briefs/reader-focus-evidence`).

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
