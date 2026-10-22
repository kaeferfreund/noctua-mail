# Review of feat/ui-shell 2a12979 (slice 3 mobile) — lens: regressions + accessibility (Codex gpt-6.1-sol, 2026-10-22 ~10:45 UTC)

Checked in wt-review-shell2 @2a12979 (Chromium at 390×844 and 1280×720, fixture mailbox); paths relative to the worktree.

1. **High — Mobile rows hide subjects and action menus** — `app/components/mailclient/messagelist/MessageListPane.module.css:38`. Same as design finding 1: at 390×844 subjects collapse to zero width, the first "Message actions" button sits at x=395; 44px minimum exceeds the virtualized 40px row spacing. Fix: a mobile row layout reserving room for subject and menu; update the virtualizer row height.

2. **Medium — Persisted pane layouts cause hydration warnings and incorrect widths** — `app/components/shell/ShellPanes.tsx:63`. Server storage returns nothing while the client hydration snapshot reads localStorage → React attribute warning, server `flex-basis:42%` left behind; after breakpoint changes a saved 30% list occupied ~60%. Pre-dates slice 3 (slice 2 code). Fix: identical initial layout during hydration, then apply saved sizes through the group API.

3. **Medium — Calendar "Find related" leaves results hidden** — `app/components/mailclient/status/BottomStatusBar.tsx:195`. On mobile with a thread open: header Calendar → event → "Find related": Sheet closes, search changes, but viewMessage stays selected → old reader shown, results in the hidden list. Fix: clear the mobile message selection (match the calendar-sidebar callback).

4. **Medium — Keyboard opening a row menu also opens the thread** — `app/components/mailclient/message/MessageMenu.tsx:258`. Focus a row's "Message actions" button, press Enter: the key event reaches the row handler, selects the message and hides the list; menu stays open against a hidden trigger. Fix: ignore interactive descendants / default-prevented events in row keyboard handlers, or stop trigger key propagation; test inside a real row.

5. **Medium — Browser Back changes the underlying view instead of dismissing the Sheet** — `app/hooks/useMobileNavigation.ts:15`. Open a thread, open Processes, browser Back: thread selection clears, Processes stays open; further Back can leave the Sheet displayed. Fix: represent overlays in navigation history; dismiss the top overlay before clearing the thread selection.

6. **Medium — The forced mobile composer lacks modal accessibility** — `app/components/mailclient/composition/ComposeOrchestrator.tsx:1481`. ComposeModal's frame is plain divs: Shift+Tab escapes to background controls; no dialog role, focus trap or Escape. Fix: a labelled modal Dialog with focus restoration, keeping the compose controller and draft handling.

7. **Medium — Closing status Sheets loses keyboard focus** — `app/components/shell/StatusPanelFrame.tsx:23`. Open Processes from the indicator menu and close: focus goes to body, not the indicator (controlled Sheets without SheetTrigger). Fix: keep the indicator button ref and restore focus via onCloseAutoFocus; same for calendar and mail-check Sheets.

8. **Medium — A saved theme triggers full hydration recovery** — `app/components/shell/ShellHeader.tsx:27`. Save Light and reload: server renders Monitor, client Sun → hydration failure and client regeneration at <Icon />. Pre-existing shell issue. Fix: render a stable icon until hydration completes (mounted flag / useSyncExternalStore server snapshot).

Verified correct (do not re-check): test:ci 1,676 + 30 DOM pass; send-race, detached-compose, attachment-loading tests pass; desktop inline→modal→minimized transitions; detached handoff reaches ready; mobile selection pushes one history entry, desktop none; both panes mounted; useIsMobile hydration snapshot consistent and listeners cleaned up; settings full-screen with vertical tabs; Sheet content resolves Radix spacing tokens; Sheets lock body scroll; calendar "Open Email" closes the Sheet and shows the thread. Unverified: iOS Safari chrome, detached popup UI.
