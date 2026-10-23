# perf-auth-provisioning-index

## Summary

Commit: `7f082aa237fd88c5cf0aa6787539fa8355781c1b` (`perf(auth): index provisioning probes by user and state`). Worktree clean after commit.

Implemented one nonunique covering index for the user-provisioning authorization probe on `perf/auth-provisioning-index`, based on `435ba5d1885d5b016d15dbad5b269f84e6497ce3`. Project work was confined to `/home/monkey/code/noctua-mail/wt-perf-authidx`. No authorization predicates or Better Auth DDL changed.

On the synthetic 100-user / 20,000-completed-operation master, the missing-user probe median fell **1.204 → 0.013 ms** and the actual accessible-account metadata reader fell **23.583 → 6.000 ms**, with identical complete returned DTOs.

## What changed (DDL and install path)

```sql
CREATE INDEX idx_user_provisioning_user_state
  ON user_provisioning(userId,state);
```

`lib/db/authPolicy.ts` installs and validates this Noctua-owned index within the existing `installAuthControlPlane()` immediate transaction, immediately after the existing active-email uniqueness-index validation. `PRAGMA index_list` verifies nonunique/nonpartial flags; `PRAGMA index_xinfo` verifies exactly `userId,state` in that order, ascending, with BINARY collation; normalized `sqlite_master` SQL verifies the DDL. A missing or malformed index is repaired and revalidated on startup, regardless of the migration receipt.

The same transaction records `user-provisioning-user-state-index-v1` in `noctua_auth_migrations` using `INSERT OR IGNORE`. Fresh installation, repeat installation, new-handle reopen, and upgrade from a complete existing control plane without the index/receipt are supported. The pre-existing installation witnesses and fail-closed security-state validation are unchanged. Receipt failure rolls back index creation. The existing active-email uniqueness index is unchanged.

The full `(userId,state)` index was chosen because it supplies a **covering** user seek and does not depend on the exact spelling of the live-state predicate. A partial `userId` alternative also seeks but is tied to that predicate. The full index costs more space and still examines a given user's completed history when necessary; it avoids examining every other user's history.

## EXPLAIN QUERY PLAN before/after

Real master schema initialized by `getDb` / `initMasterSchema`; actual pinned Better Auth migrations run through `noctuaAuthOptions` + `migrateAuthSchema`, followed by `installAuthControlPlane`. No approximate auth tables were manufactured.

Probe (unchanged):

```sql
SELECT 1 FROM user_provisioning
WHERE userId=? AND state NOT IN ('complete','cancelled');
```

Before, with only the original indexes:

```text
SCAN user_provisioning
```

After:

```text
SEARCH user_provisioning USING COVERING INDEX idx_user_provisioning_user_state (userId=?)
```

Alternative shape checked on a separate real-schema in-memory synthetic master:

```sql
CREATE INDEX candidate ON user_provisioning(userId)
WHERE state NOT IN ('complete','cancelled');
```

```text
SEARCH user_provisioning USING INDEX candidate (userId=?)
```

Only the chosen index is added to production. The shape experiment added/dropped one candidate at a time in its synthetic database. Evidence: `/tmp/perf-authidx/shapes.ts` and `shapes.log`.

## Timing before/after

Bun **1.4.4**, SQLite **3.53.4**, 2026-10-22 UTC. Adapted the supplied rerank `followup.ts` timer into an auth-only harness at `/tmp/perf-authidx/followup.ts`; the original script and JSON were copied to `followup-original.ts` / `followup-original-results.json`. Raw new samples, plans, runtime versions, output parity, and load are in `/tmp/perf-authidx/followup-results.json`; full output is in `followup.log`.

The fixture has 100 synthetic users, 20,000 completed provisioning operations distributed evenly among them, 12 synthetic accounts with one sender identity each, owner `u0`, and editor `u1` on each account. Every account has two members. Account rows/identities use the existing `persistAccountRow` path and synthetic encrypted credentials. The reader is the real `listAccessibleAccountsForUser('u1')`; all 12 complete DTOs are compared byte-for-byte before/after and their role/member counts are asserted. No shards or mailbox contents are read.

The baseline drops only the new index and its receipt from the synthetic master. The after phase uses the actual production installer, with the same data and handle. Each series has one untimed warmup. Probe timing includes statement preparation, execution and finalization; reader timing includes the complete async library call. All values below are milliseconds; spread is the observed minimum–maximum.

| Operation | Repetitions per phase | Before median (spread) | After median (spread) |
|---|---:|---:|---:|
| Missing-user provisioning probe | 21 | 1.203651 (1.168011–1.267571) | 0.013280 (0.012080–0.049360) |
| Existing-user `u1` probe, 200 completed operations | 21 | 1.245051 (1.201491–1.328412) | 0.036280 (0.035441–0.043400) |
| Accessible-account metadata reader, 12 accounts | 9 | 23.583295 (23.020731–24.836587) | 6.000335 (5.750453–6.390458) |

