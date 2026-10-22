/** Real SQLite contention and process restart regressions; isolated from test mocks. */
import assert from "node:assert/strict";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

const mode = process.argv[2];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
if (mode === "restarted") {
  const { DurableSyncWorkerSemaphore } = await import("@/lib/durableSyncWorkerSemaphore");
  const sem = new DurableSyncWorkerSemaphore(1);
  await new Promise<void>(resolve => sem.enqueue("after-restart", 0, release => { void release().then(resolve); }));
  console.info("CLEANUP_RESTART PASS");
  process.exit(0);
}
const dataDir = mkdtempSync(path.join(tmpdir(), "noctua-cleanup-proof-"));
process.env.NOCTUA_DATA_DIR = dataDir;
process.env.IMAP_SECRET_KEY = "synthetic-admission-cleanup-proof-secret";
const { getDb, closeAllDbConnections } = await import("@/lib/db/connection");
const { getMainDbPath } = await import("@/lib/runtimePaths");
const { DurableSyncWorkerSemaphore } = await import("@/lib/durableSyncWorkerSemaphore");
const leases = await import("@/lib/db/processLeases");
const db = await getDb();
db.exec("PRAGMA busy_timeout=0");
const lock = new Database(getMainDbPath()) as Database & { close(): void };
const children: ReturnType<typeof spawn>[] = [];
let locked = false;
let exhausted = 0;
const originalError = console.error;
console.error = (...args) => {
  if (args[0] === "[db-write-retry] exhausted" && args[1]?.operation === "releaseSyncWorker") exhausted++;
  originalError(...args);
};
async function until(check: () => boolean, label: string, ms = 10000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) { if (check()) return; await sleep(10); }
  throw new Error(`Timed out: ${label}`);
}
const hasQueue = (id: string) => Boolean(db.prepare("SELECT 1 FROM sync_worker_queue WHERE jobId=?").get(id));
const hasLease = (id: string) => Boolean(db.prepare("SELECT 1 FROM sync_worker_leases WHERE jobId=?").get(id));
try {
  if (mode === "cancel") {
    const blocker = leases.newLeaseOwner();
    await leases.queueWorker("blocker", blocker, 0);
    assert(await leases.reserveWorker("blocker", blocker, 1));
    const sem = new DurableSyncWorkerSemaphore(1);
    let started = false;
    sem.enqueue("cancelled-head", 0, () => { throw new Error("Cancelled work started"); });
    await until(() => hasQueue("cancelled-head"), "durable queued head");
    // Stop all writes until removeWorker exhausts all five attempts.
    lock.exec("BEGIN IMMEDIATE"); locked = true;
    assert(sem.cancel("cancelled-head"));
    await until(() => exhausted > 0, "cancellation retry exhaustion");
    assert(hasQueue("cancelled-head"), "contention must leave the durable head present");
    lock.exec("ROLLBACK"); locked = false;
    // No waiter is needed to keep cleanup alive. Exercise the heartbeat/timer.
    await until(() => !hasQueue("cancelled-head"), "cancel cleanup without waiters");
    await leases.removeWorker("blocker", blocker);
    sem.enqueue("after-cancel", 0, release => { started = true; void release(); });
    await until(() => started && !hasLease("after-cancel"), "admission after cancelled head");
  } else if (mode === "release") {
    const sem = new DurableSyncWorkerSemaphore(1);
    let releaseFirst!: () => Promise<void>;
    let startedNext = false;
    sem.enqueue("exited-worker", 0, release => { releaseFirst = release; });
    await until(() => Boolean(releaseFirst), "initial admission");
    // A real child exits before release, rather than assuming a signal is proof.
    const child = await sem.spawn("exited-worker", () => (globalThis as typeof globalThis & { Bun: any }).Bun.spawn([process.execPath, "-e", "process.exit(0)"],
      { stdin: "ignore", stdout: "ignore", stderr: "ignore" }));
    await child.exited;
    lock.exec("BEGIN IMMEDIATE"); locked = true;
    const released = releaseFirst();
    assert.equal(releaseFirst(), released, "repeated release shares the pending cleanup");
    sem.enqueue("after-release", 0, release => { startedNext = true; void release(); });
    await until(() => exhausted > 0, "release retry exhaustion");
    assert(hasLease("exited-worker"));
    assert.equal(startedNext, false, "DB contention cannot be bypassed by memory state");
    lock.exec("ROLLBACK"); locked = false;
    await released;
    await until(() => startedNext && !hasLease("after-release"), "admission after release retry");
  } else if (mode === "restart") {
    // Model a discarded graph in a process that remains alive. Its registration
    // expires; a new process must recover queue heads and pre-spawn reservations.
    const stale = leases.newLeaseOwner();
    await leases.queueWorker("stale-reservation", stale, 0);
    assert(await leases.reserveWorker("stale-reservation", stale, 1));
    await leases.queueWorker("stale-head", stale, 0);
    db.prepare("UPDATE sync_worker_owners SET expiresAt=0 WHERE ownerInstance=?").run(stale);
    const liveChild = spawn(process.execPath, ["-e", "setTimeout(()=>{},30000)"], { stdio: "ignore" });
    children.push(liveChild);
    db.prepare("UPDATE sync_worker_leases SET pid=? WHERE jobId='stale-reservation'").run(liveChild.pid);
    const contender = leases.newLeaseOwner();
    await leases.queueWorker("contender", contender, 0);
    assert.equal(await leases.reserveWorker("contender", contender, 1), false, "expired graph cannot free a live child");
    assert.equal(hasQueue("stale-head"), false, "stale head is recovered despite live owner PID");
    const exited = once(liveChild, "exit");
    liveChild.kill("SIGKILL"); await exited;
    // A restarted process also needs to recover a pre-spawn ticket while owner lives.
    await leases.removeWorker("contender", contender);
    db.prepare("UPDATE sync_worker_leases SET pid=NULL WHERE jobId='stale-reservation'").run();
    const restarted = spawn(process.execPath, ["scripts/verifyAdmissionCleanup.ts", "restarted"],
      { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    children.push(restarted);
    let output = "";
    restarted.stdout!.on("data", chunk => { output += chunk; });
    restarted.stderr!.on("data", chunk => { output += chunk; });
    const watchdog = setTimeout(() => restarted.kill("SIGKILL"), 8000);
    try { assert.equal((await once(restarted, "exit"))[0], 0, output); }
    finally { clearTimeout(watchdog); }
    assert(output.includes("CLEANUP_RESTART PASS"));
    assert.equal(hasLease("stale-reservation"), false);
    // Confirmed child death alone also recovers a fresh/live owner's stale lease.
    const fresh = leases.newLeaseOwner();
    await leases.queueWorker("dead-child-live-owner", fresh, 0);
    assert(await leases.reserveWorker("dead-child-live-owner", fresh, 1));
    db.prepare("UPDATE sync_worker_leases SET pid=? WHERE jobId='dead-child-live-owner'").run(liveChild.pid);
    await leases.queueWorker("recovered-dead-child", contender, 0);
    assert(await leases.reserveWorker("recovered-dead-child", contender, 1));
    await leases.removeWorker("recovered-dead-child", contender);
  } else throw new Error(`Unknown proof mode: ${mode}`);
  console.info(`CLEANUP_PROOF ${mode} PASS`);
} finally {
  if (locked) lock.exec("ROLLBACK");
  lock.close();
  for (const child of children) if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit"); child.kill("SIGKILL"); await exited;
  }
  console.error = originalError;
  closeAllDbConnections();
  rmSync(dataDir, { recursive: true, force: true });
}
