import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cancelWatcherSyncJobs, getSyncJob, startSyncJob } from "./syncJobs";
import { dbModulePromise } from "./testDbHarness";
await dbModulePromise;
import type { SyncPayload } from "./syncOperation";

type SpawnedWorker = {
  payload: SyncPayload & { clientId?: string };
  exit: (code?: number) => void;
  exited: boolean;
};

type BunGlobal = typeof globalThis & { Bun: { spawn: unknown } };

const spawned: SpawnedWorker[] = [];
let nextWorkerToFinish = 0;
let originalSpawn: unknown;
let accountSeq = 0;

// The job registry is module-level and survives across tests, so every test
// needs an account of its own — `bun test --rerun-each` replays the same file.
const nextAccountId = (label: string) => {
  accountSeq += 1;
  return `acc-${label}-${accountSeq}`;
};

// `spawnSyncWorker` reads `globalThis.Bun.spawn` at call time, so swapping it
// out is enough to run the queue without launching real sync workers.
const installFakeSpawn = () => {
  const bun = globalThis as BunGlobal;
  originalSpawn = bun.Bun.spawn;
  bun.Bun.spawn = (args: string[]) => {
    let resolveExit: (code: number) => void = () => {};
    const exited = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });
    const worker: SpawnedWorker = {
      payload: JSON.parse(args[3]),
      exit: (code = 0) => {
        if (worker.exited) return;
        worker.exited = true;
        resolveExit(code);
      },
      exited: false
    };
    spawned.push(worker);
    return {
      // The liveness probe in startSyncJob signals pid 0 at this process, which
      // always succeeds — a synthetic pid would read as a dead worker.
      pid: process.pid,
      stdout: null,
      stderr: null,
      exited,
      kill: () => {}
    };
  };
};

const flush = async () => {
  for (let i = 0; i < 20; i += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
};

/** Exit the oldest still-running worker and let the monitor promote the queue. */
const finishNextWorker = async () => {
  await flush();
  const worker = spawned[nextWorkerToFinish];
  if (!worker) throw new Error("No spawned worker left to finish.");
  nextWorkerToFinish += 1;
  worker.exit(0);
  await flush();
};

beforeEach(() => {
  spawned.length = 0;
  nextWorkerToFinish = 0;
  installFakeSpawn();
});

afterEach(async () => {
  // Leaving a worker unfinished would strand its 10-minute timeout timer, and
  // exiting one promotes the next — so drain until the queue stops producing.
  await flush();
  while (spawned.some((worker) => !worker.exited)) {
    spawned.forEach((worker) => worker.exit(0));
    await flush();
  }
  (globalThis as BunGlobal).Bun.spawn = originalSpawn;
});

describe("sync job queue", () => {
  test("queues folder syncs independently instead of collapsing them", async () => {
    const accountId = nextAccountId("queue-independent");
    const running = startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" });
    const queuedArchive = startSyncJob({
      accountId,
      folderId: `${accountId}:Archive`,
      mode: "new"
    });
    const queuedSent = startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });

    await flush();
    expect(running.status).toBe("running");
    expect(queuedArchive.status).toBe("queued");
    expect(queuedSent.status).toBe("queued");
    expect(queuedArchive.id).not.toBe(queuedSent.id);
    expect(queuedArchive.payload.folderId).toBe(`${accountId}:Archive`);
    expect(queuedSent.payload.folderId).toBe(`${accountId}:Sent`);

    await finishNextWorker();
    expect(spawned).toHaveLength(2);
    expect(spawned[1].payload.folderId).toBe(`${accountId}:Archive`);

    await finishNextWorker();
    expect(spawned).toHaveLength(3);
    expect(spawned[2].payload.folderId).toBe(`${accountId}:Sent`);
  });

  test("joins the running job only while nothing is queued behind it", () => {
    const accountId = nextAccountId("queue-join");
    const folderId = `${accountId}:INBOX`;
    const running = startSyncJob({ accountId, folderId, mode: "new" });

    expect(startSyncJob({ accountId, folderId, mode: "new" }).id).toBe(running.id);

    startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });
    const afterQueueing = startSyncJob({ accountId, folderId, mode: "new" });

    expect(afterQueueing.id).not.toBe(running.id);
    expect(afterQueueing.status).toBe("queued");
    expect(afterQueueing.payload.folderId).toBe(folderId);
  });

  test("returns the existing queued job for a repeated request", () => {
    const accountId = nextAccountId("queue-dedup");
    startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" });
    const first = startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });
    const second = startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });

    expect(second.id).toBe(first.id);
  });

  test("lets a new-mail sync overtake a queued full sweep", async () => {
    const accountId = nextAccountId("queue-priority");
    startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" });
    const sweep = startSyncJob({ accountId, folderId: `${accountId}:Archive`, mode: "full" });
    const urgent = startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });

    await finishNextWorker();

    expect(spawned[1].payload.folderId).toBe(`${accountId}:Sent`);
    expect(getSyncJob(urgent.id)?.status).toBe("running");
    expect(getSyncJob(sweep.id)?.status).toBe("queued");
  });

  test("retains account serialization until the monitor confirms worker exit", async () => {
    const accountId = nextAccountId("queue-dead-worker");
    const running = startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" });
    const queued = startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });
    expect(queued.status).toBe("queued");

    await flush();
    // Worker vanished without the monitor noticing — no pid this high can exist.
    running.pid = 2 ** 30;
    const follow = startSyncJob({ accountId, folderId: `${accountId}:Archive`, mode: "new" });

    expect(getSyncJob(running.id)?.status).toBe("failed");
    expect(getSyncJob(queued.id)?.status).toBe("queued");
    expect(follow.status).toBe("queued");
    await finishNextWorker();
    expect(getSyncJob(queued.id)?.status).toBe("running");
  });

  test("carries the latest client id into the promoted job", async () => {
    const accountId = nextAccountId("queue-client");
    startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" }, "client-a");
    startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" }, "client-b");
    startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" }, "client-c");

    await finishNextWorker();

    expect(spawned[1].payload.clientId).toBe("client-c");
  });
});


