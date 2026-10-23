import { Database } from "bun:sqlite";
import { expect, spyOn, test } from "bun:test";
import { createCollabFixture } from "./testThreadCollabHarness";
import { getDb } from "./db/connection";
import { acquireScheduler, bindWorkerProcess, newLeaseOwner, promoteWorker, queueWorker, releaseScheduler, removeWorker, reserveWorker } from "./db/processLeases";

test("ineligible admission polls are read-only; eligibility and expired-owner recovery still take the writer", async () => {
  await createCollabFixture();
  const db = await getDb(), owner = newLeaseOwner();
  const first = `synthetic-${crypto.randomUUID()}`, second = `synthetic-${crypto.randomUUID()}`;
  const other = new Database(db.filename) as Database & { readonly inTransaction: boolean };
  other.exec("PRAGMA busy_timeout=0");
  try {
    await queueWorker(first, owner, 0);
    await queueWorker(second, owner, 1);
    expect(await reserveWorker(first, owner, 1)).toBe(true);
    other.exec("BEGIN IMMEDIATE");
    // A writer exists on another handle. Capacity-full polling succeeds without
    // attempting BEGIN, retrying, or joining that transaction.
    const transaction = spyOn(db, "transaction");
    try {
      expect(await reserveWorker(second, owner, 1)).toBe(false);
      expect(transaction).not.toHaveBeenCalled();
    } finally { transaction.mockRestore(); other.exec("ROLLBACK"); }
    await removeWorker(first, owner, true);
    expect(await reserveWorker(second, owner, 1)).toBe(true);
    await removeWorker(second, owner, true);
    await queueWorker(first, owner, 0);
    db.prepare("UPDATE sync_worker_owners SET expiresAt=? WHERE ownerInstance=?").run(Date.now() - 1, owner);
    const recovery = spyOn(db, "transaction");
    try {
      expect(await reserveWorker(first, owner, 1)).toBe(false);
      expect(recovery).toHaveBeenCalled();
      expect(db.prepare("SELECT 1 FROM sync_worker_queue WHERE jobId=?").get(first)).toBeNull();
    } finally { recovery.mockRestore(); }
  } finally {
    if (other.inTransaction) other.exec("ROLLBACK");
    other.close();
    await removeWorker(first, owner, true);
    await removeWorker(second, owner, true);
  }
});


test("repeated queue and unchanged promotion are read-only; renewal and a real promotion remain durable", async () => {
  await createCollabFixture();
  const db = await getDb(), owner = newLeaseOwner(), job = `synthetic-${crypto.randomUUID()}`;
  const other = new Database(db.filename) as Database & { readonly inTransaction: boolean };
  other.exec("PRAGMA busy_timeout=0");
  try {
    await queueWorker(job, owner, 2);
    other.exec("BEGIN IMMEDIATE");
    const transaction = spyOn(db, "transaction");
    try {
      await queueWorker(job, owner, 2);
      await promoteWorker(job, owner, 2);
      expect(transaction).not.toHaveBeenCalled();
    } finally { transaction.mockRestore(); other.exec("ROLLBACK"); }
    await promoteWorker(job, owner, 1);
    expect(db.query("SELECT priority FROM sync_worker_queue WHERE jobId=?").get(job)).toEqual({ priority: 1 });
    db.query("UPDATE sync_worker_owners SET expiresAt=? WHERE ownerInstance=?").run(Date.now() + 1_000, owner);
    const renewal = spyOn(db, "transaction");
    try {
      await queueWorker(job, owner, 2);
      expect(renewal).toHaveBeenCalled();
      const row = db.query("SELECT expiresAt FROM sync_worker_owners WHERE ownerInstance=?").get(owner) as { expiresAt: number };
      expect(row.expiresAt).toBeGreaterThan(Date.now() + 10_000);
      expect(db.query("SELECT priority FROM sync_worker_queue WHERE jobId=?").get(job)).toEqual({ priority: 1 });
    } finally { renewal.mockRestore(); }
  } finally {
    if (other.inTransaction) other.exec("ROLLBACK");
    other.close();
    await removeWorker(job, owner, true);
  }
});


