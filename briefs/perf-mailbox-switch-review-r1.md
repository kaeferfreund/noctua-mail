# Review r1: perf/mailbox-switch @ 5a8c373 (two lenses: authorization/data isolation + correctness)

Reviewer worktree `wt-review-switch` (detached 5a8c373), 2026-10-23 ~18:00–18:20 UTC. Read-only; no tracked file changed, no commit.
Scope e70c30b..5a8c373 (D1 90694cd, D3 7d77534, F1 bfb1d40, F2 9d38e37, D2 5a8c373).

## Verdict: **FIX** (one P2, small, one file) — otherwise mergeable

The P2 is pre-existing behaviour (identical guard on e70c30b), not a regression; D1 even narrows its window. It is listed as P2 only because "A→B→A: final state is the last click" was an explicit acceptance condition. If the orchestrator prefers, merging now and fixing it as a follow-up loses nothing compared with stage.

## Findings

### P2-1 A→B→A: the click back to the still-shown mailbox is ignored; B wins
- `app/components/mailclient/useAccountController.ts:267` `if (!normalizedAccountId || normalizedAccountId === activeAccountId) return;`
- While the switch to B is in flight, `activeAccountId` is still A (D1 commits only after both requests). A click on A returns early, does not bump `switchVersion`, and B commits afterwards. Sidebar and server end on B.
- Reproduced on the real MailClient (probe below, switch-account delayed 1.5 s, A clicked 13 ms after B): timeline `Alpha@135 → Beta@3879`, server selection `account-b`, one switch-account POST.
- Same code on e70c30b (old flow also kept A active until `/auth/me`), so not introduced by this branch.
- Minimal fix (same file, no view reset — a full commit for A would clear the list while `messagesKey` may stay the same, and `lastRequestRef` would then suppress the reload):
  ```ts
  if (!normalizedAccountId) return;
  if (normalizedAccountId === activeAccountId) {
    if (switchesInFlight.current === 0) return;
    // Back to the mailbox still shown: cancel the pending switch, persist this one in click order.
    const version = ++switchVersion.current;
    committedSwitch.current = version;
    void persistSelection(normalizedAccountId, () => version === switchVersion.current).then(res => {
      if ((res?.status === 401 || res?.status === 403) && version === switchVersion.current) void loadInitialData();
    }, () => {});
    return;
  }
  ```
  plus one hook test in `useAccountController.dom.test.tsx` ("A→B→A before B commits keeps A and persists A last"). The reviewer probe `briefs/perf-mailbox-switch/review/switchProbe.dom.test.tsx` covers it on the real MailClient.

