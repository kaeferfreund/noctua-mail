# Design spike — resident sync worker

Read-only design study on `wt-spike-sync-worker` @ `11dc3c5`
(`origin/integration/stage`, round 8), 2026-10-23. No source changes;
`git status --short` in the worktree is empty. Scratch probes under
`/tmp/spike-sync-worker/` only. This document is for the Umbau thread's
go/no-go review. Implementation is not before integration round 10.

## Revision 2 — reviewer conditions folded in

The Umbau thread accepted Revision 1 for review subject to eight
additional conditions. Revision 2 folds all eight into the design
below; none is softened or dropped. Where a condition conflicts with
Revision 1, the design changed and the change is called out both here
and in place. Structure, section numbering and measured figures
(328 ms import, 525 ms watcher flow, 121/44/282 ms shutdown) are
unchanged, except one cross-check correction noted under condition 2.

- **C1 Lease binding per job** — `run-job` now carries a per-job lease
  token; the worker re-verifies it against the master DB before every
  write batch and aborts with its own `error{code:"lease-lost"}`
  terminal frame (§2.1, §2.2, §2.3; test + slice 5). *Design change:*
  Revision 1 verified the lease only at job start and claimed "no
  schema change"; the token is persisted in a new additive nullable
  `leaseToken` column on `sync_worker_leases` (§2.1, §8 risk 7).
- **C2 Watchdog beyond frame silence** — `progress` frames are now
  guaranteed at least every N messages and every T seconds while a
  job runs; the frame-silence bound is no longer asserted at 60 s but
  derived from the largest real mailbox (§2.2, §3 hang row, §6).
  Conservative provisional default, per-deploy env override.
  *Cross-check correction:* at `11dc3c5` fetch batches are 300
  messages (`syncImapAccountBatched(..., 300)`) sanitized in
  sub-batches of 50, not the 100 stated in Revision 1 §3; the cadence
  design uses the real sizes.
- **C3 No state across jobs** — decrypt-per-job, fingerprint-gated
  pool eviction and shard LRU ≤ 2 with explicit close are now stated
  as hard rules with an explicit list of the only permitted cross-job
  state, plus a two-account interleave test with a credential change
  mid-flight (§2.3, §2.4; slice 8).
- **C4 Version skew** — `hello` now carries the build hash
  (`NOCTUA_BUILD_HASH` / `NEXT_PUBLIC_BUILD_HASH` via
  `lib/buildVersion.ts`); on mismatch the resident refuses jobs and
  the parent terminates and respawns it; two-build test (§2.2, §3,
  slice 9). This resolves Revision 1's open question on the build-id
  source (§8).
- **C5 Shutdown** — drain ladder is now budgeted explicitly against
  the systemd `TimeoutStopSec=10s` / `KillMode=mixed` contract, with
  the lease-release guarantee stated precisely and the probe kept as
  today (§3, §5; slice 9).
- **C6 Rollout** — flag default OFF in the first preview deploy;
  `per-job` stays default until two preview rounds without
  wedge/lease findings; activation is its own deploy with a one-line
  rollback (§4; slice 10).
- **C7 Logging/redaction, writer guards / FTS untouched, no new env
  secrets** — lease token treated as secret-shaped (never logged,
  never in env/argv); full tuning-env inventory with none secret;
  security-control run is a mandatory gate for the marked slices
  (§5; §7 gates).
- **C8 Chaos test per failure-matrix row** — every §3 row now names
  its chaos test and its gating suite (`test:ci` vs `test:stress`);
  mock-, order- and timing-sensitive tests are gated on `test:stress`
  (§3, §7 slice 7 notes and gates).

### Reviewer conditions → coverage

| # | Condition | Addressed in | Slice |
|---|---|---|---|
| C1 | Lease token in `run-job`, verified before every write batch, own terminal frame on loss; revoke-mid-batch test | §2.1, §2.2, §2.3, §3 (lease row), §5 (token secrecy) | 2 (frame), **5** (bind + checks) |
| C2 | Progress ≥ every N messages and T seconds; silence bound derived from largest real mailbox; conservative default, env-adjustable | §2.2, §3 (hang row), §6 (derivation), §8 risk 2 | 3 (emission), 7 (watchdog) |
| C3 | Decrypt anew per job; pool eviction on fingerprint change; shard LRU ≤ 2, explicit close; two-account interleave + credential-change test | §2.3, §2.4, §3 (credentials row) | 1, **8** |
| C4 | `hello` = build hash; mismatch → resident refuses, parent terminates + respawns; two-build test | §2.2, §3 (version-skew row) | 2 (frame), 9 |
| C5 | Drain inside `TimeoutStopSec=10s` / `KillMode=mixed`; lease release guaranteed; probe as today | §3 (shutdown row), §5 | 9 |
| C6 | Flag OFF in first preview deploy; `per-job` default until two clean preview rounds; separate activation deploy + rollback line | §4 | 6 (flag), 10 |
| C7 | Redaction unchanged; writer guards / FTS untouched; security-control run in gate; no new env secrets | §5, §7 gates | **1, 5, 8** (marked), 10 |
| C8 | One chaos test per §3 row; mock-sensitive ones in `test:stress` | §3 (test/suite columns), §7 | Per-row slices; 7 completes the matrix |

Slices in **bold** are security-critical and require explicit Umbau
review (§7).

## Summary / recommendation

**Go.** The eight reviewer conditions from the Umbau thread are now
part of the design (Revision 2, coverage table above); the go stands
on the updated text, with activation still gated on the §6
measurements and the two clean preview rounds in §4. Replace
process-per-job with a small pool of
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

Binding invariants of the updated design (Revision 1 conditions,
restated with the reviewer conditions folded in):

1. Ship behind `NOCTUA_SYNC_WORKER_MODE`, default `per-job`, and OFF
   in the first preview deploy; `per-job` stays the default until two
   preview rounds without wedge/lease findings, and activation is its
   own deploy with a rollback line (C6, §4).
2. Per-job cancellation must be reworked from today's process-global
   worker stop signal to a per-job `AbortSignal` before any resident
   code lands (§§2, 3, 7 slice 1).
3. Every job is lease-bound end to end: `run-job` carries a lease
   token, the worker re-verifies it before every write batch and
   aborts with its own terminal `lease-lost` frame when it no longer
   holds; capacity is released only after a terminal job frame, or
   after confirmed process exit when the worker dies; an idle
   resident holds no lease (C1, §§2, 3).
4. No credential state across jobs: credentials are decrypted anew
   from the master DB per job inside the worker, never sent over
   stdin, dropped at job end; a pooled IMAP connection is evicted
   when the account's credential fingerprint changes; shard handles
   are LRU ≤ 2 with explicit close (C3, §2).
5. The watchdog is progress-based, not silence-only: `progress` at
   least every N messages and every T seconds, with the silence
   bound derived from the largest real mailbox, conservatively
   defaulted and env-adjustable per deploy (C2, §§2, 3, 6).
6. `hello` carries the build hash; on mismatch the resident refuses
   jobs and the parent terminates and respawns it (C4, §2).
7. Graceful-shutdown numbers must not regress: lazy spawn (no
   resident exists before the first job), drain inside the existing
   4 s coordinator / 3.5 s worker budgets and therefore inside the
   systemd `TimeoutStopSec=10s` / `KillMode=mixed` contract, lease
   release guaranteed on every confirmed path,
   `checkGracefulShutdown.ts` and the standalone acceptance probes
   green in both modes (C5, §§3, 5).
