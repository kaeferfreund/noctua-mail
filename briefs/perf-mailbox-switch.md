# perf/mailbox-switch: faster mailbox switching (implementation report)

Branch `perf/mailbox-switch` in `wt-perf-mailbox-switch`, base `origin/integration/stage` @ e70c30b (round 9). HEAD **5a8c373d8c492ed40a2c113e3f8ddc33b5d28d1f (5a8c373)**. Not pushed, not merged.
User request: "das wechseln zwischen den postfächern dauert viel zu lange, bitte optimieren ohne nachteile".

## 1. Result

- **First rows appear 22–60 % sooner** on a warm switch and 27–50 % sooner on a cold one. Production build, synthetic mailboxes of 50 to 10,000 messages, ABBA rounds at load 3–7.
  - Warm examples: large → small 396 → **191 ms**; folders → large 725 → **396 ms**; small → large 523 → **403 ms**.
  - Cold examples: small → large 587 → **427 ms**; small → 50-folder mailbox 758 → **543 ms**.
- **The new list waits for 2 round trips instead of 4.** The changes:
  - `switch-account` and the folder read run in parallel;
  - `/auth/me` is gone from the switch;
  - nothing is fetched for the old mailbox any more (stale old-mailbox requests 3 → 0 per switch in the browser);
  - the IMAP stream opens once per switch instead of twice.
- **Requests per warm switch: 21 → 14** in the browser; 23 → 13 in the counting harness. Neither `/auth/me` call remains (2 → 0).
- **Two wrong-mailbox flashes fixed.** The sidebar no longer shows the old mailbox's topic names or virtual-folder counts under the new mailbox's header.
- **The sidebar highlight moves after 61–72 ms instead of 112–308 ms.**
  - Exception: when the target is the 50-folder mailbox, the highlight is now committed together with the folder tree. It moves **13–18 ms later** there (124 → 137 ms warm), while that switch's first rows still arrive 159–247 ms sooner.
- Behaviour kept:
  - only a server-persisted selection activates a mailbox;
  - folder ids never cross mailboxes;
  - `loadInitialData` stays identity-stable;
  - revocation still reaches the sidebar through `mailboxes-changed` and the session poll.
  - Each of these has a named test (§2).
- All gates are green; details in §5.

## 2. Commits

| # | SHA | Design | Files (production / tests) |
|---|---|---|---|
| 1 | 90694cd | D1: parallel, atomic switch without `/auth/me` | `useAccountController.ts` / `useAccountController.dom.test.tsx`, new `mailboxSwitchRefresh.dom.test.tsx` |
| 2 | 7d77534 | D3: a superseded list load no longer blocks the next key | `useMessageData.ts` / new `useMessageData.dom.test.tsx` |
| 3 | bfb1d40 | F1: topic names keyed by mailbox | `useTopics.ts` / `startupRequests.dom.test.tsx` |
| 4 | 9d38e37 | F2: virtual-folder counts keyed by mailbox | `useSearchState.ts` / `useSearchState.dom.test.tsx` |
| 5 | 5a8c373 | D2: no eager compose sender-settings reload | `composition/ComposeOrchestrator.tsx` / `senderComposeReview.dom.test.tsx` |

Not touched: `MailClient.tsx`, `ShellSidebar.tsx`, `AppShell.tsx`, `ShellPanes.*`, the files of `fix/qa-sweep3-r1`. D4/D5 are left for after round 10.

### D1 (90694cd): `useAccountController.ts`

What changed:
- `switchAccount` sends `POST /api/auth/switch-account` and `GET /api/accounts/<B>/folders` at the same time.
- Only when **both** succeeded does it commit, in one batch:
  - the existing resets (list, search, virtual folder, last folder);
  - `mailboxState = "selected"`, `activeAccountId = B`, B's folders, the loaded-folders marker;
  - `activeFolderId` = B's INBOX (the same expression as MailClient's folder effect);
  - `initialDataReady = true`.
