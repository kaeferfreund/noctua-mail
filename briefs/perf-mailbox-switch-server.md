# Spike C: mailbox-switch latency, server-side profile

Read-only spike on **647359b** (dev preview) in `wt-spike-switch-server`, 2026-10-23 UTC.
- No commits, branches or tracked-file edits. `git status --short` is empty at the end.
- Prototype patches lived only in an untracked `git archive` copy under `.tmp/proto` (git-ignored) and were deleted afterwards. The diff is kept as `perf-mailbox-switch/server/proto.patch`.
- All data is synthetic (`example.test`). Every bun command ran under `nice -n 10`.
- Route handlers were called in-process with real Better Auth MFA sessions (the r4/batching protocol).
- The only port used: the IMAP fixture on 3910/3911 for the contention and IMAP probes. Every process I started was stopped by PID or exited.

Harness, raw JSON and reproduction: `briefs/perf-mailbox-switch/server/` (see §10).

## 1. Summary

**What a switch costs on the server.** The serial critical path is `POST /api/auth/switch-account → GET /api/auth/me → GET folders → GET threads (page 1, 300 threads, default view)`. Clean paired run, host load 7–9, 12 mailboxes, warm shards:

| | p50 | p90 | p99 |
|---|---:|---:|---:|
| **Critical path, sum of the 4 steps** | **66.5 ms** | 110.6 | 141.8 |
| switch-account | 4.6 | 5.9 | 10.7 |
| /auth/me | 9.6 | 10.9 | 17.1 |
| folders | 2.5 | 5.3 | 10.2 |
| threads, page 1 (all sizes) | 49.1 | 91.6 | 112.9 |
| threads at 50 / 2,000 / 11,000 messages | 7.0 / 49.1 / 90.6 | | |

Notes on the table:
- The p50 sum of the steps is less than the critical-path p50, because the percentiles are taken per switch.
- With the target shard idle-closed (cold), the critical path is 73.0 / 121.2 / 123.4 ms.
- Under writer contention (all loads together), see §4: p50 114–128 ms / p99 584–1,998 ms, with 86–103 `SQLITE_BUSY` retries on the two session writes per 60 s and one failed request (an exhausted write that reaches the route as a 500) per run.

**Top 5 server contributors on the switch path** (2k-message mailbox, warm):
1. **Topic-suggestion enrichment in the threads route: ≈ 20 ms per first page,** even in a mailbox **without a single topic**.
   - Path: `enrichMessagesWithThreadTopics` → `getTopicSuggestionsForThreads` (`lib/topics/suggestions.ts:674`).
   - Cause: for each of ≈1,500 signal rows, `shouldIgnoreTopicSuggestionSignal` (`:111-139`) re-normalizes the account's own addresses and re-parses the value through `ownAddressList` / `isOwnAddress` (URL constructor + nodemailer addressparser).
2. **`listThreads` SQL: 13 ms at 2k, 55–59 ms at 11k.** Six full-scope statements per first page:
   - selector with a flagged-EXISTS sort: 14.2 ms at 11k;
   - group counts: 10.6;
   - the 900 message rows, read via the account-wide **date** index instead of the thread index: 10.9;
   - thread COUNT: 8.6;
   - baseCount: 5.3;
   - total: 3.5.
3. **`/auth/me` on the switch path: 9.6 ms.** Its 86 statements are the batching spike's numbers, unchanged on 647359b: about 3.3 ms of account-presentation reads, the session UPDATE, and a 7-statement guard. It also costs a round trip.
4. **Two `auth_session` UPDATEs per switch**, one in switch-account and one again in `/auth/me` with the same value.
   - Each costs 2.6–2.9 ms uncontended (WAL commit + fsync on master).
   - Under writer load they hit `SQLITE_BUSY` (auth and master handles run at busy_timeout 0) and pay 96–144 ms per retry, see §4.
5. **Date grouping in JS: 4.4 ms per first page.** `buildTimeGroupKey` / `buildMessageGroupKey` (`lib/messageGrouping.ts:42-44,71`) call `displayDayNumber` (`lib/i18n/format.ts:39`, `Intl.formatToParts`) three times per message, including once for `now` for every message.

Smaller items:
- A cold shard open costs 6.9–8 ms, once per mailbox after a 5-minute idle close (§5).
- Every warm `getAccountDb` costs 0.21–0.25 ms: `ensureCalendarEventRuntimeData` → `getAccountById` + identities. The threads route calls it 7 times.
- No IMAP work runs synchronously on the critical path. The folder-consistency POST that follows the switch does an IMAP STATUS round trip inside the request, off the list path (§6).

**Measured fix prototype** (4 cheap, behaviour-identical changes, `proto.patch`). Response bodies are byte-identical (72/72 sha256 per route × mailbox, both pairs):

| Critical path | base p50 / p90 / p99 | prototype p50 / p90 / p99 |
|---|---|---|
| clean pair (load 7–9) | 66.5 / 110.6 / 141.8 | **38.4 / 72.3 / 119.0** |
| replicate pair (load 10–22) | 74.6 / 138.4 / 209.5 | 55.2 / 110.2 / 166.2 |
| threads 2k / 11k (clean) | 49.1 / 90.6 | **23.1 / 54.0** |
| /auth/me (clean) | 9.6 | **6.8** |

**Planned rank-2 batching (batched `/auth/me` + summary reads) plus the session-UPDATE skip (variant c).** Quantified on the switch's critical path (§8):
- quiet: **≈ −6 to −6.5 ms of 66.5 ms p50 (≈ 10 %)**: batching ≈ −3 to −3.5 ms, measured skip −2.8 ms. Quiet p99 is within noise (≈ −3 to −5 ms of 141.8);
- p99 under writer load: the skip removes **all** `/auth/me` BUSY retries in every load phase (17 / 53 / 37–49 → 0 per 60 s); `/auth/me` p99 under sync load drops 1,019 → 18 ms and under all loads 456–907 → 63 ms. switch-account's own write keeps 37–82 retries per 60 s (p99 167–457 ms) and remains the dominant contention tail (S4c fixes it);
- the summary half of the batching is **not** on the switch path. The user-wide summary is loaded once per session, and again only on `mailboxes-changed`.

What remains after batching: threads (≈ 75 % of the path), switch-account's own write, and the round trips. If the client adopts D1 (drop `/auth/me` from the switch), the batching branch saves **0 ms on the switch path**; it still helps boot, the session poll and SSE.

**Contention finding (§4).** Every `SQLITE_BUSY` on the switch path is one of the two session writes (`setActiveAccountId`, busy_timeout 0, coarse 96–144 ms retry steps). Background sync's lease writes are the main collider.
- Under sync load, 25–27 % of those writes retry: p99 0.8 / 1.0 s.
- Under all loads (a stress profile), about one request per minute exhausts its 5 attempts and fails as a 500.
- The variant (c) skip removes `/auth/me` from this completely. Fast handshake retries for the remaining switch-account write (S4c) are the missing piece.

**Recommended order:**
1. S1 + S2 + S3: free files, measured, byte-identical; S3 coordinated with FTS.
2. S4 (variant c + compare-and-set) and S4c: auth-owned, flagged, small diffs.
3. S6 and S1b: query-layer and topic follow-ups with differential tests.
4. S7/S8: Phase 2.

S5/S9 only if the client does not adopt D1.

**Verification requested by the integration thread (§7):** the D1 safety argument **holds**. No per-account route, `/api/me/*` route or stream reads the session's selected mailbox; all of them authorize by the path id. One correction: `/api/calendar/import` also reads, and writes back, the selection. One caveat: `ensureActiveAccountId` can overwrite a concurrent switch (lost update). Neither makes D1 unsafe.