describe("global sync worker budget", () => {
  test("exposes globally queued jobs and prioritizes interactive over watcher over sweeps", async () => {
    for (let i = 0; i < 2; i += 1) startSyncJob({ accountId: nextAccountId("busy"), mode: "new" });
    const sweep = startSyncJob({ accountId: nextAccountId("sweep"), mode: "full" });
    const watcher = startSyncJob({ accountId: nextAccountId("watcher"), mode: "new" }, undefined, "watcher");
    const interactive = startSyncJob({ accountId: nextAccountId("interactive"), mode: "new" });
    await flush();
    expect(spawned).toHaveLength(2);
    expect(getSyncJob(interactive.id)?.status).toBe("queued");
    expect(getSyncJob(interactive.id)?.pid).toBeUndefined();
    await finishNextWorker();
    expect(interactive.status).toBe("running");
    expect(watcher.status).toBe("queued");
    await finishNextWorker();
    expect(watcher.status).toBe("running");
    expect(sweep.status).toBe("queued");
    await finishNextWorker();
    expect(sweep.status).toBe("running");
  });

  test("an account's globally queued sweep does not hide interactive work", async () => {
    for (let i = 0; i < 2; i += 1) startSyncJob({ accountId: nextAccountId("busy-head"), mode: "new" });
    const id = nextAccountId("queued-head");
    const sweep = startSyncJob({ accountId: id, folderId: `${id}:Archive`, mode: "full" });
    const interactive = startSyncJob({ accountId: id, folderId: `${id}:INBOX`, mode: "new" });
    await finishNextWorker();
    expect(interactive.status).toBe("running");
    expect(sweep.status).toBe("queued");
    expect(spawned[2].payload.folderId).toBe(`${id}:INBOX`);
  });

  test("cancels watcher work on removal without cancelling an interactive join", async () => {
    for (let i = 0; i < 2; i += 1) startSyncJob({ accountId: nextAccountId("busy-cancel"), mode: "new" });
    const id = nextAccountId("cancelled");
    const cancelled = startSyncJob({ accountId: id, mode: "new" }, undefined, "watcher");
    cancelWatcherSyncJobs(id);
    expect(cancelled.status).toBe("failed");
    const joinedId = nextAccountId("joined-watcher");
    const joined = startSyncJob({ accountId: joinedId, mode: "new" }, undefined, "watcher");
    expect(startSyncJob({ accountId: joinedId, mode: "new" }).id).toBe(joined.id);
    cancelWatcherSyncJobs(joinedId);
    expect(joined.status).toBe("queued");
    await finishNextWorker();
    expect(joined.status).toBe("running");
  });
});


test("a failed watcher worker cancels queued background logins for that account", async () => {
  const id = nextAccountId("watcher-failure");
  const first = startSyncJob({ accountId: id, folderId: `${id}:INBOX`, mode: "new" }, undefined, "watcher");
  const next = startSyncJob({ accountId: id, folderId: `${id}:Sent`, mode: "new" }, undefined, "watcher");
  const last = startSyncJob({ accountId: id, folderId: `${id}:Archive`, mode: "new" }, undefined, "watcher");
  await flush();
  spawned[0].exit(1);
  await flush();
  expect(first.status).toBe("failed");
  expect(next.status).toBe("failed");
  expect(last.status).toBe("failed");
  expect(spawned).toHaveLength(1);
});

test("same-account watcher cannot starve behind sustained interactive arrivals", async () => {
  const accountId = nextAccountId("bounded-aging");
  startSyncJob({ accountId, folderId: `${accountId}:initial`, mode: "new" });
  await flush();
  const watcher = startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "repair" }, undefined, "watcher");
  let bypasses = 0;
  while (watcher.status === "queued" && bypasses < 10) {
    startSyncJob({ accountId, folderId: `${accountId}:interactive-${bypasses}`, mode: "new" });
    await finishNextWorker();
    bypasses++;
  }
  expect(watcher.status).toBe("running");
  expect(bypasses).toBeLessThanOrEqual(9);
});
