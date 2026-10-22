import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import { dbModulePromise } from "../testDbHarness";
import { getMailboxSummaries, recordMailboxSync, setMailboxWatcherState } from "./mailboxSummary";
import type { Account } from "../data";
const { upsertAccount, withAccountDb } = await dbModulePromise;

async function account() {
  const id = `summary-${randomUUID()}`;
  const endpoint = { host: "mail.example.test", port: 993, secure: true, user: "demo@example.test", password: "synthetic" };
  await upsertAccount({ id, name: "Synthetic summary", email: "demo@example.test", avatar: "S", imap: endpoint, smtp: endpoint } satisfies Account);
  return id;
}

describe("mailbox summaries", () => {
  test("counts only live unread INBOX rows and scopes shared shards by account", async () => {
    const id = await account();
    const other = await account();
    await withAccountDb(id, (db) => {
      const folder = db.prepare(`INSERT INTO folders(id, accountId, name, specialUse) VALUES (?, ?, ?, ?)`);
      folder.run(`${id}:INBOX`, id, "INBOX", "\\Inbox");
      folder.run(`${id}:Archive`, id, "Archive", null);
      folder.run(`${other}:INBOX`, other, "INBOX", "\\Inbox");
      const insert = db.prepare(`INSERT INTO messages
        (id, accountId, folderId, threadId, subject, fromAddr, toAddr, preview, date, dateValue, body, unread, deleted)
        VALUES (?, ?, ?, ?, '', '', '', '', '', 0, '', ?, ?)`);
      for (const [suffix, accountId, folderId, unread, deleted] of [
        ["unread", id, `${id}:INBOX`, 1, 0], ["read", id, `${id}:INBOX`, 0, 0],
        ["deleted", id, `${id}:INBOX`, 1, 1], ["archive", id, `${id}:Archive`, 1, 0],
        ["foreign", other, `${other}:INBOX`, 1, 0]
      ] as const) insert.run(`${id}-${suffix}`, accountId, folderId, `${id}-${suffix}`, unread, deleted);
      // The query must have a small partial index available for multi-year mailboxes.
      const indexes = db.prepare(`PRAGMA index_list(messages)`).all() as Array<{ name: string }>;
      expect(indexes.some((index) => index.name === "idx_messages_unread_mailbox_summary")).toBe(true);
    });
    await recordMailboxSync(id, 1234);
    await recordMailboxSync(id, 1200); // A finishing older job cannot regress the timestamp.
    await setMailboxWatcherState(id, "idling");
    const previous = process.env.NOCTUA_MAILBOX_WATCHER;
    try {
      process.env.NOCTUA_MAILBOX_WATCHER = "1";
      expect(await getMailboxSummaries([id, id])).toEqual([
        { accountId: id, unreadInbox: 1, lastSyncAt: 1234, watcherState: "idling" }
      ]);
      delete process.env.NOCTUA_MAILBOX_WATCHER;
      expect((await getMailboxSummaries([id]))[0].watcherState).toBe("disabled");
    } finally {
      if (previous === undefined) delete process.env.NOCTUA_MAILBOX_WATCHER;
      else process.env.NOCTUA_MAILBOX_WATCHER = previous;
    }
  });
  test("empty shards have zero counts and no invented sync time", async () => {
    const id = await account();
    const [summary] = await getMailboxSummaries([id]);
    expect(summary.unreadInbox).toBe(0);
    expect(summary.lastSyncAt).toBeNull();
    expect(await getMailboxSummaries([])).toEqual([]);
  });
});
