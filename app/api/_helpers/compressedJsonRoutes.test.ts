import { describe, expect, test } from "bun:test";
import { gunzipSync } from "node:zlib";
import type { Account, Folder, Message } from "@/lib/data";
import { authenticatedTestCookie } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;
const { GET: threads } = await import("@/app/api/accounts/[accountId]/threads/route");
const { GET: messages } = await import("@/app/api/accounts/[accountId]/messages/route");
const { GET: related } = await import("@/app/api/accounts/[accountId]/related/route");
const { POST: threadRelated } = await import("@/app/api/accounts/[accountId]/thread/related/route");
const { GET: messageDetail } = await import("@/app/api/accounts/[accountId]/messages/[messageId]/route");

const MESSAGE_COUNT = 60;

function buildAccount(accountId: string): Account {
  return {
    id: accountId,
    name: "Compressed JSON Test",
    email: "owner@example.test",
    avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "secret-imap" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "secret-smtp" }
  };
}

function buildMessage(accountId: string, folderId: string, index: number): Message {
  const dateValue = Date.UTC(2026, 3, 10, 12, index, 0);
  return {
    id: `${accountId}-message-${index}`,
    accountId,
    folderId,
    threadId: `${accountId}-thread-${index}`,
    messageId: `<${accountId}-message-${index}@example.test>`,
    subject: `Quarterly synthetic report ${index}`,
    from: "alice@example.test",
    to: "owner@example.test",
    preview: `Synthetic preview text for message ${index} `.repeat(4),
    date: new Date(dateValue).toISOString(),
    dateValue,
    body: `Synthetic body paragraph ${index}. `.repeat(800)
  };
}

async function seedMailbox() {
  const accountId = `acc-compressed-json-${crypto.randomUUID()}`;
  const folder: Folder = {
    id: `${accountId}:Inbox`,
    accountId,
    name: "Inbox",
    count: MESSAGE_COUNT,
    unreadCount: 0,
    specialUse: "\\Inbox"
  };
  await upsertAccount(buildAccount(accountId));
  await saveFoldersForAccount(accountId, [folder]);
  await upsertMessages(
    accountId,
    folder.id,
    Array.from({ length: MESSAGE_COUNT }, (_, index) => buildMessage(accountId, folder.id, index)),
    true
  );
  return { accountId, folderId: folder.id, cookie: await authenticatedTestCookie(accountId) };
}

const mailbox = await seedMailbox();

function request(path: string, init: RequestInit & { acceptEncoding?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", mailbox.cookie);
  if (init.acceptEncoding) headers.set("accept-encoding", init.acceptEncoding);
  if (init.method === "POST") {
    headers.set("content-type", "application/json");
    headers.set("origin", "http://localhost:3000");
  }
  return new Request(`http://localhost:3000/api/accounts/${mailbox.accountId}/${path}`, { ...init, headers });
}

const folderQuery = () => `folderId=${encodeURIComponent(mailbox.folderId)}`;
const params = (extra: Record<string, string> = {}) => ({
  params: Promise.resolve({ accountId: mailbox.accountId, ...extra })
});

const routes: Array<{ name: string; call: (acceptEncoding?: string) => Promise<Response> }> = [
  { name: "threads list", call: (acceptEncoding) => threads(request(`threads?${folderQuery()}`, { acceptEncoding }), params()) },
  { name: "messages list", call: (acceptEncoding) => messages(request(`messages?${folderQuery()}`, { acceptEncoding }), params()) },
  {
    name: "related list",
    call: (acceptEncoding) =>
      related(request(`related?relatedId=${encodeURIComponent(`${mailbox.accountId}-message-0`)}`, { acceptEncoding }), params())
  },
  {
    name: "thread messages",
    call: (acceptEncoding) =>
      threadRelated(
        request("thread/related", {
          method: "POST",
          acceptEncoding,
          body: JSON.stringify({
            threadIds: Array.from({ length: 10 }, (_, index) => `${mailbox.accountId}-thread-${index}`)
          })
        }),
        params()
      )
  },
  {
    name: "message detail",
    call: (acceptEncoding) => {
      const messageId = `${mailbox.accountId}-message-0`;
      return messageDetail(request(`messages/${encodeURIComponent(messageId)}`, { acceptEncoding }), params({ messageId }));
    }
  }
];

describe("large JSON reads are gzip-compressed", () => {
  for (const route of routes) {
    test(`${route.name} gzips for gzip clients and is unchanged otherwise`, async () => {
      const plain = await route.call();
      expect(plain.status).toBe(200);
      expect(plain.headers.get("content-encoding")).toBeNull();
      expect(plain.headers.get("vary")).toContain("Accept-Encoding");
      const plainText = await plain.text();
      expect(new TextEncoder().encode(plainText).byteLength).toBeGreaterThan(8 * 1024);

      const compressed = await route.call("gzip, deflate, br, zstd");
      expect(compressed.status).toBe(200);
      expect(compressed.headers.get("content-encoding")).toBe("gzip");
      expect(compressed.headers.get("content-type")).toBe("application/json");
      const bytes = new Uint8Array(await compressed.arrayBuffer());
      expect(bytes.byteLength).toBeLessThan(plainText.length / 4);
      expect(JSON.parse(gunzipSync(bytes).toString("utf8"))).toEqual(JSON.parse(plainText));
    });
  }

  test("a fetch client decodes the route response transparently", async () => {
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (incoming) => threads(request(`threads?${folderQuery()}`, { acceptEncoding: incoming.headers.get("accept-encoding") ?? undefined }), params())
    });
    try {
      const response = await fetch(server.url, { headers: { "accept-encoding": "gzip" } });
      expect(response.headers.get("content-encoding")).toBe("gzip");
      const body = (await response.json()) as { items: Message[]; total: number };
      expect(body.items).toHaveLength(MESSAGE_COUNT);
      expect(body.total).toBe(MESSAGE_COUNT);
    } finally {
      await server.stop(true);
    }
  });
});
