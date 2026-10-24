**PIN — pin `a864dfc` as the integration input.** Both r2 findings are closed: the phone calendar's week/day controls are reachable at 320 px, and the z-index ladder is now centralized as layer tokens. No P1 or P2 finding was found in the branch. Three P3 follow-ups remain. None of them was introduced by the round-3 commits, and none blocks integration. Before the combined tree is deployed, resolve the merge conflicts listed below and verify the result. This review does not certify an unbuilt merge result.

Reviewed the clean detached `/home/monkey/code/noctua-mail/wt-review-collab` at `a864dfc750fe7c6dfdffbb254e980925f9716180`. Round-3 diff: `5809d89..a864dfc` (16 files: `2ae681e` phone calendar frame, `ee60d26` layer tokens, `a864dfc` record). No tracked file was modified and nothing was committed.

How the review ran:
- The candidate gates, build and Playwright runs used the worktree itself. All generated files (`.next`, `.tmp`, `next-env.d.ts`) are gitignored and were removed at the end.
- The baseline `11dc3c5` was built from a `git archive` under `wt-review-collab/.tmp`, with copied dependencies.
- All heavy commands ran at nice 15, probe servers at nice 10.
- Ports: app 3895 (candidate) and 3896 (baseline); synthetic IMAP/SMTP/control fixtures 3897/3898/3899. Synthetic data only.
- `.env.local` was not edited. Process-env overrides set the data dir, auth URL and secrets.
- `ROOT/data/noctua-data-review-collab` and `noctua-data-dev` were not touched, and neither were the noctua-dev or noctua-fixture services.

## Findings

All three are **P3** and none blocks integration. Ranked:

1. **P3: the desktop calendar popover loses keyboard focus when you Tab past the last event.**
   - **Where:** [BottomStatusBar.tsx:141](/home/monkey/code/noctua-mail/wt-review-collab/app/components/mailclient/status/BottomStatusBar.tsx:141) (`PopoverContent`, calendar mode).
   - **Repro:** 1280×900 → `/?openCalendar=1` → focus ＋ Event → Tab. Focus goes ＋ Event → prev/next → month/week/day → each event link → the Radix focus-guard `span` → `<body>`. The popover then closes; `calOpen` goes from 1 to 0 on the next Tab. Focus is neither kept in the popover nor returned to the indicator, so the next Tab starts again at "Neue E-Mail".
   - **Cause:** FullCalendar's day-number `<a>` elements have no `href` but report `tabIndex 0`. Radix FocusScope therefore takes "November 1, 2026" as the last tabbable element. The browser skips that element, so the loop never triggers. In section mode, without the calendar, Tab loops correctly (Neue E-Mails abrufen → … → Demnächst → Neue E-Mails abrufen).
   - **Baseline:** on `11dc3c5` the floating calendar stays open and focus continues into the page.
   - **Introduced:** with the popover calendar in `bbcec12`, not in round 3.
   - **Fix direction:** keep focus contained while the calendar is open, or restore focus to the indicator when a focus-out closes the popover. Choose one consistent behaviour and cover it with a keyboard test.
   - **Evidence:** `json/tabout.json`, `json/keyboard.json`, `png/tabout-candidate-1280x900.png`.

2. **P3: phone status sheets have an inconsistent heading hierarchy.**
   - **Where:** [StatusPanelFrame.tsx:30](/home/monkey/code/noctua-mail/wt-review-collab/app/components/shell/StatusPanelFrame.tsx:30) puts the description before the panel children. The only `SheetTitle` is `sr-only`.
   - **Repro:** 390×844 → indicator → each menu entry.
     - **Hintergrundaufgaben:** there is no visible heading. The sheet shows the description, then a text "Schließen" button ([ProcessStatusPopover.tsx:48](/home/monkey/code/noctua-mail/wt-review-collab/app/components/mailclient/status/ProcessStatusPopover.tsx:48)), then "Keine laufenden Hintergrundaufgaben."
     - **Demnächst / Fehler:** the description appears above their own title row ("Demnächst 0 ×", "FEHLER ×").
   - **Baseline:** `11dc3c5` shows a visible "Processes 0 ×" header.
   - **Accessibility:** accessible names are correct, so this is visual and copy hierarchy only.
   - **Fix direction:** one visible title row per sheet (title, count, icon close), then the description.
   - **Evidence:** `png/sheet-candidate-Hintergrundaufgaben.png`, `png/sheet-baseline-Processes.png`, `png/sheet-candidate-Demnaechst.png`.

