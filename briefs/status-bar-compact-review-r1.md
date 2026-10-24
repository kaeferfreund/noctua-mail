**FIX — hold merge and interim preview deployment until the two P2 calendar regressions are fixed.**

Reviewed `7a968871` (`bbcec12` + validation commit), against `11dc3c5`, in the clean detached `wt-review-auth` checkout. No P1 findings. Gates pass apart from the established lint baseline; they do not cover the failing calendar interactions.

**Findings**

- **P2 — calendar grid collapses; events cannot be opened.** [BottomStatusBar.tsx:95](/home/monkey/code/noctua-mail/wt-review-auth/app/components/mailclient/status/BottomStatusBar.tsx:95), particularly the browser mounted at line 102. Repro: open the status indicator → Demnächst → Kalender öffnen, or visit `/?openCalendar=1`. The new `space-y-3` wrapper supplies no bounded height to `CalendarView`, which uses FullCalendar `height="100%"`. At 1280×900, `.fc-view-harness` is **0 px**, versus **571.33 px** in the baseline floating calendar. The new mobile calendar also measures **0 px** at 390×844. A synthetic event is stored successfully, but clicking it times out because calendar/background elements intercept the click. Baseline creation and event opening both pass. **Fix:** restore a bounded calendar container and continuous flex/min-height sizing, reusing the existing calendar frame pattern. Verify actual event clicks at desktop and mobile sizes. Evidence: `calendar-layout.log`, `calendar-layout.png`, `calendar-production.log`, `calendar-baseline.log`, `mobile-complete.log`.
- **P2 — new-event dialog is painted behind the status popover.** [BottomStatusBar.tsx:138](/home/monkey/code/noctua-mail/wt-review-auth/app/components/mailclient/status/BottomStatusBar.tsx:138). Repro: open the calendar as above, then click **＋ Event**. The composite popover inherits z-index **9998**; the existing Radix Themes dialog overlay is **9995** ([globals.css:351](/home/monkey/code/noctua-mail/wt-review-auth/app/globals.css:351)). The popover covers the dialog title, title input, and upper schedule fields. At 1280×900 the popover occupies `(348,50,864,446.89)` and covers the title input around `(405,228,470,30)`. Programmatic filling can create an event, but the visible form is obstructed. The baseline dialog renders correctly above its calendar. **Fix:** place this composite calendar/status surface below dialogs using the existing layer scheme; keep dialog child pickers above their dialog. Verify creation/editing and focus restoration. Evidence: `calendar-layer-confirmed.png`, `layers.log`, `baseline-calendar-create.png`.
- **P3 — move review screenshots to the established evidence location.** [doc/SHELL.md:40](/home/monkey/code/noctua-mail/wt-review-auth/doc/SHELL.md:40) points to 12 committed PNGs under `doc/screenshots/status-indicator/` (**1,423,970 bytes**). These are run-specific review evidence; previous rounds kept it under `briefs/` on the docs branch. Move the PNGs and bulky capture JSON there and update the links; retain a concise durable validation summary in SHELL.md. This does **not** block merge by itself.

**Behavior, routing, and i18n**

- Real synthetic IMAP failure: changed the isolated fixture account to dead loopback port 9. Observed syncing, retries 1/2, then **attention with badge 1 at retry 3**, without auto-opening. Details showed `QA Shared / INBOX`, retry 3/10, progress, and an absolute timestamp, with no raw account/job IDs. Restored port 3888; retry and recovery completed. A separate targeted probe verified the retry button issues a full-sync POST for the same folder (`retry-wiring.log`).
- A synthetic failed request appeared in **Fehler** with its timestamp; clearing errors restored idle (`exception.log`). Keyboard opening, Escape/focus restoration, outside-click dismissal, and external focus dismissal passed. Desktop footer and clock are absent.
- Desktop section routing and PWA flag consumption passed. Mobile process/mail-check/errors/reminders/calendar routes all open the corresponding Sheets; the PWA route preserves unrelated query/hash state. The calendar sidebar toggle is reachable through Demnächst and opens the sidebar. Actual production state call sites are PWA calendar opening and error-notice exception opening; other section selections come from the shared indicator/menu. Alias normalization is covered by DOM tests. Reminder entries retain their existing source-message/calendar-sidebar handlers.
- Mobile list geometry and Sheet framing remain unchanged; the calendar content regression is covered by P2 above. Reminders can require two Escape presses on **both** baseline and final; explicit close works. This is not a new finding.
- All **57** new de/en leaf keys exist, catalog parity/ICU checks pass, German uses du-form and the documented terminology. Background tasks resolve mailbox/folder names. Existing English calendar internals remain outside this string migration.

