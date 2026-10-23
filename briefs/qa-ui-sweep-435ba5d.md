# UI/UX QA sweep — 435ba5d

Read-only source sweep performed 2026-10-22/23 UTC against commit `435ba5d1885d5b016d15dbad5b269f84e6497ce3`, branch `qa/ui-sweep-435ba5d`, in `/home/monkey/code/noctua-mail/wt-qa-sweep`. **14 findings: 3 P1, 7 P2, 4 P3.** P1 follows the brief’s daily-use/data-affecting definition; QA-001 is explicitly timing-sensitive automation evidence.

## Setup and coverage

Read AGENTS.md, AUTHENTICATION.md, TEAM-INBOX.md §7 and DEV-FIXTURES.md. Ran the production build with `nice -n 10 bun run --cwd .tmp/build build` in a copy of tracked source under the assigned worktree’s `.tmp`, because the build generator writes tracked `public/build-version.json`. Build compilation, TypeScript stage and page generation completed successfully. Served `.next/standalone/server.js` on loopback port **3838**, with `.next/static` and `public` copied into standalone output. The referenced `ops/deploy-dev.sh` is absent at this commit; its stated standalone asset-copy procedure was followed directly.

`TMPDIR=/home/monkey/code/noctua-mail/wt-qa-sweep/.tmp`; all runtime data, test credentials, browser profiles, logs, outbox, source copy and browser scripts used `.tmp`. `NOCTUA_DATA_DIR` was overridden to `.tmp/data` rather than the external relative path in `.env.local`, honoring the stricter write boundary. Fixture ports were **3840 IMAP / 3841 SMTP / 3842 control**, bound to loopback. Watcher was enabled. No external mail service or port 3790 was used.

Initial seed: **330 synthetic messages**, including **300 INBOX messages**, ordinary folders, PDF/PNG/calendar fixtures, 240 additional messages with long subjects/non-ASCII names/flags/HTML and a **14-message conversation**. Two logical Noctua mailboxes use the fixture’s single synthetic IMAP identity: QA Private (Alex only) and QA Shared (Alex manager, Jo editor). The fixture does not offer two independent server accounts. Alex and Jo were provisioned/enrolled with the repository auth-helper pattern and then used normal production login/TOTP. A third temporary synthetic identity, Sam, exercised a real targeted invite and mandatory enrollment. Two additional malformed/missing-sender messages were injected for remote-content checks. All three SMTP deliveries stayed in the fixture.

| Viewport | Light | Dark |
|---|---|---|
| Desktop 1440×900 | Checked | Checked |
| Laptop 1280×720 | Checked | Checked |
| Tablet 834×1112 | Checked | Checked |
| Phone 390×844 | Checked | Checked |
| Phone 360×780 | Checked | Checked |

The viewport/theme matrix covered login, invite form, missing/valid reset forms, 404, TOTP challenge, enrollment/gates, mailbox dialog, shell/list/reader, four list layouts, inline reply/mobile coercion, new/forward modal compose, security, and all ten manager settings tabs. Admin Users/Mailboxes/Invites/Audit were reopened as needed at each size; a final **40 section/API checks returned 200** after the server interruption below. Mutations were exercised on the desktop/phone paths documented here, rather than repeating every mutation in all ten configurations. Detached compose was exercised on desktop only.

Desktop keyboard passes covered login/TOTP, signup, duplicate mailbox submission, shell collapse/expand and pane resizing, table selection/bulk read action, reader/internal note, new-message SMTP send, and Preferences save/close. Fifteen consecutive Tab steps stayed within the security proof dialog. Desktop overlay failures are QA-008/009. Mobile in-app Back and browser Back returned reader → list; browser Back dismissed the drawer after its closing animation settled.

## Prioritized findings

Source links identify likely fix locations at the tested commit; causal explanations are hypotheses where marked. Screenshots are evidence/context, with numeric DOM/network observations recorded in the Actual column.

