import { randomUUID } from "node:crypto";
import { getDb } from "./connection";
import { newLeaseOwner, processExited } from "./processLeases";
import { withDbWriteRetry } from "../dbWriteRetry";

export type ScheduledSendStatus = "queued" | "sending" | "sent" | "failed" | "cancelled";

/** Reason codes stored in `lastError`; the UI translates them, raw upstream text is never stored. */
export type ScheduledSendReason =
  | "rescheduled" | "cancelled" | "edited" | "discarded" | "sent_now" | "manual_send"
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
  leaseStartedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

/**
 * A `sending` lease older than this is interrupted, whoever holds it: SMTP plus the post-send
 * deadline end well before, and a crashed holder whose pid was reused must not block the draft.
 */
export const SCHEDULED_SEND_LEASE_MAX_MS = 10 * 60_000;

/** A row in `sending` blocks every other change to its draft until the claiming send settles. */
export class ScheduledSendBusyError extends Error {
  constructor() { super("The draft is being sent by its schedule."); this.name = "ScheduledSendBusyError"; }
}

/** The draft's schedule already sent it; a manual send would be a second copy. */
export class ScheduledSendAlreadySentError extends Error {
  constructor() { super("The draft was already sent by its schedule."); this.name = "ScheduledSendAlreadySentError"; }
}

/** Statuses shown to members: the active schedule and an unresolved failure. */
const VISIBLE_STATUSES = "('queued','sending','failed')";
/** Settling a draft (edit, discard, manual send) closes these; `sending` is never touched. */
const OPEN_STATUSES = "('queued','failed')";

const ownerKey = Symbol.for("noctua.scheduledSendProcessOwner");
const processHost = globalThis as typeof globalThis & { [ownerKey]?: string };
/** One `pid:uuid` per server process, shared by every bundle: the job's lease owner and the prefix of manual holds. */
export function processScheduleOwner() {
  return processHost[ownerKey] ??= newLeaseOwner();
}

/** Lease owners: `pid:uuid` (job) or `pid:uuid/manual:uuid` (a manual edit/discard/send of the draft). */
export function scheduleLeaseOwnerAlive(leaseOwner: string, ownProcess = processScheduleOwner()) {
  const processPart = leaseOwner.split("/", 1)[0];
  if (processPart === ownProcess) return true;
  const pid = Number(processPart.split(":", 1)[0]);
  // The same pid with another uuid is an earlier incarnation of this process (container restart).
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) return false;
  return !processExited(pid);
}

function write<T>(name: string, action: (db: any) => T): Promise<T> {
  return getDb().then(db => withDbWriteRetry(name, () => db.transaction(() => action(db)).immediate()));
}

