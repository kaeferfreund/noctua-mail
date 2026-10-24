# perf/mailbox-switch-2: faster mailbox switching, part 2 (implementation report)

Branch `perf/mailbox-switch-2` in `wt-perf-switch-2`, on top of `perf/mailbox-switch`.
HEAD **c03efbcf312a9ddb86ebe6921fd674f8119dfc4f (c03efbc)**. Not pushed, not merged.
User request: "das wechseln zwischen den postfächern dauert viel zu lange, bitte optimieren ohne nachteile".
This run continued a task that stopped at a usage limit; the first four commits below are inherited from it.

## 1. Result

Production build, synthetic mailboxes (small: 50 messages, large: 10,000), headless Chromium, ABBA, load 2.5–9 at every series start.
Base = `7425f75` (= `integration/stage` a504783 + e40b131, i.e. everything of perf/mailbox-switch without this branch). Head = c03efbc.

| Switch | first rows p50 (p90) base → head | settled p50 (p90) base → head | long tasks p50 |
|---|---|---|---|
| warm large → small | 198 (214) → **148 (218)** ms | 392 (443) → **305 (443)** ms | 84 → 54 ms |
| warm small → large | 401 (468) → **181 (228)** ms | 782 (897) → **384 (468)** ms | 546 → 72 ms |
| cold small → large | 458 (482) → **216 (228)** ms | 1,382 (1,531) → **1,031 (1,097)** ms | 1,007 → 232 ms |
| cold large → small | 335 (423) → **182 (244)** ms | 1,195 (1,311) → **887 (936)** ms | 298 → 165 ms |

n = 40 per warm row, 16 per cold row. "Cold" = first switch after a full page load.

- Switching into the large mailbox shows the first rows **55 % sooner** (warm) and **53 % sooner** (cold).
- Switching into the small mailbox: **25 %** (warm) and **46 %** (cold) sooner.
- Main-thread long tasks per warm switch into the large mailbox drop from 546 ms to 72 ms.
- Requests per switch: warm 14 (unchanged), cold 30–31 → 26 (the second list read after a no-op startup sync is gone).
- No visible behaviour changes: settled lists, counts, selection, reader focus, paging, rapid A→B→A are as before (tests in §3).

## 2. Commits (base 7425f75 → c03efbc)

| # | SHA | Concern | Production files / tests |
|---|---|---|---|
| 1 | 29519f0 | inherited: memoize address parsing for list sender/recipient labels | `lib/ownAddresses.ts` / `lib/ownAddresses.test.ts` |
| 2 | 657373c | inherited: one translator per locale (no ICU re-parse per render) | `lib/i18n/translator.ts`, `lib/i18n/folderNames.ts` / `lib/i18n/catalogs.test.ts` |
| 3 | 79c9ff4 | inherited, D4: request the next inbox's first page alongside the switch | `useAccountController.ts`, `useMessageData.ts`, `MailClient.tsx` / `useMessageData.dom.test.tsx`, `mailboxSwitchFirstPage.dom.test.tsx` |
| 4 | 64b4959 | inherited: no second list read after a new-mail sync that wrote nothing | `useSyncController.ts`, `useMessageData.ts`, `types.ts`, `MailClient.tsx` / `useSyncController.dom.test.tsx`, `useMessageData.dom.test.tsx` |
| – | 5f36398, b4bf037 | inherited merges: perf/mailbox-switch 5a8c373, integration/stage a504783 | – |
| 5 | **9d730bd** | **H: show a new list page without a second client render** | `MailClient.tsx`, `messagelist/useReaderNavigationRows.ts`, `messagelist/MessageListOrchestrator.tsx`, `useMessageDeleteActions.ts`, `useMessageMutations.ts` / new `listCommit.dom.test.tsx`; `MessageListOrchestrator.dom.test.tsx`, `useMessageDeleteActions.dom.test.tsx` adapted |
| 6 | **c03efbc** | **merge perf/mailbox-switch e40b131** (last click wins on A→B→A); conflict with D4 resolved | `useAccountController.ts` / `mailboxSwitchRapid.dom.test.tsx` adapted, new case in `mailboxSwitchFirstPage.dom.test.tsx` |

Commit bodies of 1–4 describe their guards; summary below. Inherited measurements (previous run, same harness, load 3–7):
memo commits 1+2 alone took warm small → large first rows from 398 to 266 ms; D4 (+4) then to 222 ms (ABBA against 1+2: 267 → 211 ms).