8. Redaction, writer guards and FTS are untouched, no new env
   secrets are introduced, the security-control run is part of the
   gate for the marked slices, and every §3 failure row has a named
   chaos test (C7, C8, §§3, 5, 7).

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

Lease adaptation — per-job lease token (C1; *design change vs
Revision 1, which verified the lease only at job start and claimed no
schema change*): the lease row's `pid` becomes the resident's PID for
the duration of the job, and each dispatch is bound by a fresh
per-job lease token that the worker re-verifies before **every**
write batch, not only at job start.

- Token storage: one additive, nullable `leaseToken` column on
  `sync_worker_leases` (`lib/db/processLeases.ts`). Today's row is
  `(slot, jobId, accountId, ownerInstance, ownerPid, pid, expiresAt)`
  and `heartbeatWorkers` rewrites `expiresAt` every `LEASE_MS / 3`
  (5 s), so no existing column can serve as a stable token. The
  column is written only by the resident bind path; per-job workers
  never read or write it, and a rolled-back binary ignores it (§4,
  §8 risk 7). This is the one schema change in the design.
- Binding: `spawnLeasedWorker` is generalized to
  `bindLeasedWorker(jobId, owner, pid)` which, under the same
  immediate transaction that today records the child PID, records
  the already-running resident's PID and a fresh `randomUUID()`
  token, and returns the token to the parent. The parent puts the
  token in the `run-job` frame's `lease` field (§2.2) — pipes only,
  never env or argv (§5). A retry of the bind can never mint two
  live tokens for one row: the second transaction overwrites the
  first, and any frame carrying the superseded token fails its
  first verification.
- Worker-side verification: on `run-job` the resident first runs the
  per-job equivalent of today's `bindWorkerProcess(jobId, owner)` —
  a lease row must exist for `(jobId, ownerInstance)` with
  `pid = process.pid`, `leaseToken = <frame token>` and
  `expiresAt > now` — before touching IMAP or shards. It then
  re-runs the same check (`assertLeaseHeld()` in the job context,
  §2.3) immediately before every write batch for the whole job.
  Any failure — row gone, token superseded, PID rebound, lease
  expired because the parent stopped heartbeating — aborts the job
  at that point: no further writes, the job's `AbortSignal` fires
  for in-flight IMAP waits, and the worker emits its own terminal
  `error{code:"lease-lost"}` frame and stays alive for the next
  job. Committed batches stay committed; an immediate transaction
  already open finishes, exactly as with signals today — the check
  gates the *opening* of each write batch, it cannot preempt
  synchronous SQLite work.
- Why a token, given the `(jobId, owner, pid)` tuple already exists:
  the tuple proves a lease row names this process; the token
  additionally proves this *dispatch* is the row's current binding.
  After a reclaim and re-reserve of the same `jobId` (same owner
  instance, same still-alive resident), the tuple alone would let a
  stale in-flight job keep writing under the new reservation; the
  superseded token cannot.

Release semantics split in two. Note today's `removeWorker` deletes
the lease row only when `pid` is null, exit is confirmed, or
`processExited(pid)` — a resident's PID deliberately stays alive
after a terminal frame, so slice 5 adds the terminal-frame path as
an explicit third release proof (frame received on the pipe of the
bound PID, its `leaseToken` still current); all other paths keep
today's proof rules byte-for-byte:

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
| `hello` | worker → parent | `v`, `buildHash`, `pid` | First frame after imports; build-hash version gate (C4) |
| `run-job` | parent → worker | `jobId`, `payload`, `lease{ownerInstance, leaseToken}`, `buildHash`, `deadlineMs` | Start one job; payload = today's `SyncPayload` + `clientId`, `source`; lease token per C1 |
| `progress` | worker → parent | `jobId`, `progress` | Existing `SyncOperationProgress`; guaranteed cadence N/T (C2) |
| `result` | worker → parent | `jobId`, `result` | Terminal success, exactly once per job |
| `error` | worker → parent | `jobId`, `code`, `message` | Terminal failure; codes: `sync`, `auth`, `lease-lost`, `version-skew`, `busy`, `cancelled`, `protocol` |
| `cancel` | parent → worker | `jobId` | Abort the running job; worker stays alive |
| `ping` / `pong` | both | `seq` | Liveness probe on heartbeat silence |
| `heartbeat` | worker → parent | `seq`, `rssBytes`, `jobsDone` | Every 2 s while alive; feeds watchdog + recycle |
| `drain` | parent → worker | `deadlineMs` | Finish/stop current job, then prepare to exit |
| `drained` | worker → parent | — | Pool drained, DBs closed; process exits 0 next |
| `exit` | parent → worker | — | Idle-time equivalent of `drain` (recycle, version skew) |

Rules:

- `hello` versioning = build hash (C4): `hello.buildHash` is the
  build hash both sides derive independently from the existing
  plumbing — `NOCTUA_BUILD_HASH ?? NEXT_PUBLIC_BUILD_HASH` as
  normalized by `lib/buildVersion.ts` (CI sets it to the git SHA,
  the Dockerfile maps it to `NEXT_PUBLIC_BUILD_HASH`; the same value
  backs `public/build-version.json`). No new env is introduced for
  this (C7); a shared `getBuildHash()` export next to
  `getBuildVersionLabel` is the one derivation. The parent spawns
  with `NOCTUA_WORKER_PROTOCOL=1` (protocol constant only) and
  requires `hello` within 10 s (import time included) with `v`
  matching and `buildHash` equal to its own. On mismatch the parent
  never dispatches to that resident: it terminates it (SIGTERM,
  await `exited`) and respawns once; a second consecutive mismatch
  disables resident mode for the process lifetime and falls back to
  per-job spawn (§4). Defense in depth on the worker side: every
  `run-job` also carries the parent's `buildHash`, and the resident
  itself refuses the job with the terminal (for that dispatch —
  no work has run, no lease verification has passed)
  `error{code:"version-skew"}` if it differs from its own hash; the
  parent then terminates and respawns the resident and re-dispatches
  the job under a freshly bound lease token. In dev both sides
  normally derive the empty hash and are therefore equal; the
  entrypoint-mtime check (§3) remains the dev skew guard. An empty
  hash on exactly one side is a mismatch.
- Lease token (C1): `run-job.lease = { ownerInstance, leaseToken }`
  as minted by `bindLeasedWorker` (§2.1). The token exists only in
  the lease row, the `run-job` frame and the two processes' memory
  for the job's duration; it is secret-shaped for logging purposes
  and must never appear in a log line, an `error.message`, env or
  argv (§5). `progress`/`result`/`error` frames do not echo it; the
  parent correlates terminal frames by `jobId` on the bound PID's
  pipe and checks token currency in the DB at release (§2.1).
- Progress cadence (C2): while a job runs, the worker emits a
  `progress` frame at least every **N = 50 processed messages** and
  at least every **T = 5 s** of job wall time, whichever comes
  first — in addition to today's phase/terminal emissions, not
  instead of them. N = 50 is the existing sanitize sub-batch size
  in `runSyncOperationBatched`, which already yields to the event
  loop between sub-batches, so the message-count guarantee costs
  no new yield points in the hot loop; the fetch generator's
  300-message batches and the post-commit emission already produce
  frames at batch boundaries. T is enforced by a per-job timer in
  the job context that re-emits the last known progress (same
  `processed` count) when no natural emission occurred within T;
  the timer can only fire when the event loop turns, which is
  precisely the signal the watchdog needs. The Revision 1
  100 ms coalescing still applies *below* this guarantee (bursts
  merge, the N/T floor does not). N/T are constants in
  `syncProtocol.ts`/job context; the deploy-adjustable knob is the
  parent's silence bound derived from them (§3, §6). Per-job mode
  is unaffected: the cadence timer and sub-batch emissions live in
  the resident transport's `onProgress` wrapper, so the one-shot
  path's stdout stays byte-identical.
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
- No credentials on the wire: `payload` is exactly today's argv
  payload (account/folder/mode/uids/clientId). Credentials never
  leave the worker's DB read (§2.4). The one secret-shaped value on
  the wire is the per-job `leaseToken` (C1), confined to the
  stdin/stdout pipes and the lease row as specified above.