- No `loadInitialData()` and no `/auth/me` on a switch, so no `initialDataReady=false` flip.
- The old intermediate state (folder cleared while the account was still A) is gone. That state made MailClient re-select A's INBOX, which fired the stale A list load, a stale A consistency POST and two A stream reconnects.

Coordination (each has a test):
- **Latest switch wins.** A `switchVersion` ref means only the latest switch commits. Logout and a bootstrap 401 invalidate an in-flight switch.
- **Selection writes are serialized.** The click order is the order that reaches the server. A write that a newer click superseded before it was sent is skipped (A→B→C→D sends B and D).
- **Overlapping bootstrap.** A `mailboxes-changed` event, the session poll or the deep-link mount can run a bootstrap during a switch. That bootstrap publishes identity and accounts, but leaves selection and folders to the switch. Once the switch settles:
  - if the switch failed, or the target is no longer in the accounts that bootstrap read, the server view is loaded again (bootstrap);
  - if that bootstrap read a different selection, the committed choice is persisted again. The bootstrap may have read the selection before the write, or written it back: `ensureActiveAccountId` lost update, the server spike's caveat.
- **401/403 from either request** activates nothing and re-runs the bootstrap, so the server's account list wins.
- **Any other folder-read failure after a persisted switch** falls back to the bootstrap, as before.

Owner invariants:
- **(a) folderAccountGuard.**
  - Account and folder change in the same commit. `(a) activates nothing until the persisted selection and the folder read both succeeded` asserts two things:
    - A's account and A's folder stay active while B's folders are already loaded but B is not yet persisted;
    - no rendered `(account, folder)` pair ever combines a folder with another mailbox.
  - The harness counts 0 old-mailbox requests after the click.
  - `first startup sync follows the new account after switch` and `…create-self-grant-select` stay green. The first sync after a switch uses `account-b:INBOX`.
  - Test fixture change: that test's fake server answered folder reads with the *selected* account's folders. It now scopes them by the path id, as every real route does.
  - `lib/folderAccountGuard.test.ts` is green.
- **(b) 97dd982.**
  - `loadInitialData`'s dependency list gains only `settleDeferredBootstrap`. That is a `useCallback` over `persistSelection`, which is a `useCallback` over `apiFetch`, and `apiFetch` was already a dependency. All other additions are refs.
  - New: `(b) a switch keeps loadInitialData identity-stable, so the mount bootstrap never re-runs`.
  - `a UI language switch keeps the error resolver and does not re-bootstrap the mailbox` is green.
  - `tests/browser/auth/shell.spec.ts:229` passes in `test:auth-browser` (§5).
- **(c) No cache, revocation is not delayed.**
  - `(c) a 403 from switch-account …` and `(c) a 403 from /account-b/folders …`: B is never rendered as active, and the account list is reloaded from the server.
  - `(c) without /auth/me in the switch, a revoked membership still reaches the account list through the refresh bootstrap`.
  - `mailboxSwitchRefresh.dom.test.tsx` mounts the real `MailClient` and switches A→B by clicking the sidebar. Then:
    - a `mailboxes-changed` event on `/api/me/events` removes the revoked A from the sidebar;
    - the session poll (`/auth/me` interval) moves off a revoked active B and drops it from the sidebar.

Rewritten serial-order tests:

| Old test | Statement | New form |
|---|---|---|
| `persists a switch before rereading me and requesting selected folders` | the selection is persisted before anything is activated | `(a) activates nothing until the persisted selection and the folder read both succeeded` |
| same | the next bootstrap follows the persisted selection | kept verbatim in the renamed test `persists a switch and reads the selected folders in parallel, then bootstraps from the persisted selection` (me → B folders, B active) |
| `keeps enrollment, none and unselected …, then persists selected before mail` | the mailbox gate's switch persists *selected* before mail | the last calls are `switch-account` + B `folders` (no me); `mailboxState` is `selected` after the commit; "before mail" → the same (a) test |

