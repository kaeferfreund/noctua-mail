import { runWorker, workerSafePoint } from "../server/workerLifecycle";
import { getDb } from "../db/connection";
import { newLeaseOwner, queueWorker, reserveWorker, bindWorkerProcess, removeWorker } from "../db/processLeases";
const owner = newLeaseOwner(), id = crypto.randomUUID();
await queueWorker(id, owner, 0);
if (!await reserveWorker(id, owner, 1)) throw Error("Synthetic worker could not acquire lease");
await bindWorkerProcess(id, owner);
const db = await getDb();
if (process.argv[2] === "recover") {
  const row = db.prepare("SELECT COUNT(*) AS n, SUM(value) AS total FROM shutdown_probe").get();
  if (row.n < 2 || row.n % 2 || row.total !== 0) throw Error("Committed transaction was lost or interrupted");
  if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw Error("Corrupt synthetic storage");
  await removeWorker(id, owner, true);
  console.log("RECOVERED", row.n);
  process.exit(0);
}
await runWorker(async () => {
  db.exec("CREATE TABLE shutdown_probe(value INTEGER NOT NULL)");
  for (;;) {
    workerSafePoint();
    db.transaction(() => { db.prepare("INSERT INTO shutdown_probe VALUES (?)").run(1); db.prepare("INSERT INTO shutdown_probe VALUES (?)").run(-1); }).immediate();
    console.log("COMMITTED");
    await Bun.sleep(10);
  }
});