## 2. Requests a switch triggers (from the client code, 647359b)

Critical path, serial:
1. `useAccountController.switchAccount` (`useAccountController.ts:206`) → `POST /api/auth/switch-account`.
2. `loadInitialData` (`:130`) → `GET /api/auth/me`.
3. Then `GET /api/accounts/<B>/folders` (`:179`).
4. `useMessageData` load effect (`useMessageData.ts:180`) → `GET /api/accounts/<B>/threads?page=1&pageSize=300&groupBy=date&threadDateSource=latestReceivedDateValue&folderId=<B>:INBOX`. These are the defaults: `MailClient.tsx:556,560,609`, `messageListQueryUrl.ts:49-113`, `threadDate.ts:8`.

Side requests, in parallel or on idle:
- `GET topics` (`useTopics.ts:59`), `GET topics/stats` (idle, `:32`), `GET recipient-aliases` (idle, `useRecipientAliases.ts:27`), `GET calendar/events` for the upcoming window (`useReminderNotifications.ts:296`).
- `POST folders/<INBOX>/consistency`, an IMAP STATUS (`useSyncController.ts:787,494`).
- `EventSource imap/stream`, an IMAP IDLE (`:1223`).
- Once per browser session per account: the startup sync `POST sync` + `sync/status` polling (`useStartupSync.ts`).
- If CalDAV is configured: `POST calendar/sync` (`MailClient.tsx:4305`).

Not on the switch path:
- `/api/me/events` and `/api/me/mailboxes/summary`: keyed by user id, not by account (`MailClient.tsx:2841-2843`). Summary is re-read only on `mailboxes-changed`.
- `prefs`: only when an HTML message renders (`useRemoteContent.ts:25`).

## 3. Per-route profile (in-process, clean run `results/3-base.json`)

Fixture (`fixture.ts`):
- 12 shards: 4 × 50 messages, 4 × 2,000, 3 × 11,000, and 1 with 3,000 messages in 38 folders. 70 % INBOX, 3 messages per thread, collab state on every 5th thread, one alias per mailbox, CalDAV on every 3rd mailbox.
- Users: one MFA user with 12 memberships (manager/editor), a second MFA user with the same 12, and 4 plain members.
- Shards are opened, closed and reopened once, so runtime probes are settled as on a long-running server.

Method:
- Each route ran 180 times warm (15 rounds × 12 mailboxes, rotating so consecutive switches target different shards).
- 72 times cold: the target shard was closed via `closeAccountDbConnection` before the switch, as the 5-minute idle timer does.
- Statements were counted at the bun:sqlite driver (`sqlcounter.ts`: compiles = prepare + query-cache misses + run/exec; execs = statement executions; ms = driver time).

| Route (warm) | p50 | p90 | p99 | SQL ms p50 | execs | compiles | response | writes |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| POST switch-account | 4.6 | 5.9 | 10.7 | 3.1 | 10 | 8 | 32 B | **1**: `update "auth_session" set "updatedAt", "activeAccountId" … returning *` |
| GET /auth/me (12 mailboxes) | 9.6 | 10.9 | 17.1 | 6.1 | 86 | 49 | 7.7 kB | **1**: the same UPDATE, same value |
| GET folders | 2.5 | 5.3 | 10.2 | 1.1 | 15 | 11 | 0.65 kB (5.7 kB at 38 folders) | 0 |
| GET threads, 50 msgs | 7.0 | 8.2 | 13.6 | 3.0 | 44 | 28 | 34 kB | 0 |
| GET threads, 2,000 msgs | 49.1 | 51.8 | 58.9 | 17.6 | 46 | 30 | 706 kB (900 items) | 0 |
| GET threads, 11,000 msgs | 90.6 | 96.2 | 134.5 | 58.7 | 46 | 30 | 706 kB | 0 |
| GET threads, 38 folders / 3k | 52.4 | 56.0 | 57.6 | 22.3 | 46 | 30 | 707 kB | 0 |
| GET topics | 2.4 | 7.6 | 12.6 | 0.75 | 14 | 10 | | 0 |
| GET topics/stats | 2.0 | 2.4 | 6.8 | 0.68 | 14 | 10 | | 0 |
| GET recipient-aliases | 1.8 | 2.2 | 6.1 | 0.67 | 14 | 10 | | 0 |
| GET calendar/events | 1.9 | 2.2 | 6.6 | 0.72 | 14 | 10 | | 0 |
| (reference) GET /api/me/mailboxes/summary | 36.4 | 44.7 | 51.6 | 29.6 | 201 | 104 | | 0 |

| Route (target shard cold) | p50 | p90 | p99 | execs | compiles | shard opened | writes |
|---|---:|---:|---:|---:|---:|---:|---|
| switch-account | 4.7 | 5.8 | 6.9 | 10 | 8 | 0/72 | session UPDATE |
| /auth/me | 9.2 | 10.4 | 13.3 | 86 | 49 | 0/72 | session UPDATE |
| **folders (first shard access)** | **9.6** | 11.9 | 20.4 | **97** | **93** | **72/72** | 9 × no-op `CREATE … IF NOT EXISTS` (no lock, §5) |
| threads | 49.1 | 94.7 | 96.8 | 46 | 30 | 0/72 | 0 |

First request of each route in a fresh process (modules already imported): switch 15.5 ms, me 16.4, folders 5.1, threads 84.2 (run 1).

**Writes on the switch path:**
- exactly two, both `auth_session` (switch-account, then `/auth/me` rewriting the same `activeAccountId` with a fresh `updatedAt`);
- no last-active, prefs or audit writes;
- no shard writes.

**Dominant statements** (ms per call, warm; `results/3-base.json` histograms; `summarize.py stmts`):
- switch-account: session UPDATE 2.9 of 3.4 ms SQL. Then 2 role reads (pre- and post-write), the guard (Better Auth session + user, `USER_ROW_SELECT`, security sidecar, enrollment, provisioning, lifecycle).
- /auth/me:
  - session UPDATE 2.6;
  - `USER_ROW_SELECT` × 14 (`getUsers()` inside 12 × `listAccountMembers`, plus guard and route) 1.7;
  - `sender_identities` × 25: 0.6;
  - `user_accounts` × 12: 0.6;
  - two candidate reads, 0.4 each;
  - `ownerUserId` × 12, role × 12.
  - This is the batching spike's call map E, unchanged.
- threads, 2k:
  - messages rows 5.9;
  - selector 5.4;
  - group counts 4.5;
  - thread COUNT 3.2;
  - baseCount 2.2;
  - total 1.3;
  - thread_signals (suggestions) 1.1;
  - `SELECT * FROM accounts WHERE id=?` × 7: 0.75 (`getAccountDb` → `ensureCalendarEventRuntimeData` → `getAccountById`);
  - calendar invite data 0.7.
- threads, 11k (`results/listsql.json`, with query plans): selector 14.2, messages rows 10.8, group counts 10.6, thread COUNT 8.8, baseCount 5.3, total 3.5.

**Threads anatomy** (`anatomy.ts`, 40 iterations, `results/anatomy.json`; 2k / 11k):

| Phase | 2k | 11k |
|---|---:|---:|
| whole route, pageSize 300 | 50.7 | 95.9 |
| `listThreads` (SQL) | 22.5 (13.3) | 65.0 (55.6) |
| of which date grouping (`buildTimeGroupKey` × 900) | 4.4 | 4.5 |
| topic enrichment **with** suggestions (no topics in the mailbox) | **20.1** | **20.4** |
| topic enrichment without suggestions | 1.0 | 0.9 |
| collab enrichment | 1.2 | 1.2 |
| slim + `JSON.stringify` (706 kB) | 1.1 | 1.2 |
| `requireAccountContext` (guard + role + account) | 1.6 | 1.5 |
| `validateAccountFolders` | 0.2 | 0.2 |
| whole route, pageSize 100 / 50 | 26.1 / 20.1 | 65.1 / 58.6 |