### 2.3 Job execution inside the resident

- One shared core: extract today's `runSyncJobCli` body into
  `executeSyncJob(payload, ctx)` in `lib/workers/runSyncJob.ts`, where
  `ctx` carries `onProgress`, an `AbortSignal`, the retry policy,
  and the per-job lease binding — `{ jobId, ownerInstance,
  leaseToken }` plus `assertLeaseHeld()` (C1). In per-job mode the
  CLI enters the same context with the already-bound one-shot lease
  (`bindWorkerProcess` at process start, as today) and
  `assertLeaseHeld()` performs the same row check; the only
  behavioral difference is the revocation window, which per-job
  mode previously did not check at all — slice 5 must call this out
  in its commit, it is a (safety-improving) behavior change for the
  one-shot path too, not a pure move.
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
- Lease check before every write batch (C1): `assertLeaseHeld()`
  is one indexed `SELECT` on the master handle the resident already
  holds (`sync_worker_leases` by `jobId`+`ownerInstance`, checking
  `pid`, `leaseToken`, `expiresAt`), folded into the job-context
  safe point so it composes with cancellation: a failed check
  throws the same way `workerSafePoint()` does today, and the
  resident transport maps that throw to the terminal
  `lease-lost` frame (§2.1). "Every write batch" is enumerated
  against `runSyncOperationBatched` at `11dc3c5`, because writes
  are not confined to the fetch-batch loop:
  - at the batch-loop head, next to the existing `workerSafePoint()`
    (covers the case where the lease died during the IMAP fetch);
  - immediately before the per-batch write cluster — before
    `reconcileVerifiedCrossFolderMoves` (first mutating step,
    includes the tombstoned-draft IMAP deletes) and again before
    `upsertMessages`, because awaited IMAP work sits between the
    two; and again before the post-batch
    `updateMailboxHighestUid` write, because the awaited upsert
    sits between it and the previous check;
  - before each non-batch write phase: `saveMailboxState`,
    `saveFoldersForAccount`, `deleteMessagesWithFilesByIds` /
    `deleteMessagesByIds` (incl. final orphan reconciliation),
    and the `recomputeThreadsForAccount` /
    `recomputeCategoriesForAccount` phases.
  Inside any one of those calls, an already-open immediate
  transaction always finishes (§2.1). Cost is one master-DB read
  per enumerated site — per 300-message batch in the hot loop —
  against the parent-heartbeated lease row; §6 records its latency
  contribution so the check cannot silently eat the import saving
  (§8 risk 7).
- Only the target account, decrypted anew per job (C3): replace
  `getAccounts()` + `find(id)` in `runSyncOperationBatched` with
  `getAccountById()` (`lib/db/accounts.ts`, already decrypts exactly
  one row via `mapAccountRow`). This removes the
  decrypt-every-account cost per job (called out in
  `perf-server-runtime.md` item 1) and bounds decrypted material in
  the long-lived process to one account at a time. Hard rule: the
  account object — decrypted passwords included — is loaded fresh
  at the start of every job attempt and every reference to it is
  dropped when the job ends (success, error, cancel and
  `lease-lost` alike); no module-level or `globalThis` cache of
  `Account` objects may be introduced in the worker, and slice 8's
  review includes a grep-level audit of the worker import graph
  for account-shaped caches. This change benefits per-job mode too
  and lands as slice 1.
- Shard handles — LRU ≤ 2 with explicit close (C3): the master DB
  stays open for the resident's lifetime. Account shards go through
  the existing `getAccountDb` cache; the existing `ACCOUNT_DB_IDLE_MS`
  idle close (default 5 min) remains as backstop but is **not** the
  mechanism that satisfies C3. Added hard rule, enforced in the
  resident at job boundaries: at most **2** shard paths open at any
  time; when a job needs a shard path beyond that, the resident
  first calls the existing `closeAccountDbConnection(path)`
  (`lib/db/connection.ts`) on the least-recently-used path and
  drops it from its LRU record before opening the new one.
  Keying is by resolved dbPath, not accountId — several accounts
  can share one physical shard (`doc/STORAGE.md`). Consecutive
  same-account folder jobs (the common sweep) reuse the warm
  handle, page cache and statement cache; alternating-account jobs
  pay one explicit close/open, which is the accepted price of the
  bound. The two-account interleave test (§3, slice 8) asserts the
  open-handle count never exceeds 2 and that the evicted handle is
  actually closed (reopen pays schema-init again), not merely
  forgotten by the LRU bookkeeping.

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
- Credential lifetime (C3): the account (with decrypted passwords)
  is decrypted anew from the master DB at the start of every job
  attempt — retry attempts included, so a password fixed during
  backoff is picked up — and every reference is dropped when the
  job ends, on every terminal path. Nothing credential-shaped is
  cached across jobs, logged, or put in a frame. The fingerprint
  itself is the existing HMAC (`watcherAccountIdentity`, keyed by
  the already-present `IMAP_SECRET_KEY` worker env — no new secret,
  C7) and is the only credential-derived value allowed to outlive
  a job, attached to its pool entry. A credential change mid-flight
  does not disturb the running job (same snapshot semantics as
  today); it takes effect on the next job and, via the fingerprint,
  on the next pool reuse.
- Permitted cross-job state, exhaustively (C3): imported modules and
  JIT state; the master DB handle; at most 2 shard handles (LRU,
  explicit close, §2.3) with their page/statement caches; at most 4
  fingerprint-gated pool entries (above); counters (`jobsDone`,
  RSS). Everything else a job creates — decrypted account objects,
  per-job lease tokens, progress/batch state, `highestProcessedUid`
  cursors beyond what the DB already persists — dies with the job.
  Any new entry on this list is a design change for the Umbau
  thread, not an implementation detail.

## 3. Failure matrix

Every row names its chaos test and gating suite (C8). `test:ci`
(`bun test --timeout 20000 && bun run test:dom`) gates the
deterministic tests; tests that are mock-, execution-order- or
wall-clock-timing-sensitive are additionally gated on
`test:stress` (`--randomize --seed=1337 --rerun-each=3`) — a row
marked `test:stress` is not done when it passes once under
`test:ci`. Test names below are the `describe`/`test` titles to
use in the new resident suites (`lib/syncJobs.test.ts` siblings /
resident subprocess suite, slice 4+), mocking the wrapper path
production imports, never `@/lib/db` (§7).

