# perf-thread-selector-flagged

## Summary

Implemented on `perf/thread-selector-flagged`, based on `435ba5d1885d5b016d15dbad5b269f84e6497ce3`, exclusively in `/home/monkey/code/noctua-mail/wt-perf-selector`.

Commit: `709aa48` — `perf(db): use indexed EXISTS for flagged thread ordering`. Exactly one commit above the supplied base; worktree clean after commit. No push.

On the synthetic 11,000-message / 3,667-thread / 647-flagged-message fixture, selector median fell **150.19 → 10.10 ms**, and the complete `listThreads` call fell **191.32 → 51.25 ms**. Nine repetitions per variant, two warmups, alternating before/after execution. Entire selector rows and the complete returned library object matched the frozen original implementation.

No schema, index, column, writer guard, member payload, count, pagination, search or collaboration-filter changes. No `ANALYZE` or `PRAGMA optimize` was run. No build, server, real mailbox access, push or deployment.

## What changed (SQL before/after)

The all-account default selector previously used:

```sql
SELECT t.*, t.latestReceivedDateValue AS effectiveThreadDateValue
FROM threads t
LEFT JOIN (
  SELECT DISTINCT m.threadId
  FROM messages m
  WHERE m.accountId = ? AND m.flagged = 1 AND COALESCE(m.deleted, 0) = 0
) flaggedThreads ON flaggedThreads.threadId = t.threadId
WHERE t.accountId = ?
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.accountId = t.accountId AND m.threadId = t.threadId
      AND COALESCE(m.deleted, 0) = 0
  )
ORDER BY CASE WHEN flaggedThreads.threadId IS NULL THEN 0 ELSE 1 END DESC,
  t.latestReceivedDateValue DESC
LIMIT ? OFFSET ?;
```

It now uses:

```sql
SELECT t.*, t.latestReceivedDateValue AS effectiveThreadDateValue
FROM threads t
WHERE t.accountId = ?
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.accountId = t.accountId AND m.threadId = t.threadId
      AND COALESCE(m.deleted, 0) = 0
  )
ORDER BY EXISTS (
  SELECT 1 FROM messages mf
  WHERE mf.accountId = t.accountId AND mf.flagged = 1
    AND mf.threadId = t.threadId AND COALESCE(mf.deleted, 0) = 0
) DESC, t.latestReceivedDateValue DESC
LIMIT ? OFFSET ?;
```

Both selected date columns still come from the existing `getThreadDateColumn` logic. The filtered selector (folder or excluded-folder views without search/badges) receives the same replacement: its existing visible-message and excluded-folder predicates remain in the flagged `EXISTS`; thread eligibility remains the existing `t.threadId IN (SELECT DISTINCT ... WHERE ...)`. Its exclusion bindings move after the eligibility-filter bindings because the flagged expression is now in `ORDER BY`, following `WHERE`. No selected-folder predicate is added to the flag check: a live flag elsewhere in the account still prioritizes a thread, unless that folder is excluded.

Every new correlation matches **both `accountId` and `threadId`**. The existing `(accountId, flagged, threadId)` index supports the seek. Deleted flags remain ineligible via `COALESCE(deleted, 0) = 0`.

The entire `applyBadgeFilters` block, including the collaboration keyed `EXISTS` / `NOT EXISTS` filters around original line 867, was compared byte-for-byte with `435ba5d` and is unchanged. SHA-256: `6a13772a49ce2a092bcbef55756a3a9dac38d1c89cad6e519448be95fd913b46`.

## Differential tests

Added `lib/db/messages/query.threadSelector.test.ts`: six focused tests, **1,570 assertions**, using the existing real-schema `createSharedShardFixture` / `createCollabFixture` harnesses, normal upserts and collaboration-state functions. No schema stand-ins or module mocks.

