# Spike B: mailbox switch latency, client code path

Base: `647359b` (dev preview, round 9.1). Read-only spike. Harness, prototype, draft tests and raw traces are in `briefs/perf-mailbox-switch/client/` (see its README).
Siblings: A measures the real switch end to end, C profiles the server routes. This brief counts **round trips and requests**; A and C supply the milliseconds.

## Summary

- **The awaited chain is 4 sequential round trips before the new list can show:** `POST /api/auth/switch-account` → `GET /api/auth/me` → `GET /api/accounts/B/folders` → `GET /api/accounts/B/threads`. Every hop waits for the previous one. The `/auth/me` hop is a full re-bootstrap (`loadInitialData`) that the switch does not need.
- **Requests per switch:** 23 on every later switch, 31 on the first visit to a mailbox in a session (that adds the one-time startup sync). Only 4 of them are needed for "list shown".
- **The old mailbox keeps working after the click.** Once `switch-account` returns, the client clears `activeFolderId` while `activeAccountId` is still A. A MailClient effect then re-selects **A's INBOX**. That fires a 300-row thread list for A, a consistency `POST` for A, and two IMAP stream reconnects for A.
- **That stale A list request blocks B's list.** `useMessageData` refuses to start a load while any load is in flight. In the hold-stale trace, B's list is not even requested until A's stale request completes.
- **One IMAP stream is needed per switch; 4 are opened:** A without a folder, A with its folder, B without a folder, B with its folder.
- **Two existing wrong-mailbox flashes:** with B already highlighted, the sidebar still shows **A's topic names** for 1 round trip and **A's virtual-folder counts** ("Focused: 7 unread") for 2.
- **Fix with the best saving per risk (D1), entirely inside `useAccountController.ts`:** send `switch-account` and B's folder read in parallel, commit the whole switch in one batch, and drop `/auth/me`. Prototype results:
  - chain 4 → 2 round trips;
  - 23 → 16 requests (31 → 24 on a first visit);
  - stale old-mailbox requests 2 → 0, and the head-of-line blocking is gone;
  - IMAP stream opens 4 → 1;
  - MailClient commits per switch 14 → 7.

  Invariants (a), (b) and (c) are covered by tests (see D1). No MailClient change.

## 1. The switch, step by step (baseline `647359b`)

The trigger is any `switchAccount(id)` call: the sidebar row (`MailClient.tsx:5372` → `ShellSidebar.tsx:90`), the mailbox gate (`MailClient.tsx:5322`), a deep link at mount (`:4166`), a service-worker notification click (`:4209`), the pending-jump effect (`:4663`), or a jump to a message in another mailbox (`:5013`). All of them end in `useAccountController.ts:206`.

Wave = number of round trips the step waits for (from the harness). Cost class: **C** = on the critical path to "list shown"; **S** = stale or redundant server work; **F** = fan-out in parallel (competes for the server, but is not awaited); **R** = render only.

