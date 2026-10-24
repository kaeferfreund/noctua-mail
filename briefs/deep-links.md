# Deep links for everything (feature)

User request 2026-10-23 ~19:10 UTC (German): "Wir brauchen auch noch Deep Links, insbesondere zu den geöffneten E-Mails, damit man nicht ständig hin- und herklicken muss, aber auch zum ausgewählten Postfach und auch sonst zu allem."

Worktree ROOT/wt-deep-links, branch feat/deep-links (from integration/stage a518409). `bun install` first. Ports 4000–4009 only.

## Today
The app is a single page (app/page.tsx → app/components/MailClient.tsx). The URL is read once on mount (`MailClient.tsx` ~4219: `accountId`, `scope`, `q`, `messageId` (notification jump), `openMessageId`) and then stripped with `history.replaceState`; selection, folder, open thread, settings etc. never show up in the URL, and browser/phone Back leaves the app instead of going from the open mail back to the list. Existing pop-out windows: app/message/window, app/compose/window, app/calendar/window.

## Goal
The address bar always reflects where the user is, so that copying/bookmarking/sharing/reloading the URL reopens the same place, and browser Back/Forward (incl. phone back gesture and the installed PWA) moves between places:
1. Mailbox (account) — priority.
2. Folder (and virtual views such as unified/flagged/assigned/open if present).
3. Open message / thread in the reader (priority) — reload or opening the link lands on that message in its mailbox+folder, list scrolled/selected, reader open (on phones: reader view with "Zurück" going to the list).
4. Search (query + scope), list view options that are already user-visible state (grouping, filter) where cheap.
5. Settings / admin pages and their sub-sections, calendar panel, compose (only "compose open" as a new-message link via the existing `mailto` param — never put draft content in the URL).

## Design constraints
- Prefer real, readable paths if they fit Next App Router cleanly (e.g. `/m/<accountId>/<folder>/<threadOrMessageId>`, `/settings/<section>`), otherwise a clean query-param scheme on `/`; decide, document in repo/doc/SHELL.md (or a new doc/DEEP-LINKS.md), keep old params (`accountId`, `messageId`, `openMessageId`, `mailto`, `openCalendar`, notification jump from the service worker) working.
- Navigation that changes "place" uses pushState (Back works); continuous state (typing in search, scroll, selection moves with the keyboard) uses replaceState or nothing — no history spam.
- IDs only: no subject, sender, e-mail addresses or search text that could leak beyond what the user typed (search query in URL is fine since the user typed it; do not add other PII). Stable IDs that survive a reload/resync (check which message/thread id is stable across sync and shards).
- Authorization unchanged: a link to a mailbox the user has no access to (or lost access to) shows a normal "kein Zugriff"/fallback to the user's default mailbox, no data, no error loop; a link to a deleted/moved message shows a short German notice and the folder. Every load still goes through the existing authorized routes; no new server endpoint unless unavoidable (if needed: authorize by path account id + membership exactly like the existing per-account routes).
- Must work with the mailbox-switch logic (last click wins, A→B→A) — URL changes must not trigger extra switches or double loads; popstate during an in-flight switch → last wins. Keep URL handling in its own module/hook (e.g. app/components/mailclient/useDeepLinks.ts + lib/navigation/*) and touch MailClient.tsx / useAccountController.ts / useMessageData.ts only minimally — two other branches are changing those files right now (perf/mailbox-switch-2, perf/switch-folder-tree).
- Reader-focus paging, saved page size, keyboard navigation, mobile layout (390 px), German UI, i18n (new strings via messages/de.json + en.json) keep working. Pop-out message window: a "Link kopieren" action in the message "more" menu is welcome.

## Done when
- bun check 0; lint 0 new on touched files; focused DOM/unit tests for URL parse/serialize (round trip), push vs replace, popstate, forbidden mailbox, unknown message, legacy params; build OK.
- Browser test (Playwright, synthetic QA fixture, see doc/SHELL.md) covering: open mail → reload → same mail open; copy URL into a fresh context → same place after login; Back from mail → list, Back again → previous mailbox; 390 px phone Back from reader to list; link to a mailbox without membership → fallback, no data.
- Commits on feat/deep-links; report ROOT/briefs/deep-links-report.md (URL scheme table, what is covered, what is not, gates, screenshots). Do not push, merge or deploy.

Rules: ROOT/briefs/_rules-common.md (ROOT=/home/monkey/code/noctua-mail).
