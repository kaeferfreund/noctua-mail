# Review of feat/ui-shell 2a12979 (slice 3 mobile) — lens: design conformance + visual direction (Codex gpt-6.1-sol, 2026-10-22 ~10:40 UTC)

Checked in wt-review-shell @2a12979 at 390×844 with the fixture mailbox; paths relative to the worktree.

1. **High — Mobile rows lose subjects and hide their action menus** — `app/components/mailclient/messagelist/MessageListPane.module.css:39`. At 390×844 in Threads view, enlarging every button turns unread dots into 44px iris circles; subjects collapse to zero width and several "Message actions" buttons start beyond x=390. Ref §7.2 mobile rows; §7.1 calm spacing, restrained accent. Fix: a mobile row layout with sender/subject stacking, reserved space for "more", hit areas enlarged without enlarging the dot glyph.

2. **Medium — Row hit areas overlap** — `MessageListPane.module.css:38`. Mobile rows become 44px tall but `MessageThreadList.tsx:115` still gives the virtualizer 40px per row (measured tops 247 and 287, both rows 44px). Fix: one responsive row height shared by CSS and the virtualizer offsets.

3. **Medium — Reader metadata overlaps on mobile** — `app/components/mailclient/message/MessageViewPane.module.css:117`. Opening "Kontrolltermin für Familie Beispiel" at 390px places the sender address underneath the Date label/value. Fix: stack sender and date below md; constrain/wrap the address within its column.

4. **Low — "Move to" misses the mobile menu sizing** — `app/components/shell/MobileFrames.module.css:39`. Adjacent items 44px, "Move to" only 18px: it keeps Radix Themes classes while the selectors target shadcn slots. Fix: include retained menu-item/subtrigger classes in the mobile sizing, or pass the chosen primitives into the shared submenu.

5. **Low — Long settings-tab labels overflow the rail** — `MobileFrames.module.css:25`. "Categorization" exceeds the fixed 112px rail (scroll width 121 vs 111 available). Fix: constrain the inner label spans and allow long words to wrap.

Verified correct (do not re-check): test:dom 30 pass / 200 assertions; navigation derives from viewMessage (marker push, popstate, both Back branches covered); CSS pane switching keeps DOM identity (list scroll 450px preserved on Back); mobile toolbar hidden, Back header, sidebar Sheet, theme choices in user menu; compose coerced to modal, window/dock/minimize hidden, saved size ignored, 390×844; status panels as themed Sheets, calendar fills viewport, ?openCalendar=1 handled; settings full-screen Sheet with vertical tabs; desktop unchanged at 1280×720.