| # | Step | file:line | Wave / awaited? | Needed? | Class |
|---|---|---|---|---|---|
| 1 | Click. No visual feedback yet: the row highlight follows `activeAccountId`, which changes only at step 6 (2 round trips later). | `ShellSidebar.tsx:89-90` | 0 | — | R |
| 2 | `POST /api/auth/switch-account` is awaited. The server checks membership, writes the session selection, and checks membership again. | `useAccountController.ts:211` | 0, **awaited** | Yes: persists the selection for reload (the authorization is repeated by every per-account route anyway, see §4) | C |
| 3 | 15 setters reset the list, search and folder state: `setMessages([])`, `setActiveFolderId("")`, … `activeAccountId` is **still A**. | `useAccountController.ts:219-234` | 1 | Partly: these resets belong in the same commit as step 6 | R |
| 3a | The folder-selection effect sees account A with folder `""` and re-selects **A's INBOX**. | `MailClient.tsx:4810-4826` | 1 | **No (stale)** | S |
| 3b | → `GET /accounts/A/threads?…folderId=A:INBOX` (300 rows). It sets `loadingMessages=true`, which blocks B's load at step 9. | `useMessageData.ts:180-214` | 1 | **No (stale), and blocks B** | S + C |
| 3c | → `POST /accounts/A/folders/A:INBOX/consistency`. The repair guard was cleared by the folder change. | `useSyncController.ts:780-785`, `:787-878` | 1 | **No (stale)** | S |
| 3d | → IMAP `EventSource` for A is reopened twice: without a folder, then with A:INBOX (effect deps include `activeFolderId`). | `useSyncController.ts:1223`, `:1386` | 1 | **No** | S |
| 4 | `await loadInitialData()`: `setInitialDataReady(false)`, `setInitialFoldersLoadedAccountId(null)` | `useAccountController.ts:131-135` | 1 | No: the shell flips into its loading state | R |
| 5 | `GET /api/auth/me` is awaited: full user, accounts and security read plus a session UPDATE (86 statements at 12 mailboxes; p99 599 ms under writer load per `perf-account-batching-task.md`). | `useAccountController.ts:137` | 1, **awaited** | **No.** Accounts, user and security did not change because of a switch. Membership changes arrive as `mailboxes-changed` events (`MailClient.tsx:2844`) and through the session-refresh poll (`:4246-4272`). | C |
| 6 | Commit `setAccounts`, `setActiveAccountId(B)`, `setFolders([])`. The row highlight moves now. `accountFolders` is empty. | `useAccountController.ts:174` | 2 | Yes (account id); `setFolders([])` creates an extra empty interval | R |
| 6a | Fan-out for B: `topics`, `topics/stats` (idle), `calendar/events`, `members` (useThreadCollab, no thread selected), `recipient-aliases` (idle, `invalidate()` on every switch), and `reminders` (first visit only). | `useTopics.ts:56-80`, `useReminderNotifications.ts:270-330`, `useThreadCollab.ts:153-170`, `useRecipientAliases.ts:27-31` | 2 | Needed eventually, not before the list | F |
| 6b | Compose reloads sender settings eagerly: `identities` + `prefs` + **a second `/api/auth/me`**. | `ComposeOrchestrator.tsx:352-357` | 2 | **No.** Every compose open loads its own snapshot (`:1200`), and `resetSession` has already closed compose on the switch. | S |
| 6c | 4 virtual-folder counts with **empty exclusions**, because folders are still `[]`. They are aborted once the folders land, but the server has already done the work. | `useSearchState.ts:209-253` | 2 | **No (duplicate)** | S |
| 6d | Sidebar still shows **A's topics** (`useTopics.ts:84`: `allTopics` is not keyed by account) and **A's virtual counts** (`useSearchState.ts:141-148` only resets when there is no account). | | 2 | **Bug: wrong-mailbox content** | R |
| 7 | `GET /api/accounts/B/folders` is awaited. | `useAccountController.ts:176` | 2, **awaited** | Yes | C |
| 8 | `setFolders(B)` and `setInitialDataReady(true)`. The effect at `MailClient.tsx:4810` selects B's INBOX in the **next** commit. | `useAccountController.ts:179-184` | 3 | Yes | R |
| 8a | IMAP `EventSource` for B is opened twice: once without a folder, once with B:INBOX after the next commit. | `useSyncController.ts:1223` | 3 | 1 of 2 | S |
| 8b | `POST /accounts/B/folders/B:INBOX/consistency`. Per-account fingerprints are cleared on every account change (`useSyncController.ts:224-236`). | `useSyncController.ts:805` | 3 | Yes as a catch-up (B had no stream while inactive), but not before the list | F |
| 8c | 4 virtual counts again, with the correct exclusions. | `useSearchState.ts:209` | 3 | Yes | F |
| 8d | First visit in the session only: startup sync `POST /sync` → `sync/status` → list refresh + 4 counts. | `useStartupSync.ts:46-80` | 3-5 | Yes (once per session per mailbox) | F |
| 9 | `GET /api/accounts/B/threads?…` (page 1). It starts only after the stale 3b request has finished (`useMessageData.ts:184`). | `useMessageData.ts:189` | 3, **awaited** | Yes | C |
| 10 | List rows for B render. | | **4** | | R |

Caches the switch drops, all refetched on every switch back:
- folders (`setFolders([])`);
- list pages (`useMessageData` reset on `messagesKey`);
- thread content LRU (`resetThreadCache`, `MailClient.tsx:4873`);
- collab summaries for the account (`MailClient.tsx:2831`);
- topics and stats (`useTopics`);
- recipient aliases (`resource.invalidate()`, refetched at idle);
- calendar events, members, consistency fingerprints.

Kept across a switch:
- recipient suggestions (`recipientCacheRef`, keyed by account);
- the once-per-session startup-sync marker (sessionStorage);
- the user-wide summary stream `/api/me/events` and `/api/me/mailboxes/summary`. These are **not** reconnected on a switch: the `sessionKey` is the user id.

