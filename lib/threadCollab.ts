import type { ActiveUserSession } from "./auth";
import type { AccountRole } from "./data";
import { getAccountDb, getDb } from "./db/connection";
import * as store from "./db/threadCollab";
export type { ThreadStatus, ThreadCollabState, ThreadComment, ThreadActivity, CollabActor, ThreadCollabPatch } from "./db/threadCollab";
export { remapThreadCollab } from "./db/threadCollab";
import type { CollabActor, ThreadCollabPatch } from "./db/threadCollab";
export class ThreadCollabError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404) { super(message); }
}
/** Call with the already authenticated session, never a user id from a body. */
export function collabActorFromSession(session: Pick<ActiveUserSession, "userId">, clientId?: string): CollabActor {
  const safeClientId = (clientId ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return { userId: session.userId, clientId: `web:${safeClientId || "unknown"}` };
}
// feat/team-auth slice 3: replace these two local helpers with the §5.1
// resolveAccountRole / roleAtLeast exports once that branch lands. No admin
// override: ownership grants manager, live enabled membership grants its role.
export async function resolveAccountRole(userId: string, accountId: string): Promise<AccountRole | null> {
  const db = await getDb();
  const row = db.prepare(`SELECT CASE WHEN a.ownerUserId=u.id THEN 'manager' ELSE ua.role END AS role
    FROM auth_user u JOIN accounts a ON a.id=?
    LEFT JOIN user_accounts ua ON ua.accountId=a.id AND ua.userId=u.id
    WHERE u.id=? AND (COALESCE(u.banned,0)=0 OR (u.banExpires IS NOT NULL AND julianday(u.banExpires)<=julianday('now')))`)
    .get(accountId, userId) as {
      role: AccountRole | null;
    } | null;
  return row?.role ?? null;
}
export function roleAtLeast(role: AccountRole | null, min: AccountRole) {
  const order = { viewer: 1, editor: 2, manager: 3 };
  return role !== null && order[role] >= order[min];
}
async function requireActor(accountId: string, actor: CollabActor) {
  if (!actor.userId || !roleAtLeast(await resolveAccountRole(actor.userId, accountId), "editor")) {
    throw new ThreadCollabError("Insufficient mailbox role", 403);
  }
  return { ...actor, userId: actor.userId };
}
function validateBody(body: string) {
  if (typeof body !== "string" || !body.trim() || body.length > 20000) {
    throw new ThreadCollabError("Comment body must contain 1..20000 characters", 400);
  }
}
export async function getThreadCollabState(accountId: string, threadId: string) {
  return store.getThreadCollabState(await getAccountDb(accountId), accountId, threadId);
}
export async function getThreadCollabStates(accountId: string, threadIds: string[]) {
  if (!threadIds.length)
    return new Map<string, store.ThreadCollabState>();
  return store.getThreadCollabStates(await getAccountDb(accountId), accountId, threadIds);
}
export async function updateThreadCollabState(accountId: string, threadId: string, patch: ThreadCollabPatch, actor: CollabActor) {
  if (patch.status !== undefined && !["open", "in_progress", "waiting", "closed"].includes(patch.status)) {
    throw new ThreadCollabError("Invalid thread status", 400);
  }
  const principal = await requireActor(accountId, actor);
  if (patch.assigneeUserId !== undefined && patch.assigneeUserId !== null &&
    (typeof patch.assigneeUserId !== "string" || !await resolveAccountRole(patch.assigneeUserId, accountId))) {
    throw new ThreadCollabError("Assignee must be an enabled mailbox member", 400);
  }
  // Every valid status can transition to every other valid status, including
  // reopening closed work. Read/seen flags never participate in this decision.
  return store.mutateThreadCollab(accountId, threadId, (db, now) => store.updateThreadCollabState(db, accountId, threadId, patch, principal, now));
}
export async function addThreadComment(accountId: string, threadId: string, body: string, actor: CollabActor) {
  validateBody(body);
  const principal = await requireActor(accountId, actor);
  return store.mutateThreadCollab(accountId, threadId, (db, now) => store.addThreadComment(db, accountId, threadId, body, principal, now));
}
export async function editThreadComment(accountId: string, threadId: string, commentId: string, body: string, actor: CollabActor, options: {
  allowAnyAuthor?: boolean;
} = {}) {
  validateBody(body);
  const principal = await requireActor(accountId, actor);
  const manager = roleAtLeast(await resolveAccountRole(principal.userId, accountId), "manager");
  return store.mutateThreadCollab(accountId, threadId, (db, now) => {
    const comment = store.getThreadComment(db, accountId, threadId, commentId);
    if (!comment || comment.deletedAt !== null)
      throw new ThreadCollabError("Comment not found", 404);
    if (comment.authorUserId !== principal.userId && !(options.allowAnyAuthor && manager))
      throw new ThreadCollabError("Forbidden", 403);
    return store.editThreadComment(db, comment, body, principal, now);
  });
}
export async function deleteThreadComment(accountId: string, threadId: string, commentId: string, actor: CollabActor, options: {
  allowAnyAuthor?: boolean;
} = {}) {
  const principal = await requireActor(accountId, actor);
  const manager = roleAtLeast(await resolveAccountRole(principal.userId, accountId), "manager");
  return store.mutateThreadCollab(accountId, threadId, (db, now) => {
    const comment = store.getThreadComment(db, accountId, threadId, commentId);
    if (comment && comment.authorUserId !== principal.userId && !(options.allowAnyAuthor && manager))
      throw new ThreadCollabError("Forbidden", 403);
    return store.deleteThreadComment(db, accountId, threadId, commentId, principal, now);
  });
}
export async function listThreadComments(accountId: string, threadId: string) {
  const db = await getAccountDb(accountId);
  return store.threadHasMessages(db, accountId, threadId) ? store.listThreadComments(db, accountId, threadId) : [];
}
export async function listThreadActivity(accountId: string, threadId: string, options: {
  limit?: number;
} = {}) {
  const limit = options.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    throw new ThreadCollabError("Invalid activity limit", 400);
  const db = await getAccountDb(accountId);
  return store.threadHasMessages(db, accountId, threadId) ? store.listThreadActivity(db, accountId, threadId, limit) : [];
}
/** Internal post-revocation seam: access is already revoked in the master DB. */
export const unassignUserInAccount = store.unassignUserInAccount;

/** Sanitized, enabled membership DTO; keep role resolution on the Slice 3 seam. */
export async function listCollabMembers(accountId: string) {
  const db = await getDb();
  const users = db.prepare(`SELECT DISTINCT u.id,u.name,u.email FROM auth_user u
    JOIN accounts a ON a.id=? LEFT JOIN user_accounts ua ON ua.accountId=a.id AND ua.userId=u.id
    WHERE a.ownerUserId=u.id OR ua.userId IS NOT NULL ORDER BY u.name,u.email,u.id`)
    .all(accountId) as Array<{ id: string; name: string | null; email: string }>;
  const members = await Promise.all(users.map(async user => ({ ...user, role: await resolveAccountRole(user.id, accountId) })));
  return members.filter((member): member is typeof member & { role: AccountRole } => member.role !== null);
}

export const recordReplySent = store.recordReplySent;

/** Account-scoped original copies for server-side reply/forward flags. */
export async function listReplySourceMessageIds(accountId: string, parent: string) {
  const db = await getAccountDb(accountId);
  return db.prepare(`SELECT id FROM messages WHERE accountId=? AND (messageId=? OR id=?) AND COALESCE(deleted,0)=0`)
    .all(accountId, parent, parent) as Array<{ id: string }>;
}
