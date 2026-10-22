// This module also runs in sync/recompute workers: no Next, sessions or credentials.
import type { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import { getAccountDb } from "./connection";
import { withDbWriteRetry } from "../dbWriteRetry";
export type ThreadStatus = "open" | "in_progress" | "waiting" | "closed";
export type ThreadCollabState = {
  accountId: string;
  threadId: string;
  status: ThreadStatus;
  assigneeUserId: string | null;
  assignedByUserId: string | null;
  assignedAt: number | null;
  statusChangedAt: number | null;
  statusChangedByUserId: string | null;
  commentCount: number;
  lastActivityAt: number;
  updatedAt: number;
  updatedByUserId: string | null;
};
export type ThreadComment = {
  id: string;
  accountId: string;
  threadId: string;
  authorUserId: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};
export type ThreadActivity = {
  id: string;
  accountId: string;
  threadId: string;
  type: string;
  actorUserId: string | null;
  actorClientId: string;
  payload: Record<string, unknown>;
  createdAt: number;
};
export type CollabActor = {
  userId: string | null;
  clientId: string;
};
export type ThreadCollabPatch = {
  status?: ThreadStatus;
  assigneeUserId?: string | null;
};
export function defaultThreadCollabState(accountId: string, threadId: string): ThreadCollabState {
  return {
    accountId, threadId, status: "open", assigneeUserId: null, assignedByUserId: null,
    assignedAt: null, statusChangedAt: null, statusChangedByUserId: null, commentCount: 0,
    lastActivityAt: 0, updatedAt: 0, updatedByUserId: null
  };
}
export function threadHasMessages(db: Database, accountId: string, threadId: string) {
  return Boolean(db.prepare(`SELECT 1 FROM messages WHERE accountId=? AND threadId=?
    AND COALESCE(deleted,0)=0 LIMIT 1`).get(accountId, threadId));
}
export function getThreadCollabState(db: Database, accountId: string, threadId: string) {
  return db.prepare(`SELECT * FROM thread_collab_state WHERE accountId=? AND threadId=?`)
    .get(accountId, threadId) as ThreadCollabState | null ?? defaultThreadCollabState(accountId, threadId);
}
export function getThreadCollabStates(db: Database, accountId: string, threadIds: string[]) {
  const ids = [...new Set(threadIds)];
  const result = new Map(ids.map(id => [id, defaultThreadCollabState(accountId, id)]));
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const rows = db.prepare(`SELECT * FROM thread_collab_state WHERE accountId=?
      AND threadId IN (${chunk.map(() => "?").join(",")})`).all(accountId, ...chunk) as ThreadCollabState[];
    for (const row of rows)
      result.set(row.threadId, row);
  }
  return result;
}
export function upsertThreadCollabState(db: Database, state: ThreadCollabState) {
  db.prepare(`INSERT INTO thread_collab_state
    (accountId,threadId,status,assigneeUserId,assignedByUserId,assignedAt,statusChangedAt,
     statusChangedByUserId,commentCount,lastActivityAt,updatedAt,updatedByUserId)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(accountId,threadId) DO UPDATE SET
    status=excluded.status,assigneeUserId=excluded.assigneeUserId,assignedByUserId=excluded.assignedByUserId,
    assignedAt=excluded.assignedAt,statusChangedAt=excluded.statusChangedAt,
    statusChangedByUserId=excluded.statusChangedByUserId,commentCount=excluded.commentCount,
    lastActivityAt=excluded.lastActivityAt,updatedAt=excluded.updatedAt,updatedByUserId=excluded.updatedByUserId`)
    .run(state.accountId, state.threadId, state.status, state.assigneeUserId, state.assignedByUserId, state.assignedAt, state.statusChangedAt, state.statusChangedByUserId, state.commentCount, state.lastActivityAt, state.updatedAt, state.updatedByUserId);
}
export function appendThreadActivity(db: Database, accountId: string, threadId: string, type: string, actor: CollabActor, payload: Record<string, unknown>, now: number): ThreadActivity {
  const row = {
    id: randomUUID(), accountId, threadId, type, actorUserId: actor.userId,
    actorClientId: actor.clientId, payload, createdAt: now
  };
  db.prepare(`INSERT INTO thread_activity (id,accountId,threadId,type,actorUserId,actorClientId,payload,createdAt) VALUES (?,?,?,?,?,?,?,?)`)
    .run(row.id, accountId, threadId, type, actor.userId, actor.clientId, JSON.stringify(payload), now);
  return row;
}
export function updateThreadCollabState(db: Database, accountId: string, threadId: string, patch: ThreadCollabPatch, actor: CollabActor, now: number) {
  const state = getThreadCollabState(db, accountId, threadId);
  let changed = false;
  if (patch.status !== undefined && patch.status !== state.status) {
    appendThreadActivity(db, accountId, threadId, "status_changed", actor, { from: state.status, to: patch.status }, now);
    state.status = patch.status;
    state.statusChangedAt = now;
    state.statusChangedByUserId = actor.userId;
    changed = true;
  }
  if (patch.assigneeUserId !== undefined && patch.assigneeUserId !== state.assigneeUserId) {
    appendThreadActivity(db, accountId, threadId, patch.assigneeUserId === null ? "unassigned" : "assigned", actor, { from: state.assigneeUserId, to: patch.assigneeUserId }, now);
    state.assigneeUserId = patch.assigneeUserId;
    state.assignedByUserId = actor.userId;
    state.assignedAt = patch.assigneeUserId === null ? null : now;
    changed = true;
  }
  if (changed)
    touchThreadCollabState(db, state, actor, now);
  return state;
}
export function touchThreadCollabState(db: Database, state: ThreadCollabState, actor: CollabActor, now: number) {
  state.updatedAt = now;
  state.lastActivityAt = now;
  state.updatedByUserId = actor.userId;
  state.commentCount = (db.prepare(`SELECT COUNT(*) AS count FROM thread_comments
    WHERE accountId=? AND threadId=? AND deletedAt IS NULL`).get(state.accountId, state.threadId) as {
    count: number;
  }).count;
  upsertThreadCollabState(db, state);
  return state;
}
export function getThreadComment(db: Database, accountId: string, threadId: string, id: string) {
  return db.prepare(`SELECT * FROM thread_comments WHERE accountId=? AND threadId=? AND id=?`)
    .get(accountId, threadId, id) as ThreadComment | null;
}
export function addThreadComment(db: Database, accountId: string, threadId: string, body: string, actor: CollabActor & {
  userId: string;
}, now: number) {
  const comment: ThreadComment = {
    id: randomUUID(), accountId, threadId, authorUserId: actor.userId,
    body, createdAt: now, updatedAt: now, deletedAt: null
  };
  db.prepare(`INSERT INTO thread_comments (id,accountId,threadId,authorUserId,body,createdAt,updatedAt,deletedAt) VALUES (?,?,?,?,?,?,?,NULL)`)
    .run(comment.id, accountId, threadId, actor.userId, body, now, now);
  appendThreadActivity(db, accountId, threadId, "comment_added", actor, { commentId: comment.id }, now);
  return { comment, state: touchThreadCollabState(db, getThreadCollabState(db, accountId, threadId), actor, now) };
}
export function editThreadComment(db: Database, comment: ThreadComment, body: string, actor: CollabActor, now: number) {
  const { accountId, threadId, id } = comment;
  if (comment.deletedAt === null && comment.body !== body) {
    db.prepare(`UPDATE thread_comments SET body=?,updatedAt=? WHERE accountId=? AND threadId=? AND id=?`)
      .run(body, now, accountId, threadId, id);
    comment.body = body;
    comment.updatedAt = now;
    appendThreadActivity(db, accountId, threadId, "comment_edited", actor, { commentId: id }, now);
    touchThreadCollabState(db, getThreadCollabState(db, accountId, threadId), actor, now);
  }
  return { comment, state: getThreadCollabState(db, accountId, threadId) };
}
export function deleteThreadComment(db: Database, accountId: string, threadId: string, id: string, actor: CollabActor, now: number) {
  const deleted = Boolean(db.prepare(`UPDATE thread_comments SET deletedAt=?,updatedAt=?
    WHERE accountId=? AND threadId=? AND id=? AND deletedAt IS NULL RETURNING id`).get(now, now, accountId, threadId, id));
  const state = getThreadCollabState(db, accountId, threadId);
  if (deleted) {
    appendThreadActivity(db, accountId, threadId, "comment_deleted", actor, { commentId: id }, now);
    touchThreadCollabState(db, state, actor, now);
  }
  return { deleted, state };
}
export function listThreadComments(db: Database, accountId: string, threadId: string) {
  return db.prepare(`SELECT * FROM thread_comments WHERE accountId=? AND threadId=? AND deletedAt IS NULL
    ORDER BY createdAt,id`).all(accountId, threadId) as ThreadComment[];
}
export function listThreadActivity(db: Database, accountId: string, threadId: string, limit = 100) {
  const rows = db.prepare(`SELECT * FROM thread_activity WHERE accountId=? AND threadId=?
    ORDER BY createdAt DESC,id DESC LIMIT ?`).all(accountId, threadId, limit) as Array<Omit<ThreadActivity, "payload"> & {
    payload: string | null;
  }>;
  return rows.map(row => ({ ...row, payload: row.payload ? JSON.parse(row.payload) as Record<string, unknown> : {} }));
}
// All public mutations use this boundary. The existence check and every write
// are synchronous under the same immediate lock; retries repeat the whole unit.
export async function mutateThreadCollab<T>(accountId: string, threadId: string, fn: (db: Database, now: number) => T) {
  return withDbWriteRetry("threadCollab.mutate", async () => {
    const db = await getAccountDb(accountId) as Database;
    return db.transaction(() => threadHasMessages(db, accountId, threadId) ? fn(db, Date.now()) : null).immediate();
  });
}
export async function unassignUserInAccount(accountId: string, userId: string, actor: CollabActor) {
  return withDbWriteRetry("threadCollab.unassignUserInAccount", async () => {
    const db = await getAccountDb(accountId) as Database;
    return db.transaction(() => {
      const rows = db.prepare(`SELECT * FROM thread_collab_state WHERE accountId=? AND assigneeUserId=?`)
        .all(accountId, userId) as ThreadCollabState[];
      for (const row of rows)
        updateThreadCollabState(db, accountId, row.threadId, { assigneeUserId: null }, { ...actor, clientId: "system" }, Date.now());
      return rows.length;
    }).immediate();
  });
}
export type ThreadRemapPair = {
  oldThreadId: string;
  newThreadId: string;
  // Identity of the row being rewritten, captured before the rewrite. Required
  // for the former-root / oldest-former-message split rule (§3.2).
  id: string;
  messageId?: string | null;
  dateValue: number;
};
/** Synchronous; caller owns the immediate transaction, after message updates. */
export function remapThreadCollab(db: Database, accountId: string, pairs: ThreadRemapPair[]) {
  const grouped = new Map<string, ThreadRemapPair[]>();
  for (const pair of pairs) {
    if (pair.oldThreadId === pair.newThreadId)
      continue;
    const group = grouped.get(pair.oldThreadId) ?? [];
    group.push(pair);
    grouped.set(pair.oldThreadId, group);
  }
  const moves = new Map<string, string>();
  for (const [oldId, group] of grouped) {
    if (threadHasMessages(db, accountId, oldId))
      continue;
    const sorted = [...group].sort((a, b) => a.dateValue - b.dateValue || a.id.localeCompare(b.id));
    const root = sorted.find(pair => pair.messageId === oldId) ?? sorted[0];
    moves.set(oldId, root.newThreadId);
  }
  if (!moves.size)
    return;
  // Snapshot first so simultaneous A→B, B→C or swaps never cascade metadata.
  const states = new Map<string, ThreadCollabState>();
  const topics = new Map<string, Array<{
    topicId: string;
    assignedAt: number;
  }>>();
  const commentIds = new Map<string, string[]>();
  const activityIds = new Map<string, string[]>();
  const targets = new Map<string, string[]>();
  for (const [source, target] of moves) {
    const sources = targets.get(target) ?? [];
    sources.push(source);
    targets.set(target, sources);
    for (const id of [source, target]) {
      const row = db.prepare(`SELECT * FROM thread_collab_state WHERE accountId=? AND threadId=?`)
        .get(accountId, id) as ThreadCollabState | null;
      if (row)
        states.set(id, row);
    }
    topics.set(source, db.prepare(`SELECT topicId,assignedAt FROM thread_topics WHERE accountId=? AND threadId=?`)
      .all(accountId, source) as Array<{
        topicId: string;
        assignedAt: number;
      }>);
    commentIds.set(source, (db.prepare(`SELECT id FROM thread_comments WHERE accountId=? AND threadId=?`)
      .all(accountId, source) as Array<{
        id: string;
      }>).map(row => row.id));
    activityIds.set(source, (db.prepare(`SELECT id FROM thread_activity WHERE accountId=? AND threadId=?`)
      .all(accountId, source) as Array<{
        id: string;
      }>).map(row => row.id));
  }
  for (const source of moves.keys()) {
    db.prepare(`DELETE FROM thread_collab_state WHERE accountId=? AND threadId=?`).run(accountId, source);
    db.prepare(`DELETE FROM thread_topics WHERE accountId=? AND threadId=?`).run(accountId, source);
  }
  for (const [source, target] of moves) {
    for (const row of topics.get(source) ?? [])
      db.prepare(`INSERT OR IGNORE INTO thread_topics
      (accountId,threadId,topicId,assignedAt) VALUES (?,?,?,?)`).run(accountId, target, row.topicId, row.assignedAt);
    for (const id of commentIds.get(source) ?? [])
      db.prepare(`UPDATE thread_comments SET threadId=?
      WHERE accountId=? AND threadId=? AND id=?`).run(target, accountId, source, id);
    for (const id of activityIds.get(source) ?? [])
      db.prepare(`UPDATE thread_activity SET threadId=?
      WHERE accountId=? AND threadId=? AND id=?`).run(target, accountId, source, id);
  }
  for (const [target, sources] of targets) {
    const mergedIds = [...sources, ...(moves.has(target) ? [] : [target])];
    const rows = mergedIds.flatMap(id => states.has(id) ? [states.get(id)!] : []);
    // Newest update wins provenance; newest non-closed status wins unless all
    // rows are closed; newest non-null assignment wins. Lexical threadId is a
    // deterministic tie-breaker for equal timestamps (never iteration order).
    const newest = (a: ThreadCollabState, b: ThreadCollabState) => b.updatedAt - a.updatedAt || a.threadId.localeCompare(b.threadId);
    rows.sort(newest);
    const state = { ...(rows[0] ?? defaultThreadCollabState(accountId, target)), threadId: target };
    const statusRow = rows.filter(row => row.status !== "closed")
      .sort((a, b) => (b.statusChangedAt ?? b.updatedAt) - (a.statusChangedAt ?? a.updatedAt) || a.threadId.localeCompare(b.threadId))[0] ?? rows[0];
    if (statusRow) {
      state.status = statusRow.status;
      state.statusChangedAt = statusRow.statusChangedAt;
      state.statusChangedByUserId = statusRow.statusChangedByUserId;
    }
    const assigned = rows.filter(row => row.assigneeUserId !== null)
      .sort((a, b) => (b.assignedAt ?? 0) - (a.assignedAt ?? 0) || a.threadId.localeCompare(b.threadId))[0];
    if (assigned) {
      state.assigneeUserId = assigned.assigneeUserId;
      state.assignedAt = assigned.assignedAt;
      state.assignedByUserId = assigned.assignedByUserId;
    }
    state.lastActivityAt = Math.max(0, ...rows.map(row => row.lastActivityAt));
    state.commentCount = (db.prepare(`SELECT COUNT(*) AS count FROM thread_comments
      WHERE accountId=? AND threadId=? AND deletedAt IS NULL`).get(accountId, target) as {
      count: number;
    }).count;
    if (rows.length || state.commentCount)
      upsertThreadCollabState(db, state);
    if (sources.length > 1 || (!moves.has(target) && states.has(target))) {
      const now = Date.now();
      appendThreadActivity(db, accountId, target, "threads_merged", { userId: null, clientId: "system" }, { mergedFromThreadIds: [...sources].sort() }, now);
      // System remapping preserves updatedByUserId from the newest mutation.
      state.lastActivityAt = now;
      upsertThreadCollabState(db, state);
    }
  }
}

