# V2 review r1: perf/switch-server-list 529a7b8

Read-only review. Lenses: correctness and security, combined. Base 7425f75; merge target integration/stage a518409. 2026-10-23.

## Verdict: MERGE

There are no P0, P1 or P2 findings. Two P3 items are listed below for `briefs/BACKLOG.md`.

## Gates (merged tree)

The merge was checked with `git merge-tree --write-tree a518409 529a7b8`, which gave tree f0483c6 with no conflicts. Between 7425f75 and a518409, stage changed none of the branch's files. The gates ran in a scratch copy (`git archive f0483c6`, `bun install`):

- `bun check`: 0 errors in 1,301 files.
- `eslint` on the 10 touched files: 0 errors, 0 warnings.
- Focused tests: **285 pass, 0 fail** in 17 files:
  - `lib/db/messages/*`
  - `lib/topicSuggestions`, `lib/topics/*`, `lib/topicsTransfer`
  - the threads route
  - `lib/db/senderIdentityFixes`
  - `listModel`, `listState`
  - `messageGrouping`, `ownAddresses`
  - `lib/db/connection.auth`, which drops the shard indexes, reopens the shard and checks they are back
- Calendar tests that go through `getAccountDb` (S8 path): 10 pass, 0 fail.
  - `calendarEventStatus`, `calendarInviteProcessing`, `calendarInviteStatePersistence`, `calendarReminderReschedule`
  - `senderIdentities*`

## 1. Correctness

**(a) Topic suggestions, 1aa18a2: equivalent.**
- **Early exit.** `SELECT 1 FROM topics WHERE accountId = ?` (`lib/topics/suggestions.ts:727`). The batch query joins `topics t ON t.id = tls.topicId AND t.accountId = ?`, so an account with no topic rows could never produce a suggestion. Returning an empty Map is the same result.
- **Own-address exclusion.**
  - `ownAddressMatcher` uses the same normalization (`normalizeIdentityEmail`) and the same parse (`parseAddressEmails`) as before. `isOwnAddress` now delegates to it.
  - The per-call decision memo is keyed on (type, raw value). The decision depends only on the trimmed value, so the memo can only add keys, never merge two different decisions.
  - The free-mail and empty-value rules are unchanged.
- **Score reuse.**
  - A thread's score depends on two things: its key set (`rowsBySignalKey` is call-global) and `excludeThreadId`. The exclusion only has an effect when the thread is itself a `learningThreadId` of a matched row. Those threads get `memoKey = null` and are computed individually.
  - For all other threads the result is a pure function of the key sequence.
  - The memo key is the insertion-ordered key list. Same key, same order gives the same tie order in the sort, so the output is identical.
  - Copies are made with `{...topic}` during the loop. Topic rows are flat (`rowToTopic`), so no state is shared between threads.
- The harness reports 78/78 identical responses with topics. That matches the code reading.

**(b) Date group key, 62bb201: equivalent.**
- For `date`, `week` and `year`, `buildMessageGroupKey` with a thread-date override depends only on that override.
  - `buildTimeGroupKey` and `buildWeekGroupKey` take only the timestamp.
  - `year` now computes the display day lazily, with the same expression as before.
- So it is valid to cache per thread (`lib/db/messages/query.ts:3128-3140`).
- When `threadDateValue` is undefined, the old per-message `buildGroupKey(message, groupBy)` path still runs.
- Event and invite keys still take precedence. They are only populated for their own `groupBy` (`query.ts:3050-3062`).

**(c) Loaded counts for `groupBy=date`, df97f6a: correct, no client regression.**
- `listThreads` is only called by `app/api/accounts/[accountId]/threads/route.ts`. Its `groups` are only read by `useMessageData.ts:273,360` (page 1 / refresh only).
- `buildGroupedMessages` (`listModel.ts:252-265`) ignores server counts for date/week/year anyway (`useLoadedTimeCounts`). It also drops empty groups, so the new zero-count buckets do not render.
- **Collapse state.**
  - `mergeCollapsedGroupsWithMeta` now always keeps all four date keys.
  - The only difference: a bucket that is temporarily empty keeps its collapse flag instead of resetting to expanded. This is acceptable and is documented in the report.
- **"Alle einklappen".** `computeToggleAllGroupsState` sets all four meta keys plus the rendered groups. A bucket that only arrives on a later page therefore inherits the decision. Before, only buckets with a non-zero SQL count did, so this is equal or better.
- **Paging.** Meta is not replaced on page 2+. `total`, `hasMore` and `baseCount` are not touched by this change.
- **Empty list.** The response is now four buckets with count 0 instead of `[]`. The client renders nothing in both cases.

