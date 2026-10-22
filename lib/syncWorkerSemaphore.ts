/** Process-wide worker budget. Lower numbers run first; equal priorities are FIFO. */
export class SyncWorkerSemaphore {
  private active = 0;
  private queue: Array<{ id: string; priority: number; start: (release: () => void) => void }> = [];

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error("Worker capacity must be positive.");
  }

  enqueue(id: string, priority: number, start: (release: () => void) => void) {
    this.queue.push({ id, priority, start });
    this.drain();
  }

  cancel(id: string) {
    const index = this.queue.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    this.queue.splice(index, 1);
    return true;
  }

  promote(id: string, priority: number) {
    const entry = this.queue.find((item) => item.id === id);
    if (entry) entry.priority = Math.min(entry.priority, priority);
  }

  private drain() {
    while (this.active < this.capacity && this.queue.length) {
      this.queue.sort((a, b) => a.priority - b.priority);
      const entry = this.queue.shift()!;
      this.active += 1;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this.active -= 1;
        this.drain();
      };
      try { entry.start(release); } catch (error) { release(); throw error; }
    }
  }
}

export function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 2_147_483_647 ? parsed : fallback;
}

/** Includes output draining in the deadline, even if the child has already exited. */
export async function withSyncWorkerTimeout<T>(
  work: Promise<T>, timeoutMs: number, kill: () => void
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          try { kill(); } catch { /* process already gone */ } finally {
            reject(new Error(`Sync worker timed out after ${timeoutMs / 1000}s and was killed.`));
          }
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
