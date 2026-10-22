import type { Database } from "bun:sqlite";
import { createRequire } from "module";
import { createHash, randomUUID } from "crypto";
import { mkdirSync } from "fs";
import path from "path";
import { getDataDir } from "./runtimePaths";
import type { WorkerJobRecord, WorkerJobRegistryConfig } from "./workerJobRegistry";

type StoredJob = WorkerJobRecord & { argsJson: string; dirty: number; ownerPid: number | null };
const runtimeRequire = createRequire(import.meta.url);
const JOB_TTL_MS = 30 * 60 * 1000;
const RETRY_COOLDOWN_MS = 1000;
const liveProcess = (pid?: number | null) => {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
};
const publicJob = ({ id, accountId, status, startedAt, finishedAt, error, pid }: StoredJob): WorkerJobRecord =>
  ({ id, accountId, status, startedAt, ...(finishedAt == null ? {} : { finishedAt }),
    ...(error == null ? {} : { error }), ...(pid == null ? {} : { pid }) });

/** Cross-process admission, bounded workers and one coalescing slot per account.
 * Jobs are ephemeral runtime state, separate from mailbox/configuration storage.
 */
export function createBoundedWorkerJobRegistry(config: WorkerJobRegistryConfig) {
  const registryId = createHash("sha256").update(config.registryName ?? config.scriptPath).digest("hex").slice(0, 16);
  const withStore = <T>(fn: (db: Database) => T): T => {
    const directory = path.join(getDataDir(), "db");
    mkdirSync(directory, { recursive: true });
    // Keep the Bun-only builtin lazy, like the main connection module: Next's
    // build-time route discovery may execute under Node without opening storage.
    const { Database: RuntimeDatabase } = runtimeRequire("bun:sqlite");
    const db: Database = new RuntimeDatabase(path.join(directory, `worker-jobs-${registryId}.db`));
    try {
      db.exec("PRAGMA busy_timeout=5000");
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='active_account'").get()) {
        db.transaction(() => db.exec(`CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY, accountId TEXT NOT NULL, status TEXT NOT NULL,
          startedAt INTEGER NOT NULL, finishedAt INTEGER, error TEXT, pid INTEGER,
          ownerPid INTEGER, argsJson TEXT NOT NULL, dirty INTEGER NOT NULL DEFAULT 0
        ); CREATE UNIQUE INDEX IF NOT EXISTS active_account ON jobs(accountId) WHERE status IN ('queued','running')`)).immediate();
      }
      return fn(db);
    } finally { db.close(); }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (id: string, exitCode: number, error: string) => {
    withStore(db => db.transaction(() => {
      const job = db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as StoredJob | null;
      if (!job || job.status !== "running") return;
      if (job.dirty) {
        db.prepare("UPDATE jobs SET status='queued',dirty=0,pid=NULL,ownerPid=NULL WHERE id=?").run(id);
      } else {
        db.prepare("UPDATE jobs SET status=?,finishedAt=?,error=? WHERE id=?")
          .run(exitCode === 0 ? "done" : "failed", Date.now(), exitCode === 0 ? null : error, id);
      }
    }).immediate());
    pump();
  };
  const pump = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const pending = withStore(db => db.transaction(() => {
      const now = Date.now();
      db.prepare("DELETE FROM jobs WHERE finishedAt < ?").run(now - (config.jobTtlMs ?? JOB_TTL_MS));
      const running = db.prepare("SELECT * FROM jobs WHERE status='running'").all() as StoredJob[];
      for (const job of running) {
        if (!liveProcess(job.pid) && !liveProcess(job.ownerPid)) {
          db.prepare("UPDATE jobs SET status='failed',finishedAt=?,error=? WHERE id=?")
            .run(now, "Worker process is no longer running.", job.id);
        }
      }
      const count = (db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE status='running'").get() as { n: number }).n;
      const queued = db.prepare("SELECT * FROM jobs WHERE status='queued' ORDER BY startedAt,id LIMIT ?")
        .all(Math.max(0, config.maxConcurrentJobs! - count)) as StoredJob[];
      for (const job of queued) {
        try {
          const bun = (globalThis as typeof globalThis & { Bun?: any }).Bun;
          if (!bun?.spawn) throw new Error(config.runtimeMissingMessage ?? "Bun runtime is required to spawn a worker.");
          const child = bun.spawn([...(config.commandPrefix ?? []), "bun", "run", config.scriptPath, job.accountId, ...JSON.parse(job.argsJson)], {
            cwd: process.cwd(), env: { ...process.env }, stdout: config.spawnStdout ?? "ignore", stderr: config.spawnStderr ?? "pipe"
          });
          db.prepare("UPDATE jobs SET status='running',pid=?,ownerPid=? WHERE id=?").run(child.pid, process.pid, job.id);
          // Consume stderr immediately so a full pipe cannot deadlock the worker.
          const stderr = config.readStderrText !== false && child.stderr ? new Response(child.stderr).text().catch(() => "") : Promise.resolve("");
          void child.exited.then(async (code: number) => finish(job.id, code, (await stderr).trim() || `Worker exited with code ${code}`));
        } catch (error) {
          db.prepare("UPDATE jobs SET status='failed',finishedAt=?,error=? WHERE id=?")
            .run(now, error instanceof Error ? error.message : "Failed to start worker", job.id);
        }
      }
      return !!db.prepare("SELECT 1 FROM jobs WHERE status IN ('queued','running') LIMIT 1").get();
    }).immediate());
    if (pending) {
      timer = setTimeout(pump, 250);
      timer.unref();
    }
  };
  const getJob = (id: string) => {
    pump();
    const job = withStore(db => db.prepare("SELECT * FROM jobs WHERE id=?").get(id) as StoredJob | null);
    return job ? publicJob(job) : null;
  };
  const getLatestJob = (accountId: string) => {
    pump();
    const job = withStore(db => db.prepare("SELECT * FROM jobs WHERE accountId=? ORDER BY startedAt DESC,rowid DESC LIMIT 1").get(accountId) as StoredJob | null);
    return job ? publicJob(job) : null;
  };
  const startJob = (accountId: string, args: string[] = [], invalidate = false) => {
    const id = withStore(db => db.transaction(() => {
      const active = db.prepare("SELECT * FROM jobs WHERE accountId=? AND status IN ('queued','running')").get(accountId) as StoredJob | null;
      if (active) {
        // Configuration created during a running scan requires one trailing scan.
        if (invalidate && active.status === "running") db.prepare("UPDATE jobs SET dirty=1 WHERE id=?").run(active.id);
        return active.id;
      }
      const recent = db.prepare("SELECT * FROM jobs WHERE accountId=? AND finishedAt>? ORDER BY finishedAt DESC LIMIT 1")
        .get(accountId, Date.now() - RETRY_COOLDOWN_MS) as StoredJob | null;
      if (recent && !invalidate) return recent.id;
      const id = randomUUID();
      db.prepare("INSERT INTO jobs(id,accountId,status,startedAt,argsJson) VALUES(?,?,'queued',?,?)").run(id, accountId, Date.now(), JSON.stringify(args));
      return id;
    }).immediate());
    return getJob(id)!;
  };
  return { getJob, startJob, getLatestJob };
}