### Commit 5 (9d730bd): no second client render after a list page

Found with an instrumented scratch build that logs every MailClient commit and the state that changed:
when a page arrived, MailClient committed the rows and then, **in the same task**, rendered the whole client again,
because effects set state derived from the new list. React flushes these effects and the follow-up render before the browser paints,
so the rows became visible only after the second render: 43 ms later on the 10k mailbox, 32 ms on the small one
(commit with rows at 186 ms, first microtask after it at 231 ms). Causes and fixes:

- `messageTopicsById` (topics per thread, from the list response) was set in an effect → now `useMemo`. The commit that shows the rows already carries the topic badges and colours.
- Thread-related messages (`setThreadRelatedMessages([])` on every candidate change), topic-suggestion resets (`[]`) and the thread-collaboration cache invalidation (`new Map` without the key) created new empty values each time → they now keep the state when it is already empty / has no entry for the mailbox. Same values, no new identity, no render.
- The renderer publishes its reader navigation rows from an effect into MailClient state → now a small store (`createReaderRowsStore` in `useReaderNavigationRows.ts`).
  - The focus reader subscribes (`useSyncExternalStore`) and renders position/next/previous from it exactly as before.
  - The split layout neither reads nor subscribes during render (constant empty snapshot), so a publish does not render the client.
  - Delete, archive, spam and not-spam continuations read the rows **when the command starts** (`getNavigationRows()`), which is the renderer order their closures captured before. `useMessageDeleteActions` keeps "the operation's renderer order even if the move has already removed its row".