Topics present (6 topics, 400 older threads tagged, so first-page threads compute suggestions against real learning signals): anatomy with `SWITCH_TOPICS=1`, base → prototype (`results/anatomy-topics2-*.json`):

| 2k / 11k | base | prototype |
|---|---|---|
| route, pageSize 300 | 71.9 / 129.9 ms | **52.2 / 90.7 ms** |
| enrich topics + suggestions | 35.8 / 43.4 ms | **24.0 / 29.1 ms** |
| `listThreads` | 23.3 / 68.8 ms | 15.4 / 49.4 ms |
| `buildTimeGroupKey` × 900 | 4.8 / 4.8 ms | 0.5 / 0.5 ms |

Normalized response hashes (topic ids and timestamps mapped to names) are identical for all 6 page sizes × mailboxes.

## 4. Contention (`switch-load.ts`, 60 s per phase, one process, `results/load-*.json`)

The main loop runs the 4-step critical path with 100 ms think time. Load per phase:
- **(a) auth writer:** separate handle, busy_timeout 0, 50 ms tick. Session `updatedAt` writes on the second session, every 10th tick a membership churn on another user. This is the r4 stress profile, 20 writes/s.
- **(b) background sync:** two production `runSyncOperation` loops (lease queue, 30 ms pause) on two extra IMAP-fixture mailboxes (other shards, fixture on 3910/3911), 1 injected INBOX message per second.
- **(c) second active session:** another MFA user with the same 12 memberships runs its own switch loop plus summary GET, 25 ms think time.
  - It runs in-process: Better Auth's lifetime lock (`lib/authLifetimeLock.ts:39`) admits only one app process per datastore, as in production.
  - Retries are attributed per loop through `AsyncLocalStorage`, and counted from `withDbWriteRetry`'s `[db-write-retry] retry` warnings.

"base" = 647359b, "proto" = the prototype (S1 + S2 + S3 + S4 variant c).
- Phases marked `*` are the re-run of the phases in which the first proto run crashed on an unretried exception. The harness now records thrown errors instead of crashing.
- Host load is listed per phase. The first proto run ran at load 14–17 against 4–19 for base, so compare the BUSY counts more than the ms.

| Phase | variant | host load | switches/60 s | critical p50 / p90 / p99 | switch-account p50 / p99 · BUSY retries (Σ wait) | /auth/me p50 / p99 · BUSY retries (Σ wait) | folders p50 / p99 | threads p50 / p99 | thrown (500) |
|---|---|---|---:|---|---|---|---|---|---|
| quiet | base | 4.1→6.0 | 334 | 65.2 / 114 / 420 | 5.5 / 336 · 0 | 8.3 / 94.7 · 0 | 2.3 / 10.8 | 47.0 / 105 | 0 main |
| quiet | proto | 17.0→15.8 | 379 | 44.7 / 84.1 / 235 | 10.7 / 219 · 0 | 6.1 / 17.2 · 0 | 2.5 / 9.2 | 23.4 / 67.9 | 0 main |
| a | base | 6.0→7.7 | 321 | 67.7 / 134 / 507 | 5.4 / 144 · **12** (2.1 s) | 8.5 / 148 · **17** (2.6 s) | 2.3 / 13.1 | 49.0 / 130 | 0 main |
| a | proto | 16.1→14.3 | 362 | 43.9 / 127 / 318 | 8.1 / 167 · **37** (5.0 s) | 6.0 / 20.1 · 0 | 2.5 / 28.8 | 23.9 / 81.7 | 0 main |
| b | base | 7.7→11.2 | 212 | 110 / 379 / 1113 | 7.5 / 788 · **58** (9.3 s) | 9.9 / 1019 · **53** (12.3 s) | 2.5 / 28.6 | 51.0 / 151 | 0 main |
| b | proto | 14.2→15.3 | 315 | 43.9 / 182 / 462 | 6.5 / 425 · **82** (13.4 s) | 5.9 / 18.2 · 0 | 2.4 / 15.5 | 23.4 / 99.0 | 0 main |
| c | base | 11.2→19.4 | 219 | 110 / 240 / 395 | 8.7 / 142 · 0 | 13.1 / 119 · 0 | 4.0 / 126 | 56.3 / 223 | 0 main |
| c | proto | 15.3→12.3 | 309 | 71.2 / 133 / 189 | 9.9 / 77.8 · 0 | 6.9 / 75.8 · 0 | 4.7 / 68.4 | 26.2 / 88.0 | 0 main |
| all | base | 18.6→15.5 | 218 | 114 / 316 / 584 | 8.3 / 378 · **49** (6.7 s) | 10.7 / 456 · **37** (5.9 s) | 3.1 / 96.4 | 53.6 / 195 | 0 main, 1 second |
| all | proto | — | — | — (main loop crashed on an unretried BUSY in this phase, re-run as `all*`) | | | | | |
| all* | base | 11.1→10.3 | 186 | 128 / 383 / 1998 | 9.4 / 445 · **54** (9.0 s) | 11.0 / 907 · **49** (10.1 s) | 2.9 / 91.0 | 49.1 / 119 | 1 main, 1 second |
| all* | proto | 10.5→10.2 | 257 | 73.0 / 208 / 523 | 10.6 / 457 · **72** (11.9 s) | 6.2 / 62.9 · 0 | 3.4 / 54.3 | 25.6 / 87.9 | 1 main, 1 second |
| quiet-2 | base | 15.5→10.0 | 354 | 66.7 / 113 / 156 | 5.6 / 43.3 · 0 | 8.7 / 26.1 · 0 | 2.3 / 11.5 | 48.5 / 129 | 0 main |
| quiet-2 | proto | — | — | — (not reached: the run had stopped in `all`; re-run as `quiet-2*`) | | | | | |
| quiet-2* | base | 10.6→10.6 | 322 | 71.9 / 124 / 610 | 7.4 / 109 · 0 | 10.4 / 222 · 0 | 2.5 / 13.3 | 50.0 / 177 | 0 main |
| quiet-2* | proto | 10.2→13.9 | 394 | 42.7 / 84.0 / 146 | 7.1 / 65.2 · 0 | 6.2 / 21.7 · 0 | 2.6 / 10.3 | 24.1 / 79.7 | 0 main |

Findings:
1. **Session writes are the whole contention story.**
   - folders and threads take no BUSY retries in any phase. Their p99 rises only with host CPU load.
   - Every retry on the switch path is `setActiveAccountId` (master + auth handles at busy_timeout 0, `lib/db/connection.ts:119,300`).
   - The coarse policy waits 96–144 ms, then 192–288, 384–576 … (`lib/dbWriteRetry.ts:12-14,93-94`). Under background sync (phase b), **27 % of switch-accounts and 25 % of `/auth/me` calls retried**, adding 44 / 58 ms on average and up to 0.8 / 1.0 s at p99.
2. **The writers that collide are the sync lease writes**, not the auth writer: `queueSyncWorker` / `reserveSyncWorker` / `releaseSyncWorker`, about 140–200 retries per child per 60 s on their side.
   - The r4-style auth writer at 20 writes/s causes 12–37 retries per 60 s on the switch path.
   - A second active session (in-process, same connection) causes **0** retries: in-process requests serialize on the one connection. Its effect is CPU only (critical p50 65 → 110 ms base, 44 → 71 ms proto).
