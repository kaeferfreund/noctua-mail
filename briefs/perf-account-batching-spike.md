# Spike: perf/account-presentation-batching (rerank-r8 rank 2), baseline and design

Read-only spike on **0ac6cfa** (dev preview 8.9) in `wt-spike-account-batching`, 2026-10-23 UTC. No tracked-file changes, commits, branches or pushes. `git status --short` is empty at the end (`.env.local` and `.tmp/` are ignored). Two short mutation probes edited `lib/accountPresentation.ts` / `lib/auth.ts` and were reverted with `git checkout --` right away. The differential suite ran from a temporary untracked `tests/differential/` copy, which was deleted afterwards. All data is synthetic. Every bun command ran under `nice -n 10` with `TMPDIR=<worktree>/.tmp/tmp`. No server or port was used; route handlers were called in-process, as in the r4 protocol.

Harness, raw results and reproduction: `briefs/perf-account-batching/` (see its `README.md`). Task draft: `briefs/perf-account-batching-task.md`.

**Base caveat.** The local `origin/integration/stage` is still `11dc3c5`, so the round-9 head was not available. The implementer must re-run `sqlcount.ts` on the round-9 base and re-copy the legacy file from that base before comparing.

## 1. Baseline (SQL counts, 0ac6cfa)

Definitions, per measured call. They are counted at the bun:sqlite driver, so Better Auth's Kysely statements are included:
- **compiles**: `prepare()` calls, plus `query()` cache misses, plus `run()`/`exec()` calls.
- **cached**: `query()` cache hits.
- **exec**: statement executions.
- **tx**: outer `db.transaction()` calls.

Each value is the median of 9 warm runs after one warm-up. Exec counts were identical across all runs of every scenario. Host load (1/5/15 min) was 8.26/9.02/6.42 at the start and 7.76/8.91/6.40 at the end. Full table with min–max: `perf-account-batching/baseline-table.md`.

