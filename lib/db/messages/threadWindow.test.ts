import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "../../data";
import { dbModulePromise } from "../../testDbHarness";

const {
  listThreadMessages,
  listThreadMessageWindow,
  ThreadWindowCursorError,
  saveFoldersForAccount,
  upsertAccount,
  upsertMessages
} = await dbModulePromise;

const BASE_DATE = Date.UTC(2026, 0, 1, 8, 0, 0);

function account(accountId: string): Account {
  return {
    id: accountId,
    name: "Synthetic window account",
    email: "owner@example.test",
    avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "x" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "x" }
  };
}

function folders(accountId: string): Folder[] {
  return [
    { id: `${accountId}-inbox`, accountId, name: "Inbox", count: 0, unreadCount: 0, specialUse: "\\Inbox" },
    { id: `${accountId}-trash`, accountId, name: "Trash", count: 0, unreadCount: 0, specialUse: "\\Trash" }
  ];
}

// A linear conversation: every message replies to the previous one.
function conversation(accountId: string, threadId: string, count: number, options: { sameDate?: boolean } = {}) {
  return Array.from({ length: count }, (_, index): Message => {
    const id = `${threadId}-m${String(index).padStart(3, "0")}`;
    const dateValue = options.sameDate ? BASE_DATE : BASE_DATE + index * 60_000;
    return {
      id,
      accountId,
      folderId: `${accountId}-inbox`,
      threadId,
      parentId: index > 0 ? `${threadId}-m${String(index - 1).padStart(3, "0")}` : undefined,
      messageId: `<${id}@example.test>`,
      subject: "Synthetic long conversation",
      from: "sender@example.test",
      to: "owner@example.test",
      preview: `Preview ${index}`,
      date: new Date(dateValue).toISOString(),
      dateValue,
      body: `Synthetic body ${index}`,
      htmlBody: `<p>Synthetic HTML body ${index}</p>`
    };
  });
}

async function seed(accountId: string, messages: Message[]) {
  await upsertAccount(account(accountId));
  await saveFoldersForAccount(accountId, folders(accountId));
  await upsertMessages(accountId, null, messages, false, { recomputeThreads: false });
}

const ids = (items: Message[]) => items.map((item) => item.id);
const indexOf = (id: string) => Number(id.slice(-3));

describe("thread header projection", () => {
  test("omits bodies, marks content as omitted and excludes folders in SQL", async () => {
    const accountId = "acc-thread-projection";
    const threadId = `${accountId}-thread`;
    const messages = conversation(accountId, threadId, 4);
    messages[3] = { ...messages[3], folderId: `${accountId}-trash` };
    await seed(accountId, messages);

    const headers = await listThreadMessages({
      accountId,
      threadIds: [threadId],
      projection: "headers",
      excludeFolderIds: [`${accountId}-trash`]
    });
    expect(ids(headers.items).sort()).toEqual(ids(messages.slice(0, 3)));
    for (const item of headers.items) {
      expect(item.body).toBe("");
      expect(item.htmlBody).toBeUndefined();
      expect(item.contentState).toBe("omitted");
      expect(item.subject).toBe("Synthetic long conversation");
      expect(item.messageId).toBe(`<${item.id}@example.test>`);
    }
    expect(JSON.stringify(headers.items)).not.toContain("Synthetic body");

    const full = await listThreadMessages({ accountId, threadIds: [threadId] });
    expect(full.items).toHaveLength(4);
    const first = full.items.find((item) => item.id === messages[0].id);
    expect(first?.body).toBe("Synthetic body 0");
    expect(first?.contentState).toBe("stored");
  });

  test("never returns another account's rows for the same thread id", async () => {
    const threadId = "shared-thread-id";
    await seed("acc-thread-isolation-a", conversation("acc-thread-isolation-a", threadId, 3));
    await seed("acc-thread-isolation-b", conversation("acc-thread-isolation-b", threadId, 2));

    const headers = await listThreadMessages({
      accountId: "acc-thread-isolation-b",
      threadIds: [threadId],
      projection: "headers"
    });
    expect(headers.items.map((item) => item.accountId)).toEqual([
      "acc-thread-isolation-b",
      "acc-thread-isolation-b"
    ]);
    const window = await listThreadMessageWindow({ accountId: "acc-thread-isolation-b", threadId });
    expect(window.window.total).toBe(2);
    expect(window.items.every((item) => item.accountId === "acc-thread-isolation-b")).toBe(true);
    // An anchor id from the other account does not leak into this window.
    const crossAnchor = await listThreadMessageWindow({
      accountId: "acc-thread-isolation-b",
      threadId,
      anchorMessageId: `${threadId}-m002`
    });
    expect(crossAnchor.window.anchorId).toBe(`${threadId}-m001`);
  });
});