3. **P3: German copy.**
   - **Reminder lead:** `Shell.status.reminderLead` = "Erinnerung: {minutes} Minuten vorher" ([de.json:203](/home/monkey/code/noctua-mail/wt-review-collab/messages/de.json:203), used at [UpcomingStatusPopover.tsx:369](/home/monkey/code/noctua-mail/wt-review-collab/app/components/mailclient/status/UpcomingStatusPopover.tsx:369)). The existing lead options produce "Erinnerung: 0 Minuten vorher" (at start), "60/120 Minuten vorher" and "1440 Minuten vorher" (day before).
     - Context: the baseline printed the English label plus " before" ("Day before before"), so this is an improvement. Doc/I18N.md also defers reminder lead labels to calendar localization.
     - Suggested wording: "Zu Beginn", "1 Stunde vorher", "1 Tag vorher".
   - **Calendar sheet title:** the phone calendar Sheet title is the action label "Kalender öffnen" ([BottomStatusBar.tsx:133](/home/monkey/code/noctua-mail/wt-review-collab/app/components/mailclient/status/BottomStatusBar.tsx:133)). A noun title ("Kalender") would read better. The DOM test pins the current dialog name.
   - **Everything else is fine:** the remaining status copy uses du-form and the terminology table (Postfach, ` …` with a space). The English catalog's `threads` reads "Recomputing threads…" without the space; English only.

### Pre-existing observations (also on `11dc3c5`, outside this branch's scope)

- **Calendar event deletion fails in the UI, and this is the most significant item here.**
  - Symptom: in the event detail panel, "Delete event" shows "Failed to delete event."
  - Where: [useEventDeleteState.ts:132](/home/monkey/code/noctua-mail/wt-review-collab/app/components/calendar/useEventDeleteState.ts:132) sends a bodyless `DELETE` without a content type. [requestOrigin.ts:37](/home/monkey/code/noctua-mail/wt-review-collab/app/api/_helpers/requestOrigin.ts:37) treats a non-null `request.body` as a JSON request.
  - Result: under this production runtime the server answers `400 {"code":"json_required"}`. Reproduced identically on candidate and baseline (`json/delete.json`).
  - Recommendation: open a separate ticket. It is unrelated to the status bar.
- **Notices under the calendar surface:** with the sidebar collapsed, the floating error notices (stack z-index 60) partly sit under the calendar surface (9990). Their right-hand dismiss control is not hit-testable while the calendar is open. The baseline floating calendar covers them more (x 210–1070 against 348–1212). With the sidebar open, notices go to the sidebar and are fully clickable. Evidence: `json/notice-overlap.json`, `png/attention-collapsed-1280x720-light-calendar-open.png`, `png/notice-overlap-baseline-1280x720.png`.
- **Two Escapes on two phone sheets:** the phone Demnächst/Fehler sheets need two Escapes. The sheet auto-focuses an icon button whose Radix Themes tooltip opens first. The baseline behaves the same ("Close upcoming", "Clear exceptions"). Evidence: `json/upcoming2.json`, `json/upcoming2-baseline.json`.
- **Desktop Escape order:** after using the clock picker, Escape goes picker → tooltip → dialog → popover, exactly as r2 recorded on `11dc3c5`. Focus returns to ＋ Event, then to the indicator.
- **Tablet popover position:** at 768/834 px the 54rem calendar popover is shifted flush to the left viewport edge (x=0), because Radix collision handling with zero padding moves it. This is cosmetic and unchanged since r2.
- **Mobile menu row height (not compared with the baseline):** the phone status dropdown menu items measure 27–28 px high, while the indicator itself is 44×44.

## Per-r2-finding result