### P3-1 Session-poll write-back (server-spike caveat 7.4.1): reachable, effect is a delayed jump back
- The poll (`app/components/MailClient.tsx:4247-4270`) calls `/api/auth/me` directly, not `loadInitialData`, so D1's deferred-bootstrap repair (re-persist) does not cover it. If a poll's `ensureActiveAccountId` reads A before the switch's write and writes A after it (`lib/auth.ts:120-121`), the server holds A while the UI shows B. The in-flight poll callback compares against its stale closure (`activeAccountId` = A) and changes nothing.
- Effect: reload/deep link/ICS import target A; the **next** poll (1–30 min later) sees `A ≠ B`, runs `loadInitialData`, and the UI jumps back to A without user action (the account change runs `resetSession`, which drops unsaved compose changes since the last draft autosave). Before D1 the switch's own `/auth/me` re-read made the UI follow A immediately (switch looked ignored).
- Probability is low (poll once per 1–30 min; overlap window = the ms between the poll's session read and its write). The `mailboxes-changed` bootstrap path is covered (test "a bootstrap overlapping the switch … written again"). Authorization unaffected (all routes path-scoped).
- Fix belongs in `lib/auth.ts` (auth owner): compare-and-set write as proposed in the server spike §7.4. Backlog.

### P3-2 F1: topic created in A, switch during the POST, blanks B's topic list
- `app/components/MailClient.tsx:2072` calls the `setAllTopics` captured for A after the await. `useTopics.ts:91-96` then stores `{accountId: A, topics: [new]}`, replacing B's list; B shows no topics until its next fetch. Before F1 the new topic of A was appended to B's list instead. Rare; backlog (e.g. key the update by the request's account id).

### P3-3 `/api/calendar/import` follows the stored selection
- As the spike states (`app/api/calendar/import/route.ts:36-45`): fail-closed 403 during a switch race. Unchanged by this branch. No action.

## Lens 1: authorization / data isolation

Independent grep at 5a8c373 — `activeAccountId` in server code (`app/api`, `lib`, non-test):
- `lib/betterAuth.ts:128` (field, `input:false`), `lib/betterAuth.ts:226` (only writer);
- `lib/auth.ts:15,91` (carried in `ActiveUserSession`, not used by the guard), `lib/auth.ts:110-131` `ensureActiveAccountId` (only reader that uses it; re-validated against current memberships);
- callers of `ensureActiveAccountId`: `app/api/auth/me/route.ts:14`, `app/api/calendar/import/route.ts:36` (not per-account, fail-closed).
- No other file under `app/` (outside components) reads it.

All 87 `app/api/accounts/**/route.ts` files reference one of `requireAccountContext` / `requireAccountContextFromParams` / `requireAccountAndMessageContext` / `requireImapMessageMutationContext` / `withThreadCollab` / `handleSync*` / `handleRecompute*` / `handleListMessagesRequest` / `handleFolderConsistencyRequest` / `handleMailboxCredentialMutation` (scripted check: 0 files without). `requireAccountContext` (`app/api/_helpers/accountContext.ts:42-64`) authorizes `resolveAccountRole(session.userId, <path id>)` + `getAccountById`; the session selection is not an input. **The D1 safety claim holds**; the commit body's list matches.

Owner conditions:
- **(a)** folders(B) is requested in parallel but nothing is committed until switch-account and folders both succeeded; account, folders, `initialFoldersLoadedAccountId` and `activeFolderId` (B's INBOX via `findInboxFolder`) change in one batch (`useAccountController.ts:310-319`). The MailClient account-change effect (`MailClient.tsx:4807-4823`) then sees B's folders and re-selects the same INBOX. Test "(a) activates nothing …" asserts no render pairs a folder with another mailbox; "first startup sync follows the new account after …" green. Server guard `folder_account_mismatch` 400 unchanged (`app/api/_helpers/folderAccount.ts:6`). Rapid-switch probe: list requests after A→B→C go to A (before) and C only, none to B.
- **(b)** `loadInitialData` deps add `settleDeferredBootstrap` → `persistSelection` → `[apiFetch]` (already a dep); new identity test green; UI-language regression test green; `shell.spec.ts:229` green on a production build.
- **(c)** 403/401 from either request: nothing activated, `loadInitialData` reloads (tests for both orders green). Revocation after a switch reaches the sidebar via `mailboxes-changed` and the session poll (`mailboxSwitchRefresh.dom.test.tsx`, real MailClient) — green. No cache added.
- A parallel folders read cannot return data its own request would not authorize (same guard + role, plus existence check).

## Lens 2: correctness

- **D1 coordination** (`switchVersion`, serialized selection writes, deferred bootstrap): traced A→B→C, superseded writes, logout/401 mid-switch, bootstrap overlapping before/during/after commit, failed switch (503) with deferred bootstrap. No stale commit found; `initialDataReady` always ends true or a re-bootstrap runs. Only gap: P2-1.
- **Rapid switching, real MailClient probe** (switch-account delayed 1.5 s): A→B→C ends on C (sidebar, server selection), list/count requests target A then C only, no topic of A or B shown under C — pass. A→B→A — fail (P2-1).
- **D3**: old key's load aborted in the reset effect (declared before the load effect, so the new key starts in the same pass); only the current load clears the flag; `apiFetch` forwards `init.signal` (`MailClient.tsx:455-466`). Paging of one key stays serialized. Merged with stage (which contains feat/reader-focus): DOM suite green.
- **F1/F2**: keyed by mailbox, read as empty/unknown until the active mailbox's response. Edge in P3-2.
- **D2**: a switch closes compose (`MailClient.tsx:4811` → `resetSession` → `setComposeOpen(false)`); every open path (`openCompose`, `openDetachedCompose`) goes through `initializeCompose`, which loads the sender snapshot for the current `activeAccountId` and discards it when stale (`ComposeOrchestrator.tsx:1186-1214`). `senderCanCompose` and the identity list require `sender.account.id === activeAccountId`. Composing right after a switch uses B's identities (test "the next open loads the new mailbox's snapshot" green).

## Gates (5a8c373 unless noted)

| Gate | Result |
|---|---|
| `bun check` | 0 errors, 1,245 files |
| ESLint, 11 touched files (base via `--stdin` from e70c30b) | 0 errors; warnings 46 → 45 (useAccountController 1 → 0, others unchanged) |
| Focused DOM: useAccountController, mailboxSwitchRefresh, startupRequests, useMessageData, useSearchState, senderComposeReview | 53/53 |
| `listBehavior.test.ts` | 21/21 |
| Full DOM suite (`bun run test:dom`) | 584/584, 75 files |
| Auth browser (`scripts/runAuthBrowserTests.ts`, own production build, port 3935) | 20/20 incl. `shell.spec.ts:229` (6.8 s) |
| Reviewer probe (real MailClient) | A→B→C pass, A→B→A fail (P2-1) |
| `git merge-tree --write-tree origin/integration/stage 5a8c373` (stage dd27be7) | **clean**, tree 38111c42; no conflicts |
| Merged tree 38111c42 (scratch copy, fresh `bun install --frozen-lockfile`) | `bun check` 0 / 1,295 files; full DOM 660/660, 83 files |

Not run: full `bun run test:ci` non-DOM part, `test:stress`, e2e timing (not requested for this review).

Probe file kept for the fix: `briefs/perf-mailbox-switch/review/switchProbe.dom.test.tsx` (run with `bun test --config=bunfig.dom.toml ./<path>` from a worktree root).

## Backlog lines (P3)
- auth/switch | `/auth/me` write-back (lib/auth.ts:120-121) not repaired when it comes from the session poll; UI jumps back on the next poll | perf-mailbox-switch-review-r1 P3-1
- topics | topic created in A with a switch during the POST blanks B's topic list (MailClient.tsx:2072 + useTopics.ts:91) | perf-mailbox-switch-review-r1 P3-2
