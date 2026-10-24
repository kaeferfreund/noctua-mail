import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { authenticatedTestCookie } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;
const { createTopic, setThreadTopics } = await import("@/lib/topics");
const { POST: threadRelated } = await import("@/app/api/accounts/[accountId]/thread/related/route");
const { GET: messageDetail } = await import("@/app/api/accounts/[accountId]/messages/[messageId]/route");

// The reader's conversation window carries the thread's topic suggestions once (on the
// anchor row); body reads per expanded card skip them.
const accountId = `acc-window-suggestions-${crypto.randomUUID()}`;
const folder: Folder = { id: `${accountId}:INBOX`, accountId, name: "Inbox", count: 0, unreadCount: 0, specialUse: "\\Inbox" };
const account: Account = {
  id: accountId, name: "Window suggestions", email: "owner@example.test", avatar: "",
  imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "secret" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "secret" }
};
const message = (id: string, threadId: string, minute: number): Message => ({
  id, accountId, folderId: folder.id, threadId, messageId: `<${id}@example.test>`, subject: `Synthetic ${threadId}`,
  from: "Synthetic Updates <updates@example.test>", fromEmail: "updates@example.test", to: "owner@example.test",
  listId: "updates <updates.example.test>", preview: "Synthetic", body: "Synthetic body",
  date: new Date(Date.UTC(2026, 3, 1, 9, minute)).toISOString(), dateValue: Date.UTC(2026, 3, 1, 9, minute)
});

await upsertAccount(account);
await saveFoldersForAccount(accountId, [folder]);
await upsertMessages(accountId, folder.id, [
  message("history-1", "thread-history", 0),
  ...[1, 2, 3, 4].map(n => message(`target-${n}`, "thread-target", n))
], true, { recomputeThreads: false });
const topic = await createTopic(accountId, "Synthetic topic", "blue");
await setThreadTopics(accountId, "thread-history", [topic.id]);
const cookie = await authenticatedTestCookie(accountId);

const params = (extra: Record<string, string> = {}) => ({ params: Promise.resolve({ accountId, ...extra }) });
const windowRead = async (window: Record<string, unknown>) => {
  const headers = new Headers({ cookie, "content-type": "application/json", origin: "http://localhost:3000" });
  const res = await threadRelated(new Request(`http://localhost:3000/api/accounts/${accountId}/thread/related`, {
    method: "POST", headers,
    body: JSON.stringify({ threadIds: ["thread-target"], projection: "headers", window })
  }), params());
  expect(res.status).toBe(200);
  return await res.json() as { items: Message[]; window: { anchorId: string | null; olderCursor: string | null } };
};

describe("conversation window topic suggestions", () => {
  test("only the anchor row carries them, and a cursor page carries none", async () => {
    const first = await windowRead({ anchorMessageId: "target-3", before: 1, after: 0 });
    expect(first.items.map(item => item.id)).toEqual(["target-2", "target-3", "target-4"]);
    const withSuggestions = first.items.filter(item => item.topicSuggestions !== undefined);
    expect(withSuggestions.map(item => item.id)).toEqual(["target-3"]);
    expect(withSuggestions[0].topicSuggestions?.map(entry => entry.name)).toEqual(["Synthetic topic"]);
    expect(first.window.olderCursor).toBeTruthy();
    const older = await windowRead({ cursor: first.window.olderCursor });
    expect(older.items.map(item => item.id)).toEqual(["target-1"]);
    expect(older.items.every(item => item.topicSuggestions === undefined)).toBe(true);
  });

  test("the detail route skips them for a body read, and keeps them by default", async () => {
    const read = async (query: string) => {
      const res = await messageDetail(new Request(`http://localhost:3000/api/accounts/${accountId}/messages/target-2${query}`,
        { headers: { cookie } }), params({ messageId: "target-2" }));
      expect(res.status).toBe(200);
      return (await res.json() as { message: Message }).message;
    };
    expect((await read("")).topicSuggestions?.map(entry => entry.name)).toEqual(["Synthetic topic"]);
    const body = await read("?suggestions=0");
    expect(body.topicSuggestions).toBeUndefined();
    expect(body.body).toBe("Synthetic body");
  });
});

describe("conversation window folder limit", () => {
  test("window.folderId limits the window to that folder", async () => {
    const inFolder = await windowRead({ anchorMessageId: "target-4", folderId: folder.id });
    expect(inFolder.items.map(item => item.id)).toEqual(["target-1", "target-2", "target-3", "target-4"]);
    const elsewhere = await windowRead({ anchorMessageId: "target-4", folderId: `${accountId}:Trash` });
    expect(elsewhere.items).toEqual([]);
  });
});
