# Task draft: perf/account-presentation-batching (rerank-r8 rank 2)

Status: DRAFT. Start only when both are true:
1. The Umbau thread has pushed the round-9 head of `origin/integration/stage` and sent its SHA. Do NOT branch from the local candidate `98b4301` (their explicit request, 2026-10-23 13:20 UTC).
2. Model: `claude-judith` / `claude-opus-5-5` / `{"effort":"high","fastMode":false}` (user decision 2026-10-23 13:30 UTC). The read-only baseline spike `spike-account-batching-r1` delivers harness, baseline numbers and the design in `briefs/perf-account-batching-spike.md`; hand that to the implementation agent.

## Base and isolation
- Worktree `/home/monkey/code/noctua-mail/wt-perf-account-batching`, branch `perf/account-presentation-batching` from `origin/integration/stage` @ `e70c30b (round 9, pushed 2026-10-23 ~15:45 UTC)`.
- Own `.env.local` with `NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-account-batching`; ports 3791–3794, or 3905–3909 once the spike has finished (check `ss -ltn` first; 3895–3899 belong to the Umbau thread).
- Agent commits on the branch only. Never push, merge, rebase, deploy, or change credentials. All heavy commands under `nice -n 10`.

## Inputs from the baseline spike (2026-10-23, on 0ac6cfa)
- Read `briefs/perf-account-batching-spike.md` first: call map, baseline, design (request-scoped loader passed down explicitly; `/auth/me` reuses the selection with one fresh read after the write; phase 1 keeps per-account identity reads), risks.
- Harness in `briefs/perf-account-batching/`: `sqlcount.ts` + `sqlcounter.ts` (re-run on the new base before changing code), the differential scaffold in `differential/` (copy into `tests/differential/`; legacy copy must be re-taken from the new base), load protocol `run-load.sh` / `load.ts` / `prepare.py` (re-check every anchor on the new base; alternate base/head samples in one session).
- Baseline at 12 mailboxes: `listAccessibleAccountsForUser` 61 statements / 3.35 ms; summary route 201 / 13.70 ms; scoped event 73 / 5.24 ms; `/auth/me` 86 / 10.10 ms; foreign-mailbox event 56 per open stream. Under writer load `/auth/me` p99 was 599 ms, driven by its session UPDATE hitting SQLITE_BUSY.
- Owner decisions (Umbau thread, 2026-10-23 ~14:15 UTC) are BINDING, see the section "Owner decisions" below.

## Owner decisions (binding)
1. **Revoked mid-read:** the four seams are the binding definition: after the candidate read, at the first shard statement, at the session UPDATE, and after the members-owner read. The suite must FAIL if any injection does not fire. Fifth mandatory case: a mailbox is granted while `/auth/me` persists its selection; the result is either the old or the new state, never mixed, never a mailbox without membership.
2. **Session UPDATE skip = variant (c), N = 5 minutes, as its OWN commit** (it gets a separate auth review): write only if something changes OR `updatedAt` is older than 5 minutes. The "session still exists / not revoked / generation matches" check keeps running on EVERY request as a cheap read instead of `RETURNING`; revocation takes effect immediately; expiry, idle timeout and refresh exactly unchanged. Tests: revocation between two requests inside the 5 minutes makes the second request 401; "Last active" is at most 5 minutes old. Report `/auth/me` p99 before/after with the same 60-second load protocol. (The Umbau thread informs the user about the 5-minute "Last active" granularity.)
3. **Sender identities:** the batched seam `listSenderIdentityRowsForAccounts` in the SI files is approved: additive, existing callers unchanged, differential test against the single reads, including shared-shard and disabled-identity cases.
4. **Phase 2** (`ensureCalendarEventRuntimeData`, `lib/db/schema.ts:659`, full account re-read per warm `getAccountDb`) is NOT in this branch; it becomes its own follow-up task afterwards.
5. **SSE fan-out** for foreign mailboxes stays out of scope.

