# perf/account-presentation-batching — implementation report

Branch `perf/account-presentation-batching` in `wt-perf-account-batching`, base `origin/integration/stage` **e70c30b** (round 9), 2026-10-23 UTC. Instance claude-judith, Opus 5.5. Spec: `briefs/perf-account-batching-task.md` (owner decisions binding), design from `briefs/perf-account-batching-spike.md`. All data synthetic; every bun command under `nice -n 10` with `TMPDIR=<worktree>/.tmp/tmp`. No server on a fixed port except the auth browser gate (3898). Nothing pushed, merged or deployed.

Raw evidence: `briefs/perf-account-batching/impl/` (SQL-count JSON + logs per commit, EXPLAIN script), `briefs/perf-account-batching/results/r9-{base,head}-{1,2}/` and `logs/load-r9-*.log` (load samples).

## 1. Commits

| # | SHA | What |
|---|---|---|
| 1 | `06d4b04` | **test**: differential suite `tests/differential/` — verbatim legacy copy of the e70c30b implementations (`legacyAccountPresentation.ts`, `LEGACY_BASE = e70c30b…`) and the side-by-side byte-identity suite; adds the fifth binding case (mailbox granted during `/auth/me` persistence). Green against the unchanged code (53/53). |
| 2 | `266867e` | **perf(accounts)**: batched access, role, member and sender-identity reads. `readAccountAccess` (candidates → roles → member counts → own addresses, 4 statements), `resolveAccountRoleRows` (one shared eligibility SQL with `resolveAccountRoleRow`), `countAccountMembers`, `readAccountMemberRows` (members without the all-users scan), approved SI seam `listSenderIdentityRowsForAccounts`, `getAccountsForUser` via the batched identity read. Statement budgets + SI batch differential test. |
| 3 | `ac73d31` | **perf(summary)**: scope pushed into the candidate read (no own addresses for summaries), one `getAccountDb` per mailbox (`readMailboxSummaryRow`, shared with `getMailboxSummaries`), `authorizeMailboxSummary` with one batched role read inside the caller's transaction. |
| 4 | `f60b143` | **test**: the summary budget measures after one warm call (`getAccountDb` re-resolves shard paths after master writes of earlier cases; the cold call ran one extra statement per mailbox only in the full-suite order). |
| 5 | `9b379e0` | **perf(auth/me)**: `ensureActiveAccountId` pre-reads only `id, name, email`, writes the selection, then takes one access read; that read replaces the live-id recheck and `getAccountById(selected)` and is the `/api/auth/me` mailbox list (`sanitizeAccessEntriesForClient`). Calendar import keeps using the same function (it reads only `accountId`). |
| 6 | `db06a72` | **perf(auth/me), own commit for the auth review**: session-UPDATE skip, owner decision 2 variant (c), N = 5 min (`SESSION_ACTIVITY_WRITE_INTERVAL_MS`). Liveness read on every selection attempt. Tests in `app/api/auth/me/sessionActivity.test.ts`. |
| 7 | `84edb89` | **test**: differential and SI-batch fixtures made rerun-safe for `test:stress` (`--rerun-each=3` on the shared harness DB): per-run account ids / user emails, and cached `query()` statements rebound to the current module instance's hooks. Test files only. |

Files touched (product): `lib/accountAccess.ts`, `lib/accountPresentation.ts`, `lib/auth.ts`, `lib/db/accountAccess.ts`, `lib/db/accounts.ts`, `lib/db/users.ts`, `lib/db/senderIdentities.ts` (additive seam), `lib/db/mailboxSummary.ts`, `lib/mailboxSummary.ts`, `app/api/auth/me/route.ts`. Tests: `tests/differential/{legacyAccountPresentation,accountPresentation.differential.test}.ts`, `lib/db/senderIdentities.batch.test.ts`, `app/api/auth/me/sessionActivity.test.ts`. Not touched: `lib/userEvents.ts`, `lib/authStreams.ts`, the summary route, `lib/db/schema.ts` / `lib/db/connection.ts` (phase 2 stays out), SSE fan-out.

## 2. SQL counts before → after (12 mailboxes; full table §2.2)

Driver-level counts with the spike harness (`sqlcount.ts`, unchanged), 9 warm runs after one warm-up, median. The baseline on e70c30b reproduced the spike's 0ac6cfa counts exactly. "exec" = executed statements; ms = median wall time.

### 2.1 Per commit (executed statements; ms in §2.2 — the per-commit pass ran at host load 14–20, so only its counts are used)