| Failure | Detection | Decision | Job / lease outcome | Chaos test | Suite |
|---|---|---|---|---|---|
| Worker crash mid-job | `exited` / stdout EOF, no terminal frame | Fail job, respawn lazily, crash-loop breaker | Lease freed after `exited`; committed batches stay | `crash: SIGKILL resident mid-batch (exact PID from hello)` | `test:ci` |
| Lease revoked / superseded mid-job (C1) | `assertLeaseHeld()` fails before a write batch | Abort job at that batch; worker emits own `error{lease-lost}` and survives | No writes after revocation point; earlier batches stay; slot release per §2.1 (no double-release) | `lease: revoke lease in parent while worker is mid-batch` | `test:stress` (lease-DB mock + batch gating) |
| Hang / wedge | Progress-cadence gap > silence bound (§6) → `ping` at bound/4 | SIGTERM → 3.5 s → SIGKILL → respawn | Job failed; queue promotes after confirmed exit | `wedge: fixture IMAP stalls mid-FETCH; watchdog escalates` | `test:stress` (wall-clock) |
| Job timeout (600 s) | Existing per-job deadline | `cancel`, escalate to SIGKILL at +5 s | As today: failed, exit confirmed first | `timeout: deadline cancels heartbeating-but-stuck job` | `test:stress` (wall-clock) |
| Cancel running job | `cancelWatcherSyncJobs` / shutdown | `cancel` frame, per-job abort; worker survives | `error{cancelled}`; lease freed on frame | `cancel: abort during retry backoff, resident takes next job` | `test:ci` |
| Parent shutdown | Coordinator stop phase | `drain` (deadline 3.5 s) → SIGTERM → systemd SIGKILL last | Exit 0 inside 4 s budget ⊂ 10 s systemd budget; leases released or PID-retained (C5) | `shutdown: SIGTERM parent during initial sync, committed batches recover` + `checkGracefulShutdown.ts` idle/watcher probes | `test:stress` (timing) + shutdown probe gate (§5) |
| Memory growth | `rssBytes` in heartbeat, `jobsDone` | Recycle at job boundary: 200 jobs / 512 MiB / 1 h | No job impact; next job spawns fresh resident | `recycle: thresholds lowered via env, resident rotates at job boundary` | `test:ci` |
| Two parents, one box | Durable leases in shared master DB | Residents are parent-local; slots stay global | Second parent queues; orphan resident self-exits on EOF | `two-parents: shared data dir, second parent queues; orphan exits on EOF` | `test:stress` (interleaving order) |
| Version skew after deploy (C4) | `hello.buildHash` ≠ parent hash; entrypoint mtime change (dev) | Resident refuses (`version-skew`); parent terminates + respawns once, then per-job fallback | No job runs on a mismatched worker | `skew: two builds, resident of build A refuses parent of build B` | `test:ci` (hash forced via `NOCTUA_BUILD_HASH` per subprocess) |
| DB busy / locked | `SQLITE_BUSY` via existing retry paths | Unchanged budgets; worker never heartbeats leases; lease checks are reads | Job retry semantics unchanged | `busy: locked shard + contended master during lease checks` | `test:stress` (lock timing) |
| Watcher event burst | Existing coalescing upstream | No change; max in-flight 1 per resident | Jobs join/coalesce in parent as today | `burst: 50 injected events, one trailing check, no lost EXISTS` | `test:stress` (event ordering) |
| Credentials changed mid-flight (C3) | Per-job decrypt + pool fingerprint | Running job keeps snapshot; next job re-decrypts | Stale pooled session evicted before reuse | `credentials: two-account interleave with credential change mid-flight` | `test:stress` (account interleave) |

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
- **Lease revoked / superseded mid-job (C1).** New row in Revision 2.
  Revocation sources are the ones that already exist — parent-side
  release/reclaim, lease expiry when the parent stops heartbeating
  (`LEASE_MS` 15 s, heartbeat every 5 s), or a rebind of the same
  row minting a superseding token — plus the chaos test revoking
  directly in the master DB. The worker notices at the next
  `assertLeaseHeld()` (§2.3 enumerates the sites), i.e. at worst at
  the next write-batch boundary, never mid-transaction. Parent
  side: the `lease-lost` terminal frame is a normal terminal frame
  for the monitor (job failed, watcher-queue cancellation rule
  applies as for any failed watcher job), but release must be
  idempotent against a parent that already revoked — if the row is
  gone or rebound to a newer token, the frame releases nothing.
  The resident is not at fault and is not recycled for a
  `lease-lost`; a lease-lost loop (every job failing its first
  check) instead trips the same process-lifetime fallback as
  repeated `hello` mismatch (§4), because that pattern means the
  bind path itself is broken.
- **Hang / wedge (C2).** The watchdog no longer keys on frame silence
  alone. With the §2.2 cadence guarantee (progress every N = 50
  messages and T = 5 s), a healthy job's inter-frame gap is bounded
  by the longest *event-loop-blocking* stretch: one 300-message
  `upsertMessages` immediate transaction (FTS triggers included)
  on a large shard, one full-thread/category recompute phase, a
  single pathological MIME parse (parse measured ~5.5 ms/message
  at r8 on ordinary mail), or a `busy_timeout` wait (15 s shard).
  Heartbeats (2 s) prove the event loop turns between jobs and
  during fetches; during a blocking stretch no frame of any kind
  can be sent, which is why the silence bound must be *derived*
  from the largest real mailbox instead of asserted — Revision 1's
  flat 60 s claim is withdrawn. §6 defines the derivation
  (max observed legitimate gap on the anonymised ~15k-message
  preview shards × safety factor 3, floored at 60 s, capped below
  the 600 s job deadline). Until that measurement runs, the
  provisional default is a conservative **120 s**, adjustable per
  deploy via `NOCTUA_SYNC_WORKER_SILENCE_MS` (parsed with the same
  invalid-value-falls-back-to-default discipline as
  `NOCTUA_SYNC_WORKER_TIMEOUT_MS`; tuning only, not a secret, C7).
  Escalation scales with the configured bound B: silence B/4 →
  `ping`; silence B → SIGTERM (worker aborts at the next safe
  point); +3.5 s (the existing worker fallback) → SIGKILL; await
  `exited`; fail the job; respawn lazily. Queued jobs stay in the
  parent's per-account queue and the durable semaphore throughout —
  promotion happens only after confirmed exit, exactly as the
  current monitor guarantees. Two distinct no-progress shapes are
  kept apart: no frames at all (this row) vs frames with a frozen
  `processed` count (the T-timer re-emissions) — the latter is
  bounded by the 600 s job deadline as today: deadline → `cancel`
  → +5 s → SIGKILL. Every watchdog escalation and every
  frozen-progress deadline hit logs one structured `wedge` line;
  these lines are the "wedge findings" counted in §4's preview
  rounds.
- **Parent shutdown (C5).** Budget ladder, innermost first — every
  rung already exists today and none may grow: worker drain/exit-0
  fallback **3.5 s** (`runWorker`) ⊂ coordinator deadline **4 s**
  (`lib/server/shutdown.ts`) ⊂ systemd **`TimeoutStopSec=10s`** with
  **`KillMode=mixed`**, `KillSignal=SIGTERM` (`doc/DEPLOYMENT.md`
  recommended unit; the application changes no unit). `KillMode=
  mixed` means systemd signals only the main process and SIGKILLs
  the cgroup remainder at 10 s, so the resident must never rely on
  receiving systemd's SIGTERM itself — the parent forwards stop to
  it, exactly as `trackWorker` does for today's children. The
  resident registers with the same hooks plus a transport drain
  hook. Order inside the stop phase: send `drain{deadlineMs: 3500}`
  first (the worker aborts IMAP waits, stops between batches —
  the running job ends with its terminal `cancelled` frame —
  drains its pool, closes its DBs, replies `drained`, exits 0);
  the SIGTERM from `background:stop` is equivalent if the frame is
  lost — the worker treats SIGTERM as drain with the existing
  3.5 s exit-0 fallback. Drain phase awaits `exited` via
  `background:drain` and the semaphore's drain hook awaits lease
  cleanup, as today. **Lease release, guaranteed precisely:** on
  every confirmed path the lease is released before the parent
  exits 0 — terminal frame received (normal drain) or `exited`
  resolved. The one unconfirmed path keeps today's fail-closed
  contract and this design does not weaken it: if the 4 s deadline
  hits with a resident neither drained nor exited, the parent
  exits 0, systemd reaps the child by 10 s, and the lease row is
  retained until ESRCH reclaim proves the PID dead on the next
  admission — the slot is never freed early and never stranded
  permanently. SIGKILL is never sent by the parent during
  shutdown. Lazy spawn means an idle server that never synced has
  no resident and pays nothing. Probe stays as today (§5):
  `scripts/checkGracefulShutdown.ts` idle/watcher numbers
  (121/44/282 ms medians, fail at ≥5 s / nonzero / forced kill),
  re-run with residents spawned in each scenario.