**Safety assumption.** No per-account route reads the session's selected mailbox; each authorizes the path id. Verified independently on e70c30b, with the grep list in the D1 commit body:
- The session field `activeAccountId` exists server-side only in:
  - `lib/auth.ts:91` and `:110-133` (`ensureActiveAccountId`);
  - `lib/betterAuth.ts:128` and `:224-227`.
- Callers of `ensureActiveAccountId`:
  - `app/api/auth/me/route.ts:14`;
  - `app/api/calendar/import/route.ts:36-44`. This route is not per-account. It imports into the selection and answers 403 when the body's accountId differs: fail-closed, and the same window as before, because the UI still commits only after the write.
- All 87 `app/api/accounts/**/route.ts` authorize the path id through `requireAccountContext` (`app/api/_helpers/accountContext.ts:42-64`, `resolveAccountRole` per request), either directly or via helpers:
  - `requireAccountAndMessageContext` / `requireImapMessageMutationContext`;
  - `withThreadCollab`;
  - `syncJobs`, `recomputeJobs`, `mailboxPatch`.
- Spike C (`perf-mailbox-switch-server.md` §1/§7) reached the same verdict. Its `calendar/import` correction and its lost-update caveat are both handled above. No STOP condition.

### D3 (7d77534): `useMessageData.ts`

What changed:
- Each page load carries an `AbortController`.
- When `messagesKey` changes, the reset effect aborts the old key's load and releases the loading flag. The new key's first page then starts in the same effect pass.
- Only the current load may clear the flag, and an aborted load reports no error.

Unchanged:
- pages of one key stay serialized (the in-flight gate is per load);
- the `lastRequestRef` dedupe;
- the `currentKeyRef` and mutation-version discards;
- the scroll handler's `loadingMessages` gate.

Tests (both fail on e70c30b):
- A load for an old key is aborted and the new key is requested at once. A late old response changes nothing and reports no error.
- **Reader-focus paging:** the new key pages 2 then 3, strictly one at a time, while the superseded load is still unanswered.

Existing tests: `messagelist/listBehavior.test.ts` (21) and `Collaboration.dom.test.tsx` are green.

Merge-tree against feat/reader-focus e7d00ee (still the tip at the last fetch): the conflict set is identical to the base's own (`MailClient.tsx`, `lazyAdmin.dom.test.tsx`, `playwright.qa-round2.config.ts`). reader-focus touches none of this branch's files. Its c6d4566 drives `setMessagesPage` from MailClient, and the paging test covers that path.

### F1 (bfb1d40): `useTopics.ts`

- Topics are stored as `{ accountId, topics }` and returned only for the active mailbox.
- `setAllTopics` keeps its `SetStateAction` signature and applies to the active mailbox.
- Test (`startupRequests.dom.test.tsx`, fails on base). After A→B:
  - the list is empty until B's response;
  - a superseded late A response never shows under B;
  - a local update before B's response belongs to B only;
  - switching back does not show B's topics under A.

### F2 (9d38e37): `useSearchState.ts`

- The four virtual-folder counts are stored with their mailbox id. They read as `null` (no badge) until the active mailbox's own counts arrive.
- This replaces the deferred "reset when no account" effect.
- Test (`useSearchState.dom.test.tsx`, fails on base):
  - after A→B all four counts are null until B's responses arrive;
  - B's requests go to B only;
  - with no mailbox, all counts are null.
- Merge-tree against status-bar-compact a864dfc: only `messages/de.json` conflicts, which the base also has. The branch does not touch `useSearchState.ts`.

### D2 (5a8c373): `ComposeOrchestrator.tsx`

What changed:
- The eager sender-settings refresh on a mailbox change is removed. It cost `identities`, `prefs` and a second `/api/auth/me`.
- A switch closes compose (`resetSession`), and every open loads its own snapshot.
- Kept: refreshes on `SENDER_SETTINGS_CHANGED`, storage receipts and account-prefs changes.
- A switch now only drops the previous mailbox's sender error and its (dead) retry. This uses React's "adjust state when a prop changes" pattern, so no new set-state-in-effect warning. The file stays at 44 lint warnings.

