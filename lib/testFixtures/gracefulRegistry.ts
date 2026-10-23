import { createWorkerJobRegistry } from "../workerJobRegistry";
import { installShutdownCoordinator } from "../server/shutdown";
import { runWorker, workerSafePoint } from "../server/workerLifecycle";
import { getDb } from "../db/connection";

if (process.argv[2] === "synthetic-registry-account") {
  await runWorker(async () => {
    const db = await getDb();
    db.exec("CREATE TABLE IF NOT EXISTS registry_probe(value INTEGER)");
    db.prepare("INSERT INTO registry_probe VALUES (?)").run(process.env.NOCTUA_SYNTHETIC_RECOVER ? 2 : 1);
    while (!process.env.NOCTUA_SYNTHETIC_RECOVER) { workerSafePoint(); await Bun.sleep(10); }
  });
} else {
  installShutdownCoordinator();
  const registry = createWorkerJobRegistry({ scriptPath: "lib/testFixtures/gracefulRegistry.ts",
    registryName: "synthetic-shutdown-registry", maxConcurrentJobs: 1, sharedWorkerBudget: true });
  const db = await getDb();
  if (process.argv[2] === "recover") {
    registry.resumeJobs();
    const deadline = Date.now() + 5000;
    let job = registry.getLatestJob("synthetic-registry-account");
    while (job?.status !== "done" && Date.now() < deadline) { await Bun.sleep(10); job = registry.getLatestJob("synthetic-registry-account"); }
    if (job?.status !== "done" || !db.prepare("SELECT 1 FROM registry_probe WHERE value=2").get()) throw Error("Interrupted identity scan did not resume");
    if (db.prepare("SELECT count(*) AS n FROM sync_worker_leases").get().n !== 0) throw Error("Worker lease was not released");
    console.log(`RECOVERED ${job.id}`);
    process.exit(0);
  }
  const job = registry.startJob("synthetic-registry-account");
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE name='registry_probe'").get() && db.prepare("SELECT 1 FROM registry_probe").get()) break;
    await Bun.sleep(10);
  }
  if (!db.prepare("SELECT 1 FROM registry_probe").get()) throw Error("Synthetic registry child did not start");
  console.log(`READY ${job.id}`);
  await new Promise<void>(() => {});
}
