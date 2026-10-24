import { beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "./testDbHarness";
import { identityTestAccount } from "./testFixtures/senderIdentities";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { requireActiveUserSession } from "./auth";
import { mintMcpToken } from "./mcpAuth";
import { MCP_TOOL_SCOPES, assertMcpScope, mcpToolScope, parseMcpScopes, scopesForMcpMode, type McpPermissionMode } from "./mcpPermissions";
import { executeMcpHttpRequest } from "./mcpServer";

const accountId = `mcp-tool-scopes-${crypto.randomUUID()}`, sharedId = `${accountId}-shared`, otherId = `${accountId}-other`;
const account = identityTestAccount(accountId);
let fixture: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
let minted: Awaited<ReturnType<typeof mintMcpToken>>;
let mintMode: (mode: McpPermissionMode) => ReturnType<typeof mintMcpToken>;
beforeAll(async () => {
  const db = await dbModulePromise;
  for (const id of [accountId, sharedId, otherId]) await db.upsertAccount(identityTestAccount(id));
  fixture = await createAuthenticatedTestSession(accountId);
  await fixture.addMembership(fixture.user.id, sharedId, "viewer");
  await fixture.addMembership(fixture.user.id, otherId, "manager");
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: fixture.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session missing");
  mintMode = mode => mintMcpToken(session, accountId, `Synthetic ${mode} token`, 3600, { mode, accountIds: [accountId, sharedId] });
  minted = await mintMode("read");
});
const callAs = (tokenRecord: typeof minted.tokenRecord, body: unknown) => executeMcpHttpRequest({ body, accountId, account, tokenRecord,
  authInfo: { token: "", clientId: "synthetic", scopes: ["send", "manage"], extra: { userId: "untrusted-synthetic" } } });
const call = (body: unknown) => callAs(minted.tokenRecord, body);
const request = (name: string, args: Record<string, unknown> = {}, id = 1) => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
const listedTools = async (tokenRecord: typeof minted.tokenRecord) => {
  const response = await callAs(tokenRecord, { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
  return (response.responses[0] as unknown as { result: { tools: { name: string }[] } }).result.tools.map(tool => tool.name).sort();
};
const toolsFor = (scopes: readonly string[]) => Object.entries(MCP_TOOL_SCOPES).filter(([, scope]) => scopes.includes(scope)).map(([name]) => name).sort();

test("every registered tool has an explicit scope; registration changes must update the allowlist", async () => {
  expect(await listedTools((await mintMode("full")).tokenRecord)).toEqual(Object.keys(MCP_TOOL_SCOPES).sort());
  expect(() => mcpToolScope("future_send_tool")).toThrow("no permission classification");
  expect(() => mcpToolScope("toString")).toThrow("no permission classification");
});

test("tools/list advertises only the tools the token's stored scopes allow", async () => {
  expect(await listedTools(minted.tokenRecord)).toEqual(toolsFor(["read"]));
  const drafts = await mintMode("drafts");
  expect(await listedTools(drafts.tokenRecord)).toEqual(toolsFor(["read", "drafts"]));
  // Legacy NULL scopes list read/drafts; invalid stored scopes list nothing. The stored value wins over the entry snapshot.
  fixture.master.prepare("UPDATE mcp_tokens SET scopes=NULL WHERE id=?").run(drafts.tokenRecord.id);
  expect(await listedTools({ ...drafts.tokenRecord, scopes: scopesForMcpMode("full") })).toEqual(toolsFor(["read", "drafts"]));
  fixture.master.prepare("UPDATE mcp_tokens SET scopes='garbage' WHERE id=?").run(drafts.tokenRecord.id);
  expect(await listedTools(drafts.tokenRecord)).toEqual([]);
});

for (const kind of ["drafts", "legacy"] as const) test(`${kind} token: manage tools are refused via tools/call, read calls in the same batch succeed`, async () => {
  const { tokenRecord } = await mintMode("drafts");
  if (kind === "legacy") fixture.master.prepare("UPDATE mcp_tokens SET scopes=NULL WHERE id=?").run(tokenRecord.id);
  const manage = Object.entries(MCP_TOOL_SCOPES).filter(([, scope]) => scope === "manage").map(([name]) => name);
  expect(manage.length).toBeGreaterThan(0);
  const response = await callAs(tokenRecord, [...manage.map((name, index) => request(name, {}, index + 1)), request("list_folders", {}, 99)]);
  for (const [index] of manage.entries()) {
    expect(response.responses.find(message => "id" in message && message.id === index + 1))
      .toMatchObject({ result: { isError: true, content: [{ type: "text", text: "Token has no manage permission" }] } });
  }
  expect(JSON.stringify(response.responses.find(message => "id" in message && message.id === 99))).not.toContain('"isError":true');
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
