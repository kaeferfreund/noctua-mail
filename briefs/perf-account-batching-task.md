# Task draft: perf/account-presentation-batching (rerank-r8 rank 2)

Status: DRAFT. Start only when both are true:
1. The Umbau thread has pushed the round-9 head of `origin/integration/stage` and sent its SHA. Do NOT branch from the local candidate `98b4301` (their explicit request, 2026-10-23 13:20 UTC).
2. Model: `claude-cargnel` / `claude-opus-5-5` / `{"effort":"high","fastMode":false}` (user decision 2026-10-23 13:30 UTC). The read-only baseline spike `spike-account-batching-r1` delivers harness, baseline numbers and the design in `briefs/perf-account-batching-spike.md`; hand that to the implementation agent.

## Base and isolation
- Worktree `/home/monkey/code/noctua-mail/wt-perf-account-batching`, branch `perf/account-presentation-batching` from `origin/integration/stage` @ `<ROUND-9 SHA>`.
- Own `.env.local` with `NOCTUA_DATA_DIR=/home/monkey/code/noctua-mail/data/noctua-data-perf-account-batching`; ports 3791–3794, or 3905–3909 once the spike has finished (check `ss -ltn` first; 3895–3899 belong to the Umbau thread).
- Agent commits on the branch only. Never push, merge, rebase, deploy, or change credentials. All heavy commands under `nice -n 10`.

## Scope (from `briefs/perf-backlog-rerank-r8.md`, rank 2)
Measured on 11dc3c5: `listAccessibleAccountsForUser` 61 prepares / 3.62 ms at 12 accounts; 12-account mailbox summary 157 prepares + 24 cached / 19.59 ms; a one-account scoped summary event 69 prepares / 12.38 ms, because access metadata loads all accounts first. Target: at most about 4 batched metadata statements per request. Request-local batching only.

1. Batch the request-local account, identity, role and member presentation (`lib/accountAccess.ts`, `lib/accountPresentation.ts`, `lib/db/accounts.ts`, `lib/db/users.ts`).
2. `/api/auth/me` reuses the `ensureActiveAccountId` selection instead of rebuilding the list through `sanitizeAccountsForClient` (`app/api/auth/me/route.ts`, `lib/auth.ts`).
3. Skip the session UPDATE when nothing changed (`lib/auth.ts`), only if expiry/refresh semantics stay byte-identical.
4. Scoped summary events load only the scoped account's metadata (`lib/mailboxSummary.ts`).
5. Sender identities: consume existing rows; touch an identities batch seam only if unavoidable and say why.

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
