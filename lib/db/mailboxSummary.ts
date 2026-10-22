import { getAccountDb } from "./connection";
import { withDbWriteRetry } from "../dbWriteRetry";
import { shouldStorePasswordInDb } from "../secret";

export type WatcherState = "disabled" | "starting" | "idling" | "backoff" | "auth_failed" | "stopped";
export type MailboxSummary = {
  accountId: string;
  unreadInbox: number;
  /** Unix epoch milliseconds; last successful worker sync or background check. */
  lastSyncAt: number | null;
  watcherState: WatcherState;
};

/** Callers MUST supply authorized account ids; this never enumerates the master DB. */
export async function getMailboxSummaries(accountIds: readonly string[]): Promise<MailboxSummary[]> {
  const summaries: MailboxSummary[] = [];
  for (const accountId of new Set(accountIds)) {
    const db = await getAccountDb(accountId);
    const row = db.prepare(`
      SELECT COUNT(*) AS unreadInbox FROM messages
      WHERE accountId = ? AND unread = 1 AND COALESCE(deleted, 0) = 0
        AND folderId IN (SELECT id FROM folders WHERE accountId = ?
          AND (lower(specialUse) = '\\inbox' OR lower(id) = lower(?)))
    `).get(accountId, accountId, `${accountId}:INBOX`) as { unreadInbox: number };
    const state = db.prepare(`SELECT lastSyncAt, watcherState FROM mailbox_summary WHERE accountId = ?`)
      .get(accountId) as { lastSyncAt: number | null; watcherState: WatcherState } | undefined;
    summaries.push({
      accountId, unreadInbox: row.unreadInbox,
      lastSyncAt: state?.lastSyncAt ?? null,
      watcherState: process.env.NOCTUA_MAILBOX_WATCHER === "1" && shouldStorePasswordInDb()
        ? state?.watcherState ?? "starting" : "disabled"
    });
  }
  return summaries;
}

export async function setMailboxWatcherState(accountId: string, state: WatcherState) {
  await withDbWriteRetry("setMailboxWatcherState", async () => {
    const db = await getAccountDb(accountId);
    db.prepare(`INSERT INTO mailbox_summary(accountId, watcherState) VALUES (?, ?)
      ON CONFLICT(accountId) DO UPDATE SET watcherState = excluded.watcherState`).run(accountId, state);
  });
}

export async function recordMailboxSync(accountId: string, at = Date.now()) {
  await withDbWriteRetry("recordMailboxSync", async () => {
    const db = await getAccountDb(accountId);
    db.prepare(`INSERT INTO mailbox_summary(accountId, lastSyncAt) VALUES (?, ?)
      ON CONFLICT(accountId) DO UPDATE SET lastSyncAt = max(COALESCE(lastSyncAt, 0), excluded.lastSyncAt)`)
      .run(accountId, at);
  });
}
