import type { Database } from "bun:sqlite";
import type {
  SpamRescanCounts,
  SpamRescanItem,
  SpamRescanJob,
  SpamRescanMoveStatus,
  SpamRescanPeriod,
  SpamRescanPhase,
  SpamRescanStage,
  SpamRescanStatus
} from "../mail/spam/rescanTypes";
import { withDbWriteRetry } from "../dbWriteRetry";
import { recordAdminAuditRow } from "./adminAudit";
import { getDb } from "./connection";

/**
 * Master tables of the admin rescan (lib/mail/spam/rescan.ts,
 * doc/SPAM-DETECTION.md): `spam_rescan_jobs` keeps the latest job per
 * mailbox, `spam_rescan_items` its preview list. Starting a job replaces the
 * mailbox's previous one; a mailbox has at most one running or moving job
 * (partial unique index).
 */
export class SpamRescanBusyError extends Error {
  constructor() {
    super("A rescan of this mailbox is already running");
    this.name = "SpamRescanBusyError";
  }
}

type JobRow = {
  id: string; accountId: string; status: SpamRescanStatus; period: SpamRescanPeriod; sinceDateValue: number | null; withModel: number;
  modelLimit: number; phase: SpamRescanPhase | null; processed: number; total: number; counts: string | null; error: string | null;
  createdByUserId: string; createdAt: number; updatedAt: number; finishedAt: number | null;
};
type ItemRow = {
  messageId: string; rfcMessageId: string | null; fromAddr: string; subject: string; date: string; dateValue: number;
  stage: SpamRescanStage; reasons: string | null; score: number | null; moveStatus: SpamRescanMoveStatus | null;
};

export type StoredSpamRescanJob = SpamRescanJob & { sinceDateValue: number | null };
export type NewSpamRescanItem = Omit<SpamRescanItem, "moveStatus"> & { rfcMessageId: string | null };
export type StoredSpamRescanItem = SpamRescanItem & { rfcMessageId: string | null };

const JOB_COLUMNS = `id, accountId, status, period, sinceDateValue, withModel, modelLimit, phase, processed, total, counts, error,
  createdByUserId, createdAt, updatedAt, finishedAt`;
const ACTIVE = `('running','moving')`;
const ID_CHUNK = 400;

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function mapJob(row: JobRow): StoredSpamRescanJob {
  return {
    id: row.id, accountId: row.accountId, status: row.status, period: row.period, sinceDateValue: row.sinceDateValue,
    withModel: row.withModel === 1, modelLimit: row.modelLimit, phase: row.phase, processed: row.processed, total: row.total,
    counts: parseJson<SpamRescanCounts>(row.counts, {}), error: row.error === "interrupted" || row.error === "failed" ? row.error : null,
    createdByUserId: row.createdByUserId, createdAt: row.createdAt, updatedAt: row.updatedAt, finishedAt: row.finishedAt
  };
}

function deleteAccountJobs(db: Database, accountId: string) {
  db.prepare(`DELETE FROM spam_rescan_items WHERE jobId IN (SELECT id FROM spam_rescan_jobs WHERE accountId = ?)`).run(accountId);
  db.prepare(`DELETE FROM spam_rescan_jobs WHERE accountId = ?`).run(accountId);
}

/** Account deletion (deleteAccountControlPlane): the preview lists name senders and subjects. */
export function deleteSpamRescanRowsForAccount(db: Database, accountId: string) {
  deleteAccountJobs(db, accountId);
}

/** Inserts a running job, replacing the mailbox's previous one, with the audit entry in the same transaction. */
export async function createSpamRescanJob(input: {
  id: string; accountId: string; period: SpamRescanPeriod; sinceDateValue: number | null; withModel: boolean; modelLimit: number;
  ownerInstance: string; userId: string; counts: SpamRescanCounts;
}) {
  return withDbWriteRetry("createSpamRescanJob", async () => {
    const db = await getDb();
    db.transaction(() => {
      if (db.prepare(`SELECT 1 FROM spam_rescan_jobs WHERE accountId = ? AND status IN ${ACTIVE}`).get(input.accountId)) throw new SpamRescanBusyError();
      deleteAccountJobs(db, input.accountId);
      const now = Date.now();
      try {
        db.prepare(`INSERT INTO spam_rescan_jobs (id, accountId, status, period, sinceDateValue, withModel, modelLimit, phase, processed, total,
            counts, ownerInstance, createdByUserId, createdAt, updatedAt)
          VALUES (?, ?, 'running', ?, ?, ?, ?, 'server-flag', 0, 0, ?, ?, ?, ?, ?)`)
          .run(input.id, input.accountId, input.period, input.sinceDateValue, input.withModel ? 1 : 0, input.modelLimit,
            JSON.stringify(input.counts), input.ownerInstance, input.userId, now, now);
      } catch (error) {
        // idx_spam_rescan_jobs_active: another process started one meanwhile.
        if (String((error as { code?: unknown })?.code ?? "").startsWith("SQLITE_CONSTRAINT")) throw new SpamRescanBusyError();
        throw error;
      }
      recordAdminAuditRow(db, { actorUserId: input.userId, action: "spam_rescan.start", targetAccountId: input.accountId,
        payload: { jobId: input.id, period: input.period, withModel: input.withModel, modelLimit: input.modelLimit, inboxRows: input.counts.inboxRows ?? 0 } });
    }).immediate();
  });
}