| Entry point | Variant | 1 mailbox | 2 mailboxes | 12 mailboxes |
|---|---|---|---|---|
| `listAccessibleAccountsForUser` | normal | 4c/2h/**6** · 0.71 ms | 7c/4h/**11** · 0.83 ms | 37c/24h/**61** · 3.35 ms |
| full summary, lib `getUserMailboxSummary(user)` | normal | 9c/7h/**16** · 1.51 ms | 17c/14h/**31** · 2.38 ms | 97c/84h/**181** · 11.83 ms |
| full summary, `GET /api/me/mailboxes/summary` | normal | 16c/9h/**25** · 3.29 ms | 24c/17h/**41** · 4.09 ms | 104c/97h/**201** · 13.70 ms |
| scoped summary, lib `(user,[id])` | normal | 9c/7h/**16** · 1.39 ms | 12c/9h/**21** · 1.56 ms | 42c/29h/**71** · 3.91 ms |
| scoped summary event (real SSE stream, 1 stream open) | normal | 9c/9h/**18** · 2.59 ms | 12c/11h/**23** · 2.79 ms | 42c/31h/**73** · 5.24 ms |
| `GET /api/auth/me` | normal | 16c/4h/**20** · 6.25 ms | 19c/7h/**26** · 5.89 ms | 49c/37h/**86** · 10.10 ms |

c = compiles, h = cached hits; the bold number is executed statements. Main finding: a 12-mailbox `/api/auth/me` costs 86 statements, and a one-mailbox SSE event costs 73 because it loads every mailbox's metadata first.

| Variant (user with 11–12 mailboxes) | Accessible | Summary route | Scoped lib / event | `/api/auth/me` |
|---|---|---|---|---|
| disabled user | 1c/22h/**23** · 0.98 ms, `[]` | **3** · 1.33 ms, 401 | **23** / stream 401 (**3**) | **3** · 1.25 ms, 401 |
| revoked mid-read (injected; ms include the injected write) | **53** · 5.31 ms, 10 rows | **195** · 15.95 ms, 10 mailboxes | **67** / **67**, nothing delivered | **88** · 13.48 ms, retry path, 10 mailboxes |
| MFA-restricted (setup assurance, no TOTP) | **56** · 3.31 ms (the lib level does not see MFA) | **7** · 1.36 ms, 403 | — | **8** · 1.73 ms, restricted payload |
| foreign mailbox event (user is not a member) | — | — | event: 2-mailbox user **11** · 2.14 ms; 11-mailbox user **56** · 4.64 ms | — |
| fan-out: 1 event, 4 open streams (1+2+12+11 mailboxes) | — | — | **171** exec / 7 tx · 12.57 ms | — |

`listAccountMembers` always costs 3 compiles / 3 exec (0.19–0.21 ms), but one of those statements reads **every user in the system** (`getUsers`). Its cost therefore grows with the total user count, not with the mailbox's member count. The revoked-mid-read variant still costs 3 exec.

`listAccessibleAccountsForUser` at 12 mailboxes gives 37 compiles + 24 cached hits = 61 calls, which matches r8's "61 prepares" (r8 counted prepare and query calls together). The summary numbers are not comparable to r8 (different fixture and definitions). Use this table as the before-side.

**Decryption.** `mapAccountRow` decrypts 2–4 secrets per row: 12.8 µs per row, 0.15 ms per 12 rows (`decrypt-micro.log`). That is small, so the design keeps `mapAccountRow` unchanged rather than skipping decryption, which would change error behaviour.

## 2. Call map (0ac6cfa, file:line → SQL, executions per request)

Shared session guard `requireActiveUserSession` (`lib/auth.ts:65`): **7 statements**, unchanged by this work.
- Better Auth `getSession` (`:68`): two statements on the **auth** handle, `auth_session` by token and `auth_user` by id. With `updateAge: 3600` it also does an hourly refresh UPDATE.
- `getUserById` (`:72` → `lib/db/users.ts:71,31`): `USER_ROW_SELECT`.
- Provisioning check (`:74`), session-security sidecar (`:75`), `enrollmentState` (`:83` → `lib/db/authPolicy.ts:375`), and `admin_lifecycle_operations` (`:84`).
- Disabled users stop after 3 statements (Better Auth 2 + `getUserById`).

**A. `listAccessibleAccountsForUser`** (`lib/accountAccess.ts:30`): 1 + 5n statements.
- `getAccountsForUser` (`:32` → `lib/db/accounts.ts:42`): `SELECT DISTINCT a.* … ua.userId=? OR a.ownerUserId=?` (1), then `mapAccountRow` + `listSenderIdentityRows` per account (`lib/db/senderIdentities.ts:10`, cached `query`: **n**).
- Per account `resolveAccountRole` (`:33` → `lib/db/accountAccess.ts:4`, cached: **n**).
- Per account `listAccountMembers` (`:34` → `:14`): owner (`:16`), links (`:18`), and `getUsers()` (`:21` → `lib/db/users.ts:38`, **all users**) = **3n**, re-prepared every time.
- Callers: `sanitizeAccountsForClient` (`lib/accountPresentation.ts:40`, used by `/api/auth/me` and `GET /api/accounts`), `getUserMailboxSummary` (`lib/mailboxSummary.ts:44`), MCP `list_accounts` (`lib/mcpServer.ts:984`).

**B. `listAccountMembers`** (`lib/accountAccess.ts:14`): owner, links, and all users (3 statements).
- Callers: members route (`app/api/accounts/[accountId]/members/route.ts:9`), collab route, `mailboxFailureDto` (`lib/mailboxFailure.ts:12`), `mailboxPatch.ts:16`, MCP (`lib/mcpServer.ts:1321`), and `app/api/admin/accounts/route.ts:15`.
- The admin accounts route is **N mailboxes × all users**.

**C. Full summary.** `GET /api/me/mailboxes/summary` (`app/api/me/mailboxes/summary/route.ts:7`): guard (7), then `getUserMailboxSummary` (`lib/mailboxSummary.ts:43`):
- Access list A (`:44`): 1 + 5n.
- Per account, `getAccountDb` is called **twice**: `:47`, and again inside `getMailboxSummaries` (`lib/db/mailboxSummary.ts:15,17`). Each call runs `resolveAccountDbPath` (`lib/db/connection.ts:333`, `total_changes()` cached) and `ensureCalendarEventRuntimeData` (`lib/db/schema.ts:659-661`). The latter calls **`getAccountById`** (full row + decrypt + identities) on every warm call, just to compare a signature. That is **6n master statements** for shard handles.
- Shard: unread count and `mailbox_summary` (`lib/db/mailboxSummary.ts:18,24`), plus `COLLAB_SUMMARY_SQL` (`:49`) = **3n**, all `prepare`.
- Final authorization: a deferred transaction with `authorizeMailboxSummary` (`:60` → `:17`), `resolveAccountRoleRow` × n.
- The route then runs `assertStreamAuthorized` (`lib/authStreams.ts:26,31`, 1 cached statement, deferred transaction), and inside it **`authorizeMailboxSummary` again** (`route.ts:14`, n).
- Total at 12 mailboxes: 7 + 61 + 72 + 36 + 12 + 1 + 12 = **201** ✓.

**D. Scoped summary event.**
- `createUserEventStream` subscribes to **every** mailbox's watcher events (`lib/userEvents.ts:83`), then `schedule` (`:61`) with a 250 ms debounce (`:76`).
- The reader is `getUserMailboxSummary(userId,[accountId])` (`:69`). It loads the full access list A first and filters by scope afterwards (`lib/mailboxSummary.ts:44`), then does the per-account work from C for the one scoped account.
- Then `send` → `assertStreamAuthorized` + `resolveAccountRoleRow` (`:50,52`).
- At 12 mailboxes: 61 + 6 + 3 + 1 + 1 + 1 = **73** ✓.
- A foreign mailbox event still pays all of A (56 statements for an 11-mailbox user) before dropping it. With 4 open streams, one event cost 171 statements.

**E. `GET /api/auth/me`** (`app/api/auth/me/route.ts:7`): guard (7, `allowRestricted`), then:
- `getUserById` again (`:11`).
- `ensureActiveAccountId` (`lib/auth.ts:110`):
  - `getAccountsForUser` (`:112`): 1 + n.
  - `setActiveAccountId` (`:121` → `lib/betterAuth.ts:223`): `update "auth_session" set "updatedAt" = ?, "activeAccountId" = ? … returning *` on the auth handle, behind `withDbWriteRetry`, master busy_timeout 0.
  - `listAccessibleAccountIdsForUser` (`:122` → `lib/db/users.ts:119`): the same predicate as `getAccountsForUser`, ids only.
  - `getAccountById(selected)` (`:123`): 1 + 1.
- `sanitizeAccountsForClient` (`route.ts:17`) rebuilds A from scratch (1 + 5n).
- Total at 12 mailboxes: 7 + 1 + 13 + 1 + 1 + 2 + 61 = **86** ✓.
- Restricted sessions skip both reads (8 statements). The revoke-during-persistence retry adds a second selection pass (88).

## 3. SQL-count instrumentation (reusable unchanged)

- `perf-account-batching/sqlcounter.ts` patches `Database.prototype` (`prepare`, `query`, `run`, `exec`, `transaction`) and wraps statement instances. It is implementation-agnostic, labels handles as master/auth/shard, records per-statement histograms, and supports one-shot "after the first matching statement" injections for the revoked variants.
- `sqlcount.ts` builds the fixture: 12 mailboxes with colliding names, caldav/DeepL secrets, aliases and 0–6 links; 6 members including one disabled; viewers with real Better Auth TOTP sessions holding 1, 2 or 12 mailboxes (owner, manager, editor and viewer roles); a disabled viewer, a revoked viewer, and an MFA-restricted user.
- It calls only public entry points: the route `GET` handlers, the lib exports, and the real `createUserEventStream` driven by `publishMailboxEvent`, with one stream open per scenario plus a fan-out scenario.
- Revoked-mid-read injection points:
  - accessible: after the `FROM accounts` candidate read;
  - summary and event: after the first shard statement;
  - `/auth/me`: after the session `update "auth_session"`;
  - members: after the first master statement.
- The after-measurement is the same command on the implementation worktree. Compare the `execs` and `compiles` columns and the statement histograms.

## 4. Differential-test scaffold

Files, ready to copy: `perf-account-batching/differential/legacyAccountPresentation.ts` and `accountPresentation.differential.test.ts`.

**Where the legacy copy lives during the transition:** `tests/differential/legacyAccountPresentation.ts`. It is test-only, so no production module may import it (add a lint/grep guard if wanted). Delete it after the suite has been green on stage for one release. It is a verbatim copy from the base. It vendors every function the batching may change:
- `resolveAccountRoleRow` SQL, `getAccountsForUser`, `getAccountById`, `getUsers`, `listAccessibleAccountIdsForUser`;
- `listAccountMembers(ForRole)`, `listAccessibleAccountsForUser`, `sanitizeAccountForClient(s)`, `ensureActiveAccountId`;
- the `/auth/me` handler body, `getMailboxSummaries`, `getUserMailboxSummary`, `authorizeMailboxSummary`, and the summary route handler.

It imports only modules the batching must **not** change: connection, row parsers, sender-identity rows, the session guard, `setActiveAccountId`, `assertStreamAuthorized` and `userEvents`. Vendoring the role SQL means a later edit to the shared eligibility fragment shows up as a diff instead of being silently shared.

How the suite works:
- **Order:** for each case, run legacy first; restore `user_accounts` and the `auth_session` selection/`updatedAt`; run the new code. The clock is frozen per pair (`setSystemTime`), so `generatedAt`, `exp` and Better Auth `updatedAt` match.
- **Comparison:** serialized output byte for byte (`JSON.stringify` for lib results; status + content-type + cache-control + sorted Set-Cookie + body for routes), **and** post-state equality (sessions, memberships).
- **Injection guard:** mid-read injections are installed per run, and a case fails if its injection never fired.
- **Statement hooks:** a test-local `Database.prototype` hook, restored in `afterAll`, so no module mocks are used. The `/auth/me` seam is the same session-UPDATE boundary as `app/api/auth/me/route.test.ts`.
- **SSE:** the legacy reader goes through the existing `loadSummary` seam in `lib/userEvents.ts`; the stream code itself is shared.

Cases (52):
- **Accounts and roles:** 1/2/12 mailboxes, owner role, invalid stored role string, disabled viewer, MFA-restricted user. Member counts cover 0–6 links, a duplicate owner+link, a link to a vanished user, a disabled member, and the `shared` boundary (solo = 1, pair = 2 members).
- **DTO sanitization:** manager/editor/viewer, caldav/DeepL incl. a whitespace DeepL key, and secrets that must never surface.
- **Revoked mid-read** at all four seams, plus a role downgrade mid-read (summary, `/auth/me`) and an other-mailbox revocation during selection.
- **Scope and events:** foreign/duplicate/unknown scope ids, foreign-mailbox events emit nothing, a disabled user's stream is denied, persisted vs NULL selection.

Validation on 0ac6cfa, legacy vs current (identical code): **52 pass / 0 fail**, 7.4 s. Two mutation probes were caught:
- dropping the `liveIds` recheck in `ensureActiveAccountId` → 1 failure;
- `shared: memberCount > 2` → 2 failures, but only after adding the solo/pair boundary mailboxes. The first fixture missed this, so the boundary is now part of the fixture.

Suggested extra assertion for the implementation: a per-entry-point statement budget in the same suite, using the same hook to count executions. For example, scoped event ≤ 12 and `/auth/me`(12) ≤ 25, so a regression to per-account reads fails CI.

## 5. Load protocol adaptation and baseline

Adapted from `sender-identities-slice2-regressions-r4`, unchanged otherwise:
- Real `saveDraftForAccount` loop with live MFA HTTP authorization, 11k-message shard A, two production sync loops (capacity 2, 30 ms pause), production watcher, 1 injected INBOX message per second.
- Auth writer subprocess with busy_timeout 0 on a separate handle, 50 ms tick, 60 s common window.

What I added (`load.ts`):
- **Reader user** with its own MFA session and **12 memberships** (mixed roles). Ten extra local mailboxes with 5 messages each use a rejected IMAP password, so the watcher logs one `AUTHENTICATIONFAILED` each and suspends them (verified: 10 × `auth_failed`, one connect each). The r4 sync/watcher profile is therefore unchanged.
- **Endpoint loops** in the main process, closed-loop with 25 ms think time: `GET /api/auth/me` and `GET /api/me/mailboxes/summary`, called through the real route handlers.
- **One production SSE stream** for the reader. Scoped reads are timed through the existing `loadSummary` seam. A 10 Hz publisher rotates `state` events over the 12 mailboxes (`state`, not `synced`, so r4's watcher-job count is not inflated).
- **Auth writer** extended so each tick does at most one write. The r4 session timestamp UPDATE runs on the remaining ticks. Every 4th tick flips the reader's role on an extra mailbox, every 10th tick adds/removes a churn member, and every 20th tick revokes or re-grants the reader's membership. BUSY is counted per kind.
- **`prepare.py`** archives a variant via `git archive` into `.tmp/<variant>` and adds the scratch timing probes. The r4 guard patch had to be adapted: on this tree `BEGIN IMMEDIATE` sits in its own `try` block, so the acquisition timestamp is now an outer `let`. The r4 patch as written would throw a ReferenceError here.
- **`run-load.sh`** applies the load gate (30 s polls, ≤20 min, then runs anyway) and records start/end load.

**Baseline sample `base-1` on 0ac6cfa** (full protocol, 60 s; not shortened). The gate passed at load 9.50. Setup took about 20 s, so the window itself started at **12.88**/11.39/8.18 and ended at 13.37/11.84/8.54. Raw data: `results/base-1/summary.json`, `logs/load-base-1.log`.