3. **Failures, not just latency.** Under all loads, each 60-s run had one request whose session write was still BUSY after 5 attempts (`[db-write-retry] exhausted`, 1.96 s). The route then throws, which is a 500:
   - base `all*`: `/auth/me` (main) + 1 second-session request;
   - proto `all*`: switch-account (main) + 1 second-session request;
   - base `all`: 1 second-session request.
   - Stack: `kysely update-query-builder → @better-auth/kysely-adapter update` inside `withDbWriteRetry("setActiveAccountId")`.
4. **The variant (c) skip removes `/auth/me` from the contention picture entirely** (0 retries in every phase). What remains is switch-account's own write. S4c fixes it.

## 5. Cold shard: cost and repetition

- **When it happens.** `getAccountDb` keeps a shard open until `ACCOUNT_DB_IDLE_MS` (default 5 min, `lib/db/connection.ts:57-63`) without access, then `closeAccountDbConnection` (`:188`) also forgets the path and probe-ready keys. The first request after that pays the open again.
  - Switching back to a mailbox within 5 minutes is warm.
  - The watcher/sync keeps shards it touches open.
- **Cost.** `getAccountDb` cold is **6.9–8.2 ms** (85 execs / 83 compiles, SQL 4.3–5.1 ms) vs **0.21–0.25 ms warm** (3 execs). Size-independent (50 to 11k messages: 7.4–8.2 ms). Breakdown of the cold statements:
  - **schema/format probes 45 execs / 2.65 ms**: `PRAGMA user_version` × 8, `pragma_table_list` × 3, `sqlite_master` × 3 + 6, `table_info` × 5 (`initAccountSchema` / shard-format validation);
  - PRAGMAs 0.75 ms (journal_mode, busy_timeout, synchronous, cache, mmap, autocheckpoint, journal limit);
  - 9 no-op `CREATE … IF NOT EXISTS` 0.55 ms;
  - runtime-data probes 0.32 ms (`ensureThreadSignalRuntimeData`, `ensureThreadLatestReceivedDateValues`, `ensureTopicLearningRuntimeData`, calendar UID-key backfill scans);
  - plus about 2.5 ms of JS.
- **No lock risk.** A probe (`lockprobe`, run inline) confirmed that a no-op `CREATE TABLE/INDEX IF NOT EXISTS` on an existing object succeeds while another connection holds `BEGIN IMMEDIATE` with busy_timeout 0. Only a real create needs the lock. Cold reopen of a migrated shard therefore cannot hit `SQLITE_BUSY` from a concurrent shard writer.
- **Is it repeated on every switch back?** No, only after 5 minutes of idle. The warm part, `ensureCalendarEventRuntimeData` → `getAccountById` (full row, 2–4 decrypts, identities), **is** repeated on every `getAccountDb` call: 7 per threads request, about 1.5 ms. This is the batching task's deferred "Phase 2".

## 6. IMAP work inside switch-triggered requests

- None of the four critical-path routes touches IMAP.
- `POST folders/<INBOX>/consistency` (`consistency/route.ts:23`) calls `getImapMailboxStatus` (`lib/mail/imap/mailbox.ts:99`, pooled client, STATUS) synchronously.
  - Loopback fixture (smoke): 21.9 ms with a cold pool, 6.9 ms p50 warm (n=30), 10.1 ms after a pool drain.
  - Full run: full run: cold pool 14.4 ms, warm p50 4.2 ms (n=30), 6.5 ms after a pool drain.
  - Against a real provider, add TLS connect + LOGIN (typically hundreds of ms) on the first switch to a mailbox after its pool connection expired.
  - It is off the list path: the client does not wait for it before listing. It can, however, trigger a repair sync.
- `imap/stream` opens an IDLE connection per active mailbox (off path).
- The startup sync runs once per browser session per account.

## 7. Verification: is D1 (parallel `switch-account` + folders, no `/auth/me`) safe on the server? (requested by the integration thread)

**Verdict: the client brief's core claim holds. No route under `app/api/accounts/[accountId]/**`, no `/api/me/*` route and no stream authorizes or scopes by the session's stored selection. One correction and two caveats follow; neither makes D1 unsafe.**

### 7.1 Every read of the stored selection (`auth_session.activeAccountId`) on 647359b

Method: `grep -rn activeAccountId app/api lib scripts` (tests excluded), plus searches for other spellings (`activeaccount`, `active_account`, `selectedAccount`, `selectedMailbox`), raw `auth_session` SQL in `app/api/_helpers`, direct `auth.api.getSession` callers, and Better Auth session hooks. Complete result:

| file:line | What it does |
|---|---|
| `lib/betterAuth.ts:128` | Declares the field (`input:false`, so a client cannot set it through Better Auth). |
| `lib/betterAuth.ts:223-226` | `setActiveAccountId`: the only writer. `updateSession(token,{activeAccountId})` under `withDbWriteRetry`. |
| `lib/auth.ts:15,91` | `requireActiveUserSession` copies `result.session.activeAccountId` into `ActiveUserSession.activeAccountId`. It is **carried, not checked**. No authorization decision in the guard uses it. |
| `lib/auth.ts:110-131` `ensureActiveAccountId` | The **only reader** that uses the value. It picks `accounts.find(a => a.id === session.activeAccountId) ?? accounts[0]` from the user's *current* memberships (`:120`), persists that choice (`:121`), and rechecks `listAccessibleAccountIdsForUser` + `getAccountById` (`:122-123`). A stale or revoked stored id is dropped, not honoured. |
| `app/api/auth/me/route.ts:14` | Caller 1: returns `accountId` / `mailboxState` to the client. Presentation and default selection only. |
| **`app/api/calendar/import/route.ts:36-47`** | **Caller 2, missing from the client brief.** The import target is the stored selection (`sessionAccountId`), because file launches do not know an id. It is **not** under `accounts/[accountId]`. A body `accountId` must equal the selection, otherwise 403 (`:45`). Access is then re-authorized by `requireAccountContext(request, accountId, {minRole:"editor"})` (`:47`). It fails closed: during a switch race the import gets either 403 or lands in a mailbox the user holds editor rights on. |

Better Auth database hooks (`lib/authPolicyHandler.ts:260`) only hook `session.create.after`. No hook reads or rewrites `activeAccountId`. The only other direct `getSession` caller is `app/api/auth/logout/route.ts:12`.

### 7.2 Every account-scoped route authorizes by the path id

All 86 `route.ts` files under `app/api/accounts/[accountId]/**`, plus `/api/accounts`, `/api/me/*` and `/api/calendar/*`, were enumerated (`find … -name route.ts`), and each one's auth entry point was checked:

