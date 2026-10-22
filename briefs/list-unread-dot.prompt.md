# Task list-unread-dot: larger, easier-to-hit row indicator in the message list

Read `/home/monkey/code/noctua-mail/briefs/ui-polish-common.md` first. It covers the rules, the dev fixture, screenshots and verification.

- Worktree: `/home/monkey/code/noctua-mail/wt-list-dot` (branch `fix/list-unread-dot`, based on `team-inbox` 20be988).
- Ports: app 3800, fixture IMAP 3801, control 3802, SMTP 3803.
- Screenshot folder: `/home/monkey/code/noctua-mail/briefs/list-unread-dot-screens/`

## User feedback (German, verbatim)
"die punkte / kreise zum markieren sind sehr klein und haben viel padding das ist schlecht bitte visuell angenehmer machen ohne mehr platz zu verwenden einfach weniger padding und mehr usability"
(The dots/circles used for marking are very small and have a lot of padding around them. Make them visually nicer and more usable WITHOUT using more space: less padding, more usability.)

Screenshot from the user (dev preview, dark theme): `/home/monkey/.t3/userdata/attachments/3ea4a467-7463-4609-8462-02dbf72f5630-211b156b-f928-4e06-950b-eb85ee3f1cdd.png`. Every row shows a tiny hollow ring at the far left, with a large empty gutter around it. Thread rows have a chevron, and their ring is indented.

## Where it lives
- `app/components/mailclient/messagelist/MessageRow.tsx` around the `data-message-cell="unread"` span (~line 326): it renders `renderUnreadDot` (the `UnreadDot` button), `renderSelectIndicators` (draft icon) and a Radix `<Checkbox size="1">` for selection.
- `app/components/mailclient/messagelist/UnreadDot.tsx` + `MessageListCommon.module.css` (`.unreadDot` is 8 px; the read state is a hollow ring at `opacity: 0.55`; below 768 px there is already an invisible 44 px hit area).
- Row layout / gutter: `MessageRow.module.css`, `MessageCardList.module.css`, `MessageThreadList.module.css`, and for the compact table view `MessageTable.tsx` / `MessageTable.module.css`.

First work out which control the visible ring is (it is probably `UnreadDot` in its read state; check when the checkbox shows up) and how the left gutter's width and padding come about. The user means the circle at the left edge of each row. Treat that leading column as one control area.

## Goal
- Do not make rows taller or the leading column wider. Ideally the gutter gets narrower, and the reclaimed space goes to the content.
- Make the visible indicator moderately larger and clearer. Read and unread must be distinguishable in both themes by shape/fill and contrast, not just by 0.55 opacity.
- Give it a generous hit target inside the existing footprint, e.g. a 24–28 px invisible hit area, keeping the existing 44 px one on mobile.
- Add a hover affordance and a `:focus-visible` ring. Keep the tooltip and aria labels.
- Keep the card list, thread child rows and the compact table view consistent.
- Selection via checkbox, shift-range and meta-toggle must keep working, as must row click/drag, and the dot click must not select the row. Existing DOM tests around rows and selection must stay green; add a test if you change the markup or behaviour.
