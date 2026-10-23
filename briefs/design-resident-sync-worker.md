# Design spike — resident sync worker

Read-only design study on `wt-spike-sync-worker` @ `11dc3c5`
(`origin/integration/stage`, round 8), 2026-10-23. No source changes;
`git status --short` in the worktree is empty. Scratch probes under
`/tmp/spike-sync-worker/` only. This document is for the Umbau thread's
go/no-go review. Implementation is not before integration round 10.

## Summary / recommendation

**Go, with conditions.** Replace process-per-job with a small pool of
long-lived Bun children — one resident per durable admission slot
(`NOCTUA_MAX_SYNC_WORKERS`, default 2), each running at most one job at a
time, driven over an NDJSON stdin/stdout protocol. The existing durable
lease semaphore, the per-account queue in `lib/syncJobs.ts`, the watcher,
writer guards and the shutdown coordinator all stay; only the transport
below `launchSyncWorker` and the worker's job loop change.

Why: every folder job today pays a cold import of the sync graph
(~328 ms median, re-measured 326 ms in this spike) plus a fresh IMAP
login, because the worker drains its connection pool on exit. A resident
worker pays both once. Estimated saving per subsequent job is
~390–640 ms (328 ms import + ~7 ms spawn + 50–300 ms IMAP login when the
next job reuses the pooled connection). For a 12-folder sweep that is an
estimated ~4.3–7.0 s; for a watcher-triggered 1-message job it should
roughly halve the measured 525 ms end-to-end time. All post-import
figures are estimates until the measurement plan in section 6 runs.

Conditions (each detailed below):

1. Ship behind `NOCTUA_SYNC_WORKER_MODE`, default `per-job`; enable
   `resident` in preview first, flip the default only after the section 6
   gates pass (section 4).
2. Per-job cancellation must be reworked from today's process-global
   worker stop signal to a per-job `AbortSignal` before any resident code
   lands (sections 2, 3, 7 slice 1).
3. The lease keeps its current rule — capacity is released only after a
   terminal job frame, or after confirmed process exit when the worker
   dies — and an idle resident holds no lease (sections 2, 3).
4. Credentials are re-read from the master DB per job inside the worker,
   never sent over stdin, and a pooled IMAP connection is evicted when
   the account's credential fingerprint changes (section 2).
5. Graceful-shutdown numbers must not regress: lazy spawn (no resident
   exists before the first job), drain inside the existing 4 s
   coordinator / 3.5 s worker budgets, `checkGracefulShutdown.ts` and
   the standalone acceptance probes green in both modes (sections 3, 5).

The three biggest risks are lease/liveness correctness across a reused
PID, a wedged resident blocking its slot longer than a one-shot worker
would, and long-lived state (shard handles, IMAP sessions, decrypted
account objects) outliving the job that created it. Section 8 lists all
risks and open questions.

## 1. Current architecture, precisely

### 1.1 Process lifecycle per job

- Entry points: `POST /api/accounts/[accountId]/sync`
  (`handleSyncStartRequest`), the new-mail check
  (`app/api/_helpers/newMailCheck.ts`, one `startSyncJob` per folder with
  new mail), and the mailbox watcher (`lib/mailboxWatcher.ts`,
  `requestCheck` → INBOX `repair`/`full` job, then `runNewMailCheck`).
  All funnel into `startSyncJob()` in `lib/syncJobs.ts:662`.
- `startSyncJob` keeps one in-memory head job per account plus a queue
  (`accountStates`), joins identical in-flight intents
  (`isSameSyncIntent`), caps the queue at 64 entries with a lossy
  coalescing fallback, and orders by priority: interactive `new`/`recent`
  (0) before watcher (1) before background/`repair`/`full` (2), with
  aging after 8 admission bypasses. Job records are ephemeral, TTL 30 min.
- Admission is durable: `DurableSyncWorkerSemaphore` (capacity
  `NOCTUA_MAX_SYNC_WORKERS`, default 2) queues in the master DB tables
  `sync_worker_queue` / `sync_worker_owners`, reserves a slot in
  `sync_worker_leases`, and only then calls back into
  `launchSyncWorker` (`lib/syncJobs.ts:453`).
- Spawn: `bun.spawn(["bun", "run", "scripts/runSyncJob.ts", childPayload])`
  with `cwd`, piped stdout/stderr, and env carrying
  `NOCTUA_SYNC_LEASE_JOB_ID` / `NOCTUA_SYNC_LEASE_OWNER` (watcher jobs
  also get `IMAP_CONNECT_RETRY_COUNT=0` and
  `NOCTUA_SYNC_WORKER_SOURCE=watcher`). The spawn itself runs inside
  `spawnLeasedWorker`, which records the child PID in the lease row
  under the same immediate write transaction — a retry can never spawn
  twice. The payload is one argv element, so it is bounded by Linux
  `MAX_ARG_STRLEN` (~128 KB); `backfillUids` arrays are the practical
  pressure point.
- The child (`scripts/runSyncJob.ts` → `runWorker` →
  `runSyncJobCli` in `lib/workers/runSyncJob.ts`) first calls
  `bindWorkerProcess(jobId, owner)`: it must find its exact lease row
  with a matching (or still-null) PID, or it exits 1 before doing work.
  It then parses the argv JSON and runs `runSyncOperation`.
- Retries live inside the child: up to 11 attempts, 10 s base delay
  capped at 60 s (jittered), resuming a `full` sync from
  `highestProcessedUid`. Auth errors, "Account not found",
  "No password configured" and payload-validation errors are
  non-retryable. Watcher-sourced jobs never retry inside the worker —
  the watcher owns their schedule.
- IPC is a stdout line protocol (`lib/workers/syncProtocol.ts`):
  `__noctua_sync_progress__:<json>` and `__noctua_sync_result__:<json>`.
  The parent streams both pipes (`readPipedOutput`), logs every progress
  line, forwards stderr lines as `[sync-worker] …`, and treats exit
  code 0 + result line as done, anything else as failed with the stderr
  tail as the error.
