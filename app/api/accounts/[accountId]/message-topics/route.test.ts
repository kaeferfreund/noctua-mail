import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { authenticatedTestCookie } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;
const { createTopic, getTopicsForThread } = await import("@/lib/topics");
const { POST: messageTopics } = await import("@/app/api/accounts/[accountId]/message-topics/route");

// Topic assignments are written only for the mailbox's own conversations: a
// thread id of another mailbox (domain view) never creates a row in this shard.
const accountId = `acc-message-topics-${crypto.randomUUID()}`;
const folder: Folder = { id: `${accountId}:INBOX`, accountId, name: "Inbox", count: 0, unreadCount: 0, specialUse: "\\Inbox" };
const account: Account = {
  id: accountId, name: "Message topics", email: "owner@example.test", avatar: "",
  imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "synthetic" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "synthetic" }
};
const message: Message = {
  id: "own-1", accountId, folderId: folder.id, threadId: "<own-thread@example.test>", messageId: "<own-1@example.test>",
  subject: "Synthetic", from: "sender@example.invalid", to: "owner@example.test", preview: "Synthetic", body: "Synthetic body",
  date: new Date(Date.UTC(2026, 3, 1, 9)).toISOString(), dateValue: Date.UTC(2026, 3, 1, 9)
};

await upsertAccount(account);
await saveFoldersForAccount(accountId, [folder]);
await upsertMessages(accountId, folder.id, [message], true, { recomputeThreads: false });
const topic = await createTopic(accountId, "Synthetic topic", "blue");
const cookie = await authenticatedTestCookie(accountId);

const post = (body: Record<string, unknown>) => messageTopics(new Request(`http://localhost:3000/api/accounts/${accountId}/message-topics`, {
  method: "POST",
  headers: new Headers({ cookie, "content-type": "application/json", origin: "http://localhost:3000" }),
  body: JSON.stringify(body)
}), { params: Promise.resolve({ accountId }) });

describe("message-topics route", () => {
  test("sets and adds topics on the mailbox's own conversation", async () => {
    const set = await post({ threadId: message.threadId, action: "set", topicIds: [topic.id] });
    expect(set.status).toBe(200);
    expect(((await set.json()) as { topics: Array<{ id: string }> }).topics.map(entry => entry.id)).toEqual([topic.id]);
    expect((await post({ threadId: message.threadId, action: "add", topicId: topic.id })).status).toBe(200);
  });

  test("rejects a thread id the mailbox does not hold and writes nothing", async () => {
    const foreign = "<thread-of-another-mailbox@example.test>";
    for (const body of [{ action: "set", topicIds: [topic.id] }, { action: "add", topicId: topic.id }]) {
      const response = await post({ threadId: foreign, ...body });
      expect(response.status).toBe(404);
    }
    expect(await getTopicsForThread(accountId, foreign)).toEqual([]);
  });
});