**Independent density measurements**

Fresh screenshots of actual `11dc3c5` and `7a96887`; all desktop viewports are 900 px high. Widths are CSS pixels; list usable width excludes padding and scrollbar.

| Viewport/theme | Pane gutter before → after | List usable width | Reader width | Pane height |
| --- | --- | --- | --- | --- |
| 1280 light | 16 → 0 | 342 → 374 (+32) | 540.56 → 570.14 (+29.58) | 776 → 836 (+60) |
| 1280 dark | 16 → 0 | 342 → 374 (+32) | 540.56 → 570.14 (+29.58) | 776 → 836 (+60) |
| 1024 light | 16 → 0 | 235 → 266 (+31) | 392.08 → 421.66 (+29.58) | 776 → 836 (+60) |
| 1024 dark | 16 → 0 | 235 → 266 (+31) | 392.08 → 421.66 (+29.58) | 776 → 836 (+60) |

Final list padding is **12 px**; reader padding **16 px**. Pane borders/radii/shadows are removed; the separator is a single **1 px**, with an **11 px** pointer target. Keyboard resizing passes. The 60 px height gain consists of 32 px density plus 28 px footer removal. Header rectangles are identical, and the outer 8 px shell inset remains.

At 390×844 both revisions have header `(0,0,390,48)`, list pane `(0,48,390,796)`, 8 px list padding, and usable list width 359 px; no horizontal overflow. The five desktop custom properties (`--shell-gutter`, pane x/y, reader x/y padding) are defined together in ShellPanes.module.css and consumed by the pane modules; mobile fallbacks remain scoped separately.

The committed browser spec passes thread-header/collaboration/inline-compose style checks, notice right-offset alignment, keyboard resizing, and detached-reader isolation. Additional probes confirm detached calendar and composer windows have no shell pane tokens or `#noctua-panes`; detached calendar grid height is 658.33 px. Evidence: `own-density-{baseline,final}.json`, `baseline-*.png`, `runtime-*.png`, `focus-complete.log`.

**Gates rerun**

| Gate | Result |
| --- | --- |
| `bun run typecheck` | Exit 0; 0 errors, 1,197 files |
| Status + Shell + MobileFrames DOM suites, three repetitions | 147 passes, 0 failures, 570 assertions |
| Broader status/shell selection, three runs | 67 passes/run, 0 failures |
| Progress + catalog suites | 16 passes, 0 failures, 3,732 assertions |
| `nice -n 15 timeout 1800 bun run test:ci` | Exit 0; 2,806 server tests / 304 files / 15,507 assertions / 391.53 s; 487 DOM tests / 59 files / 2,758 assertions / 78.05 s |
| `timeout 600 bun run lint` under nice 15 | Exit 1; established 1 error (`useCalendarConflicts.ts:58`) + 25 warnings, no new findings |
| `nice -n 15 timeout 1200 bun run build` | Exit 0; optimized compilation 30.5 s, type checking and standalone preparation pass |
| Committed `qa-status-indicator.spec.ts`, port 3886 | 4 passed, 0 failed, 23.6 s |
| Additional interaction probes | Two confirmed P2 failures above; retry wiring, exception clearing, all mobile routes/PWA, external focus, detached calendar/compose checks pass |
| `git diff --check 11dc3c5..HEAD` | Pass |

