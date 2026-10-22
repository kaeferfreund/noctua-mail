import { UnconfirmedWorkerExitError } from "./db/processLeases";
import { DurableSyncWorkerSemaphore } from "./durableSyncWorkerSemaphore";
import { randomUUID } from "crypto";
import { positiveInteger, withSyncWorkerTimeout, drainSyncWorkerOutput } from "./syncWorkerSemaphore";
import { parseSyncWorkerLine } from "@/lib/workers/syncProtocol";
import { workerScriptPaths } from "@/lib/workers/entrypoints";
import type {
  SyncMode,
  SyncOperationProgress,
  SyncOperationResult,
  SyncPayload
} from "@/lib/syncOperation";

type SyncJobStatus = "queued" | "running" | "done" | "failed";

export type SyncJob = {
  id: string;
  payload: SyncPayload;
  status: SyncJobStatus;
  startedAt: number;
  queuedAt?: number;
  finishedAt?: number;
  error?: string;
  pid?: number;
  result?: SyncOperationResult;
  progress?: SyncOperationProgress;
  source?: SyncJobSource;
};

export type SyncJobSource = "interactive" | "watcher" | "background";

const admissionBypasses = new WeakMap<SyncJob, number>();
function jobPriority(job: SyncJob) {
  if ((admissionBypasses.get(job) ?? 0) >= 8) return -1;
  if (job.source === "watcher") return 1;
  return job.source === "background" || ["repair", "full"].includes(getSyncMode(job.payload)) ? 2 : 0;
}

type QueuedSyncEntry = {
  jobId: string;
  clientId?: string;
};

type AccountSyncState = {
  runningJobId: string;
  queue: QueuedSyncEntry[];
};

type SyncJobsRuntimeState = {
  jobs: Map<string, SyncJob>;
  accountStates: Map<string, AccountSyncState>;
};

const runtimeState = (
  globalThis as typeof globalThis & {
    __noctuaSyncJobsState?: SyncJobsRuntimeState;
    __noctuaSyncJobsBootstrapped?: boolean;
    __noctuaSyncWorkerSemaphore?: DurableSyncWorkerSemaphore;
  }
);
if (!runtimeState.__noctuaSyncJobsState) {
  runtimeState.__noctuaSyncJobsState = {
    jobs: new Map<string, SyncJob>(),
    accountStates: new Map<string, AccountSyncState>()
  };
}

const jobs = runtimeState.__noctuaSyncJobsState.jobs;
const accountStates = runtimeState.__noctuaSyncJobsState.accountStates;

if (!runtimeState.__noctuaSyncJobsBootstrapped) {
  runtimeState.__noctuaSyncJobsBootstrapped = true;
  const staleJobs = jobs.size;
  const staleAccountStates = accountStates.size;
  jobs.clear();
  accountStates.clear();
  if (staleJobs > 0 || staleAccountStates > 0) {
    console.info(
      `[sync] cleared stale runtime job state on startup ${JSON.stringify({
        staleJobs,
        staleAccountStates
      })}`
    );
  }
}

const workerKills = new Map<string, () => void>();
const workerCompletions = new Map<string, Promise<void>>();
const jobClientIds = new WeakMap<SyncJob, string | undefined>();

/** Stop only background jobs owned by the watcher; interactive joins are retained. */
export function cancelWatcherSyncJobs(accountId: string) {
  const state = accountStates.get(accountId);
  if (!state) return Promise.resolve();
  const pending: Promise<void>[] = [];
  state.queue = state.queue.filter((entry) => jobs.get(entry.jobId)?.source !== "watcher");
  for (const job of jobs.values()) {
    if (job.payload.accountId !== accountId || job.source !== "watcher" ||
        (job.status !== "running" && job.status !== "queued")) continue;
    const queued = workerSemaphore.cancel(job.id);
    workerKills.get(job.id)?.();
    const completion = workerCompletions.get(job.id);
    if (completion) pending.push(completion);
    markJobFailed(job, "Mailbox watcher stopped.");
    scheduleCleanup(job.id);
    if (queued) handleCompletedRunningJob(job);
  }
  return Promise.all(pending).then(() => {});
}

