/** Isolated acceptance checks; subprocesses deliberately bypass globalThis caches. */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const mode = process.argv[2];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
if (mode === "admit" || mode === "orphan") {
  const { DurableSyncWorkerSemaphore } = await import("@/lib/durableSyncWorkerSemaphore");
  const sem = new DurableSyncWorkerSemaphore(2);
  const id = process.argv[3];
  const done = new Promise<void>(resolve => sem.enqueue(id, 0, release => {
    void (async () => {
      const child = await sem.spawn(id, () => (globalThis as typeof globalThis & { Bun: any }).Bun.spawn([process.execPath, "-e", `setTimeout(()=>{},${mode === "orphan" ? 30000 : 600})`],
        { stdin: "ignore", stdout: "ignore", stderr: "ignore" }));
      console.info(`LEASE_STARTED ${id} ${child.pid}`);
      if (mode === "orphan") process.exit(0); // Persisted live child, dead owner.
      await child.exited;
      console.info(`LEASE_ENDED ${id}`);
      await release();
      resolve();
    })();
  }));
  await done;
  process.exit(0);
}
if (mode === "monitor") {
  process.env.NOCTUA_MAX_SYNC_WORKERS = "1";
  process.env.NOCTUA_SYNC_WORKER_TIMEOUT_MS = "20";
  const { startSyncJob, getSyncJob } = await import("@/lib/syncJobs");
  const { getDb } = await import("@/lib/db/connection");
  const db = await getDb();
  const bun = (globalThis as typeof globalThis & { Bun: any }).Bun;
  let starts = 0;
  let kills = 0;
  let confirmExit!: (code: number) => void;
  let secondExit!: (code: number) => void;
  bun.spawn = () => {
    starts++;
    const exited = new Promise<number>(resolve => { if (starts === 1) confirmExit = resolve; else secondExit = resolve; });
    return { pid: process.pid, stdout: null, stderr: null, exited, kill: () => { kills++; } };
  };
  const first = startSyncJob({ accountId: "synthetic-timeout-a", mode: "new" });
  const next = startSyncJob({ accountId: "synthetic-timeout-b", mode: "new" });
  const deadline = Date.now() + 3000;
  while (kills === 0 && Date.now() < deadline) await sleep(10);
  assert.equal(kills, 1);
  await sleep(50);
  assert.equal(starts, 1, "SIGKILL alone cannot admit the next job");
  assert.equal(next.status, "queued");
  assert.equal(db.prepare("SELECT count(*) AS n FROM sync_worker_leases").get().n, 1);
  confirmExit(137);
  while (starts < 2 && Date.now() < deadline) await sleep(5);
  assert.equal(starts, 2);
  assert.equal(first.status, "failed");
  secondExit(0);
  while (getSyncJob(next.id)?.status !== "done" && Date.now() < deadline) await sleep(5);
  assert.equal(next.status, "done");
  while (db.prepare("SELECT count(*) AS n FROM sync_worker_leases").get().n && Date.now() < deadline) await sleep(5);
  assert.equal(db.prepare("SELECT count(*) AS n FROM sync_worker_leases").get().n, 0);

  bun.spawn = () => ({ pid: process.pid, stdout: null, stderr: null,
    exited: Promise.reject(new Error("Synthetic exit confirmation failed")), kill: () => {} });
  const unknownExit = startSyncJob({ accountId: "synthetic-unknown-exit", mode: "new" });
  while (unknownExit.status !== "failed" && Date.now() < deadline) await sleep(5);
  assert.equal(unknownExit.status, "failed");
  await sleep(30);
  const blocked = startSyncJob({ accountId: "synthetic-blocked", mode: "new" });
  await sleep(50);
  assert.equal(blocked.status, "queued");
  assert.equal(db.prepare("SELECT count(*) AS n FROM sync_worker_leases").get().n, 1);
  console.info("MONITOR_PROOF PASS timeout waits for child.exited; failed exit confirmation retains capacity");
  process.exit(0);
}
if (mode === "scheduler") {
  const { acquireScheduler } = await import("@/lib/db/processLeases");
  assert(await acquireScheduler("crashed-scheduler"));
  console.info("SCHEDULER_ACQUIRED");
  await sleep(30000);
  process.exit(0);
}

