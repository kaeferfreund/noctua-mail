# UI/UX QA re-sweep — 9424150

Read-only source QA performed 2026-10-23 UTC against `9424150f5aa0a446ed9bc03ed199e6825129467d`, branch `qa/ui-sweep-9424150`, in `/home/monkey/code/noctua-mail/wt-qa-sweep2`.

**All 14 original reproduction cases pass. Three additional findings: 0 P1, 2 P2, 1 P3.** “FIXED” below is scoped to each original reproduction case. The initial unread-count case and Invites breakpoint case pass, while related expanded cases still fail (QA-101 and QA-102). “New” means newly reported in this sweep; introduction at this commit is not established unless stated.

## Setup and coverage

Read the original [435ba5d sweep](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d.md), repository AGENTS.md, authentication contract, TEAM-INBOX UI shell requirements, DEV-FIXTURES and I18N documentation. Copied tracked source into `.tmp/build`, ran `nice -n 15 bun run --cwd .tmp/build build`, and served `.next/standalone/server.js` with copied `.next/static` and `public`. Compilation, TypeScript and page generation passed. The build's `noctua-server.mjs` and rewritten launcher require were present as expected. No graceful-restart tests were run.

App: loopback 3870; Playwright browser service: 3871; owned fixture: 3872 IMAP / 3873 SMTP / 3874 control. `TMPDIR`, browser profiles, isolated auth/database storage, source copy, logs and SMTP outbox stayed under the worktree's `.tmp`. `NOCTUA_DATA_DIR` was overridden to `.tmp/qa-shell-data`, matching the previous sweep's stricter write-boundary approach. Watcher enabled. No external mail server or port 3790 was used.

Initial fixture: 330 synthetic messages, 300 in INBOX with 110 unread, including 240 added messages, a 14-message conversation, long subjects, non-ASCII text, HTML and PDF/PNG/calendar fixtures. Two logical mailboxes use the fixture's single IMAP identity: QA Private (Alex only) and QA Shared (Alex manager, Jo editor). This is not a two-account IMAP isolation test. Repository auth helpers provisioned and enrolled Alex/Jo; browser sign-in used real production TOTP and later a virtual UV passkey. Later sends/injections intentionally increased the fixture counts.

All five requested sizes (1440×900, 1280×720, 834×1112, 390×844, 360×780) were rendered in light and dark. The matrix covered login, shell/list, four Admin sections, Create mailbox naming, and all ten manager Settings tabs. There were 40 successful Admin section render checks; nine Settings tabs rendered in all ten configurations, while Translation failed in all ten. Original compose and reader reproductions used their exact desktop/phone sizes and themes. Mutations were targeted, rather than repeated in every matrix cell. Playwright used `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-arm64` and nice priority.

Desktop keyboard passes covered login/TOTP, compose entry/send, the Forward modal, Admin/mailbox form, Preferences navigation and language selection, sidebar toggle, internal-note submission and security proof. Pointer operation was retained for the original nested-Admin reproduction. Mobile Back returned reader→list; browser Back dismissed the sidebar.

## Original finding verification