test("healthy PID binding and scheduler heartbeats still check under the writer, without redundant updates", async () => {
  await createCollabFixture();
  const db = await getDb(), owner = newLeaseOwner(), job = `synthetic-${crypto.randomUUID()}`;
  const changes = () => (db.query("SELECT total_changes() AS n").get() as { n: number }).n;
  try {
    await queueWorker(job, owner, 0);
    expect(await reserveWorker(job, owner, 1)).toBe(true);
    expect(await bindWorkerProcess(job, owner)).toBe(true);
    expect(await acquireScheduler(owner)).toBe(true);
    const before = changes(), transaction = spyOn(db, "transaction");
    try {
      expect(await bindWorkerProcess(job, owner)).toBe(true);
      expect(await acquireScheduler(owner)).toBe(true);
      expect(transaction).toHaveBeenCalledTimes(2);
      expect(changes()).toBe(before);
    } finally { transaction.mockRestore(); }
    // An actual renewal remains a durable write with the existing 15s lease.
    db.query("UPDATE sync_worker_leases SET expiresAt=? WHERE jobId=?").run(Date.now() + 1_000, job);
    db.query("UPDATE mailbox_watcher_lease SET expiresAt=? WHERE ownerInstance=?").run(Date.now() + 1_000, owner);
    expect(await bindWorkerProcess(job, owner)).toBe(true);
    expect(await acquireScheduler(owner)).toBe(true);
    const worker = db.query("SELECT pid,expiresAt FROM sync_worker_leases WHERE jobId=?").get(job) as { pid: number; expiresAt: number };
    const scheduler = db.query("SELECT expiresAt FROM mailbox_watcher_lease WHERE ownerInstance=?").get(owner) as { expiresAt: number };
    expect(worker.pid).toBe(process.pid);
    expect(worker.expiresAt).toBeGreaterThan(Date.now() + 10_000);
    expect(scheduler.expiresAt).toBeGreaterThan(Date.now() + 10_000);
    expect(await acquireScheduler(newLeaseOwner())).toBe(false);
    expect(await bindWorkerProcess("synthetic-missing-ticket", owner)).toBe(false);
    // A previously bound PID/owner is no permission to bypass an active writer.
    for (const acquire of [() => bindWorkerProcess(job, owner), () => acquireScheduler(owner)]) {
      const other = new Database(db.filename);
      other.exec("PRAGMA busy_timeout=0");
      other.exec("BEGIN IMMEDIATE");
      let released = false;
      const timer = setTimeout(() => { other.exec("COMMIT"); released = true; }, 30);
      try {
        expect(await acquire()).toBe(true);
        expect(released).toBe(true);
      } finally { clearTimeout(timer); if (!released) other.exec("ROLLBACK"); other.close(); }
    }
  } finally {
    await removeWorker(job, owner, true);
    await releaseScheduler(owner);
  }
});


test("release retains coarse admission pacing and holds no transaction during acquisition backoff", async () => {
  await createCollabFixture();
  const db = await getDb(), owner = newLeaseOwner(), job = `synthetic-${crypto.randomUUID()}`;
  await queueWorker(job, owner, 0);
  expect(await reserveWorker(job, owner, 1)).toBe(true);
  const other = new Database(db.filename) as Database & { readonly inTransaction: boolean };
  other.exec("PRAGMA busy_timeout=0");
  other.exec("BEGIN IMMEDIATE");
  const retry = spyOn(console, "warn");
  const timer = setTimeout(() => {
    expect(db.inTransaction).toBe(false);
    other.exec("COMMIT");
  }, 30);
  try {
    await removeWorker(job, owner, true);
    const logs = retry.mock.calls.filter(call => call[0] === "[db-write-retry] retry" && call[1].operation === "releaseSyncWorker");
    expect(logs.length).toBeGreaterThan(0);
    expect(logs).toHaveLength(1);
    expect(logs[0][1]).toMatchObject({ phase: "handshake", policy: "coarse" });
    expect(logs[0][1].delayMs).toBeGreaterThanOrEqual(96);
    expect(logs[0][1].delayMs).toBeLessThanOrEqual(144);
    expect(db.query("SELECT 1 FROM sync_worker_leases WHERE jobId=?").get(job)).toBeNull();
    expect(db.inTransaction).toBe(false);
  } finally {
    clearTimeout(timer);
    retry.mockRestore();
    if (other.inTransaction) other.exec("ROLLBACK");
    other.close();
    await removeWorker(job, owner, true);
  }
});
