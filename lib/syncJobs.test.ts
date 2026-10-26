import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { cancelWatcherSyncJobs, getSyncJob, startSyncJob } from "./syncJobs";
import { replacePushNotifier } from "./push/send";
import { dbModulePromise } from "./testDbHarness";
const { saveFoldersForAccount, upsertAccount } = await dbModulePromise;
import { identityTestAccount } from "./testFixtures/senderIdentities";
import type { SyncPayload } from "./syncOperation";

type SpawnedWorker = {
  payload: SyncPayload & { clientId?: string };
  exit: (code?: number) => void;
  exited: boolean;
};

type BunGlobal = { Bun: { spawn: unknown } };

const spawned: SpawnedWorker[] = [];
let nextWorkerToFinish = 0;
let originalSpawn: unknown;
let accountSeq = 0;

// The job registry is module-level and survives across tests, so every test
// needs an account of its own — `bun test --rerun-each` replays the same file.
const nextAccountId = async (label: string) => {
  accountSeq += 1;
  const accountId = `acc-${label}-${accountSeq}`;
  await upsertAccount(identityTestAccount(accountId));
  await saveFoldersForAccount(accountId,
    ["INBOX", "Archive", "Sent", "initial", ...Array.from({ length: 10 }, (_, i) => `interactive-${i}`)]
      .map(name => ({ id: `${accountId}:${name}`, accountId, name, count: 0 })));
  return accountId;
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
    const accountId = await nextAccountId("queue-independent");
    const running = await startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" });
    const queuedArchive = await startSyncJob({
      accountId,
      folderId: `${accountId}:Archive`,
      mode: "new"
    });
    const queuedSent = await startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });

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

  test("joins the running job only while nothing is queued behind it", async () => {
    const accountId = await nextAccountId("queue-join");
    const folderId = `${accountId}:INBOX`;
    const running = await startSyncJob({ accountId, folderId, mode: "new" });

    expect((await startSyncJob({ accountId, folderId, mode: "new" })).id).toBe(running.id);

    await startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });
    const afterQueueing = await startSyncJob({ accountId, folderId, mode: "new" });

    expect(afterQueueing.id).not.toBe(running.id);
    expect(afterQueueing.status).toBe("queued");
    expect(afterQueueing.payload.folderId).toBe(folderId);
  });

  test("returns the existing queued job for a repeated request", async () => {
    const accountId = await nextAccountId("queue-dedup");
    await startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" });
    const first = await startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });
    const second = await startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });

    expect(second.id).toBe(first.id);
  });

  test("lets a new-mail sync overtake a queued full sweep", async () => {
    const accountId = await nextAccountId("queue-priority");
    await startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" });
    const sweep = await startSyncJob({ accountId, folderId: `${accountId}:Archive`, mode: "full" });
    const urgent = await startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });

    await finishNextWorker();

    expect(spawned[1].payload.folderId).toBe(`${accountId}:Sent`);
    expect(getSyncJob(urgent.id)?.status).toBe("running");
    expect(getSyncJob(sweep.id)?.status).toBe("queued");
  });

  test("retains account serialization until the monitor confirms worker exit", async () => {
    const accountId = await nextAccountId("queue-dead-worker");
    const running = await startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" });
    const queued = await startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });
    expect(queued.status).toBe("queued");

    await flush();
    // Worker vanished without the monitor noticing — no pid this high can exist.
    running.pid = 2 ** 30;
    const follow = await startSyncJob({ accountId, folderId: `${accountId}:Archive`, mode: "new" });

    expect(getSyncJob(running.id)?.status).toBe("failed");
    expect(getSyncJob(queued.id)?.status).toBe("queued");
    expect(follow.status).toBe("queued");
    await finishNextWorker();
    expect(getSyncJob(queued.id)?.status).toBe("running");
  });

  test("carries the latest client id into the promoted job", async () => {
    const accountId = await nextAccountId("queue-client");
    await startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" }, "client-a");
    await startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" }, "client-b");
    await startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" }, "client-c");

    await finishNextWorker();

    expect(spawned[1].payload.clientId).toBe("client-c");
  });
});