| ID | Priority | Area | Viewport / theme | Exact steps | Expected | Actual / evidence | File:line / likely cause | Screenshot |
|---|---|---|---|---|---|---|---|---|
| QA-001 | P1 | Compose: rapid subject entry loses characters | 1440×900, dark; inline composer | Open New mail; focus Subject; use Playwright keyboard.type("QA keyboard fixture delivery", delay=0); wait 150ms and read the input. Retry after selecting all. A separate keyboard-only send used the same text. | The entered subject is preserved through editing, autosave and SMTP delivery. | Reproduced dropped characters: “QA kebard fxtur eiey” in the screenshot and “QA keyboard fixue eiey” in another trial. Fixture SMTP captured “Q keyboard fixture delivery” on the sent message. One zero-delay retry passed; 5ms and 40ms/character trials passed. Human-speed reproduction is not established. P1 is assigned for observed transmitted-data alteration. | [app/components/mailclient/composition/ComposeFields.tsx:219](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/composition/ComposeFields.tsx:219); [app/components/mailclient/composition/ComposeFields.tsx:268](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/composition/ComposeFields.tsx:268) (likely interaction between local state, transition and prop-to-local effect) | [rapid-subject-input-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/rapid-subject-input-1440-dark.png) |
| QA-002 | P1 | Mobile compose: Send is clipped after autosave | 360×780 and 390×844, light/dark; measured at 360×780 dark | Open mobile Compose; enter recipient, subject and body; wait for draft autosave to add Discard Draft and Save draft. | Send remains visible and reachable by touch in the viewport. | At 360px, Send starts at x=364.91 and is 59.27px wide. The footer is 336px wide with 412px scroll content; its 360px modal ancestor uses overflow-x:hidden. Send is absent from the initial touch view. Playwright scrolling during click can reveal and activate it; this is a workaround, not a failed SMTP delivery. | [app/components/mailclient/composition/Compose.module.css:369](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/composition/Compose.module.css:369); [app/components/mailclient/composition/Compose.module.css:398](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/composition/Compose.module.css:398); [app/components/mailclient/composition/ComposeActions.tsx:70](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/composition/ComposeActions.tsx:70) | [mobile-send-clipped-360-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/mobile-send-clipped-360-dark.png); [compose-390-light.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/compose-390-light.png) |
| QA-003 | P1 | MCP: false creation failure, lost secret and wrong expiry | 1440×900 dark; manager Settings → MCP | Enter label “Synthetic QA token”; retain the displayed 180-day expiry; click Create token; inspect the response and token list; switch tabs away and back. | A single successful creation displays its one-time secret and metadata, with the chosen lifetime. | POST returns 201 and stores one token, but UI says “Failed to create MCP token” and shows Active tokens 0. Reopening reveals it. Actual TTL is 30 days, not 180. UI sends expiresAt and expects {token:metadata,secret}; API accepts ttlSeconds and returns {token:secret,tokenRecord}. Deletion after reopening succeeded; GET then returned zero tokens. | [app/components/account-settings/tabs/McpTabContent.tsx:168](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/account-settings/tabs/McpTabContent.tsx:168); [app/api/accounts/[accountId]/mcp-tokens/route.ts:24](/home/monkey/code/noctua-mail/wt-qa-sweep/app/api/accounts/[accountId]/mcp-tokens/route.ts:24); [lib/mcpAuth.ts:74](/home/monkey/code/noctua-mail/wt-qa-sweep/lib/mcpAuth.ts:74) | [mcp-create-failure-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/mcp-create-failure-1440-dark.png) |
| QA-004 | P2 | Admin: nested dialogs appear behind their parent | 1440×900 dark; desktop nesting | Open Admin → Mailboxes → Manage members. Choose an enabled user and role; attempt Add member with the pointer. The same nesting is used by member/user confirmation dialogs. | The child dialog is above the parent, visible, and receives clicks. | Members dialog exists at z-index 9994 but is visually behind the parent Radix overlay at 9995. elementFromPoint at Add member returns rt-BaseDialogScrollPadding; pointer click times out. Keyboard focus plus Enter submits. Member-role and user-role changes also required the keyboard workaround. | [app/components/shell/SettingsFrame.tsx:21](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/shell/SettingsFrame.tsx:21); [app/components/ui/dialog.tsx:64](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/ui/dialog.tsx:64); [app/globals.css:350](/home/monkey/code/noctua-mail/wt-qa-sweep/app/globals.css:350) | [admin-members-overlay-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/admin-members-overlay-1440-dark.png) |
| QA-005 | P2 | Reader: long subject consumes the reading area | 360×780 / 390×844, light/dark; strongest at 360px with note open | Open QA synthetic 000, whose subject repeats the long-subject sentence four times; open Internal note. | Subject and controls leave a usable reading region, with an appropriate bounded or scrollable header. | At 360×780 the non-shrinking thread header is 652.42px tall. After the 44px Back row, only 35.58px remains for the scrollable message region. The fixed-width Compact/Full control narrows the subject column and increases wrapping. The screenshot shows almost only the header and note form. | [app/components/mailclient/message/MessageViewOrchestrator.tsx:688](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/message/MessageViewOrchestrator.tsx:688); [app/components/mailclient/message/MessageViewPane.module.css:21](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/message/MessageViewPane.module.css:21) | [long-subject-note-360-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/long-subject-note-360-dark.png); [reader-390-light.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/reader-390-light.png) |
| QA-006 | P2 | Shell: INBOX unread count disagrees with data | Desktop sidebar; both themes; also shown in phone drawer | Finish initial INBOX sync with 300 messages and 110 unread; keep the IMAP event stream active; compare the mailbox badge, Inbox/INBOX badges, and GET folders. Reload and observe again. | Unread badges agree with the count returned for the same mailbox and folder. | Mailbox badge and folders API reported 110 unread while Inbox and INBOX displayed 1; reload reproduced it. Later refreshes sometimes restored the count. Initial stream folder:update uses mailboxOpen.unseen and the client copies it into unreadCount. Likely cause: IMAP SELECT UNSEEN is the first unseen sequence number, not the unread total; fixture SELECT sent 1. | [app/api/accounts/[accountId]/imap/stream/route.ts:263](/home/monkey/code/noctua-mail/wt-qa-sweep/app/api/accounts/[accountId]/imap/stream/route.ts:263); [app/components/mailclient/useSyncController.ts:1214](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/useSyncController.ts:1214); [scripts/dev-fixture/imap-server.ts:172](/home/monkey/code/noctua-mail/wt-qa-sweep/scripts/dev-fixture/imap-server.ts:172) | [list-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/list-1440-dark.png) |
| QA-007 | P2 | Accessibility: visible form captions do not label inputs | Mailbox creation and compose; all viewport/theme renderings | Open Create mailbox and inspect input labels / try getByLabel("Name"). In compose inspect To, Cc/Bcc and Subject. | Visible field captions programmatically label their controls. | All ten mailbox inputs had labels.length=0 and no aria-label. Field renders the caption as Text, without label/for. Compose To and Subject also lack associated labels; their placeholders become the fallback names. The From row is correctly labelled. | [app/components/account-settings/Field.tsx:13](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/account-settings/Field.tsx:13); [app/components/mailclient/composition/ComposeFields.tsx:87](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/composition/ComposeFields.tsx:87); [app/components/mailclient/composition/ComposeFields.tsx:319](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/composition/ComposeFields.tsx:319) | [mailbox-dialog-360-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/mailbox-dialog-360-dark.png); [compose-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/compose-1440-dark.png) |
| QA-008 | P2 | Accessibility: desktop composer is not a modal dialog | 1440×900 dark; popped-out Forward composer | Open Forward inline, then Open in modal. Focus Send and press Tab repeatedly; press Escape. | Modal has an accessible dialog role/name, traps focus, and dismisses on Escape. | Desktop wrapper has no role or aria-modal. Tab from Send reaches BODY, New mail, sync, Drafts and other shell controls behind the backdrop; all eight sampled next focus targets were outside the composer. Escape left the modal mounted. Mobile has a DialogPrimitive path, but desktop returns a plain backdrop div. | [app/components/mailclient/composition/ComposeModal.tsx:248](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/composition/ComposeModal.tsx:248); [app/components/mailclient/composition/ComposeModal.tsx:272](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/composition/ComposeModal.tsx:272) | [desktop-compose-focus-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/desktop-compose-focus-1440-dark.png) |
| QA-009 | P2 | Accessibility: desktop Settings ignores Escape | 1440×900 dark; Preferences | Open Settings → Preferences; press Escape once after rendering settles. | Escape dismisses the dialog and restores focus to its opener. | The dialog remains open. SettingsFrame explicitly prevents the Escape event. The shared frame also hosts desktop Admin. The visible Close button works. | [app/components/shell/SettingsFrame.tsx:23](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/shell/SettingsFrame.tsx:23) | [settings-1440-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/settings-1440-dark.png) |
| QA-010 | P2 | Accessibility: status text contrast below 4.5:1 | 1440×900 light; Waiting and Closed | Set thread status to Waiting, then Closed. Read computed foreground/background colors and calculate sRGB relative luminance. | Normal-size status text meets at least 4.5:1. | Waiting: rgb(171,100,0) on rgb(255,247,194), 4.25:1. Closed: rgb(33,131,88) on rgb(230,246,235), 4.21:1. Actual status control text is 14px, weight 400. Dark-mode counterparts pass; full measurements follow below. | [app/components/collab/types.ts:28](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/collab/types.ts:28) | [status-contrast-1440-light.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/status-contrast-1440-light.png) |
| QA-011 | P3 | Mobile header controls are below the requested 44px target | 390×844 / 360×780, both themes | Inspect bounding boxes of View, Sort & group, Message actions, Search messages and Activity/calendar in the phone header. | Phone actions use the brief’s 44×44px touch target. | Each sampled action is 32×32px. The sidebar trigger already uses 44px, and sampled row action targets retain 44px. This is a touch ergonomics discrepancy against the brief, not a claim that 32px alone violates WCAG 2.2 minimum target size. | [app/components/ui/button.tsx:28](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/ui/button.tsx:28); [app/components/shell/ShellHeader.tsx:85](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/shell/ShellHeader.tsx:85) | [list-360-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/list-360-dark.png) |
| QA-012 | P3 | Search empty-state wording implies the folder is empty | 390×844 dark; render checked in both themes and all sizes | In the populated INBOX, search for zz-no-synthetic-result-435ba5d with folder scope. | The empty state says that no messages match the search. | Search summary and 0 of 0 are shown, followed by “No messages in this folder.” The underlying folder contains hundreds of messages. The search-specific text is selected only for all-mail scope. | [app/components/mailclient/messagelist/MessageListOrchestrator.tsx:577](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/mailclient/messagelist/MessageListOrchestrator.tsx:577) | [search-empty-390-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/search-empty-390-dark.png) |
| QA-013 | P3 | Reduced motion does not suppress sidebar slide animation | 390×844 dark; prefers-reduced-motion:reduce | Emulate reduced motion; open the mobile sidebar; inspect the dialog’s computed animation and transition durations. | Nonessential slide motion is suppressed or shortened under reduced motion. | Computed animation-name is enter, animation-duration 0.2s, and transition-duration 0.2s. Sheet classes retain slide-in-from-left. Screenshot is static context; computed timing is the motion evidence. | [app/components/ui/sheet.tsx:75](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/ui/sheet.tsx:75) | [reduced-motion-sidebar-390-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/reduced-motion-sidebar-390-dark.png) |
| QA-014 | P3 | Admin closes and loses an unsent form at the mobile breakpoint | 1440×900 → 390×844, dark | Open Admin → Invites at desktop size; enter Name “Synthetic unsent invite” without issuing it; resize to phone size. | The Admin destination and unsent form survive a responsive layout change. | Close admin count changes from 1 to 0 and the mail list replaces Admin. Reopening starts a new form. Admin state lives inside ShellUserMenu, which is remounted with the sidebar’s desktop/mobile presentation. Admin checks were reopened at each size to continue the sweep. | [app/components/shell/ShellUserMenu.tsx:48](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/shell/ShellUserMenu.tsx:48); [app/components/shell/ShellUserMenu.tsx:116](/home/monkey/code/noctua-mail/wt-qa-sweep/app/components/shell/ShellUserMenu.tsx:116) | [admin-rotation-closed-390-dark.png](/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/admin-rotation-closed-390-dark.png) |