Failed exploratory probes and corrected locator/timing assumptions remain in the evidence directory; they are not counted as product findings. The calendar failures were reproduced separately in production and compared with the baseline.

**Merge notes after successful `git fetch origin`**

Commands: `git merge-tree --write-tree <remote-ref> 7a96887`. No conflict resolutions were applied.

- **integration/stage — `11dc3c5`: clean**, exit 0; tree `b6f14915cc195959a99f088930461be2ed7b84bd`.
- **fix/i18n-views — `992b220`: six conflict files**, exit 1:
  - `status/BottomStatusBar.tsx`, 2 hunks: imports; old translated footer/mobile implementation versus the new unified owner. Keep the compact owner and reconcile its translation keys.
  - `status/ProcessStatusPopover.tsx`, 2 hunks: imports; former progress formatter/rendering versus named scopes/retries/embedded content. Preserve the new behavior and consistent localized phase/mode keys.
  - `status/ExceptionStatusPopover.tsx`, 5 hunks: imports, locale declaration, frame/trigger title, heading, empty state. Keep embedding, absolute timestamps, and the new namespace consistently.
  - `status/UpcomingStatusPopover.tsx`, 11 hunks: locale imports/type, delete-error key, frame/trigger/heading/close keys, source/calendar labels, duration/lead/repeat parameters, empty state. Match code and ICU placeholders; preserve shared handlers.
  - `messages/de.json`, 1 hunk, and `messages/en.json`, 3 hunks: incompatible Shell.status shapes/phase-mode names plus neighboring refresh/topic-picker additions. Merge the key sets deliberately; retain unrelated i18n additions and rerun catalog parity.
  - MailClient/useSearchState auto-merge; rerun integration behavior after resolving catalogs/components.
- **feat/sender-identities-3 — newer head `e63a306`**, exit 1; four conflict files:
  - `account-settings/tabs/PreferencesTabContent.tsx`, 2 hunks: ReactNode/i18n imports; sender-preferences conditional signature UI versus translated signature label. Preserve both the conditional behavior and translations.
  - `lib/mail/resyncMessage.senderKey.test.ts`, 2 hunks: competing subprocess-isolation helpers/first case; second-case registration. Select one isolation mechanism and retain both real-IMAP assertions.
  - `messages/de.json` and `messages/en.json`, 2 hunks each: sender Settings additions versus localized settings structure; sender Compose/Errors/Admin additions versus the expanded existing catalogs. Merge leaf keys, retaining status keys and parity.
  - MailClient auto-merges. Preferences/resync conflicts reflect divergent branch ancestry; this status diff does not edit those files.
- **feat/reader-focus: absent** from fetched remote refs; comparison unavailable.

Raw merge output and conflict-marked blobs are retained in the probe directory.

**Execution record**

Evidence: `/home/monkey/code/noctua-mail/briefs/status-bar-compact-regressions-r1/`. Builds/tests ran in disposable source copies there; the reviewed checkout remains clean at `7a968871`. The existing `.env.local` was not read or printed. Synthetic accounts/data only; owned servers used 3886/3887 and fixture ports 3888/3889, all stopped by recorded PID. Fixture IMAP port restored to 3888. No push, deployment, or other-worktree changes.

Collaborative preview failed with `ERR_CONNECTION_REFUSED`, then `Preview automation open timed out after 660000ms.` Browser verification used the repository's Playwright workflow. Dev-mode mailbox routes returned HTML 404s; production fixtures worked, so behavior conclusions above use production builds.

Load average (1/5/15 min): **start 15.77 / 19.06 / 21.63** at 10:04:44 UTC; **end 15.24 / 12.64 / 15.25** at 10:23:53 UTC, 2026-10-23. Heavy processes used nice 15.