- **Two parents.** Same data dir: admission is already global through
  the master DB; each parent may keep idle residents, but a job only
  runs while its parent holds the lease, and the resident re-verifies
  that lease per job. Different data dirs (dev vs preview): separate
  master DBs and shards, no interaction, as today. A resident whose
  parent dies without drain sees stdin EOF and exits after finishing
  its current immediate transaction (drain semantics); a ppid-change
  poll every 5 s is the belt-and-braces for a wedged pipe. Only then
  does ESRCH reclaim free its lease — fail-closed as today.
- **Version skew (C4).** The gate is the build hash (§2.2): parent
  compares `hello.buildHash` to its own derivation before first
  dispatch, the resident independently refuses any `run-job` whose
  `buildHash` differs from its own (`version-skew`, no work run),
  and on either mismatch the parent terminates the resident,
  awaits `exited`, respawns once, and only then falls back to
  per-job (§4). Deploys restart the parent (systemd), so in
  production the realistic skew is a resident spawned from a
  previous standalone tree during a deploy overlap; the hash gate
  covers it because the two builds' `NOCTUA_BUILD_HASH` values
  differ by construction. In dev both hashes are normally empty
  (equal), so the parent additionally records the entrypoint's
  mtime at spawn and stats it before each dispatch (one `stat`
  per job); a change triggers `exit` + respawn. The two-build
  chaos test forces distinct hashes per subprocess via
  `NOCTUA_BUILD_HASH` — no full rebuild needed — and asserts build
  A's resident runs zero jobs for build B's parent.
- **DB busy / locked.** No budget changes: shard `busy_timeout` 15 s,
  master write retry 5×(120–960 ms), in-core job retries 11×(10–60 s).
  The resident holds handles longer than a one-shot child, but the
  parent already holds the same handles process-wide; WAL
  reader/writer behavior is identical. Lease heartbeats remain the
  parent's job — the worker never writes lease rows; its per-job
  bind and every `assertLeaseHeld()` are reads on the master handle
  (Revision 1 noted only the initial bind read; C1 makes the reads
  per-batch, still reads, no new write contention — but a master
  handle stuck behind a write transaction can delay a check, which
  the `busy:` chaos test exercises: a delayed check must fail
  closed or retry within the existing read discipline, never skip
  the batch gate).

## 4. Rollback

- Flag: `NOCTUA_SYNC_WORKER_MODE=resident|per-job`, parsed once in
  `lib/syncJobs.ts` with the existing `positiveInteger`-style
  invalid-value-falls-back-to-default discipline (unknown value ⇒
  default). **Default at merge: `per-job` (resident OFF).**
- Rollout sequence (C6) — three separate deploys, in this order;
  no step may be folded into another:
  1. **Deploy 1 (code, flag OFF).** The resident code and the
     additive `leaseToken` column ship to preview (and then prod on
     the normal train) with `NOCTUA_SYNC_WORKER_MODE` unset or
     `per-job` everywhere, including the preview instance
     (`doc/DEPLOYMENT.md` preview has isolated data/auth/secrets).
     Behavior must be indistinguishable from the previous build;
     the per-job lease checks from slice 5 are active but bound to
     the one-shot lease exactly as `bindWorkerProcess` is today.
  2. **Preview rounds (flag ON, preview only).** Enable
     `resident` on preview as its own config change. A *preview
     round* = one preview deploy cycle with resident on, the §6
     measurements re-run against it, and a log review for findings.
     A round is **clean** only with zero *wedge findings* (§3
     watchdog escalation / frozen-progress deadline lines) and
     zero *lease findings* (`lease-lost` frames not explained by a
     deliberate revocation, `UnconfirmedWorkerExitError`, crash-
     breaker trips, any lease row surviving a confirmed drain).
     **Two consecutive clean rounds** are required; any finding
     resets the count and the fix ships through step 1 again.
     `per-job` remains the code default throughout.
  3. **Activation deploy (its own deploy, prod).** Only after two
     clean rounds: a dedicated deploy whose only change is setting
     `NOCTUA_SYNC_WORKER_MODE=resident` in the prod environment and
     restarting the service — no code changes ride along. Flipping
     the *code* default to `resident` is a later, separate decision
     (keep the flag for at least one release after activation).
  - **Rollback line** (valid at every step, incl. mid-round):
    `NOCTUA_SYNC_WORKER_MODE=per-job` + service restart restores
    process-per-job immediately — no data rollback (the
    `leaseToken` column is additive and ignored by per-job code
    and by older binaries), no shard changes, in-flight jobs
    finish or fail under the old monitor rules, and residents are
    drained by the normal shutdown path on restart.
- Runtime fallback (no restart needed, no code removal): `hello`
  build-hash mismatch twice, a `lease-lost` loop (§3), or the
  crash-loop breaker tripping disables resident dispatch for the
  process/cooldown and logs one structured line; each such event is
  a lease/wedge finding for §4 round purposes if it happens on
  preview. Setting the env var back and restarting restores per-job
  permanently (the rollback line above).
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
  through the resident transport with the flag set, and the §3
  chaos tests gate on their named suites (`test:ci` / `test:stress`,
  §7).

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
- **Graceful shutdown (C5).** No changes to `lib/server/shutdown.ts`,
  `standalone.ts`, `prepareStandaloneShutdown.ts`, the launcher, or
  any systemd unit. The resident is just another `trackWorker` child
  plus a drain frame, inside the existing budget ladder — worker
  3.5 s ⊂ coordinator 4 s ⊂ systemd `TimeoutStopSec=10s` /
  `KillMode=mixed` / `KillSignal=SIGTERM` (§3 shutdown note gives
  the ordering and the precise lease-release guarantee). Probe as
  today, both modes, now with residents spawned: idle and
  watcher+SSE scenarios via `scripts/checkGracefulShutdown.ts`
  (exit 0, <5 s, no forced kill — its idle/watcher millisecond
  numbers are the regression yardstick), the `next start`
  regression probe, and the three documented standalone scenarios
  within ~100 ms of today's 121/44/282 ms medians, with zero
  lease/queue rows and integrity `ok` afterwards. The during-sync
  scenario additionally asserts the running job's terminal
  `cancelled` frame arrived and its lease row is gone before
  parent exit (release-on-confirmed-path, §3).