## Contrast and performance observations

Ratios use computed sRGB colors and WCAG relative-luminance calculation. Status colors were sampled with the same CSS tokens as the rendered control; Waiting/Closed control colors, font size and weight were also read directly. These are sampled text pairs, not a complete page-wide contrast audit.

| Theme | Primary button | Open | In progress | Waiting | Closed |
|---|---|---|---|---|---|
| light | 5.37:1 | 5.19:1 | 5.41:1 | 4.25:1 | 4.21:1 |
| dark | 5.37:1 | 7.67:1 | 7.22:1 | 10.26:1 | 7.86:1 |

A fresh list render in Chromium produced **9 long tasks**, maximum **179ms**, zero above 250ms, and cumulative layout shift **0.014** over the sampled first-render interval. This is a short observation on the shared host with nice priority, not a benchmark or deep profile. No sustained flicker was observed in the sampled interactions; the subject-state race in QA-001 was separately reproduced. Browser page-error count during the collected flows: **0**.

## What works well

Production login/TOTP, invited signup → restricted enrollment → verified identity, and the non-admin no-mailbox gate worked. Restricted access to `/api/accounts` returned 403 before enrollment. Reset redemption stripped the URL token, changed the password without creating a session (401 from `/me`), and preserved the subsequent TOTP requirement. A virtual UV passkey registered after fresh login; stale registration correctly requested login. Wrong security proof remained inline while `/me` stayed 200. Mailbox duplicate handling returned 409, creation granted no implicit membership, and Jo saw only the shared mailbox. Assignment, status, Markdown notes and the timeline persisted across users. Viewer downgrade removed MCP access; restoring editor worked. User-role changes worked with the nested-dialog keyboard workaround, and disabling Jo produced disabled=true and rejected Jo’s session with 401. Draft autosave, attachment send, fixture SMTP delivery/Sent copies, reply/forward renderings and detached reply window worked apart from the listed defects. The PDF downloaded with 200 and 1473 bytes. Pane size persisted at 52% across reload. Light/Dark/System menu selections persisted their corresponding values. Remote content was initially blocked, Load once worked, and Always load saved a sender preference. The tested HTML mail adapted to white text on the dark reading surface.