/** A globally waiting account head must not hide an interactive request behind a sweep. */
function rescheduleQueuedHead(state: AccountSyncState) {
  const head = jobs.get(state.runningJobId);
  const next = state.queue[0];
  const nextJob = next && jobs.get(next.jobId);
  if (!head || head.status !== "queued" || !nextJob || jobPriority(head) <= jobPriority(nextJob)) return;
  if (!workerSemaphore.cancel(head.id)) return;
  state.queue.shift();
  insertQueuedEntry(state.queue, { jobId: head.id, clientId: jobClientIds.get(head) });
  state.runningJobId = nextJob.id;
  spawnSyncWorker(nextJob, next.clientId);
}

const JOB_TTL_MS = 1000 * 60 * 30;
const SYNC_WORKER_TIMEOUT_MS = positiveInteger(process.env.NOCTUA_SYNC_WORKER_TIMEOUT_MS, 600_000);
const workerSemaphore = runtimeState.__noctuaSyncWorkerSemaphore ??= new DurableSyncWorkerSemaphore(
  positiveInteger(process.env.NOCTUA_MAX_SYNC_WORKERS, 2)
);

const MODE_PRIORITY: Record<SyncMode, number> = {
  new: 1,
  recent: 2,
  repair: 3,
  full: 4
};

// Backstop against a client looping on /sync; an account-wide sweep only ever
// enqueues one folder at a time, so real traffic stays far below this.
const MAX_QUEUED_SYNC_JOBS = 64;

const scheduleCleanup = (jobId: string) => {
  const timer = setTimeout(() => { jobs.delete(jobId); }, JOB_TTL_MS);
  timer.unref?.();
};

function getSyncMode(payload: SyncPayload): SyncMode {
  return payload.mode ?? (payload.fullSync ? "full" : "recent");
}

function normalizeSyncPayload(payload: SyncPayload): SyncPayload {
  const mode = getSyncMode(payload);
  const recategorizeFolder =
    Boolean(payload.recategorizeFolder) && typeof payload.folderId === "string" && payload.folderId.length > 0;
  const backfillUids = Array.isArray(payload.backfillUids)
    ? Array.from(new Set(payload.backfillUids.filter((uid) => Number.isFinite(uid) && uid > 0))).sort((a, b) => a - b)
    : undefined;
  return {
    accountId: payload.accountId,
    folderId: payload.folderId,
    mode,
    fullSync: mode === "full",
    recategorizeFolder,
    backfillUids
  };
}

function isSameSyncIntent(a: SyncPayload, b: SyncPayload) {
  const left = normalizeSyncPayload(a);
  const right = normalizeSyncPayload(b);
  const leftBackfill = (left.backfillUids ?? []).join(",");
  const rightBackfill = (right.backfillUids ?? []).join(",");
  return (
    left.accountId === right.accountId &&
    (left.folderId ?? "") === (right.folderId ?? "") &&
    left.mode === right.mode &&
    Boolean(left.recategorizeFolder) === Boolean(right.recategorizeFolder) &&
    leftBackfill === rightBackfill
  );
}

/**
 * Last-resort queue-overflow merge. Lossy on purpose: two different-folder
 * syncs collapse to a folderless payload, which `runSyncOperationBatched`
 * resolves to INBOX for every mode but `full` — so the other folder is skipped.
 * Only reachable once the queue is saturated.
 */