| Scenario (12 mailboxes unless noted) | e70c30b | 266867e accounts | ac73d31 summary | 9b379e0 auth/me | db06a72 skip |
|---|---:|---:|---:|---:|---:|
| `listAccessibleAccountsForUser` | 61 | **4** | 4 | 4 | 4 |
| summary lib (all) | 181 | 124 | **76** | 76 | 76 |
| `GET /api/me/mailboxes/summary` | 201 | 144 | **85** | 85 | 85 |
| scoped summary lib (1 mailbox) | 71 | 14 | **10** | 10 | 10 |
| scoped summary event (SSE, 1 stream) | 73 | 16 | **12** | 12 | 12 |
| foreign-mailbox event (11-mailbox user) | 56 | 4 | **1** | 1 | 1 |
| event fan-out (1 event × 4 streams) | 171 | 53 | **38** | 38 | 38 |
| `GET /api/auth/me` | 86 | 18 | 18 | **14** | **14** (no write) |
| `/auth/me` revoked during persistence (retry path) | 88 | 22 | 22 | 20 | 22 |
| `listAccountMembers` | 3 (all users) | **2** (members only) | 2 | 2 | 2 |
| disabled user, access list / scoped lib | 23 / 23 | **2 / 2** | 2 / 2 | 2 / 2 | 2 / 2 |

`/auth/me` at db06a72: 14 statements on the unchanged path (the UPDATE is replaced by the liveness read), 15 when it writes (UPDATE + liveness read). The retry-path rise 20 → 22 at db06a72 is the liveness read on each of the two attempts.

The remaining summary cost is per mailbox: 3 shard reads plus 3 master statements inside the warm `getAccountDb` (`ensureCalendarEventRuntimeData` → `getAccountById`), i.e. phase 2, deliberately not in this branch (owner decision 4).

### 2.2 Base vs head, same session (host load 9.1–9.2 start and end)

