import { beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "./testDbHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { requireActiveUserSession } from "./auth";
import { mintMcpToken } from "./mcpAuth";
import { MCP_TOOL_SCOPES, assertMcpScope, mcpToolScope, parseMcpScopes } from "./mcpPermissions";
import { executeMcpHttpRequest } from "./mcpServer";

const accountId = `mcp-tool-scopes-${crypto.randomUUID()}`, sharedId = `${accountId}-shared`, otherId = `${accountId}-other`;
const account = identityTestAccount(accountId);
let fixture: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
let minted: Awaited<ReturnType<typeof mintMcpToken>>;
beforeAll(async () => {
  const db = await dbModulePromise;
  for (const id of [accountId, sharedId, otherId]) await db.upsertAccount(identityTestAccount(id));
  fixture = await createAuthenticatedTestSession(accountId);
  await fixture.addMembership(fixture.user.id, sharedId, "viewer");
  await fixture.addMembership(fixture.user.id, otherId, "manager");
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: fixture.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session missing");
  minted = await mintMcpToken(session, accountId, "Synthetic read token", 3600, { mode: "read", accountIds: [accountId, sharedId] });
});
const call = (body: unknown) => executeMcpHttpRequest({ body, accountId, account, tokenRecord: minted.tokenRecord,
  authInfo: { token: "", clientId: "synthetic", scopes: ["send", "manage"], extra: { userId: "untrusted-synthetic" } } });
const request = (name: string, args: Record<string, unknown> = {}, id = 1) => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });

test("every registered tool has an explicit scope; registration changes must update the allowlist", async () => {
  const response = await call({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
  const body = response.responses[0] as unknown as { result: { tools: { name: string }[] } };
  expect(body.result.tools.map(tool => tool.name).sort()).toEqual(Object.keys(MCP_TOOL_SCOPES).sort());
  expect(() => mcpToolScope("future_send_tool")).toThrow("no permission classification");
  expect(() => mcpToolScope("toString")).toThrow("no permission classification");
});

test("read token denies every mutation centrally before schema/handler execution, including batched calls", async () => {
  const tools = Object.entries(MCP_TOOL_SCOPES).filter(([, scope]) => scope !== "read");
  const response = await call(tools.map(([name], index) => request(name, {}, index + 1)));
  expect(response.responses).toHaveLength(tools.length);
  for (const [index, [, scope]] of tools.entries()) {
    const message = response.responses.find(message => "id" in message && message.id === index + 1);
    expect(message).toMatchObject({ result: { isError: true, content: [{ type: "text", text: `Token has no ${scope} permission` }] } });
  }
  expect(JSON.stringify((await call(request("future_send_tool"))).responses)).toContain("no permission classification");
});

test("list_accounts exposes only token mailboxes with live roles and trusted creator identity", async () => {
  const response = await call(request("list_accounts"));
  const body = response.responses[0] as unknown as { result: { structuredContent: { accounts: { id: string; accessRole: string }[] } } };
  expect(body.result.structuredContent.accounts.map(item => item.id).sort()).toEqual([accountId, sharedId].sort());
  expect(body.result.structuredContent.accounts.find(item => item.id === sharedId)?.accessRole).toBe("viewer");
  const shared = await call(request("list_sender_identities", { accountId: sharedId }));
  expect(JSON.stringify(shared.responses)).not.toContain('"isError":true');
  expect(JSON.stringify((await call(request("list_sender_identities", { accountId: otherId }))).responses)).toContain("not covered");
  fixture.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(fixture.user.id, sharedId);
  try {
    expect(JSON.stringify((await call(request("list_accounts"))).responses)).not.toContain(sharedId);
    expect(JSON.stringify((await call(request("list_sender_identities", { accountId: sharedId }))).responses)).toContain("Unauthorized MCP token");
  } finally { await fixture.addMembership(fixture.user.id, sharedId, "viewer"); }
});

test("stored scopes are authoritative on every call and malformed values fail closed", async () => {
  for (const value of ["garbage", "{}", '["read","unknown"]', '"read"', '[]']) {
    expect(parseMcpScopes(value)).toEqual([]);
    expect(() => assertMcpScope(parseMcpScopes(value), "read")).toThrow("Token has no read permission");
  }
  fixture.master.prepare("UPDATE mcp_tokens SET scopes='[]' WHERE id=?").run(minted.tokenRecord.id);
  try { expect(JSON.stringify((await call(request("list_accounts"))).responses)).toContain("Token has no read permission"); }
  finally { fixture.master.prepare("UPDATE mcp_tokens SET scopes='[\"read\"]' WHERE id=?").run(minted.tokenRecord.id); }
});
