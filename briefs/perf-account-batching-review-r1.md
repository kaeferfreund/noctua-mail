# Review r1: perf/account-presentation-batching @ 84edb89 (security + correctness)

Reviewer: claude-opus-5-5, read-only, 2026-10-23. Base e70c30b, 7 commits. Scratch: merged tree under `wt-perf-account-batching/.tmp/review-r1` (removed afterwards). Worktree not modified, nothing committed.

## Verdict: **MERGE**

No P0, P1 or P2 findings. Three P3 items for `briefs/BACKLOG.md` (end of this report).

## Gates run by the reviewer (merged result 84edb89 + integration/stage a518409)

| Gate | Result |
|---|---|
| `git merge-tree --write-tree 84edb89 a518409` | clean, tree `5ce83311e1412d3c7ce2618e075209b1df60d6bb` (same as the implementer report). Merge base e70c30b. No changed file of this branch was changed on stage, and stage adds no callers of the removed or renamed APIs (`MailboxSelection.accounts`, `getMailboxSummaries` in the summary lib, per-account `resolveAccountRoleRow` in the summary). |
| `bun check` (merged) | 0 errors, 1,305 files |
| eslint on the 14 touched files (merged) | 0 errors, 0 warnings |
| Focused tests (merged): `tests/differential`, `app/api/auth/**`, `app/api/calendar/import`, `lib/auth`, `lib/authStreams`, `lib/authPolicyFlows`, `lib/mailboxSummary{,.mcp}`, `lib/userEvents`, `lib/teamAuthContracts`, `lib/teamAuthSlice3`, `lib/teamAuthSlice5`, `lib/db/senderIdentities.batch`, `tests/teamAuthSecurityControls`, `app/api/admin/users`, `lib/db/authPolicy`, `lib/authLifetimeLock` | **360 pass / 0 fail**, 21 files, 236 s (`--timeout 20000`, `nice -n 15`) |
| Reviewer probe (scratch only): skip-write path, selected mailbox revoked after the selection pre-read | pass: the retry selects the next mailbox, persists it and lists only that one (see P3-1) |

## Lens 1: Security

**Revocation takes effect on the next request as before — confirmed.**
- `requireActiveUserSession` (`lib/auth.ts:71-102`) is unchanged apart from carrying `sessionUpdatedAt`. Session existence, sidecar generation = current generation, expiry, disabled user, provisioning state and MFA restriction are all still checked on every request. The 3 "between two requests" tests (session deleted, generation bumped, user banned → 401) cover this.
- Nothing is cached across requests. `AccountAccessSnapshot` is a plain per-call value. `readAccountAccess` (`lib/accountAccess.ts:20`) runs four autocommit reads per call. `getAccountDb` caches only shard handles, as before.
- **The skipped write does not weaken liveness.** The old path relied on the `RETURNING` row of the session UPDATE, which only proves that a session with that token exists. The new `isSessionLive` (`lib/auth.ts:120-126`) runs on every attempt, skipped or written. It checks session id, token and user, `expiresAt` > now, sidecar generation = request generation = current generation. On the write path the RETURNING row is still required as well (`lib/auth.ts:143-145`). Mid-request revocation is therefore checked more strictly than in legacy.
- `updatedAt` gates nothing security-related. Better Auth 1.7.12 computes `freshAge` (300 s) from `session.createdAt` (`node_modules/better-auth/dist/api/routes/session.mjs:338`, `update-user.mjs:326`). `updateAge` refresh is computed from `expiresAt` (`session.mjs:180`). Noctua has no idle timeout and no audit entry based on `auth_session.updatedAt`.
- **No cross-mailbox data and no widening.**
  - The candidate read is the same `ua.userId=? OR a.ownerUserId=?` predicate as before (`lib/db/accounts.ts:43-49`). A scope can only add `AND a.id IN (…)`, and an empty scope still returns nothing.
  - The batched role read uses the same SQL text as the single read (`accountRoleSql`, `lib/db/accountAccess.ts:6-14`) and the same valid-role filter.
  - Member counts, sender identities and summary rows are read only for ids that passed the role read, and are grouped by `accountId`. The `getOwnAddresses` filter on `identity.accountId` is kept.
  - The summary still re-authorizes every mailbox in a final master transaction (`lib/mailboxSummary.ts:62`, now one batched role read), and the route does it again.
  - A foreign-mailbox SSE event stops at the scoped candidate read (1 statement), and nothing is delivered.
- **The four revocation seams plus the fifth case are real.** Each injection is registered per run, and the pair throws `injection did not fire` if a hook stayed unfired (`tests/differential/accountPresentation.differential.test.ts:186-188`). Seam 3 starts from a NULL selection, so both implementations really issue the UPDATE. The fifth case checks the grant at the UPDATE: it is listed with its role, `accountId` is in the list, and the list equals the memberships.
- **Seam the suite misses:** on the skip path there is no UPDATE to hook, so no branch test revokes the *selected* mailbox between the selection pre-read and the access read. By code reading, the path is correct: `access.candidateIds` no longer contains it, so the code retries, picks the next candidate, and the changed selection is written. The reviewer probe confirms this. Test gap only → P3-1.
- MFA state: the restricted path writes no selection, before and after (`app/api/auth/me/route.ts:14`). The "MFA-restricted payload" differential case and the 403 summary case are green.
- Account deletion: candidates come from `accounts`, so a deleted mailbox disappears from the post-write access read and the retry path applies. This replaces the old separate `getAccountById(selected)` check.

