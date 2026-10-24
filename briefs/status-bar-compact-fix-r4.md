# Status bar compact: fix round 4 (feat/status-bar-compact)

Worktree `/home/monkey/code/noctua-mail/wt-status-bar`, branch `feat/status-bar-compact`.
Start `a864dfc`. **New head `3e04c9f315fc112f0259ab8d1df6ec81dadb49d7`.** Not pushed.

## Commits (`a864dfc..3e04c9f`, first parent)

| SHA | Subject |
| --- | --- |
| 0bbb702 | Merge integration/stage e70c30b into feat/status-bar-compact |
| cd6596e | Merge feat/build-info 6307539 into feat/status-bar-compact |
| 2f186f2 | fix(calendar): keep the status popover's Tab loop inside the calendar |
| a424924 | fix(shell): give every phone status Sheet one visible title row |
| 4212f6b | fix(shell): read reminder leads in minutes, hours or days |
| 4c3948d | fix(shell): show the sidebar build label through BuildInfo |
| 3c954a5 | fix(search): show the localized current folder in the filter popover |
| 0059d0c | test(shell): locate the inline composer without a CSS module file prefix |
| 3e04c9f | test(shell): cover the build label in the status popover, phone menu and sidebar |

`bun install --frozen-lockfile` after merge 1: Next 16.4.2 / React 19.3.1 installed, `bun.lock` unchanged.

## Merges

### 1. `e70c30b` (round 9 final), commit 0bbb702

Conflicts and how they were resolved:

- **`messages/de.json`, 2 hunks.**
  - Hunk 1: kept this branch's compact `Shell.status` schema. Dropped round 9's obsolete footer leaves: `syncingScope`, `syncRetryScope`, `syncingFolders`, `syncingMailbox`, `openSource`, `openCalendar`, `deleteReminderFailed`, `reminderBefore`, `upcomingSummary`, `phases`.
  - Hunk 2: kept `mode` plus `updatedAt`/`calendarEvent`. `recent`/`new`/`repair` take the reviewed i18n-views wording ("Synchronisierung der letzten Nachrichten", "Synchronisierung neuer Nachrichten", "Reparatursynchronisierung").
  - en.json auto-merged to the same schema.
  - de/en leaf parity: no one-sided leaves. The leaf set equals the preview merge `2136d48` minus the four build keys added in merge 2.
- **`lib/i18n/catalogs.test.ts`** (auto-merged, semantically stale):
  - `Shell.status.modes.recent` is now `mode.recent`.
  - The footer-only `upcomingSummary`/`syncingFolders` assertions are replaced by the live `attention` plural, identical to `2136d48`.
- No code still references a dropped key (grep). `doc/I18N.md` needed no change for this merge.
- Checks after this merge: typecheck 0 (1,247 files); `bun test lib/i18n` 67/0.

### 2. `6307539` (feat/build-info), commit cd6596e

I followed `briefs/build-info-report.md`. The result is byte-identical to the preview merge `2136d48` for every conflicted file:

- **`BottomStatusBar.tsx`:** this branch's version, plus a `buildInfo: BuildIdentity | null` prop.
  - Desktop: `<BuildInfo … className="block border-t border-border pt-3 …">` is the last child of the popover content, after the four sections.
  - Phone: `DropdownMenuSeparator` + non-focusable `DropdownMenuLabel` at the end of the status menu, only when build data exists.
- **`app/globals.css`:** dropped build-info's `.bottom-bar > .bottom-section:not(.bottom-wide)` and `.bottom-build` rules.
- **`messages/de.json` / `en.json`:** added `build`, `buildUndated`, `buildTitle`, `buildCommit` to `Shell.status`. Parity verified.
- **`BottomStatusBar.dom.test.tsx`:** `buildInfo: null` in the shared props, plus a case for the label in the popover and the phone menu.
- **`doc/SHELL.md`:** where the label lives.
- **Calendar trigger:** `CalendarPopover.tsx` auto-merges with build-info's `triggerTitle` prop. The component already had no caller on `a864dfc`, so the trigger-name change is inert here. The `openCalendar` key stays dropped.

## P3 fixes (review r3)