| ID | Original steps / expectation | Result | Measured evidence | Screenshot |
|---|---|---|---|---|
| QA-001 | 1440×900 dark: New mail; zero-delay keyboard.type("QA keyboard fixture delivery"); read after 150ms; select-all/retry; autosave and send. Entered/transmitted subject must remain exact. | **FIXED** | 5/5 initial entries, 5/5 retries, 5/5 saved subjects, 5/5 send payloads and 5/5 captured SMTP subjects matched exactly. All five sends returned 200; each produced one capture. | [rapid-subject-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/rapid-subject-1440-dark.png) |
| QA-002 | 360×780 and 390×844, light/dark: enter recipient, subject and body; wait for autosave and draft controls. Send must stay touch-reachable. | **FIXED** | 360px: Send (x=288.73, y=724, w=59.27, h=44); 390px: (318.73,788,59.27,44). Same boxes in both themes; all center hit tests passed. Footer client/scroll widths were 336/336 and 366/366px. | [compose-360-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/compose-360-dark.png) |
| QA-003 | 1440×900 dark: Settings → MCP; label “Synthetic QA token”; default 180 days; Create; inspect response/list; leave/reopen tab. One request must reveal the secret once and retain correct metadata/expiry. | **FIXED** | One POST, 201; payload ttlSeconds=15,552,000; measured expiry−creation=15,552,000 seconds. Secret visible immediately and absent on return; metadata visible both times; false failure message count=0. Screenshot taken after clearing the one-time secret. | [mcp-metadata-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/mcp-metadata-1440-dark.png) |
| QA-004 | 1440×900 dark: Admin → Mailboxes → Manage members; add enabled Jo as editor with pointer; change member/user roles through nested confirmations. Child must be visible and clickable above parent. | **FIXED** | Add member center hit test=true; pointer add, viewer confirmation and editor restoration worked. Members z-index=9996; confirmation=9997. Escape dismissed one child layer while retaining its parent. User-role Cancel worked. | [admin-member-confirm-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/admin-member-confirm-1440-dark.png) |
| QA-005 | 360×780 / 390×844 light/dark: open the four-times-repeated long subject and Internal note. Header must leave a usable reading region. | **FIXED** | Collapsed subject clamp=3. At 360px, header=312px and message region=376px (48.21% of viewport), including expanded subject. At 390px, collapsed header=322.17px/message=429.83px; expanded header=337.59px/message=414.41px (49.10%). Header scrollHeight grew to 545–567px and remained internally scrollable. | [reader-note-360-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/reader-note-360-dark.png) |
| QA-006 | Desktop light/dark, plus phone drawer: after initial 300-message/110-unread INBOX sync with IMAP stream active, compare mailbox, Inbox, INBOX and folders API; reload. Counts for the same folder must agree. | **FIXED** | Original initial/reload case passes: API INBOX count=300/unread=110; mailbox, Inbox and INBOX all 110. Subsequent reload/resync at 109 agreed. New-mail injection changed API 109→110 and folder count 300→301. Separate Mark as read drift remains QA-101 below; this result applies to the original initial/SELECT case. | [unread-initial-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/unread-initial-1440-dark.png) |
| QA-007 | Mailbox creation and compose, all sizes/themes: inspect field captions and getByLabel("Name"); inspect To/Cc/Bcc/Subject. Visible captions must provide accessible names. | **FIXED** | All 10 mailbox inputs in each of 10 configurations had valid aria-labelledby references resolving to the displayed captions (100/100). getByLabel("Name", exact)=1. Compose From/To/Cc/Bcc/Subject have associated native labels; To/Cc/Bcc/Subject remained exact under zero-delay typing. The new traversal has a separate Translation regression, QA-103. | [mailbox-dialog-direct-360-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/mailbox-dialog-direct-360-dark.png) |
| QA-008 | 1440×900 dark: Forward inline → Open in modal; focus Send, Tab repeatedly, Escape. Accessible modal/name, contained focus and dismissal required. | **FIXED** | Forward dialog has aria-modal=true. 30/30 sampled Tab destinations stayed inside. Repeated the original eight-Tab sequence: all inside, Escape removed the dialog (count=0) and focus returned to New mail. A longer sequence ending on an icon required another Escape; see execution note below. | [forward-modal-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/forward-modal-1440-dark.png) |
| QA-009 | 1440×900 dark: Settings → Preferences; after settling press Escape. Dismiss and restore opener focus. | **FIXED** | Remaining dialog count=0; active element aria-label="User menu". Keyboard Preferences navigation/language switching and dismissal also completed; nested Admin Escape behavior passed QA-004. | [settings-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/settings-1440-dark.png) |
| QA-010 | 1440×900 light: set Waiting then Closed; read computed foreground/background and calculate WCAG sRGB contrast. Normal 14px text must reach 4.5:1. | **FIXED** | Waiting rgb(79,52,34) on rgb(255,247,194)=10.47:1; Closed rgb(25,59,45) on rgb(230,246,235)=11.00:1. Both remain 14px/weight 400. All four statuses also pass in dark mode; full ratios below. | [status-light-1440.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/status-light-1440.png) |
| QA-011 | 390×844 / 360×780, both themes: measure View, Sort & group, Message actions, Search messages and Activity/calendar phone targets. Require 44×44px. | **FIXED** | All five targets measured 44×44px in all four phone configurations and stayed within viewport. At 360px their x positions were 120,168,212,256,308; at 390px 150,198,242,286,338. Active targets passed center hit tests; bulk Message actions was appropriately disabled with no selection. | [list-360-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/list-360-dark.png) |
| QA-012 | 390×844 dark: in populated INBOX search zz-no-synthetic-result-435ba5d with Current folder scope. Empty text must describe no search matches. | **FIXED** | “No messages match this search.” visible count=1; “No messages in this folder.” count=0. The populated fixture still contained hundreds of messages. | [search-empty-390-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/search-empty-390-dark.png) |
| QA-013 | 390×844 dark, prefers-reduced-motion:reduce: open sidebar and inspect computed timings. Nonessential slide motion must be suppressed. | **FIXED** | Sheet animation-name=none; animation-duration=0s; transition-duration=0s. Escape closed it. Timing is measured evidence; PNG is static context. | [reduced-motion-sidebar-390-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/reduced-motion-sidebar-390-dark.png) |
| QA-014 | 1440×900 → 390×844 dark: Admin → Invites; enter Name “Synthetic unsent invite” without issuing; resize. Destination and unsent form must survive. | **FIXED** | Close admin count 1→1; name remained “Synthetic unsent invite” at phone size and on return to desktop. A different nested mailbox form still loses state (QA-102); the original Invites steps pass. | [admin-breakpoint-390-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/admin-breakpoint-390-dark.png) |

