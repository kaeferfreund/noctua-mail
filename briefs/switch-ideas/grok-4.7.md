# Mailbox-switch ideas (grok-4.7)

Read-only pass on `wt-switch-ideas` @ a504783. Times below are from `briefs/perf-mailbox-switch-*.md` and `briefs/perf-mailbox-switch/`. After D1 the warm first-rows range is **191 ms** (large→small) to **479 ms** (into the 50-folder mailbox). The only heavy request left on that path is `GET …/threads?pageSize=300`. Not re-proposed: D1, D3, F1/F2, D2. In flight elsewhere: H, D4, D5 as named in the brief, and the A→B→A click fix.

## 1. T1 — Threads half of the parked server prototype

- **What.** Three behaviour-identical changes, still absent on a504783:
  - S1: `getTopicSuggestionsForThreads` (`lib/topics/suggestions.ts:674`) returns an empty map when `topics` has no row for the account, and `shouldIgnoreTopicSuggestionSignal` (`:111-139`, called per signal at `:165`) memos `ownAddressList` for the call. Wired unconditionally from `app/api/accounts/[accountId]/threads/route.ts:89-93` (`includeSuggestions: true`).
  - S2: `buildTimeGroupKey` (`lib/messageGrouping.ts:42-44`) calls `displayDayNumber(now)` per message, and `buildMessageGroupKey` (`:70`) calls it again. `listThreads` does this for every row (`lib/db/messages/query.ts:3100-3107`). Compute today's ordinal once per request; memo distinct timestamps for that request only.
  - S3: the 300-thread message read (`query.ts:2972-3016`) and `baseCount` (`:2928-2940`) filter `threadId IN (…)` with no index hint. `idx_messages_account_thread_date` already exists (`lib/db/schema.ts:1145`). `INDEXED BY` that index and make the `dateValue` tie-break `rowid ASC`.