1. **Desktop calendar popover tab-out** (2f186f2).
   - **Root cause:** FullCalendar renders day numbers and column headers as `<a>` without `href`. Browsers skip them in the tab order, but `HTMLAnchorElement.tabIndex` still reports 0, so Radix FocusScope took the last date label as the popover's last tabbable element.
     - Tab past the last event left the popover, and the popover closed.
     - Shift+Tab from the first control tried to focus that label and stayed put.
   - **Fix:** `app/components/calendar/calendarFocus.ts` `removeDateLabelsFromTabOrder` sets `tabIndex = -1` on `a:not([href]):not([tabindex])`. It is wired as `dayCellDidMount`/`dayHeaderDidMount` in both `CalendarView` renders.
   - **Behaviour chosen:** keep focus inside. The calendar popover now loops exactly like section mode, and the phone Sheet's trap sees the same edges.
   - **Tests:**
     - helper DOM test;
     - phone-frame DOM assertion: no unmarked href-less anchors once day cells render;
     - Playwright keyboard walk on the production build. From "Neue E-Mails abrufen", Tab never leaves the popover; it passes 7 events and wraps back after 20 steps. Shift+Tab from the first control lands on the last event, Tab wraps again, and Escape restores the indicator. Record: `r4-calendar-tab-loop.json`.
2. **Phone status sheet heading** (a424924).
   - `StatusSheetTitle` (exported from `StatusPanelFrame.tsx`) is the one visible title row: `SheetTitle`, an optional count `Badge`, then the Sheet's own close. The close is enlarged to 44 px via `.statusSheet > [data-slot="sheet-close"]`, shared with `.fullscreenSheet`.
   - It is used by `StatusPanelFrame` (Hintergrundaufgaben, Demnächst, Fehler) and by the mail-check/calendar Sheet in `BottomStatusBar`. Description and content follow.
   - Removed:
     - Process's text "Schließen" button;
     - Upcoming's phone title row;
     - Exception's phone "FEHLER ×" row. On phones, clear-all is now a labelled "Alle Fehler löschen" button in the content, shown when errors exist. The desktop embedded row is unchanged.
   - `Shell.status.close` became unused and was removed from both catalogs.
   - `.statusContent` no longer has its own `85dvh` cap. It shrinks inside the `90dvh` Sheet below the title row.
   - Side effect: the auto-focused element in Demnächst/Fehler is now the plain close button (no tooltip), and Escape closed every Sheet with one press in the DOM test. A real browser was only checked for Hintergrundaufgaben (390 spec), so the r3 "two Escapes" observation has not been re-measured in a browser for Demnächst/Fehler.
   - DOM tests:
     - `MobileFrames.dom.test.tsx`: title, badge, close, description order;
     - `BottomStatusBar.dom.test.tsx`: each of the four phone menu entries;
     - CSS contract for the 44 px close.
3. **German copy** (4212f6b for leads, a424924 for the sheet title).
   - `reminderLeadUnit(minutes)` (in `status/upcomingEntries.ts`) picks the largest unit that divides evenly (start / day / hour / minute).
   - `Shell.status.reminderLead` is one ICU select+plural message in both locales:

     | Lead | de | en |
     | --- | --- | --- |
     | 0 | "Erinnerung: zu Beginn" | "Reminder: at start" |
     | 1440 | "Erinnerung: 1 Tag vorher" | "Reminder: 1 day before" |
     | 60 | "1 Stunde vorher" | — |
     | 120 | "2 Stunden vorher" | — |
     | 15 | "15 Minuten vorher" | — |
     | 90 | "90 Minuten" (not a whole hour) | — |

   - "zu Beginn" is lowercase after the colon, following German orthography for non-sentence continuations. A capitalised "Zu Beginn" is a one-word catalog change if preferred.
   - Unit test, plus catalog test for 7 cases × 2 locales.
   - `doc/I18N.md`: the reminder lead line is now translated. The reminder dialog's own lead options stay in calendar localization.
   - Phone calendar Sheet title is now "Kalender" (reuses `Shell.calendar`). The menu entry keeps the action wording "Kalender öffnen". The DOM test was updated.

## Build label consistency (4c3948d)

- The sidebar brand now renders the same `BuildInfo` component, fed by the `buildInfo` that `MailClient` already receives (`brand: { buildInfo }`).
- Result: "Build 3c954a5 · 23.10.2026, 18:30" (Europe/Berlin, active locale) in the sidebar, popover and phone menu. The tooltip carries the full commit and ISO time.
- `getBuildVersionLabel` (12 chars + UTC) remains for `/api/version` and the refresh check.
- `Shell.build` became unused and was removed.
- ShellSidebar.tsx diff: imports + `brand` type + the label element only. Also a DOM test (de/en label and title, absent without data).
- vs `origin/fix/sidebar-views-row` (94f1a31): merge-tree clean (tree `a5b8f9d`, auto-merges `ShellSidebar.tsx` and `Shell.dom.test.tsx`).

## Search P3 (3c954a5)

