# Review: feat/mailbox-list-cache 9259644 (round 1; correctness + mailbox isolation)

**Verdict: MERGE.** No P0, P1 or P2 findings. Three P3 items go to the backlog (listed below).

Scope: diff `1af46a6..9259644`, covering `mailboxViewCache.ts` (new), `useMessageData.ts`, `useAccountController.ts`, `MailClient.tsx` (+9 lines) and both DOM test files. Read-only. Gates ran in a scratch copy (`git archive 9259644`) under `wt-list-cache/.tmp/review-src`.

## Gates

| Gate | Result |
|---|---|
| merge-tree vs integration/stage | Clean. Stage is still `1af46a6`, and the merge tree `ae5790ab` equals the branch tree, so the branch tests are the merged-result tests. |
| `bun check` | 0 errors (1,321 files) |
| eslint, 3 touched sources + 2 test files | 0 errors, 1 warning: the existing `set-state-in-effect` in useMessageData. The count is the same as the base. |
| focused DOM tests (`useMessageData`, `useAccountController`) | 54 pass, 0 fail |
| full `bun run test:dom` | 738 pass, 0 fail (99 s) |
| scratch race tests (reviewer, not committed) | 3 scenarios, see below |
| build | not rerun. The implementer reports exit 0, and the merged tree is identical. |

Merge note: `feat/deep-links` (01b7727) and `perf/conversation-window` (e17d425) each conflict in `MailClient.tsx` against this branch. Both conflict hunks are in code those branches share with already-merged stage changes (the topics-map / mailto block and the thread-related load), not in the 9 lines added here. Both branches are based on older stage commits (f29fbd6 and b9ff511), so they need a stage merge anyway.

## 1. Isolation (A's data under B): no finding

- **List entries.** The key is the page-1 URL, and the URL contains `/api/accounts/<id>/`. `readList` also requires `entry.accountId === activeAccountId`. `writeList` drops rows with a foreign `accountId` and never stores an empty list.
- **Folder entries.** The key is the accountId, and only folders whose `folder.accountId` matches are stored. `writeFolders` runs only while `sessionKey` is set and the active id is in `accounts`. When the bootstrap sets `folders([])` it does not overwrite the entry, because empty lists are skipped.
- **Write gate.** The reset layout effect sets `shownPageKeyRef = null` on every key change. A write happens only after a successful page-1 read or refresh for exactly `messagesKey`, and that read sets the ref in the same synchronous block as `setMessages`, so the commit that passes the gate holds that read's rows.
- **Read timing.** The cache is read in the layout effect, from the same render as `messagesKey`, `activeAccountId` and the URL, so it never reads a stale mailbox id.
- **Session and account changes.** These clear or prune the cache in layout effects declared before `useMessageData`'s reset (same fiber, so they run in declaration order). A new user's commit therefore reads an empty cache. Logout and a 401 from `/auth/me` set `authState` to unauth, which also clears it.
- **Races.** Aborts and `currentKeyRef` guards are unchanged. In the switch, superseded results return on `version` before anything is written.
- **A→B→A and A→B→C.** Covered by the implementer's tests (list and controller). The reviewer added scratch tests for A→B(cached)→C(uncached), which ends on C with server = C, and for switch OK + folder read 500 on a cached B. The second recovers: the folder effect clears `activeFolderId` while the folder list is empty, then sets the inbox again, so the list reloads. Neither leaks A's data.
- **Switch failure.** A POST 403/500 on a cached view reloads the bootstrap, which goes back to the server selection. On 403 it also drops the mailbox's cache.

## 2. Correctness: no blocking finding

- **Revalidation.** The page-1 read always runs, even when the cached page has `hasMore=false` (`!hasMoreMessages && page > 1`), and it replaces the rows. Removed rows disappear, and unread, flags and collab state come from the server.
- **Local edits made before revalidation.** These bump the mutation version. The read is discarded, `lastRequestRef` is cleared, and the effect reruns on `loadingMessages`, so the edits are written back only after a successful read.
- **No double reload.** On the cached path the prefetch is skipped. The single page-1 GET is the revalidation, and the `lastRequestRef` key/page guard prevents a second one.
- **Page-2 → page-1 fix.** `firstLoadKeyRef` is correct and needed: a layout-effect `setState` flushes the previous commit's passive effects with the stale `messagesPage`. The test covers it.
- **Paging, page size and navigation.** Reader-focus paging, page size (300/600/200) and keyboard navigation run through the unchanged load path. Only page 1 is cached; for a paged-further list it is cut with `firstPageSizeRef`.
- **Open point 5 (a 401/403 now also empties a list that was not cached): acceptable, not a regression.** A 403 means the mailbox is no longer granted, so removing its rows is the safer behaviour. A 401 means the session is gone and the auth flow takes over. The error message stays visible.
- **Open points 1–4.** The cached view staying until the bootstrap replaces it, the revocation delay (user-approved), the "Weitere werden geladen" footer during revalidation, and the selection reset are acceptable.

## P3 (backlog, no fix round)

1. **mailbox switch, `useAccountController.ts:281`.** `reselect` compares with the closure's `activeAccountId`. A cached switch now commits synchronously, so two `switchAccount` calls on the same callback in one tick (A→B(cached)→A) end with view B and server selection A. A reviewer scratch test reproduced this. All current callers (click, effects) rerender between calls, so it is not reachable today. If deep-links/popstate ever calls it twice in one task, compare against `selectedAccount.current` instead.
2. **list cache, `useMessageData.ts:237–251`.** The write effect depends on `firstPageUrl`, while the gate checks `messagesKey`. If the URL changes without a key change (`supportsThreads`, from `threadsAllowed` / `threadsScopeAvailable`, is in the URL but not in the key), the current rows are written under the new URL. Effect: on a revisit the old-shaped rows of the same mailbox show briefly until revalidation. No cross-mailbox impact. The list not reloading in that case is older behaviour.
3. **list cache, `useMessageData.ts:256`.** A 401/403 on any page, including a page-2 load or a folder-level denial, drops the whole mailbox's cache. This costs only speed, not correctness.

Source: this report.