## New findings, ranked

| ID / priority | Area; viewport/theme | Exact steps | Expected vs actual / evidence | File:line guess | Screenshot |
|---|---|---|---|---|---|
| QA-103 · **P2** | Translation Settings crashes the page; all five viewports, both themes | Sign in as manager; User menu → Settings; click Translation. No API key or network test is needed. | Expected: render Translation controls and retain the mail shell. Actual: shell is replaced by “This page couldn’t load”; Reload/Back are the only actions. Reproduced in **10/10** matrix configurations. Browser error: `Slot failed to slot onto its children. Expected a single React element child or Slottable.` The new recursive label traversal appears to turn the sole child of `Flex asChild` into an array; this causal attribution is a source-based hypothesis. | [app/components/account-settings/Field.tsx:18](/home/monkey/code/noctua-mail/wt-qa-sweep2/app/components/account-settings/Field.tsx:18); [app/components/account-settings/tabs/TranslationTabContent.tsx:113](/home/monkey/code/noctua-mail/wt-qa-sweep2/app/components/account-settings/tabs/TranslationTabContent.tsx:113) | [translation-crash-1440-light.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/translation-crash-1440-light.png); [translation-crash-360-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/translation-crash-360-dark.png) |
| QA-101 · **P2** | Unread counts drift after Mark as read; 1440×900 dark, watcher and SSE active | Start at 110 unread; open the single-message QA synthetic 014; Message actions → Mark as read. Compare API, mailbox, Inbox and INBOX. Reload; inject one unread message to restore 110; repeat on QA synthetic 015 and sample through 10 seconds. | Expected: one successful mutation produces a one-message decrement everywhere. Actual, twice: folders API and summary **110→109**, Inbox and INBOX **110→108**. In the second trial exactly **one** POST carried `{flag:"seen",value:true}`; the wrong 108 persisted at **3, 762, 1810, 5368 and 10410ms**. Mailbox badge settled at 109; Focused still said “Unread: 110”. Reload restored agreement. Likely interaction of absolute stream counts with the local delta; source attribution is a hypothesis. | [app/components/mailclient/useMessageMutations.ts:465](/home/monkey/code/noctua-mail/wt-qa-sweep2/app/components/mailclient/useMessageMutations.ts:465); [app/components/mailclient/useSyncController.ts:1203](/home/monkey/code/noctua-mail/wt-qa-sweep2/app/components/mailclient/useSyncController.ts:1203) | [unread-mark-settled-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/unread-mark-settled-1440-dark.png); [unread-after-mark-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/unread-after-mark-1440-dark.png) |
| QA-102 · **P3** | Nested mailbox form loses state at breakpoint; 1440×900→390×844 dark | Admin → Mailboxes → Create mailbox; enter Name “Synthetic unsent mailbox”; resize to 390×844; reopen Create mailbox. Repeated with keyboard-entered Name “Synthetic keyboard mailbox” and email keyboard@example.test. | Expected: nested destination and unsent values survive resize. Actual: Create mailbox dialog count **1→0**, while Close admin remains **1**; reopening gives Name **""**. Reproduced twice. Original Invites form remains preserved. Likely child remount across SettingsFrame's desktop Dialog/mobile Sheet branches. | [app/components/shell/SettingsFrame.tsx:19](/home/monkey/code/noctua-mail/wt-qa-sweep2/app/components/shell/SettingsFrame.tsx:19); [app/components/admin/AdminMailboxes.tsx:54](/home/monkey/code/noctua-mail/wt-qa-sweep2/app/components/admin/AdminMailboxes.tsx:54) | [admin-create-before-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/admin-create-before-1440-dark.png); [admin-create-breakpoint-390-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/admin-create-breakpoint-390-dark.png) |

