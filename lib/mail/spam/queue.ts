/**
 * In-process queue for spam checks. IMAP sync never waits for it: jobs run in
 * the background with bounded concurrency, each job is retried at most twice,
 * and a job that still fails is dropped (the message stays unmarked).
 */
export type SpamCheckJob = { accountId: string; messageId: string };

export type SpamQueueOptions = {
  check: (job: SpamCheckJob) => Promise<void>;
  onFailure: (job: SpamCheckJob, error: unknown) => void;
  concurrency?: number;
  /** One entry per retry; the default allows two retries. */
  retryDelaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
};

export const SPAM_QUEUE_CONCURRENCY = 2;
export const SPAM_RETRY_DELAYS_MS = [5_000, 30_000];

const jobKey = (job: SpamCheckJob) => `${job.accountId}\u0000${job.messageId}`;

export function createSpamQueue(options: SpamQueueOptions) {
  const concurrency = Math.max(1, options.concurrency ?? SPAM_QUEUE_CONCURRENCY);
  const delays = options.retryDelaysMs ?? SPAM_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const pending: SpamCheckJob[] = [];
  const known = new Set<string>();
  let active = 0;
  let idleWaiters: Array<() => void> = [];

  async function run(job: SpamCheckJob) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await options.check(job);
        return;
      } catch (error) {
        if (attempt >= delays.length) {
          options.onFailure(job, error);
          return;
        }
        await sleep(delays[attempt]);
      }
    }
  }

  function pump() {
    while (active < concurrency && pending.length) {
      const job = pending.shift()!;
      active += 1;
      void run(job).finally(() => {
        active -= 1;
        known.delete(jobKey(job));
        pump();
      });
    }
    if (active === 0 && !pending.length) {
      const waiters = idleWaiters;
      idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  }

  return {
    /** Jobs already queued or running are ignored. */
    enqueue(jobs: SpamCheckJob[]) {
      for (const job of jobs) {
        const key = jobKey(job);
        if (known.has(key)) continue;
        known.add(key);
        pending.push(job);
      }
      pump();
    },
    has(job: SpamCheckJob) {
      return known.has(jobKey(job));
    },
    onIdle() {
      return active === 0 && !pending.length ? Promise.resolve() : new Promise<void>((resolve) => idleWaiters.push(resolve));
    }
  };
}

/**
 * Remembers claimed messages per process so later sweeps do not retry a
 * dropped or undecided one within `ttlMs`.
 */
export function createSpamClaims(ttlMs: number, maxEntries: number, now: () => number = Date.now) {
  const until = new Map<string, number>();
  return {
    isClaimed(job: SpamCheckJob) {
      const expiry = until.get(jobKey(job));
      return expiry !== undefined && expiry > now();
    },
    claim(job: SpamCheckJob) {
      const time = now();
      if (until.size >= maxEntries) {
        for (const [entry, expiry] of until) if (expiry <= time || until.size >= maxEntries) until.delete(entry);
      }
      until.set(jobKey(job), time + ttlMs);
    }
  };
}

/**
 * Picks at most `limit` ids (in the given order) that are neither queued nor
 * claimed, and claims only those: ids beyond the limit stay unclaimed for the
 * next sweep.
 */
export function pickSweepJobs(accountId: string, ids: string[], queue: { has: (job: SpamCheckJob) => boolean },
  claims: ReturnType<typeof createSpamClaims>, limit: number) {
  const jobs = ids.map((messageId) => ({ accountId, messageId }))
    .filter((job) => !queue.has(job) && !claims.isClaimed(job)).slice(0, limit);
  jobs.forEach((job) => claims.claim(job));
  return jobs;
}

export const SPAM_LOG_WINDOW_MS = 10 * 60_000;

/** Logs a failure at most once per account per window (default 10 minutes). */
export function createSpamFailureLogger(log: (message: string, details: Record<string, unknown>) => void = console.warn,
  windowMs = SPAM_LOG_WINDOW_MS, now: () => number = Date.now) {
  const lastLogged = new Map<string, number>();
  return (accountId: string, message: string, details: Record<string, unknown> = {}) => {
    const last = lastLogged.get(accountId);
    if (last !== undefined && now() - last < windowMs) return false;
    lastLogged.set(accountId, now());
    log(`[spam] ${message}`, { accountId, ...details });
    return true;
  };
}