Each scenario executes the real public `listThreads` query path twice on the same shard. A narrowly scoped, restored `prepare` spy replays the frozen pre-change DISTINCT/LEFT JOIN flag fragments and original binding order for the control. The legacy live-flag predicate is fixed independently of the new predicate. Comparisons cover whole selector rows, explicit ordered thread IDs, and the complete return value (members and their order, groups, totals, baseCount, hasMore and thread metadata). Selector order is checked separately because member projection has its own ordering. Pages 1–3 use five threads per page, including boundaries through tied dates and flagged/unflagged groups.

Coverage:

- Flagged and unflagged threads, live flags in another folder, flags on deleted copies, and an entirely deleted thread; tied dates; latest activity and latest received date sources with genuinely different values; all-account, inbox and archive views.
- Excluded folders, multiple exclusions, duplicate/blank/whitespace-normalized exclusions, and every folder excluded; complete member/count contract comparisons.
- Collaboration virtual folders: assigned-to-me with and without a viewer, unassigned, open, closed, in-progress, waiting, and combined unassigned/open; single-folder and all-account scopes.
- FTS text, local message-ID search, `in:`, exact `thread:`, `topic:none`, attachment filename, address/recipient/participant, attachments-only, unread and flagged badges. Ordinary search and collaboration badges bypass flag priority as before; `topic:none` retains the existing priority behavior.
- Date-derived and non-date grouping (`date`, `none`, `week`, `year`, `sender`, `folder`).
- Two accounts in one physical SQLite shard with **identical local message IDs, folder IDs and thread IDs**, but disjoint flagged thread sets. Both accounts are compared against the legacy selector across all-account/folder/exclusion views, search and collaboration views. Explicit assertions verify account B's prioritized threads come only from B's flag set, preventing an account-unscoped correlation from passing.

Final targeted command: `nice -n 10 bun test lib/db/messages/query.threadSelector.test.ts` — **6 pass, 0 fail**. An initial test-only expectation incorrectly assumed `topic:none` disables flag priority; it was corrected to the pre-existing behavior. No production change was made to that contract.

## EXPLAIN QUERY PLAN before/after

SQLite **3.53.4**, real `getDb` / `getAccountDb` / schema setup, v2 composite keys and persistent writer guards intact. Complete SQL, parameters and EQP rows are retained in `/tmp/perf-selector/results.json`.

Default selector before:

```text
MATERIALIZE flaggedThreads
SEARCH m USING INDEX idx_messages_account_flagged_thread (accountId=? AND flagged=?)
SEARCH t USING INDEX idx_threads_account_latest (accountId=?)
CORRELATED SCALAR SUBQUERY 2
SEARCH m USING INDEX idx_messages_account_thread_date (accountId=? AND threadId=?)
SCAN flaggedThreads LEFT-JOIN
USE TEMP B-TREE FOR ORDER BY
```

Default selector after:

```text
SEARCH t USING INDEX idx_threads_account_latest (accountId=?)
CORRELATED SCALAR SUBQUERY 1
SEARCH m USING INDEX idx_messages_account_thread_date (accountId=? AND threadId=?)
CORRELATED SCALAR SUBQUERY 2
SEARCH mf USING INDEX idx_messages_account_flagged_thread (accountId=? AND flagged=? AND threadId=?)
USE TEMP B-TREE FOR ORDER BY
```

Filtered selector before (both inbox and excluded-folder variants):

```text
MATERIALIZE flaggedThreads
SEARCH mf USING INDEX idx_messages_account_flagged_thread (accountId=? AND flagged=?)
SEARCH t USING INDEX sqlite_autoindex_threads_1 (accountId=? AND threadId=?)
LIST SUBQUERY 2
SEARCH m USING INDEX idx_messages_account_thread_date (accountId=?)
SCAN flaggedThreads LEFT-JOIN
USE TEMP B-TREE FOR ORDER BY
```

Filtered selector after (both variants):

```text
SEARCH t USING INDEX sqlite_autoindex_threads_1 (accountId=? AND threadId=?)
LIST SUBQUERY 1
SEARCH m USING INDEX idx_messages_account_thread_date (accountId=?)
CORRELATED SCALAR SUBQUERY 2
SEARCH mf USING INDEX idx_messages_account_flagged_thread (accountId=? AND flagged=? AND threadId=?)
USE TEMP B-TREE FOR ORDER BY
```