## Scope (from `briefs/perf-backlog-rerank-r8.md`, rank 2)
Measured on 11dc3c5: `listAccessibleAccountsForUser` 61 prepares / 3.62 ms at 12 accounts; 12-account mailbox summary 157 prepares + 24 cached / 19.59 ms; a one-account scoped summary event 69 prepares / 12.38 ms, because access metadata loads all accounts first. Target: at most about 4 batched metadata statements per request. Request-local batching only.

1. Batch the request-local account, identity, role and member presentation (`lib/accountAccess.ts`, `lib/accountPresentation.ts`, `lib/db/accounts.ts`, `lib/db/users.ts`).
2. `/api/auth/me` reuses the `ensureActiveAccountId` selection instead of rebuilding the list through `sanitizeAccountsForClient` (`app/api/auth/me/route.ts`, `lib/auth.ts`).
3. Session UPDATE: variant (c) per owner decision 2, in its own commit (`lib/auth.ts`).
4. Scoped summary events load only the scoped account's metadata (`lib/mailboxSummary.ts`).
5. Sender identities: add the approved batched seam `listSenderIdentityRowsForAccounts` (owner decision 3).

## Binding review conditions (Umbau thread, 2026-10-23)
- **No authorization-semantics change.** No implicit access; per-request liveness and disabled-user checks stay; final transactional authorization and the 5 s liveness bound stay; audit records unchanged. No cross-request auth, role, session or credential cache.
- **Byte-identical differential tests**, old vs new implementation side by side on the same fixture DBs, for `listAccessibleAccountsForUser`, `listAccountMembers`, the full mailbox summary, the scoped summary event, and the `/api/auth/me` payload. Cases: owner role, member counts, DTO sanitization, disabled user, revoked mid-read, MFA-restricted user, 1 / 2 / 12 accounts.
- **SQL-count instrumentation:** prepares and executed statements per request before and after, at 1 / 2 / 12 accounts.
- **Load comparison with concurrent auth writers**, following the paired load protocol of `briefs/sender-identities-slice2-review-r4.md` ("Paired load protocol and results"; probes and reproduction notes in `briefs/sender-identities-slice2-regressions-r4/`): base = round-9 head, head = this branch, same 60-second window and fixtures; report auth `SQLITE_BUSY` counts, guarded master p50/p99, and `/api/auth/me` + summary latency p50/p99 while roles flip and members are revoked.
- **Security controls:** `tests/runTeamAuthSecurityControls.sh` (or `bun test tests/teamAuthSecurityControls.test.ts`), all green.

## Gates before reporting
`bun run typecheck`, `bun run lint` (no new errors), `bun run test:ci`, `bun run test:stress` (serial), `bun run test:auth-browser` if it touches `/api/auth/me` behaviour.

## Report
`briefs/perf-account-batching.md`: before/after table (prepares, statements, ms) per endpoint and account count; list of differential tests; load comparison table with host load; security run; files touched; anything left open. Final message: commit SHAs and test numbers.


## Launch overrides (2026-10-23 ~15:55 UTC, orchestrator)
Base `origin/integration/stage` @ `e70c30bf316cde3f3e266806b34687e311c74088` (round 9; gates: typecheck 0 / 1,244 files, test:ci 2,915 + 564 DOM, lint 0 errors / 181 warnings = new baseline, auth browser 20/20). Worktree and branch are already created and installed. Instance claude-judith. PORTS for this task: 3898–3899 and 3791–3792 only (overrides any port list above; 3895–3899 are released to this thread since round 9; never 3790, 3795–3799, 3905–3914 = other running tasks of this thread). Load discipline: four sibling tasks run heavy gates in parallel on a shared 6-core box — before each `test:stress`, `bun run build` or full `test:ci`, check `uptime`; if the 1-min load is above 12, wait and re-check (do not skip the gate). `nice -n 10` always. Agent commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