- **Logging / telemetry / redaction (C7).** Parent keeps today's
  structured lines (`worker started`, progress, failed) with the
  same field set (jobId, accountId, folderId, mode, pid) plus
  `transport` and `workerGeneration`, and gains exactly two line
  kinds: the §3 `wedge` line and a `lease-lost` job-failure line
  (both counted as §4 findings). Worker stderr is forwarded
  line-wise with the `[sync-worker]` prefix as today. Redaction
  rules carry over unchanged: no passwords, tokens or auth URLs in
  any line. Concretely for this design: credential material never
  enters a frame by construction (§2.2); the per-job `leaseToken`
  is treated as a token for redaction purposes — it must never be
  logged (not even truncated/hashed in a way that invites log
  correlation back to a live lease), never appear in
  `error.message`, stderr text, env or argv (the frame and the
  lease row are its only homes); `buildHash` is not secret and may
  be logged. Auth failures log only the `getImapHttpError` code
  (existing behavior), and any URL that ever reaches a log line
  goes through `redactAuthUrl` (`lib/authRecoveryContext.ts`, the
  launcher's pattern from fix/launcher-log-redaction). Progress
  `message` strings can embed IMAP error text; that is true today
  as well and must not grow: the resident must not add raw
  exception messages beyond what the one-shot path already writes
  to stderr. Heartbeat and cadence re-emission frames are never
  logged per-frame (counters only, folded into the job-completion
  line).
- **No new env secrets (C7).** Complete env inventory of this
  design: `NOCTUA_SYNC_WORKER_MODE` (new, mode flag),
  `NOCTUA_SYNC_WORKER_SILENCE_MS` (new, watchdog tuning),
  `NOCTUA_WORKER_PROTOCOL=1` (new, constant, parent→resident spawn
  env only), resident recycle thresholds lowered in tests via env
  (test-only), and otherwise only env that already reaches today's
  worker spawn (`NOCTUA_MAX_SYNC_WORKERS`,
  `NOCTUA_SYNC_WORKER_TIMEOUT_MS`, `NOCTUA_SYNC_LEASE_JOB_ID` /
  `NOCTUA_SYNC_LEASE_OWNER`, `IMAP_SECRET_KEY` for the existing
  `watcherAccountIdentity` HMAC, `ACCOUNT_DB_IDLE_MS`,
  `NOCTUA_BUILD_HASH` / `NEXT_PUBLIC_BUILD_HASH`). None of the new
  names carries secret material; no new secret is generated,
  stored or required anywhere — lease tokens are per-job random
  values in the lease row, not configuration.
- **Writer guards / FTS v3 untouched (C7).** No changes to
  `lib/db/shardFormat.ts`, `ftsIdentity.ts` or trigger installation.
  The resident opens shards exclusively through
  `configureAccountDb`/`getAccountDb`
  (`configureAccountDb` → `prepareAccountShardConnection`), so
  `noctua_writer_v3` registration and the 81 v3 guards behave
  identically; the guard brief's "keep" verdict is respected by
  construction. Explicit close under the LRU rule (§2.3) uses the
  existing `closeAccountDbConnection` and re-registers guards on
  next open through the same path — closing/reopening must never
  produce a guard-less handle.
- **Security-control run in the gate (C7).** The slices marked
  security-critical in §7 (1, 5, 8) are not green on focused tests
  alone: their gate includes the full `test:ci` run with the
  security-control suites in it — redaction (`redactAuthUrl` /
  auth-recovery tests), writer-guard and FTS-identity suites
  (`lib/db/accountKeys.test.ts`, `lib/db/ftsIdentity.test.ts`),
  and the process-lease verification (`scripts/verifyProcessLeases.ts`)
  — plus `test:stress` where the slice's chaos rows demand it.
  A red security-control suite blocks the slice regardless of
  focused-test results; failure attribution follows §7's
  untouched-base discipline, never a skip.
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
| Inter-frame gap, largest mailbox (C2) | §6 silence derivation on anonymised ~15k preview shards | Silence default = clamp(3 × max legitimate gap, 60 s … <600 s); provisional 120 s until measured |
| Lease-check overhead (C1) | `assertLeaseHeld()` latency folded into per-job series above | Median per subsequent job still drops ≥250 ms with checks on |

### Silence-bound derivation from the largest real mailbox (C2)

The reviewers require the watchdog's silence bound to come from the
largest real mailbox, not from the synthetic fixture (90 messages)
used for the latency rows above. The preview instance's real shards
(~15k messages in the largest) are the source; they are used
**anonymised** and the procedure is part of the measurement plan,
not an ops afterthought:

- *Anonymisation:* on the preview host only, copy the largest 1–2
  shard files (plus a schema-only master copy) to scratch; in the
  copies, replace address/header/body content with synthetic
  same-shaped values (preserve per-message byte lengths of
  body/htmlBody/preview, attachment counts/sizes, folder/thread
  shape, indexes and FTS tables — the quantities that drive parse,
  sanitize, trigger and transaction cost) and drop the accounts'
  credential columns from the master copy entirely. The copies
  never leave the preview host, are never committed, and are
  deleted when the series ends; who runs the anonymisation and
  signs off the scrub list is an Umbau/ops decision recorded
  before the first run (§8 open questions). No real IMAP account
  is contacted: the write side is exercised by replaying
  `upsertMessages` batches (300-message batches, sanitized through
  the real stack from synthetic same-size MIME) and the real
  recompute/orphan phases against the anonymised shards; the
  fetch side keeps using the dev fixture.
- *What to record, per series:* wall-clock timestamp of every
  `progress`/`heartbeat` emission point (in-harness, resident
  transport with cadence on) so the **inter-frame gap** series —
  p50 / p99 / max, split by phase (fetch wait, sanitize sub-batch,
  `reconcileVerifiedCrossFolderMoves`, upsert transaction,
  `updateMailboxHighestUid`, `recomputeThreadsForAccount`,
  `recomputeCategoriesForAccount`, orphan delete) — can be
  computed; per-batch transaction durations against batch message
  count and byte volume; the largest single-message parse+sanitize
  duration and its byte size; every `busy_timeout` wait actually
  incurred; `assertLeaseHeld()` latency (C1 overhead); host load
  and RSS per series, medians after warmup, `nice -n 10`, same
  discipline as the rows above. Raw series stay in scratch with
  the anonymised shards and are deleted with them; only the
  aggregates (gap percentiles/max per phase, the derived bound)
  go into the brief/ops notes.
- *Derivation rule:* `NOCTUA_SYNC_WORKER_SILENCE_MS` default =
  3 × the maximum legitimate inter-frame gap observed across all
  phases and series, floored at 60 s and capped strictly below
  the 600 s job deadline. If 3 × max would exceed the cap, that
  is a finding against the design (a phase needs its own progress
  emissions or chunking), not a reason to widen the deadline.
  Until this measurement has run, the shipped provisional default
  is the conservative 120 s from §3, and the derived value must
  replace it — with the aggregates recorded — before the second
  preview round in §4 can count as clean. Per-deploy override via
  the env var remains available after derivation (larger hosts /
  slower disks), under the same invalid-value fallback discipline.

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

Re-cut in Revision 2 so that **every reviewer condition has its own
slice (= its own commit) carrying its test**; a condition is not
covered by a slice that merely touches the same files. Slices marked
**SEC** are security-critical: explicit Umbau review + the §5
security-control run in their gate. Each slice lands green on
`per-job` default; nothing user-visible changes before slice 10's
rollout steps (§4).

| # | Slice | Cond. | SEC | Est. size | Key tests (suite) |
|---|---|---|---|---|---|
| 1 | Target-account decrypt-per-job (`getAccountById`) + per-job abort context | C3 | **SEC** | ~250 lines | Lifecycle suite stays green; cancel-during-retry unit test; decrypt-count test (one account decrypted per job) (`test:ci` + security-control, §5) |
| 2 | Protocol v1 envelope in `syncProtocol.ts`: `hello.buildHash`, `run-job.lease{leaseToken}`, `run-job.buildHash`, new error codes | C1, C4 | — | ~250 lines | Round-trip/parse unit tests incl. token/hash fields; old formats untouched byte-for-byte (`test:ci`) |
| 3 | `executeSyncJob` core extraction; CLI becomes transport; resident-side progress cadence N=50/T=5 s wrapper | C2 | — | ~350 lines | Existing sync suites pass unchanged (pure move); cadence test: max inter-frame gap ≤ T and ≤ N messages on a slow fixture job (`test:ci`) |
| 4 | Resident entrypoint + loop (`scripts/runSyncWorker.ts`) | — | — | ~350 lines | Subprocess test: hello → 3 jobs → drain → exit 0 (`test:ci`) |
| 5 | Lease token: `leaseToken` column, `bindLeasedWorker`, `assertLeaseHeld()` at every §2.3 write-batch site, terminal-frame release proof in `removeWorker` | C1 | **SEC** | ~300 lines | `lease: revoke lease in parent while worker is mid-batch` — zero writes after revoke, own `lease-lost` frame, no double-release; `lease-lost` at job start does no IMAP/DB writes; reclaim tests (`test:stress` + security-control) |
| 6 | `ResidentTransport` + `NOCTUA_SYNC_WORKER_MODE` flag (default `per-job`) in `lib/syncJobs.ts` | C6 | — | ~500 lines | Queue/priority/join suites parametrized over both modes; flag-parse fallback tests (`test:ci`, `test:stress` for the parametrized semaphore suites) |
| 7 | Watchdog (derived silence bound, env override, `ping` ladder, `wedge` log line), recycle, crash breaker; remaining §3 chaos rows land here | C2, C8 | — | ~400 lines | §3 rows not already owned by slices 5/8/9: `crash:` (`test:ci`), `wedge:`, `timeout:`, `two-parents:`, `busy:`, `burst:` (`test:stress`), `cancel:`, `recycle:` (`test:ci`) |
| 8 | No-state-across-jobs: pool fingerprint + 4-key cap, shard LRU ≤ 2 with explicit `closeAccountDbConnection`, cross-job-state audit | C3 | **SEC** | ~300 lines | `credentials: two-account interleave with credential change mid-flight` — per-account results correct, stale session evicted, ≤2 shard handles open, evicted handle provably closed (`test:stress` + security-control) |
| 9 | Version-skew respawn (terminate + respawn once, then fallback) + shutdown drain wiring and budget probes | C4, C5 | — | ~300 lines | `skew: two builds…` (`test:ci`); `shutdown: SIGTERM parent during initial sync…` (`test:stress`) + `checkGracefulShutdown.ts` idle/watcher/during-sync probes in both modes (§5) |
| 10 | Packaging + rollout: entrypoints registry, Docker `hello` check, `doc/DEPLOYMENT.md` flag/rounds/rollback-line docs | C6, C7 | — | ~200 lines | `test:standalone-workers`, `test:docker-workers`, full §6 gate table recorded; rollout steps in §4 followed as separate deploys |

Slice notes:

- **Slice 1 (SEC)** is independently valuable and de-risks everything
  else: `getAccountById` (decrypt exactly one account anew per job)
  in `runSyncOperationBatched`, and the ALS job-abort refactor of
  `workerLifecycle.ts` with the process signal as the default
  context. The worker-lifecycle integration tests and the
  graceful-shutdown probes are the gate; behavior in per-job mode
  must be bit-identical.
- **Slice 3** must be a pure move for the core — same retries, same
  progress emissions in per-job mode, same exit codes. If any
  per-job test changes, the slice is wrong. The C2 cadence lives
  only in the resident transport's progress wrapper (§2.2), which
  is what keeps the pure-move claim honest.
- **Slice 5 (SEC)** is the most security-critical one: reviewers must
  confirm (a) the resident can never do work without a live lease
  row naming its PID *and* its current `leaseToken`; (b) every
  §2.3 write-batch site is actually gated — the enumeration is the
  review checklist, a missed write phase is a C1 violation;
  (c) release-on-terminal-frame cannot free a slot while the worker
  is still inside a transaction for that job (the frame is sent
  only after `executeSyncJob` returns, i.e. after the last commit)
  and cannot release a rebound row (token currency checked at
  release); (d) the token never reaches a log line, env or argv.
  Note this slice also changes per-job mode (checks bind to the
  one-shot lease, §2.3) — called out in the commit, covered by the
  same tests with the flag off.
- **Slice 7** completes the §3 matrix (C8): every row's chaos test
  exists either here or in its owning slice (5: lease; 8:
  credentials; 9: skew + shutdown), with the suite named per row
  in §3. Slice 7 is not done while any row lacks its named test,
  and a `test:stress` row is not done on a single `test:ci` pass.
  Concretely here: `kill -9` the resident mid-job (exact PID from
  `hello`); wedge via a fixture IMAP server that stalls mid-FETCH
  (silence bound lowered via env so the test runs in seconds, with
  one full-default run recorded manually); cancel during retry
  backoff; RSS recycle with thresholds lowered via env; two parents
  on one data dir (second parent's jobs queue, orphan resident
  exits on EOF); `SQLITE_BUSY` against a locked shard *and* a
  contended master during `assertLeaseHeld()`; watcher burst of 50
  injected events (one trailing check, no lost EXISTS).
- **Slice 8 (SEC)** — the interleave test is the condition's proof,
  not a smoke test: alternate jobs for two accounts on one
  resident (forcing LRU evictions in both directions), rotate one
  account's password in the master DB while its job is mid-flight,
  then assert: the in-flight job completed on its snapshot, the
  next job for that account decrypted the new password, the stale
  pooled session was evicted before reuse (fixture LOGIN count),
  the other account's results are byte-identical to a per-job run,
  and never more than 2 shard handles were open. The slice also
  delivers the permitted-cross-job-state audit (§2.4 list vs a
  grep of the worker graph) as a review artifact.
- **Slice 9** — skew test forces two build hashes via
  `NOCTUA_BUILD_HASH` in subprocess env (no rebuild); shutdown
  asserts the 300/3060-style committed-batch recovery, empty
  lease tables after confirmed drain, and the §5 probe numbers
  with residents spawned in the idle, watcher and during-sync
  scenarios.
- Gates per slice: `bun run typecheck`, focused tests, lint with
  zero new diagnostics; `bun run test:ci` for every slice;
  `test:stress` for slices 5, 6, 7, 8, 9 (their chaos rows are
  mock/order/timing-sensitive per §3); the §5 security-control run
  for **SEC** slices 1, 5, 8 (full `test:ci` incl. redaction /
  writer-guard / FTS suites + `scripts/verifyProcessLeases.ts`);
  `bun run build` + both worker-packaging checks + shutdown probes
  at slices 9–10. Mock discipline per AGENTS.md: mock the wrapper
  path production imports, not `@/lib/db` — this is precisely why
  the lease/semaphore chaos tests are `test:stress`-gated (C8).

What the Umbau thread must review explicitly (security-relevant,
slices 1, 5, 8 marked SEC):

- credential handling: decrypt-anew-per-job with reference drop on
  every terminal path, fingerprint-gated pool reuse, the exhaustive
  permitted-cross-job-state list (§2.4), no secrets in
  frames/logs/env beyond today's spawn env (lease token explicitly
  included in "secrets" for redaction, §5);
