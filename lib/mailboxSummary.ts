import type { Database } from "bun:sqlite";
import type { AccountRole } from "./data";
import { listAccessibleAccountsForUser } from "./accountAccess";
import { resolveAccountRoleRow } from "./db/accountAccess";
import { getAccountDb, getDb } from "./db/connection";
import { getMailboxSummaries, type WatcherState } from "./db/mailboxSummary";

export type UserMailboxSummary = {
  accountId: string; name: string; email: string; accessRole: AccountRole;
  isOwner: boolean; shared: boolean; unread: number | null;
  assignedToMe: number; unassignedOpen: number; open: number;
  watcher: { state: WatcherState; lastEventAt?: number };
};
export type MailboxSummaryResult = { ok: true; mailboxes: UserMailboxSummary[]; generatedAt: number };

/** Synchronous projection for a final authorized DB snapshot, immediately before serialization. */
export function authorizeMailboxSummary(db: Database, userId: string, summary: MailboxSummaryResult): MailboxSummaryResult {
  return { ...summary, mailboxes: summary.mailboxes.flatMap(mailbox => {
    const role = resolveAccountRoleRow(db, userId, mailbox.accountId);
    return role ? [{ ...mailbox, accessRole: role }] : [];
  }) };
}

// One statement per shard. Historical state without live messages is excluded;
// a live thread with no state row is open and unassigned (§6.2).
export const COLLAB_SUMMARY_SQL = `WITH live AS MATERIALIZED (
  SELECT threads.threadId, tc.assigneeUserId,
    (tc.status IS NULL OR tc.status IN ('open','in_progress','waiting')) AS isOpen
  FROM (SELECT DISTINCT threadId FROM messages INDEXED BY idx_messages_live_thread_summary
    WHERE accountId = ?1 AND COALESCE(deleted, 0) = 0) threads
  LEFT JOIN thread_collab_state tc ON tc.accountId = ?1 AND tc.threadId = threads.threadId
) SELECT
  (SELECT COUNT(*) FROM thread_collab_state tc
    WHERE tc.accountId = ?1 AND tc.assigneeUserId = ?2
      AND EXISTS (SELECT 1 FROM messages m INDEXED BY idx_messages_live_thread_summary WHERE m.accountId = tc.accountId
        AND m.threadId = tc.threadId AND COALESCE(m.deleted, 0) = 0)) AS assignedToMe,
  (SELECT COUNT(*) FROM live WHERE assigneeUserId IS NULL AND isOpen) AS unassignedOpen,
  (SELECT COUNT(*) FROM live WHERE isOpen) AS open
`;

/** The optional scope can only narrow the user's access (e.g. a mailbox-bound MCP token). */
export async function getUserMailboxSummary(userId: string, scope?: readonly string[]): Promise<MailboxSummaryResult> {
  const accounts = (await listAccessibleAccountsForUser(userId)).filter(({ account }) => !scope || scope.includes(account.id));
  const mailboxes: UserMailboxSummary[] = [];
  for (const { account, role, isOwner, memberCount } of accounts) {
    const db = await getAccountDb(account.id);
    const [summary] = await getMailboxSummaries([account.id]);
    const counts = db.prepare(COLLAB_SUMMARY_SQL).get(account.id, userId) as { assignedToMe: number; unassignedOpen: number; open: number };
    mailboxes.push({
      accountId: account.id, name: account.name, email: account.email, accessRole: role,
      isOwner, shared: memberCount > 1,
      unread: summary.lastSyncAt === null ? null : summary.unreadInbox,
      ...counts, watcher: { state: summary.watcherState, ...(summary.lastSyncAt === null ? {} : { lastEventAt: summary.lastSyncAt }) }
    });
  }
  // Shard reads await connection setup. Recheck access after those awaits, never
  // return a mailbox whose membership was removed while its counts were loaded.
  const db = await getDb();
  return db.transaction(() => authorizeMailboxSummary(db, userId, { ok: true, generatedAt: Date.now(), mailboxes })).deferred();
}
