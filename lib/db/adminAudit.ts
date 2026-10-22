import type { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import type { AdminAuditAction, AdminAuditEntry } from "../data";
import { withDbWriteRetry } from "../dbWriteRetry";
import { getDb } from "./connection";
import { isPlainObject, mapAdminAuditRow, type StoredAdminAuditRow } from "./rowParsers";

export type AdminAuditInput = {
  actorUserId: string;
  action: AdminAuditAction;
  targetUserId?: string | null;
  targetAccountId?: string | null;
  payload?: Record<string, unknown> | null;
};

export const ADMIN_AUDIT_DEFAULT_LIMIT = 100;
export const ADMIN_AUDIT_MAX_LIMIT = 500;

// Keys whose values must never reach the audit trail, matched
// case-insensitively at every nesting level. Callers are expected to pass
// secret-free payloads; this is the defensive second line.
const SECRET_KEY_PATTERN =
  /^(pass|pwd)$|password|passwd|passphrase|secret|token|hash|api[-_]?key|credential|uri|url|code/i;

function stripSecretValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecretValue);
  return isPlainObject(value) ? stripSecretKeys(value) : value;
}

function stripSecretKeys(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => !SECRET_KEY_PATTERN.test(key))
      .map(([key, value]) => [key, stripSecretValue(value)])
  );
}

/** Writes one `admin_audit` row; password-like keys are removed from `payload`. */
export async function recordAdminAudit(input: AdminAuditInput): Promise<AdminAuditEntry> {
  const db = await getDb();
  return withDbWriteRetry("recordAdminAudit", () => recordAdminAuditRow(db, input));
}

/** Synchronous writer for audit entries that must commit with the master mutation. */
export function recordAdminAuditRow(db: Database, input: AdminAuditInput): AdminAuditEntry {
  const payload = input.payload ? stripSecretKeys(input.payload) : null;
  const row: StoredAdminAuditRow = {
    id: randomUUID(),
    actorUserId: input.actorUserId,
    action: input.action,
    targetUserId: input.targetUserId ?? null,
    targetAccountId: input.targetAccountId ?? null,
    payload: payload ? JSON.stringify(payload) : null,
    createdAt: Date.now()
  };
  db.prepare(
      `INSERT INTO admin_audit
       (id, actorUserId, action, targetUserId, targetAccountId, payload, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row.id,
      row.actorUserId,
      row.action,
      row.targetUserId,
      row.targetAccountId,
      row.payload,
      row.createdAt
    );
  return mapAdminAuditRow(row);
}

export function clampAuditLimit(limit: number | undefined) {
  if (limit === undefined || !Number.isFinite(limit)) return ADMIN_AUDIT_DEFAULT_LIMIT;
  return Math.min(ADMIN_AUDIT_MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

export function encodeAdminAuditCursor(entry: Pick<AdminAuditEntry, "createdAt" | "id">): string {
  return Buffer.from(JSON.stringify([entry.createdAt, entry.id])).toString("base64url");
}

export function decodeAdminAuditCursor(cursor: string): { createdAt: number; id: string } {
  try {
    if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 2 || !Number.isSafeInteger(value[0]) || value[0] < 0 || typeof value[1] !== "string" || !value[1] || value[1].length > 128) throw new Error();
    return { createdAt: value[0], id: value[1] };
  } catch { throw new RangeError("Invalid audit cursor"); }
}

/** Newest (createdAt,id) first. Numeric `before` remains a legacy storage API. */
export async function listAdminAudit(
  options: { limit?: number; before?: number | string | null } = {}
): Promise<AdminAuditEntry[]> {
  const db = await getDb();
  const limit = clampAuditLimit(options.limit);
  const cursor = typeof options.before === "string" ? decodeAdminAuditCursor(options.before) : null;
  const before = typeof options.before === "number" && Number.isFinite(options.before) ? options.before : null;
  const rows = db
    .prepare(
      `SELECT id, actorUserId, action, targetUserId, targetAccountId, payload, createdAt
       FROM admin_audit
       ${cursor ? "WHERE (createdAt < ? OR (createdAt = ? AND id < ?))" : before === null ? "" : "WHERE createdAt < ?"}
       ORDER BY createdAt DESC, id DESC
       LIMIT ?`
    )
    .all(...(cursor ? [cursor.createdAt, cursor.createdAt, cursor.id, limit] : before === null ? [limit] : [before, limit])) as StoredAdminAuditRow[];
  return rows.map(mapAdminAuditRow);
}