- process and lease boundaries: per-batch `assertLeaseHeld()` site
  enumeration (§2.3), token mint/bind/supersede semantics (§2.1),
  stdin EOF/ppid orphan exit, kill escalation only ever signalling
  owned PIDs, build-hash refusal on both sides (§2.2);
- shutdown: drain ordering against the coordinator phases, the
  3.5 s ⊂ 4 s ⊂ 10 s budget ladder, and the documented acceptance
  numbers (§§3, 5);
- the release-on-terminal-frame rule as the one place where
  "confirmed exit" semantics genuinely change, including its
  token-currency and no-double-release proofs.

## 8. Risks and open questions

Risks, in order:

1. **Lease correctness across a reused PID.** Today's invariant "one
   lease = one process lifetime" becomes "one lease = one job on a
   longer-lived process". A bug here can run a job without admission
   (two writers on one account) or strand a slot forever. Revision 2
   strengthens the mitigation per C1: per-job `leaseToken` binding
   with `assertLeaseHeld()` before every write batch (§§2.1, 2.3),
   keeping reclaim purely PID/ESRCH-based. Residual risk concentrates
   in slice 5's site enumeration (a missed write phase is ungated)
   and in the new terminal-frame release proof — this remains the
   slice reviewers should read twice.
2. **Wedge blast radius and false-positive kills.** A hung one-shot
   worker blocks one job for up to 600 s today; a hung resident
   additionally delays its slot's queue until the watchdog fires.
   Revision 2 replaces the asserted 60 s silence bound with the N/T
   progress cadence plus a bound *derived* from the largest real
   mailbox (§6, provisional conservative 120 s, env-adjustable), but
   until that derivation has actually run, the false-positive risk —
   killing a legitimately CPU-bound batch or recompute phase on the
   ~15k shards, losing in-flight work (recoverable via resync, still
   user-visible) — is unquantified. That is why the derived bound
   must land before the second §4 preview round can count as clean,
   and why every escalation is a counted wedge finding.
