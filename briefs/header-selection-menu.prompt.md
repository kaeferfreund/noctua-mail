# Task header-selection-menu: an actions menu for selected messages in the shell header

Read `/home/monkey/code/noctua-mail/briefs/ui-polish-common.md` first. It covers the rules, the dev fixture, screenshots and verification.

- Worktree: `/home/monkey/code/noctua-mail/wt-header-menu`, branch `feat/header-selection-menu`, based on `fix/ui-font-consistency` 287da5e. That commit sits on `feat/compact-list-toolbar` 55d684d, which moved the list toolbar into the shell header. Use the font tokens from 287da5e: `text-xs` small buttons, `--text-2xs`, `--tracking-caps`.
- Ports: app 3812, fixture IMAP 3813, control 3814, SMTP 3815.
- Screenshot folder: `/home/monkey/code/noctua-mail/briefs/header-selection-menu-screens/`
- **Dev fixture:** this base has no `scripts/dev-fixture/` or `doc/DEV-FIXTURES.md`. Copy `/home/monkey/code/noctua-mail/repo/scripts/dev-fixture/` to `/tmp/header-selection-menu/dev-fixture/` and run it from there with your ports and this worktree's `.env.local`. Do not commit it.
- **Parallel work:** other tasks change `InAppNoticeStack`/sidebar (branch `feat/sidebar-undo-notice`) and the list's unread dot (`fix/list-unread-dot`). Do not touch those areas.

## User feedback (German, verbatim)
1. "was mache ich wenn ich mehrere mitteilungen markiert habe? also wo ist das menü dafür?" (What do I do when I've selected several messages, where is the menu for that?)
   Screenshot: `/home/monkey/.t3/userdata/attachments/3ea4a467-7463-4609-8462-02dbf72f5630-8b16e904-01a6-44ab-9e3c-5e68a1a5cc27.png`. It shows the compact list with checkboxes and three rows selected, one of them a thread.
2. The orchestrator explained the current state:
   - bulk actions are reachable only by right-clicking a selected row once ≥2 rows are selected (`BulkActionContextMenu`);
   - keyboard shortcuts: R / U / F / T / Delete / Cmd+A;
   - dragging the selection onto a folder.
   It proposed a selection bar that *replaces* the header toolbar. The user answered:
   "ne wir brauchen oben noch ein menü hier", meaning "no, we need an additional menu up here". Screenshot: `/home/monkey/.t3/userdata/attachments/3ea4a467-7463-4609-8462-02dbf72f5630-c508ef13-0d55-41e4-9d34-f7fc5207ad8e.png`, the shell header: "Manuel / INBOX  349 of 10.850", view menu, "Date" sort, group toggle, then search, Filters, sync, theme.
   So: **keep the existing list tools and add a menu in the header** for actions on the selected messages.

## Where it lives
- `app/components/MailClient.tsx`:
  - The bulk context menu is opened by a `contextmenu` listener (search `setBulkContextMenu`).
  - It is rendered with an `actions={{ onMarkRead, onMarkUnread, onToggleFlag, onMoveToFolder, onMoveToOther, onGetRecentFolders, onAddTopic, onArchive, onDelete, onCopyToAccount, onMoveToAccount }}` object (search `<BulkActionContextMenu`).
  - The keyboard shortcuts are in the `handleKeyDown` effect. They use selection if non-empty, else the active message, and collapsed thread roots expand to the whole thread via `getCollapsedRootThreadMessageIds`.
- `app/components/mailclient/messagelist/BulkActionContextMenu.tsx`: the item list.
- `app/components/mailclient/messagelist/MessageListHeader.tsx` and `app/components/shell/ShellHeader.tsx`: the header toolbar, a `@container/header` that drops secondary parts at narrow widths and must stay on one row (see commit 55d684d).
- `selectionStore` / `useSelectionSnapshot` (`messagelist/selectionStore.ts`) for a reactive selection count.

## Goal
1. **A menu trigger in the header toolbar** next to the existing list tools.
   - It is always present. It is disabled when there is nothing to act on.
   - With ≥2 selected it shows the count, e.g. "3 selected" or a count badge; keep the UI language English like the rest.
   - It opens a dropdown with the same actions as the right-click bulk menu, plus "To-Do" and "Clear selection" (and "Select all" if cheap):
     - Mark as read, Mark as unread, Flag
     - Move to ▸, Add topic ▸
     - Archive, Delete
     - Copy/Move to account, when other accounts exist
   - Show the keyboard shortcut hints (R, U, F, T, Del) in the items.
2. **Targets:** use the same rule as the keyboard shortcuts: the selection if non-empty, else the active message, with collapsed thread roots covering their thread. Header menu, context menu and shortcuts must never disagree about which messages an action hits.
3. **No duplication.** Extract the bulk item list into one shared component or hook used by both the right-click menu and the header menu. Reuse the existing handlers in `MailClient.tsx` rather than writing new ones. The delete path (including `DeleteConfirmDialog` for calendar-linked mail) and Undo notices must behave exactly as they do from the context menu.
4. **Responsive:** fit the header's container-query scheme without breaking the one-row layout. At tablet and phone widths the menu must stay reachable: on touch it is the only way to do bulk actions. If space is tight, collapse it to an icon button with the count as a badge rather than dropping it.
5. **Accessibility:** a proper `aria-label` that includes the count, keyboard operable, focus returns to the trigger, and the menu items keep their labels.

## Verification (in addition to ui-polish-common.md)
- **DOM tests:** trigger disabled with nothing to act on; count shown with ≥2 selected; each item calls the shared action with the right targets (selection vs active message vs collapsed thread); "Clear selection" empties the selection.
- **Browser with the fixture**, in the compact (table) view with checkboxes:
  - select 3 messages including a thread, then use the header menu to mark as read, move to a folder, and delete (Undo from the notice restores them);
  - check the right-click menu still works;
  - check at a tablet width (~900 px) and a phone width (390 px), in dark and light.