| Metric | base-1 |
|---|---|
| Auth writer attempts / `SQLITE_BUSY` | session **772 / 185** (24.0 %); role flips 220 / 46; member churn 55 / 17; revoke/re-grant 55 / 22; total 1102 / 270 |
| Guarded master hold p50 / p99 / max | **0.978 / 6.161 / 10.412 ms** (n = 720, aggregate 0.92 s); acquire p50 0.012 / p99 0.053 ms |
| All explicit master holds | p50 2.446 / p99 16.034 ms, aggregate 8.56 s per 60 s |
| `GET /api/auth/me` (12 mailboxes) | **p50 13.9 / p99 599.4 ms** (p95 167.4, max 1921), n = 658, all 200 |
| `GET /api/me/mailboxes/summary` (12) | **p50 20.2 / p99 79.0 ms** (p95 51.1, max 369), n = 1097, all 200 |
| SSE scoped read (lib, via seam) | **p50 3.44 / p99 20.5 ms** (p95 12.5), n = 565; 547 `mailbox-summary` events delivered |
| App `SQLITE_BUSY` retries / exhaustions | 652 / 0, of which **`setActiveAccountId` 135**, `upsertMessages` 167, queue/reserve/release 308 |
| Draft saves / failures; latency p50 / p99 | 720 / 0; 52.4 / 432.0 ms |
| Sync A / B done (failed) | 169 (0) / 177 (0); watcher cycles 52 |

