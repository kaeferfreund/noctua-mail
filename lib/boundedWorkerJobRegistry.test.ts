import { test, expect, spyOn } from "bun:test";
import { createWorkerJobRegistry } from "./workerJobRegistry";
import "./testDbHarness";

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
test("identity worker slots coalesce per account, bound global concurrency, drain queued work and retain one trailing invalidation", async () => {
  const exits: Array<(code: number) => void> = [];
  const bun = (globalThis as typeof globalThis & { Bun: any }).Bun;
  const spawn = spyOn(bun, "spawn").mockImplementation(() => ({ pid: process.pid,
    exited: new Promise<number>(resolve => exits.push(resolve)), stderr: null }));
  const config = { scriptPath: "synthetic-worker.ts", registryName: crypto.randomUUID(), maxConcurrentJobs: 2 };
  const firstServer = createWorkerJobRegistry(config), secondServer = createWorkerJobRegistry(config);
  try {
    const first = firstServer.startJob("a", ["--identities"]);
    expect(secondServer.startJob("a", ["--identities"]).id).toBe(first.id);
    const second = secondServer.startJob("b");
    const queued = firstServer.startJob("c");
    expect(first.status).toBe("running"); expect(second.status).toBe("running"); expect(queued.status).toBe("queued");
    expect(spawn).toHaveBeenCalledTimes(2);
    secondServer.startJob("a", ["--identities"], true);
    firstServer.startJob("a", ["--identities"], true);
    exits[0](0); await tick();
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(firstServer.getJob(first.id)?.status).toBe("running");
    exits[1](0); await tick();
    expect(secondServer.getJob(queued.id)?.status).toBe("running");
    expect(spawn).toHaveBeenCalledTimes(4);
    exits[2](0); exits[3](1); await tick();
    expect(firstServer.getJob(first.id)?.status).toBe("done");
    expect(firstServer.getJob(queued.id)).toMatchObject({ status: "failed", error: "Worker exited with code 1" });
    expect(firstServer.startJob("c").id).toBe(queued.id); // retry cooldown
  } finally { exits.forEach(exit => exit(0)); await tick(); spawn.mockRestore(); }
});

test("bounded worker spawn failures release the account/global slot", () => {
  const bun = (globalThis as typeof globalThis & { Bun: any }).Bun;
  const spawn = spyOn(bun, "spawn").mockImplementation(() => { throw new Error("Synthetic spawn failure"); });
  const registry = createWorkerJobRegistry({ scriptPath: "synthetic-worker.ts", registryName: crypto.randomUUID(), maxConcurrentJobs: 1 });
  try {
    expect(registry.startJob("a")).toMatchObject({ status: "failed", error: "Synthetic spawn failure" });
    expect(registry.startJob("b").status).toBe("failed");
    expect(spawn).toHaveBeenCalledTimes(2);
  } finally { spawn.mockRestore(); }
});

test("independent server processes share one account slot and a global two-worker limit", async () => {
  const { spawn } = await import("node:child_process");
  const { Database } = await import("bun:sqlite");
  const { getDataDir } = await import("./runtimePaths");
  const path = await import("node:path");
  const tracePath = path.join(getDataDir(), `admission-${crypto.randomUUID()}.db`);
  const trace = new Database(tracePath);
  trace.exec("CREATE TABLE admission(active INTEGER,peak INTEGER,started INTEGER); INSERT INTO admission VALUES(0,0,0)");
  const registryName = crypto.randomUUID();
  const accounts = ["a", "a", "b", "c", "d", "e"];
  try {
    const ids = await Promise.all(accounts.map(accountId => new Promise<string>((resolve, reject) => {
      const child = spawn("nice", ["-n", "10", "bun", "run", "lib/testFixtures/boundedWorker.ts", "--submit", accountId], {
        env: { ...process.env, NOCTUA_TEST_WORKER_REGISTRY: registryName, NOCTUA_TEST_WORKER_TRACE: tracePath }, stdio: ["ignore", "pipe", "pipe"]
      });
      let stdout = "", stderr = "";
      child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
      child.on("error", reject);
      child.on("exit", code => { if (code !== 0) reject(new Error(stderr)); else resolve(JSON.parse(stdout).id); });
    })));
    expect(ids[0]).toBe(ids[1]);
    expect(trace.prepare("SELECT active,peak,started FROM admission").get()).toEqual({ active: 0, peak: 2, started: 5 });
  } finally { trace.close(); }
}, 20000);

test("identity workers wait for the shared sync lease budget and release it after confirmed exit", async () => {
  const { queueWorker, reserveWorker, removeWorker, newLeaseOwner } = await import("./db/processLeases");
  const { getDb } = await import("./db/connection");
  const owner = newLeaseOwner(), blocker = crypto.randomUUID(), identityAccount = crypto.randomUUID();
  const configured = process.env.NOCTUA_MAX_SYNC_WORKERS;
  process.env.NOCTUA_MAX_SYNC_WORKERS = "1";
  let exit!: (code: number) => void;
  const spawn = spyOn(Bun, "spawn").mockImplementation(() => ({ pid: process.pid,
    exited: new Promise<number>(resolve => { exit = resolve; }), stderr: null, kill: () => {} }) as never);
  const waitFor = async (predicate: () => boolean | Promise<boolean>) => {
    const deadline = Date.now() + 4000;
    while (!await predicate() && Date.now() < deadline) await tick();
    expect(await predicate()).toBe(true);
  };
  try {
    await queueWorker(blocker, owner, 1, "synthetic-sync-blocker");
    expect(await reserveWorker(blocker, owner, 1)).toBe(true);
    const registry = createWorkerJobRegistry({ scriptPath: "synthetic-worker.ts", registryName: crypto.randomUUID(),
      maxConcurrentJobs: 2, sharedWorkerBudget: true });
    const job = registry.startJob(identityAccount, ["--identities"]);
    expect(registry.startJob(identityAccount).id).toBe(job.id);
    const db = await getDb();
    await waitFor(() => !!db.prepare("SELECT 1 FROM sync_worker_queue WHERE jobId=?").get(job.id));
    expect(registry.getJob(job.id)?.status).toBe("queued");
    expect(spawn).not.toHaveBeenCalled();
    await removeWorker(blocker, owner, true);
    await waitFor(() => registry.getJob(job.id)?.status === "running");
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(db.prepare("SELECT accountId,pid FROM sync_worker_leases WHERE jobId=?").get(job.id)).toEqual({ accountId: identityAccount, pid: process.pid });
    exit(0);
    await waitFor(() => registry.getJob(job.id)?.status === "done");
    expect(db.prepare("SELECT 1 FROM sync_worker_leases WHERE jobId=?").get(job.id)).toBeNull();
  } finally {
    exit?.(0);
    await removeWorker(blocker, owner, true);
    spawn.mockRestore();
    if (configured === undefined) delete process.env.NOCTUA_MAX_SYNC_WORKERS;
    else process.env.NOCTUA_MAX_SYNC_WORKERS = configured;
  }
});
