import { describe, expect, test } from "bun:test";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { NodeNextRequest, NodeNextResponse } from "next/dist/server/base-http/node";
import { sendResponse } from "next/dist/server/send-response";
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
    name: "Large JSON Delivery Test",
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
  const accountId = `acc-large-json-${crypto.randomUUID()}`;
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

type Delivered = { headers: http.IncomingHttpHeaders; raw: Buffer; decoded: string };

/**
 * Serves the route's Response through Next's own `sendResponse` (the step the
 * App Router uses for route handlers) and reads it back twice: raw bytes over
 * node:http and decoded by fetch, the way the browser sees it.
 */
async function deliverThroughNext(respond: (acceptEncoding?: string) => Promise<Response>): Promise<Delivered> {
  const server = http.createServer(async (req, res) => {
    const acceptEncoding = req.headers["accept-encoding"];
    const response = await respond(typeof acceptEncoding === "string" ? acceptEncoding : undefined);
    await sendResponse(new NodeNextRequest(req), new NodeNextResponse(res), response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  const acceptEncoding = "gzip, deflate, br, zstd";
  try {
    const { headers, raw } = await new Promise<{ headers: http.IncomingHttpHeaders; raw: Buffer }>((resolve, reject) => {
      http
        .get(url, { headers: { "accept-encoding": acceptEncoding } }, (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => resolve({ headers: res.headers, raw: Buffer.concat(chunks) }));
          res.on("error", reject);
        })
        .on("error", reject);
    });
    const decoded = await (await fetch(url, { headers: { "accept-encoding": acceptEncoding } })).text();
    return { headers, raw, decoded };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("large JSON reads reach the client as JSON", () => {
  for (const route of routes) {
    test(`${route.name}: the bytes Next sends match the headers it sends`, async () => {
      const direct = await route.call("gzip, deflate, br, zstd");
      expect(direct.status).toBe(200);
      // Next drops Content-Encoding (and Content-Length) from route-handler
      // responses, so a self-encoded body would reach the client undeclared.
      expect(direct.headers.get("content-encoding")).toBeNull();
      const expected = await direct.json();

      const delivered = await deliverThroughNext(route.call);
      expect(delivered.headers["content-type"]).toContain("application/json");
      expect(delivered.headers["content-encoding"]).toBeUndefined();
      expect(delivered.raw.byteLength).toBeGreaterThan(8 * 1024);
      expect(JSON.parse(delivered.raw.toString("utf8"))).toEqual(expected);
      expect(JSON.parse(delivered.decoded)).toEqual(expected);
    });
  }
});
