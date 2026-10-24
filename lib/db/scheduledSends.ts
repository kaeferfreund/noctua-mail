import { randomUUID } from "node:crypto";
import { getDb } from "./connection";
import { withDbWriteRetry } from "../dbWriteRetry";

export type ScheduledSendStatus = "queued" | "sending" | "sent" | "failed" | "cancelled";

/** Reason codes stored in `lastError`; the UI translates them, raw upstream text is never stored. */
export type ScheduledSendReason =
  | "rescheduled" | "cancelled" | "edited" | "discarded" | "sent_now"
  | "permission_revoked" | "identity_unavailable" | "draft_missing" | "draft_invalid"
  | "account_missing" | "smtp_rejected" | "send_failed" | "send_uncertain" | "interrupted";

export type ScheduledSend = {
  id: string;
  accountId: string;
  userId: string;
  draftId: string;
  sendAt: number;
  status: ScheduledSendStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError: ScheduledSendReason | null;
  leaseOwner: string | null;
  createdAt: number;
  updatedAt: number;
};

/** A row in `sending` blocks every other change to its draft until the claiming send settles. */
export class ScheduledSendBusyError extends Error {
  constructor() { super("The draft is being sent by its schedule."); this.name = "ScheduledSendBusyError"; }
}

/** Statuses shown to members: the active schedule and an unresolved failure. */
const VISIBLE_STATUSES = "('queued','sending','failed')";
/** Settling a draft (edit, discard, manual send) closes these; `sending` is never touched. */
const OPEN_STATUSES = "('queued','failed')";

function write<T>(name: string, action: (db: any) => T): Promise<T> {
  return getDb().then(db => withDbWriteRetry(name, () => db.transaction(() => action(db)).immediate()));
}

function hasSendingRow(db: any, accountId: string, draftId: string) {
  return Boolean(db.query("SELECT 1 FROM scheduled_sends WHERE accountId=? AND draftId=? AND status='sending'").get(accountId, draftId));
}

/**
 * Replaces any open schedule of the draft. Throws `ScheduledSendBusyError` while it is being sent.
 * `assertCurrent` runs inside the write transaction (live outbound authorization).
 */