## Untested or limited areas

- The natural `mailboxState=unselected` race/failure gate was not forced: the production server deterministically persisted a default accessible mailbox. None, enrollment and selected states were exercised.
- Full action-by-action repetition in every viewport/theme, physical keyboard/virtual-keyboard occlusion, mobile Safari/PWA installation, real authenticators, TLS identity behavior and external mail providers were not exercised.
- True legacy rows lacking account/sender identity were unavailable. Injected missing-From messages acquired a current-account fallback identity, so they do not establish the legacy-row Always-load restriction.
- Detached window send, reply/forward SMTP send, attachment failure/retry/large-file cases, recovery expiry/reuse races, backup-code redemption/rotation, passkey removal and security changes beyond the reported flows were not exercised.
- Virtualized scrolling and preloaded hundreds of messages were exercised; a separate load-more page beyond the fixture’s preloaded result set was not reached. Exhaustive grouping/sort combinations, folder drag-and-drop, destructive mailbox deletion and adverse-network loading races were not covered.
- CalDAV/translation connection tests, notifications and mailto OS integration were not invoked. CJK characters remained intact in DOM text, but the host lacked some CJK glyphs; screenshot font fallback is not attributed to application encoding.
- No full lint/CI/stress test suite was run for this source-read-only UI task. Only the production build and targeted browser/API observations above are claimed.