const dataDir = mkdtempSync(path.join(tmpdir(), "noctua-leases-proof-"));
process.env.NOCTUA_DATA_DIR = dataDir;
process.env.IMAP_SECRET_KEY = "synthetic-process-lease-proof-key-32-chars";
const children: ChildProcess[] = [];
const orphanPids: number[] = [];
const { getDb, closeAllDbConnections } = await import("@/lib/db/connection");
const db = await getDb();
const leases = await import("@/lib/db/processLeases");
async function until(check: () => boolean | Promise<boolean>, label: string, ms = 8000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) { if (await check()) return; await sleep(10); }
  throw new Error(`Timed out: ${label}`);
}
function launch(childMode: string, id = "") {
  const child = spawn(process.execPath, ["scripts/verifyProcessLeases.ts", childMode, id],
    { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  children.push(child);
  let output = "";
  child.stdout!.on("data", chunk => { output += chunk; });
  child.stderr!.on("data", chunk => { output += chunk; });
  const exited = once(child, "exit").then(([code]) => code);
  return { child, output: () => output, exited };
}
try {
  const callers = Array.from({ length: 4 }, (_, i) => launch("admit", `independent-${i}`));
  let maxLeases = 0;
  while (callers.some(caller => caller.child.exitCode === null)) {
    maxLeases = Math.max(maxLeases, db.prepare("SELECT count(*) AS n FROM sync_worker_leases").get().n);
    assert(maxLeases <= 2, "four independent processes must share a cap of two");
    await sleep(5);
  }
  for (const caller of callers) { assert.equal(await caller.exited, 0, caller.output()); assert(caller.output().includes("LEASE_STARTED")); }
  assert.equal(maxLeases, 2);
  assert.equal(db.prepare("SELECT count(*) AS n FROM sync_worker_leases").get().n, 0);
  console.info("LEASE_PROOF independent-graph admission: 4 processes, maximum 2 workers");

  const orphan = launch("orphan", "orphan-child");
  await until(() => orphan.output().includes("LEASE_STARTED"), "orphan startup");
  const orphanPid = Number(orphan.output().match(/LEASE_STARTED orphan-child (\d+)/)![1]);
  orphanPids.push(orphanPid);
  assert.equal(await orphan.exited, 0);
  db.prepare("UPDATE sync_worker_leases SET expiresAt=0").run();
  const owner = leases.newLeaseOwner();
  await leases.queueWorker("recovery", owner, 0);
  // Cap one forces reuse of the occupied slot. Expiry + dead owner is insufficient.
  assert.equal(await leases.reserveWorker("recovery", owner, 1), false);
  process.kill(orphanPid, "SIGKILL");
  await until(() => leases.processExited(orphanPid), "confirmed orphan exit");
  assert.equal(await leases.reserveWorker("recovery", owner, 1), true);
  await leases.removeWorker("recovery", owner);
  assert.equal(await leases.bindWorkerProcess("orphan-child", "stale-owner"), false, "late unrecorded children cannot bypass a reaped ticket");
  console.info("LEASE_PROOF restart recovery: expired live orphan retained; dead orphan reclaimed; stale child rejected");

  await leases.queueWorker("reserved-before-spawn-crash", owner, 0);
  assert(await leases.reserveWorker("reserved-before-spawn-crash", owner, 1));
  // Use the real, already-exited owner PID, never an invented live/dead assumption.
  db.prepare("UPDATE sync_worker_leases SET ownerPid=?").run(orphan.child.pid);
  await leases.queueWorker("post-restart", owner, 0);
  assert(await leases.reserveWorker("post-restart", owner, 1));
  await leases.removeWorker("post-restart", owner);

  // The persisted bypass counter survives independent graph/restart boundaries.
  await leases.queueWorker("waiting-watcher", owner, 1);
  for (let i = 0; i < leases.MAX_ADMISSION_BYPASSES; i++) {
    const id = `interactive-${i}`;
    await leases.queueWorker(id, owner, 0);
    assert(await leases.reserveWorker(id, owner, 1));
    await leases.removeWorker(id, owner);
  }
  await leases.queueWorker("late-interactive", owner, 0);
  assert.equal(await leases.reserveWorker("late-interactive", owner, 1), false);
  assert(await leases.reserveWorker("waiting-watcher", owner, 1));
  await leases.removeWorker("waiting-watcher", owner);
  await leases.removeWorker("late-interactive", owner);
  console.info("LEASE_PROOF starvation bound: watcher admitted after 8 interactive bypasses");

  await leases.queueWorker("unconfirmed", owner, 0);
  assert(await leases.reserveWorker("unconfirmed", owner, 1));
  db.prepare("UPDATE sync_worker_leases SET pid=? WHERE jobId='unconfirmed'").run(process.pid);
  await leases.removeWorker("unconfirmed", owner);
  await leases.queueWorker("blocked", owner, 0);
  assert.equal(await leases.reserveWorker("blocked", owner, 1), false);
  await leases.removeWorker("unconfirmed", owner, true); // Test-controlled confirmation, no child was spawned.
  await leases.removeWorker("blocked", owner);
  console.info("LEASE_PROOF confirmed-exit failure: a live recorded PID retains capacity");

  const scheduler = launch("scheduler");
  await until(() => scheduler.output().includes("SCHEDULER_ACQUIRED"), "scheduler lease");
  const specifierA = "../lib/db/processLeases.ts?graph-a";
  const graphA: typeof leases = await import(specifierA);
  const specifierB = "../lib/db/processLeases.ts?graph-b";
  const graphB: typeof leases = await import(specifierB);
  assert.equal(await graphA.acquireScheduler("graph-a"), false);
  db.prepare("UPDATE mailbox_watcher_lease SET expiresAt=0").run();
  assert.equal(await graphB.acquireScheduler("graph-b"), false, "expiry alone must not displace a live scheduler");
  scheduler.child.kill("SIGKILL");
  await scheduler.exited;
  assert.equal(await graphA.acquireScheduler("graph-a"), true);
  assert.equal(await graphB.acquireScheduler("graph-b"), false);
  await graphA.releaseScheduler("graph-a");
  assert.equal(await graphB.acquireScheduler("graph-b"), true);
  await graphB.releaseScheduler("graph-b");
  console.info("LEASE_PROOF scheduler: independent graphs share one owner, dead-owner takeover and orderly handoff pass");
  const monitor = launch("monitor");
  assert.equal(await monitor.exited, 0, monitor.output());
  assert(monitor.output().includes("MONITOR_PROOF PASS"));
  console.info("LEASE_PROOF production monitor: SIGKILL waits for confirmed exit, rejected exit retains capacity");
  console.info("LEASE_PROOF PASS");
} finally {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await once(child, "exit"); }
  for (const pid of orphanPids) if (!leases.processExited(pid)) process.kill(pid, "SIGKILL");
  closeAllDbConnections();
  rmSync(dataDir, { recursive: true, force: true });
}