After the change the instrumented build shows one MailClient commit for the page; the next one comes in a later task (after paint): 212 ms commit, first microtask 229 ms (the remaining 17 ms are the list's own child effects).

Measured alone (ABBA, `b4bf037` vs c03efbc, load 2.5–3.7, n = 40 each):

| Switch | first rows p50 (p90) | settled p50 (p90) | long tasks p50 |
|---|---|---|---|
| warm large → small | 163 (185) → **143 (164)** ms | 328 (407) → **295 (374)** ms | 76 → 52 ms |
| warm small → large | 216 (242) → **187 (207)** ms | 417 (558) → **388 (431)** ms | 104 → 74 ms |

Tests (`listCommit.dom.test.tsx`):
- "the commit that shows the first page already carries the rows' topics" — a React `Profiler` records, per MailClient commit, whether row 1 is in the DOM and shows its topic. Fails on the base (first commit with rows has no topic), passes on head.
- "the focus reader still steps through the rendered rows" — saved focus layout, open the first row, the toolbar counter reads 1 of 3, `j` moves to 2 of 3 (rows reach the reader through the store).
- "the reader rows store notifies only for a changed row order and reads the latest rows".
- `MessageListOrchestrator.dom.test.tsx` (archive continuation next/previous/end/failed; "archive completion uses the current reader" incl. the removed-row case) and `useMessageDeleteActions.dom.test.tsx` now pass the rows as a getter; assertions unchanged, all green. The removed-row case proves the rows are taken at command start.

### Commit 6 (c03efbc): merge of e40b131 (fast A→B→A, last click wins)

Conflict in `switchAccount`: e40b131 skips the folder read for a *reselect* (click back to the mailbox still shown); D4 requests the next inbox's page at the click.
Resolution: a reselect reads no folders and requests no page; the `finally` block drops the page requested for the cancelled switch (already there for every switch that does not commit).
`mailboxSwitchRapid.dom.test.tsx` asserted "no list request of B". With D4 the click on B requests B's inbox page once, alongside the switch; the test now asserts exactly that one request, that it is aborted when the switch is superseded (A→B→C and A→B→A), and, as before, that nothing of B is shown and the server ends on the last click.
New case in `mailboxSwitchFirstPage.dom.test.tsx`: "a click back to the shown mailbox aborts the requested page of the cancelled switch".

## 3. Invariants (perf-mailbox-switch-task.md) and tests

- **(a) never a folder id of A under B.** Unchanged by commit 5 (no folder or account state touched). D4's page URL names only the target and its own `<id>:INBOX`, the folder selection still comes from the fresh folder list in the switch commit; reselect requests nothing. Tests: `useAccountController.dom.test.tsx` "(a) activates nothing until …", `mailboxSwitchFirstPage.dom.test.tsx` (4 cases), `mailboxSwitchRapid.dom.test.tsx` (4 cases), first-sync-follows-the-new-account tests.
- **(b) loadInitialData deps identity-stable.** No change to `loadInitialData` or its dependencies in this run (the merge only touches `switchAccount`). `(b) a switch keeps loadInitialData identity-stable …` and the UI-language regression test green; `tests/browser/auth/shell.spec.ts:229` in the auth browser run (§4).
- **(c) 401/403 activates nothing; revocation reaches the sidebar.** Unchanged; a denied switch aborts the requested page (`mailboxSwitchFirstPage` "a denied switch …"); `mailboxSwitchRefresh.dom.test.tsx` (mailboxes-changed and session poll) green.
- Reader-focus paging and saved page size, keyboard navigation, select-all, date grouping, unread counts, scroll position, thread collapse: commit 5 changes none of the list derivation; `readerNavigation.dom.test.tsx`, `readerFocus.dom.test.tsx`, `listBehavior.test.ts`, the new focus-reader test and `qa-reader-focus` on the production build (§4).

## 4. Gates

All on c03efbc unless noted. Heavy gates ran one after another under `nice -n 10`; test runs with `env -u CLAUDECODE -u AGENT -u REPL_ID`.

| Gate | Result |
|---|---|
| `bun check` | 0 errors, 1,303 files |
| `bun run lint` | 0 errors, 176 warnings. Per touched file against 7425f75: `MailClient.tsx` 73 → 72, `useSyncController.ts` 5 → 5, `useMessageData.ts` 1 → 1, `useMessageMutations.ts` 1 → 1, all other touched files 0 → 0. No new warnings. |
| `bun run test:ci` | **3,193 pass / 0 fail** (325 files, 429 s) + DOM **699 pass / 0 fail** (89 files) |
| `bun run build` | OK (clean `.next`, standalone, `bun check` after build 0 errors) |
| `bun run test:auth-browser` (port 3925, the production build) | **20 / 20 passed** incl. `shell.spec.ts:229` "shell persists mailbox switch and keeps personal security independent" (5.7 s) |
| `qa-shell` (`scripts/runQaShellBrowserTests.ts`, production build, port 3926) | **7 / 7 passed** |
| `qa-reader-focus` (round2 config, `QA_ROUND2_FIXTURE=1`, production build, port 3926) | **7 passed, 1 failed**: `qa-reader-focus.spec.ts:262` "real print PDF …" waits for the textbox "Search messages in Inbox". The app labels it "Search Inbox" since 443198f "fix(search): shorten the folder search placeholder" (qa-sweep3-r1, on stage). The base 7425f75 has the same label (`messages/en.json` "Search {folder}") and the same spec line; this branch changes neither `messages/` nor `tests/browser/`. Pre-existing on stage, not caused by this branch; not changed here (another branch's spec). Paging, saved page size, successor positions, scroll and keyboard cases of the spec passed. |
| Counting harness (`briefs/perf-mailbox-switch/client/switchRequests.spike.dom.test.tsx`, base = 7425f75 source copy, head = c03efbc) | see below |
| E2E timing (base 7425f75 vs head c03efbc, ABBA, warm + cold, small + large) | §1; H alone in §2 |
| Merge result with `origin/integration/stage` 378fdac (tree 090e3b1 in a scratch copy, `bun install --frozen-lockfile`) | `bun check` 0 errors (1,320 files); full `test:dom` **722 pass / 0 fail** (94 files) |

Counting harness (waves = awaited round trips; requests per switch; Profiler commits of MailClient):

| | base 7425f75 | head c03efbc |
|---|---|---|
| B's list shown after wave (first visit / revisit) | 2 / 2 | **1 / 1** |
| requests per switch, first visit in session | 21 | **16** |
| requests per switch, revisit | 13 | 13 |
| stale old-mailbox requests | 0 | 0 |
| IMAP stream opens per switch | 1 | 1 |
| MailClient commits per switch, first visit / revisit | 15 / 10 | **8 / 7** |
| boot: requests / commits | 29 / 21 | **24 / 14** |
| wrong-mailbox probes (rows or topics of the other mailbox under the active one) | 0 | 0 |

Raw data: `briefs/perf-mailbox-switch-2/` (`e2e/results/*.json`, `e2e/pooled-final.txt`, `e2e/pooled-h-only.txt`, `e2e/harness/` scripts, `counting/trace-{base,head}.json`).

## 5. Merge-tree

`git merge-tree --write-tree origin/integration/stage HEAD` after `git fetch`:

| Stage head | Result |
|---|---|
| 34dd18e (before the e40b131 merge) | conflict in `useAccountController.ts` (e40b131 vs D4) → resolved by commit 6 |
| 34dd18e (after commit 6) | **clean**, tree 67359311 |
| **378fdac** (latest fetch; includes perf/switch-folder-tree, perf/reader-card-isolation, perf/ui-clock-geometry, perf/api-json-gzip, perf/equal-updates-noop) | **clean**, tree 090e3b1; merged tree type-checks and passes the DOM suite (§4) |

`perf/mailbox-switch` (e40b131) is contained in HEAD.

## 6. Dropped

### D5: defer secondary per-account reads until the first page has rendered — dropped

Prototype (not committed; diff kept as `briefs/perf-mailbox-switch-2/d5-prototype.diff`):
a per-mailbox gate (`useSecondaryAccountReads`) opened when the first list page settled
(shown or failed; 1.5 s upper bound when no list loads) and held back topics + topic stats,
recipient aliases, calendar events + reminders, the standalone members read, the four
virtual-folder counts, the folder consistency check and the startup sync (only when the
mailbox has folders). Sender icons are loaded by the rows themselves and were already after
the first rows; the compose preload no longer exists after D2.

Why dropped:
- No first-rows gain. Pilot on the production build (load 9-15, one series each):
  warm large→small 172 vs 182 ms, small→large 239 vs 225 ms; cold small→large 259 vs 273 ms,
  large→small 385 vs 223 ms (noisy).
- Settled got later: warm 418 vs 364 ms and 604 vs 439 ms, because the deferred reads start
  100-150 ms later and are still in flight when the list is done.
- Mechanism: the inherited D4 timelines show the threads response for the 10k mailbox ending
  at a median 104-118 ms with and without the secondary reads in flight (curl alone: 100-117 ms),
  so there is no server contention to remove. On the client the secondary responses arrive in
  their own tasks; the commit timeline (instrumented scratch build) shows the list render task
  starting right after the list response, not behind them. What did hold the rows back was the
  follow-up render inside the same task, fixed by H below.

### H, smaller first page with fill-in after first paint — dropped

- Server: `pageSize=50` instead of 300 on the 10k inbox is ~40 ms faster (65 vs 105 ms, curl).
- But the fill-in needs a second request for the same page plus a second full list render,
  so "settled" gets later, and in the gap between the two pages the visible state differs from
  today: the loaded count (`baseCount` 125 → 750), select-all would select only the first
  page, keyboard navigation and scroll would stop at row 50, and reader-focus paging would
  see `hasMore` with page offsets of the other page size. The brief requires the settled result
  and the visible behaviour to stay as today; the gain (≤ 40 ms, large mailboxes only) does not
  justify that.

### H, lazy per-row derivation — dropped

After the inherited address-parse memo (29519f0) the whole list-item derivation for 300 threads
is 6-8 ms per switch in the CPU profile (sender/recipient labels 3-5 ms of it). Deriving labels
per visible row would save at most these few ms, below the e2e noise (p50 spread ±15 ms).


## 7. Measurement method

- Harness: Spike A's `measure.mjs` (briefs/perf-mailbox-switch-e2e.md §10), adapted to this worktree (ports 3920 server, 3921–3924 IMAP fixture, data dir `noctua-data-perf-switch-2`). Milestones from the click: first rows = first row of the target in the DOM; settled = 500 ms without DOM mutation and without a non-SSE request in flight.
- Builds: `next build` standalone of 7425f75 (scratch source copy) and of c03efbc; the same data dir and fixture; server restarted per series; every series waits for 1-min load ≤ 12 (actual 2.5–9 for the final runs).
- The IMAP fixture process of the previous run had exited when this run started; it was restarted with the UIDVALIDITY values cached by the app (`uidv.ts`), so no resync took place.
- Another task (`wt-switch-tree`) ran its own e2e series on the box during parts of this run; series with load above 12 at the end are not used (one pilot pair).
- Commit timelines: scratch builds with a temporary `useLayoutEffect` in MailClient (render start/end, commit time, first microtask/macrotask after the commit, which state changed); never committed.

## 8. Cleanup

Servers and the IMAP fixture of this run were stopped by PID; ports 3920–3929 are free. The worktree's `.tmp` was emptied after the report assets were copied to `briefs/perf-mailbox-switch-2/`. The worktree's `.next` holds the clean production build of c03efbc. Working tree clean.