## Execution notes and artifact validation

The app stopped accepting connections around 00:27 UTC while its owned Bun process remained alive. Requests then failed with connection-refused/incomplete-stream errors. Cause was not established and is not classified as an application defect. Only the owned app PID was stopped, then standalone was restarted on 3838 with the same isolated data. User disabling and all 40 final Admin section/API checks were repeated successfully.

One setup command initially created ignored `public/runtime-config.js` in the worktree rather than in scratch. Its creation was identified immediately and the newly created file was moved into the scratch standalone public directory. No tracked file changed; that transient file is absent from the worktree after cleanup. Other generated state stayed within `.tmp` and the authorized report paths.

Artifacts: **60 PNG screenshots**, each ≤300,000 bytes; largest **186,514 bytes**. PNG signatures were validated. Screenshots contain synthetic data and omit TOTP seeds/QRs, backup codes, reset capabilities and MCP secrets. No commits, pushes, PRs, checkout/reset/stash, PRAGMA optimize or ANALYZE were performed. Other worktrees and data directories were not accessed.

Final verification completed 2026-10-23T00:41:38.528841+00:00. Browser was closed, its driver exited, and owned fixture/app processes were stopped by PID. The initial app PID 1146052 had already been stopped for restart; final owned process cleanup covered [1144476, 1235994]. No owned running process remained, and ports 3838–3842 were free. `.tmp` was removed. `git diff --check` passed, `git status --porcelain=v1 --untracked-files=all` was empty, and branch `qa/ui-sweep-435ba5d` remained at `435ba5d1885d5b016d15dbad5b269f84e6497ce3`. The worktree is clean. Final screenshot count and PNG/size validation passed again.


## Machine-readable summary

```json
{
  "counts": {
    "P1": 3,
    "P2": 7,
    "P3": 4
  },
  "top5": [
    {
      "id": "QA-001",
      "priority": "P1",
      "title": "Rapid subject typing loses transmitted characters"
    },
    {
      "id": "QA-002",
      "priority": "P1",
      "title": "Mobile Send is clipped after draft autosave"
    },
    {
      "id": "QA-003",
      "priority": "P1",
      "title": "MCP creation reports failure after storing a token"
    },
    {
      "id": "QA-004",
      "priority": "P2",
      "title": "Nested Admin dialogs are hidden behind their parent"
    },
    {
      "id": "QA-005",
      "priority": "P2",
      "title": "Long subject and note header leave a 36px reading area"
    }
  ],
  "report": "/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d.md",
  "screenshots": "/home/monkey/code/noctua-mail/briefs/qa-ui-sweep-435ba5d/",
  "worktree": {
    "path": "/home/monkey/code/noctua-mail/wt-qa-sweep",
    "commit": "435ba5d1885d5b016d15dbad5b269f84e6497ce3",
    "branch": "qa/ui-sweep-435ba5d",
    "clean": true
  },
  "cleanup": {
    "scratch_removed": true,
    "owned_processes_stopped": true,
    "assigned_ports_free": true
  }
}
```
