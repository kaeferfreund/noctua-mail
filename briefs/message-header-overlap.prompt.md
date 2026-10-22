# Task message-header-overlap: sender name and date must never overlap

Read `/home/monkey/code/noctua-mail/briefs/ui-polish-common.md` first. It covers the rules, the dev fixture, screenshots and verification.

- Worktree: `/home/monkey/code/noctua-mail/wt-message-header`, branch `fix/message-header-overlap`, based on `fix/ui-font-consistency` 287da5e (font tokens; sits on `feat/compact-list-toolbar`).
- Ports: app 3816, fixture IMAP 3817, control 3818, SMTP 3819.
- Screenshot folder: `/home/monkey/code/noctua-mail/briefs/message-header-overlap-screens/`
- **Dev fixture:** this base has no `scripts/dev-fixture/`. Copy `/home/monkey/code/noctua-mail/repo/scripts/dev-fixture/` to `/tmp/message-header-overlap/dev-fixture/` and run it from there with your ports and this worktree's `.env.local`. Do not commit it.
- **Long sender names:** the seed has no sender name long enough. Inject one through the fixture control API: `POST http://127.0.0.1:3818/inject` with a raw RFC822 `source` whose From is a long display name, e.g. `"Dr. Arulraj Beispiel & Asena Muster | Dentalwelten – Praxis für Zahnheilkunde" <intern@dentalwelten.example>`, plus a long subject. Use synthetic names only.
- **Parallel work:** other tasks change the header selection menu (`feat/header-selection-menu`), the sidebar notices and the list's unread dot. Do not touch those areas.

## User feedback (German, verbatim)
"hier überlagern sich name und datum, das ist mist" (here the name and the date overlap, that's rubbish)

Screenshot: `/home/monkey/.t3/userdata/attachments/3ea4a467-7463-4609-8462-02dbf72f5630-4492fd87-ba65-4466-9ebc-207f9bb039c6.png`. It shows the reading pane, about 1150 px wide, with the message card header:
- "From: Dr. Arulraj Sangarapillai & Asena Prince | Dentalwelten – Praxis für Zahnheilkunde <…" runs straight through "Date: 7.10.2026, 13:49", so both texts are drawn on top of each other;
- the From copy icon wraps onto its own line below.

## Where it lives
- `app/components/mailclient/message/ThreadMessageCard.tsx` ~line 833: `.metaLine.metaSplit` holds `.metaSegmentFrom` (SenderIcon + `MessageRecipientMetaField` with label/value/copy button) and `.metaSegmentDate` ("Date:" + value).
- `ThreadMessageCard.module.css`: `.metaLine`, `.metaSplit`, `.metaSegment`, `.metaSegmentFrom`, `.metaSegmentField`, `.metaSegmentDate`, `.metaValue`, plus a narrow-width block ~line 559 that stacks them.
- `MessageRecipientMetaField` (find it) renders the label, the address list, hover card/actions and the copy button.

## Goal
1. **From and Date never overlap at any pane width.**
   - The date keeps its natural width and never wraps or truncates.
   - The From value takes the remaining space and truncates with an ellipsis on one line. The full name and address stay available via the existing tooltip or hover card and via copy.
   - The copy button stays attached to the end of the visible From text, on the same line. It is not pushed onto a new line.
   - When the pane is too narrow for even a short sender next to the date, fall back cleanly to two lines (date under From). Use a container query on the card or the existing narrow block, whichever matches how the file already does it.
   - Find the root cause (probably `min-width: auto` on a flex child, a missing `flex-shrink`/`overflow: hidden`, or an absolutely positioned or negative-margin date) and fix it there, not with magic widths.
2. **Same check for the To/Cc rows and the collapsed message summary line** in the thread view, which shows sender + preview + date. They must not overlap either.
3. **Secondary, same bug class:** with the compose pane open at 1440 px, the thread-list rows get narrow and the date overlaps the folder/attachment badges and icons. Two earlier agents saw this in their screenshots: `/home/monkey/code/noctua-mail/briefs/ui-font-consistency-screens/after-compose-desktop-dark.png` shows "22.10.2026" under the badges.
   - Fix it in the list row layout if the cause is the same kind of flex shrink problem: the date keeps its width and the sender/badges truncate first.
   - Keep the unread-dot gutter as it is, because another task is changing it.
   - If the fix needs a bigger list-row refactor, stop at an analysis and report it instead.
4. **Tests:** add a DOM or unit test where it makes sense, e.g. class/structure for the truncation container. The real proof is browser screenshots, before/after:
   - the long-sender message at pane widths ~1150, ~800 and ~500 px and at a phone width;
   - the narrow list with compose open at 1440 px;
   - dark and light theme.