## 2. Counting test results

Harness: `briefs/perf-mailbox-switch/client/switchRequests.spike.dom.test.tsx`. It mounts the real `MailClient` with gated waves (details in the README). Synthetic fixtures (`example.test`).

| Run | List shown after | Requests | Stale old-mailbox requests | IMAP stream opens | MailClient commits |
|---|---|---|---|---|---|
| Baseline A→B (first visit) | **4** round trips | **31** | 2 (A threads, A consistency) | 4 (2 A, 2 B) | 16 |
| Baseline B→A, A→B (revisits) | **4** | **23** | 2 | 4 | 14 |
| D1 prototype A→B (first visit) | **2** | 24 | 0 | 1 | 9 |
| D1 prototype revisits | **2** | 16 | 0 | 1 | 7 |
| Baseline, stale A list held | **list not shown** until A's stale request completes | 30 | 2 | 4 | — |
| Deep-link boot `?accountId=B` (baseline → D1) | B list requested in wave 3 → wave 1 | 36 → 31 | — | — | — |

Baseline revisit, by wave (`trace-base.json`):
- **wave 0:** `switch-account` (1)
- **wave 1:** `/auth/me` · A `threads` · A `consistency` (3)
- **wave 2:** B `folders`, `identities`, `prefs`, `/auth/me` (compose), `topics`, `topics/stats`, `calendar/events`, `members`, `recipient-aliases`, 4 counts with empty exclusions (13)
- **wave 3:** B `consistency`, B `threads`, 4 counts (6)

Duplicates per switch:
- 2× `/auth/me`;
- 2× each of the 4 virtual counts;
- the IMAP stream opened 2× for each mailbox;
- the stale A list and consistency requests.

Wrong-mailbox probe (baseline; same with D1 until the fixes F1/F2):

```
wave 1: active=A rows=-        topics=A  counts=A
wave 2: active=B rows=-        topics=A  counts=A   ← A's topic names and counts under B's header
wave 3: active=B rows=-        topics=B  counts=A   ← A's counts under B's header
wave 4: active=B rows=B        topics=B  counts=B
```

**No list rows** of another mailbox were ever visible: `currentKeyRef` and the foreign-row checks in `useMessageData` hold.

## 3. Designs, ranked by saving per risk

Owner constraints from the integration thread apply:
- Do not touch `MailClient.tsx`, `ShellSidebar.tsx`, `AppShell.tsx` or `ShellPanes.*` until round 10 is merged.
- Free to change: `useAccountController.ts`, `useStartupSync`, `useEmptyFolderRepair`, the SSE/stream hooks, and the server routes.
- Invariants: (a) folderAccountGuard, (b) identity-stable `loadInitialData` deps, (c) no caching that delays revocation.

### D1. Parallel, atomic switch without `/auth/me` (rank 1)

- **Files:** `app/components/mailclient/useAccountController.ts` (**FREE**) and `useAccountController.dom.test.tsx`. **No MailClient change.** The prototype diff is `client/useAccountController.proto.diff` (152 diff lines with context).
- **Change:**
  1. `switchAccount` sends `POST /auth/switch-account` and `GET /accounts/B/folders` with `Promise.all`.
  2. Only when **both** are OK does it commit in one batch: the existing resets, `setMailboxState("selected")`, `setActiveAccountId(B)`, `setFolders(B)`, `setInitialFoldersLoadedAccountId(B)`, `setActiveFolderId(findInboxFolder(B) ?? folders[0])` (the same expression as `MailClient.tsx:4819`), and `setInitialDataReady(true)`. `selectedAccount.current = B` keeps a later bootstrap from resetting the view.
  3. There is no `loadInitialData()` call and no `setInitialDataReady(false)` flip.
- **Coordination rules** (prototype; tested):
  - A `switchVersion` ref means only the latest switch commits (A→B→C commits C).
  - A switch owns the selection while it runs. A bootstrap that overlaps it (a `mailboxes-changed` event, or the mount bootstrap on a deep link) still publishes user, security, TTL and accounts, but skips the selection and folder steps. Exception: `mailboxState` is not `selected` (for example, all memberships revoked). Then the bootstrap's result wins.
  - If the switch then fails, the deferred bootstrap is re-run.
  - On 401/403 from either request, nothing is activated. `loadInitialData()` runs **after** the switch's bookkeeping, so the server's view (fresh accounts list, persisted selection) wins.
  - Other non-OK folder responses after a successful persist behave as today: report the error and commit with empty folders.