- **Why.** Anatomy on the current route: topics+suggestions **20.1 ms** of a 50.7 ms page at 2k messages, topics-only **1.0 ms**. Date keys **4.4 ms** / 900 items. At 11k, rows 10.9→**4.3 ms** and baseCount 5.3→**0.8 ms** with the hint (rows +0.9 ms at 2k). Combined prototype: threads 49.1→**23.1 ms** (2k) and 90.6→**54.0 ms** (11k). That is segment G (108–154 ms on large mailboxes, e2e §9).
- **Gain.** About **26 ms** (2k) and **36 ms** (11k) off the threads request. The prototype's 66.5→38.4 ms also included `/auth/me` 9.6→6.8 ms; D1 already removed that hop, so do not spend the switch on the session-write skip.
- **Downside.** S3 touches `lib/db/messages/query.ts` (FTS work's file). `INDEXED BY` fails if the index is renamed. No cross-request cache, no `ANALYZE`.
- **Overlap.** Parked item (the threads half only).
- **Verify.** Same response hashes as today for a mailbox with no topics, with topics, and at 11k (rows, order, counts). EXPLAIN shows `idx_messages_account_thread_date`. Statement budget: no `thread_signals` read when `topics` is empty. Re-measure threads p50 at pageSize 300.

## 2. F3 — Folder tree does too much on the switch commit

- **What.** `FolderTree` (`app/components/mailclient/folder/FolderTree.tsx:41-94`) is not memoized and passes fresh `hasFolderMatch` / `folderPathLabel` closures every render. Each `FolderTreeNode` (`FolderTreeNode.tsx:63`) calls `useTranslations("List")`, builds an Intl title for every folder (`:102` → `getFolderCountTitle`), and mounts `DropdownMenu.Root` even while closed (`:203`). Hoist one translator to the tree, compute the count title on hover/focus, and mount the menu on open. Memoize the tree on folder id, unread/count, and `activeFolderId` so a later `setMessages` does not reconcile it again.
- **Why.** D1 commits the new folder list in the same render that starts the list effect (`useAccountController.ts:315-318`). The old CPU profile put `IntlMessageFormat` at **212 ms** and Radix at **154 ms** for large→folders, against 64 ms and 63 ms for small→large (e2e §6). Warm first rows into that mailbox are still the slow pair: **471–479 ms** vs **191 ms** into a 6-folder mailbox.
- **Gain.** Estimate **100–200 ms** off first rows when the target has ~50 folders, and a smaller cut on the follow-up render when rows arrive. A 6-folder tree is only a few menus; do not expect the 191 ms case to move much.
- **Downside.** The count tooltip appears on first hover. Drag-and-drop and keyboard activation stay on the row. Do not virtualize the tree in the same change: that risks folder keyboard nav and drop targets.
- **Overlap.** None. H is the message list, not the folder pane.
- **Verify.** DOM: closed tree has no menu node; open still shows sync/rename/delete. e2e first-rows on small→folders and large→folders, plus a 6-folder pair so the common case does not regress. `FolderTree.i18n` stays green.

## 3. G2 — Stop computing date group counts the client discards

- **What.** For `groupBy` `date` / `week` / `year`, `listThreads` still awaits `getThreadGroupCounts` (`query.ts:3111-3138`, SQL at `:1796-1854`) before it returns. `buildGroupedMessages` then replaces those counts with the loaded page length (`app/components/mailclient/messagelist/listModel.ts:251-264`, `countIsLoaded: true`). Skip that query for those three modes. Keep it for sender/domain and for invite/event groupings, where `countIsLoaded` is not set (`listModel.test.ts` asserts that).
- **Why.** The scan was **10.6 ms** of `listThreads` at 11k (server brief §1). The client comment says the SQL buckets are host-local and must not be shown. Segment G.
- **Gain.** About **11 ms** at 11k, a few ms at 2k, on every default switch. Adds to T1; it is not in that prototype.
- **Downside.** Group headers keep showing the loaded count, which they already do. Collapse-all for date buckets only affects buckets that have loaded rows. `total` / `hasMore` / `baseCount` stay.
- **Overlap.** None.
- **Verify.** Date-grouped response: same items, order, `total`, `hasMore`. Header count still equals loaded rows, including the "loaded, not the folder total" title. Sender grouping still returns server counts. No `GROUP BY` date SQL on a date-grouped `listThreads`.

## 4. R2 — Collapsed first paint should not walk every sibling

- **What.** Even after H stops address-parsing hidden rows, `buildGroupedMessages` still copies and sorts the whole page and builds a thread tree over every message (`listModel.ts:163-206`) so it can re-decide the group and the flagged bit. The server already stored `groupKey` from the thread date (`query.ts:3100-3107`). For the default collapsed date view, group by that key and a thread-level flagged bit from the selector (`query.ts:2881-2882` already computes the EXISTS). Keep `getCollapsedThreadFromDisplay` (`threadGroupUtils.ts:270-360`) for the visible rows only.
- **Why.** e2e segment H is **134–412 ms** warm, and the address tokenizer was **114–147 ms** of it. The app chunk was another **~96 ms**. H removes the tokenizer from hidden rows; this is the walk that remains, over ~900 messages (300 threads × ~3) and **860 KB**.
- **Gain.** Estimate **20–40 ms** of main-thread time after H, on every threaded switch. Not a substitute for H.
- **Downside.** Flagged-thread grouping must use the server bit, or a flagged sibling that is not the representative lands in the wrong group. Expand-in-place still needs the siblings that are already in the payload.
- **Overlap.** Overlaps in-flight H. Do this only as the slice H did not take.
- **Verify.** `listModel.test.ts` date, flagged, and done groups stay identical. A performance mark around `buildGroupedMessages` on a 300-thread fixture, before and after.

## 5. S1b — Topic scoring when the mailbox has topics

- **What.** After T1's early exit, a mailbox that has topics still spends the per-thread loop at `suggestions.ts:645-669`: for every first-page signal key it walks every learning row and calls `rowToTopic`. Aggregate `rowsBySignalKey` once per batch (the map is built at `:572`) into `key → topicId → weight`, or `GROUP BY` in the SQL at `:580-599`.
- **Why.** With topics, suggestion work stayed **24–29 ms** after the T1 memo (35.8→24.0 ms at 2k, 43.4→29.1 ms at 11k).
- **Gain.** Estimate **15–20 ms** on a topic-heavy first page. Zero on a mailbox with no topics.
- **Downside.** Same file as T1, request-local only. Scoring must match today's order (`suggestionScore`, `matchCount`, name).
- **Overlap.** Parked item's follow-up; not part of the measured 38.4 ms prototype.
- **Verify.** Normalized suggestion hashes unchanged on the topic fixture, including a topic deleted between two calls.

## 6. I1 — Defer the IMAP consistency POST and the IDLE stream until the first rows commit

- **What.** The consistency effect fires in the same commit as the new folder (`useSyncController.ts:799-901`) and calls `checkFolderConsistency`, which is an IMAP STATUS inside the request. The stream effect opens `EventSource` immediately (`:1247`). Start both from the list's authoritative first page (`setAuthoritativeRevision` in `useMessageData.ts:242`) instead of from `activeFolderId` alone. Do not remove them.
- **Why.** On the old trace they started with the threads request (consistency TTFB **111 ms**, stream TTFB **122 ms**, both ~200 ms after the click). With 50 ms of extra IMAP delay, stream TTFB became **486–671 ms** and first rows moved **+45–63 ms** (e2e §7). One Bun thread runs both. They also take two of the six HTTP/1.1 connections (two SSE streams are already held).
- **Gain.** **0–60 ms** on first rows; more of "settled", and less connection queueing while the threads response is in flight. The in-flight D5 list does not name these two calls.
- **Downside.** New mail and a missed-folder catch-up land one first-page later (~200–400 ms). A switch that is abandoned before rows arrive must still cancel both.
- **Overlap.** Overlaps in-flight D5 (same "after first rows" rule). Confirm they are not already in that change.
- **Verify.** Harness: `threads` is sent and applied before `consistency` and `imap/stream`. A folder change inside one mailbox still runs both. Revoked account: neither request is sent after a 403.

## 7. P2 — First page carries one representative message per thread

- **What.** `listThreads` loads every non-deleted message of the 300 threads (`query.ts:2969-3016`), including `to`/`cc`/`bcc`/`references`, then enriches all of them. The default list is collapsed (`MailClient.tsx:2807`, missing keys count as collapsed). Return the representative row the selector already picked, plus `messageCount` / `unreadCount` from `threads` (`lib/db/accountKeys.ts:106-115`) and a compact participant list for `getCollapsedThreadFromDisplay`. Load siblings with the existing `listThreadMessages` (`query.ts:3144`) on expand.
- **Why.** Payload was **860 KB** and **900 items** for a large INBOX (e2e §4, anatomy). Suggestions, calendar-invite lookup (`query.ts:3040`), and the two attachment `EXISTS` subqueries (`:3010-3012`) all scale with that.
- **Gain.** Estimate about **one third** of segment G's body and of the JSON the client parses, on top of T1. Page size stays 300 threads, so reader-focus paging is unchanged.
- **Downside.** Real contract change. Expand and keyboard entry into an opened thread wait on a fetch. The participant list has to match today's from-line, including "mail I sent shows the other recipients". Ranked here because the ms are real and the risk is higher than T1/G2.
- **Overlap.** None. H's smaller page would change the page size; this does not. D4 still applies to this smaller body.
- **Verify.** Collapsed from-line, unread, attachment, and flagged badges match a full-page fixture. Expand then matches `listThreadMessages`. Reader-focus page size and j/k across collapsed rows stay.

## 8. S6 — One thread-set pass for the INBOX selector

- **What.** The folder path (`query.ts:2868-2941`) runs three statements that each re-evaluate `threadId IN (SELECT DISTINCT m.threadId …)`: the page selector (`:2885`, flagged `EXISTS` at `:2881`), the thread `COUNT` (`:2898`), and `baseCount` (`:2928`). Materialize that id set once per request and reuse it. Same rows and the same flagged-first order.
- **Why.** At 11k those three were **14.2 + 8.8 + 5.3 ms** (server brief §9). G2 removes a fourth scan; this one is still needed for `total` and `hasMore`.
- **Gain.** Estimate **12–18 ms** at 11k, **3–5 ms** at 2k, after T1's index hint (the hint does not rewrite this `IN (SELECT)`).
- **Downside.** Medium. Same file as FTS. A single read transaction would also make the counts match the rows; that is a behaviour change and needs an explicit yes. No `ANALYZE`.
- **Overlap.** Parked item (server brief S6).
- **Verify.** Differential rows, order, `total`, `hasMore`, flagged-first, search, and badge filters against the current statements on the 11k fixture.

## 9. S4c — Short retries for the selection write

- **What.** `setActiveAccountId` (`lib/betterAuth.ts:223-227`) uses `withDbWriteRetry` with the coarse **120 ms** steps (`lib/dbWriteRetry.ts:12-16`). Pass `handshakeRetry` for `SQLITE_BUSY` / `SQLITE_LOCKED`, which that helper already implements (`:79-97`, 1–8 ms, same 2.16 s budget). The statement stays the same.
- **Why.** Quiet switch-account is **4.6 ms** and, after D1, runs in parallel with folders, so it is off the median critical path. Under writer load the same write was p99 **167–457 ms** with 37–82 retries per 60 s, and one exhausted retry became a 500 (server brief §4). The e2e run did not hit `SQLITE_BUSY` on this write; the tail shows up when sync leases collide.
- **Gain.** Estimate p99 **~20–40 ms** under that load. About **0 ms** on a quiet switch.
- **Downside.** Pacing only. Auth code: flag the auth owners. Does not fix the lost update (that is C1).
- **Overlap.** Parked item (server brief S4c, not in the 38.4 ms prototype).
- **Verify.** Held master write lock: the selection update succeeds once the lock drops, inside the handshake budget, and still returns 500 only after that budget.

## 10. A1 — Abort the open message's body fetch when the mailbox changes

- **What.** `hydrateMessageFromServer` (`useThreadContent.ts:199-226`) and `fetchSource` (`:242-304`) have no `AbortSignal`. The account-change effect drops the open message (`MailClient.tsx:4926-4940`) but the in-flight body/source response still runs and then calls `updateMessagesWithCurrentResultPrune`. Abort both when `activeAccountId` changes, and ignore a completion whose account id is not the active one.
- **Why.** A switch with a message open keeps that request on the same origin as the new threads call. HTTP/1.1 allows six connections, two of them SSE (e2e §4). A body response is also server work on the same Bun thread as segment G.
- **Gain.** One fewer in-flight request during the switch when a reader was open. **0** when the list was already the only view. Not a fixed millisecond.
- **Downside.** None for the new mailbox. The updater already matches by message id, so this is not a cross-mailbox leak today; aborting just stops the wasted work.
- **Overlap.** None.
- **Verify.** DOM: switch while a hydration is held; the old URL is aborted, and a late body does not change B's rows or reopen A's message.

## 11. C1 — Compare-and-set on the session selection

- **What.** `ensureActiveAccountId` writes the id it read, unconditionally (`lib/auth.ts:120-121`). Write `WHERE activeAccountId IS <the value this request read>`, and on zero rows re-read and leave the newer value. Callers remain `/api/auth/me` and calendar import.
- **Why.** Not a faster click. A poll that read A and writes after the switch's update puts the server back on A. The next poll (1–30 min) reloads A and `resetSession` drops unsaved compose (review r1 P3-1). D1 does not cover the poll path.
- **Gain.** **0 ms** off first rows. Removes a rare switch that appears to undo itself.
- **Downside.** Auth-owned. Revocation between two requests must still be 401/403 on the second. "Last active" stays at most five minutes.
- **Overlap.** Parked item (`lib/auth.ts:120-121`).
- **Verify.** An `/auth/me` that read A does not overwrite a concurrent switch to B. A revoked member is still rejected on the next request.

## 12. S8 — Stop re-reading the account row on every warm `getAccountDb`

- **What.** `getAccountDb` (`lib/db/connection.ts:392`) calls `ensureCalendarEventRuntimeData` on every open. The warm path still `getAccountById`s just to compare a signature (`lib/db/schema.ts:659-666`) and then returns. The threads route opens the shard several times per page.
- **Why.** Measured **0.21–0.25 ms × 7** inside one threads request (server brief §1, S8).
- **Gain.** About **1–1.5 ms** per first page. Small next to T1.
- **Downside.** The signature must change when own addresses change, or calendar backfill goes stale. Request-local memo is enough; no cross-request role cache.
- **Overlap.** Parked item (server brief S8).
- **Verify.** Second `getAccountDb` in a request does not `SELECT` the account row. Changing an identity still runs the backfill once.

## 13. Q1 — Do not touch the master DB for an empty list query

- **What.** `listThreads` always calls `getAccountOwnAddresses` (`query.ts:2652`) before `parseSearchInput`. That reads `accounts` plus every `sender_identities` row from the master DB (`lib/db/senderIdentities.ts:19-22`). Skip it when `query` is empty and there is no from/recipient filter. The default switch sends no `q`.
- **Why.** The master DB is the same one `setActiveAccountId` writes. The read is cheap alone and only matters if it lines up with that write.
- **Gain.** About **1 ms** quiet, plus one less master reader beside S4c's tail.
- **Downside.** `from:me` and identity matching must still load addresses as soon as a query is present.
- **Overlap.** None.
- **Verify.** Empty-query `listThreads` issues no `sender_identities` read. A `from:` search still excludes own addresses the way it does today.

## 14. N1 — Second tab: the six-connection cap

- **What.** Standalone speaks HTTP/1.1. Each tab holds `/api/me/events` and `imap/stream`. A second tab left the threads request queued **680–930 ms** once (e2e §7); steady state was **+0–150 ms**. I1 frees the stream slot on the switching tab. Serving the app over HTTP/2 (or one shared stream) is the actual fix, and it is operational.
- **Why.** Single-tab threads stall was **0** (e2e §4). This does not move the one-tab median.
- **Gain.** Removes the multi-tab queue. One outlier was **3.6 s** to first rows.
- **Downside.** The other tab still does not follow the switch (review, parked). HTTP/2 is a deploy change, not a local patch. Do not drop the user-events stream to save a socket.
- **Overlap.** Parked item (second tab and HTTP/1.1 limits).
- **Verify.** Two tabs, six-connection log: threads `stall` near 0 after the change. The idle tab keeps its mailbox until its own poll.

## Left alone

- D4, H, the named D5 fan-out (sender icons, four virtual counts, topics/stats, members, reminders, compose preload), and the duplicate first-visit threads reload. Those are the larger remaining hops.
- A→B→A last-click. In flight.
- Full stale-while-revalidate of page 1 (old D6). It shows mailbox data before the fresh authorization returns.
- Optimistic highlight. D1's rule is that only a persisted selection activates.
- Another `/auth/me` on the switch, bundling the threads body into `switch-account`, hover prefetch, `PRAGMA optimize` / `ANALYZE`.

## Summary

The remaining wait is the threads request plus painting it; D4, H, and D5 already target the extra hop, the 300-row derivation, and the side fan-out.
The best measured server change is the parked threads prototype: topic-suggestion early exit, one day-key per request, and the thread index, about 26 ms at 2k messages and 36 ms at 11k. The `/auth/me` half of that prototype is no longer on this path.
The best new client change is the folder tree: every folder mounts a menu and formats a count title, which lined up with the 471–479 ms switches into the 50-folder mailbox.
The default date view throws away the server group-count scan, about 11 ms at 11k, so that query can go without a UI change.
Leave full-list stale-while-revalidate, optimistic activation, and a fresh `/auth/me` off the switch; revocation and "only a persisted selection activates" stay as they are.
