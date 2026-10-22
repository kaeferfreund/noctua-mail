# Task sidebar-undo-notice: show in-app notices as a slim card above the account card in the sidebar

Read `/home/monkey/code/noctua-mail/briefs/ui-polish-common.md` first. It covers the rules, the dev fixture, screenshots and verification.

- Worktree: `/home/monkey/code/noctua-mail/wt-sidebar-notice` (branch `feat/sidebar-undo-notice`, based on `feat/compact-list-toolbar` 55d684d). That branch moves the list toolbar into the shell header and is what the user sees in the dev preview. It belongs to another thread: build on it, but do not rewrite its features.
- Ports: app 3808, fixture IMAP 3809, control 3810, SMTP 3811.
- Screenshot folder: `/home/monkey/code/noctua-mail/briefs/sidebar-undo-notice-screens/`
- A parallel task on another branch is unifying fonts (`globals.css`, header typography). Do not restyle typography globally. Style only the notice card.

## User feedback (German, verbatim)
"die karte könnte auch links unten in der seitenleiste erscheinen über [Account-Karte] cargnel cargnel@monkeydent.de als dünne karte aber mit undo - das wäre noch besser :)"
(The notice card could appear at the bottom left in the sidebar, above the account card "cargnel / cargnel@monkeydent.de", as a thin card but with Undo. That would be even better.)

User screenshots (dark theme):
- `/home/monkey/.t3/userdata/attachments/3ea4a467-7463-4609-8462-02dbf72f5630-e46617de-9107-4518-85a6-05c68d6f9e8a.png` — today: a big green notice "Moved message to Trash. / (no subject)" with Undo and ×, floating at the bottom centre over the list pane.
- `/home/monkey/.t3/userdata/attachments/3ea4a467-7463-4609-8462-02dbf72f5630-6be72a67-e839-480e-a33e-675919e4d1d5.png` — the account card at the bottom of the sidebar (avatar "CA", name, e-mail, ⋮ menu).

## Where it lives
- `app/components/mailclient/InAppNoticeStack.tsx` (rendering) and `useInAppNotices.ts` (+ `useInAppNotices.test.ts`: state, timeouts via `NOTICE_TIMEOUTS`).
- `app/components/MailClient.tsx`, where `<InAppNoticeStack>` is rendered (~line 5704 on team-inbox; search for it) and the positioning (`noticePaneRightOffset`, …). Undo for moves is `undoMoveOperation`.
- `app/components/shell/ShellSidebar.tsx`, `ShellUserMenu.tsx` (the account card), `AppShell.tsx`, `ShellPanes*`.
- Other users of `InAppNoticeStack` keep their current placement: `composition/DetachedComposeWindowClient.tsx` (detached compose window) and `calendar/CalendarEventBrowser.tsx`.

## Goal
- **Desktop with the sidebar visible:** notices render as a slim card docked directly above the account card at the bottom of the sidebar, matching the sidebar's content width and radius.
  - **Card content:** status icon, a one-line title, an optional secondary line (subject) truncated with ellipsis, a compact "Undo" action when the notice has one, and a small dismiss ×.
  - **Tone:** success/error/info states shown with a subtle tone (e.g. a tinted border or icon colour), not a full green slab. It must work in dark and light themes.
  - **Several notices:** they stack, newest closest to the account card, with a sensible cap (older ones collapse or drop). Keep the existing timeouts and the pause on hover/focus, if there is one.
  - **Interaction:** the card must not hide the account card or its menu. Folder list scrolling must keep working. Decide between overlaying the bottom of the scrollable folder area and reserving space, and justify the choice. Avoid layout jumps in the folder list.
- **Fallback:** when the sidebar is collapsed (header sidebar toggle), or on tablet/mobile layouts without a docked sidebar, keep the current floating placement (or an equivalent bottom placement that clears the mobile nav).
- **Accessibility:** keep `aria-live` / `role` semantics so screen readers still announce notices. Undo and dismiss must be keyboard reachable. Respect `prefers-reduced-motion` for enter/exit animation.
- **Verify in the browser with the fixture:** move a message to Trash and click Undo in the sidebar card; the message is back. Also check an error notice if you can trigger one, two notices in a row, the collapsed sidebar and a mobile width. Add or adjust DOM tests (placement switch, Undo button calls the action, dismiss).