function coalesceSyncPayload(existing: SyncPayload, incoming: SyncPayload): SyncPayload {
  const normalizedExisting = normalizeSyncPayload(existing);
  const normalizedIncoming = normalizeSyncPayload(incoming);
  const existingMode = normalizedExisting.mode ?? "recent";
  const incomingMode = normalizedIncoming.mode ?? "recent";
  const coalescedMode =
    MODE_PRIORITY[incomingMode] >= MODE_PRIORITY[existingMode] ? incomingMode : existingMode;
  const folderId =
    normalizedExisting.folderId &&
    normalizedIncoming.folderId &&
    normalizedExisting.folderId === normalizedIncoming.folderId
      ? normalizedExisting.folderId
      : undefined;
  // Coalescing two different-folder syncs drops the folderId. Repair is the only
  // mode that cannot run folder-agnostically (see runSyncOperationBatched), so a
  // folderless repair would be unrunnable — demote it to a full sync instead.
  const mode = coalescedMode === "repair" && !folderId ? "full" : coalescedMode;
  const backfillUids =
    folderId && mode === "new"
      ? Array.from(
          new Set([
            ...(normalizedExisting.backfillUids ?? []),
            ...(normalizedIncoming.backfillUids ?? [])
          ])
        ).sort((left, right) => left - right)
      : undefined;

  return {
    accountId: normalizedExisting.accountId,
    folderId,
    mode,
    fullSync: mode === "full",
    recategorizeFolder:
      Boolean(normalizedExisting.recategorizeFolder || normalizedIncoming.recategorizeFolder) &&
      Boolean(folderId),
    backfillUids: backfillUids && backfillUids.length > 0 ? backfillUids : undefined
  };
}

function createRunningJob(payload: SyncPayload): SyncJob {
  const mode = getSyncMode(payload);
  return {
    id: randomUUID(),
    payload,
    status: "running",
    startedAt: Date.now(),
    progress: {
      accountId: payload.accountId,
      folderId: payload.folderId,
      mailboxPath: payload.folderId ? payload.folderId.replace(`${payload.accountId}:`, "") : "INBOX",
      mode,
      phase: "starting",
      processed: 0,
      message: "Sync starting.",
      updatedAt: Date.now()
    }
  };
}

function createQueuedJob(payload: SyncPayload): SyncJob {
  const now = Date.now();
  return {
    id: randomUUID(),
    payload,
    status: "queued",
    startedAt: now,
    queuedAt: now
  };
}

function parseSyncResultFromStdout(stdoutText: string): SyncOperationResult | null {
  const trimmed = stdoutText.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as SyncOperationResult;
  } catch {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(lines[i]) as SyncOperationResult;
      } catch {
        // continue scanning older lines
      }
    }
  }
  return null;
}

function calculatePercent(processed: number, estimatedTotal?: number) {
  if (typeof estimatedTotal !== "number" || !Number.isFinite(estimatedTotal)) return undefined;
  if (estimatedTotal <= 0) return 100;
  return Math.min(100, Math.round((Math.max(0, processed) / estimatedTotal) * 1000) / 10);
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "EPERM") return true;
    return false;
  }
}

function buildSyncProgressFromJob(
  job: SyncJob,
  overrides: Partial<SyncOperationProgress>
): SyncOperationProgress {
  const base = job.progress;
  const mode = base?.mode ?? getSyncMode(job.payload);
  const folderId = base?.folderId ?? job.payload.folderId;
  const mailboxPath =
    base?.mailboxPath ??
    (job.payload.folderId
      ? job.payload.folderId.replace(`${job.payload.accountId}:`, "")
      : "INBOX");
  const processed = overrides.processed ?? base?.processed ?? 0;
  const estimatedTotal = overrides.estimatedTotal ?? base?.estimatedTotal;
  const computedPercent =
    overrides.percent !== undefined
      ? overrides.percent
      : calculatePercent(processed, estimatedTotal) ?? base?.percent;

  return {
    accountId: base?.accountId ?? job.payload.accountId,
    folderId,
    mailboxPath,
    mode,
    phase: overrides.phase ?? base?.phase ?? "starting",
    processed,
    batchNumber: overrides.batchNumber ?? base?.batchNumber,
    batchSize: overrides.batchSize ?? base?.batchSize,
    estimatedTotal,
    percent: computedPercent,
    message: overrides.message ?? base?.message,
    updatedAt: overrides.updatedAt ?? Date.now()
  };
}