| r2 finding | Result |
| --- | --- |
| **P2: week/day unreachable at 320 px** (BottomStatusBar.tsx:105/:134) | **Fixed.** Original repro at 320×844: Kalender öffnen; the phone frame is `data-calendar-frame="phone"`, client 288 = scroll 288. The day button is at x=260–304, inside the frame's right edge at 304; r2 measured 341.53. A horizontal wheel leaves every control in place because nothing is clipped. All seven toolbar controls are inside the viewport, at least 44×44 px, and win `elementFromPoint` at their centre. Checked at 320×844, 320×568, 360×780 and 390×844, light and dark. Week, day and month were switched with raw mouse clicks: 7 columns (1 in day view), all inside the viewport, no page or frame horizontal overflow. The only scroll-width excess is `fc-event-title` ellipsis text and `sr-only`. Harness height is 548 / 272 / 536 / 600 px. The last month row is reachable by user wheel scrolling and hit-testable. Event detail at 320×844: the panel body scrolls (595/1414 px), and Edit/Delete come into view and are hit-testable after wheel scrolling. The in-calendar "Event created." notice is visible and hit-testable inside the Sheet at 320×568 and 390×844. The spec's own 320×500 keyboard-height case passes 3/3. Evidence: `json/phone.json`, `json/notice.json`, `png/phone-*.png`, `png/notice-320x568-light.png`. |
| **P3: layer values not centralized** (BottomStatusBar.module.css:3) | **Fixed.** `:root` defines `--layer-floating/dialog/dialog-overlay/popper/drag-ghost` = 9990/9994/9995/9998/9999. The status surface, floating calendar, compose modal, Radix lifts and shadcn primitives (`z-(--layer-*)`) read them, and `globals.test.ts` asserts the order and the `dialogLayers.ts` mirror. Computed at runtime: tokens 9990/9994/9995/9998/9999; status popover 9990 < event-dialog overlay 9995 < time-picker popper 9998; mobile Sheet 9994; user menu 9998; settings overlay 9995 with its select popper 9998 (hit-testable); `.drag-ghost` 9999 on a real `dragstart`. A repo grep finds no remaining hard-coded 999x z-index. |

## Regression scan (candidate a864dfc)

- **Desktop popover**, 834×1112, 1280×720, 1440×900 and extra 768×1024, light/dark:
  - `isMobile` is false from 768 px up. The popover lies within the viewport. All four sections expand, and the content is translated.
  - Calendar: every control lies inside the popover and wins hit testing in month, week and day view. No horizontal overflow.
  - Harness heights: 570 (834), 246 (1280×720), 426 (1440×900) and 550 (768) px.
  - At 1280×720, 1366×768 and 1280×800, the month grid scrolls inside FullCalendar's own scroller, and the last row becomes reachable by wheel scrolling (`json/short.json`).
  - Event dialog: the title input wins hit testing. Visible time-picker options are hit-testable and selectable at 1280×720, 834×1112 and 320×568 (`json/picker.json`).
  - Evidence: `json/desktop.json`, `png/desktop-*.png`.
- **Keyboard only, desktop**, 1280×720 and 1440×900:
  - The indicator is reached after the search field and Suchfilter (30 Tabs from the page start). Enter opens the popover with focus on "Neue E-Mails abrufen", and Tab cycles the five section controls.
  - Escape closes the popover and focus returns to the indicator.
  - Keyboard route Demnächst → Kalender öffnen works. In the calendar, Tab order is ＋ Event, prev, next, month, week, day, then events. The tab-out problem is Finding 1.
- **Phone menu**, 320×568, 360×780, 390×844, light/dark:
  - Indicator 44×44 px; no header or page overflow. The menu is inside the viewport.
  - Every entry (Hintergrundaufgaben, Posteingangsprüfung, Demnächst, Fehler (0), Kalender öffnen) opens a z 9994 Sheet that is inside the viewport and hit-testable, with no horizontal overflow.
  - Escape closes it (two presses for Demnächst/Fehler, pre-existing) and focus returns to the indicator.
  - Evidence: `json/mobile.json`, `png/mobile-*.png`.
