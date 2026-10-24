import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { authenticatedTestCookie } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

// Security recheck N2: a NUL byte (or another control character) in the search query reached the FTS5 MATCH
// string and failed with "unterminated string" (unhandled 500). Control characters separate search tokens.
const { listMessages, listThreads, saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;
const { GET: threads } = await import("@/app/api/accounts/[accountId]/threads/route");
const { GET: messages } = await import("@/app/api/accounts/[accountId]/messages/route");

const accountId = `acc-search-control-${crypto.randomUUID()}`;
const folder: Folder = { id: `${accountId}:Inbox`, accountId, name: "Inbox", count: 2, unreadCount: 0, specialUse: "\\Inbox" };
const message = (index: number, subject: string): Message => {
  const dateValue = Date.UTC(2026, 3, 10, 12, index, 0);
  return { id: `${accountId}-message-${index}`, accountId, folderId: folder.id, threadId: `${accountId}-thread-${index}`,
    messageId: `<${accountId}-message-${index}@example.test>`, subject, from: "alice@example.test", to: "owner@example.test",
    preview: subject, date: new Date(dateValue).toISOString(), dateValue, body: subject };
};
await upsertAccount({ id: accountId, name: "Search control chars", email: "owner@example.test", avatar: "",
  imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "synthetic-imap" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "synthetic-smtp" } } as Account);
await saveFoldersForAccount(accountId, [folder]);
await upsertMessages(accountId, folder.id, [message(0, "alpha needle"), message(1, "beta report")], true);
const cookie = await authenticatedTestCookie(accountId);

const list = async (route: typeof threads, path: "threads" | "messages", q: string) => {
  const url = `http://localhost:3000/api/accounts/${accountId}/${path}?folderId=${encodeURIComponent(folder.id)}&q=${encodeURIComponent(q)}`;
  const response = await route(new Request(url, { headers: { cookie } }), { params: Promise.resolve({ accountId }) });
  const body = response.status === 200 ? await response.json() as { items: Array<{ id: string }> } : null;
  return { status: response.status, ids: body?.items.map(item => item.id).sort() ?? null };
};

describe("search query with control characters", () => {
  for (const [name, route] of [["threads", threads], ["messages", messages]] as const) {
    for (const q of ["needle\u0000", "\u0000needle", "alpha\u0000needle", "needle\u0001\u001f\u007f", "\u0000", "nee\u0000dle"]) {
      test(`${name}: ${JSON.stringify(q)} -> 200`, async () => {
        const result = await list(route, name, q);
        expect(result.status).toBe(200);
        // Same result as the query with each control character read as a space.
        expect(result.ids).toEqual((await list(route, name, q.replace(/\p{Cc}/gu, " "))).ids);
      });
    }
    test(`${name}: NUL acts as a token separator`, async () => {
      expect((await list(route, name, "alpha\u0000needle")).ids).toEqual([`${accountId}-message-0`]);
      expect((await list(route, name, "beta\u0000needle")).ids).toEqual([]);
    });
  }

  // The address lists (`from`/`recipients`/`participants`, from the MCP search tool) go straight into LIKE: a NUL
  // ends the pattern early, so "\u0000nomatch" read as "%" and matched every message.
  for (const [name, run] of [
    ["messages", (filters: Record<string, string[]>) => listMessages({ accountId, folderId: folder.id, page: 1, pageSize: 50, ...filters })],
    ["threads", (filters: Record<string, string[]>) => listThreads({ accountId, folderId: folder.id, page: 1, pageSize: 50, ...filters })]
  ] as const) {
    for (const key of ["from", "recipients", "participants"]) {
      test(`${name}: control characters in ${key} act as spaces`, async () => {
        const ids = async (values: string[]) => (await run({ [key]: values })).items.map(item => item.id).sort();
        expect(await ids(["\u0000nomatch"])).toEqual([]);
        expect(await ids(["example\u0001\u007f"])).toEqual(await ids(["example"]));
        expect((await ids(["example"])).length).toBe(2);
      });
    }
  }
});