function markJobFailed(job: SyncJob, error: string) {
  job.status = "failed";
  job.finishedAt = Date.now();
  job.error = error;
  job.progress = buildSyncProgressFromJob(job, {
    phase: "failed",
    message: error,
    updatedAt: Date.now()
  });
}

async function readPipedOutput(
  stream: ReadableStream<Uint8Array> | null | undefined,
  onLine?: (line: string) => void,
  signal?: AbortSignal
) {
  if (!stream) return "";
  const reader = stream.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder();
  let output = "";
  let lineBuffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      output += chunk;
      lineBuffer += chunk;
      let newlineIndex = lineBuffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = lineBuffer.slice(0, newlineIndex).replace(/\r$/, "");
        onLine?.(line);
        lineBuffer = lineBuffer.slice(newlineIndex + 1);
        newlineIndex = lineBuffer.indexOf("\n");
      }
    }
    const tail = decoder.decode();
    if (tail) {
      output += tail;
      lineBuffer += tail;
    }
    if (lineBuffer) {
      onLine?.(lineBuffer.replace(/\r$/, ""));
    }
  } finally {
    try {
      signal?.removeEventListener("abort", cancel);
      reader.releaseLock();
    } catch {
      // ignore release failures
    }
  }
  return output;
}

/** Start the next queued job, or drop the account state when nothing is left. */
function promoteNextQueuedJob(accountId: string, state: AccountSyncState) {
  while (state.queue.length > 0) {
    state.queue.sort((a, b) => (jobs.has(a.jobId) ? jobPriority(jobs.get(a.jobId)!) : 3) - (jobs.has(b.jobId) ? jobPriority(jobs.get(b.jobId)!) : 3));
    const next = state.queue.shift();
    if (!next) break;
    const nextJob = jobs.get(next.jobId);
    // Entries whose job was cleaned up by the TTL timer are stale; keep
    // draining so one expired entry can't strand the rest of the queue.
    if (!nextJob) continue;

    state.runningJobId = nextJob.id;
    for (const pending of state.queue) {
      const waiting = jobs.get(pending.jobId);
      if (waiting) admissionBypasses.set(waiting, (admissionBypasses.get(waiting) ?? 0) + 1);
    }

    nextJob.status = "queued";
    nextJob.startedAt = Date.now();
    nextJob.finishedAt = undefined;
    nextJob.error = undefined;
    nextJob.pid = undefined;
    nextJob.result = undefined;
    nextJob.progress = buildSyncProgressFromJob(nextJob, {
      phase: "starting",
      processed: 0,
      batchNumber: undefined,
      batchSize: undefined,
      estimatedTotal: undefined,
      percent: undefined,
      message: "Sync starting."
    });

    spawnSyncWorker(nextJob, next.clientId);
    return;
  }

  accountStates.delete(accountId);
}

function handleCompletedRunningJob(job: SyncJob) {
  const state = accountStates.get(job.payload.accountId);
  if (!state) return;
  if (state.runningJobId !== job.id) return;
  promoteNextQueuedJob(job.payload.accountId, state);
}

function spawnSyncWorker(job: SyncJob, clientId?: string) {
  jobClientIds.set(job, clientId);
  job.status = "queued";
  job.queuedAt ??= Date.now();
  workerSemaphore.enqueue(job.id, jobPriority(job), (release) => {
    job.status = "running";
    job.startedAt = Date.now();
    const completion = launchSyncWorker(job, release, clientId);
    workerCompletions.set(job.id, completion);
    void completion.finally(() => { workerCompletions.delete(job.id); });
  }, job.payload.accountId);
}