Test (`senderComposeReview.dom.test.tsx`, fails on base): a switch with compose closed calls the sender loader 0 times and removes the previous mailbox's retry. The next open loads the new mailbox's snapshot.

Merge-tree against feat/i18n-slice3 7c05ea6 (tip at the last fetch): `ComposeOrchestrator.tsx` merges cleanly. The only conflict, `tests/browser/compose/qa-compose.spec.ts`, also exists between the base and slice3. **Kept.**

## 3. Counting harness (requests per switch)

Harness: `briefs/perf-mailbox-switch/client/switchRequests.spike.dom.test.tsx`, unchanged except for `@/` imports (run from the git-ignored `.tmp/`). It mounts the real MailClient and releases responses in waves. Synthetic fixtures.

| | e70c30b | after D1 | HEAD (D1+D3+F1+F2+D2) |
|---|---|---|---|
| awaited round trips before B's list (revisit / first visit) | 4 / 4 | 2 / 2 | **2 / 2** |
| requests per switch, revisit | 23 | 16 | **13** |
| requests per switch, first visit in session | 31 | 24 | **21** |
| stale old-mailbox requests | 2 | 0 | **0** |
| IMAP stream opens | 4 | 1 | **1** |
| MailClient commits, revisit (first visit) | 14 (16) | 7 (9) | **7 (9)** |
| old mailbox's stale list held (`SPIKE_HOLD_STALE`): B's list shown after | only after the held request (wave 6) | 2 | **2** |
| deep link `?accountId=B`: B list requested in wave / total boot requests | 3 / 36 | 1 / 31 | **1 / 31** |

D3 alone (base controller, stale request held): B's list is shown in wave 4 instead of 6, so D3 removes the head-of-line block independently of D1.

Wrong-mailbox probe, B→A switch:

| Wave | e70c30b | HEAD |
|---|---|---|
| 1 | B highlighted, B's topics | **A highlighted, topics and virtual counts empty** |
| 2 | **A highlighted with B's topic names and B's counts** | A's rows, topics and counts |
| 3 | **A highlighted with B's counts** | |

No list rows of another mailbox were visible in either version.

## 4. End-to-end timing (production build)

Harness: Spike A's `measure.mjs` (`briefs/perf-mailbox-switch/e2e/harness/`), adapted only for paths, ports and data dir. The adaptation is in `briefs/perf-mailbox-switch/impl/e2e/harness-adaptation.diff`.

Setup:
- Server: standalone `next build` of e70c30b (base) and of this branch (head) on `127.0.0.1:3917`, the same data dir `noctua-data-perf-mailbox-switch`, watcher on.
- IMAP fixture on 3918 / 3919 / 3793 / 3794: small 50 messages / 6 folders, medium 2,000 / 6, large 10,000 / 6, folders 1,350 / 50. Every folder was fully synced before measuring.
- The "base" build is the branch with the five production files reset to e70c30b (`build-variant.sh`), so only this branch's changes differ.
- Headless Chromium, de-DE, 1440×900.
- **ABBA:** base, head, head, base. Server restarted per round, every series gated on 1-min load ≤ 12; actual load was 2.9–6.6.
- Per variant and pair: warm n = 10 (5 per round; the first switch after a page load is excluded), cold n = 10.
- Raw data: `briefs/perf-mailbox-switch/impl/e2e/` (`r*-{base,head}-{warm,cold}.json`, `pooled.txt`, `abba.sh`, `pool.py`).

