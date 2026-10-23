import { randomUUID } from "node:crypto";
import { getDb } from "./connection";
import { withDbWriteRetry } from "../dbWriteRetry";

export const LEASE_MS = 15_000;
const RENEWAL_MARGIN_MS = 5_000;
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
  let acquisitionFailed = false;
  return withDbWriteRetry(name, () => {
    let acquired = false;
    acquisitionFailed = false;
    try {
      return db.transaction(() => { acquired = true; return action(db); }).immediate();
    } catch (error) {
      acquisitionFailed = !acquired;
      throw error;
    }
  }, {
    // Preserve ordinary admission pacing. A bounded recovery burst uses the
    // remaining handshake budget only when acquisition would otherwise exhaust.
    handshakeRetry: () => acquisitionFailed,
    handshakeRetryAfterCoarse: true
  });
}

function renewOwner(db: any, owner: string) {
  db.query(`INSERT INTO sync_worker_owners(ownerInstance,expiresAt) VALUES (?,?)
    ON CONFLICT(ownerInstance) DO UPDATE SET expiresAt=excluded.expiresAt`).run(owner, Date.now() + LEASE_MS);
}

function ownerRenewalDue(db: any, owner: string, now = Date.now()) {
  const own = db.query("SELECT expiresAt FROM sync_worker_owners WHERE ownerInstance=?").get(owner) as { expiresAt: number } | null;
  return !own || own.expiresAt <= now + RENEWAL_MARGIN_MS;
}

export async function queueWorker(jobId: string, owner: string, priority: number, accountId = jobId) {
  const db = await getDb();
  // The durable pump repeats queue/promote/reserve while waiting. Existing
  // tickets need no writer until owner renewal is due. This hint grants nothing;
  // a concurrent cleanup is still rechecked by reserve's writer transaction.
  if (!ownerRenewalDue(db, owner) && db.query("SELECT 1 FROM sync_worker_queue WHERE jobId=? AND ownerInstance=?")
    .get(jobId, owner)) return;
  await write("queueSyncWorker", db => {
    renewOwner(db, owner);
    db.query(`INSERT OR IGNORE INTO sync_worker_queue
      (jobId,accountId,ownerInstance,ownerPid,priority,queuedAt,bypasses) VALUES (?,?,?,?,?,?,0)`)
      .run(jobId, accountId, owner, process.pid, priority, Date.now());
  });
}

// Shared by the read-only hint and the authoritative admission transaction.
function firstEligibleWorker(db: any) {
  return db.query(`SELECT jobId,accountId,ownerInstance FROM sync_worker_queue
      WHERE accountId NOT IN (SELECT accountId FROM sync_worker_leases) ORDER BY
      CASE WHEN bypasses >= ? THEN 0 ELSE 1 END, CASE WHEN bypasses >= ? THEN queuedAt ELSE priority END,
      queuedAt, rowid LIMIT 1`).get(MAX_ADMISSION_BYPASSES, MAX_ADMISSION_BYPASSES) as { jobId: string; accountId: string; ownerInstance: string } | null;
}

async function canDeferReservation(jobId: string, owner: string, capacity: number) {
  const db = await getDb(), now = Date.now();
  // Never defer owner expiry/recovery. A hint can delay admission by one poll;
  // every successful admission still runs the complete writer-locked checks.
  if (ownerRenewalDue(db, owner, now)) return false;
  const expired = new Set((db.query("SELECT ownerInstance FROM sync_worker_owners WHERE expiresAt<=?")
    .all(now) as Array<{ ownerInstance: string }>).map(row => row.ownerInstance));
  const leases = db.query("SELECT * FROM sync_worker_leases").all() as WorkerLease[];
  const queue = db.query("SELECT * FROM sync_worker_queue").all() as Waiter[];
  if (leases.some(row => row.pid !== null ? processExited(row.pid) : processExited(row.ownerPid) || expired.has(row.ownerInstance)) ||
      queue.some(row => processExited(row.ownerPid) || expired.has(row.ownerInstance))) return false;
  const first = firstEligibleWorker(db);
  return leases.length >= capacity || first?.jobId !== jobId || first.ownerInstance !== owner;
}

