import { dbModulePromise } from "./testDbHarness";
import { getAccountDb } from "./db/connection";
import type { Account, Message } from "./data";
/** Synthetic shard fixtures shared by the collaboration tests. */
export async function createCollabFixture() {
  const accountId = `collab-${crypto.randomUUID()}`;
  const account: Account = {
    id: accountId, name: "Synthetic shared inbox", email: "team@example.test", avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "team@example.test", password: "synthetic" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "team@example.test", password: "synthetic" }
  };
  const api = await dbModulePromise;
  await api.upsertAccount(account);
  const folderId = `${accountId}-inbox`;
  await api.saveFoldersForAccount(accountId, [{ id: folderId, accountId, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" }]);
  function message(threadId: string, overrides: Partial<Message> = {}): Message {
    return {
      id: `${accountId}-${crypto.randomUUID()}`, accountId, folderId, threadId, messageId: threadId,
      subject: "Synthetic collaboration thread", from: "sender@example.test", to: "team@example.test",
      preview: "Synthetic message", date: "2026-01-01T00:00:00.000Z", dateValue: 1767225600000, body: "Synthetic body", ...overrides
    };
  }
  async function seed(...messages: Message[]) { await api.upsertMessages(accountId, folderId, messages); return messages; }
  return { accountId, account, folderId, message, seed, api, db: await getAccountDb(accountId) };
}