export type SentMessageIdentity = { messageId: string; inReplyTo?: string; references?: string[] };
/** Post-SMTP attribution is idempotent per RFC Message-ID, including non-replies. */
export async function recordReplySent(accountId: string, message: SentMessageIdentity, actor: CollabActor) {
  if (!actor.userId || !message.messageId) return;
  return withDbWriteRetry("threadCollab.recordReplySent", async () => {
    const db = await getAccountDb(accountId) as Database;
    return db.transaction(() => {
      const now = Date.now();
      const inserted = db.prepare(`INSERT INTO sent_by(accountId,messageId,userId,sentAt) VALUES(?,?,?,?)
        ON CONFLICT(accountId,messageId) DO NOTHING RETURNING messageId`).get(accountId, message.messageId, actor.userId, now);
      if (!inserted) return;
      // Prefer the immediate parent, then walk References from newest to oldest.
      const parents = [message.inReplyTo, ...(message.references ?? []).slice().reverse()].filter((id): id is string => Boolean(id));
      for (const parent of parents) {
        const target = db.prepare(`SELECT threadId FROM messages WHERE accountId=? AND (messageId=? OR id=?)
          AND COALESCE(deleted,0)=0 ORDER BY dateValue DESC,id LIMIT 1`).get(accountId, parent, parent) as { threadId: string } | null;
        if (!target) continue;
        appendThreadActivity(db, accountId, target.threadId, "reply_sent", actor, { messageId: message.messageId }, now);
        touchThreadCollabState(db, getThreadCollabState(db, accountId, target.threadId), actor, now);
        return;
      }
    }).immediate();
  });
}