export async function getSpamRescanJob(jobId: string) {
  const db = await getDb();
  const row = db.prepare(`SELECT ${JOB_COLUMNS} FROM spam_rescan_jobs WHERE id = ?`).get(jobId) as JobRow | undefined;
  return row ? mapJob(row) : null;
}

export async function getLatestSpamRescanJob(accountId: string) {
  const db = await getDb();
  const row = db.prepare(`SELECT ${JOB_COLUMNS} FROM spam_rescan_jobs WHERE accountId = ? ORDER BY createdAt DESC LIMIT 1`).get(accountId) as JobRow | undefined;
  return row ? mapJob(row) : null;
}

export async function listActiveSpamRescanJobs() {
  const db = await getDb();
  return (db.prepare(`SELECT ${JOB_COLUMNS} FROM spam_rescan_jobs WHERE status IN ${ACTIVE} ORDER BY createdAt`).all() as JobRow[]).map(mapJob);
}

export type SpamRescanJobPatch = Partial<Pick<SpamRescanJob, "status" | "phase" | "processed" | "total" | "counts" | "error" | "finishedAt">>;

/** Updates a job; `whileStatus` only touches it in one of these states (a cancelled or replaced job stays as it is). */
export async function updateSpamRescanJob(jobId: string, patch: SpamRescanJobPatch, whileStatus?: readonly SpamRescanStatus[]) {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, key === "counts" ? JSON.stringify(value) : value] as const);
  return withDbWriteRetry("updateSpamRescanJob", async () => {
    const db = await getDb();
    const guard = whileStatus?.length ? ` AND status IN (${whileStatus.map(() => "?").join(", ")})` : "";
    return db.prepare(`UPDATE spam_rescan_jobs SET ${[...entries.map(([key]) => `${key} = ?`), "updatedAt = ?"].join(", ")} WHERE id = ?${guard}`)
      .run(...entries.map(([, value]) => value as string | number | null), Date.now(), jobId, ...(whileStatus ?? [])).changes > 0;
  });
}

