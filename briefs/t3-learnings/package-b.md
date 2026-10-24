# Package B — open long conversations fast (headers first, bodies on expand)

User approved 2026-10-23 ~20:15 UTC; no separate measurement phase ("bei offensichtlichen Verbesserungen brauchen wir nicht messen"). Worktree ROOT/wt-conversation-window, branch perf/conversation-window (from integration/stage b9ff511). `bun install` first. Ports 4060–4069.
Background: ROOT/briefs/t3-learnings/_dedup.md cluster L; data-loading.md §1–4, §8 (T3 PRs #5482, #5493, #9760, #15385, #17029, #19423); rendering.md §8.

## Today
- Opening a conversation calls /api/accounts/[accountId]/thread/related (route.ts ~17/45, lib/db/messages/query.ts ~3219–3234: unbounded `SELECT m.*`, full bodies + HTML, enrichment for every related message); list completion (MailClient.tsx ~4462) also receives full bodies and discards some.
- useThreadContent.ts ~172 may POST /resync before reading the local detail route.
- MailClient.tsx ~4632: detail reads have no AbortSignal / generation guard; a late response can fill the cache or clear the shared loading flag after the user moved on.

## Do (in this order, one commit each)
1. Headers-only projection for related/list-completion reads (ids, thread/parent/reference fields, from/to/date/subject/snippet, flags, topics, collab, attachment meta — no body/HTML), with folder exclusions in the SQL. Keep the existing full-detail path for callers that need it.
2. Conversation window: first response = selected message ± ~10 + newest, with opaque cursors / hasMore for older/newer and parent placeholders where the tree crosses the window; "ältere Nachrichten laden" in the reader. Deep links / search hits to an old message open an anchor window around it.
3. Bodies on expand via the existing authorized message detail route (already gzip-capable); collapsed cards never fetch bodies. Expanded-by-default cards (the selected one, last unread) fetch immediately in parallel.
4. Resync only when the server says content is really missing (explicit state "not stored" vs "empty"), or on user request — not before every normal read.
5. Detail/related reads: AbortController + latest-wins guard per account+thread; loading state owned per request.
Keep: print, reply/forward quoting (fetch the needed body on demand), collab notes/assignment, reader-focus paging, keyboard nav, translation, remote-content blocking, mobile 390 px, German UI (new strings in messages/de.json + en.json). Coordinate: deep links (feat/deep-links in review) use openMessageId — make sure an anchor window works for it; perf/mailbox-switch-2 and a list-cache branch change useMessageData.ts — do not touch it.

## Done when
bun check 0; lint 0 new on touched files; unit tests for the projection/window SQL (window bounds, cursors, parent placeholders, folder exclusion, account isolation); DOM tests for expand-fetch, older-messages load, abort on fast thread switching, reply/print on a not-yet-loaded body; build OK; a quick before/after sanity number for a 200-message synthetic conversation (bytes + click→first card) — just one run, no harness work. Commit on the branch; report ROOT/briefs/t3-learnings/package-b-report.md. One review follows (API contract + correctness). No push/merge/deploy. Rules: ROOT/briefs/_rules-common.md.