This sample is the baseline only. It is not comparable to r4's numbers: the extra reader load runs in-process, the host load was higher, and it is one sample.

**Key observation for the design.** The `/auth/me` tail comes from its own session UPDATE. 135 `setActiveAccountId` BUSY retries over 658 requests (about 20 %), each paying the 96–144 ms retry delay, explain p95 167 ms and p99 599 ms. Removing statements alone will not move `/auth/me` p99 under writer load; only removing that write (decision 5.4) will.

For the after-comparison, run alternating samples (base-1, head-1, base-2, head-2) on the round-9 base vs the branch, in one session, with the same gate. Report the same table plus SSE event counts.

## 6. Implementation design

### 6.1 Batched reads (no read transaction, roles last)

Add one request-scoped loader in `lib/accountAccess.ts`:

```ts
loadAccountAccess(db, userId, { scope?: readonly string[]; identities: boolean }): AccessSnapshot
```

It executes these statements, in this order:

1. **Candidates.** The existing `getAccountsForUser` predicate plus `AND a.id IN (SELECT value FROM json_each(?))` when scoped. Returns `SELECT DISTINCT a.* … ORDER BY a.id`, mapped by the unchanged `mapAccountRow`.
2. **Member counts.** One statement for all candidate ids:
   ```sql
   SELECT m.accountId, COUNT(*)
   FROM (SELECT accountId, userId FROM user_accounts WHERE accountId IN (…)
         UNION SELECT id, ownerUserId FROM accounts WHERE id IN (…) AND ownerUserId IS NOT NULL) m
   JOIN users p ON p.id = m.userId JOIN auth_user u ON u.id = p.id
   GROUP BY m.accountId
   ```
   This matches legacy exactly: disabled members count, links to vanished users do not, and owner+link is counted once. A missing row means 0.