- Exit: the child calls `drainImapConnectionPool()` before returning
  (`runSyncJob.ts:85`) because an idle pooled socket would otherwise
  keep Bun alive up to the pool's 60 s idle eviction. `runWorker`'s
  `finally` additionally drains the pool and closes all DB connections.

### 1.2 What is imported, what state is lost on exit

- The child cold-imports the whole sync graph: `lib/syncOperation.ts`
  pulls `@/lib/db` (schema, shards, FTS, categories, threads),
  `@/lib/mail/imap` (imapflow, mailparser), the sanitizer stack
  (sanitize-html/parse5 via `lib/html`), calendar invite processing,
  threading and storage. The standalone trace for the three worker
  entrypoints is 184 local files, ~1.3 MB of TS source (measured this
  spike via `workerRuntimeTraceFiles`), transpiled by Bun on every
  spawn because workers execute TS source, not the Next bundle.
- Measured cost: cold `import(lib/syncOperation.ts)` was 248/238 ms wall
  in `briefs/perf-server-runtime.md` item 1 and ~328 ms median (5 fresh
  processes, 298–346 ms) in `briefs/perf-backlog-rerank-r8.md` rank 5.
  This spike re-ran the same harness: first import 326 ms, cached
  re-import 0.09 ms, RSS 92.5 MB right after import (before any DB or
  IMAP work). A 5-run series under host load ~33 gave 336–1885 ms and
  is discarded as load-contaminated; the single 326 ms run corroborates
  the r8 median. Bare `bun -e` spawn-to-exit is ~6–15 ms, so process
  creation itself is noise next to the import.
- State dropped on every exit:
  - the IMAP connection pool (`lib/mail/imap/connectionPool.ts`):
    single idle slot per identity key `[accountId, host, port, secure]`,
    60 s idle, 10 min max age — always drained, so the next job pays a
    full TLS + LOGIN handshake (50–300 ms per the pool's own header
    comment; unmeasured against a real provider on this box);
  - shard and master `bun:sqlite` handles with their page caches
    (`cache_size` 32 MiB per shard), the `db.query` statement cache and
    schema-init/probe memoization in `lib/db/connection.ts`;
  - the decrypted account list: `runSyncOperationBatched` calls
    `getAccounts()` (`syncOperation.ts:261`), which selects and
    `decodeSecret`-decrypts **every** account, then keeps one;
  - module-level caches (category model, own addresses, MIME/parser
    internals) and the JS JIT state.

### 1.3 Leases, cancellation, timeouts, wedge detection today

- Lease shape (`lib/db/processLeases.ts`, master DB): `sync_worker_leases`
  rows keyed by slot 1..capacity with `jobId`, `accountId`,
  `ownerInstance` (`<parentPid>:<uuid>`), `ownerPid`, child `pid`,
  `expiresAt` (15 s lease, parent heartbeats every 5 s via
  `heartbeatWorkers`). `reserveWorker` runs under
  `withDbWriteRetry` + immediate transaction, enforces one running job
  per account (`accountId NOT IN (SELECT accountId FROM
  sync_worker_leases)`), priority with the 8-bypass aging bound, and
  reclaims rows only when the recorded child PID — or, for unspawned
  reservations, the owner — is proven dead via ESRCH. EPERM and every
  other probe error fail closed (`processExited`).