export function createScheduledSend(input: {
  accountId: string; userId: string; draftId: string; sendAt: number; now?: number; assertCurrent?: (db: any) => void;
}) {
  return write("createScheduledSend", db => {
    input.assertCurrent?.(db);
    const now = input.now ?? Date.now();
    if (hasSendingRow(db, input.accountId, input.draftId)) throw new ScheduledSendBusyError();
    db.query(`UPDATE scheduled_sends SET status='cancelled',lastError='rescheduled',updatedAt=?
      WHERE accountId=? AND draftId=? AND status IN ${OPEN_STATUSES}`).run(now, input.accountId, input.draftId);
    const row: ScheduledSend = { id: randomUUID(), accountId: input.accountId, userId: input.userId, draftId: input.draftId,
      sendAt: input.sendAt, status: "queued", attempts: 0, nextAttemptAt: input.sendAt, lastError: null, leaseOwner: null,
      createdAt: now, updatedAt: now };
    db.query(`INSERT INTO scheduled_sends (id,accountId,userId,draftId,sendAt,status,attempts,nextAttemptAt,lastError,leaseOwner,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id, row.accountId, row.userId, row.draftId, row.sendAt, row.status,
      row.attempts, row.nextAttemptAt, row.lastError, row.leaseOwner, row.createdAt, row.updatedAt);
    return row;
  });
}

export async function listScheduledSends(accountId: string): Promise<ScheduledSend[]> {
  const db = await getDb();
  return db.query(`SELECT * FROM scheduled_sends WHERE accountId=? AND status IN ${VISIBLE_STATUSES} ORDER BY sendAt, id`)
    .all(accountId) as ScheduledSend[];
}

export async function getScheduledSend(id: string): Promise<ScheduledSend | null> {
  const db = await getDb();
  return (db.query("SELECT * FROM scheduled_sends WHERE id=?").get(id) as ScheduledSend | null) ?? null;
}

/** Cancels one schedule of the mailbox. `null` when unknown or already settled. */
export function cancelScheduledSend(accountId: string, id: string, now = Date.now()) {
  return write("cancelScheduledSend", db => {
    const row = db.query("SELECT * FROM scheduled_sends WHERE id=? AND accountId=?").get(id, accountId) as ScheduledSend | null;
    if (!row || !["queued", "failed", "sending"].includes(row.status)) return null;
    if (row.status === "sending") throw new ScheduledSendBusyError();
    db.query("UPDATE scheduled_sends SET status='cancelled',lastError='cancelled',updatedAt=? WHERE id=?").run(now, id);
    return { ...row, status: "cancelled" as const, lastError: "cancelled" as const, updatedAt: now };
  });
}

/**
 * Closes the open schedule of a draft before a manual change (edit, discard, send now).
 * Throws `ScheduledSendBusyError` while the scheduled send of that draft is running.
 */
export function releaseDraftSchedules(accountId: string, draftId: string, reason: ScheduledSendReason, now = Date.now()) {
  return write("releaseDraftSchedules", db => {
    if (hasSendingRow(db, accountId, draftId)) throw new ScheduledSendBusyError();
    return db.query(`UPDATE scheduled_sends SET status='cancelled',lastError=?,updatedAt=?
      WHERE accountId=? AND draftId=? AND status IN ${OPEN_STATUSES}`).run(reason, now, accountId, draftId).changes as number;
  });
}

/** Atomically moves due rows to `sending` for `owner`; a row is claimed by exactly one caller. */
export function claimDueScheduledSends(owner: string, now: number, limit: number) {
  return write("claimDueScheduledSends", db => {
    const due = db.query(`SELECT * FROM scheduled_sends WHERE status='queued' AND nextAttemptAt<=?
      ORDER BY nextAttemptAt, id LIMIT ?`).all(now, limit) as ScheduledSend[];
    const claimed: ScheduledSend[] = [];
    for (const row of due) {
      const result = db.query(`UPDATE scheduled_sends SET status='sending',leaseOwner=?,attempts=attempts+1,updatedAt=?
        WHERE id=? AND status='queued'`).run(owner, now, row.id);
      if (result.changes === 1) claimed.push({ ...row, status: "sending", leaseOwner: owner, attempts: row.attempts + 1, updatedAt: now });
    }
    return claimed;
  });
}

/** Settles a claimed row; only the claiming owner can. Returns false when the claim was lost. */
export function settleScheduledSend(id: string, owner: string, outcome:
  { status: "sent" | "failed" | "cancelled"; reason: ScheduledSendReason | null } |
  { status: "queued"; reason: ScheduledSendReason; nextAttemptAt: number }, now = Date.now()) {
  return write("settleScheduledSend", db => {
    const nextAttemptAt = outcome.status === "queued" ? outcome.nextAttemptAt : null;
    const result = db.query(`UPDATE scheduled_sends SET status=?,lastError=?,leaseOwner=NULL,updatedAt=?,
      nextAttemptAt=COALESCE(?,nextAttemptAt) WHERE id=? AND leaseOwner=? AND status='sending'`)
      .run(outcome.status, outcome.reason, now, nextAttemptAt, id, owner);
    return result.changes === 1;
  });
}

/**
 * Rows left in `sending` by a process that no longer exists become `failed/interrupted`.
 * They are never re-sent: the SMTP outcome of an interrupted attempt is unknown.
 */
export function failInterruptedScheduledSends(owner: string, ownerAlive: (leaseOwner: string) => boolean, now = Date.now()) {
  return write("failInterruptedScheduledSends", db => {
    const rows = db.query("SELECT id,leaseOwner FROM scheduled_sends WHERE status='sending' AND (leaseOwner IS NULL OR leaseOwner<>?)")
      .all(owner) as Array<{ id: string; leaseOwner: string | null }>;
    let failed = 0;
    for (const row of rows) {
      if (row.leaseOwner && ownerAlive(row.leaseOwner)) continue;
      failed += db.query(`UPDATE scheduled_sends SET status='failed',lastError='interrupted',leaseOwner=NULL,updatedAt=?
        WHERE id=? AND status='sending'`).run(now, row.id).changes as number;
    }
    return failed;
  });
}

export async function nextScheduledSendAttemptAt(): Promise<number | null> {
  const db = await getDb();
  const row = db.query("SELECT MIN(nextAttemptAt) AS at FROM scheduled_sends WHERE status='queued'").get() as { at: number | null };
  return row.at ?? null;
}

/** Drops settled history (sent/cancelled) older than `before`; failures stay until the draft is settled. */
export function pruneScheduledSends(before: number) {
  return write("pruneScheduledSends", db =>
    db.query("DELETE FROM scheduled_sends WHERE status IN ('sent','cancelled') AND updatedAt<?").run(before).changes as number);
}
