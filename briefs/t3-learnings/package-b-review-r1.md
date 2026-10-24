# Review: perf/conversation-window 91ba9ce (one round: API contract + correctness)

- Date: 2026-10-23 UTC. Read-only; worktree unchanged, no commits.
- Scratch: `wt-conversation-window/.tmp/review-src` (`git archive 91ba9ce`) and `.tmp/merged-src` (merge-tree of 91ba9ce with stage head `5a004911`).
- Evidence: `briefs/t3-learnings/package-b-evidence/` (16 screenshots, `review-results.json` with captured requests, review spec as `.txt`).

## Verdict: FIX (one P2, fix once in the branch; no verification task needed)

No P0/P1. One P2 (load controls shown for messages that are already on screen). Everything else is P3 and goes to the backlog.

## Gates

| Gate | Result |
| --- | --- |
| `bun check` (91ba9ce) | 0 errors |
| ESLint on touched files vs `1af46a6` | 0 errors; no new warnings (MailClient 72 → 71) |
| Focused unit (`threadWindow`, `senderKey.retrieval`, `threadViewState`, `lib/ui`, `mailclient/utils`) | 187 pass, 0 fail |
| Unit `lib/db app/api app/components/mailclient lib/ui` | 1351 pass, 0 fail |
| `bun run test:dom` (91ba9ce) | 732 pass, 0 fail |
| `bun run build` | OK |
| Browser run (production build, fixture IMAP, port 4090, de-DE) | passed; screenshots below |
| Merge-tree vs current `integration/stage` `5a004911` (incl. deep links + scroll anchors) | clean (tree `f28b15b`) |
| On the merged tree: `bun check` / `bun run test:dom` / focused unit | 0 errors / 772 pass, 0 fail / 160 pass, 0 fail |

Note: stage moved three times during the review (1af46a6 → ea42486 → reset → f8e18c2 → 5a00491). Merge-tree against each head was clean.

## 1. API