describe("thread message window", () => {
  const accountId = "acc-thread-window";
  const threadId = `${accountId}-thread`;
  const messages = conversation(accountId, threadId, 200);
  const seeded = seed(accountId, messages);

  test("returns the anchor ±10 plus the newest message, headers only", async () => {
    await seeded;
    const result = await listThreadMessageWindow({
      accountId,
      threadId,
      anchorMessageId: messages[100].id
    });
    expect(result.window.total).toBe(200);
    expect(result.window.anchorId).toBe(messages[100].id);
    expect(ids(result.items)).toEqual([...ids(messages.slice(90, 111)), messages[199].id]);
    expect(result.items.every((item) => item.contentState === "omitted" && item.body === "")).toBe(true);
    expect(result.window.hasOlder).toBe(true);
    expect(result.window.hasNewer).toBe(true);
    // Parents outside the window come back as placeholders.
    expect(ids(result.placeholders).sort()).toEqual([messages[89].id, messages[198].id]);
  });

  test("walking both cursors covers the conversation exactly once", async () => {
    await seeded;
    const first = await listThreadMessageWindow({ accountId, threadId, anchorMessageId: messages[100].id });
    const seen = ids(first.items);
    let olderCursor = first.window.olderCursor;
    while (olderCursor) {
      const page = await listThreadMessageWindow({ accountId, threadId, cursor: olderCursor });
      expect(page.items.length).toBeLessThanOrEqual(20);
      seen.push(...ids(page.items));
      olderCursor = page.window.olderCursor;
      if (!page.window.hasOlder) expect(olderCursor).toBeNull();
    }
    let newerCursor = first.window.newerCursor;
    while (newerCursor) {
      const page = await listThreadMessageWindow({ accountId, threadId, cursor: newerCursor });
      seen.push(...ids(page.items));
      newerCursor = page.window.newerCursor;
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.map(indexOf).sort((a, b) => a - b)).toEqual(messages.map((_, index) => index));
  });

  test("an old deep-link anchor opens a window around it", async () => {
    await seeded;
    const result = await listThreadMessageWindow({ accountId, threadId, anchorMessageId: messages[3].id });
    expect(ids(result.items)).toEqual([...ids(messages.slice(0, 14)), messages[199].id]);
    expect(result.window.hasOlder).toBe(false);
    expect(result.window.olderCursor).toBeNull();
    expect(result.window.hasNewer).toBe(true);
  });

  test("an unknown anchor falls back to the newest message", async () => {
    await seeded;
    const result = await listThreadMessageWindow({ accountId, threadId, anchorMessageId: "missing" });
    expect(result.window.anchorId).toBe(messages[199].id);
    expect(ids(result.items)).toEqual(ids(messages.slice(189, 200)));
    expect(result.window.hasNewer).toBe(false);
  });

  test("rejects malformed cursors and cursors issued for another thread", async () => {
    await seeded;
    const first = await listThreadMessageWindow({ accountId, threadId, anchorMessageId: messages[100].id });
    await expect(
      listThreadMessageWindow({ accountId, threadId: "other-thread", cursor: first.window.olderCursor })
    ).rejects.toBeInstanceOf(ThreadWindowCursorError);
    await expect(
      listThreadMessageWindow({ accountId, threadId, cursor: "not-a-cursor" })
    ).rejects.toBeInstanceOf(ThreadWindowCursorError);
  });
});

describe("thread window ordering", () => {
  test("equal dates page deterministically by id without gaps", async () => {
    const accountId = "acc-thread-window-ties";
    const threadId = `${accountId}-thread`;
    const messages = conversation(accountId, threadId, 45, { sameDate: true });
    await seed(accountId, messages);
    const first = await listThreadMessageWindow({ accountId, threadId, anchorMessageId: messages[20].id });
    expect(ids(first.items)).toEqual([...ids(messages.slice(10, 31)), messages[44].id]);
    const older = await listThreadMessageWindow({ accountId, threadId, cursor: first.window.olderCursor });
    expect(ids(older.items)).toEqual(ids(messages.slice(0, 10)));
    const newer = await listThreadMessageWindow({ accountId, threadId, cursor: first.window.newerCursor });
    expect(ids(newer.items)).toEqual(ids(messages.slice(31, 44)));
    expect(newer.window.hasNewer).toBe(false);
  });

  test("excluded folders are left out of the window and its total", async () => {
    const accountId = "acc-thread-window-folders";
    const threadId = `${accountId}-thread`;
    const messages = conversation(accountId, threadId, 30).map((message, index) =>
      index % 3 === 0 ? { ...message, folderId: `${accountId}-trash` } : message
    );
    await seed(accountId, messages);
    const result = await listThreadMessageWindow({
      accountId,
      threadId,
      anchorMessageId: messages[29].id,
      excludeFolderIds: [`${accountId}-trash`]
    });
    expect(result.window.total).toBe(20);
    expect(result.items.some((item) => item.folderId === `${accountId}-trash`)).toBe(false);
  });
});