3. **Long-lived state leaks across jobs.** Decrypted account objects,
   shard handles, pool sessions, module caches and any `globalThis`
   state now survive job boundaries. Cross-account contamination (a
   cache keyed without accountId somewhere in the 184-file graph) is
   the class of bug unit tests won't catch; the two-shard LRU with
   explicit close, decrypt-anew-per-job and the exhaustive
   permitted-state list (§2.4) bound it, and slice 8's dedicated
   two-account interleave test with a credential change mid-flight
   asserts per-account results against a per-job reference run.
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
7. **Lease-token machinery (new in Revision 2, C1).** Three sub-risks:
   (a) *Cost* — one master-DB read per write batch on the hot path;
   if `assertLeaseHeld()` latency under contention eats a material
   share of the 328 ms saving, the §6 gate row fails and the design
   needs a cheaper proof (e.g. prepared-statement read on the
   already-open handle — no caching of the result across batches is
   acceptable, that would re-open the revocation window).
   (b) *False aborts* — a parent that stalls its 5 s heartbeat past
   the 15 s `LEASE_MS` (event-loop block, master write contention)
   now aborts healthy in-flight jobs at the next batch instead of
   merely risking reclaim later; fail-closed is the right direction,
   but preview rounds (§4) must show this does not fire under real
   parent load, and every such abort is a lease finding.
   (c) *Schema/rollback* — the additive nullable `leaseToken` column
   is the design's only schema change; it must be created
   idempotently on old master DBs, ignored by per-job and
   rolled-back binaries, and never required non-null. The §4
   rollback line depends on all three.
8. **Anonymised preview shards (new in Revision 2, C2/§6).** The
   silence derivation copies real preview shard data. A scrub-list
   miss (a content column carrying addresses/bodies that the
   anonymisation did not rewrite) puts real mail content into
   scratch files and measurement harnesses. Mitigations are in §6
   (preview-host-only, credential columns dropped, no commit,
   deletion with the series, aggregates only leave), but the scrub
   list needs a named owner and sign-off before the first copy is
   made — see open questions.

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
- ~~Does the Umbau thread want the `hello` buildId bound to
  `public/build-version.json`, or is the protocol constant plus mtime
  check sufficient?~~ **Resolved by C4 in Revision 2:** `hello`
  carries the build hash derived from `NOCTUA_BUILD_HASH` /
  `NEXT_PUBLIC_BUILD_HASH` via `lib/buildVersion.ts` (no spawn-time
  file read; `public/build-version.json` carries the same value for
  humans). The mtime check remains as the dev-only secondary guard.
  Remaining sub-question: in dev both sides derive the *empty* hash
  and therefore match — confirm empty==empty is acceptable there
  given the mtime guard, rather than forcing a dev hash.
- Who owns and signs off the §6 anonymisation (scrub list over the
  real shard schema, where the copies live on the preview host, who
  confirms deletion)? The derivation cannot start before this is
  answered, and §4's second preview round depends on it.
- What is the minimum wall-clock / job-count content of a "preview
  round" in §4 beyond "one deploy cycle + §6 re-run + log review" —
  e.g. 24 h of watcher operation, or N completed jobs — so two
  clean rounds are evidence rather than two quiet afternoons?
  (Recommendation: ≥24 h with watcher on and ≥1 full sweep per
  preview account; Umbau/ops to confirm.)
- If the §6 derivation shows a legitimate phase (most likely the
  final full `recomputeThreadsForAccount` on a ~15k shard) whose
  blocking stretch × 3 busts the <600 s cap, do the reviewers want
  that phase chunked with its own progress emissions as part of
  this design (new slice), or is a documented per-deploy
  `NOCTUA_SYNC_WORKER_SILENCE_MS` above the derived default
  acceptable for v1? The design currently treats it as a finding,
  not a knob-turn (§6).

## Methodology

Revision 2 (this update) is documentation-only: the eight Umbau
conditions were folded into §§2–8 against a read-only cross-check
of `origin/integration/stage` @ `11dc3c5` (`git show`, no worktree,
no builds/tests/servers). Cross-checked in particular:
`sync_worker_leases` row shape, `bindWorkerProcess` /
`removeWorker` / `heartbeatWorkers` and `LEASE_MS` in
`lib/db/processLeases.ts`; write-batch and progress sites in
`runSyncOperationBatched` (`lib/syncOperation.ts`, fetch batches of
300 via `syncImapAccountBatched`, sanitize sub-batches of 50);
`getAccountById` in `lib/db/accounts.ts`; `buildImapIdentityKey`
(`[accountId, host, port, secure]`) and `watcherAccountIdentity`
(HMAC over `account.id` + `account.imap`, `IMAP_SECRET_KEY`);
`closeAccountDbConnection` / `ACCOUNT_DB_IDLE_MS` in
`lib/db/connection.ts`; build-hash plumbing (`NOCTUA_BUILD_HASH` →
`NEXT_PUBLIC_BUILD_HASH`, `lib/buildVersion.ts`,
`public/build-version.json`, Dockerfile, CI workflow); systemd
`TimeoutStopSec=10s` / `KillMode=mixed` and preview isolation in
`doc/DEPLOYMENT.md`; `test:ci` / `test:stress` definitions in
`package.json`; `scripts/checkGracefulShutdown.ts` fail criteria.
One Revision 1 figure was corrected on this evidence (batch size
300/50, not 100); all measured performance/shutdown figures are
Revision 1's, unchanged.


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