- **QA-209:** the "Aktueller Ordner" badge uses `getFolderDisplayName(currentFolder, locale)`, matching its tooltip, the placeholder and the chip. "INBOX" now reads "Posteingang" / "Inbox".
- Placeholder copy is untouched.
- The new DOM test fails on the previous code (verified) and passes now.

## Test maintenance

- **0059d0c:** the density case selected the inline composer with `article[class*="ComposeInlineCard"]`. Next 16.4.2 production CSS module names no longer carry the file name, so the case timed out on the merged tree (first run, see Gates). The locator now uses the card's "Open composer in new window" control, the same change as preview commit `49ded0b`. Assertions are unchanged.
- **3e04c9f:** new browser case for the build label, which reads the server's runtime env.
  - With `NOCTUA_BUILD_HASH`/`TIME`: the popover's last child after the Demnächst section, the phone menu and the sidebar show `Build <sha7> · dd.mm.yyyy, hh:mm`, with tooltip `Commit <full sha>…`.
  - Without them: no "Build" text anywhere.

## Gates (head 3e04c9f unless noted; host load average about 14.5 throughout)

| Gate | Result |
| --- | --- |
| `bun run typecheck` | 0 errors, 1,252 files |
| `bun test lib/i18n` | 68 pass / 0 fail |
| Focused DOM ×3: `status/`, `shell/`, `calendar/` (incl. calendarFocus), `useSyncController.dom` + `.notice.dom` | 156/0, 156/0, 156/0 (21 files) |
| `bun run test:ci` (once, on 3c954a5; later commits change only the Playwright spec) | rc 0. Server 2,928 pass / 0 fail, 18,359 assertions, 316 files, 560 s. DOM 605 pass / 0 fail, 3,404 assertions, 76 files, 89 s. |
| `bun run lint` | rc 0, **0 errors / 181 warnings** (round-9 baseline). Files touched this round: MailClient.tsx 73 warnings (= baseline 73; one-line `brand` change); all other touched files 0. **0 new.** |
| `bun run build` (`NOCTUA_BUILD_HASH=3c954a5…`, `NOCTUA_BUILD_TIME=2026-10-23T16:30:00Z`) | rc 0. Compiled in 23.8 s, TypeScript 71 s, 31 static pages, `ƒ /` dynamic. |
| `qa-status-indicator.spec.ts`, production build, port 3880, fixtures 3881–3883 | See the four runs below. |
| `qa-shell.spec.ts` | See the two runs below. |
| `git diff --check e70c30b..HEAD` and `a864dfc..HEAD` | clean |

