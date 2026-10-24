# mailbox-list-cache: instant switch back to a visited mailbox (report)

Branch `feat/mailbox-list-cache` (worktree `wt-list-cache`), from integration/stage `1af46a6`.
Commit: `92596449` perf(mailbox-switch): show a visited mailbox at once from an in-memory view cache.
Not pushed, not merged.

## What changed

| File | Change |
|---|---|
| `app/components/mailclient/mailboxViewCache.ts` (new) | `MailboxViewCache`: in-memory, per tab. Stores the first list page per page-1 list URL (max 8, LRU) and the folders per mailbox (max 8, LRU). `useMailboxViewCache` clears it when the session changes (logout, other user), prunes mailboxes that are no longer in the account list, and keeps the active mailbox's folders (with counts) current. |
| `useMessageData.ts` | The key-change reset is now a layout effect and starts from the cached first page when there is one. The page-1 read always runs and replaces it. The page on screen, including local changes (read state, deletions, moves), is written back once a read has confirmed the key. A 401/403 from a list read or refresh clears the rows and drops that mailbox from the cache, then the normal error appears. Free-text and related searches are not cached. |
| `useAccountController.ts` | `switchAccount`: if the target mailbox has cached folders, the view commits on the click, before the switch POST and folder read return. Both still run and are authoritative: fresh folders and counts replace the cached ones, and a folder the user opened in the meantime stays open while it still exists. If the switch fails (any error), the server view is reloaded via bootstrap; on 401/403 the mailbox is also dropped from the cache. Without cached folders the path is unchanged (prefetch + commit after both requests). |
| `MailClient.tsx` | +9 lines: creates the cache (`sessionKey` = user id while `authState === "ok"`, account ids, active account, folders) and passes it to both hooks. |

### Isolation (never A's data under B)
- List entries are keyed by the page-1 URL (`/api/accounts/<id>/…?folderId=…&groupBy=…`). Every read also requires `entry.accountId === activeAccountId`. Rows with another `accountId` are filtered out when writing.
- An entry is written only while `shownPageKeyRef === messagesKey`, meaning a successful read for exactly this key is on screen. The reset now also sets `shownPageKeyRef` to null on every key change. Without that, after A→B→A the previous list could have been written under A's URL for one commit.
- Races: superseded loads are aborted as before, and `currentKeyRef` guards stay. A→B→A and A→B→C are covered by tests: the last click wins, and B's late answer changes nothing on A or C.
- Empty lists are never cached. If a list is emptied on screen, its entry is dropped, so a revisit loads normally.

### Bug found and fixed along the way
When the key changed while a later page was current (for example page 2 loaded, then a folder click), the load effect ran with the old `messagesPage` before the reset rendered. It requested **page N of the new key** first. With the cache this would have appended page-N rows to the cached page 1. A new key's first load now always reads page 1 (`firstLoadKeyRef`). There is a test for it, and it fails on the old code.

### Kept as before
- Switch POST and folder read run in parallel. No second list read: the revisit does exactly one page-1 GET, and that GET is the revalidation. The prefetch is skipped when the view comes from the cache, because the list's own page-1 read starts at once anyway.
- Paging (`pageSize` 300/600/200 from the URL), keyboard navigation and reader-focus paging use the unchanged load path. If a list was paged past page 1, only its first page is cached.
- Unread state, flags and collab state come from the fresh response, which replaces the rows; React keys stay stable, so the scroll position is kept.
- No UI or text changes, so nothing new for German or 390 px.

## Gates

| Gate | Result |
|---|---|
| `bun check` | 0 errors (1,321 files) |
| eslint on the 4 touched source files + tests | 0 errors; 73 warnings = same count and rules as base `1af46a6` (MailClient 72, useMessageData 1 pre-existing `set-state-in-effect`); `mailboxViewCache.ts` / `useAccountController.ts` 0 |
| `bun run test:dom` (full DOM suite) | 738 pass, 0 fail |
| `bun test app/components/mailclient` | 595 pass, 0 fail |
| `bun run build` | exit 0 |
| full `bun run test:ci` | not run (per AGENTS.md rule 4: hourly on stage) |

New tests:
- `useMessageData.dom.test.tsx`
  - The revisit shows the cached rows right after the rerender, with no awaits and every fetch held. The re-read then replaces them: a removed row disappears, a new row appears, unread comes from the server.
  - A cached page with "no more" is still re-read exactly once.
  - Local removals are kept on a revisit.
  - A→B→A and A→B→C races.
  - Cache is keyed by folder and view; searches are not cached; no read under another mailbox.
  - A 401 or 403 on the re-read clears the rows and the mailbox's cache and shows the error.
  - The first load of a new key reads page 1.
  - Cache lifetime: logout and session change clear it, a revoked mailbox is pruned, the 8-entry bound, mixed or empty rows.
- `useAccountController.dom.test.tsx`
  - The cached folders are shown on the click before any answer. Fresh folders and counts replace them, and a folder opened in the meantime stays open. No `/auth/me`.
  - A→B→A with both cached ends on A, persisted last.
  - A 403 or 500 on the switch reloads the server view; a 403 also drops B from the cache.

## Sanity number
- On a warm revisit the rows are in the commit of the click, and **no request is awaited**. The list GET, the switch POST and the folder read all run afterwards as revalidation. The DOM tests assert this with all fetches held.
- Hook level (happy-dom, 300-row page, n = 20): click → rows **1.8 ms** median from the cache. Without the cache it is 4.7 ms, and that is with a zero-latency fake fetch.
- For reference, the switch-2 report measured warm first rows at 148–181 ms median in the browser. Most of that is the network round trips this change takes out of the visible path.
- No browser e2e measurement. It would need the seeded e2e harness, and the brief says not to measure.

## Open points / for the review
1. **Optimistic switch before the POST** (user decision, per brief). If the POST or the folder read fails, the cached view stays briefly and is then replaced by the bootstrap's server view. Check that this transition is acceptable.
2. **Revocation delay.** A revoked mailbox can show cached data until the switch POST or the list re-read returns 403, or until the account list refresh prunes it. The user accepted this ("das ist egal").
3. **"Weitere werden geladen" footer.** It appears at the end of the list while the cached page is being re-read, because `loadingMessages` is true. It is usually off-screen; no change made.
4. On a revisit the selection is cleared as before (`resetMailboxView`); only the scroll position within a revalidation is kept.
5. The 401/403 clearing also applies to a list that was not loaded from the cache: a denied list read or refresh now empties the list instead of keeping old rows next to the error. This is intentional, but it is a behaviour change.
6. Merge note: `MailClient.tsx` changes are limited to imports, one `useMemo` and the hook call arguments (around lines 209 and 1291–1345, plus the `useAccountController` argument list). This keeps conflicts with feat/deep-links and perf/conversation-window small.