3. **Roles.** `resolveAccountRoleRows(db, userId, ids)` in `lib/db/accountAccess.ts`. It uses the **same eligibility SQL fragment**, exported once and used by both `resolveAccountRoleRow` and the batch, with the same `["viewer","editor","manager"]` post-filter.
4. **Identities**, only if `identities: true`, and only for accounts that have a role. Phase 1 reuses the existing cached per-account `listSenderIdentityRows`, because `lib/db/senderIdentities.ts` is SI-owned. A batched `listSenderIdentityRowsForAccounts(db, ids)` would make this a single statement. Add it only with the SI owners' consent: "consume existing rows" is satisfied without it.

Rules that keep the legacy semantics, all enforced by the differential suite:
- **No read transaction around 1–4.** Legacy reads are autocommit, so each statement sees the latest commit. A snapshot transaction would make a revocation committed after statement 1 invisible to the role read.
- **Authorization-relevant reads (roles, links) never move earlier than in legacy.** The role statement stays after the candidate read. The member-count statement is presentation only.
- **Byte identity:** sort with the same comparator and build objects with the same spread and key order (`{ account, role, isOwner, memberCount }`, account = `{ ...mapAccountRow(row), ownAddresses }`).

Entry points on top of the loader:
- `listAccessibleAccountsForUser(userId)` = `loadAccountAccess(..., { identities: true })`, same output.
- `listAccountMembers(accountId)`:
  1. owner read, unchanged and first, so the members injection seam holds;
  2. one `user_accounts` JOIN users/auth_user statement with `USER_ROW_SELECT`, filtered to the link and owner ids. The raw role string is kept, the owner is overridden to manager, and the same comparator is used.

  This replaces the all-users scan: 3 → 2 statements, independent of the total user count. `app/api/admin/accounts/route.ts` can then use an N-account variant (optional).

