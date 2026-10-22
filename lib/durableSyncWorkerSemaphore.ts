import {
  heartbeatWorkers, LEASE_MS, newLeaseOwner, promoteWorker, queueWorker,
  removeWorker, reserveWorker, spawnLeasedWorker
} from "./db/processLeases";

/** The master DB is authoritative, including between independent Next module graphs. */
export class DurableSyncWorkerSemaphore {
  readonly owner = newLeaseOwner();
  private waiting = new Map<string, { priority: number; accountId: string; start: (release: () => Promise<void>) => void }>();
  private active = new Set<string>();
  private pumping = false;
  private timer?: ReturnType<typeof setTimeout>;
  private heartbeatAt = 0;
  private retryDelay = 25;
  // Keep cleanup intent until the DB confirms deletion, including after the
  // bounded SQLite write retries exhaust. Neither cancellation nor child exit
  // is permission to bypass a still-persisted queue head or occupied slot.
  private cleanup = new Map<string, { confirmedExit: boolean; done: () => void; promise: Promise<void> }>();

  constructor(readonly capacity: number) {}

  enqueue(id: string, priority: number, start: (release: () => Promise<void>) => void, accountId = id) {
    this.waiting.set(id, { priority, start, accountId });
    void this.pump();
  }
  cancel(id: string) {
    if (!this.waiting.delete(id)) return false;
    void this.requestCleanup(id, false);
    return true;
  }
  promote(id: string, priority: number) {
    const entry = this.waiting.get(id);
    if (entry) entry.priority = Math.min(entry.priority, priority);
  }
  spawn<T extends { pid: number; kill: (signal: NodeJS.Signals) => void; exited: Promise<number> }>(id: string, spawn: () => T) {
    return spawnLeasedWorker(id, this.owner, spawn);
  }

  private requestCleanup(id: string, confirmedExit: boolean) {
    let pending = this.cleanup.get(id);
    if (!pending) {
      let done!: () => void;
      const promise = new Promise<void>(resolve => { done = resolve; });
      pending = { confirmedExit, done, promise };
      this.cleanup.set(id, pending);
    } else pending.confirmedExit ||= confirmedExit;
    void this.pump();
    return pending.promise;
  }

  private async reconcileCleanup() {
    for (const [id, pending] of this.cleanup) {
      await removeWorker(id, this.owner, pending.confirmedExit);
      this.cleanup.delete(id);
      this.active.delete(id);
      pending.done();
    }
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    if (this.timer) clearTimeout(this.timer);
    try {
      // Reconcile before every heartbeat/admission attempt, even with no waiters.
      await this.reconcileCleanup();
      if (Date.now() >= this.heartbeatAt) {
        await heartbeatWorkers(this.owner);
        this.heartbeatAt = Date.now() + LEASE_MS / 3;
      }
      for (const [id, entry] of this.waiting) {
        await queueWorker(id, this.owner, entry.priority, entry.accountId);
        await promoteWorker(id, this.owner, entry.priority);
        if (!this.waiting.has(id)) { void this.requestCleanup(id, false); continue; }
        // A monitor may have confirmed exit while queue/promote awaited SQLite.
        // Reconcile that release before deciding whether capacity is available.
        await this.reconcileCleanup();
        if (!await reserveWorker(id, this.owner, this.capacity)) continue;
        if (!this.waiting.delete(id)) { void this.requestCleanup(id, false); continue; }
        this.active.add(id);
        let releasing: Promise<void> | undefined;
        // The monitor calls release only after child.exited resolves (or before spawn).
        const release = () => releasing ??= this.requestCleanup(id, true);
        entry.start(release);
      }
      await this.reconcileCleanup();
      this.retryDelay = 25;
    } catch (error) {
      console.error("[sync] worker admission failed; retaining leases and retrying", error);
      this.retryDelay = Math.min(2000, this.retryDelay * 2);
    } finally {
      this.pumping = false;
      if (this.waiting.size || this.active.size || this.cleanup.size) {
        this.timer = setTimeout(() => { void this.pump(); }, this.retryDelay);
        this.timer.unref?.();
      }
    }
  }
}