async function launchSyncWorker(job: SyncJob, release: () => Promise<void>, clientId?: string) {
  try {
    const bun = (globalThis as typeof globalThis & { Bun?: any }).Bun;
    if (!bun?.spawn) {
      throw new Error("Bun runtime is required to spawn a sync worker.");
    }
    const childPayload = JSON.stringify({
      ...job.payload,
      clientId
    });
    const child: any = await workerSemaphore.spawn(job.id, () => bun.spawn(
      ["bun", "run", workerScriptPaths.sync, childPayload],
      {
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
        // Watcher retries are controlled once per account by MailboxWatcher.
        env: { ...process.env,
          NOCTUA_SYNC_LEASE_JOB_ID: job.id, NOCTUA_SYNC_LEASE_OWNER: workerSemaphore.owner,
          ...(job.source === "watcher" ? { IMAP_CONNECT_RETRY_COUNT: "0", NOCTUA_SYNC_WORKER_SOURCE: "watcher" } : {})
        }
      }
    ));
    job.pid = child.pid;
    if (job.status === "failed") { try { child.kill("SIGKILL"); } catch { /* monitor still awaits exit */ } }
    workerKills.set(job.id, () => { try { child.kill("SIGKILL"); } catch { /* already dead */ } });
    console.info(
      `[sync] worker started ${JSON.stringify({
        jobId: job.id,
        accountId: job.payload.accountId,
        folderId: job.payload.folderId,
        mode: getSyncMode(job.payload),
        pid: job.pid
      })}`
    );

    const completion = (async () => {
      const outputAbort = new AbortController();
      let exitConfirmed = false;
      let streamedResult: SyncOperationResult | null = null;
      const stdoutTextPromise = readPipedOutput(child.stdout, (line) => {
        if (job.status !== "running") return;
        try {
          const parsed = parseSyncWorkerLine(line);
          if (!parsed) return;
          if (parsed.kind === "progress") {
            job.progress = parsed.progress;
            const percent =
              parsed.progress.percent ??
              calculatePercent(parsed.progress.processed, parsed.progress.estimatedTotal);
            const percentLabel = typeof percent === "number" ? `${percent}%` : "unknown%";
            console.info(`[sync] ${percentLabel} progress on ${JSON.stringify({
              jobId: job.id,
              accountId: parsed.progress.accountId,
              folderId: parsed.progress.folderId,
              mailboxPath: parsed.progress.mailboxPath,
              mode: parsed.progress.mode,
              phase: parsed.progress.phase,
              processed: parsed.progress.processed,
              estimatedTotal: parsed.progress.estimatedTotal,
              percent,
              retryAttempt: parsed.progress.retryAttempt,
              maxRetries: parsed.progress.maxRetries,
              message: parsed.progress.message
            })}`);
            return;
          }
          streamedResult = parsed.result;
        } catch (err) {
          console.error(`[sync] failed to parse worker output: ${err}`);
        }
      }, outputAbort.signal);
      const stderrTextPromise = readPipedOutput(child.stderr, (line) => {
        if (line.trim()) console.error(`[sync-worker] ${line}`);
      }, outputAbort.signal);
      // Install a rejection handler immediately while the exit monitor is pending.
      const output = Promise.all([stdoutTextPromise, stderrTextPromise]);
      void output.catch(() => {});
      try {
        const exitCode = await withSyncWorkerTimeout(
          child.exited as Promise<number>,
          SYNC_WORKER_TIMEOUT_MS,
          () => { try { child.kill("SIGKILL"); } catch { /* already dead */ } }
        );
        exitConfirmed = true;
        const [stdoutText, stderrRaw] = await drainSyncWorkerOutput(output, () => outputAbort.abort());
        if (job.status !== "running") return;
        const stderrText = stderrRaw.trim();
        if (exitCode === 0) {
          job.status = "done";
          job.finishedAt = Date.now();
          job.result = streamedResult ?? parseSyncResultFromStdout(stdoutText) ?? { count: 0 };
          job.progress = buildSyncProgressFromJob(job, {
            phase: "done",
            processed: job.result.count,
            message: "Sync completed.",
            updatedAt: Date.now()
          });
        } else {
          const errorMessage = stderrText || `Sync worker exited with code ${exitCode}`;
          markJobFailed(job, errorMessage);
          console.error(
            `[sync] worker failed ${JSON.stringify({
              jobId: job.id,
              accountId: job.payload.accountId,
              folderId: job.payload.folderId,
              mode: getSyncMode(job.payload),
              exitCode,
              error: errorMessage
            })}`
          );
        }
      } catch (error) {
        workerKills.get(job.id)?.();
        // A timeout rejects only after exit. Monitor failures also wait here;
        // a rejected/unconfirmed exited promise must retain its durable slot.
        try { await child.exited; exitConfirmed = true; } catch { /* retain lease */ }
        outputAbort.abort();
        const errorMessage =
          error instanceof Error ? error.message : "Sync worker monitor failed unexpectedly.";
        markJobFailed(job, errorMessage);
        console.error(
          `[sync] worker monitor failed ${JSON.stringify({
            jobId: job.id,
            accountId: job.payload.accountId,
            folderId: job.payload.folderId,
            mode: getSyncMode(job.payload),
            error: errorMessage
          })}`
        );
      } finally {
        if (job.status === "running") {
          markJobFailed(job, "Sync worker monitor completed while job was still running.");
        }
        // Do not run another queued watcher worker with the same failing credentials/network.
        if (job.status === "failed" && job.source === "watcher") void cancelWatcherSyncJobs(job.payload.accountId);
        if (!exitConfirmed) return;
        workerKills.delete(job.id);
        job.pid = undefined;
        scheduleCleanup(job.id);
        handleCompletedRunningJob(job);
        await release();
      }
    })().catch((error) => {
      console.error("[sync] monitor cleanup failed; lease retained", error);
    });
    await completion;
  } catch (error) {
    workerKills.get(job.id)?.();
    const errorMessage = error instanceof Error ? error.message : "Failed to start sync worker";
    markJobFailed(job, errorMessage);
    console.error(
      `[sync] failed to start worker ${JSON.stringify({
        jobId: job.id,
        accountId: job.payload.accountId,
        folderId: job.payload.folderId,
        mode: getSyncMode(job.payload),
        error: errorMessage
      })}`
    );
    if (error instanceof UnconfirmedWorkerExitError) {
      job.pid = error.pid;
      return;
    }
    workerKills.delete(job.id);
    job.pid = undefined;
    scheduleCleanup(job.id);
    handleCompletedRunningJob(job);
    await release();
  }
}