- **Direct `requireAccountContext(request, <path accountId>, {minRole})`** or `requireAccountContextFromParams`: calendar/*, categories/debug|model/reset, compose/recipients, destination-folders, drafts/*, folders (GET/PUT, create, rename, delete), identities/*, imap/poll, imap/stream, mcp-tokens/*, members/*, message-topics/*, messages (bulk delete/flags/move/copy, `[messageId]` GET/html/attachments/calendar-diff/source), prefs, recipient-aliases/*, related, reminders, the account root, sender-icon, settings, smtp/send, sync/new-candidates, thread/related, threads (list), topics/*, translation/*.
- **Through a helper that calls `requireAccountContext` with the path id:**
  - `requireImapMessageMutationContext` / `requireAccountAndMessageContext` (`app/api/_helpers/message/routeHelpers.ts:30-38`): messages/`[messageId]` archive, category, delete, flags, not-spam, resync, spam, translate, unsubscribe.
  - `withThreadCollab` → `requireCollabAccountContext` (`app/api/_helpers/threadCollabContext.ts:9-20`): threads/`[threadId]` activity, collab, comments.
  - `handleSyncStartRequest` / `handleSyncStatusRequest` (`app/api/_helpers/syncJobs.ts`), `handleRecomputeStartRequest` / `handleRecomputeStatusRequest` (`app/api/_helpers/recomputeJobs.ts`), `handleListMessagesRequest` (`app/api/messages/listMessagesHandler.ts:48`, messages + search), `handleFolderConsistencyRequest` (`folders/[folderId]/consistency/route.ts:23-30`), and `handleMailboxCredentialMutation` (`app/api/_helpers/mailboxPatch.ts:42-43`, path id, `minRole:"manager"`, relogin).
- `requireAccountContext` (`app/api/_helpers/accountContext.ts:43-64`) runs the full session guard, then `resolveAccountRole(session.userId, accountId)`. That is `resolveAccountRoleRow` (`lib/db/accountAccess.ts:4-13`): membership or ownership, not banned, provisioning complete, role in viewer/editor/manager. Then it checks the minimum role and `getAccountById`. The session selection is not an input.
- **Streams:**
  - `imap/stream` builds its auth identity from the path account (`imap/stream/route.ts:91-92`, `accountId` from `accountContext`). Delivery runs `assertStreamAuthorized` (`lib/authStreams.ts:26-55`), which rechecks the session row, MFA state and `resolveAccountRoleRow(identity.accountId)`.
  - `/api/me/events` and `/api/me/mailboxes/summary` are user-wide. They filter every event or summary by `resolveAccountRoleRow` per mailbox (`lib/userEvents.ts:52`, summary route + `authorizeMailboxSummary`). No selection is involved.
- `/api/accounts` GET lists the user's memberships (`sanitizeAccountsForClient(session.userId)`). No selection.
- MCP (`app/api/mcp/route.ts`) is bearer-only (`requireMcpAccountContext`). No session selection.

**So no route authorizes or scopes by the session selection instead of the path id.** The stored selection is a UI default that `ensureActiveAccountId` re-validates. It is not an authorization token. Revoking a membership does not clear it either (no writer besides `setActiveAccountId`).

### 7.3 What `switch-account` does besides the write (`app/api/auth/switch-account/route.ts`)

1. `requireJsonSameOrigin` (`:8`): CSRF guard (JSON content type plus same origin).
2. `requireActiveUserSession` (`:10`), **without** `allowRestricted`. A session that still needs MFA enrollment or re-auth gets 403 here. This is the same guard as every per-account route.
3. Body parse; a missing id gives 400 (`:13-17`).
4. `requireAccountAccessOr403` (`:18`, `lib/auth.ts:97-101`): `resolveAccountRole(userId, id)`, so any role in viewer/editor/manager. The per-account read routes require `minRole:"viewer"`, which is the same set. There is **no `getAccountById` existence check** beyond the role join (`accounts a JOIN …`), so a deleted account has no role.
5. `setActiveAccountId(token, id)` (`:20`). `RETURNING` null (session gone) gives 401.
6. **Post-write recheck** `requireAccountAccessOr403` (`:22`). If access was revoked while the write ran, it writes `null` back and returns 403 (`:23-26`).
7. Returns `{ok:true, accountId}`. **No audit record, no IMAP, no cache, no other write.**

Consequence for a concurrent `GET folders`: every check `switch-account` makes is also made by `requireAccountContext` in the folders request, at its own read time:
- same guard (session row, user not disabled, provisioning, sidecar generation and assurance, MFA-restricted → 403);
- same role function with an equal-or-stronger minimum role;
- plus an account-existence check.

The only rejection folders cannot reproduce is the CSRF/JSON shape check (irrelevant for a GET) and the post-write revocation window. A revocation committed between the folders read and the switch's recheck yields folders data that was authorized at its read time and a 403 from the switch. The serial flow has exactly the same window: a revocation right after its folders read. D1 handles it by committing nothing unless both requests are OK, then re-bootstrapping (client brief, D1 coordination rules). **A parallel folders read therefore cannot return data that the same request would not have authorized on its own.**

### 7.4 Caveats (not blockers; tagged for the owners)

1. **Lost-update on the stored selection (exists today; more visible under D1).** `ensureActiveAccountId` writes back the selection it *read at the start of the request* (`lib/auth.ts:120-121`), unconditionally. If an `/auth/me` (session-refresh poll `MailClient.tsx:4252`, `mailboxes-changed` bootstrap) or `/api/calendar/import` starts before a switch's write and finishes after it, it rewrites the old mailbox. Authorization is unaffected: every route is path-scoped, and the old mailbox is still a membership. But the server's default (reload, deep link, ICS import target) then disagrees with the UI.
   - Today the switch's own `/auth/me` re-read would at least make the UI follow the reverted value. With D1 the UI keeps B while the server holds A until the next bootstrap.
   - Fix (lib/auth.ts, **auth-owner file, minimal**): make the write conditional. Either `UPDATE auth_session SET activeAccountId=? , updatedAt=? WHERE token=? AND activeAccountId IS ?` (compare-and-set against the value this request read; on 0 rows re-read instead of overwriting), or adopt the batching task's variant (c) skip: the stale write disappears whenever the read value is already the selection and `updatedAt` is younger than 5 min.
   - Test: `an /auth/me that read A does not overwrite a concurrent switch to B` (inject the switch write after `getSession` via the batching spike's `afterFirst` seam).
2. **`/api/calendar/import` follows the stored selection.** Under D1 (and today) an ICS drop sent with `accountId: B` before B's persist returns 403 `Forbidden`, not a mismatch code. Low impact. The client can send the import only after the switch commit, which D1 already guarantees for UI-originated calls.
3. **Dropping `/auth/me` from the switch removes the switch path's only refresh of role/DTO data** (`accounts[]`, `security`, TTL). This is a presentation concern; the server re-authorizes per request. The client brief already lists it as risk 1.

## 8. How much the planned batching branch covers (owners' explicit request)

Base: clean run, warm, critical path p50 66.5 / p99 141.8 ms (quiet); under all loads p50 114–128 ms / p99 584–1,998 ms, with 86–103 `SQLITE_BUSY` retries on the two session writes per 60 s and one failed request (an exhausted write that reaches the route as a 500) per run.

| Change (from `perf-account-batching-task.md`) | On the switch path? | Quiet p50 | Under load (p99) |
|---|---|---:|---|
| Batched `/auth/me` presentation (86 → ≈25 statements, Phase 1) | yes, `/auth/me` step | **≈ −3 to −3.5 ms**: 3.3 ms of access-metadata SQL plus decrypt/mapping JS, the spike's estimate re-measured on this fixture | small; reads don't take locks |
| Batched full summary + scoped events | **no** (user-wide, once per session; SSE events are triggered by syncs, not by the switch) | 0 | 0 on the switch path (helps SSE fan-out during syncs) |
| Session-UPDATE skip, variant (c), in `/auth/me` | yes. After switch-account wrote the new id, `/auth/me` sees "unchanged and younger than 5 min" and skips | **−2.8 ms measured** (9.6 → 6.8 ms, prototype) | `/auth/me` retries 17 / 53 / 37–49 → **0** in phases a / b / all; `/auth/me` p99 1,019 → 18 ms (sync), 456–907 → 63 ms (all) |
| switch-account's own UPDATE | stays (the selection changes) | — | its retries remain: 37–82 retries per 60 s under a / b / all, p99 167–457 ms, and one 5-attempt exhaustion → 500 in phase `all*` |
| **Total batching + skip** | | **≈ −6 to −6.5 ms of 66.5 (≈ 10 %)**; quiet p99 within noise (≈ −3 to −5 ms of 141.8) | the `/auth/me` tail disappears (step p99 −1.0 s under sync, −0.4 to −0.85 s under all loads). Critical-path p99 under sync load was 1,113 ms (base) vs 462 ms with the whole prototype. The remainder is mostly switch-account's own write, so batching + skip alone covers roughly **half to two thirds of the p99 under writer load**. S4c is needed for the rest |

- **What remains after batching:** threads 49 ms of the 66 ms p50 (topic suggestions, list SQL, grouping), switch-account 4.6 ms (its write), folders 2.5 ms, and on the client side 3 round trips.
- **If D1 lands** (client drops `/auth/me` from the switch), the batching branch's contribution to the switch path is **0**. The whole 9.6 ms step and its round trip disappear instead. The branch remains valuable for boot, the session poll (`MailClient.tsx:4252`) and SSE fan-out.

## 9. Ranked server-side designs (saving per risk)

Overlap tags:
- **FREE**: the owners listed it as free (switch-account, /auth/me, folders, threads, summary, prefs, the stream routes, the lib/db query layer).
- **AUTH-OWNED**: `lib/auth.ts`, `lib/db/accountAccess.ts`, `lib/authStreams.ts`; flagged, kept minimal.
- **BATCHING**: overlaps the planned rank-2 branch.
- **FTS**: `lib/db/messages/query.ts` is also the FTS search-driven work's file (`perf-fts-search-driven.md`).

Invariants for every design:
- **(a)** folderAccountGuard: no folder id carried across accounts; the server answers `400 folder_account_mismatch`.
- **(c)** Authorization per request on the path id, revocation immediate, no cross-request auth/role/session cache, no cross-account data.

| # | Design | Saving on the switch path (measured = M, estimate = E) | Risk | Files / tag |
|---|---|---|---|---|
| **S1** | Topic suggestions: early exit when the mailbox has no topics; per-batch memo of own addresses and ignore decisions | **M −20 ms** per first page without topics (2k: 49.1 → 23.1 incl. S2/S3); **M −12 to −14 ms** with topics (suggestion enrichment 35.8 → 24.0 ms at 2k, 43.4 → 29.1 ms at 11k); S1b would take most of the remaining 24–29 ms | low | `lib/topics/suggestions.ts`. Not in any owner list; neither auth nor FTS |
| **S2** | Date grouping: compute `displayDayNumber(now)` once per request, memo per value | **M −3.9 ms** per first page (4.45 → 0.5) | very low | `lib/messageGrouping.ts` (or `lib/i18n/format.ts`), query layer — FREE |
| **S3** | `listThreads` first page: thread-index seek for the two 300-thread IN-list statements, explicit tie-break | **M −11 ms at 11k** (rows 10.9 → 4.3, baseCount 5.3 → 0.8); +0.7 ms at 2k for the rows statement | low | `lib/db/messages/query.ts` — FREE, **FTS** overlap |
| **S4** | Session-write discipline: variant (c) skip in `/auth/me` + compare-and-set for the selection write | **M −2.8 ms** quiet; under load `/auth/me` retries 17 / 53 / 37–49 → **0** in phases a / b / all; `/auth/me` p99 1,019 → 18 ms (sync), 456–907 → 63 ms (all); fixes the lost update (§7.4) | low–med (auth review) | `lib/auth.ts` — **AUTH-OWNED**, **BATCHING** (decision 2 already approved) |
| **S4c** | Fast handshake retries for the session UPDATE: `withDbWriteRetry("setActiveAccountId", …, { handshakeRetry: isBusy })`, 1–8 ms steps within the existing 2.16 s budget (`lib/dbWriteRetry.ts:15-16,79-96`), as the lease acquisition already does (`lib/db/processLeases.ts:37`) | **E** removes most of the 96–144 ms waits on the remaining switch-account write: p99 under load 167–457 ms → about 20–40 ms. Removes the exhaustion 500s (§4). The master lock holds it waits for are 1–6 ms (batching spike: guarded hold p99 6.2 ms) | low (pacing only; same statement, same semantics) | `lib/betterAuth.ts:223-227`. Auth code but not in the three listed files; **flag** to the auth owners |
| **S5** | `switch-account` returns the `/auth/me` payload, built by the same function after its write | **E −1 round trip −9.6 ms** if the client keeps an accounts refresh on switch; 0 if D1 drops `/auth/me` anyway | low | `app/api/auth/switch-account/route.ts` (FREE), reuse of the `/auth/me` builder (`app/api/auth/me/route.ts`, FREE); no `lib/auth.ts` change if the builder moves into the route helper |
| **S6** | Single thread-set pass in `listThreads`: materialize the folder's thread ids once and reuse it for selector, thread COUNT and group counts | **E −12 to −18 ms at 11k** (selector 14.2 + count 8.8 + groups 10.6 each rescan the folder), −3 to −5 ms at 2k | medium | `lib/db/messages/query.ts` — FREE, **FTS** overlap (coordinate) |
| **S7** | Cold shard: skip format probes that are already proven for this file (keyed by `PRAGMA user_version` + schema cookie), or keep recently used shards open longer (bounded) | **E −3 to −5 ms**, once per mailbox per 5 min idle | low–med | `lib/db/connection.ts`, `lib/db/shardFormat.ts` — Phase-2 area |
| **S8** | Warm `getAccountDb`: replace the `getAccountById` signature check in `ensureCalendarEventRuntimeData` with a light own-address read | **E −1 to −1.5 ms** per threads request (7 calls), app-wide | low | `lib/db/schema.ts:659` — batching Phase 2 (owners: separate follow-up) |
| **S9** | Bundle folders into the `switch-account` response | **E 0 ms server**; −1 request. D1's parallel folder read already removes the round trip | low | switch-account (FREE). Must call `requireAccountContext(request, id, {minRole:"viewer"})` exactly as the folders route does |
| **S10** | Smaller first page (e.g. 100 threads, then the rest) | **M −24 ms at 2k, −31 ms at 11k** (route 50.7 → 26.1, 95.9 → 65.1) | product decision | client parameter only (`messageListQueryUrl.ts`); the server already accepts it. Listed for sibling B; changes paging granularity |

**Invariant tests per design** (names to use; (a) = folderAccountGuard, (c) = per-request authorization / no cache):

| Design | (a) test | (c) test |
|---|---|---|
| S1 / S1b | `threads list of B never carries topic suggestions computed from A's signals` (two mailboxes sharing a sender, assert per-account `accountId` on every suggestion) | `suggestion memo is request-local: a topic created between two list requests appears in the second` |
| S2 | n/a (no folder input); keep `lib/folderAccountGuard.test.ts` green | `group keys are identical to the uncached path across midnight and DST (frozen clock)` |
| S3 | `listThreads with a folder of another account still answers 400 folder_account_mismatch` (route test, unchanged `validateAccountFolders` before the query) | `first page rows/order/counts identical to the legacy statements on the 11k fixture` + EXPLAIN assertion |
| S4 / S4c | n/a | the batching task's decision-2 tests (`revocation between two requests inside 5 min → 401`, `Last active ≤ 5 min`), plus `an /auth/me that read A does not overwrite a concurrent switch to B` and `setActiveAccountId under a held master write lock succeeds once the lock is released, within the handshake budget` |
| S5 / S9 | `switch-account bundle never returns folders of the previous mailbox`; `bundle folder ids all belong to the target account` | `bundle returns 403 and no folders when membership is revoked between persist and read` (seam: after the session UPDATE) |
| S6 | as S3 | `S6 output identical to legacy for folder, search, filter and flagged-first cases` |
| S7 / S8 | n/a | `a shard reopened after idle close re-validates format once; an account deleted while closed yields 404, never another account's shard` |

Rejected or deferred:
- **Folder-index variant of the selector/thread COUNT:** measured slower (14.2 → 15.6 ms, 8.6 → 9.7 ms at 11k). Rejected.
- **Count/group cache keyed by `PRAGMA data_version` + `total_changes()`:** sound invalidation and not an authorization cache, but a new cross-request cache on a hot path. Defer until S1–S3/S6 are in and re-measured.
- **ETag/`Cache-Control` for folders:** the route costs 2.5 ms server-side and the payload is 0.65–5.7 kB. A 304 saves bytes, not server time (the guard + role + query still run for correctness). Low value.
- **A shard LRU instead of the idle timer:** the cold cost is 7 ms once per 5 minutes per mailbox. Not worth a new lifecycle mechanism. S7 is the cheaper half.

### S1. Topic suggestions (biggest single item)

**Facts**
- `enrichMessagesWithThreadTopics(... includeSuggestions: true)` (`threads/route.ts:89-93`) calls `getTopicSuggestionsForThreads` for all first-page threads without topics (`enrichMessagesWithThreadTopics.ts:38-47`, call at `:44`).
- For every `thread_signals` row, `topicSuggestionEntriesFromThreadSignalRows` (`suggestions.ts:155-169`) calls `shouldIgnoreTopicSuggestionSignal` (`:111-139`). That call:
  - re-runs `ownAddressList(accountEmail)`;
  - inside `isOwnAddress` it rebuilds a normalized Set of own addresses (`ownAddresses.ts:60-63`);
  - parses the value through the nodemailer address parser plus `normalizeIdentityEmail` (`new URL()`, regexes).
- That is about 1,500 rows × ≈13 µs = 20 ms. The CPU profile of the threads loop attributes 12.3 % of all samples to this callback (`results/cpu-profile-threads-loop.md`, `suggestions.ts:165`).
- If the mailbox has no topics, `getTopicSuggestionsForThreadSignalBatch` can never produce a suggestion: suggestions come only from `topic_learning_signals JOIN topics` (`:580-601`), and threads without a match get no map entry (`:666`). All of that work is discarded.

**Change**
1. In `getTopicSuggestionsForThreads`, return an empty map when `SELECT 1 FROM topics WHERE accountId=? LIMIT 1` finds nothing (1 indexed statement).
2. Compute `ownAddressList(accountEmail)` once per batch and memo each `(type, value)` ignore decision for the batch. The decision is a pure function of `(entry, ownAddresses)`. The memo is request-local: created inside the call and dropped with it. No cross-request cache.
- The prototype uses a `WeakMap` keyed by the request's options object; a plain local closure is cleaner for the real change.

**Invariants**
- Identical output (hashes: 72/72 without topics; with topics 6/6 normalized hashes identical, with 639 / 804 items carrying suggestions).
- No authorization involvement: the account was already authorized by `requireAccountContext`.

**Tests**
- `getTopicSuggestionsForThreads` returns the same map as the uncached path for: own address as sender, a free-mail domain, a recipient that is an own address, an alias identity, a mailbox without topics, and a topic deleted between calls.
- A statement-budget assertion: no `thread_signals` read when the mailbox has no topics.

**Remaining with topics.** With topics, 24–29 ms remain. The CPU profile (`results/cpu-profile-topics-proto.md`) puts them in the per-thread scoring loop (`suggestions.ts:645-661`):
- for every first-page thread and every signal key, it walks every learning row that matches the key;
- a shared sender domain or recipient matches every tagged thread, so the work is O(page threads × learning threads), plus `rowToTopic` per row.

Follow-up **S1b**:
- aggregate `rowsBySignalKey` once per batch into `key → topicId → (learningThreadId → weight)` and merge per thread;
- or push the scoring into the existing SQL (`GROUP BY topicId, learningThreadId`).

Estimate −15 to −20 ms per first page in topic-heavy mailboxes. Same file, same differential tests.

### S2. Date grouping

`buildTimeGroupKey` computes `displayDayNumber(nowMs)` for **every** message (`messageGrouping.ts:42-44`), and `buildMessageGroupKey` computes the target day once more (`:71`). Each call is an `Intl.DateTimeFormat.formatToParts`.

Change: compute `todayStart` once per `listThreads` call and pass it down; memo `displayDayNumber` per distinct value within the call. Thread date values repeat 3× per thread.
- The prototype used a process-wide memo keyed by UTC minute. That is exact for every zone offset since 1893 but not for LMT dates, so the real change should use the request-local exact-value memo.
- Note: group *counts* use SQLite local time (`getThreadGroupCounts`, `query.ts:1379-1402`, `new Date(now.getFullYear(), …)`), the item keys use the display zone. That mismatch exists today and is out of scope.

Test: the group keys of a list spanning midnight and a DST change are identical to the current output (frozen clock).

### S3. Thread-index seeks for the first page

**Facts** (EXPLAIN QUERY PLAN, `results/listsql.json`):
- The 900-row message read (`query.ts:2537-2585`) uses `idx_messages_account_date (accountId=?)`. It walks every message of the account in date order and filters `threadId IN (300 ids)`.
- `baseCount` (`:2496-2506`) scans the folder index and filters the same IN list.
- With `INDEXED BY idx_messages_account_thread_date`, both seek 300 thread prefixes instead.

Measured (`sqlvariants.ts`, identical rows, 11 runs):

| Statement | 11k | 2k |
|---|---|---|
| rows | 10.9 → **4.3** ms | 4.3 → 5.2 ms |
| baseCount | 5.3 → **0.8** ms | 0.9 → 0.7 ms |

The current ORDER BY `m.dateValue DESC` has implicit ties in index order (`idx_messages_account_date` is `(accountId, dateValue DESC)`, so ties come out rowid ascending). The rewrite makes that explicit (`, m.rowid ASC`), so the output order is identical, not just equal up to ties.

Options:
- Apply the `INDEXED BY` only for the baseCount (a win at every size).
- For the rows statement, apply it when `threadIds.length * 3` is much smaller than the account's message count, or simply always. Always: +0.9 ms at 2k, −6.7 ms at 11k; real shared mailboxes with history are the large ones.

No ANALYZE (house rule). `INDEXED BY` fails loudly if the index is ever renamed, which is safer than a silent plan change.

Tests:
- the current-vs-new differential on the 11k fixture: rows, order, counts;
- an EXPLAIN QUERY PLAN assertion (`SEARCH m USING INDEX idx_messages_account_thread_date (accountId=? AND threadId=?)`);
- the FTS search path is unaffected: the statements are only used for the non-search first page.

**FTS overlap:** same file. Land after or with the FTS search-driven branch, or rebase.

### S4. Session writes on the switch path (AUTH-OWNED, minimal)

1. Variant (c) in `ensureActiveAccountId` (already approved, BATCHING commit 3). After `switch-account`, `/auth/me` reads `activeAccountId === selected` and `updatedAt < 5 min` and skips the UPDATE.
   - The prototype replaced the `RETURNING` liveness signal with `SELECT updatedAt FROM auth_session WHERE token=? AND julianday(expiresAt) > julianday('now')`.
   - Measured −2.8 ms quiet; under load `/auth/me` retries 17 / 53 / 37–49 → **0** in phases a / b / all; `/auth/me` p99 1,019 → 18 ms (sync), 456–907 → 63 ms (all).
2. **Compare-and-set** for the remaining writes (`setActiveAccountId` callers in `ensureActiveAccountId`): write only `WHERE activeAccountId IS <value read by this request>`. On 0 rows, re-read and do not overwrite. This removes the lost update of §7.4. Same file, same review.
3. `switch-account` itself keeps its write. It could skip it when the stored selection already equals the target; the client never sends that today (`useAccountController.ts:209`), so the saving is 0.

Invariants:
- revocation between two requests is a 401/403 on the second (every request still reads the session row and the role);
- "Last active" is at most 5 minutes old;
- expiry, refresh and idle timeout are unchanged.

Tests: the batching task's decision-2 tests, plus `an /auth/me that read A does not overwrite a concurrent switch to B`.

### S5 / S9. Collapsing round trips on the server

The client needs from a switch: the persisted selection, B's folders, B's first page. Whether bundling wins anything depends on D1:
- **With D1** (parallel switch + folders, no `/auth/me`), the serial server time is `max(switch 4.6, folders 2.5) + threads 49`. Bundling folders into switch-account (S9) saves only one request. Returning the `/auth/me` payload (S5) is unnecessary.
- **Without D1**, S5 removes the `/auth/me` round trip and its 9.6 ms while keeping the accounts/security refresh. The payload must be built **after** the switch's post-write recheck, by the same function `/auth/me` uses: same guard, same `ensureActiveAccountId` semantics. So a revoked or role-changed membership is reflected exactly as the separate request would show it.
- **Bundling the first page** into switch-account is **not recommended**. The threads response is 34–707 kB and 7–91 ms. Bundling makes the folder list wait for it, and the client must send its view parameters (groupBy, sort, threadsMode, pageSize, date source) in the POST.
  - If it is ever done, the server must resolve the folder as B's INBOX itself (`findInboxFolder(getFolders(B))`), never take a folder id from the client (invariant a).
  - It must run `validateAccountFolders(B, [inbox])` and `requireAccountContext(request, B, {minRole:"viewer"})` exactly as the threads route (invariant c).
  - Tests: `switch-account bundle never lists a folder of the previous mailbox`, `bundle returns 403 when membership is revoked between persist and list`.

### S6. One thread-set pass (medium)

The selector (`query.ts:2454-2464`), the thread COUNT (`:2466-2475`) and the group counts (`:1379-1402`) each re-evaluate `SELECT DISTINCT m.threadId FROM messages m WHERE <folder filter>` or join the folder's messages to threads. At 11k (INBOX 7,700 messages, 2,567 threads) that is three folder scans, 33.6 ms together.

Options:
- one CTE marked `MATERIALIZED`, or a temp table filled once per request;
- or derive the thread COUNT from the selector (`COUNT(*) OVER ()` in the selector).

Constraints:
- row-for-row identical results and the same flagged-first ordering;
- no snapshot change: the statements are autocommit today, so wrapping them in one read transaction would make counts and rows mutually consistent. That is arguably better, but it is a behaviour change and needs owner consent.

Tests: the differential suite above, plus search and filter variants. **FTS** coordinate: the search-driven branch rewrites the same selector for queries.

## 10. Reproduction

All files are in `briefs/perf-mailbox-switch/server/`. Scripts take the checkout as cwd (or `SWITCH_ROOT`), so the same files measure 647359b and any branch.

| File | Purpose |
|---|---|
| `sqlcounter.ts` | The batching spike's driver-level bun:sqlite counter, extended with per-statement wall time (`ms`). |
| `fixture.ts` | 12-shard fixture (§3) with real MFA sessions via `testAuthHarness`. Env: `SWITCH_FIXTURE_ONLY=<ids>` builds a subset; `SWITCH_TOPICS=1` adds 6 topics on 400 older threads per mailbox with ≥ 2,000 messages. |
| `switch.ts` | Per-route profile: process-first, warm (15 × 12) and cold-shard (6 × 12) switches; `getAccountDb` cold/warm cost; summary reference; response hashes for base/variant equivalence. |
| `anatomy.ts` | Phase anatomy of the threads route (pageSize 50/100/300, listThreads, enrichments, grouping, guard), plus normalized response hashes. |
| `listsql.ts`, `sqlvariants.ts` | listThreads statement timings and EXPLAIN QUERY PLAN; equivalence-checked rewrites (identical rows asserted). |
| `switch-load.ts` | Contention phases quiet / a / b / c / all / quiet-2 (§4). IMAP fixture on 3910/3911. IMAP consistency probe. Thrown-error capture. |
| `summarize.py` | Tables: `switch <json…>`, `load <json…>`, `stmts <json> <mode/step>`. |
| `run-pair.sh`, `run-rest.sh`, `run-rest2.sh` | Gated runners (1-min load < 10, 30 s polls, max 10 min, then run anyway). |
| `proto.patch` | The scratch prototype (S1 + S2 + S3 + S4 variant c) against 647359b. Not a proposed commit: it shows what was measured. |
| `results/` | Raw JSON + logs of every run in this brief; `cpu-profile-threads-loop.md` (Bun `--cpu-prof-md`). |

```sh
W=/home/monkey/code/noctua-mail/wt-spike-switch-server      # or the implementation worktree
H=/home/monkey/code/noctua-mail/briefs/perf-mailbox-switch/server
D=<own data dir>; mkdir -p $D/tmp                             # testDbHarness creates its temp dir under TMPDIR

# Per-route profile (~90 s incl. 65 s seeding)
cd $W && TMPDIR=$D/tmp nice -n 10 bun --tsconfig-override tsconfig.json $H/switch.ts /tmp/switch.json
python3 $H/summarize.py switch /tmp/switch.json
python3 $H/summarize.py stmts /tmp/switch.json warm/threads 15

# Paired base vs variant (variant = a git-archive copy with node_modules symlinked), with load gate
mkdir -p $W/.tmp/proto && git -C $W archive HEAD | tar -x -C $W/.tmp/proto && ln -s $W/node_modules $W/.tmp/proto/node_modules
(cd $W/.tmp && patch -p1 -d proto < $H/proto.patch)   # or apply your branch's changes; .tmp/ is git-ignored
$H/run-pair.sh /tmp/pair base proto base proto
python3 $H/summarize.py switch /tmp/pair/3-base.json /tmp/pair/4-proto.json    # prints the hash-equivalence line

# Threads anatomy, without and with topics
cd $W && SWITCH_FIXTURE_ONLY=syn-m0,syn-l0 TMPDIR=$D/tmp nice -n 10 bun --tsconfig-override tsconfig.json $H/anatomy.ts /tmp/anatomy.json
cd $W && SWITCH_TOPICS=1 SWITCH_FIXTURE_ONLY=syn-m0,syn-l0 TMPDIR=$D/tmp nice -n 10 bun --tsconfig-override tsconfig.json $H/anatomy.ts /tmp/anatomy-topics.json

# listThreads statements + plans, and the equivalence-checked rewrites
cd $W && SWITCH_FIXTURE_ONLY=syn-l0 TMPDIR=$D/tmp nice -n 10 bun --tsconfig-override tsconfig.json $H/listsql.ts /tmp/listsql.json
cd $W && SWITCH_FIXTURE_ONLY=syn-l0,syn-m0 TMPDIR=$D/tmp nice -n 10 bun --tsconfig-override tsconfig.json $H/sqlvariants.ts /tmp/sqlvariants.json

# Contention, 6 x 60 s (~8 min); ports 3910/3911 must be free (ss -ltn)
cd $W && TMPDIR=$D/tmp nice -n 10 bun --tsconfig-override tsconfig.json $H/switch-load.ts /tmp/load.json
python3 $H/summarize.py load /tmp/load.json

# CPU profile of the threads loop
cd $W && SWITCH_FIXTURE_ONLY=syn-m0,syn-l0 TMPDIR=$D/tmp nice -n 10 bun --cpu-prof --cpu-prof-md --cpu-prof-dir=/tmp/prof --tsconfig-override tsconfig.json $H/anatomy.ts /tmp/a.json
```

Caveats:
- Host load during this spike ranged from 4 to 27, because other agents share the box.
- The clean pair (§1) ran at load 7–9. The replicate pair and the contention runs ran higher; their load is recorded per phase.
- Compare structure and orders of magnitude across runs, and decimals only within a pair.
- In-process timing excludes Next.js routing, network and TLS. Sibling A measures the browser end to end.
