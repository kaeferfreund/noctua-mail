import { beforeAll, expect, test } from "bun:test";
import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { requireActiveUserSession } from "@/lib/auth";
import { mintMcpToken } from "@/lib/mcpAuth";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { POST } from "./route";

const origin = "http://localhost:3000";
const limit = 7_006_892;
let token: string;

beforeAll(async () => {
  const accountId = crypto.randomUUID();
  await (await dbModulePromise).upsertAccount(identityTestAccount(accountId));
  const fixture = await createAuthenticatedTestSession(accountId);
  const session = await requireActiveUserSession(new Request(origin, { headers: fixture.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session missing");
  ({ token } = await mintMcpToken(session, accountId, "Synthetic MCP body fixture", 3600));
});

function post(body: BodyInit, authorization?: string, contentLength?: number) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) headers.set("authorization", `Bearer ${authorization}`);
  if (contentLength !== undefined) headers.set("content-length", String(contentLength));
  return POST(new Request(`${origin}/api/mcp`, { method: "POST", headers, body }));
}

test("oversized MCP bodies are rejected before JSON parsing, after authentication", async () => {
  const oversized = limit + 1;
  expect((await post("{}", undefined, oversized)).status).toBe(401);
  const declared = await post("{}", token, oversized);
  expect(declared.status).toBe(413);
  const cancelled = Promise.withResolvers<void>();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(limit));
      controller.enqueue(new Uint8Array(1));
      // Leave the stream open until the route cancels it.
    },
    cancel() { cancelled.resolve(); }
  });
  const response = await post(body, token);
  expect(response.status).toBe(413);
  await cancelled.promise;
  const error = { jsonrpc: "2.0", id: null, error: { code: ErrorCode.InvalidRequest, message: "Request body too large" } };
  expect(await declared.json()).toEqual(error);
  expect(await response.json()).toEqual(error);
});

test("the same limit accepts one complete request and caps a batch as a whole", async () => {
  const ping = JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 });
  const nearLimit = ping.padEnd(limit, " ");
  const response = await post(nearLimit, token);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
  expect((await post(`[${nearLimit}]`, token)).status).toBe(413);
});