Spec runs (run 1 is on 3c954a5's spec; the later runs include 0059d0c and 3e04c9f):

`qa-status-indicator.spec.ts`:
- **Run 1, with build env:** 12/13. The density case failed on the ComposeInlineCard locator, which led to 0059d0c.
- **Run 2, with build env:** 13/13.
- **Run without build env:** 13/13.
- **Final run, with build env consistent with the build:** 13/13.

`qa-shell.spec.ts`:
- **First run:** 0/4. Harness error: my runner exported the then-current HEAD (`3e04c9f`) as `NOCTUA_BUILD_HASH`, while `public/build-version.json` held the build-time `3c954a5`. The app showed "Refresh required" over the page, and the user menu was not reachable. No code issue.
- **Rerun with the build-time hash/time:** 4/4.
- **Without build env:** 4/4.

## Screenshots (`briefs/status-bar-compact-evidence/`, all ≤ 141 KB)

- `r4-popover-1440-light-build.png`, `r4-popover-1440-dark-build.png`: popover with the build footer. The sidebar brand shows the same label.
- `r4-popover-1440-light-nobuild.png`: no build env, no label.
- `r4-phone-menu-390-build.png`: phone status menu with separator and build label.
- `r4-status-sheet-390-reminder.png` (Demnächst, count 0) and `r4-status-sheet-390-process.png` (Hintergrundaufgaben): visible title row, close, then description.
- `r4-calendar-320x568.png`: phone calendar Sheet titled "Kalender".
- `r4-calendar-tab-loop.json`: keyboard walk record.

## Merge notes for round 10 (`git merge-tree --write-tree`, nothing written to refs)

**`origin/feat/reader-focus` e7d00ee** (merge base `11dc3c5`): 5 conflict files, tree `b4ab622`.

- **`app/components/shell/AppShell.tsx`, 1 hunk.**
  - Take reader-focus's `toolbar={(isMobile && navigation.view === "thread") || (!isMobile && panes.readerLayout === "focus") ? undefined : header.toolbar}` together with this branch's `indicators={statusBar}`.
  - Not reader-focus's `isMobile ? statusBar : undefined`, which would remove the desktop status.
  - `onReaderNavigate` and `styles.workspace` auto-merge.
  - This is exactly the resolution in preview merge `deff0b5`: HEAD vs `deff0b5` AppShell differs only in reader-focus's additions.
- **`doc/SHELL.md`, add/add, 1 hunk** covering the whole file. Take `deff0b5`'s combined document ("Mail shell and reader layouts" + "Status indicator") and add this round's three new paragraphs from HEAD:
  - the sidebar label sentence;
  - the phone Sheet title row with the reminder-lead sentence;
  - the FullCalendar tab-loop paragraph.
- **`MailClient.tsx`** (import block: round 9's `useSenderMessages`/`useStartupSync`/... vs reader-focus's `ReaderToolbar`/`useReaderFocus*`; keep both), **`lazyAdmin.dom.test.tsx`** (take reader-focus's `act`-wrapped retry) and **`playwright.qa-round2.config.ts`** (testMatch: keep both `qa-admin-self-grant` and `qa-reader-focus`). These three come from round 9 vs reader-focus, not from this branch. build-info's report already records them on 98b4301 vs e7d00ee, and `deff0b5` resolves them.

**`origin/fix/sidebar-views-row` 94f1a31:** clean (tree `a5b8f9d`). `ShellSidebar.tsx` and `Shell.dom.test.tsx` auto-merge. Leaf parity holds in the result.

**`origin/feat/i18n-slice3` 7c05ea6:** 2 conflict files, tree `d35af0a`.
- **`lib/i18n/catalogs.test.ts`, 1 hunk at the end of the file:** this branch's "reminder leads …" test vs slice3's "generated correspondence …" / "DeepL language names …" tests. Keep both blocks.
- **`tests/browser/compose/qa-compose.spec.ts`:** pre-existing; the same conflict occurs for `e70c30b` and `2136d48` vs slice3, so it is not caused by this branch.
- `messages/*.json` auto-merge with leaf parity (1,556/1,556).
- slice3's new `t("close")` calls are in its own namespaces, not the removed `Shell.status.close`.

**`perf/rrule-lazy` 46bdb7d** (local, newest; `origin/perf/rrule-lazy` = `122ca69` is its ancestor): 1 conflict, tree `14c6440`.
- **`app/components/mailclient/status/UpcomingStatusPopover.tsx`, 1 hunk, import block.** This branch's `import { buildUpcomingEntries, reminderLeadUnit, type UpcomingEntry } from "./upcomingEntries"` vs rrule-lazy's `import { buildUpcomingEntries, type UpcomingEntry }` + `import { useRecurrenceSummaryBuilder, type RecurrenceSummaryBuilder } from "@/app/components/calendar/useLazyRecurrence"`.
- Resolution: keep this branch's line and add rrule-lazy's `useLazyRecurrence` import. A draft resolution was checked: the rest of the file auto-merges, rrule-lazy's `formatCalendarEventRange`-only `@/lib/calendar` import and its `buildEntryRecurrenceSummary`/`useRecurrenceSummaryBuilder` coexist with `reminderLeadUnit` at the lead line, and the trimmed radix/lucide imports from a424924 stay consistent.
- The `messages/de.json` conflict from the a864dfc pre-check no longer occurs, because both sides now contain round 9. The new conflict comes from 4212f6b (reminder lead).
- Watch after merging: typecheck, and that the Demnächst recurrence line ("Wiederholung: …") still renders once the lazy summary loads.
- Branch not merged.

## Observations (not changed)

- `CalendarPopover.tsx` (floating panel) has no caller on this branch. build-info's `triggerTitle` change is therefore dead code here; removing the component is a separate decision.
- The desktop embedded Fehler section still shows its own small "Fehler" heading + clear icon under the section heading "Fehler (n)" (unchanged; the r3 finding was phone-only).
- The empty entries in `r4-calendar-tab-loop.json` are FullCalendar's prev/next icon buttons. The walk records only `aria-label` or text, and FullCalendar names these buttons through `title`. That is a limitation of the record, not a finding.

## Cleanup

- **Servers:** all browser runs used the repo runner. It stopped its own process group and fixtures by PID (`QA cleanup … serversStopped: true, scratchRemoved: true`). Ports 3880–3883 are free.
- **Files:** `public/build-version.json` restored. `.next` and `.tmp` removed.
- **Untouched:** `.env.local`, other worktrees, data dirs, services.
- **Worktree:** clean at `3e04c9f`.
- No push, PR, deploy or service restart.
