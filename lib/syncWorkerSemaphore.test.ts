import { describe, expect, test } from "bun:test";
import { SyncWorkerSemaphore, positiveInteger, withSyncWorkerTimeout } from "./syncWorkerSemaphore";

describe("sync worker semaphore", () => {
  test("caps active workers and orders interactive, watcher, then full/repair with FIFO ties", () => {
    const queue = new SyncWorkerSemaphore(2);
    const started: string[] = [];
    const releases = new Map<string, () => void>();
    const add = (id: string, priority: number) => queue.enqueue(id, priority, (release) => {
      started.push(id); releases.set(id, release);
    });
    add("active-a", 2); add("active-b", 2);
    add("repair", 2); add("watcher-a", 1); add("interactive", 0); add("watcher-b", 1);
    expect(started).toEqual(["active-a", "active-b"]);
    releases.get("active-a")!();
    expect(started.at(-1)).toBe("interactive");
    releases.get("active-a")!(); // Releasing twice must not manufacture a slot.
    expect(started).toHaveLength(3);
    releases.get("active-b")!();
    expect(started.at(-1)).toBe("watcher-a");
    releases.get("interactive")!();
    expect(started.at(-1)).toBe("watcher-b");
    releases.get("watcher-a")!();
    expect(started.at(-1)).toBe("repair");
    releases.get("watcher-b")!(); releases.get("repair")!();
  });

  test("allows promotion and cancellation of waiting work", () => {
    const queue = new SyncWorkerSemaphore(1);
    let releaseFirst = () => {};
    const started: string[] = [];
    queue.enqueue("first", 0, (release) => { releaseFirst = release; });
    queue.enqueue("cancelled", 0, () => { started.push("cancelled"); });
    queue.enqueue("watcher", 1, (release) => { started.push("watcher"); release(); });
    queue.enqueue("joined", 2, (release) => { started.push("joined"); release(); });
    expect(queue.cancel("cancelled")).toBe(true);
    queue.promote("joined", 0);
    releaseFirst();
    expect(started).toEqual(["joined", "watcher"]);
  });

  test("kills a stuck worker and frees its slot, including stuck output after exit", async () => {
    const queue = new SyncWorkerSemaphore(1);
    let killed = 0;
    let nextStarted = false;
    let monitored: Promise<unknown> = Promise.resolve();
    queue.enqueue("hung-output", 0, (release) => {
      monitored = withSyncWorkerTimeout(new Promise<never>(() => {}), 15, () => { killed += 1; })
        .finally(release);
    });
    queue.enqueue("next", 1, (release) => { nextStarted = true; release(); });
    expect(nextStarted).toBe(false);
    await expect(monitored).rejects.toThrow("timed out");
    expect(killed).toBe(1);
    expect(nextStarted).toBe(true);
  });

  test("clears the deadline after success and validates configuration", async () => {
    let killed = false;
    expect(await withSyncWorkerTimeout(Promise.resolve(42), 10, () => { killed = true; })).toBe(42);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(killed).toBe(false);
    for (const raw of [undefined, "", "0", "-1", "1.5", "NaN", "9007199254740991"]) expect(positiveInteger(raw, 3)).toBe(3);
    expect(positiveInteger("2", 3)).toBe(2);
  });
});