export async function addSpamRescanItems(jobId: string, items: readonly NewSpamRescanItem[]) {
  if (!items.length) return;
  return withDbWriteRetry("addSpamRescanItems", async () => {
    const db = await getDb();
    const insert = db.prepare(`INSERT OR IGNORE INTO spam_rescan_items
      (jobId, messageId, rfcMessageId, fromAddr, subject, date, dateValue, stage, reasons, score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    db.transaction(() => {
      for (const item of items) {
        insert.run(jobId, item.id, item.rfcMessageId, item.from, item.subject, item.date, item.dateValue, item.stage,
          item.reasons.length ? JSON.stringify(item.reasons) : null, item.score);
      }
    }).immediate();
  });
}

export async function listSpamRescanItems(jobId: string): Promise<StoredSpamRescanItem[]> {
  const db = await getDb();
  const rows = db.prepare(`SELECT messageId, rfcMessageId, fromAddr, subject, date, dateValue, stage, reasons, score, moveStatus
    FROM spam_rescan_items WHERE jobId = ? ORDER BY dateValue DESC, messageId`).all(jobId) as ItemRow[];
  return rows.map((row) => ({
    id: row.messageId, rfcMessageId: row.rfcMessageId, from: row.fromAddr, subject: row.subject, date: row.date, dateValue: row.dateValue,
    stage: row.stage, reasons: parseJson<string[]>(row.reasons, []), score: row.score, moveStatus: row.moveStatus
  }));
}

/**
 * Marks the selected items of a finished job as pending and switches it to
 * "moving", with the audit entry, in one transaction. Items already moved are
 * not selected again. The job now belongs to `ownerInstance` (the process
 * running the move), so reconcileInterruptedSpamRescans never resets it while
 * it moves, also when the scan ran in an earlier process. Returns the number
 * of selected items, or null when the job is not in a state that allows a move.
 */
export async function beginSpamRescanMove(jobId: string, messageIds: readonly string[], userId: string, ownerInstance: string) {
  return withDbWriteRetry("beginSpamRescanMove", async () => {
    const db = await getDb();
    return db.transaction(() => {
      const job = db.prepare(`SELECT accountId, status, counts FROM spam_rescan_jobs WHERE id = ?`).get(jobId) as
        Pick<JobRow, "accountId" | "status" | "counts"> | undefined;
      if (!job) return null;
      if (job.status === "running" || job.status === "moving") throw new SpamRescanBusyError();
      if (job.status === "failed") return null;
      let selected = 0;
      for (let start = 0; start < messageIds.length; start += ID_CHUNK) {
        const chunk = messageIds.slice(start, start + ID_CHUNK);
        selected += db.prepare(`UPDATE spam_rescan_items SET moveStatus = 'pending'
          WHERE jobId = ? AND (moveStatus IS NULL OR moveStatus = 'error') AND messageId IN (${chunk.map(() => "?").join(", ")})`)
          .run(jobId, ...chunk).changes;
      }
      if (!selected) return 0;
      db.prepare(`UPDATE spam_rescan_jobs SET status = 'moving', phase = 'moving', processed = 0, total = ?, error = NULL, ownerInstance = ?,
          updatedAt = ? WHERE id = ?`).run(selected, ownerInstance, Date.now(), jobId);
      recordAdminAuditRow(db, { actorUserId: userId, action: "spam_rescan.move", targetAccountId: job.accountId,
        payload: { jobId, selected, listed: (parseJson<SpamRescanCounts>(job.counts, {}).items ?? 0) } });
      return selected;
    }).immediate();
  });
}

export async function setSpamRescanItemMoveStatus(jobId: string, messageId: string, status: SpamRescanMoveStatus | null) {
  return withDbWriteRetry("setSpamRescanItemMoveStatus", async () => {
    const db = await getDb();
    db.prepare(`UPDATE spam_rescan_items SET moveStatus = ? WHERE jobId = ? AND messageId = ?`).run(status, jobId, messageId);
  });
}

/** Ends a move: still pending items (a cancel) are unselected again, the job is ready for another move. */
export async function finishSpamRescanMove(jobId: string, counts: SpamRescanCounts, error: SpamRescanJob["error"] = null) {
  return withDbWriteRetry("finishSpamRescanMove", async () => {
    const db = await getDb();
    db.transaction(() => {
      db.prepare(`UPDATE spam_rescan_items SET moveStatus = NULL WHERE jobId = ? AND moveStatus = 'pending'`).run(jobId);
      db.prepare(`UPDATE spam_rescan_jobs SET status = 'ready', phase = NULL, counts = ?, error = ?, updatedAt = ?, finishedAt = ? WHERE id = ? AND status = 'moving'`)
        .run(JSON.stringify(counts), error, Date.now(), Date.now(), jobId);
    }).immediate();
  });
}

/**
 * Jobs another server process left running or moving were interrupted by a
 * restart: a scan becomes "cancelled", a move goes back to "ready" with its
 * unprocessed selection cleared (moved items keep their status).
 */
export async function reconcileInterruptedSpamRescans(ownerInstance: string) {
  return withDbWriteRetry("reconcileInterruptedSpamRescans", async () => {
    const db = await getDb();
    return db.transaction(() => {
      const stale = `SELECT id FROM spam_rescan_jobs WHERE status IN ${ACTIVE} AND ownerInstance != ?`;
      db.prepare(`UPDATE spam_rescan_items SET moveStatus = NULL WHERE moveStatus = 'pending' AND jobId IN (${stale})`).run(ownerInstance);
      const now = Date.now();
      return db.prepare(`UPDATE spam_rescan_jobs SET status = CASE status WHEN 'running' THEN 'cancelled' ELSE 'ready' END,
          phase = NULL, error = 'interrupted', updatedAt = ?, finishedAt = ? WHERE status IN ${ACTIVE} AND ownerInstance != ?`)
        .run(now, now, ownerInstance).changes;
    }).immediate();
  });
}