/** `sending` → `failed/interrupted` for leases past the age limit (never re-sent: the SMTP outcome is unknown). */
function expireStaleLeases(db: any, now: number, scope?: { accountId: string; draftId?: string; id?: string }) {
  const filters = ["status='sending'", "COALESCE(leaseStartedAt,updatedAt)<=?"];
  const values: unknown[] = [now - SCHEDULED_SEND_LEASE_MAX_MS];
  if (scope) { filters.push("accountId=?"); values.push(scope.accountId); }
  if (scope?.draftId) { filters.push("draftId=?"); values.push(scope.draftId); }
  if (scope?.id) { filters.push("id=?"); values.push(scope.id); }
  return db.query(`UPDATE scheduled_sends SET status='failed',lastError='interrupted',leaseOwner=NULL,leaseStartedAt=NULL,updatedAt=?
    WHERE ${filters.join(" AND ")}`).run(now, ...values).changes as number;
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
    expireStaleLeases(db, now, { accountId: input.accountId, draftId: input.draftId });
    if (hasSendingRow(db, input.accountId, input.draftId)) throw new ScheduledSendBusyError();
    db.query(`UPDATE scheduled_sends SET status='cancelled',lastError='rescheduled',updatedAt=?
      WHERE accountId=? AND draftId=? AND status IN ${OPEN_STATUSES}`).run(now, input.accountId, input.draftId);
    const row: ScheduledSend = { id: randomUUID(), accountId: input.accountId, userId: input.userId, draftId: input.draftId,
      sendAt: input.sendAt, status: "queued", attempts: 0, nextAttemptAt: input.sendAt, lastError: null, leaseOwner: null,
      leaseStartedAt: null, createdAt: now, updatedAt: now };
    db.query(`INSERT INTO scheduled_sends (id,accountId,userId,draftId,sendAt,status,attempts,nextAttemptAt,lastError,leaseOwner,leaseStartedAt,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(row.id, row.accountId, row.userId, row.draftId, row.sendAt, row.status,
      row.attempts, row.nextAttemptAt, row.lastError, row.leaseOwner, row.leaseStartedAt, row.createdAt, row.updatedAt);
    return row;
  });
}

/** Open, sending and failed schedules of the mailbox, optionally of one draft only. */
export async function listScheduledSends(accountId: string, draftId?: string): Promise<ScheduledSend[]> {
  const db = await getDb();
  return (draftId
    ? db.query(`SELECT * FROM scheduled_sends WHERE accountId=? AND draftId=? AND status IN ${VISIBLE_STATUSES} ORDER BY sendAt, id`).all(accountId, draftId)
    : db.query(`SELECT * FROM scheduled_sends WHERE accountId=? AND status IN ${VISIBLE_STATUSES} ORDER BY sendAt, id`).all(accountId)) as ScheduledSend[];
}

export async function getScheduledSend(id: string): Promise<ScheduledSend | null> {
  const db = await getDb();
  return (db.query("SELECT * FROM scheduled_sends WHERE id=?").get(id) as ScheduledSend | null) ?? null;
}

/** Cancels one schedule of the mailbox. `null` when unknown or already settled. */
export function cancelScheduledSend(accountId: string, id: string, now = Date.now()) {
  return write("cancelScheduledSend", db => {
    expireStaleLeases(db, now, { accountId, id });
    const row = db.query("SELECT * FROM scheduled_sends WHERE id=? AND accountId=?").get(id, accountId) as ScheduledSend | null;
    if (!row || !["queued", "failed", "sending"].includes(row.status)) return null;
    if (row.status === "sending") throw new ScheduledSendBusyError();
    db.query("UPDATE scheduled_sends SET status='cancelled',lastError='cancelled',updatedAt=? WHERE id=?").run(now, id);
    return { ...row, status: "cancelled" as const, lastError: "cancelled" as const, updatedAt: now };
  });
}

/**
 * Takes the draft's queued schedule out of the job's reach for a manual change (edit, discard,
 * send now, compose send): `queued` → `sending` under `owner`. Throws `ScheduledSendBusyError`
 * while the job sends it and, for sends (`rejectSent`), `ScheduledSendAlreadySentError` once the
 * schedule sent it.
 */
export function holdDraftSchedules(accountId: string, draftId: string, owner: string, rejectSent: boolean, now = Date.now()) {
  return write("holdDraftSchedules", db => {
    expireStaleLeases(db, now, { accountId, draftId });
    if (hasSendingRow(db, accountId, draftId)) throw new ScheduledSendBusyError();
    if (rejectSent && db.query("SELECT 1 FROM scheduled_sends WHERE accountId=? AND draftId=? AND status='sent'").get(accountId, draftId)) {
      throw new ScheduledSendAlreadySentError();
    }
    const held = db.query(`UPDATE scheduled_sends SET status='sending',leaseOwner=?,leaseStartedAt=?,updatedAt=?
      WHERE accountId=? AND draftId=? AND status='queued'`).run(owner, now, now, accountId, draftId).changes as number;
    // Opening compose may already have cancelled the schedule. Still serialize sends of this
    // draft, and retain a durable receipt before Sent-copy work can leave the draft visible.
    if (rejectSent && !held) {
      db.query(`INSERT INTO scheduled_sends
        (id,accountId,userId,draftId,sendAt,status,attempts,nextAttemptAt,lastError,leaseOwner,leaseStartedAt,createdAt,updatedAt)
        VALUES (?,?,?, ?,?,'sending',0,?,'manual_send',?,?,?,?)`)
        .run(randomUUID(), accountId, "", draftId, now, now, owner, now, now, now);
      return 1;
    }
    return held;
  });
}

/**
 * Ends a manual hold. `done`: the change happened, the schedule (and an old failure) is closed.
 * `restore`: it did not happen, the schedule is queued again. `uncertain`: a send may have gone
 * out, the schedule fails as `send_uncertain` instead of sending a possible second copy.
 */
export function finishDraftScheduleHold(accountId: string, draftId: string, owner: string,
  outcome: { kind: "done"; reason: ScheduledSendReason } | { kind: "restore" } | { kind: "uncertain" }, now = Date.now()) {
  return write("finishDraftScheduleHold", db => {
    const held = "accountId=? AND draftId=? AND status='sending' AND leaseOwner=?";
    if (outcome.kind === "restore") {
      return db.query(`UPDATE scheduled_sends SET status=CASE WHEN lastError='manual_send' THEN 'cancelled' ELSE 'queued' END,
        lastError=CASE WHEN lastError='manual_send' THEN 'cancelled' ELSE lastError END,
        leaseOwner=NULL,leaseStartedAt=NULL,updatedAt=? WHERE ${held}`)
        .run(now, accountId, draftId, owner).changes as number;
    }
    if (outcome.kind === "uncertain") {
      return db.query(`UPDATE scheduled_sends SET status='failed',lastError='send_uncertain',leaseOwner=NULL,leaseStartedAt=NULL,updatedAt=? WHERE ${held}`)
        .run(now, accountId, draftId, owner).changes as number;
    }
    const status = outcome.reason === "sent_now" ? "sent" : "cancelled";
    const closed = db.query(`UPDATE scheduled_sends SET status=?,lastError=?,leaseOwner=NULL,leaseStartedAt=NULL,updatedAt=? WHERE ${held}`)
      .run(status, outcome.reason, now, accountId, draftId, owner).changes as number;
    return closed + (db.query(`UPDATE scheduled_sends SET status='cancelled',lastError=?,updatedAt=? WHERE accountId=? AND draftId=? AND status='failed'`)
      .run(outcome.reason, now, accountId, draftId).changes as number);
  });
}

/** Atomically moves due rows to `sending` for `owner`; a row is claimed by exactly one caller. */
export function claimDueScheduledSends(owner: string, now: number, limit: number) {
  return write("claimDueScheduledSends", db => {
    const due = db.query(`SELECT * FROM scheduled_sends WHERE status='queued' AND nextAttemptAt<=?
      ORDER BY nextAttemptAt, id LIMIT ?`).all(now, limit) as ScheduledSend[];
    const claimed: ScheduledSend[] = [];
    for (const row of due) {
      const result = db.query(`UPDATE scheduled_sends SET status='sending',leaseOwner=?,leaseStartedAt=?,attempts=attempts+1,updatedAt=?
        WHERE id=? AND status='queued'`).run(owner, now, now, row.id);
      if (result.changes === 1) claimed.push({ ...row, status: "sending", leaseOwner: owner, leaseStartedAt: now, attempts: row.attempts + 1, updatedAt: now });
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
    const result = db.query(`UPDATE scheduled_sends SET status=?,lastError=?,leaseOwner=NULL,leaseStartedAt=NULL,updatedAt=?,
      nextAttemptAt=COALESCE(?,nextAttemptAt) WHERE id=? AND leaseOwner=? AND status='sending'`)
      .run(outcome.status, outcome.reason, now, nextAttemptAt, id, owner);
    return result.changes === 1;
  });
}

/**
 * `sending` rows of a process that no longer exists, or whose lease passed the age limit,
 * become `failed/interrupted`. They are never re-sent: the SMTP outcome is unknown.
 */
export function failInterruptedScheduledSends(ownerAlive: (leaseOwner: string) => boolean = scheduleLeaseOwnerAlive, now = Date.now()) {
  return write("failInterruptedScheduledSends", db => {
    let failed = expireStaleLeases(db, now);
    const rows = db.query("SELECT id,leaseOwner FROM scheduled_sends WHERE status='sending'").all() as Array<{ id: string; leaseOwner: string | null }>;
    for (const row of rows) {
      if (row.leaseOwner && ownerAlive(row.leaseOwner)) continue;
      failed += db.query(`UPDATE scheduled_sends SET status='failed',lastError='interrupted',leaseOwner=NULL,leaseStartedAt=NULL,updatedAt=?
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