**Test rewrite, 8034d8e: coverage equivalent.**
- The old assertion checked that listThreads' bucket counts honour the `from:me` / `with:me` filter.
- `getThreadGroupCounts` uses the same `where`/`args` and the same join for `week` as it did for `date`. The filter is therefore still exercised through the same SQL path, with only the bucket expression changed.
- The new date behaviour (loaded counts, all four keys, no bucket SQL) is asserted in `query.threadSelector.test.ts:178`.
- listMessages still checks `date`.

**(d) `INDEXED BY idx_messages_account_thread_date`, 5fce0da: safe.**
- The index is created with `CREATE INDEX IF NOT EXISTS` in `initAccountSchemaBody` (`lib/db/schema.ts:1145`). That body runs for every shard format:
  - the v3 path, `schema.ts:979`
  - the v1/v2 migration transaction, `schema.ts:991`
- `getAccountDb` calls it on first open per path (`connection.ts:383-385`). `listThreads` always gets its db from `getAccountDb`.
- Nothing in `lib/` drops this index, and it has existed since at least b06b0072 (2026-04).
- The statement always has `m.accountId = ? … AND m.threadId IN (…)`, so the index is always usable. "no query solution" cannot happen.
- `COUNT(*)` is order-independent, so the result is deterministic. The test checks the plan and the value for inbox, exclusions and search.

**Q1, 570954b: equivalent.**
- `accountEmail` in `listThreads`, `listMessages`, `getTotalCount` and `getGroupCounts` is only passed to `parseSearchInput` (`query.ts:616-650`).
- There it is only used to expand `from:me` / `with:me` inside the query string.
- The separate `from`/`recipients`/`participants` parameters go through `normalizeSearchTermList` and never resolved "me".
- An empty or whitespace-only query has no `me` token, so `[]` is equivalent.
- `listRelatedMessages` (`query.ts:1911`) still reads the addresses unconditionally, which is correct because it uses them for exclusion.

## 2. Security (Q1, S8)

**S8, 529a7b8: no authorization effect.**
- `ensureCalendarEventRuntimeData` (`lib/db/schema.ts:659`) only used the account row to derive the own-address list for a participation backfill and its signature. It never decided access.
- **Access is decided per request.** `requireAccountContext` (`app/api/_helpers/accountContext.ts:53-62`) checks, on every request, in this order:
  1. `requireActiveUserSession`
  2. `resolveAccountRole` (membership and role)
  3. `getAccountById` (account exists, otherwise 404)

  This is unchanged, so revocation and account deletion are not delayed.
- **Deleted account.** Before: `getAccountById` → `null` → `[]`. Now: `getAccountOwnAddresses` → `[]` (tested). Same signature, same behaviour.
- **Address list.** `getAccountOwnAddresses` reads `id, email` and the sender identities of *the same* `accountId` (`senderIdentities.ts:19-23`). `getOwnAddresses` filters identities by `accountId`.
  - `mapAccountRow` contributes no own addresses, so the list is identical. A test covers an IDN alias, a disabled identity and an unknown id.
  - There is no cross-account read.
- **Side effect removed.** The old full read decrypted the CalDAV/DeepL secrets (`decodeSecret`, `rowParsers.ts:153,167`). With a missing or broken key, `getAccountDb` would therefore throw.
  - That was an incidental failure, not a control.
  - Requests still go through `requireAccountContext → getAccountById`, so they still fail the same way there.
  - This only matters for background jobs that open a shard without loading the account.
  - Not a finding.

**Q1:** this is a read reduction only. No authorization data is involved.

## P3 (backlog only, no fix round)

1. `lib/db/messages/query.ts:1820-1846`: the `groupBy === "date"` branch of `getThreadGroupCounts` is now unreachable (its only caller routes `date` to `getLoadedDateGroups`). The comment at `query.ts:1789` still points to it. Remove the dead branch, or keep it with a note if the Berlin-aligned SQL buckets are planned. Source: V2-review-r1.
2. `lib/topics/suggestions.ts:646`: the reuse memo key is the insertion-ordered key list, so threads with the same signals in a different order are scored again. The result is correct; only some reuse is missed. Sorting the keys is not a drop-in fix: with full ties on score, count and name, insertion order decides the order of the output. No action unless profiling shows it matters. Source: V2-review-r1.

## Not done

- Benchmarks were not rerun (the scope is the report's numbers). The full `test:ci` was not run (hourly on stage, per the rules). No build was run on the merged tree, because the branch build was OK and stage a518409 only changed UI, i18n and browser-test files.
- The scratch copy `wt-switch-server/.tmp/review-src` was removed after the gates.