## Lens 2: Correctness

### /auth/me selection, write skip (db06a72) and the switch-account lost update

`persist` (`lib/auth.ts:140-148`) writes only if the selection changes, or if this request's `updatedAt` (from `getSession`) is ≥ 5 min old, in the future or unreadable. The selection's *value* is still decided from `session.activeAccountId` as read by `getSession`, as before.

Remaining window, concretely:
1. `/auth/me` reads selection A in `getSession`.
2. A switch to B commits.
3. `/auth/me` reaches `persist(A)`.
- **Activity fresh (< 5 min):** no write, so the server keeps B. The response says A. This used to be a lost switch (the server was set back to A). Now it is only a stale response:
  - In the same tab, stage's client (`useAccountController.ts`, `settleDeferredBootstrap`, a518409:160) keeps the committed switch and re-sends B.
  - In another tab, the 30-min poll sees A ≠ B and reloads the server view (B).
- **Activity stale (≥ 5 min):** A is written back over B. This is unchanged legacy behaviour.
  - The session-refresh poll runs every 30 min (`app/components/MailClient.tsx:4243-4245`), so a poll usually takes this path.
  - The window is the time between the `getSession` read and the UPDATE: milliseconds when idle, up to a few hundred ms with BUSY retries under writer load.
  - In the same tab, stage's client repairs it: an overlapping bootstrap defers to the running switch and re-persists B.
  - Across two tabs of one session, the switch can still be lost. The other tab's poll writes A, and the switching tab then follows the server back to A on its next bootstrap or poll.
- **The user cannot end up on a mailbox they did not choose in the sense of a foreign or ungranted mailbox.** The written value is always the session's previous own selection or the deterministic default, and it is rechecked against the post-write candidate list. A switch can be lost (only the cross-tab, stale-activity case), and the user then sees the previously selected mailbox again. This is pre-existing, the branch narrows it, and it is listed as P3-2.
- Calendar import (`app/api/calendar/import/route.ts:36`) uses the same function and only reads `accountId`. Behaviour is unchanged.

### 5-minute "Zuletzt aktiv" granularity

- Displayed only in the user's own Security settings, session list: `app/components/auth/SecuritySettings.tsx:107` ("Zuletzt aktiv: {time}", fed by `auth_session.updatedAt` via `app/api/auth/security/route.ts:15`). There is no admin view of session activity.
- Not used by session expiry (Better Auth `expiresAt` / `updateAge`), freshness (`createdAt`), Noctua's TTL cap (`authenticatedAt` + 24 h), idle timeout (none exists) or audit (selection writes were never audited).
- Even before this branch, the value only moved on `/auth/me` calls, `switch-account` and the hourly Better Auth refresh. `/auth/me` runs on load, on the 30-min poll and on a few settings screens, not on every mail action. The extra coarsening therefore only affects repeated `/auth/me` calls within 5 minutes, such as reloads, several tabs or the language selector.

## Findings

No P0 / P1 / P2.

P3 (backlog only, no fix round):
- **P3-1** auth/me, tests — no test for revoking the selected mailbox mid-request on the skip-write path (no UPDATE to hook). The code is correct; the reviewer probe passed. Fix suggestion: add one case to `app/api/auth/me/sessionActivity.test.ts` that hooks the selection pre-read (`SELECT DISTINCT a.id, a.name, a.email`) and revokes the selected mailbox. Source: this report.
- **P3-2** switch-account / auth/me — the cross-tab lost switch remains when the other tab's `/auth/me` hits the stale-activity write (≥ 5 min, typically the 30-min poll) in the ms window between its `getSession` read and its UPDATE. Pre-existing and narrowed by this branch. Fix suggestion if wanted: a conditional write (`UPDATE … WHERE activeAccountId IS ?` the value read by `getSession`), with the activity refresh as a separate `updatedAt`-only write. Source: this report.
- **P3-3** lib/db/users.ts:139 — `listAccessibleAccountIdsForUser` keeps its own copy of the candidate predicate next to the new `accountCandidateSql` (also noted by the implementer). Fix suggestion: reuse `readAccountSelectionCandidates`/`accountCandidateSql`. Source: implementer report §8.

## For the user: the "Zuletzt aktiv" trade-off

In the security settings, every signed-in device shows a "Zuletzt aktiv" (last active) time. With this change, that time is updated at most every 5 minutes when Noctua checks your login, instead of on every check. That check is the main reason the app was slow and sometimes stalled under load. Even before, the time did not move on every click: Noctua checks in roughly every 30 minutes and on reload. So in practice you will hardly notice a difference. The time can be up to about 5 minutes behind in addition. Login, automatic sign-out, two-factor checks and access to mailboxes do not depend on this time and work as before. Removed access and signed-out devices still take effect on the next request.