## Regression observations and what works well

- Compose has one consistent observed value across editing, autosave, modal state and send. A further zero-delay To/Cc/Bcc/Subject trial preserved all four values through de→en, returned 200 from send and produced one local SMTP capture with its attachment. Subject “QA all fields — Grüße café”, To recipient@example.test, Cc copy@example.test and Bcc hidden@example.test matched the request. No real delivery occurred.
- Jo signed in with TOTP, saw only QA Shared as editor, and received 403 for private folders. Alex assigning the long thread to Jo changed Assigned to me **0→1**, Unassigned **257→256**, while Open stayed **257**. Closing the thread changed Open to **256**. Jo's list membership, reader status and note count updated without reload. Captured `/api/me/events` returned 200 and contained mailbox-summary and thread-collab events/revisions. Assigned to me, Unassigned and Open each added/removed the thread live under the corresponding reassignment/status changes. Notes with Markdown and non-ASCII text appeared in the other session; a second note was submitted by keyboard.
- Initial/reloaded unread totals and completed full INBOX sync were correct. A new unread fixture message changed the server total 109→110 and INBOX 300→301 in about **2.13s**; mailbox summary UI settled asynchronously. QA-101 isolates the wrong local post-mutation folder totals from that server behavior.
- Login de/en switching retained email and password; Preferences switching retained an unsaved layout selection, compose recipient/subject/body, and the active mailbox. A separate reader check preserved the header verbatim and accountId=qa-shared. Content remains mostly English by the documented first i18n slice; that is not classified as a missing-translation defect here.
- MCP token deletion via its visible Delete/confirmation flow returned 200 for both synthetic tokens; final token list count=0. A fresh viewer-role check returned 403 from MCP, hid MCP and Admin in Jo’s UI, retained `/me`=200, and exposed only Preferences, Categorization, Topics and Recipient Aliases; editor was restored with 200.
- Nested Admin pointer add/role confirmations and cancellation worked. Original Invites state survived desktop→phone→desktop. Create mailbox accessible naming works across all configurations. The nine non-Translation Settings tabs rendered without error alerts.
- Mandatory-TOTP login, virtual UV passkey registration and subsequent passkey login succeeded. Fifteen Tab steps stayed inside the identity proof dialog. An older session correctly reported “Please sign in again before changing security settings” while `/me` remained 200; the UI's fresh-login path allowed enrollment afterward.
- The invoice PDF downloaded with **200 / 1473 bytes**, beginning `%PDF-1.4`. Threads, Compact, Cards and Table layouts rendered. Synthetic remote HTML made **0** image requests before Load once and **1** afterward; that request was fulfilled locally by Playwright, so no external connection was made. HTML and synthetic attachments rendered successfully.

Computed status text contrast (14px, weight 400):

| Theme | Open | In progress | Waiting | Closed |
|---|---|---|---|---|
| Light | 5.19:1 | 5.41:1 | 10.47:1 | 11.00:1 |
| Dark | 7.67:1 | 7.22:1 | 12.98:1 | 11.45:1 |

## Limits and execution notes