export async function reserveWorker(jobId: string, owner: string, capacity: number) {
  if (await canDeferReservation(jobId, owner, capacity)) return false;
  return write("reserveSyncWorker", db => {
    const expiredOwners = new Set((db.query("SELECT ownerInstance FROM sync_worker_owners WHERE expiresAt<=?")
      .all(Date.now()) as Array<{ ownerInstance: string }>).map(row => row.ownerInstance));
    // An expired owner can no longer hold an unspawned reservation: spawn must
    // still find that exact ticket under the same write lock. A recorded child
    // always retains capacity until its own PID is confirmed dead, even if its
    // owner is dead/expired. This also recovers exited children of live owners.
    for (const row of db.query("SELECT * FROM sync_worker_leases").all() as WorkerLease[]) {
      if (row.pid !== null ? processExited(row.pid) :
          processExited(row.ownerPid) || expiredOwners.has(row.ownerInstance)) {
        db.query("DELETE FROM sync_worker_leases WHERE slot=?").run(row.slot);
      }
    }
    for (const row of db.query("SELECT * FROM sync_worker_queue").all() as Waiter[]) {
      if (processExited(row.ownerPid) || expiredOwners.has(row.ownerInstance)) {
        db.query("DELETE FROM sync_worker_queue WHERE jobId=?").run(row.jobId);
      }
    }
    db.query(`DELETE FROM sync_worker_owners WHERE expiresAt<=?
      AND ownerInstance NOT IN (SELECT ownerInstance FROM sync_worker_leases)
      AND ownerInstance NOT IN (SELECT ownerInstance FROM sync_worker_queue)`).run(Date.now());
    const first = firstEligibleWorker(db);
    if (first?.jobId !== jobId || first.ownerInstance !== owner) return false;
    const used = new Set((db.query("SELECT slot FROM sync_worker_leases").all() as WorkerLease[]).map(row => row.slot));
    if (used.size >= capacity) return false;
    let slot = 1;
    while (slot <= capacity && used.has(slot)) slot++;
    if (slot > capacity) return false;
    db.query(`INSERT INTO sync_worker_leases (slot,jobId,accountId,ownerInstance,ownerPid,pid,expiresAt) VALUES (?,?,?,?,?,NULL,?)`)
      .run(slot, jobId, first.accountId, owner, process.pid, Date.now() + LEASE_MS);
    db.query("DELETE FROM sync_worker_queue WHERE jobId=? AND ownerInstance=?").run(jobId, owner);
    db.query("UPDATE sync_worker_queue SET bypasses=bypasses+1").run();
    return true;
  });
}

/** Spawn and record PID synchronously under the write lock. No retry can spawn twice. */
export async function spawnLeasedWorker<T extends { pid: number; kill: (signal: NodeJS.Signals) => void; exited: Promise<number> }>(
  jobId: string, owner: string, spawn: () => T
): Promise<T> {
  let child: T | undefined;
  try {
    return await write("spawnLeasedSyncWorker", db => {
      if (!db.query("SELECT 1 FROM sync_worker_leases WHERE jobId=? AND ownerInstance=?").get(jobId, owner)) {
        throw new Error("Sync worker lease lost before spawn");
      }
      child ??= spawn();
      db.query("UPDATE sync_worker_leases SET pid=?,expiresAt=? WHERE jobId=? AND ownerInstance=?")
        .run(child.pid, Date.now() + LEASE_MS, jobId, owner);
      return child;
    });
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
    db.query("UPDATE sync_worker_leases SET expiresAt=? WHERE ownerInstance=?")
      .run(Date.now() + LEASE_MS, owner);
  });
}
export async function removeWorker(jobId: string, owner: string, confirmedExit = false) {
  await write("releaseSyncWorker", db => {
    db.query("DELETE FROM sync_worker_queue WHERE jobId=? AND ownerInstance=?").run(jobId, owner);
    const row = db.query("SELECT * FROM sync_worker_leases WHERE jobId=? AND ownerInstance=?").get(jobId, owner) as WorkerLease | null;
    if (row && (row.pid === null || confirmedExit || processExited(row.pid))) {
      db.query("DELETE FROM sync_worker_leases WHERE jobId=? AND ownerInstance=?").run(jobId, owner);
    }
  });
}
export async function promoteWorker(jobId: string, owner: string, priority: number) {
  const db = await getDb();
  const row = db.query("SELECT priority FROM sync_worker_queue WHERE jobId=? AND ownerInstance=?")
    .get(jobId, owner) as { priority: number } | null;
  // Priority only decreases. A stale hint cannot promote or admit a waiter.
  if (row && row.priority <= priority) return;
  await write("promoteSyncWorker", db => db.query("UPDATE sync_worker_queue SET priority=min(priority,?) WHERE jobId=? AND ownerInstance=?")
    .run(priority, jobId, owner));
}