- **What stays identical:**
  - **Only a server-persisted selection activates a mailbox.** The UI commits only after `switch-account` returned OK. The folder `GET` merely runs concurrently. Every `/api/accounts/[id]/*` route authorizes membership per request (`requireAccountContext` → `resolveAccountRole`, `app/api/_helpers/accountContext.ts:43-64`); no route reads `session.activeAccountId` except `/auth/me`.
  - Every reset that `switchAccount` does today.
  - The MailClient account-change effect (`:4810`) still runs: it resets `lastFolderId`, closes compose, and re-sets the same INBOX (no-op).
- **Expected effect:**
  - Critical path goes from `T(switch) + T(me) + T(folders) + max(T(threads_B), stale-A wait)` to `max(T(switch), T(folders)) + T(threads_B)`: at least 2 round trips, plus `/auth/me` server time, plus the stale-list wait.
  - Requests −7 per switch; IMAP stream setups −3; commits halved.
  - The row highlight moves after 1 round trip instead of 2.
- **Invariant tests:**
  - **(a)** Existing `first startup sync follows the new account after switch` and `…create-self-grant-select` (pass on the prototype). New: `activates nothing until the persisted selection and the folder read both succeeded`, which asserts that A's `activeFolderId` stays until the commit and that B's INBOX is set in the same commit, so no A folder id ever exists under B. Also `lib/folderAccountGuard.test.ts` and `tests/browser/ui/sync-folder-account.spec.ts`. In the harness, stale old-mailbox requests are 0.
  - **(b)** `loadInitialData`'s dependency list is unchanged (only refs are added). Existing `a UI language switch keeps the error resolver…` passes. New: `(b) a switch keeps loadInitialData identity-stable…`. Plus `tests/browser/auth/shell.spec.ts:229`.
  - **(c)** New: `a 403 from switch-account / from folders never activates the mailbox and re-bootstraps from the server`. D1 adds no cache.
  - Coordination: `rapid A -> B -> C commits only the last selection`, `a bootstrap overlapping the switch publishes accounts but never overrides the switch's selection`, `a failed switch with a deferred bootstrap re-resolves the selection from the server`.
  - All 8 are in `client/useAccountController.switch.spike.dom.test.tsx`. They pass on the prototype; the 6 core cases fail on `647359b`.
  - Two existing tests pin the old serial order and must be rewritten to the parallel order: `persists a switch before rereading me and requesting selected folders` and `keeps enrollment, none and unselected … then persists selected before mail` (last 3 calls).
- **Risks:**
  1. The accounts list is no longer refreshed on every switch. It is still refreshed by `mailboxes-changed`, the session-refresh poll, and `noctua:sender-settings-changed`.
  2. `publishLocalePreference` is not re-run on a switch. It is user-scoped, so nothing is lost.
  3. Cross-tab selection drift is caught by the session-refresh poll (`MailClient.tsx:4264`), as today.
- **Variant D1b (owner decision, only if C shows a `switch-account` tail):** commit as soon as the folder read (which authorizes) succeeds, and treat the selection write as background, rolling back on a 401/403. This takes the session UPDATE (SQLITE_BUSY tail) off the critical path. It breaks the literal rule "only the persisted selection activates", so it is **not recommended by default**.

### D3. Superseded list loads must not block the next one (rank 2)

- **File:** `useMessageData.ts`. A specific hook, not on either owner list; confirm with the Umbau thread.
- **Change:** today `loadMessages` returns early whenever `loadingMessages` is true (`:184`), even when the in-flight load belongs to an older `messagesKey`. Give each load an `AbortController`. When `messagesKey` changes, abort the old load and start the new key immediately. `currentKeyRef` and the mutation-version checks already discard late results.
- **Effect:** removes head-of-line blocking in every remaining case: a folder or account click while a list load is in flight, or a slow old folder followed by a fast new one. That applies to folder switching inside one mailbox too. D1 removes the switch-specific stale request; D3 removes the class.
- **Identical:** pagination (`messagesPage > 1` stays serialized per key); `lastRequestRef` dedupe.
- **Tests:**
  - Hold the old key's response, change the key, and expect the new request immediately; the old response, released later, does not change `messages`.
  - Existing `messagelist/listBehavior.test.ts`.
  - Harness `SPIKE_HOLD_STALE=1`: B's list is shown without releasing the held A request.
- **Risk:** low; aborted reads are GETs. Watch `finally { setLoadingMessages(false) }`: only the current load may clear the flag.