export function getSyncJob(jobId: string) {
  const job = jobs.get(jobId) ?? null;
  if (!job) return null;
  if (job.status === "running" && typeof job.pid === "number" && !isProcessAlive(job.pid)) {
    markJobFailed(job, "Sync worker process is no longer running.");
    scheduleCleanup(job.id);
  }
  return job;
}

/**
 * Insert before lower source/mode priorities so interactive new/recent work
 * precedes watcher work, which precedes repair/full sweeps. Equal priorities keep FIFO order
 * — an account-wide sweep drives its own folder ordering and must not be
 * reshuffled.
 */
function insertQueuedEntry(
  queue: QueuedSyncEntry[],
  entry: QueuedSyncEntry
) {
  const incomingJob = jobs.get(entry.jobId)!;
  const priority = jobPriority(incomingJob);
  const index = queue.findIndex((queued) => {
    const queuedJob = jobs.get(queued.jobId);
    if (!queuedJob) return false;
    return jobPriority(queuedJob) > priority;
  });
  if (index === -1) {
    queue.push(entry);
    return;
  }
  queue.splice(index, 0, entry);
}

export function startSyncJob(payload: SyncPayload, clientId?: string, source: SyncJobSource = "interactive") {
  const normalizedPayload = normalizeSyncPayload(payload);
  const accountId = normalizedPayload.accountId;
  const existingState = accountStates.get(accountId);

  if (!existingState) {
    const job = createRunningJob(normalizedPayload);
    job.source = source;
    jobs.set(job.id, job);
    accountStates.set(accountId, { runningJobId: job.id, queue: [] });
    spawnSyncWorker(job, clientId);
    return job;
  }

  // A stalled or vanished running job must hand the slot to whatever is queued
  // behind it — dropping the account state instead would leave those jobs
  // "queued" forever with clients polling them until they time out.
  const runningJob = jobs.get(existingState.runningJobId);
  if (!runningJob) {
    promoteNextQueuedJob(accountId, existingState);
    return startSyncJob(normalizedPayload, clientId, source);
  }
  if (runningJob.status !== "running" && runningJob.status !== "queued" && !workerCompletions.has(runningJob.id)) {
    handleCompletedRunningJob(runningJob);
    return startSyncJob(normalizedPayload, clientId, source);
  }
  if (typeof runningJob.pid === "number" && !isProcessAlive(runningJob.pid)) {
    markJobFailed(runningJob, "Sync worker process is no longer running.");
    scheduleCleanup(runningJob.id);
    // The monitor owns promotion and durable release after child.exited.
  }

  // Drop entries whose job the TTL timer already reaped.
  existingState.queue = existingState.queue.filter((entry) => jobs.has(entry.jobId));

  // Joining the in-flight job is only safe while nothing is queued behind it.
  // Once work has piled up the running job is likely past the point where it
  // would have picked this request up, and joining it would silently drop the
  // requested folder instead of syncing it.
  if ((runningJob.status === "running" || runningJob.status === "queued") && existingState.queue.length === 0 && isSameSyncIntent(runningJob.payload, normalizedPayload)) {
    if (source === "interactive" && runningJob.source !== source) {
      runningJob.source = source;
      workerSemaphore.promote(runningJob.id, jobPriority(runningJob));
    }
    return runningJob;
  }

  for (const entry of existingState.queue) {
    const queuedJob = jobs.get(entry.jobId);
    if (!queuedJob || !isSameSyncIntent(queuedJob.payload, normalizedPayload)) continue;
    if (clientId) {
      entry.clientId = clientId;
    }
    if (source === "interactive") {
      queuedJob.source = source;
      existingState.queue.sort((a, b) => (jobs.has(a.jobId) ? jobPriority(jobs.get(a.jobId)!) : 3) - (jobs.has(b.jobId) ? jobPriority(jobs.get(b.jobId)!) : 3));
      rescheduleQueuedHead(existingState);
    }
    return queuedJob;
  }

  const tail = existingState.queue[existingState.queue.length - 1];
  const tailJob = tail ? jobs.get(tail.jobId) : undefined;
  if (tail && tailJob && existingState.queue.length >= MAX_QUEUED_SYNC_JOBS) {
    // Folding into the tail loses the distinct folder scope, so this is a last
    // resort rather than the normal path — see `coalesceSyncPayload`.
    console.warn(
      `[sync] queue full, coalescing request ${JSON.stringify({
        accountId,
        queueLength: existingState.queue.length,
        folderId: normalizedPayload.folderId,
        mode: getSyncMode(normalizedPayload)
      })}`
    );
    tailJob.payload = coalesceSyncPayload(tailJob.payload, normalizedPayload);
    if (clientId) {
      tail.clientId = clientId;
    }
    return tailJob;
  }

  const queuedJob = createQueuedJob(normalizedPayload);
  queuedJob.source = source;
  jobs.set(queuedJob.id, queuedJob);
  insertQueuedEntry(existingState.queue, { jobId: queuedJob.id, clientId });
  rescheduleQueuedHead(existingState);
  return queuedJob;
}
