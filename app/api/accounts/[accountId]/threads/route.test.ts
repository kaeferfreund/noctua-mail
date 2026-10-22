// @ts-expect-error bun:test is provided by the runner and is absent from this tsconfig.
import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { sealSession, type SessionData } from "@/lib/auth";
import { dbModulePromise } from "@/lib/testDbHarness";
import { clampThreadListPageSize } from "./route";

const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;
const { GET } = await import("./route");

function buildAccount(accountId: string): Account {
  return {
    id: accountId,
    name: "Thread List Test",
    email: "owner@example.test",
    avatar: "",
    imap: {
      host: "imap.example.test",
      port: 993,
      secure: true,
      user: "owner@example.test",
      password: "secret-imap"
    },
    smtp: {
      host: "smtp.example.test",
      port: 465,
      secure: true,
      user: "owner@example.test",
      password: "secret-smtp"
    }
  };
}

function buildFolder(accountId: string): Folder {
  return {
    id: `${accountId}:Inbox`,
    accountId,
    name: "Inbox",
    count: 2,
    unreadCount: 0,
    specialUse: "\\Inbox"
  };
}

function buildMessage(accountId: string, folderId: string, index: number): Message {
  return {
    id: `${accountId}-message-${index}`,
    accountId,
    folderId,
    threadId: `${accountId}-thread-${index}`,
    messageId: `<${accountId}-message-${index}@example.test>`,
    subject: `Thread ${index}`,
    from: "alice@example.test",
    to: "owner@example.test",
    preview: `Thread ${index}`,
    date: new Date(Date.UTC(2026, 3, 10, 12, index, 0)).toISOString(),
    dateValue: Date.UTC(2026, 3, 10, 12, index, 0),
    body: "stored body that the list must not echo",
    category: "notification",
    categoryScore: 0.9,
    categorySignals: ["from-domain"]
  };
}

function buildCookieHeader(accountId: string) {
  const session: SessionData = {
    userId: "user-thread-list",
    accountId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60
  };
  return `noctua_session=${encodeURIComponent(sealSession(session))}`;
}

describe("thread list page size", () => {
  test("keeps the default and caps the requested page", () => {
    expect(clampThreadListPageSize(null)).toBe(300);
    expect(clampThreadListPageSize("300")).toBe(300);
    expect(clampThreadListPageSize("600")).toBe(600);
    expect(clampThreadListPageSize("100000")).toBe(600);
    expect(clampThreadListPageSize("0")).toBe(300);
    expect(clampThreadListPageSize("-4")).toBe(1);
    expect(clampThreadListPageSize("abc")).toBe(300);
    expect(clampThreadListPageSize("12")).toBe(12);
  });

  test("applies the cap and omits empty list fields", async () => {
    const accountId = `acc-thread-list-${Date.now()}`;
    const folder = buildFolder(accountId);
    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);
    await upsertMessages(
      accountId,
      folder.id,
      [buildMessage(accountId, folder.id, 1), buildMessage(accountId, folder.id, 2)],
      true
    );

    const response = await GET(
      new Request(
        `http://localhost/api/accounts/${accountId}/threads?folderId=${encodeURIComponent(folder.id)}&pageSize=-1`,
        { headers: { cookie: buildCookieHeader(accountId) } }
      ),
      { params: Promise.resolve({ accountId }) }
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<Record<string, unknown>>;
      hasMore: boolean;
    };
    expect(body.items).toHaveLength(1);
    expect(body.hasMore).toBe(true);
    const item = body.items[0] ?? {};
    expect(item.body).toBeUndefined();
    expect(item.categoryScore).toBeUndefined();
    expect(item.categorySignals).toBeUndefined();
    expect(item.attachments).toBeUndefined();
    expect(item.calendarInviteStates).toBeUndefined();
    expect(item.category).toBe("notification");
    expect(item.calendarEventUids).toEqual([]);
    expect(item.topics).toEqual([]);
    expect(item.topicSuggestions).toEqual([]);
    expect(item.from).toBe("alice@example.test");
    expect(typeof item.threadId).toBe("string");
  });
});