### D2. Do not reload compose sender settings eagerly on a switch (rank 3)

- **File:** `composition/ComposeOrchestrator.tsx:352-357`. Not on either owner list; compose area, confirm with the Umbau thread.
- **Change:** remove the `changedAccount` eager `refresh()`, or move it into `deferUntilIdle`. The account-change effect already calls `resetSession` (closes compose), and every open loads its own snapshot (`:1200`).
- **Effect:** −3 requests per switch, including a second `/auth/me` (the same 86-statement read plus session UPDATE that the batching task fights).
- **Identical:** sender, signature and identity state on every compose open; refresh on `SENDER_SETTINGS_CHANGED`, storage receipts, and prefs changes.
- **Tests:** `sendMailRace.dom.test.tsx` and the identity compose suites; a new assertion that a switch with compose closed issues no `identities`, `prefs` or `/auth/me` request.
- **Risk:** something that reads `sender` while compose is closed would see the previous mailbox's identities. `senderCanCompose` already requires `sender.account.id === activeAccountId`, so it fails closed.

### F1/F2. Wrong-mailbox flash fixes (correctness; do them with D1)

- **F1, `useTopics.ts`:** keep `{ accountId, topics }` and return `[]` unless `accountId === activeAccountId`. `setAllTopics` keeps its signature, with functional updates applied to the current account. Test (extend `startupRequests.dom.test.tsx`): after switching A→B, `allTopics` is `[]` until B's response arrives; A's response arriving late never shows under B.
- **F2, `useSearchState.ts`:** key the 4 virtual counts by account (or reset them to `null` when `activeAccountId` changes). The badge disappears for one fetch instead of showing A's numbers. Test (`useSearchState.dom.test.tsx`): under B, A's counts are never returned.
- Both are specific hooks, not on the owner lists. With D1, F2 also stops the empty-exclusion double fetch: folders and account commit together.

### D4. Pipeline the first page with the switch (rank 4; after round 10)

- **Files:** `useMessageData.ts` (an exact-URL, single-slot in-flight handoff), `useAccountController.ts`, and **one MailClient hunk** (pass the prefetch callback into `useAccountController`). After round 10.
- **Change:** at click, also issue page 1 for the predicted inbox. The prediction comes from B's folder list from an earlier visit (in-memory, bounded) or the IMAP convention `${id}:INBOX`. `useMessageData` consumes the in-flight response **only if** the URL it would build is byte-identical. Otherwise the response is dropped.
- The slot is cleared on consumption, on the next switch, after 10 s, on unmount, and on 401/403.
- **Effect:** chain 2 → 1 round trip.
- **Invariants:**
  - (a) The predicted folder id is never written to state. `activeFolderId` is still set from B's fresh folder list in the D1 commit.
  - (c) This is the same authorized request, only earlier. A 403 drops the slot and the switch fails as in D1.
- **Risk:** one wasted request when the prediction misses; extra bookkeeping. Do it only if A shows that the remaining 2 round trips still feel slow.

### D5. Defer non-critical per-account fan-out until page 1 has landed (rank 5; size it with C's numbers)

- **Files:**
  - `useStartupSync.ts` (**FREE**);
  - `useSyncController.ts` (the consistency effect at `:787`; stream hook file, **FREE**);
  - `useReminderNotifications.ts` (calendar events, reminders);
  - `app/hooks/useThreadCollab.ts` (members);
  - `useTopics.ts` (topics).
- **Change:** schedule these after the first authoritative list result for the account (`authoritativeRevision`), or at idle via `deferUntilIdle`. Today, under D1, 14 of the 16 requests are fired in the same wave as the critical `threads` request.
- **Effect:** depends on server contention (Bun single thread, SQLite); C has to quantify it. The consistency `POST` and the startup sync are the likely heavy ones (IMAP).
- **Identical:** every request still runs; only the order changes. The consistency check stays: it is the catch-up for changes missed while the mailbox had no stream.
- **Tests:** the harness asserts that `threads` is the only non-folder request in its wave, and that the deferred requests follow.

### D6. Stale-while-revalidate per mailbox for instant switch-back (not now; owner decision on (c))

- **Change:** keep B's folders and page 1 in a bounded memory cache (for example the last 5 mailboxes, page 1 only, at most 10 minutes old). On switch-back, show them at once under B's header, then revalidate.
- **Rules:**
  - Never show cached content for a mailbox that is not in the current `accounts` list.
  - Drop the entire cache on any 401/403, on `mailboxes-changed`, logout, identity change, and `accounts` list shrink.
  - Never show the cache before `switch-account` has returned OK.
