import {
  claimDueScheduledSends,
  failInterruptedScheduledSends,
  processScheduleOwner,
  pruneScheduledSends,
  settleScheduledSend,
  type ScheduledSend
} from "./db/scheduledSends";
import { attemptScheduledSend, defaultScheduledSendDeps, type ScheduledSendDeps } from "./scheduledSend";
import { isShuttingDown, onShutdown } from "./server/shutdown";

/** Poll period; a due row is sent at most this long after its time (requirement ≤ 30 s). */
export const SCHEDULED_SEND_TICK_MS = 15_000;
const CLAIM_BATCH = 5;
const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60_000;

/**
 * Single in-process scheduler. Exactly-once per row comes from the durable claim
 * (`queued` → `sending` under BEGIN IMMEDIATE, owner and lease start recorded) — not from
 * the timer — so a second process sharing the master DB can never send a claimed row again.
 * Leases of dead processes or older than SCHEDULED_SEND_LEASE_MAX_MS become failed/interrupted.
 */
export class ScheduledSendScheduler {
  /** The process owner; manual holds of this process (`owner/manual:…`) count as alive too. */
  readonly owner = processScheduleOwner();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private stopped = false;

  constructor(private readonly deps: ScheduledSendDeps = defaultScheduledSendDeps) {}

  start() {
    this.stopped = false;
    // Resume immediately: rows that became due while the server was down are sent now.
    void this.tick();
    return this;
  }

  /** One pass: fail interrupted claims of dead processes, then send every due row. */
  tick(): Promise<void> {
    if (this.running) return this.running;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.running = this.pass()
      .catch(error => { console.error("[scheduled-send] pass failed; retrying on the next tick", { error: error instanceof Error ? error.name : typeof error }); })
      .finally(() => {
        this.running = null;
        if (!this.stopped) this.timer = setTimeout(() => { void this.tick(); }, SCHEDULED_SEND_TICK_MS);
      });
    return this.running;
  }

  private async pass() {
    const now = this.deps.now();
    const interrupted = await failInterruptedScheduledSends(undefined, now);
    if (interrupted) console.warn("[scheduled-send] interrupted sends marked failed", { count: interrupted });
    await pruneScheduledSends(now - HISTORY_RETENTION_MS);
    while (!this.stopped && !isShuttingDown()) {
      const claimed = await claimDueScheduledSends(this.owner, this.deps.now(), CLAIM_BATCH);
      if (!claimed.length) break;
      for (const row of claimed) await this.run(row);
    }
  }

  private async run(row: ScheduledSend) {
    const outcome = await attemptScheduledSend(row, this.deps);
    const settled = await settleScheduledSend(row.id, this.owner, outcome, this.deps.now());
    console.info("[scheduled-send] attempt settled", {
      scheduleId: row.id, accountId: row.accountId, userId: row.userId, attempt: row.attempts,
      status: outcome.status, reason: outcome.reason, settled
    });
  }

  async stop() {
    this.stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    await this.running;
  }
}

const key = Symbol.for("noctua.scheduledSendScheduler");
const host = globalThis as typeof globalThis & { [key]?: ScheduledSendScheduler };

/** Started once per server process from instrumentation.ts. */
export function startScheduledSendScheduler() {
  if (host[key]) return host[key];
  const scheduler = host[key] = new ScheduledSendScheduler().start();
  onShutdown("scheduled-send", "drain", () => scheduler.stop());
  return scheduler;
}