The flag-set materialization and repeated LEFT JOIN scan disappear. The existing date/flag sort remains.

## Timing before/after

Command: `nice -n 10 bun --tsconfig-override tsconfig.json /tmp/perf-selector/benchmark.ts`.

Copied the supplied `sql.ts`, `sql-results.json` and `measurements.json` into `/tmp/perf-selector/`; adapted the real-schema fixture setup into `benchmark.ts`, restricted to this worktree and synthetic `/tmp/perf-selector/data`. The control imports a frozen copy of original `query.ts` with only relative import paths resolved to this worktree. Timings compare actual original and changed public functions; preparation instrumentation is restored before timing. Runtime probes are warmed. Both selector variants include statement preparation, and both complete calls include counts, grouping and member hydration.

Fixture matches the supplied study: 11,000 synthetic messages, three per thread, 3,667 threads, 647 flagged messages, 3,900-character bodies plus HTML, INBOX, FTS rows, and collaboration data. Page 1, 300 threads, default received-date source. Two warmups and **nine measured repetitions per variant**, alternating variant order on successive repetitions. `performance.now()` timers; median and min–max spread:

- **Selector before:** median **150.189 ms**, range **150.060–150.710 ms**.
- **Selector after:** median **10.100 ms**, range **9.816–10.495 ms**.
- **Whole `listThreads` before:** median **191.319 ms**, range **189.989–196.738 ms**.
- **Whole `listThreads` after:** median **51.247 ms**, range **49.879–53.262 ms**.

`uptime` before: `22:59:41 up 9:01, 1 user, load average: 3.67, 2.73, 2.72`.

`uptime` after: `22:59:47 up 9:01, 1 user, load average: 3.77, 2.77, 2.73`.

Raw samples, SQL, plans and load readings: `/tmp/perf-selector/results.json`; run log: `/tmp/perf-selector/benchmark.log`. The benchmark finished before lint/typecheck/CI commands were started. All commands use nice 10; no affinity or resource isolation. All benchmark handles close explicitly; no service was started.

## Verification

- `nice -n 10 bun run typecheck`: exit 0, **0 errors** in 1,092 files.
- `nice -n 10 bun run lint`: exit 1, **1 existing error + 25 existing warnings**, unchanged from baseline. Existing error: `app/components/calendar/useCalendarConflicts.ts:58`, `react-hooks/set-state-in-effect`. No diagnostics in changed files.
- `nice -n 10 bun run test:ci`: exit 0, **2,509 unit tests pass, 0 fail** across 275 files (301.92 s), followed by **366 DOM tests pass, 0 fail** across 40 files (36.34 s). Baseline was 2,503 unit + 366 DOM; the only increase is the six new tests. The known identities-route `SQLITE_BUSY` flake did not occur; no rerun was needed. Full log: `/tmp/perf-selector/test-ci.log`.
- `git diff --check`: clean.

## Risks

- Results are warm-cache synthetic library/SQL timings on a shared machine, not production p95 or browser/API latency. Flag density and thread cardinality affect savings.
- Sorting remains necessary. SQL retains the original date/flag ordering without adding a tie-breaker. Tied-date differential fixtures preserve observed page order under the current SQLite planner; SQL's existing lack of a final unique ordering key remains unchanged.
- Filtered selector placeholder order changed with the SQL expression's position; multiple normalized exclusions and folder scopes are covered explicitly.
- No new schema or migrations; no changes to protected upsert, sender-key, account-key, schema, shard-format, auth, mail, app or dependency files.

## Files touched

Committed implementation/test files:

- `lib/db/messages/query.ts`
- `lib/db/messages/query.threadSelector.test.ts`

Requested external deliverable: `/home/monkey/code/noctua-mail/briefs/perf-thread-selector-flagged.md` (outside the worktree). Scratch inputs, frozen baseline, benchmark and evidence live only under `/tmp/perf-selector/`.