- **Effect:** 0 perceived round trips on revisits.
- **Risks:**
  - a revoked member sees data they already saw this session for ≤1 round trip;
  - list reorder or flicker when fresh data arrives;
  - optimistic activation conflicts with "only the persisted selection activates".
- **Needs:** MailClient hunks for list seeding, so after round 10. Recommended only if D1 + D3 + D4 are not enough.

### Adjacent finding (for C, outside the switch)

The IMAP stream effect depends on `activeFolderId` (`useSyncController.ts:1386`). Every **folder** click inside a mailbox therefore closes and reopens the `EventSource`, which means a new IMAP stream setup on the server. The folder could travel via a ref or a lightweight request instead of a reconnect. The file is the stream hook (**FREE**); measure the server cost first.

## 4. Ownership summary

| Design | Files | Owner status |
|---|---|---|
| D1 | `useAccountController.ts`, `useAccountController.dom.test.tsx` | **FREE**, no MailClient edit |
| D3 | `useMessageData.ts` (+ test) | Specific hook, not listed; confirm |
| D2 | `composition/ComposeOrchestrator.tsx` | Compose, not listed; confirm |
| F1/F2 | `useTopics.ts`, `useSearchState.ts` (+ tests) | Specific hooks, not listed; confirm |
| D4 | `useMessageData.ts`, `useAccountController.ts`, **1 MailClient hunk** | After round 10 |
| D5 | `useStartupSync.ts`, `useSyncController.ts` (FREE); `useReminderNotifications.ts`, `useThreadCollab.ts`, `useTopics.ts` | Partly free; after C's numbers |
| D6 | several, MailClient | After round 10 + owner decision (c) |

**Interaction with rank-2 batching** (`perf-account-batching-task.md`):
- Batching makes `/auth/me` and the summary cheaper and skips the session UPDATE.
- D1 removes `/auth/me` from the switch entirely, and D2 removes the compose `/auth/me`. After both, batching no longer affects the switch path, except `switch-account`'s own session write (D1b) and the boot.
- The two are complementary: D1/D2 cut hop count and request count; batching cuts per-request cost elsewhere (boot, events, summary). Neither blocks the other. D1 touches only the client and does not conflict with the batching branch's server files.

## 5. What not to do, and why

- **Do not activate a mailbox, or show its content, before the server has confirmed it** (D1 waits for both responses). No predicted folder id in state (folderAccountGuard, invariant (a)).
- **Do not cache `/auth/me`, the accounts list, or roles across requests**, and do not skip any per-request authorization (invariant (c)). The client designs above add no authorization cache. D6 is a display cache with mandatory drops and needs an owner decision.
- **Do not prefetch on hover by default.** With 12 mailboxes in the sidebar, hover prefetch multiplies folder and list reads (plus IMAP-backed consistency if done naively) for speculative gain. After D1 + D4 the remaining gap is 1 round trip. Reconsider only with A's numbers, with a 150 ms intent delay, and with folders only.
- **Do not drop the consistency check on switch.** It is the only catch-up for changes that happened while the mailbox had no IMAP stream. Defer it (D5); do not remove it.
- **Do not route the switch through `loadInitialData` with new dependencies** (for example `activeAccountId`). Any new identity in its dependency list re-runs the mount bootstrap and drops an unsent inline reply (invariant (b), commit `97dd982`).
- **Do not "fix" the stale A reload in MailClient's folder effect (`:4810`) now.** D1 removes its trigger (no interval in which the folder is cleared while the account is still A) without touching MailClient.
- **Do not reconnect the user-wide `/api/me/events` stream on a switch.** It is keyed by user id today and must stay that way.

## 6. Handoff

- Recommended first implementation: **D1 + F1 + F2** (one branch; `useAccountController.ts` is free, and the two hooks are small). Then **D3** and **D2**. Then decide D4/D5 with A's and C's numbers.
- Gates (per AGENTS.md): `bun run typecheck`, `bun run lint`, `bun run test:ci`, `bun run test:stress`, and `bun run test:auth-browser` (the switch changes `/auth/me` usage; includes `tests/browser/auth/shell.spec.ts:229`). Re-run the harness: expect 2 waves, 16 requests, 0 stale requests and 1 stream for D1.
- Ready-made inputs: the prototype diff, the 8 draft tests, and the harness in `briefs/perf-mailbox-switch/client/`.