The complete installer took **22.956 ms** for the synthetic upgrade; this is not an isolated index-build timer. `dbstat` reports the new index at **99 pages / 405,504 bytes** for this fixture.

`uptime` before: `23:03:28 up 9:05, 1 user, load average: 6.76, 4.77, 3.54`.
`uptime` after: `23:03:29 up 9:05, 1 user, load average: 6.76, 4.77, 3.54`.

Commands used `nice -n 10`; phases ran sequentially before verification jobs. These are warm-cache synthetic library measurements on a shared machine, not HTTP/page timings or production percentiles.

## Tests

New coverage in `lib/db/authPolicy.test.ts`:

- Fresh real-library schema, shape checks, covering-seek plan, reopen and repeat-install idempotence; repeated Better Auth migrations report no added tables/columns/indexes.
- Upgrade without the new index/receipt preserves security generation, login epoch, and the complete schema of Better Auth's six model tables, including their indexes and attached triggers.
- Repairs missing indexes despite an existing receipt and malformed indexes with wrong columns/order/collation/direction, an unexpected predicate, or uniqueness.
- A failed receipt insertion atomically rolls back the index and receipt; retry succeeds.
- Differential probes for 100 user IDs and a missing ID over 20,000 completed rows plus reserved, auth_created, cleanup_required, cancelled, pending, complete, uppercase terminal spellings, unknown states, and multiple active rows. Before/after results are identical; state transitions still change the result immediately.

Verification (all long commands prefixed with `nice -n 10`):

- `bun run typecheck`: **0 errors**, 1,091 files.
- `bun run lint`: **1 pre-existing error + 25 warnings**, exactly the supplied baseline. The error remains `react-hooks/set-state-in-effect` in `app/components/calendar/useCalendarConflicts.ts:58`; neither changed file has a diagnostic.
- Targeted auth/policy/session/revocation routes and stream/connection suites: **115 passed, 1 timed out** under Bun's default 5-second timeout. The existing fault-injection test `each activation write/finalizer fault reconciles and permits fresh enrollment` was the timeout; its test teardown also produced one unhandled error after timeout. Reran its complete file with `bun test --timeout 20000 lib/authPolicyFlows.test.ts`: **20 passed, 0 failed** (26.87 s); that case completed in 5.419 s. Other seven files passed, including all 54 auth-policy tests. No production changes were made for the timeout.
- `bun run test:ci`: **exit 0; 2,514 unit tests passed, 0 failed** across 274 files (295.31 s), followed by **366 DOM tests passed, 0 failed** across 40 files (34.57 s). This is the supplied 2,503-unit baseline plus 11 new tests, with the same 366 DOM tests. The command ran once. The known identities-route SQLITE_BUSY flake did not occur, so no isolated identities-route rerun was needed.
- `git diff --check`: clean.

Logs: `/tmp/perf-authidx/typecheck.log`, `lint.log`, `auth-suites.log`, `auth-flows-rerun.log`, `test-ci.log`.

## Other candidates (not implemented)

Plan-only evidence from the same synthetic master:

```text
DELETE FROM auth_pending_challenges WHERE userId=?
  SCAN auth_pending_challenges
DELETE FROM auth_reauth_grants WHERE userId=?
  SCAN auth_reauth_grants
DELETE FROM auth_session_security WHERE userId=?
  SCAN auth_session_security
```

The first two are existing user-scoped cleanup paths; the third is a potential user-scoped cleanup/cascade lookup. A userId index could narrow these lookups, but no additional index was added, even in the cleanup experiments. Their real cardinality, revocation workload and write costs need separate measurement and owner approval. Plans are retained in `followup-results.json`.

## Risks

- One additional B-tree adds storage and provisioning-write maintenance. It contains completed operations as well as active ones; the partial alternative would be smaller with mostly completed history.
- First startup on an old master builds the index while holding the existing immediate installation transaction. Larger histories can extend startup and writer exclusion; failure rolls back the transaction.
- The benefit scales with provisioning history. A small deployment has a smaller absolute gain; other metadata fanout remains.

No real mailbox or `/home/monkey/code/noctua-mail/data/*` was accessed. No other worktree was entered. No `ANALYZE`, `PRAGMA optimize`, build, dev server, dependency change, push, merge, rebase, branch switch, stash, or destructive Git command was run. Synthetic benchmark handles close in `finally`; commands exit normally, and no service is left running.

## Files touched

Tracked implementation files:

- `lib/db/authPolicy.ts`
- `lib/db/authPolicy.test.ts`

Requested external deliverable: `/home/monkey/code/noctua-mail/briefs/perf-auth-provisioning-index.md` (outside the worktree). Scratch harnesses, synthetic databases and verification logs are confined to `/tmp/perf-authidx/`; the existing test harness manages its own isolated temporary fixtures.