describe("global sync worker budget", () => {
  test("exposes globally queued jobs and prioritizes interactive over watcher over sweeps", async () => {
    for (let i = 0; i < 2; i += 1) await startSyncJob({ accountId: await nextAccountId("busy"), mode: "new" });
    const sweep = await startSyncJob({ accountId: await nextAccountId("sweep"), mode: "full" });
    const watcher = await startSyncJob({ accountId: await nextAccountId("watcher"), mode: "new" }, undefined, "watcher");
    const interactive = await startSyncJob({ accountId: await nextAccountId("interactive"), mode: "new" });
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
    for (let i = 0; i < 2; i += 1) await startSyncJob({ accountId: await nextAccountId("busy-head"), mode: "new" });
    const id = await nextAccountId("queued-head");
    const sweep = await startSyncJob({ accountId: id, folderId: `${id}:Archive`, mode: "full" });
    const interactive = await startSyncJob({ accountId: id, folderId: `${id}:INBOX`, mode: "new" });
    await finishNextWorker();
    expect(interactive.status).toBe("running");
    expect(sweep.status).toBe("queued");
    expect(spawned[2].payload.folderId).toBe(`${id}:INBOX`);
  });

  test("cancels watcher work on removal without cancelling an interactive join", async () => {
    for (let i = 0; i < 2; i += 1) await startSyncJob({ accountId: await nextAccountId("busy-cancel"), mode: "new" });
    const id = await nextAccountId("cancelled");
    const cancelled = await startSyncJob({ accountId: id, mode: "new" }, undefined, "watcher");
    cancelWatcherSyncJobs(id);
    expect(cancelled.status).toBe("failed");
    const joinedId = await nextAccountId("joined-watcher");
    const joined = await startSyncJob({ accountId: joinedId, mode: "new" }, undefined, "watcher");
    expect((await startSyncJob({ accountId: joinedId, mode: "new" })).id).toBe(joined.id);
    cancelWatcherSyncJobs(joinedId);
    expect(joined.status).toBe("queued");
    await finishNextWorker();
    expect(joined.status).toBe("running");
  });
});


test("a failed watcher worker cancels queued background logins for that account", async () => {
  const id = await nextAccountId("watcher-failure");
  const first = await startSyncJob({ accountId: id, folderId: `${id}:INBOX`, mode: "new" }, undefined, "watcher");
  const next = await startSyncJob({ accountId: id, folderId: `${id}:Sent`, mode: "new" }, undefined, "watcher");
  const last = await startSyncJob({ accountId: id, folderId: `${id}:Archive`, mode: "new" }, undefined, "watcher");
  await flush();
  spawned[0].exit(1);
  await flush();
  expect(first.status).toBe("failed");
  expect(next.status).toBe("failed");
  expect(last.status).toBe("failed");
  expect(spawned).toHaveLength(1);
});

test("same-account watcher cannot starve behind sustained interactive arrivals", async () => {
  const accountId = await nextAccountId("bounded-aging");
  await startSyncJob({ accountId, folderId: `${accountId}:initial`, mode: "new" });
  await flush();
  const watcher = await startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "repair" }, undefined, "watcher");
  let bypasses = 0;
  while (watcher.status === "queued" && bypasses < 10) {
    await startSyncJob({ accountId, folderId: `${accountId}:interactive-${bypasses}`, mode: "new" });
    await finishNextWorker();
    bypasses++;
  }
  expect(watcher.status).toBe("running");
  expect(bypasses).toBeLessThanOrEqual(9);
});


test("rejects a foreign or unknown folder before spawning or joining the account queue", async () => {
  const accountId = await nextAccountId("folder-guard");
  for (const folderId of ["synthetic-other:INBOX", `${accountId}:missing`]) {
    await expect(startSyncJob({ accountId, folderId, mode: "full" })).rejects.toMatchObject({
      code: "folder_account_mismatch"
    });
  }
  await flush();
  expect(spawned).toHaveLength(0);
  const valid = await startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" });
  await expect(startSyncJob({ accountId, folderId: "synthetic-other:INBOX", mode: "full" }))
    .rejects.toMatchObject({ code: "folder_account_mismatch" });
  await flush();
  expect(spawned).toHaveLength(1);
  expect(valid.payload.folderId).toBe(`${accountId}:INBOX`);
});


test("watcher cancellation during folder validation prevents late queue admission", async () => {
  const accountId = await nextAccountId("cancel-validation");
  const abort = new AbortController();
  const pending = startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" },
    undefined, "watcher", abort.signal);
  abort.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await flush();
  expect(spawned).toHaveLength(0);
});

test("a failing push hook never fails the sync job or holds up the queue", async () => {
  const calls: string[] = [];
  replacePushNotifier({
    onSyncCompleted(accountId) { calls.push(accountId); throw new Error("synthetic push failure"); },
    sendTest: async () => null,
    idle: async () => {}
  });
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  try {
    const accountId = await nextAccountId("push-failure");
    const first = await startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "new" });
    const queued = await startSyncJob({ accountId, folderId: `${accountId}:Sent`, mode: "new" });
    await finishNextWorker();
    // The hook is loaded with a dynamic import after the job has completed.
    for (let i = 0; i < 200 && !calls.includes(accountId); i += 1) await Bun.sleep(10);
    expect(calls).toEqual([accountId]);
    expect(getSyncJob(first.id)?.status).toBe("done");
    expect(getSyncJob(queued.id)?.status).toBe("running");
    expect(warn.mock.calls.some(([line]) => String(line).includes("[push] failed to schedule new-mail check"))).toBe(true);
  } finally {
    replacePushNotifier(undefined);
    warn.mockRestore();
  }
});
