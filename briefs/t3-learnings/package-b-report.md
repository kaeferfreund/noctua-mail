# Package B — open long conversations fast (headers first, bodies on expand)

- Date: 2026-10-23 UTC.
- Worktree: `/home/monkey/code/noctua-mail/wt-conversation-window`.
- Branch: `perf/conversation-window` (base `integration/stage` `b9ff511e`).
- Status: implemented, self-checked and committed locally. No push, merge or deployment.

## Commits

| SHA | Content |
| --- | --- |
| `1ec1f9bc` | Step 1: headers-only projection (`projection: "headers"`) and SQL folder exclusion (`excludeFolderIds`) on `/thread/related`; list completion and topic-suggestion reads use it; `contentState` on detail/full payloads. |
| `dadbfa05` | Step 2 (server): bounded conversation window with opaque cursors and parent placeholders; SQL unit tests. |
| `06e49b23` | Steps 2 (reader), 3, 4 and the reader part of 5: window in the reader, "Ältere/Weitere Nachrichten laden", bodies on expand with a body cache, detail-first content reads (resync only on `missing`), latest-wins/abortable conversation reads; DOM tests. |
| `2553d46d` | Step 5 (list): the list-completion related read is aborted when superseded. |
| `e17d4257` | Test adjustment: the frozen `getMessageById` reference test checks the new `contentState` field separately. |

Steps 3, 4 and the reader half of step 5 share one commit because they replace the same reader effect and the same hook functions; splitting them would have produced intermediate commits that do not work.

## API contract (`POST /api/accounts/[accountId]/thread/related`)

Unchanged default: without new fields the route returns the full projection as before (MCP and other callers unaffected).

New request fields:

- `projection: "headers"` — rows without `body`/`htmlBody`; `body` is `""`, `contentState` is `"omitted"`. All header, thread, flag, topic, collaboration and attachment-metadata fields stay.
- `excludeFolderIds: string[]` — applied in SQL (max. 400 ids). The client sends trash/spam folders (plus the current folder for list completion; minus the reader's folder and the selected message's folder for the reader).
- `window: { anchorMessageId?, cursor?, before?, after?, pageSize? }` — requires exactly one `threadIds` entry, always headers. Response: `{ items, placeholders, window: { total, anchorId, hasOlder, olderCursor, hasNewer, newerCursor } }`.
  - First response: anchor with up to 10 older and 10 newer rows plus the newest row, ordered by `(dateValue, id)`. Unknown/excluded anchor falls back to the newest row.
  - Cursors are base64url JSON bound to the thread id (a cursor for another thread or a malformed one → 400). Older pages and the gap before the newest row return 20 rows; the newer cursor carries the newest row as exclusive upper bound, so no row is returned twice.
  - `placeholders`: header rows of parents outside the returned rows; the client uses them only to resolve "In Reply To" links (clicking one opens an anchor window around it).
- Message detail (`GET …/messages/[id]`) and the full projection now report `contentState`: `stored` (text/HTML present), `empty` (source stored, no readable content), `missing` (neither content nor source stored).

## Client behaviour

- Opening a message: one header-window read anchored at the selected message, keyed by account+thread+anchor (+evict version, grouping, folder filter). A new key aborts the previous read; only the current read writes the cache and clears its own loading state (`useThreadContent.loadThreadContent`). Deep links and search hits (`openMessageId`, notification jumps) select a message, which becomes the anchor.
- Bodies: each expanded card reads its body from the detail route (parallel per card) into a separate bounded body cache (200 entries, reset on account switch, dropped for a thread on `evictThreadCache`, patched on attachment removal) that is overlaid on header rows. Collapsed cards never read bodies.
- Default collapse: cards without an explicit collapse entry are expanded only for the selected message and the newest unread message. The existing "click selects → collapse siblings" behaviour is unchanged. Two existing isolation DOM tests assumed "no entry ⇒ expanded" and now set their intended state explicitly.
- Resync: no resync before a normal read any more. The detail route is read first; an IMAP resync runs only for `contentState: "missing"` (existing 30 s throttle) or on explicit user request (menu "Re-sync", load-content/retry button). `empty` content is never resynced.
- Reply/forward: `ensureMessageContent` reads the body from the detail route when only headers are loaded (also fixes reply from a list row whose body was never loaded). Print (toolbar) loads the bodies of expanded cards first, then prints.
- New strings (de/en): `loadOlderMessages`, `loadNewerMessages`, `loadingMessages`, `threadLoadError`, `retryLoad`, `loadContentFailed`.