- **States:**
  - **Idle:** activity icon, 28 px wide.
  - **Syncing** (an observed real sync, made long enough to inspect by delaying routes): spinner plus "Synchronisiert …" on desktop (142 px), icon only on phones. The Hintergrundaufgaben section shows "QA Shared / INBOX · Wird vorbereitet" while syncing and "Keine laufenden Hintergrundaufgaben." afterwards.
  - **Attention** (sync routed to 500): amber badge "10"; label "10 Hinweise erfordern deine Aufmerksamkeit". Opening the popover lands on "Fehler (10)". "Alle Fehler löschen" returns the indicator to idle.
  - Evidence: `json/syncing.json`, `json/attention*.json`, `png/state-*`, `png/attention-*`.
- **Density versus 11dc3c5:** fresh production measurements on the same fixture give the same geometry in light and dark.
  - 1280×900: footer 28 → 0; list usable width 342 → 374 (**+32**); reader 540.56 → 570.14 (**+29.58**); pane height 776 → 836 (**+60**).
  - 1024×900: list 235 → 266 (**+31**); reader 392.08 → 421.66 (**+29.58**); pane height **+60**.
  - 390×844: unchanged (list 359, height 796).
  - Header stays 48 px. This matches r2.
  - Evidence: `json/density-gains.json`, `json/density-metrics.json`.

## Gates

| Gate | Result |
| --- | --- |
| `bun run typecheck` | Exit 0; no type errors in 1,200 files (0.73 s). |
| `nice -n 15 timeout 1800 bun run test:ci` | Exit 0, first attempt, 550 s. Server: **2,816 pass / 0 fail**, 17,004 assertions, 305 files, 472.45 s. DOM: **497 pass / 0 fail**, 2,886 assertions, 60 files, 73.62 s. |
| `bun run lint` | Exit 1: **1 error / 25 warnings**, all in the established baseline (`useCalendarConflicts.ts:58` error; MailClient.tsx 21 warnings on both `11dc3c5` and `a864dfc`). The r3-touched TS/TSX files lint clean, so **0 new**. |
| `bun run build` (candidate) | Exit 0; compiled in 57 s, TypeScript 36.6 s, 99 s total. |
| `bun run build` (baseline 11dc3c5 archive) | Exit 0; compiled in 35.4 s, 81 s total. |
| Branch Playwright spec `qa-status-indicator.spec.ts` ×3 (production build, port 3895, fixtures 3897–3899) | **11/11, 11/11, 11/11** (33/33); 86 / 76 / 68 s. The desktop density test reads the implementer's `round3/baseline-metrics.json`, copied in unchanged; density was re-measured independently above. |
| `git diff --check 5809d89..a864dfc` and `11dc3c5..a864dfc` | Exit 0. |
| Independent probes | Phone matrix 8/8 combinations; desktop matrix 8/8; mobile menu 6/6; keyboard 2 runs (Finding 1); states; notices 4/4; layers; density 6/6. |

Exploratory probe failures are kept as `FAIL-*` captures in the scratch area and are not counted as passes. All were causes in my probe scripts, corrected and rerun:
- the delete step hit the pre-existing `json_required` bug;
- the two-Escape phone sheets;
- an exact-URL route that did not match the sync launch;
- a pointer outside the grid during the short-viewport wheel test.

`json/states.json` holds the superseded first attempts of the state probe; the final state results are in `json/syncing.json` and `json/attention*.json`.

## Merge-tree (`git merge-tree --write-tree`, nothing written to refs)

`git ls-remote` confirms that `origin/feat/reader-focus` = `ccddc4d` and `origin/feat/status-bar-compact` = `a864dfc` are current. `98b4301` is the local round-9 candidate (`integration/stage`).

