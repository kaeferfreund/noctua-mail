// Synthetic subprocess fixture for cross-process worker admission.
import { Database } from "bun:sqlite";
import { createWorkerJobRegistry } from "../workerJobRegistry";
const [mode, accountId] = process.argv.slice(2);
if (mode === "--submit") {
  const registry = createWorkerJobRegistry({ scriptPath: new URL(import.meta.url).pathname,
    registryName: process.env.NOCTUA_TEST_WORKER_REGISTRY!, maxConcurrentJobs: 2, commandPrefix: ["nice", "-n", "10"] });
  const job = registry.startJob(accountId);
  const deadline = Date.now() + 15000;
  let current = job;
  while (["queued", "running"].includes(current.status) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 20));
    current = registry.getJob(job.id)!;
  }
  if (current.status !== "done") throw new Error(`Synthetic job did not finish: ${current.status}`);
  console.log(JSON.stringify({ id: job.id }));
} else {
  const db = new Database(process.env.NOCTUA_TEST_WORKER_TRACE!);
  db.exec("PRAGMA busy_timeout=5000");
  db.transaction(() => {
    db.exec("UPDATE admission SET active=active+1, started=started+1");
    db.exec("UPDATE admission SET peak=MAX(peak,active)");
  }).immediate();
  await new Promise(resolve => setTimeout(resolve, 250));
  db.prepare("UPDATE admission SET active=active-1").run();
  db.close();
}
