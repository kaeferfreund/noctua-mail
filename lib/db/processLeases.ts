import { randomUUID } from "node:crypto";
import { getDb } from "./connection";
import { withDbWriteRetry } from "../dbWriteRetry";

export const LEASE_MS = 15_000;
export const MAX_ADMISSION_BYPASSES = 8;
export class UnconfirmedWorkerExitError extends Error {
  constructor(readonly pid: number) { super(`Sync worker ${pid} exit could not be confirmed; lease retained.`); }
}
export const newLeaseOwner = () => `${process.pid}:${randomUUID()}`;

/** Only ESRCH proves exit. EPERM and all other probe errors fail closed. */
export function processExited(pid: number) {
  try { process.kill(pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH"; }
}

type WorkerLease = { slot: number; jobId: string; ownerInstance: string; ownerPid: number; pid: number | null; expiresAt: number };
type Waiter = { jobId: string; ownerInstance: string; ownerPid: number; priority: number; queuedAt: number; bypasses: number };

async function write<T>(name: string, action: (db: any) => T): Promise<T> {
  const db = await getDb();
  return withDbWriteRetry(name, () => db.transaction(() => action(db)).immediate());
}

function renewOwner(db: any, owner: string) {
  db.prepare(`INSERT INTO sync_worker_owners(ownerInstance,expiresAt) VALUES (?,?)
    ON CONFLICT(ownerInstance) DO UPDATE SET expiresAt=excluded.expiresAt`).run(owner, Date.now() + LEASE_MS);
}

export async function queueWorker(jobId: string, owner: string, priority: number, accountId = jobId) {
  await write("queueSyncWorker", db => {
    renewOwner(db, owner);
    db.prepare(`INSERT OR IGNORE INTO sync_worker_queue
      (jobId,accountId,ownerInstance,ownerPid,priority,queuedAt,bypasses) VALUES (?,?,?,?,?,?,0)`)
      .run(jobId, accountId, owner, process.pid, priority, Date.now());
  });
}

export async function reserveWorker(jobId: string, owner: string, capacity: number) {
  return write("reserveSyncWorker", db => {
    const expiredOwners = new Set((db.prepare("SELECT ownerInstance FROM sync_worker_owners WHERE expiresAt<=?")
      .all(Date.now()) as Array<{ ownerInstance: string }>).map(row => row.ownerInstance));
    // An expired owner can no longer hold an unspawned reservation: spawn must
    // still find that exact ticket under the same write lock. A recorded child
    // always retains capacity until its own PID is confirmed dead, even if its
    // owner is dead/expired. This also recovers exited children of live owners.
    for (const row of db.prepare("SELECT * FROM sync_worker_leases").all() as WorkerLease[]) {
      if (row.pid !== null ? processExited(row.pid) :
          processExited(row.ownerPid) || expiredOwners.has(row.ownerInstance)) {
        db.prepare("DELETE FROM sync_worker_leases WHERE slot=?").run(row.slot);
      }
    }
    for (const row of db.prepare("SELECT * FROM sync_worker_queue").all() as Waiter[]) {
      if (processExited(row.ownerPid) || expiredOwners.has(row.ownerInstance)) {
        db.prepare("DELETE FROM sync_worker_queue WHERE jobId=?").run(row.jobId);
      }
    }
    db.prepare(`DELETE FROM sync_worker_owners WHERE expiresAt<=?
      AND ownerInstance NOT IN (SELECT ownerInstance FROM sync_worker_leases)
      AND ownerInstance NOT IN (SELECT ownerInstance FROM sync_worker_queue)`).run(Date.now());
    const first = db.prepare(`SELECT jobId,accountId,ownerInstance FROM sync_worker_queue
      WHERE accountId NOT IN (SELECT accountId FROM sync_worker_leases) ORDER BY
      CASE WHEN bypasses >= ? THEN 0 ELSE 1 END, CASE WHEN bypasses >= ? THEN queuedAt ELSE priority END,
      queuedAt, rowid LIMIT 1`).get(MAX_ADMISSION_BYPASSES, MAX_ADMISSION_BYPASSES) as { jobId: string; accountId: string; ownerInstance: string } | null;
    if (first?.jobId !== jobId || first.ownerInstance !== owner) return false;
    const used = new Set((db.prepare("SELECT slot FROM sync_worker_leases").all() as WorkerLease[]).map(row => row.slot));
    if (used.size >= capacity) return false;
    let slot = 1;
    while (slot <= capacity && used.has(slot)) slot++;
    if (slot > capacity) return false;
    db.prepare(`INSERT INTO sync_worker_leases (slot,jobId,accountId,ownerInstance,ownerPid,pid,expiresAt) VALUES (?,?,?,?,?,NULL,?)`)
      .run(slot, jobId, first.accountId, owner, process.pid, Date.now() + LEASE_MS);
    db.prepare("DELETE FROM sync_worker_queue WHERE jobId=? AND ownerInstance=?").run(jobId, owner);
    db.prepare("UPDATE sync_worker_queue SET bypasses=bypasses+1").run();
    return true;
  });
}

/** Spawn and record PID synchronously under the write lock. No retry can spawn twice. */
export async function spawnLeasedWorker<T extends { pid: number; kill: (signal: string) => void; exited: Promise<number> }>(
  jobId: string, owner: string, spawn: () => T
): Promise<T> {
  const db = await getDb();
  let child: T | undefined;
  try {
    return await withDbWriteRetry("spawnLeasedSyncWorker", () => db.transaction(() => {
      if (!db.prepare("SELECT 1 FROM sync_worker_leases WHERE jobId=? AND ownerInstance=?").get(jobId, owner)) {
        throw new Error("Sync worker lease lost before spawn");
      }
      child ??= spawn();
      db.prepare("UPDATE sync_worker_leases SET pid=?,expiresAt=? WHERE jobId=? AND ownerInstance=?")
        .run(child.pid, Date.now() + LEASE_MS, jobId, owner);
      return child;
    }).immediate());
  } catch (error) {
    if (child) {
      try { child.kill("SIGKILL"); } catch { /* still require exit confirmation */ }
      try { await child.exited; }
      catch { throw new UnconfirmedWorkerExitError(child.pid); }
    }
    throw error;
  }
}

export async function heartbeatWorkers(owner: string) {
  await write("heartbeatSyncWorkers", db => {
    renewOwner(db, owner);
    db.prepare("UPDATE sync_worker_leases SET expiresAt=? WHERE ownerInstance=?")
      .run(Date.now() + LEASE_MS, owner);
  });
}
export async function removeWorker(jobId: string, owner: string, confirmedExit = false) {
  await write("releaseSyncWorker", db => {
    db.prepare("DELETE FROM sync_worker_queue WHERE jobId=? AND ownerInstance=?").run(jobId, owner);
    const row = db.prepare("SELECT * FROM sync_worker_leases WHERE jobId=? AND ownerInstance=?").get(jobId, owner) as WorkerLease | null;
    if (row && (row.pid === null || confirmedExit || processExited(row.pid))) {
      db.prepare("DELETE FROM sync_worker_leases WHERE jobId=? AND ownerInstance=?").run(jobId, owner);
    }
  });
}
export async function promoteWorker(jobId: string, owner: string, priority: number) {
  await write("promoteSyncWorker", db => db.prepare("UPDATE sync_worker_queue SET priority=min(priority,?) WHERE jobId=? AND ownerInstance=?")
    .run(priority, jobId, owner));
}

export async function acquireScheduler(owner: string) {
  return write("acquireMailboxScheduler", db => {
    const row = db.prepare("SELECT * FROM mailbox_watcher_lease WHERE slot=1").get() as
      { ownerInstance: string; pid: number; expiresAt: number } | null;
    if (row && row.ownerInstance !== owner && !processExited(row.pid)) return false;
    db.prepare(`INSERT INTO mailbox_watcher_lease (slot,ownerInstance,pid,expiresAt) VALUES (1,?,?,?)
      ON CONFLICT(slot) DO UPDATE SET ownerInstance=excluded.ownerInstance,pid=excluded.pid,expiresAt=excluded.expiresAt`)
      .run(owner, process.pid, Date.now() + LEASE_MS);
    return true;
  });
}
export async function releaseScheduler(owner: string) {
  await write("releaseMailboxScheduler", db => db.prepare("DELETE FROM mailbox_watcher_lease WHERE ownerInstance=?").run(owner));
}

/** Close the spawn/crash window: a child must bind to its exact durable ticket
 * before doing sync work. A late child whose reservation was reaped exits. */
export async function bindWorkerProcess(jobId: string, owner: string) {
  return write("bindSyncWorkerProcess", db => {
    const row = db.prepare("SELECT pid FROM sync_worker_leases WHERE jobId=? AND ownerInstance=?").get(jobId, owner) as { pid: number | null } | null;
    if (!row || (row.pid !== null && row.pid !== process.pid)) return false;
    db.prepare("UPDATE sync_worker_leases SET pid=?,expiresAt=? WHERE jobId=? AND ownerInstance=?")
      .run(process.pid, Date.now() + LEASE_MS, jobId, owner);
    return true;
  });
}
export async function watcherAuthSuspended(accountId: string, identity: string) {
  const db = await getDb();
  const row = db.prepare("SELECT identity FROM mailbox_watcher_auth WHERE accountId=?").get(accountId) as { identity: string } | null;
  return row?.identity === identity;
}
export async function suspendWatcherAuth(accountId: string, identity: string) {
  await write("suspendMailboxWatcherAuth", db => db.prepare("INSERT OR REPLACE INTO mailbox_watcher_auth (accountId,identity) VALUES (?,?)").run(accountId, identity));
}
export async function retryWatcherAuth(accountId: string) {
  await write("retryMailboxWatcherAuth", db => db.prepare("DELETE FROM mailbox_watcher_auth WHERE accountId=?").run(accountId));
}