Milestones (ms from the click; Spike A's definitions):
- **hl:** the sidebar highlight moves to the target;
- **first rows:** the first list row of the target is in the DOM;
- **settled:** 500 ms with no DOM mutation and no non-SSE request in flight;
- **req:** requests per switch;
- **me:** `/auth/me` requests per switch;
- **old:** requests for the old mailbox after the click.

| switch | hl p50 base → head | first rows p50 (p90) base → head | settled p50 (p90) base → head | req | me | old |
|---|---|---|---|---|---|---|
| cold small → large | 154 → **72** | 587 (652) → **427 (468)** | 1,462 (1,628) → 1,547 (1,739) ¹ | 37 → 30 | 2 → 0 | 3 → 0 |
| cold large → small | 129 → **71** | 429 (440) → **214 (224)** | 1,190 (1,216) → **1,054 (1,094)** | 38 → 31 | 2 → 0 | 3 → 0 |
| cold small → folders | 156 → 162 ² | 758 (805) → **543 (559)** | 1,558 (1,733) → **1,438 (1,546)** | 37 → 30 | 2 → 0 | 3 → 0 |
| warm large → small | 118 → **63** | 396 (420) → **191 (206)** | 510 (559) → **370 (437)** | 21 → 14 | 2 → 0 | 3 → 0 |
| warm small → large | 122 → **61** | 523 (550) → **403 (410)** | 865 (903) → **746 (803)** | 21 → 14 | 2 → 0 | 3 → 0 |
| warm large → medium | 119 → **62** | 527 (546) → **355 (522)** | 716 (809) → 733 (1,057) ³ | 21 → 14 | 2 → 0 | 3 → 0 |
| warm medium → large | 112 → **65** | 516 (521) → **401 (427)** | 874 (947) → **770 (869)** | 21 → 14 | 2 → 0 | 3 → 0 |
| warm folders → small | 295 → **64** | 486 (510) → **194 (281)** | 694 (760) → **399 (508)** | 21 → 14 | 2 → 0 | 3 → 0 |
| warm small → folders | 124 → 137 ² | 638 (674) → **479 (522)** | 1,007 (1,051) → **848 (915)** | 21 → 14 | 2 → 0 | 3 → 0 |
| warm large → folders | 115 → 133 ² | 718 (745) → **471 (498)** | 852 (920) → **814 (898)** | 21 → 14 | 2 → 0 | 3 → 0 |
| warm folders → large | 308 → **63** | 725 (855) → **396 (427)** | 1,154 (1,278) → **757 (850)** | 21 → 14 | 2 → 0 | 3 → 0 |

Notes:

¹ **Cold small → large, settled.** "Settled" on a first visit ends with the once-per-session startup sync: `POST /sync` → `sync/status` poll → list refresh + 4 counts.
- With D1 that sync starts about 160 ms earlier (71 vs 235 ms), alongside the list request.
- In 4 of 10 head runs the job was still running at the first `sync/status` poll, so a second poll followed. The distribution is bimodal: 1,318–1,411 ms in 5 runs and 1,683–1,756 ms in 5.
- This is background work after the rows are already visible; first rows were 160 ms sooner in the same runs.
- D5 (start the startup sync after page 1) is the fix. It is planned after round 10 and needs MailClient/useStartupSync scheduling.

² **Highlight into the 50-folder mailbox, +6 to +18 ms.** The highlight is now part of the single switch commit that also renders the 50-folder tree. Before, it moved one commit earlier, while the list was still empty. Making it optimistic would break "only the persisted selection activates a mailbox", so it is left as is. The same switches show first rows 159–247 ms sooner.

³ **Warm large → medium, settled.** p50 +17 ms and p90 +248 ms, while first rows are 172 ms sooner. Long tasks after first rows were higher in this pair: median 534 vs 384 ms. The other seven warm pairs settle 38–397 ms sooner. I treat it as noise at n = 10, but it is not shown to be an improvement.

A first non-ABBA pass (`base1`/`head1`) ran while sibling tasks pushed the load to 20–36 during the head series, so it is not used. The cold head series of that pass also aborted on its first request (ECONNRESET right after the server start) and was re-run.

## 5. Gates

| Gate | Result |
|---|---|
| `bun run typecheck` | 0 errors, 1,245 files |
| `bun run lint` | 0 errors / **180** warnings (baseline 181; F2 removed an effect) |
| `bun run test:ci` | **2,915 pass / 0 fail** + DOM **584 pass / 0 fail** (564 + 20 new) |
| `bun run test:stress` | **8,745 pass / 0 fail** (2,915 × 3, seed 1337) |
| `bun run build` | OK, both the head and the base-variant production builds |
| `bun run test:auth-browser` (port 3917) | **20 / 20 passed**, including `shell.spec.ts:229` "shell persists mailbox switch and keeps personal security independent" |
| Counting harness | §3 |
| E2E timing | §4 |
| Merge result with `origin/integration/stage` dd27be7 (`git merge-tree` tree in a scratch dir, with its own `bun install` because stage now contains the deps wave) | `bun check` 0 errors (1,295 files); full `test:dom` **660 pass / 0 fail** |

The gates ran on b7974e7. The amend to 5a8c373 only moved one test within `senderComposeReview.dom.test.tsx`: the production code is identical and the builds are unaffected. After the amend, that file was re-run (13 / 13) and linted (0 warnings), and the merge-result suite in the last row ran on 5a8c373.

All heavy gates waited for a 1-min load ≤ 12 (`.tmp/gate.sh`) and ran under `nice -n 10`. The servers and the IMAP fixture were stopped by PID; ports 3917–3919 and 3793–3794 are free.

## 6. Merge-tree

`git -C repo merge-tree --write-tree` of HEAD 5a8c373 against each ref, after `fetch`. Every conflict that remains also occurs between the base e70c30b and that ref, and none is in a file this branch changes.

| Ref | Result |
|---|---|
| `origin/integration/stage` **dd27be7** (now contains round 10: reader-focus 4634b91, status-bar-compact 3e04c9f, sidebar-views-row 031d070, qa-sweep3-r1 443198f, deps-wave-r9) | **clean** ⁴ |
| feat/reader-focus e7d00ee (= `origin/feat/reader-focus`) | branch and base both conflict in `MailClient.tsx`, `lazyAdmin.dom.test.tsx`, `playwright.qa-round2.config.ts` (round-9 drift on their side); no file of this branch is involved |
| reader-focus 4634b91 (the merged tip) | **clean** |
| feat/status-bar-compact a864dfc (= `origin/feat/status-bar-compact`) | branch and base both conflict in `messages/de.json`; nothing of this branch |
| status-bar-compact 3e04c9f (the merged tip) | **clean** |
| `origin/fix/sidebar-views-row` 94f1a31 | **clean** |
| `origin/feat/i18n-slice3` 7c05ea6 | `ComposeOrchestrator.tsx` merges cleanly; branch and base both conflict in `tests/browser/compose/qa-compose.spec.ts` |
| fix/qa-sweep3-r1 | the branch ref no longer exists (merged into stage as 443198f); 443198f: **clean** |

⁴ After the first stage check, stage dd27be7 conflicted in `senderComposeReview.dom.test.tsx`: qa-sweep3-r1 appended a test at the end of the file, where D2's test also was. Because D2 was the last, unpushed commit, I amended it so that its test sits after the "P2-B a failed sender snapshot" test. Content and assertions are unchanged; D2 b7974e7 became 5a8c373. No other history was rewritten.

## 7. Dropped / not done

- Nothing was dropped. D2 merged cleanly against slice3 7c05ea6.
- D4 (first page in parallel with the switch) and D5 (defer secondary per-account requests) are left for after round 10, as specified. Both need a MailClient hunk.
- Server-side follow-up for the auth owner (`lib/auth.ts`, not touched here): Spike C §7.4.1 describes a lost update.
  - `ensureActiveAccountId` writes back the selection it read at request start.
  - D1 handles it on the client: an overlapping bootstrap that read another selection makes the committed choice persist again.
  - The poll/event `/auth/me` that starts before a switch and ends after it still overwrites on the server until a compare-and-set lands.
- Observed, not changed (outside this scope): the startup sync on a first visit now overlaps the first list request, footnote ¹ in §4. That is D5.
- Spikes A and C were read in their final form. C's verdict: no per-account route scopes by the session selection, so there was no STOP.