export async function acquireScheduler(owner: string) {
  return write("acquireMailboxScheduler", db => {
    const row = db.query("SELECT * FROM mailbox_watcher_lease WHERE slot=1").get() as
      { ownerInstance: string; pid: number; expiresAt: number } | null;
    if (row && row.ownerInstance !== owner && !processExited(row.pid)) return false;
    // Keep the authoritative writer-locked ownership check, but avoid another
    // durable heartbeat while the same owner's existing lease is healthy.
    if (row?.ownerInstance === owner && row.pid === process.pid && row.expiresAt > Date.now() + RENEWAL_MARGIN_MS) return true;
    db.query(`INSERT INTO mailbox_watcher_lease (slot,ownerInstance,pid,expiresAt) VALUES (1,?,?,?)
      ON CONFLICT(slot) DO UPDATE SET ownerInstance=excluded.ownerInstance,pid=excluded.pid,expiresAt=excluded.expiresAt`)
      .run(owner, process.pid, Date.now() + LEASE_MS);
    return true;
  });
}
export async function releaseScheduler(owner: string) {
  await write("releaseMailboxScheduler", db => db.query("DELETE FROM mailbox_watcher_lease WHERE ownerInstance=?").run(owner));
}

/** Close the spawn/crash window: a child must bind to its exact durable ticket
 * before doing sync work. A late child whose reservation was reaped exits. */
export async function bindWorkerProcess(jobId: string, owner: string) {
  return write("bindSyncWorkerProcess", db => {
    const row = db.query("SELECT pid,expiresAt FROM sync_worker_leases WHERE jobId=? AND ownerInstance=?").get(jobId, owner) as { pid: number | null; expiresAt: number } | null;
    if (!row || (row.pid !== null && row.pid !== process.pid)) return false;
    // The parent normally committed this exact PID immediately after spawn.
    // Recheck the ticket under the writer, without a redundant fsync/renewal.
    if (row.pid === process.pid && row.expiresAt > Date.now() + RENEWAL_MARGIN_MS) return true;
    db.query("UPDATE sync_worker_leases SET pid=?,expiresAt=? WHERE jobId=? AND ownerInstance=?")
      .run(process.pid, Date.now() + LEASE_MS, jobId, owner);
    return true;
  });
}
export async function watcherAuthSuspended(accountId: string, identity: string) {
  const db = await getDb();
  const row = db.query("SELECT identity FROM mailbox_watcher_auth WHERE accountId=?").get(accountId) as { identity: string } | null;
  return row?.identity === identity;
}
export async function suspendWatcherAuth(accountId: string, identity: string) {
  await write("suspendMailboxWatcherAuth", db => db.query("INSERT OR REPLACE INTO mailbox_watcher_auth (accountId,identity) VALUES (?,?)").run(accountId, identity));
}
export async function retryWatcherAuth(accountId: string) {
  await write("retryMailboxWatcherAuth", db => db.query("DELETE FROM mailbox_watcher_auth WHERE accountId=?").run(accountId));
}
