# Task ui-font-consistency: one consistent typeface and type scale in the app chrome

Read `/home/monkey/code/noctua-mail/briefs/ui-polish-common.md` first. It covers the rules, the dev fixture, screenshots and verification.

- Worktree: `/home/monkey/code/noctua-mail/wt-ui-fonts` (branch `fix/ui-font-consistency`, based on `feat/compact-list-toolbar` 55d684d). That branch moves the list toolbar into the shell header and is what the user sees in the dev preview. It belongs to another thread: build on it, but do not rewrite its features.
- Ports: app 3804, fixture IMAP 3805, control 3806, SMTP 3807.
- Screenshot folder: `/home/monkey/code/noctua-mail/briefs/ui-font-consistency-screens/`

## User feedback (German, verbatim)
"wir haben viele schriftarten hier im mix, das gefällt mir nicht, es sollte einheitlicher sein insbesondere `Manuel / INBOX` `349 of 10.850` sieht komisch aus"
(We have many fonts mixed here, I don't like it. It should be more uniform. In particular the header "Manuel / INBOX  349 of 10.850" looks odd.)

User screenshots (dark theme, dev preview):
- `/home/monkey/.t3/userdata/attachments/3ea4a467-7463-4609-8462-02dbf72f5630-59acfb30-9a57-4819-ab97-c52d14ce9412.png` — full app: sidebar, list, header with "Manuel / INBOX 349 of 10.850", status bar "PROCESSES Idle MAIL CHECK Idle …".
- `/home/monkey/.t3/userdata/attachments/3ea4a467-7463-4609-8462-02dbf72f5630-e46617de-9107-4518-85a6-05c68d6f9e8a.png` — Drafts view with the compose pane (uppercase HTML/MARKDOWN/TEXT tabs, inputs, buttons) and a toast.

## Leads to check (verify them, don't assume)
- `app/globals.css`: `--font-sans` (Inter, ~line 30), the Radix `--default-font-family` (~line 200), and ~line 264 `font-family: var(--font-sans, "Sora", sans-serif)` (where does "Sora" come from?). `lib/ui/fonts.ts` (`APP_FONT_FAMILY`, `APP_FONT_STACK`, `APP_FONT_FACE_CSS`). Inter is vendored with unicode-range subsets (commit "perf(fonts): subset variable Inter by Unicode range"). Check that every weight, style and glyph range actually used (e.g. German umlauts, "€", typographic quotes, digits) is served. Otherwise the browser falls back per glyph or synthesizes weights, which reads as "mixed fonts".
- Tailwind runs without preflight ("Layer globals.css for Tailwind without preflight"). Native `button`, `input`, `select` and `textarea` then do NOT inherit the font and render in the OS UI font (SF Pro on macOS). Check sidebar nav items, header controls, compose inputs and tabs.
- Radix Themes font variables (`--default-font-family`, `--heading-font-family`, `--strong-font-family`, `--code-font-family`, `--em-font-family`, `--quote-font-family`) vs shadcn/Tailwind `font-sans`.
- Find every remaining `font-family` in the app chrome. Code/monospace areas (raw source panels, MCP tab) may keep a mono font on purpose. The e-mail HTML iframe (`app/components/HtmlMessage.tsx`) is OUT OF SCOPE: another task is editing that file. Do not touch it.

## Goal
- **One typeface** across the app chrome (Inter via the existing stack), including native form controls, Radix and shadcn components, toasts, menus and dialogs. Monospace only where it is deliberate.
- **A small, consistent type scale.** Unify sizes, weights, letter-spacing and casing where they are obviously inconsistent. In particular, the header title "Manuel / INBOX" plus the count "349 of 10.850" should read as one deliberate unit. For example: the title in one weight; the mailbox/folder separator subtle; the count secondary in colour/size, on the same baseline, with tabular numerals; no odd jumps. The `Manuel / INBOX` label lives in the compact-toolbar code (`app/components/mailclient/messagelist/MessageListHeader.tsx`, `app/components/shell/ShellHeader.tsx`).
- Review the all-caps letter-spaced labels (status bar "PROCESSES / MAIL CHECK / EXCEPTIONS / UPCOMING", compose tabs "HTML / MARKDOWN / TEXT"). Make them consistent with the rest. If you keep caps, keep them consistent; explain your choice.
- Don't redesign layouts or colours beyond what typography needs. Keep changes token-based (CSS variables) so later branches inherit them.
- Add or adjust tests where it makes sense, e.g. `app/globals.test.ts` already asserts the font variables.
