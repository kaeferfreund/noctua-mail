import { expect, spyOn, test } from "bun:test";
import { createMcpRateLimiter } from "./mcpRateLimit";
import { dbModulePromise } from "./testDbHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { requireActiveUserSession } from "./auth";
import { mintMcpToken } from "./mcpAuth";
import { executeMcpHttpRequest } from "./mcpServer";

test("per-token budgets cover all tools, separate reads and writes, and reset after a minute", () => {
  let now = 1000;
  const clock = spyOn(Date, "now").mockImplementation(() => now);
  try {
    const limited = createMcpRateLimiter();
    for (let n = 0; n < 60; n++) expect(limited("reader", "list_folders")).toBe(false);
    expect(limited("reader", "list_draft_messages")).toBe(true);
    for (let n = 0; n < 10; n++) expect(limited("writer", n % 2 ? "update_draft_message" : "set_thread_status")).toBe(false);
    expect(limited("writer", "create_draft_message")).toBe(true);
    expect(limited("writer", "get_draft_message")).toBe(false);
    expect(limited("other-token", "update_draft_message")).toBe(false);
    for (let n = 0; n < 10; n++) expect(limited("sync", "check_new_mail")).toBe(false);
    expect(limited("sync", "check_new_mail")).toBe(true);
    now += 60_000;
    expect(limited("reader", "list_folders")).toBe(false);
    expect(limited("writer", "update_draft_message")).toBe(false);
  } finally { clock.mockRestore(); }
});

test("tools/call enforces token budgets across HTTP requests and within batches", async () => {
  const accountId = `mcp-budget-${crypto.randomUUID()}`;
  const account = identityTestAccount(accountId);
  const db = await dbModulePromise;
  await db.upsertAccount(account);
  const fixture = await createAuthenticatedTestSession(accountId);
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: fixture.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session missing");
  const tokenRecord = (await mintMcpToken(session, accountId, "Synthetic budget", 3600, { mode: "drafts" })).tokenRecord;
  const request = (id: number) => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "update_draft_message", arguments: { draftId: "missing" } } });
  const call = (body: unknown) => executeMcpHttpRequest({ body, accountId, account, tokenRecord });
  const batch = await call(Array.from({ length: 10 }, (_, n) => request(n + 1)));
  expect(JSON.stringify(batch.responses)).not.toContain('"rate_limited"');
  const last = await call(request(11));
  expect(last.responses[0]).toMatchObject({ id: 11, result: { isError: true,
    structuredContent: { ok: false, code: "rate_limited", status: 429, retryAfterSeconds: 60 } } });
});