- This is a targeted UI re-sweep, not a full CI/security/stress audit. No full lint/test suite was run. Successful render checks do not imply every form mutation or error branch was exercised.
- Physical mobile keyboards, Safari/iOS/PWA, real authenticators, TLS/external mail, large attachments, network failures, exhaustive sort/group combinations, destructive mailbox deletion, recovery/backup-code expiry and races, and new-user enrollment through the UI were not re-tested. Fixture auth enrollment used the repository helpers. CalDAV/DeepL connection tests, notifications and OS mailto were not invoked. Graceful restart behavior was explicitly out of scope.
- The fixture offers one IMAP identity exposed as two logical application mailboxes; independent upstream account isolation is not established. Font fallback lacks some CJK glyphs, though non-ASCII strings remained intact in DOM and send payloads.
- The original Forward eight-Tab/Escape case passed. In an additional 30-Tab trial ending on a focused header icon, the first Escape left the composer open; another focus/Escape path closed it. Tooltip-layer interaction was not fully isolated, so this is retained as an observation rather than an independently confirmed new defect.
- Transient automation mistakes (querying duplicate Radix visual text as an accessible name, racing lazy loading, reading `status` instead of `job.status`, and sending a body to a bodyless DELETE) were corrected or resumed. The isolated Playwright command driver was also restarted after an unhandled timeout from a failed strict locator; the application was not restarted. They are not application findings. The Translation page errors above are reproduced application errors.

## Artifacts and cleanup

**56 PNG screenshots**, all ≤300,000 bytes; largest **267,762 bytes**. All PNG signatures, chunk CRCs and report links validated. Screenshots omit one-time MCP secrets, TOTP codes/QRs, backup codes and recovery capabilities. Detailed synthetic measurements are preserved in [evidence.json](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/evidence.json); the machine-readable result is [verification.json](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/verification.json). Browser: Chromium 145.0.7632.0.

Only owned PIDs were stopped; none remained running. Ports 3870–3874 are free. Scratch `.tmp` was removed. No tracked file was modified; no commits, pushes, PRs, checkout/reset/stash, PRAGMA optimize or ANALYZE were performed. Worktree is clean on `qa/ui-sweep-9424150` at `9424150f5aa0a446ed9bc03ed199e6825129467d`; `git diff --check` passed. Final verification: 2026-10-23T04:19:49.848627+00:00.

## Machine-readable summary

```json
{
  "verification": {
    "QA-001": "FIXED",
    "QA-002": "FIXED",
    "QA-003": "FIXED",
    "QA-004": "FIXED",
    "QA-005": "FIXED",
    "QA-006": "FIXED",
    "QA-007": "FIXED",
    "QA-008": "FIXED",
    "QA-009": "FIXED",
    "QA-010": "FIXED",
    "QA-011": "FIXED",
    "QA-012": "FIXED",
    "QA-013": "FIXED",
    "QA-014": "FIXED"
  },
  "verification_scope": "Original exact reproduction cases; related expanded failures are QA-101 and QA-102.",
  "new_findings_counts": {
    "P1": 0,
    "P2": 2,
    "P3": 1
  },
  "top5": [
    {
      "id": "QA-103",
      "priority": "P2",
      "title": "Translation tab replaces mail UI with page error"
    },
    {
      "id": "QA-101",
      "priority": "P2",
      "title": "Mark as read decrements visible folder counts twice"
    },
    {
      "id": "QA-102",
      "priority": "P3",
      "title": "Nested mailbox form loses unsent state at mobile breakpoint"
    }
  ],
  "paths": {
    "report": "/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150.md",
    "screenshots": "/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/",
    "evidence": "/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/evidence.json",
    "machine_readable": "/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-9424150/verification.json"
  },
  "artifacts": {
    "png_count": 56,
    "max_png_bytes": 267762,
    "png_crc_validated": true
  },
  "worktree": {
    "path": "/home/monkey/code/noctua-mail/wt-qa-sweep2",
    "commit": "9424150f5aa0a446ed9bc03ed199e6825129467d",
    "branch": "qa/ui-sweep-9424150",
    "clean": true
  },
  "cleanup": {
    "scratch_removed": true,
    "owned_processes_stopped": true,
    "assigned_ports_free": true
  },
  "finished_at": "2026-10-23T04:19:49.848627+00:00"
}
```