- Release rule: the parent monitor calls the semaphore's `release()`
  only after `child.exited` resolves. `UnconfirmedWorkerExitError`
  keeps the slot (and the account's head job) occupied indefinitely
  until a later reclaim proves the PID dead. `getSyncJob` additionally
  probe-fails a "running" job whose PID is gone, but promotion still
  waits for the monitor.
- Timeout: `NOCTUA_SYNC_WORKER_TIMEOUT_MS` (default 600 s) via
  `withSyncWorkerTimeout` — on expiry it SIGKILLs the owned child and
  **still awaits `child.exited`** before rejecting. Output draining
  after exit has its own 2 s bound (`drainSyncWorkerOutput`). There is
  no heartbeat or progress-staleness watchdog today: a wedged IMAP
  socket is bounded only by the 600 s kill and imapflow's own timeouts.
- Cancellation: `cancelWatcherSyncJobs(accountId)` removes queued
  watcher entries and calls `workerKills` (SIGKILL) on the running
  child, or `workerStops` (SIGTERM) while shutting down. There is no
  interactive cancel API. Inside the child, SIGTERM/SIGINT run
  `runWorker`'s stop: a process-global flag + `AbortController` fed
  into `withImapCancellation` (AsyncLocalStorage), `workerSafePoint()`
  throws between batches/retries, `workerPause` rejects pending retry
  delays, and a 3.5 s fallback timer exits 0. Synchronous immediate
  transactions always finish first — signals cannot preempt JS/SQLite.
- In-worker DB contention: shards use WAL + `busy_timeout` 15 s
  (`configureDb`); the master handle uses `busy_timeout` 0 plus
  `withDbWriteRetry` (5 attempts, 120/240/480/960 ms, cap 2 s) on the
  write paths, including all lease writes.

### 1.4 How the watcher triggers jobs

- `MailboxWatcher` (opt-in `NOCTUA_MAILBOX_WATCHER=1` +
  `teamFeaturesSupported()`) first acquires the durable
  `mailbox_watcher_lease` (single scheduler across module graphs and
  processes on the host; a live owner is never displaced by expiry
  alone), then reloads accounts from the master DB every 30 s.
- Per account it holds one read-only INBOX IDLE connection
  (`lib/mail/imap/idle.ts`, `maxIdleTime` 10 min, tagged NO closes and
  backs off). `exists`/`expunge`/`flags` events and a 5 min fallback
  timer call `requestCheck`, which coalesces bursts through a per-entry
  `dirty` flag (one trailing pass; checks never overlap per account).
- A check reconciles UIDVALIDITY, starts one watcher-sourced
  `startSyncJob` (`full` if no baseline, else `repair`) for INBOX and
  polls `getSyncJob` every 100 ms, then runs the all-folder new-mail
  planner, which starts one `new` job per folder with mail. A burst on
  a 12-folder mailbox therefore enqueues up to a dozen process-per-job
  spawns today.
- Auth failure suspends the account until the stored IMAP identity
  (HMAC fingerprint in `mailbox_watcher_auth`) changes or an operator
  retries; failed watcher jobs cancel that account's remaining queued
  watcher jobs so bad credentials are not retried per folder.

### 1.5 Graceful shutdown and confirmed worker exit

- One process-global coordinator (`lib/server/shutdown.ts`, 4 s
  deadline, phases stop → drain → close) is shared by
  `instrumentation.register()` and, in standalone builds, the owned
  launcher (`lib/server/standalone.ts`, packaged by
  `build-scripts/prepareStandaloneShutdown.ts` as
  `noctua-server.mjs`). Under `next start`/`next dev` it participates
  without owning exit (Next keeps 143/130).
- Relevance to workers: `background:stop` SIGTERMs every tracked child
  (`trackWorker`), the durable semaphore's stop hook cancels waiters,
  `background:drain` and the semaphore drain hook await monitors and
  lease cleanup, and only the close phase drains the IMAP pool and
  closes SQLite. Unconfirmed exits retain leases for PID-based restart
  recovery. systemd contract: `KillSignal=SIGTERM`, `KillMode=mixed`,
  `TimeoutStopSec=10s`.
- Accepted numbers to preserve (`doc/DEPLOYMENT.md`, round 2): standalone
  exit 0 in 121 ms idle, 44 ms watcher+SSE, 282 ms during initial sync;
  `scripts/checkGracefulShutdown.ts` fails at ≥5 s, nonzero exit, or if
  its own SIGKILL fallback fires. Restart after an interrupted initial
  sync recovered all 3,060 messages, preserving the 300 committed IDs.

### 1.6 How standalone/Docker builds locate worker code

- `lib/workers/entrypoints.ts` is the single registry:
  `scripts/runSyncJob.ts`, `scripts/recomputeThreads.ts`,
  `scripts/recomputeCategories.ts`. `build-scripts/workerRuntimeTraceFiles.ts`
  walks the local import graph from those entrypoints (plus
  `tsconfig.json`) and `next.config.ts` feeds the result to
  `outputFileTracingIncludes` for `/api/accounts/*/sync` and the two
  recompute routes, alongside explicit `node_modules` trees (imapflow,
  sanitize-html + deps, parse5, htmlparser2). `serverExternalPackages`
  keeps imapflow/mailparser/nodemailer/html-to-text/sanitize-html/rrule
  external so the TS worker can resolve them at runtime.
- Verification: `bun run test:standalone-workers`
  (`verifyStandaloneWorkerBuild.ts`) requires every traced file to exist
  under `.next/standalone` and the `scripts/` directory to contain
  **exactly** the registered entrypoint files. `bun run
  test:docker-workers` (`verifyDockerWorkerImage.ts`) builds the image
  and runs each entrypoint with a missing/invalid payload, asserting
  the expected validation message (sync: `"{}"` → "Missing accountId in
  sync payload.") and no module-resolution failure.
- The two recompute workers use the same spawn-per-job shape
  (`lib/workerJobRegistry.ts`); the sender-identity recompute
  additionally shares the durable sync semaphore budget
  (`sharedWorkerBudget`, priority 5, own `DurableSyncWorkerSemaphore`
  instance against the same master tables). They are out of scope for
  this design except where they compete for the same slots.

## 2. Target design

### 2.1 Topology: one resident per admission slot

**Decision: a pool of `NOCTUA_MAX_SYNC_WORKERS` residents per server
process (default 2), spawned lazily, each executing at most one job at
a time. The queue stays in the parent; a resident never queues.**

Rejected alternatives:

- *One resident for the whole server* halves today's parallelism: a
  multi-minute `full` sync of an 11k mailbox would head-of-line-block
  every interactive and watcher job on the box. Today's contract is 2
  concurrent accounts, 1 job per account; a single resident silently
  changes it.
- *One resident per account* (up to ~12) multiplies the ~93 MB
  post-import RSS and the idle IMAP footprint by the account count,
  against the documented provider-connection assumption
  (`doc/DEPLOYMENT.md`, Netcup sizing). Most residents would idle.
- *In-process sync on the Next event loop* was already rejected in
  `perf-server-runtime.md`: `simpleParser`/sanitize CPU would stall API
  requests, and a `bun:sqlite` handle must not be shared across the
  boundary. The process boundary is the crash-containment story; keep it.

Slot affinity: a resident is bound to a semaphore *instance*, not to a
fixed lease slot number. The parent still runs the full durable
flow per job — `queueWorker` → `reserveWorker` (assigns slot 1..N) →
dispatch — and hands the job to any free resident of that semaphore.
This preserves cross-process/module-graph admission exactly, including
the sender-identity recompute competing for the same slots with its own
one-shot children.

Lease adaptation (no schema change): the lease row's `pid` becomes the
resident's PID for the duration of the job. `spawnLeasedWorker` is
generalized to a `bindLeasedWorker(jobId, owner, pid)` that records the
already-running resident's PID under the same immediate transaction
instead of spawning. The worker-side `bindWorkerProcess` check becomes
per-job: on `run-job` the resident verifies a lease row exists for
`(jobId, ownerInstance)` with `pid = process.pid` and `expiresAt > now`
before touching IMAP or shards; otherwise it replies `error` with code
`lease-lost` and does no work. Release semantics split in two:

- terminal `result`/`error` frame received → the parent may release the
  lease immediately (the new "job exit confirmation");
- resident process exit, EOF, timeout or kill → release only after
  `child.exited` resolves, exactly as today.

An idle resident holds **no** lease. `reserveWorker` reclaim logic is
unchanged and stays correct: a lease whose `pid` is a live resident is
never reclaimed; a lease whose resident died is reclaimed on ESRCH.

### 2.2 Wire protocol (NDJSON over stdin/stdout)

Framing: one UTF-8 JSON object per line (`\n`-terminated) on stdin
(parent → worker) and stdout (worker → parent). This reuses today's
line discipline, drops the argv size cap and the payload's visibility
in `ps`, and keeps stderr as a log-only stream. Max line 1 MiB;
oversize or unparseable lines are protocol errors (worker exits 1;
parent treats as crash). Every frame carries `v: 1` and, except
`hello`/`heartbeat`, the `jobId` it belongs to. Frames for unknown or
finished job ids are logged and ignored by the parent; the worker
rejects a second `run-job` while busy with `error{code:"busy"}`.

Protocol feasibility was probed in this spike (`/tmp/spike-sync-worker/
probe.ts`): a Bun child speaking this framing delivered `hello` in
~30 ms (trivial script, no sync graph), 20/20 job results, heartbeats
during work, and exit 0 on `exit`. Round-trip overhead per job is
sub-millisecond next to the 328 ms being saved.

| Message | Direction | Key fields | Meaning |
|---|---|---|---|
| `hello` | worker → parent | `v`, `buildId`, `pid` | First frame after imports; version gate |
| `run-job` | parent → worker | `jobId`, `payload`, `lease`, `deadlineMs` | Start one job; payload = today's `SyncPayload` + `clientId`, `source` |
| `progress` | worker → parent | `jobId`, `progress` | Existing `SyncOperationProgress`, throttled |
| `result` | worker → parent | `jobId`, `result` | Terminal success, exactly once per job |
| `error` | worker → parent | `jobId`, `code`, `message` | Terminal failure; codes: `sync`, `auth`, `lease-lost`, `busy`, `cancelled`, `protocol` |
| `cancel` | parent → worker | `jobId` | Abort the running job; worker stays alive |
| `ping` / `pong` | both | `seq` | Liveness probe on heartbeat silence |
| `heartbeat` | worker → parent | `seq`, `rssBytes`, `jobsDone` | Every 2 s while alive; feeds watchdog + recycle |
| `drain` | parent → worker | `deadlineMs` | Finish/stop current job, then prepare to exit |
| `drained` | worker → parent | — | Pool drained, DBs closed; process exits 0 next |
| `exit` | parent → worker | — | Idle-time equivalent of `drain` (recycle, version skew) |

Rules:

- `hello` versioning: the parent spawns with env
  `NOCTUA_WORKER_PROTOCOL=1` and `NOCTUA_WORKER_BUILD_ID=<build-version>`
  and requires the worker's `hello` to match both within 10 s
  (import time included). Mismatch → SIGTERM, await exit, respawn once;
  second mismatch → disable resident mode for the process lifetime and
  fall back to per-job spawn (section 4).
- The existing prefixed line formats stay valid inside `progress` /
  `result` payloads during migration: `syncProtocol.ts` gains the v1
  envelope formatters/parsers next to the current ones, so per-job mode
  (rollback path) is untouched byte-for-byte.
- Backpressure: max in-flight = 1 job per resident, enforced by the
  parent never dispatching to a busy resident and by the worker's
  `busy` rejection. The parent reads stdout continuously (existing
  `readPipedOutput` pattern, made unbounded-lifetime); the worker
  coalesces `progress` to at most one frame per 100 ms (terminal frames
  and phase changes always pass). Parent stdin writes check the write
  result/flush; a failed write is treated as worker death.
- No secrets on the wire: `payload` is exactly today's argv payload
  (account/folder/mode/uids/clientId). Credentials never leave the
  worker's DB read (section 2.4).

### 2.3 Job execution inside the resident

- One shared core: extract today's `runSyncJobCli` body into
  `executeSyncJob(payload, ctx)` in `lib/workers/runSyncJob.ts`, where
  `ctx` carries `onProgress`, an `AbortSignal`, and the retry policy.
  The one-shot CLI (`scripts/runSyncJob.ts`, argv in, prefixed lines
  out, drain-and-exit) and the resident loop
  (`scripts/runSyncWorker.ts`, new) are thin transports over this core.
  Retry loop, `resumeFromUid`, non-retryable patterns and the watcher
  no-retry rule stay in the core, unchanged.
- Per-job cancellation (the load-bearing refactor): today
  `lib/server/workerLifecycle.ts` holds one process-global stop flag
  and signal. The resident needs *two* scopes — process stop
  (SIGTERM/drain) and job cancel — so `workerSafePoint`/`workerPause`
  move to an `AsyncLocalStorage` job context holding a combined signal
  (job abort OR process abort), mirroring the existing
  `imapCancellation` ALS. `runSyncOperation` already runs inside
  `withImapCancellation`; the job context wraps the same call.
  Process-global behavior for the one-shot CLI is preserved by entering
  a job context bound to the process signal.
- Only the target account: replace `getAccounts()` +
  `find(id)` in `runSyncOperationBatched` with `getAccountById()`.
  This removes the decrypt-every-account cost per job (called out in
  `perf-server-runtime.md` item 1) and bounds decrypted material in the
  long-lived process to one account at a time. This change benefits
  per-job mode too and should land as its own slice first.
- Shard handles: the master DB stays open for the resident's lifetime.
  Account shards go through the existing `getAccountDb` cache, which
  already idle-closes after `ACCOUNT_DB_IDLE_MS` (default 5 min). Added
  rule: keep at most 2 shard paths open LRU; when a job for a different
  shard path would exceed that, `closeAccountDbConnection(path)` the
  least recent first. Keying is by resolved dbPath, not accountId —
  several accounts can share one physical shard (`doc/STORAGE.md`).
  Consecutive same-account folder jobs (the common sweep) reuse the
  warm handle, page cache and statement cache.

### 2.4 IMAP pool reuse and credential staleness

- Between jobs the resident does **not** call
  `drainImapConnectionPool()`; it drains only on `drain`/`exit`/SIGTERM
  (the `runWorker` finally already does this). Existing pool rules are
  kept verbatim: one idle slot per identity key, 60 s idle eviction,
  10 min max connection age, evict on error/close, evict on any
  operation error (`withPooledImapClient`).
- Added bound: cap the pool map at 4 identity keys in the worker
  (LRU-evict on release beyond that) so a resident serving many
  accounts cannot accumulate idle sockets. Parent-process pool is
  unchanged.
- Credential staleness — the pool identity key
  `[accountId, host, port, secure]` deliberately excludes user and
  password, so reuse across a password change would silently keep an
  already-authenticated session. Decision: per job, the worker
  computes the same HMAC fingerprint the watcher uses
  (`watcherAccountIdentity`, over `account.id` + full `account.imap`
  including credentials) from the freshly read account, and passes it
  to pool acquire as an expected fingerprint stored with the pool
  entry at connect time. Mismatch → evict before reuse. On any auth
  error the entry is already evicted by the error path; the fingerprint
  is a hash, not secret material, and may live as long as the pool entry.
- Credential lifetime: the account (with decrypted passwords) is read
  fresh from the master DB at the start of every job attempt — retry
  attempts included, so a password fixed during backoff is picked up —
  and the reference is dropped when the job ends. Nothing
  credential-shaped is cached across jobs, logged, or put in a frame.
  A credential change mid-flight does not disturb the running job
  (same snapshot semantics as today); it takes effect on the next job
  and, via the fingerprint, on the next pool reuse.

## 3. Failure matrix

| Failure | Detection | Decision | Job / lease outcome |
|---|---|---|---|
| Worker crash mid-job | `exited` / stdout EOF, no terminal frame | Fail job, respawn lazily, crash-loop breaker | Lease freed after `exited`; committed batches stay |
| Hang / wedge | No frame 15 s → `ping`; 60 s silence | SIGTERM → 3.5 s → SIGKILL → respawn | Job failed; queue promotes after confirmed exit |
| Job timeout (600 s) | Existing per-job deadline | `cancel`, escalate to SIGKILL at +5 s | As today: failed, exit confirmed first |
| Cancel running job | `cancelWatcherSyncJobs` / shutdown | `cancel` frame, per-job abort; worker survives | `error{cancelled}`; lease freed on frame |
| Parent shutdown | Coordinator stop phase | `drain` (deadline 3.5 s) → SIGTERM → SIGKILL last | Exit 0 inside 4 s budget; leases drained or retained |
| Memory growth | `rssBytes` in heartbeat, `jobsDone` | Recycle at job boundary: 200 jobs / 512 MiB / 1 h | No job impact; next job spawns fresh resident |
| Two parents, one box | Durable leases in shared master DB | Residents are parent-local; slots stay global | Second parent queues; orphan resident self-exits on EOF |
| Version skew after deploy | `hello` mismatch; entrypoint mtime change | Respawn once, then per-job fallback | No job runs on a mismatched worker |
| DB busy / locked | `SQLITE_BUSY` via existing retry paths | Unchanged budgets; worker never heartbeats leases | Job retry semantics unchanged |
| Watcher event burst | Existing coalescing upstream | No change; max in-flight 1 per resident | Jobs join/coalesce in parent as today |
| Credentials changed mid-flight | Per-job re-read + pool fingerprint | Running job keeps snapshot; next job re-reads | Stale pooled session evicted before reuse |

Row notes, where the table is too terse:

- **Crash mid-job.** Partial-write safety is unchanged and does not
  depend on the worker: sync writes commit per batch in immediate
  transactions, WAL recovers on next open, and the writer guards are
  persistent triggers checked against a connection-local function that
  every new handle re-registers (`prepareAccountShardConnection`) — a
  crashed process cannot leave a guard-less writer behind
  (`briefs/perf-writer-guards.md`: keep guards as-is). The parent marks
  the job failed with the stderr tail (today's behavior for exit ≠ 0),
  cancels queued watcher jobs for that account if the failed job was
  watcher-sourced (existing rule), and does not auto-retry in the
  parent — retries already happened inside the job core. Respawn is
  lazy (next dispatch). Breaker: 3 crashes within 60 s disables
  resident mode for 5 min; during cooldown jobs use per-job spawn so a
  deterministic crash (e.g. a poisonous message) fails identically in
  both modes and cannot spin a respawn loop.
- **Hang / wedge.** Heartbeats only prove the event loop turns; a long
  synchronous batch blocks them legitimately. Batches are 100 messages
  with an event-loop yield between them, and full MIME parse measured
  ~5.5 ms/message (r8), so >60 s without *any* frame (progress counts)
  is far outside legitimate blocking. Escalation is therefore:
  15 s silence → `ping`; 60 s silence → SIGTERM (worker aborts at the
  next safe point); +3.5 s (the existing worker fallback) → SIGKILL;
  await `exited`; fail the job; respawn lazily. Queued jobs stay in the
  parent's per-account queue and the durable semaphore throughout —
  promotion happens only after confirmed exit, exactly as the current
  monitor guarantees. The 600 s job deadline stays as the outer bound
  for a worker that heartbeats but makes no progress (e.g. an IMAP
  server trickling forever): deadline → `cancel` → +5 s → SIGKILL.
- **Parent shutdown.** The resident registers with the same hooks as
  today's children: `trackWorker` (stop = SIGTERM) plus a transport
  drain hook. Order inside the stop phase: send `drain` first (the
  worker aborts IMAP waits, stops between batches, drains its pool,
  closes its DBs, replies `drained`, exits 0); the SIGTERM from
  `background:stop` is equivalent if the frame is lost — the worker
  treats SIGTERM as drain with the existing 3.5 s exit-0 fallback.
  Drain phase awaits `exited` via `background:drain` as today; SIGKILL
  is never sent by the parent during shutdown — if the 4 s coordinator
  deadline hits, the parent exits 0 and systemd's cgroup fallback
  (10 s) reaps the child, with leases retained for PID-based recovery.
  That is today's contract, unchanged. Lazy spawn means an idle server
  that never synced has no resident and pays nothing.
- **Two parents.** Same data dir: admission is already global through
  the master DB; each parent may keep idle residents, but a job only
  runs while its parent holds the lease, and the resident re-verifies
  that lease per job. Different data dirs (dev vs preview): separate
  master DBs and shards, no interaction, as today. A resident whose
  parent dies without drain sees stdin EOF and exits after finishing
  its current immediate transaction (drain semantics); a ppid-change
  poll every 5 s is the belt-and-braces for a wedged pipe. Only then
  does ESRCH reclaim free its lease — fail-closed as today.
- **Version skew.** Deploys restart the parent (systemd), so the
  realistic skew window is a dev server whose files change under a live
  resident. The parent records the entrypoint's mtime at spawn and
  stats it before each dispatch (one `stat` per job); a change triggers
  `exit` + respawn. The `hello` buildId check covers standalone, where
  files are immutable per build but a stale resident binary set must
  never run a job for a newer parent.
- **DB busy / locked.** No budget changes: shard `busy_timeout` 15 s,
  master write retry 5×(120–960 ms), in-core job retries 11×(10–60 s).
  The resident holds handles longer than a one-shot child, but the
  parent already holds the same handles process-wide; WAL reader/writer
  behavior is identical. Lease heartbeats remain the parent's job — the
  worker never writes lease rows except its initial per-job bind check
  (a read).

## 4. Rollback

- Flag: `NOCTUA_SYNC_WORKER_MODE=resident|per-job`, parsed once in
  `lib/syncJobs.ts` with the existing `positiveInteger`-style
  invalid-value-falls-back-to-default discipline (unknown value ⇒
  default). **Proposed default at merge: `per-job`.** Enable `resident`
  on the preview instance first; flip the default in a later round
  after section 6's gates pass, and keep the flag for at least one
  release after that.
- Runtime fallback (no restart needed, no code removal): `hello`
  mismatch twice, or the crash-loop breaker tripping, disables resident
  dispatch for the process/cooldown and logs one structured line.
  Setting the env var back and restarting restores per-job permanently.
- Both paths share code so tests cover both: `executeSyncJob` (job
  core), `syncProtocol.ts` (both wire formats), the lease/semaphore
  layer, and the parent monitor logic behind a small transport
  interface in `lib/syncJobs.ts` — `PerJobTransport` wraps today's
  spawn/monitor code verbatim; `ResidentTransport` manages the pool of
  residents. `startSyncJob`, queueing, priorities, joining,
  `getSyncJob`, the status API and the watcher are transport-agnostic
  and unchanged. The existing suites (`lib/syncJobs.test.ts`,
  `scripts/verifyProcessLeases.ts`, watcher integration) run against
  per-job by default; new resident suites run the same scenarios
  through the resident transport with the flag set (section 7).

## 5. Compatibility

- **Standalone tracing.** Add `scripts/runSyncWorker.ts` to
  `workerScriptPaths`/`workerScriptEntrypoints` in
  `lib/workers/entrypoints.ts`. Everything else follows mechanically:
  `collectWorkerRuntimeTraceFiles` walks its import graph into
  `outputFileTracingIncludes`, and `verifyStandaloneWorkerBuild.ts`
  (which requires the standalone `scripts/` dir to equal the registry
  exactly) covers the new file without edits. No new `node_modules`
  trees: the resident imports a subset of what `runSyncJob.ts` already
  traces. `serverExternalPackages` unchanged.
- **Docker worker check.** `verifyDockerWorkerImage.ts` runs each
  entrypoint with a bad payload and asserts a validation message. The
  resident entrypoint has no argv payload; with stdin closed (Docker
  `run` without `-i`) its defined behavior is: import, emit `hello` on
  stdout, see EOF, drain, exit 0. Add a fourth check asserting exit 0
  and a parseable `hello` frame, and keep the existing three checks —
  the one-shot entrypoint stays for rollback, so its check must keep
  passing unchanged.
- **Graceful shutdown.** No changes to `lib/server/shutdown.ts`,
  `standalone.ts`, `prepareStandaloneShutdown.ts` or the launcher. The
  resident is just another `trackWorker` child plus a drain frame.
  Acceptance gates, both modes: `scripts/checkGracefulShutdown.ts`
  (exit 0, <5 s, no forced kill), the `next start` regression probe,
  and the three documented standalone scenarios within ~100 ms of
  today's 121/44/282 ms medians, with zero lease/queue rows and
  integrity `ok` afterwards.
- **Logging / telemetry.** Parent keeps today's structured lines
  (`worker started`, progress, failed) with the same field set
  (jobId, accountId, folderId, mode, pid) plus `transport` and
  `workerGeneration`. Worker stderr is forwarded line-wise with the
  `[sync-worker]` prefix as today. Redaction rules carry over: no
  passwords, tokens or auth URLs in any line — frames contain no
  secrets by construction, auth failures log only the
  `getImapHttpError` code (existing behavior), and any URL that ever
  reaches a log line goes through `redactAuthUrl`
  (`lib/authRecoveryContext.ts`, the launcher's pattern from
  fix/launcher-log-redaction). Progress `message` strings can embed
  IMAP error text; that is true today as well and must not grow: the
  resident must not add raw exception messages beyond what the one-shot
  path already writes to stderr. Heartbeat frames are never logged
  per-frame (counters only, folded into the job-completion line).
- **Writer guards / FTS v3 untouched.** No changes to
  `lib/db/shardFormat.ts`, `ftsIdentity.ts` or trigger installation.
  The resident opens shards exclusively through
  `configureAccountDb`/`getAccountDb`, so `noctua_writer_v3`
  registration and the 81 v3 guards behave identically; the guard
  brief's "keep" verdict is respected by construction.
- **Recompute workers.** Unchanged in v1. The identity recompute keeps
  competing for the same durable slots with one-shot children; because
  an idle resident holds no lease, it cannot starve them. Revisit only
  if measurement shows recompute startup matters.

## 6. Measurement plan

Fixture and method follow the perf briefs: synthetic data only, the
`scripts/dev-fixture` IMAP/SMTP fixture (`doc/DEV-FIXTURES.md`, 90
seeded messages, `/inject` for one-message deltas, control endpoint
counts wire commands), an isolated `NOCTUA_DATA_DIR`, `nice -n 10`,
medians after one warmup, host load recorded per series, scratch under
`/tmp`. Before = `per-job`, after = `resident`, same build.

| Metric | Method | Gate (estimate-based) |
|---|---|---|
| Per-job latency, many 1-message jobs | Inject 1 message, sync INBOX, ×50 per mode | Median drops ≥250 ms |
| Folder-sweep latency | `runNewMailCheck` over all fixture folders ×10 | Median drops ≥ (folders−1)×250 ms |
| IMAP logins per hour | Fixture control counts LOGIN during 1 h watcher run | Logins ≈ jobs → ≈ distinct bursts |
| Watcher event → list-visible | Inject during IDLE; time to `synced` + summary change | Median improves; no regression >50 ms |
| RSS over 24 h | Heartbeat `rssBytes` sampled 1/min, watcher on | No monotone growth after recycle |
| Shutdown ms | `checkGracefulShutdown.ts` idle + during initial sync, ×5 | Exit 0; within 100 ms of 121/282 ms |
| First job after spawn | Cold parent, first sync | No worse than today +50 ms (hello wait) |

Expected savings, stated as estimates with the measured 328 ms as the
only hard input: subsequent job saves 328 ms import (measured) +
~7 ms spawn (measured) + one IMAP login when the pooled connection is
reused (50–300 ms per the pool header; the local fixture will show the
low end, a real provider the high end). That is ~390–640 ms per
subsequent job, ~4.3–7.0 s per 12-folder sweep, and an estimated
watcher 1-message flow of ~525 ms → ~150–250 ms (525 ms measured in
`perf-writer-guards.md` through the real worker path). Pool reuse
requires the next job for the same account within the pool's 60 s idle
window — true inside sweeps and watcher bursts, not guaranteed for
isolated manual refreshes minutes apart; those still save the import.
CPU saving is the same import cost not burned per job (~0.33 core-second
each); at watcher scale (12 mailboxes, checks every few minutes) that
is the difference between a mostly-idle box and a periodic CPU sawtooth.

## 7. Implementation plan

Slices are ordered so each lands green on its own; sizes are rough
diff estimates (production + tests). Nothing here starts before
integration round 10, per the tasking.

| # | Slice | Est. size | Key tests |
|---|---|---|---|
| 1 | Target-account load + per-job abort context | ~250 lines | Lifecycle suite stays green; cancel-during-retry unit test |
| 2 | Protocol v1 envelope in `syncProtocol.ts` | ~200 lines | Round-trip/parse unit tests; old formats untouched |
| 3 | `executeSyncJob` core extraction; CLI becomes transport | ~300 lines | Existing sync suites pass unchanged (behavior-preserving) |
| 4 | Resident entrypoint + loop (`scripts/runSyncWorker.ts`) | ~350 lines | Subprocess test: hello → 3 jobs → drain → exit 0 |
| 5 | Lease bind-by-PID + per-job worker-side lease check | ~200 lines | `lease-lost` job does no IMAP/DB writes; reclaim tests |
| 6 | `ResidentTransport` + flag in `lib/syncJobs.ts` | ~500 lines | Queue/priority/join suites parametrized over both modes |
| 7 | Watchdog, recycle, crash breaker, pool fingerprint + cap | ~350 lines | One test per failure-matrix row (below) |
| 8 | Packaging: entrypoints registry, Docker check, docs | ~150 lines | `test:standalone-workers`, `test:docker-workers`, shutdown probes |

Slice notes:

- **Slice 1** is independently valuable and de-risks everything else:
  `getAccountById` in `runSyncOperationBatched`, and the ALS job-abort
  refactor of `workerLifecycle.ts` with the process signal as the
  default context. The worker-lifecycle integration tests and the
  graceful-shutdown probes are the gate; behavior in per-job mode must
  be bit-identical.
- **Slice 3** must be a pure move — same retries, same progress
  emissions, same exit codes. If any test changes, the slice is wrong.
- **Slice 5** is the security-critical one: reviewers must confirm the
  resident can never do work without a live lease row naming its PID,
  and that release-on-terminal-frame cannot free a slot while the
  worker is still inside a transaction for that job (the frame is sent
  only after `executeSyncJob` returns, i.e. after the last commit).
- **Slice 7 failure-matrix tests**, one per row of section 3: kill -9
  the resident mid-job (exact PID from `hello`); wedge via a fixture
  IMAP server that stalls mid-FETCH; cancel during retry backoff;
  SIGTERM the parent during initial sync and assert the committed-batch
  recovery (300/3060-style) plus empty lease tables; RSS recycle with
  thresholds lowered via env; two parents on one data dir (second
  parent's jobs queue, orphan resident exits on EOF); `hello` mismatch
  via wrong build-id env; `SQLITE_BUSY` against a locked shard;
  watcher burst of 50 injected events (one trailing check, no lost
  EXISTS); credential rotation between jobs (old pooled session evicted,
  new password used, no auth-failure loop).
- Gates per slice: `bun run typecheck`, focused tests, then
  `bun run test:ci` + `test:stress` for slices 1, 5, 6 (mock/order
  sensitive), `bun run build` + both worker-packaging checks at slice 8,
  lint with zero new diagnostics. Mock discipline per AGENTS.md: mock
  the wrapper path production imports, not `@/lib/db`.

What the Umbau thread must review explicitly (security-relevant):

- credential handling: per-job re-read, fingerprint-gated pool reuse,
  no secrets in frames/logs/env beyond today's spawn env;
- process boundaries: lease bind check, stdin EOF/ppid orphan exit,
  kill escalation only ever signal owned PIDs;
- shutdown: drain ordering against the coordinator phases and the
  documented acceptance numbers;
- the release-on-terminal-frame rule as the one place where "confirmed
  exit" semantics genuinely change.

## 8. Risks and open questions

Risks, in order:

1. **Lease correctness across a reused PID.** Today's invariant "one
   lease = one process lifetime" becomes "one lease = one job on a
   longer-lived process". A bug here can run a job without admission
   (two writers on one account) or strand a slot forever. Mitigated by
   the per-job bind check and keeping reclaim purely PID/ESRCH-based,
   but this is the slice reviewers should read twice.
2. **Wedge blast radius.** A hung one-shot worker blocks one job for up
   to 600 s today; a hung resident additionally delays its slot's
   queue until the watchdog fires. The 60 s frame-silence kill bounds
   this well below today's worst case, but a false-positive kill of a
   legitimately CPU-bound batch would lose in-flight work (recoverable
   via resync, still user-visible). The 60 s bound needs evidence from
   the largest real messages before the default flips.
3. **Long-lived state leaks across jobs.** Decrypted account objects,
   shard handles, pool sessions, module caches and any `globalThis`
   state now survive job boundaries. Cross-account contamination (a
   cache keyed without accountId somewhere in the 184-file graph) is
   the class of bug unit tests won't catch; the two-shard LRU and
   per-job account re-read bound it, and slice 7 needs a dedicated
   two-account interleave test asserting per-account results.
4. **Memory growth / fragmentation** in a Bun process that parses mail
   for days. Recycle thresholds bound it; the 24 h RSS measurement is a
   flip gate, not a nice-to-have.
5. **Shutdown regression.** An idle resident is one more child the
   drain phase awaits; a drain bug directly threatens the accepted
   121/44/282 ms numbers and the 10 s systemd budget. Lazy spawn keeps
   the idle case free, but the during-sync case must be re-proven.
6. **Provider connection limits.** Worker-pooled idle sessions add up
   to one extra connection per recently-synced account for 60 s.
   Bounded by the 4-key pool cap, but the Netcup assumption in
   `doc/DEPLOYMENT.md` should be re-verified before enabling the
   watcher + resident combination in production.

Open questions for the reviewers:

- Should the in-core retry loop (11 attempts, up to ~10 min of slot
  occupancy) eventually move to the parent so backoff doesn't hold a
  resident? Out of scope here — behavior parity first — but the
  resident makes the cost visible in one place.
- Is 1 resident per slot right when `NOCTUA_MAX_SYNC_WORKERS=1` (small
  hosts)? It preserves today's contract, but a single resident then
  serializes everything exactly as a single one-shot slot does today —
  confirm that's acceptable rather than special-casing.
- Pool idle 60 s vs watcher check cadence: with a 5 min fallback
  interval, most watcher-triggered jobs will *not* reuse the pooled
  connection. Is raising the worker pool idle to e.g. 240 s (still
  under the 10 min max age) worth the extra idle sockets? Needs the
  provider-limit answer first.
- Should `progress` throttling (100 ms) also be applied to per-job
  mode's parent logging while we're here, or is that an unrelated
  change to keep out? (Recommendation: keep out; separate slice.)
- Does the Umbau thread want the `hello` buildId bound to
  `public/build-version.json`, or is the protocol constant plus mtime
  check sufficient? Build-version adds a file read at spawn; mtime
  alone is weaker in standalone where all files share a build stamp.

## Methodology

Sources read in full: `AGENTS.md`; briefs `perf-server-runtime.md`
(item 1), `perf-backlog-rerank-r8.md` (rank 5), `perf-writer-guards.md`,
`mailbox-watcher-review-*.md`, `graceful-shutdown*.md`; worktree docs
`doc/DEPLOYMENT.md` (worker, shutdown, watcher sections),
`doc/DEV-FIXTURES.md`, `doc/STORAGE.md` (shard sections). Code read:
`lib/syncJobs.ts`, `lib/workers/*`, `lib/syncOperation.ts` (entry and
batch boundaries), `lib/durableSyncWorkerSemaphore.ts`,
`lib/db/processLeases.ts`, `lib/syncWorkerSemaphore.ts`,
`lib/server/{shutdown,backgroundWork,workerLifecycle,standalone}.ts`,
`lib/mailboxWatcher.ts`, `lib/mail/imap/{connectionPool,idle}.ts`,
`lib/db/{connection,accounts,rowParsers,shardFormat}.ts`,
`lib/dbWriteRetry.ts`, `lib/mail/imapCancellation.ts`,
`lib/{workerJobRegistry,boundedWorkerJobRegistry}.ts`, sync API routes
and helpers, `next.config.ts`, `build-scripts/{workerRuntimeTraceFiles,
verifyStandaloneWorkerBuild,verifyDockerWorkerImage,
prepareStandaloneShutdown}.ts`, `scripts/{runSyncJob,
checkGracefulShutdown,verifyProcessLeases}.ts`, `instrumentation.ts`.

Probes run (all `nice -n 10`, workdir `wt-spike-sync-worker`, scratch
`/tmp/spike-sync-worker/`, no servers, no ports, no build, no test
suite): cold-import harness (r8 `cold.ts` retargeted) — first import
326 ms, cached 0.09 ms, RSS 92.5 MB; a 5-run series under host load ~33
discarded as load-contaminated; bare `bun -e` spawn-to-exit 6–15 ms;
NDJSON protocol probe — hello ~30 ms, 20/20 results, heartbeats during
work, exit 0; trace-graph count — 184 files, ~1.3 MB. Probe scripts
remain in `/tmp/spike-sync-worker/` for re-runs. No tracked file was
modified; `git status --short` in the worktree is empty.