**vs 98b4301 (round-9 candidate): 1 file / 2 hunks, `messages/de.json`.** Tree `5d96a4ae87ec3cf967a702ecdc216c4234f589e9`. Auto-merged: MailClient.tsx, Compose.module.css, UpcomingStatusPopover.tsx, useSyncController.ts, MobileFrames.module.css, en.json.
- **Hunk 1 (`Shell.status` leaves):** keep a864dfc's compact schema (`folder`, `scope`, `retry`, …, `process`/`mailCheck`/`exception`/`reminder`/`phase`). Drop 98b4301's obsolete footer leaves (`syncingScope`, `syncRetryScope`, `syncingFolders`, `syncingMailbox`, `openSource`, `openCalendar`, `deleteReminderFailed`, `reminderBefore`, `upcomingSummary`, `phases`). The auto-merged en.json already has only the compact schema (`mode`/`phase`).
- **Hunk 2 (`mode`):** keep the `mode` object plus `updatedAt`/`calendarEvent`. Carry over the reviewed i18n-views wording so all four modes read alike: `recent` "Synchronisierung der letzten Nachrichten", `new` "Synchronisierung neuer Nachrichten", `repair` "Reparatursynchronisierung" (`full` stays "Vollständige Synchronisierung").
- **Auto-merged `lib/i18n/catalogs.test.ts`:** lines 122/125/130 still assert `Shell.status.modes.recent`, `upcomingSummary` and `syncingFolders`, which do not exist after the resolution. Update them to the live schema: assert `Shell.status.mode.recent` with the chosen wording, and drop or replace the two footer-only assertions. Do not keep dead keys just to satisfy the test.
- Keep every other newer i18n, sender and admin leaf from 98b4301. Reconcile `doc/I18N.md`, then rerun the catalog, status/Shell DOM and browser suites.

**vs origin/feat/reader-focus `ccddc4d`: 2 files / 2 hunks.** Tree `656b9c335d03611cb56e8c3a942d30fbbbb4bb97`. Auto-merged: MailClient.tsx, MessageViewPane.module.css, ShellPanes.tsx/.module.css, de/en.json.
- **`app/components/shell/AppShell.tsx` (1 hunk):** take reader-focus's `toolbar={(isMobile && navigation.view === "thread") || (!isMobile && panes.readerLayout === "focus") ? undefined : header.toolbar}` together with compact's `indicators={statusBar}`. Do not take reader-focus's `isMobile ? statusBar : undefined`; that would remove the desktop status, because the footer render is already gone in the auto-merge. Keep compact's `styles.workspace` class and reader-focus's `onReaderNavigate`.
- **`doc/SHELL.md` (add/add, 1 hunk):** combine both documents, the "Mail shell and reader layouts" section and the "Shell / Status indicator" sections, including round-2 and round-3 records.
- After combining, verify:
  - focus layout with density tokens: the `[data-reader-layout="focus"]` list/splitter hiding, plus compact's 1 px `.separator`, `p-4` versus `--shell-gutter`;
  - the header status in focus mode;
  - notices and print;
  - the reader-focus browser spec.

## Evidence

Under `/home/monkey/code/noctua-mail/briefs/status-bar-compact-regressions-r3/`:
- `png/`: 30 PNGs, each ≤ 145 KB;
- `json/`: probe results;
- `logs/`: typecheck, lint, full CI log and summary, both build logs, the three spec runs (fixture IDLE noise filtered out), merge-tree outputs and conflict-marked blobs;
- `probes/`: probe and driver scripts.

The directory also held an earlier, interrupted r3 attempt (12:20–12:26 UTC): about 3.2 GB of source-archive copies including `node_modules`/`.next` and a scratch clone. Following the r2 convention (remove temporary dependencies and builds), those trees were removed. That attempt's logs, merge logs and its de.json resolution and catalog-assertion diffs were kept under `prior-attempt/`. It did not touch ROOT/repo refs or worktrees. The evidence directory is now 2.7 MB.

Load at the start was 5.46 / 3.64 / 3.30 (13:26:42 UTC); at the end 11.33 / 10.50 / 10.22 (14:09:31 UTC), with other sessions active on the host.

Cleanup:
- **Processes:** the owned probe launcher (PID 3618716) and its app process groups 3618841 and 3619067 were stopped by PID. The three spec runs cleaned up their own server groups and fixtures.
- **Ports:** 3895–3899 are released.
- **Scratch:** `wt-review-collab/.tmp`, `.next` and `next-env.d.ts` were removed.
- **Worktree:** clean at `a864dfc` (`git status --porcelain` is empty; only the pre-existing ignored `.env.local` remains).

No commit, push, PR, deploy, service restart, credential change or other-worktree change was made.
