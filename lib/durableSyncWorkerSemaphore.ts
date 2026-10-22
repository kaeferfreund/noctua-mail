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

  constructor(readonly capacity: number) {}

  enqueue(id: string, priority: number, start: (release: () => Promise<void>) => void, accountId = id) {
    this.waiting.set(id, { priority, start, accountId });
    void this.pump();
  }
  cancel(id: string) {
    if (!this.waiting.delete(id)) return false;
    void removeWorker(id, this.owner).catch(error => console.error("[sync] cancel admission failed", error));
    return true;
  }
  promote(id: string, priority: number) {
    const entry = this.waiting.get(id);
    if (entry) entry.priority = Math.min(entry.priority, priority);
  }
  spawn<T extends { pid: number; kill: (signal: string) => void; exited: Promise<number> }>(id: string, spawn: () => T) {
    return spawnLeasedWorker(id, this.owner, spawn);
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    if (this.timer) clearTimeout(this.timer);
    try {
      if (Date.now() >= this.heartbeatAt) {
        await heartbeatWorkers(this.owner);
        this.heartbeatAt = Date.now() + LEASE_MS / 3;
      }
      for (const [id, entry] of this.waiting) {
        await queueWorker(id, this.owner, entry.priority, entry.accountId);
        await promoteWorker(id, this.owner, entry.priority);
        if (!this.waiting.has(id)) { await removeWorker(id, this.owner); continue; }
        if (!await reserveWorker(id, this.owner, this.capacity)) continue;
        if (!this.waiting.delete(id)) { await removeWorker(id, this.owner); continue; }
        this.active.add(id);
        let released = false;
        const release = async () => {
          if (released) return;
          // The monitor calls release only after child.exited resolves (or before spawn).
          await removeWorker(id, this.owner, true);
          released = true;
          this.active.delete(id);
          void this.pump();
        };
        entry.start(release);
      }
    } catch (error) {
      console.error("[sync] worker admission failed; retaining leases and retrying", error);
    } finally {
      this.pumping = false;
      if (this.waiting.size || this.active.size) {
        this.timer = setTimeout(() => { void this.pump(); }, 25);
        this.timer.unref?.();
      }
    }
  }
}