## Sanity number (one run, synthetic 200-message conversation)

Server-side, same shard, 200 linear replies with ~15 KB HTML + ~3 KB text each, selected message #150:

| | Before: full `/thread/related` | After: window | After: selected body (detail) |
| --- | ---: | ---: | ---: |
| Rows | 200 | 22 (+2 placeholders) | 1 |
| JSON raw | 3,812,469 B | 17,821 B | 18,970 B |
| JSON gzip | 43,876 B | 1,243 B | 644 B |
| Query + mapping | 7.5–9.8 ms | 3.8 ms | 1.6 ms |
| JSON.parse (Bun) | 2.4 ms | 0.1 ms | <0.1 ms |

The gzip figures are flattered by the repetitive synthetic text; real mail compresses far less, so the raw ratio (3.8 MB → 37 KB for window + selected body) is the more meaningful number. Topic/collaboration enrichment now runs for 22 instead of 200 rows (not timed). Click → first card was not measured in a browser: that needs the fixture IMAP server, a fresh app instance, sign-up and sync, which the brief excludes as harness work. Before, the selected body appeared only after the full related response; now the selected card's body request starts at the same time as the window request and does not depend on it.

## Gates

- `bun check`: 0 errors.
- ESLint on all touched files compared with `b9ff511e` (stdin with the same file path): 0 new errors or warnings (MailClient 73 → 72 existing warnings).
- Unit: `lib/db/messages/threadWindow.test.ts` (projection, folder exclusion, account isolation, window bounds, cursor walk with no gaps/duplicates, equal dates, placeholders, deep-link anchor, unknown anchor, invalid/foreign cursor). Focused unit run over `lib/db`, `lib/ui`, `app/api`, `app/components/mailclient` and related DB tests: 1395 tests, 0 failures after the frozen-reference adjustment (`e17d4257`; 12 failures before it, all in `senderKey.retrieval.test.ts`, caused only by the new field).
- DOM: new `app/components/mailclient/conversationWindow.dom.test.tsx` (expand-fetch, newest unread expanded, older/newer page buttons, retry on failed body read, abort + latest-wins on fast thread switching, older page merge, reply on a not-yet-loaded body without resync, resync only on `missing`, no resync on `empty`, print loads expanded bodies first). Full `bun run test:dom`: 716 pass, 0 fail.
- `bun run build`: OK.
- Full `bun run test:ci` not run (per AGENTS.md rule 4 it runs on the stage head).

## Open points

- No browser screenshots at desktop/390 px of the new "Ältere Nachrichten laden" control (layout: centered, wrapping soft button above the first card; "Weitere Nachrichten laden" before the newest card).
- Rows from the current folder list that lie outside the window are still merged into the reader (as collapsed header rows), so the number of rendered cards is not bounded by the window; reader virtualisation (rendering.md §8) remains separate.
- The detail route still computes topic suggestions per call when a thread has no topics; with bodies on expand this runs once per expanded card. A content-only detail variant could avoid that if it shows up in practice.
- Window state of threads evicted from the 50-thread cache is not pruned (small, replaced on the next open).
- The list-completion abort has no dedicated DOM test (MailClient-level); it is covered only by the existing mailbox-switch DOM tests passing.
- Not touched as instructed: `useMessageData.ts`.

## P2 fix (orchestrator, 2026-10-23 22:20 UTC)
- Load buttons only when the rendered rows of the thread do not yet cover the window total (`getThreadWindowPageControls` in threadViewState.ts, used by ThreadView.tsx); new DOM test in conversationWindow.dom.test.tsx. The fix task was interrupted by a T3 restart before committing; gates rerun by the orchestrator (bun check 0, eslint clean, test:dom 733/0).
- Fix task gates on the same tree: `bun run build` OK; focused DOM (conversationWindow + `message/*` + ThreadView isolation) 44/0; `threadViewState.test.ts` 13/0; eslint on the three touched files 0 problems.
- Limitation: completeness is judged by count (rendered rows with the window's `threadId` ≥ `window.total`). When the list covers only part of the thread and both cursors are open, both buttons still show, even if one direction is already fully on screen. Resolving that needs per-gap counts from the server. Not done here (scope: this P2 only).
