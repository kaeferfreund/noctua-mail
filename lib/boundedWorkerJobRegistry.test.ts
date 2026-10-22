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