### 6.2 Request-local lifetime

There is **no memo module, no `AsyncLocalStorage`, and nothing on `globalThis`, the session object or the stream.** `AccessSnapshot` is a plain value:
- created inside the handler call or the SSE queue task,
- passed explicitly to the functions that need it (`sanitizeAccountsForClient(userId, snapshot?)`, the summary builder),
- garbage-collected when the handler returns.

The SSE stream creates a fresh snapshot **per event task**, never per stream. A per-stream snapshot would be a cross-request authorization cache. The session guard, `assertStreamAuthorized`, the 5 s liveness interval (`lib/authStreams.ts:92`) and `revokeAuthStreams` are not touched.

### 6.3 Final authorization stays transactional and per request

- `authorizeMailboxSummary(db, userId, summary)` keeps its signature. Inside it, the n per-mailbox `resolveAccountRoleRow` calls become one `resolveAccountRoleRows` call. It still runs inside the caller's deferred transaction (`getUserMailboxSummary`) and inside `assertStreamAuthorized`'s snapshot (route). Mailbox order and the `accessRole` replacement are unchanged.
- Both final checks remain: the lib's own check (which MCP relies on) and the route's check together with session liveness. Each costs 1 statement instead of n.
- Revoked-mid-read safety comes from these final rechecks, exactly as today. The injection seam "after the first shard statement" sits between the metadata read and the final authorization in both implementations.

### 6.4 `/api/auth/me` reuses the selection

New function `ensureActiveAccountSelection(session)` in `lib/auth.ts`, used only by `/auth/me`. The calendar import route keeps `ensureActiveAccountId` and its `MailboxSelection` shape. The new function keeps the two-attempt retry semantics:

1. **Pre-read** of the candidates as a projection (`id, name, email`) for the deterministic selection, sorted with the existing comparator.
2. **`setActiveAccountId`**: unchanged by default; see 6.5.
3. **Post-UPDATE fresh candidate read.** Same predicate, `a.*`, 1 statement. It replaces both `listAccessibleAccountIdsForUser` and `getAccountById(selected)`: the join on `accounts` proves the selected account still exists and is still a candidate. It also supplies the account rows for the payload, so a grant or revoke committed during persistence is reflected exactly as in legacy's later `sanitizeAccountsForClient`.
4. **Member counts + roles** (+ identities) for those rows, via the loader's statements 2–4, **after** the UPDATE. Role changes during persistence are reflected, which keeps the manager-only IMAP/SMTP host fields correct.

The route builds `accounts` from this snapshot through the unchanged `sanitizeAccountForClient`. The restricted path stays at 8 statements with no account reads. The second `getUserById` in the route (`:11`) stays: it is outside scope and `ActiveUserSession` does not carry the user.

### 6.5 When the session UPDATE can be skipped