| Scenario | Variant | e70c30b compiles/cached/**exec** · ms | db06a72 compiles/cached/**exec** · ms |
|---|---|---|---|
| `accessible/1` · `/2` · `/12` | normal | 4/2/**6** · 0.69 · 7/4/**11** · 0.94 · 37/24/**61** · 3.60 | 0/4/**4** · 0.35 · 0/4/**4** · 0.40 · 0/4/**4** · 0.77 |
| `summary-lib/1` · `/2` · `/12` | normal | **16** · 1.53 · **31** · 2.64 · **181** · 12.45 | **10** · 0.98 · **16** · 1.57 · **76** · 6.89 |
| `summary-route/1` · `/2` · `/12` | normal | **25** · 3.84 · **41** · 4.69 · **201** · 14.52 | **19** · 3.46 · **25** · 4.18 · **85** · 9.51 |
| `scoped-lib/1` · `/2` · `/12` | normal | **16** · 1.43 · **21** · 1.83 · **71** · 4.05 | **10** · 0.93 · **10** · 1.00 · **10** · 0.73 |
| `scoped-event/1` · `/2` · `/12` | normal | **18** · 2.81 · **23** · 2.95 · **73** · 5.28 | **12** · 2.38 · **12** · 2.25 · **12** · 2.14 |
| `me/1` · `/2` · `/12` | normal | **20** · 7.94 · **26** · 8.14 · **86** · 14.99 | **14** · 2.96 · **14** · 2.72 · **14** · 2.86 |
| `accessible` / `summary-lib` / `scoped-lib` | disabled (11) | **23** · 0.96 / **23** · 1.07 / **23** · 1.08 | **2** · 0.29 / **2** · 0.32 / **2** · 0.11 |
| `summary-route` / `scoped-event` / `me` | disabled (11) | **3** / **3** / **3** (401 / denied / 401) | **3** / **3** / **3** (unchanged) |
| `accessible/12-revoked` | revoked mid-read | **53** · 6.58 | **4** · 2.99 |
| `summary-lib` / `summary-route` | revoked mid-read | **177** · 17.04 / **195** · 22.01 | **81** · 11.88 / **90** · 14.55 |
| `scoped-lib` / `scoped-event` | revoked mid-read | **67** · 6.94 / **67** · 9.04 | **11** · 7.14 / **11** · 5.11 |
| `me/12-revoked` | revoked during persistence | **88** · 19.55 | **22** · 17.86 |
| `scoped-event` foreign, 2 / 11 mailboxes | foreign | **11** · 2.14 / **56** · 4.68 | **1** · 1.24 / **1** · 1.24 |
| `event-fanout/4-streams` | normal | **171** · 12.71 | **38** · 4.23 |
| `me` / `summary-route` / `accessible` | MFA-restricted | **8** / **7** (403) / **56** | **8** / **7** (403) / **4** |
| `members` 0 / 5 / 6 links, revoked | — | **3** each | **2** each |

Every scenario returned the same result (status, bytes, row counts, delivered/not delivered) before and after. ms in the revoked rows include the injected write. EXPLAIN QUERY PLAN for every new statement uses the accounts / auth_user / users PKs, `idx_user_accounts_account`, the user_accounts PK and `idx_sender_identity_address` (script `impl/eqp.ts`; no ANALYZE).

Target "about 4 batched metadata statements per request": met — access list 4, summary metadata 3 + 1 final role read, scoped event 3 metadata + 1, `/auth/me` 1 pre-read + 4.

## 3. Differential tests and revocation seams

`tests/differential/accountPresentation.differential.test.ts`, legacy copy of e70c30b side by side, same fixture, clock frozen per pair, comparison of serialized output byte for byte (lib JSON; routes: status + content-type + cache-control + sorted Set-Cookie + body) **and** post-state (sessions, memberships). **57 tests, all green at HEAD**, also inside the full `test:ci` and `test:stress` runs.

- `listAccessibleAccountsForUser`: viewers with 1 / 2 / 12 mailboxes (owner role on the first), invalid stored role string, disabled viewer, MFA-restricted user; member counts 0–6 links, owner + duplicate link, link to a vanished user, disabled member, `shared` boundary (solo / pair).
- `listAccountMembers` (6 mailboxes incl. missing) and the role-filtered DTO for manager / editor / viewer.
- Full summary lib + route for every viewer, MFA-restricted route (403), scoped events (own mailbox 1 / 2 / 12, foreign mailbox emits nothing, disabled stream denied), lib scope narrowing with foreign, unknown and duplicate ids.
- `/api/auth/me` for every viewer with persisted and with NULL selection, MFA-restricted payload.
- **Binding seams (owner decision 1)** — every injection is installed per run and a case fails if it did not fire:
  1. after the candidate read (`FROM accounts a`): revoked, and role downgraded;
  2. at the first shard statement: summary route revoked / downgraded, scoped event revoked;
  3. at the session UPDATE: selected mailbox revoked, manager downgraded, other mailbox revoked;
  4. after the members owner read: member revoked;
  5. **mailbox granted during `/auth/me` persistence**: byte-identical to legacy, plus explicit assertions that the grant is reflected completely (listed with its role), `accountId` is in the list, and the list equals the memberships after the request.
- Statement budgets in the same suite: access list = 4 (1 / 2 / 12) and 2 for a disabled user; members = 2; summary scoped = 10, foreign = 1, full = 3 + 6n + 1; `/auth/me` = 14 unchanged / 15 with a write at 1 / 2 / 12.
- With the skip commit, the persisted-selection cases first persist the selection, so the current run takes the skip path; only `auth_session.updatedAt` may differ there and must equal the pre-request value; everything else is still compared.
- Mutation probes (reverted at once): `UNION` → `UNION ALL` in the member count (4 failures), accepting an unknown role string (5 failures), dropping the post-write candidate check in `ensureActiveAccountId` (1 differential + 2 route failures), liveness read forced true (3 skip-path failures).
- SI seam (owner decision 3): `lib/db/senderIdentities.batch.test.ts` compares `listSenderIdentityRowsForAccounts` with the single reads on a real shared-shard fixture, incl. disabled identities, NOCASE ordering, a missing account id and duplicate ids; plus `getAccountsForUser` vs `getAccountById` byte for byte.
- Harness note: some `lib/db` tests restore a spied `prepare` by assignment, which leaves an own property on the shared handle and would bypass the prototype hooks when files share a process. The suite removes such native leftovers before the run and fails if a live patch remains.

## 4. Session-UPDATE skip (commit `db06a72`, for the auth review)

- Write only if the selection changes, or `auth_session.updatedAt` as read by this request's `getSession` is ≥ 5 min old, unreadable or in the future. After each write the stored value/time advance, so the retry and null-fallback paths still write whenever the stored selection differs.
- Liveness (formerly the `RETURNING` row): an explicit read on **every** selection attempt, written or skipped — this session id + token + user, `expiresAt` in the future, sidecar generation = request generation = current generation. On the write path the RETURNING row is still required too, so the write path is stricter than before (generation and expiry are now also checked mid-request); the skip path is never weaker than the write path.
- Unchanged: Better Auth expiry, `updateAge` refresh (the skipped write never touched `expiresAt`), the guard, the two-attempt retry, restricted sessions (no selection write at all), audit (no audit row for selection writes before or after).
- Visible effect: "Last active" in Security settings advances at most every 5 minutes through `/auth/me` (other Better Auth writes still bump it).
- Tests (`app/api/auth/me/sessionActivity.test.ts`, 8): fresh unchanged selection is not rewritten; stale (> 5 min) is refreshed to < 5 min; a changed selection writes immediately; revocation between two requests inside the interval (session deleted, generation bumped, user disabled) → second request 401; revocation after the guard on the skipped-write path (session deleted, generation bumped, session expired) → no selection (`unselected`).
- Concurrency note: the mailbox-switch spike flagged that `/auth/me` can overwrite a concurrent `switch-account` (lost update). With the skip, an unchanged selection is no longer rewritten, which narrows that window; it is not closed when the selection really changes (unchanged behaviour).

## 5. Load comparison (paired protocol, concurrent auth writers)

`briefs/perf-account-batching/{prepare.py,run-load.sh,load.ts}` unchanged; `prepare.py` anchors held on both trees. Archived trees: base `e70c30b`, head `db06a72`. Alternating samples base-1, head-1, base-2, head-2 in one session, 60 s each, same fixtures: r4 draft loop with live MFA authorization, 11k-message shard, two production sync loops, production watcher, 1 injected message/s; reader with 12 memberships calling `/api/auth/me` and the summary route in closed loops and one production SSE stream; auth writer (busy_timeout 0, 50 ms tick) doing session timestamp updates, role flips, member churn and revoke/re-grant of the reader's own membership.

| Metric | base-1 | head-1 | base-2 | head-2 |
|---|---|---|---|---|
| host load start → end (1 min) | 9.17 → 12.84 | 9.18 → 10.43 | 8.39 → 10.13 | 8.70 → 10.10 |
| `/api/auth/me` n · p50 / p95 / **p99** / max ms | 455 · 16.1 / 352.6 / **869.9** / 3213 | 1323 · 3.4 / 20.8 / **37.7** / 135 | 716 · 12.4 / 163.4 / **396.6** / 992 | 1372 · 3.4 / 18.9 / **29.9** / 102 |
| `/api/auth/me` statuses / thrown | 455 × 200 / 2 | 1323 × 200 / 0 | 716 × 200 / 0 | 1372 × 200 / 0 |
| summary route n · p50 / p95 / **p99** ms | 960 · 18.8 / 40.8 / **107.8** | 1314 · 14.9 / 23.4 / **35.8** | 1221 · 18.9 / 29.3 / **43.6** | 1369 · 14.8 / 23.6 / **36.0** |
| SSE scoped read p50 / p99 ms · events delivered | 3.27 / 19.2 · 478 | 0.82 / 9.1 · 556 | 3.20 / 12.9 · 558 | 0.81 / 8.5 · 579 |
| auth writer attempts / `SQLITE_BUSY` (session · role · member · revoke) | 689/244 · 196/78 · 49/22 · 49/18 | 746/177 · 213/51 · 53/15 · 53/9 | 770/165 · 220/43 · 55/10 · 55/17 | 776/153 · 222/41 · 55/8 · 55/6 |
| guarded master hold p50 / p99 / max ms (n) | 0.955 / 15.4 / 281 (569) | 0.964 / 12.1 / 80 (1198) | 0.967 / 6.6 / 17.5 (922) | 0.947 / 7.3 / 29.4 (1382) |
| guarded master acquire p50 / p99 ms | 0.012 / 0.037 | 0.012 / 0.037 | 0.011 / 0.036 | 0.012 / 0.044 |
| app BUSY retries / exhaustions | 880 / 11 | 734 / 0 | 743 / 0 | 662 / 0 |
| of which `setActiveAccountId` | 133 | **0** | 162 | **0** |
| draft saves / failures · p50 / p99 ms | 568 / 0 · 56.8 / 478.7 | 1198 / 0 · 38.4 / 213.7 | 922 / 0 · 49.7 / 232.3 | 1381 / 0 · 36.3 / 136.6 |
| sync A / B completed (failed) | 84 (1) / 25 (1) | 162 (0) / 167 (0) | 142 (0) / 152 (0) | 198 (0) / 161 (0) |

Reading: the `/auth/me` tail came from its own session UPDATE (BUSY retries at 96–144 ms and up). On head the unchanged-selection path takes no write lock: 0 `setActiveAccountId` retries, `/auth/me` p99 397–870 → 30–38 ms, p50 12–16 → 3.4 ms, while serving 2–3× the requests in the same window. The summary p99 drops 44–108 → 36 ms. The guarded master hold p50 is unchanged (≈ 0.95 ms; p99 within the host-load noise). base-1 ran during a load rise (9 → 13) and shows extra noise (11 exhaustions, 2 thrown `/auth/me`, 2 sync failures); base-2 is the cleaner baseline. All four samples ran with other tasks on the shared host; compare within the session only.

## 6. Mailbox-switch context

From `briefs/perf-mailbox-switch-server.md` §4/§8 (prototype of the same skip on 647359b): the variant-(c) skip takes `/auth/me` out of the switch-path contention entirely (`/auth/me` BUSY retries 17 / 53 / 37–49 → 0 in phases a / b / all; `/auth/me` p99 1,019 → 18 ms under sync load, 456–907 → 63 ms under all loads), quiet p50 −2.8 ms (9.6 → 6.8 ms); batching plus skip ≈ −6 to −6.5 ms of the 66.5 ms quiet critical-path p50. Measured here on the real branch, `/auth/me` at 12 mailboxes went 14.99 → 2.86 ms quiet (§2.2) and p99 397–870 → 30–38 ms under writer load (§5). perf/mailbox-switch is merged on `origin/integration/stage` (a518409; "persist the selection and read folders in parallel"). If it removed `/auth/me` from the switch (D1), this branch's switch-path share is 0; it still covers boot, the session-refresh poll, the summary and SSE events. switch-account's own UPDATE and its retries are unchanged here.

## 7. Gates

| Gate | Result |
|---|---|
| `bun run typecheck` | 0 errors, 1,247 files |
| `bun run lint` | 0 errors / 181 warnings (= baseline; no new warnings) |
| `bun run test:ci` (at `db06a72`; `84edb89` changes only two test files, covered by the stress runs) | **2,981 pass / 0 fail** (baseline 2,915 + 66 new: 57 differential, 1 SI batch, 8 session activity) + **564 DOM pass** |
| `bun run test:stress` (serial, `--randomize --seed=1337 --rerun-each=3`) | **8,943 pass / 0 fail** at `84edb89` (final run, load 7.0 → 9.5). History, reported in full: run 1 at `db06a72` had 4 failures from this branch's own test fixtures not being rerun-safe (fixed in `84edb89`); run 2 had 3 failures of `lib/folderAccountGuard.test.ts` "real sync worker exits once…" (a spawned worker killed by the test's 5 s timer, exit 143, at high host load; focused `--rerun-each=3` twice green in 1.2 s); run 3 had 1 timeout of `lib/authPolicyFlows.test.ts` "each activation write/finalizer fault…" (20 s, load rising to 15; focused `--rerun-each=3` 60/60 green). Neither file touches a changed module. |
| `tests/runTeamAuthSecurityControls.sh` | **156 pass / 0 fail** (5 files, sandboxed) |
| `bun run test:auth-browser` (`AUTH_BROWSER_PORT=3898`, incl. build) | **20 / 20 passed** (7.7 min); port free afterwards |
| `git merge-tree --write-tree HEAD origin/integration/stage` | clean against `ab7a2f8` (tree `fc4936637e0d752143ed9c2427b549a7e6427918`) and again against the newer local ref `a518409` (tree `5ce83311e1412d3c7ce2618e075209b1df60d6bb`, includes the merged perf/mailbox-switch); no file touched here changed upstream since e70c30b |

## 8. Open points

- Phase 2 (`ensureCalendarEventRuntimeData` → `getAccountById` per warm `getAccountDb`) is the largest remaining summary cost: 3 of the 6 per-mailbox statements. Own follow-up per owner decision 4.
- `app/api/admin/accounts/route.ts` still calls `listAccountMembers` per mailbox; it now costs 2 statements each without the all-users scan. An N-account variant was optional and is not included.
- `listAccessibleAccountIdsForUser` (users.ts) still carries its own copy of the candidate predicate; it is used by `listSessionAccountIds` only and was left unchanged.
- The legacy copy and its suite are transition-only: delete `tests/differential/` once green on stage for one release.
- "Last active" granularity (5 min) is user-visible; the Umbau thread informs the user (owner decision 2).
