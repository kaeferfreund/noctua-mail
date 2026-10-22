# Task list-unread-dot, round 3: the dot becomes a pure "unread" indicator

Read `/home/monkey/code/noctua-mail/briefs/ui-polish-common.md` (rules, dev fixture, screenshots, verification) and the original brief `/home/monkey/code/noctua-mail/briefs/list-unread-dot.prompt.md` first.

- Worktree: `/home/monkey/code/noctua-mail/wt-list-dot`, branch `fix/list-unread-dot`. HEAD is `2103706` from round 2, and that commit is already deployed to the dev preview. Build on top of it with a new commit.
- Ports: app 3800, fixture IMAP 3801, control 3802, SMTP 3803.
- Screenshot folder: `/home/monkey/code/noctua-mail/briefs/list-unread-dot-screens/r3/`. Name the files `before-*` (state at 2103706) and `after-*`.

## What happened so far
- Round 2 (2103706) found that the ring at the left of each row is `UnreadDot`, a button that toggles read/unread. There is no selection checkbox in the threads view.
- Round 2 made it larger: filled when unread, a grey ring when read, hover/focus styles, a 24 px invisible hit area, and a gutter about 8 px narrower. A DOM test covers dot clicks not selecting or opening the row.
- The user saw the screenshots and said this is better.

## New user decision (German, verbatim)
"die edit funktion über die punkte kann weg, das geht ja über das kontextmenü auch - der punkt soll nur bei ungelesenen mitteilungen da sein"
(The edit function on the dots can go, because the context menu does that too. The dot should only be there for unread messages.)

## Goal
1. **The dot is a status indicator only.**
   - It is not a button: no click handler, no hover/focus styling, no invisible hit area, not in the tab order, no "Mark as read/unread" tooltip on the dot.
   - Clicking where the dot is behaves like clicking the row.
   - Screen readers still need to learn that a message is unread. Use whatever fits the existing row semantics: for example an accessible "Unread" label on the indicator, or visually hidden text. Do not add a button.
2. **Read messages show no dot at all**, in every list view: card list, threads view (including thread child rows and collapsed thread roots, which keep their current "any unread" semantics), compact and table view.
   - Unread messages keep the filled accent dot from round 2.
   - The leading column keeps a stable width so sender and subject text don't jump when a message is marked read or unread.
   - Use the freed hit-area space to tighten the gutter where you can, without changing row height.
3. **The read/unread toggle stays available elsewhere.** Verify in the browser with the fixture:
   - the row's ⋮ menu (`app/components/mailclient/message/MessageMenu.tsx`, the `markRead` item),
   - the multi-select/bulk context menu (`BulkActionContextMenu.tsx`),
   - any existing keyboard shortcut.
   If the item is hidden in any list view's row menu, make it visible there.
4. **Clean up what becomes dead code**: `UnreadDot`'s `onToggle`/`disabled` props, toggle handlers wired only for the dot in `useMessageListHelpers.tsx` and its callers, the hover/focus/hit-area CSS, and the mobile 44 px `::after` hit area.
   - Don't remove anything the menus or shortcuts still use.
   - Update the DOM tests from round 2: assert that read rows render no dot, unread rows render a non-interactive dot, and clicking the dot area acts like a row click.