- **Expiry and refresh are provably unaffected.** Better Auth computes refresh from `expiresAt` only (`node_modules/better-auth/dist/api/routes/session.mjs:180`). The hourly refresh writes `expiresAt` + `updatedAt` itself (`:198-201`). The `/auth/me` UPDATE writes only `updatedAt` + `activeAccountId` (captured SQL above) and sets no cookie.
- **Skip condition:** `session.activeAccountId === selected.id`, i.e. the value read by this request's `getSession`.
- **What does change if skipped:**
  1. `auth_session.updatedAt` is no longer bumped per app load. It is rendered as **"Last active"** in Security settings (`app/api/auth/security/route.ts:15` → `SecuritySettings.tsx:107`), which would then advance only on the hourly refresh or on a selection change.
  2. The `RETURNING` row is today's "session still exists" signal (`updated &&` at `lib/auth.ts:123`). Replace it with a read, `SELECT 1 FROM auth_session WHERE token=? AND julianday(expiresAt)>julianday('now')`. A read takes no write lock.
- Because (1) is visible to users and the post-state comparison in the differential suite includes `updatedAt`, ship the skip as a **separate, owner-gated commit**. With it, exclude only `auth_session.updatedAt` from the post-state comparison for the unchanged-selection cases and assert everything else.
- The base-1 load sample shows this write is the main `/auth/me` tail driver (§5: 135 BUSY retries, p99 599 ms).

### 6.6 Scoped summary events avoid loading all mailboxes

`getUserMailboxSummary(userId, scope)` passes the scope down into statement 1 and uses `identities: false`; summaries never read `ownAddresses`.
- A foreign mailbox event then costs 1 indexed statement (empty candidates) instead of the whole access list.
- An own-mailbox event costs 3 metadata statements regardless of how many mailboxes the user has.
- Per account, `getAccountDb` is called **once**. Add `readMailboxSummaryRow(db, accountId)` to `lib/db/mailboxSummary.ts`, used by both `getMailboxSummaries` and `getUserMailboxSummary`. This removes 3 master statements per account.
- `lib/userEvents.ts` is unchanged: it already passes `[accountId]`. Event shape and debounce are unchanged, so nothing changes for the Collab UI consumers.

### 6.7 Files touched

Phase 1, within the task's scope:
- `lib/db/accountAccess.ts`: shared eligibility fragment, `resolveAccountRoleRows`.
- `lib/accountAccess.ts`: loader, `listAccessibleAccountsForUser`, `listAccountMembers`.
- `lib/db/accounts.ts`: candidate read with optional scope and the selection projection.
- `lib/db/users.ts`: batched member counts, filtered member users.
- `lib/accountPresentation.ts`: `sanitizeAccountsForClient(userId, snapshot?)`.
- `lib/auth.ts`: `ensureActiveAccountSelection`; the gated UPDATE skip as a separate commit.
- `app/api/auth/me/route.ts`.
- `lib/mailboxSummary.ts`: scope pushdown, single `getAccountDb`, batched authorize.
- `lib/db/mailboxSummary.ts`: per-db summary row helper.
- `tests/differential/*` (2 files) and statement-budget assertions.

Not touched:
- `lib/userEvents.ts`, `lib/authStreams.ts`, `app/api/me/mailboxes/summary/route.ts` (signature kept).
- `lib/db/senderIdentities.ts`: SI-owned, unless approved.
- `lib/db/schema.ts` / `lib/db/connection.ts`: Phase 2 only.

Phase 2, optional and needing an owner decision: `ensureCalendarEventRuntimeData` (`lib/db/schema.ts:659`) runs `getAccountById` on **every warm `getAccountDb` call app-wide**. That is a full row read, 2–4 decrypts and an identities read, just to recompute a signature. A lightweight own-address read (`id, email` + identity emails; same `getOwnAddresses` result, so the signature is unchanged) cuts it to 1 statement with no decryption. Optionally, also merge the 3 shard summary statements into 1.

### 6.8 Estimated after-numbers (executed statements; ms are estimates)

