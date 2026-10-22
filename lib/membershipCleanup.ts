import { existsSync } from "fs";
import { randomUUID } from "crypto";
import { getDb, configureAccountDb } from "./db/connection";
import { getDefaultAccountDbPath } from "./runtimePaths";
import { withDbWriteRetry } from "./dbWriteRetry";

export type MembershipCleanupActor = { userId: string | null; clientId: string };
/** No collaboration import or schema creation: safe before Stage 2 is installed. */
export async function cleanupUserAccountAccess(accountId: string, userId: string, actor: MembershipCleanupActor): Promise<{ status: "not_installed" | "complete"; unassigned: number }> {
  const master = await getDb();
  const account = master.prepare("SELECT dbPath FROM accounts WHERE id=?").get(accountId) as { dbPath?: string } | undefined;
  if (!account) throw new Error("Cleanup mailbox not found");
  const dbPath = account.dbPath?.trim() || getDefaultAccountDbPath(accountId);
  if (!existsSync(dbPath)) return { status: "not_installed", unassigned: 0 };
  const { Database } = await import("bun:sqlite");
  const db = new Database(dbPath, { create: false, readwrite: true });
  try {
    configureAccountDb(db, 0);
    return await withDbWriteRetry("cleanupUserAccountAccess", () => db.transaction(() => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('thread_collab_state','thread_activity')").all();
      if (!tables.length) return { status: "not_installed" as const, unassigned: 0 };
      if (tables.length !== 2) throw new Error("Incomplete collaboration cleanup schema");
      const activityInsert = db.prepare(`INSERT INTO thread_activity
        (id,accountId,threadId,type,actorUserId,actorClientId,payload,createdAt) VALUES (?,?,?,'unassigned',?,'system',?,?)`);
      const rows = db.prepare("SELECT threadId FROM thread_collab_state WHERE accountId=? AND assigneeUserId=?").all(accountId, userId) as { threadId: string }[];
      const now = Date.now();
      db.prepare(`UPDATE thread_collab_state SET assigneeUserId=NULL,assignedAt=NULL,updatedAt=?,lastActivityAt=?
        WHERE accountId=? AND assigneeUserId=?`).run(now, now, accountId, userId);
      for (const row of rows) activityInsert.run(randomUUID(), accountId, row.threadId, actor.userId, JSON.stringify({ assigneeUserId: null, previousAssigneeUserId: userId }), now);
      return { status: "complete" as const, unassigned: rows.length };
    }).immediate());
  } finally { db.close(); }
}

/** Retry durable intents after revoke; failure never rolls back access removal. */
export async function retryMembershipCleanup(operationId: string): Promise<boolean> {
  const db = await getDb();
  const row = db.prepare("SELECT * FROM admin_lifecycle_operations WHERE id=? AND action='member.revoke'").get(operationId) as
    { actorUserId: string; targetUserId: string; payload: string; state: string } | undefined;
  if (!row) throw new Error("Cleanup operation not found");
  if (row.state === "complete") return true;
  const { accountId } = JSON.parse(row.payload) as { accountId: string };
  try {
    await cleanupUserAccountAccess(accountId, row.targetUserId, { userId: row.actorUserId, clientId: "system" });
    await withDbWriteRetry("completeMembershipCleanup", () => db.prepare("UPDATE admin_lifecycle_operations SET state='complete',slot=NULL,updatedAt=? WHERE id=?").run(Date.now(), operationId));
    return true;
  } catch {
    await withDbWriteRetry("retainMembershipCleanup", () => db.prepare("UPDATE admin_lifecycle_operations SET state='cleanup_pending',updatedAt=? WHERE id=?").run(Date.now(), operationId));
    return false;
  }
}