- Default `/thread/related` (no new fields) still returns the full projection; the only change is the additional `contentState` field (additive). Existing callers are unaffected.
- `projection: "headers"`: column list omits only `body`/`htmlBody`; mapped rows have `body: ""`, `contentState: "omitted"`. Folder exclusion is in SQL (capped at 400).
- Window: `(dateValue, id)` keyset with exclusive bounds; the anchor ±N plus newest; the newer cursor carries the newest row as an exclusive upper bound, so there are no duplicates. Equal dates, cursor walk, foreign/malformed cursor (400), unknown anchor → newest, and placeholders are covered by unit tests. Verified live: anchor at the oldest message of a 39-message thread returned 12 items (0–10 + newest), `hasOlder:false`, `hasNewer:true`, and 1 placeholder (the newest row's parent).
- Authorization unchanged: `requireAccountContext(minRole: "viewer")` on the path account id; all SQL filters by `m.accountId = ?` on the account DB. There are no folder-level ACLs that could be bypassed. Account isolation is covered by a unit test.
- `contentState` on detail: `stored` / `empty` (source present, no readable content) / `missing`. Logic in `lib/messageContentState.ts` matches the brief.

## 2. Reader

- Bodies on expand: confirmed in the browser. Opening a 48-message conversation made one header-window request (33.6 KB) and **one** detail request (the selected/newest-unread card, 3 KB). Collapsed cards made no detail requests. Loading 20 older headers made one request (48 KB) and no body reads.
- Default expansion = selected + newest unread (`getDefaultExpandedMessageIds`); scroll-to-active uses the same rule.
- Resync only for `missing` (`needsMessageContentHydration` ignores `omitted`/`empty`); a 30 s throttle prevents loops. DOM-tested.
- Reply/forward: `ComposeOrchestrator` → `ensureMessageContent(..., {manual:true})` → `loadMessageBody` when headers only. Print: `printWithLoadedBodies` loads the expanded unloaded cards first. Both are DOM-tested.
- Translation, remote-content blocking and collab use the card's message object, which is the header row with the body cache overlaid (`withLoadedMessageBodyMemo`); header fields stay authoritative.
- Latest-wins: `loadThreadContent` aborts the previous key, writes the cache and clears loading only for the current entry, and is aborted on deselect, unmount and account reset. DOM-tested.
- Body cache: key `${accountId}:${id}` with LRU 200. It is cleared in `resetThreadCache` (account switch and manual evict), reads started before a scope change are dropped (`scopeVersionRef`), and `withLoadedMessageBody` checks the id. Mailbox A's body cannot show under B.
- Deep links (now on stage): `openMessage(resolved)` selects the message, and the reader effect anchors the window at it (no cache hit). Search hits open a window only when the thread view is active; in search scope the reader shows only the hit (existing behaviour).

## 3. UI (screenshots, synthetic data, German)

`conv-open-{1440,390}-{light,dark}.png`, `conv-older-loaded-*`, `conv-anchor-*` ("Weitere Nachrichten laden" between the window and the newest message), `conv-anchor-all-loaded-*`. Buttons are centred soft gray and wrap correctly. No horizontal overflow at 390 px. Labels: "Ältere Nachrichten laden", "Weitere Nachrichten laden". No layout breakage.

### P2 — load controls appear for messages that are already rendered

- Where: `ThreadView.tsx` (`threadWindow?.hasOlder` / `hasNewer` → `renderPageControl`) together with `MailClient.tsx` `activeThreadHeaders`, which merges every list row of the thread (`activeLocalThread`) into the reader.
- What: in the threaded inbox the list already holds all members of a conversation (including cross-folder rows), so the reader renders every card. The window still reports `hasOlder`/`hasNewer`, so "Ältere Nachrichten laden" sits above message 0 (`conv-open-1440-light.png`) and "Weitere Nachrichten laden" sits between messages 38 and 39 although 30–38 are on screen (`conv-anchor-1440-light.png`). Clicking makes a request and changes nothing visible. The older control stays after the first click (three clicks are needed for 48 messages).
- Fix (once): show a control only when rows in that direction are actually missing from the rendered thread. For example, hide both controls when the rendered thread already covers `window.total`, or compare against the oldest and newest rendered rows. Add a DOM test with list rows covering the thread.

## 4. Merge resolution (MailClient list-completion effect)

The resolution is correct. `controller` and `clearThreadRelatedMessages` are both declared. Every early-return path calls `clearThreadRelatedMessages()`. The fetch passes `signal`, the response and exception paths check `controller.signal.aborted` before writing state, and the effect returns `() => controller.abort()`. `excludeFolderIds: [activeFolderId, ...excludedFolderIdsForThreads]` matches the removed client filter (`checkIsThreadExcludedFolder` = membership in the same set). The merge with stage `5a004911` is clean, and the merged DOM suite is green.

## P3 (backlog only, no fix round)

1. reader — Detail (body) reads are not aborted on fast thread switching; results land in the body cache (harmless, wasted requests). After an account switch they are dropped, but the requests still run.
2. thread/related — Header rows are ~2.4–3 KB each (topic and collab enrichment with `includeSuggestions: true` for every window row); suggestions could be limited to the anchor.
3. detail route — Topic suggestions are computed per expanded card when the thread has no topics (already listed by the implementer).
4. db — The full projection now runs `hasHtmlContent` (HTML text extraction) per row to compute `contentState` for default callers (MCP, other full reads). This adds CPU on large threads.
5. reader — When the reader is in Trash/Spam, the window includes other folders, but only same-folder rows are rendered. The load controls can then fetch rows that are never shown.
6. reader — "Thread JSON" debug modal now shows header rows only (no bodies).
7. reader — `mergeThreadWindowItems` sorts equal dates with `localeCompare`, while SQL uses binary order. This is display-only and only affects equal timestamps.
8. reader — Window state of threads evicted from the 50-thread cache is not pruned (already listed by the implementer).
9. scroll anchors (stage) — A saved reader anchor on a card that came from an "older" page is not found after a revisit, because the new window starts at the anchor again. Restore then falls back.
10. sync (pre-existing, not this branch) — A message synced before its thread root exists in another folder gets its own `threadId` (seen with the fixture: an inbox reply to an unsynced Archive thread).

## Cleanup

Review scratch (`review-src`, `merged-src`, logs, temp test DB) removed from `wt-conversation-window/.tmp`. `.tmp` is empty. The harness stopped every server it started (`serversStopped: true`), and nothing is listening on ports 4090–4099. The worktree is unchanged (`git status` clean).