| Scenario | Before | Phase 1 | + SI identities seam | + Phase 2 | ms before → Phase 1 (est.) |
|---|---:|---:|---:|---:|---|
| accessible / 1 · 2 · 12 | 6 · 11 · 61 | 4 · 5 · 15 | 4 · 4 · 4 | = | 3.35 → ~1 ms at 12 |
| accessible, disabled (12) | 23 | 3 | 3 | = | 0.98 → ~0.3 |
| `listAccountMembers` | 3 (all users) | 2 (members only) | = | = | flat in total users |
| summary route / 1 · 2 · 12 | 25 · 41 · 201 | 19 · 25 · **85** | = | 16 · 19 · **49** | 13.7 → ~7–8 (P2 ~5) at 12 |
| summary lib / 12 | 181 | 76 | = | 40 | 11.8 → ~6 |
| scoped event / 1 · 2 · 12 | 18 · 23 · 73 | 12 · 12 · **12** | = | 9 | 5.2 → ~2.5–3 at 12 |
| foreign-mailbox event (11) | 56 | **1** | = | = | 4.6 → ~0.5 |
| fan-out, 4 streams, 1 event | 171 | ~37 | = | ~30 | 12.6 → ~4 |
| `/auth/me` / 1 · 2 · 12 | 20 · 26 · 86 | 14 · 15 · **25** | 14 · 14 · **14** | = | 10.1 → ~6.5–7.5 at 12 (≈5.5 ms is fixed guard/Better Auth cost) |
| `/auth/me` with UPDATE skip | — | −1 statement, **no write** | | | under load: removes the 135/658 BUSY-retry tail |

The "about 4 batched metadata statements per request" target is met for the access metadata (candidates, counts, roles, identities). The remaining statements are the unchanged session guard, per-shard work, and the two final authorization checks, which are kept by design.

## 7. Risks and open questions for the integration owners

1. **Definition of "revoked mid-read" for byte identity.** Equality holds only at seams that exist in both implementations: after the candidate read, at the first shard statement, at the session UPDATE, and after the members owner read. The design keeps authorization reads at or after their legacy position, and the suite fails if an injection doesn't fire. Please confirm these seams as the binding definition. Arbitrary statement boundaries cannot be byte-identical between a 61-statement and a 4-statement implementation.
2. **Session UPDATE skip changes "Last active"** and needs a read to replace the RETURNING liveness signal. Decide: (a) never skip; (b) skip when unchanged (lastActive then updates hourly); or (c) skip only if `updatedAt` is younger than N minutes. My recommendation is (b) or (c) as a separate commit; it is the only change that moves `/auth/me` p99 under writer load.
3. **Sender identities.** Phase 1 keeps per-account cached identity reads (`/auth/me` 25 instead of 14 statements) to stay out of SI-owned files. Do the SI owners want the batched `listSenderIdentityRowsForAccounts` seam?
4. **Phase 2 (`getAccountDb` → `getAccountById` per warm call).** This is the largest remaining per-mailbox cost in summaries, and it applies app-wide (sync, lists, collab). It lives outside the listed files (`lib/db/schema.ts`). Should it go in this task, a follow-up, or nowhere?
5. **SSE fan-out.** Every open user stream does a summary read for every mailbox event, including mailboxes the user cannot see. Batching cuts a foreign event to 1 statement. Removing it entirely would need membership-aware routing at the publisher or a per-stream membership cache. The cache is a cross-request authorization cache and is therefore excluded, so this stays out of scope.
6. **Grant during `/auth/me` persistence.** This is covered by the post-UPDATE fresh read (6.4), but it is not in the binding case list. I suggest adding "mailbox granted during persistence" to the differential cases.
7. **Raw role strings.** `user_accounts.role` has no CHECK constraint. Legacy `listAccountMembers` returns unknown strings raw, while role resolution drops them; the batched code must keep both behaviours (fixture case included). A schema CHECK would be a separate migration.
8. **JSON key order** is part of byte identity. Reuse `mapAccountRow` and the existing spreads; do not rebuild DTOs field by field.
9. **`json_each` IN-lists.** Verify with EXPLAIN QUERY PLAN that `a.id IN (SELECT value FROM json_each(?))` uses the accounts PK, and that `idx_user_accounts_account` / the user_accounts PK are used for the count and role statements. Do not run ANALYZE.
10. **Base drift and load evidence.** All numbers are on 0ac6cfa. The round-9 head was not available locally (`origin/integration/stage` = 11dc3c5). There is one load sample, at host load about 13, so the head comparison needs alternating paired samples in one session. The r4 guard patch needed the adaptation described in §5 on this tree. Check it again on round 9 (`prepare.py` asserts every anchor).

## Cleanup and verification

- `git status --short`: empty.
- The temporary `tests/differential/` copy was removed. The `.tmp/base` archive, `.tmp/load-base-1` and the TMPDIR contents were deleted after the run.
- Not run in this spike: `tests/runTeamAuthSecurityControls.sh` (no product change to verify), the full test suite, and any build.
