import { beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { deleteAccountControlPlane } from "@/lib/serverDb";
import { GET, POST } from "./route";
import { DELETE } from "./[tokenId]/route";

const accountId = `mcp-route-scopes-${crypto.randomUUID()}`, sharedId = `${accountId}-shared`, foreignId = `${accountId}-foreign`;
let fixture: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
let other: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
beforeAll(async () => {
  const db = await dbModulePromise;
  for (const id of [accountId, sharedId, foreignId]) await db.upsertAccount(identityTestAccount(id));
  fixture = await createAuthenticatedTestSession(accountId);
  await fixture.addMembership(fixture.user.id, sharedId, "editor");
  other = await createAuthenticatedTestSession(sharedId);
});
const params = (id: string, tokenId?: string) => ({ params: Promise.resolve({ accountId: id, tokenId }) });
function request(id: string, method = "GET", body?: unknown, actor = fixture) {
  const headers = actor.jar.headers();
  headers.set("origin", "http://localhost:3000");
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://localhost:3000/api/accounts/${id}/mcp-tokens`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function create(extra: Record<string, unknown> = {}) {
  const response = await POST(request(accountId, "POST", { label: "Synthetic multi token", accountIds: [accountId, sharedId], ...extra }), params(accountId));
  expect(response.status).toBe(201);
  return response.json() as Promise<{ tokenRecord: { id: string; accountId: string; accountIds: string[]; scopes: string[] } }>;
}

test("creates every mode, lists a token in both mailboxes, editor sees own and manager sees all; deletes from secondary", async () => {
  const tokens: string[] = [];
  for (const [mode, scopes] of [["read", ["read"]], ["drafts", ["read", "drafts"]], ["full", ["read", "drafts", "manage", "send"]]] as const) {
    const { tokenRecord } = await create({ mode });
    tokens.push(tokenRecord.id);
    expect(tokenRecord.accountId).toBe(accountId);
    expect(tokenRecord.accountIds.sort()).toEqual([accountId, sharedId].sort());
    expect(tokenRecord.scopes).toEqual([...scopes]);
    for (const id of [accountId, sharedId]) {
      const listed = await (await GET(request(id), params(id))).json();
      expect(listed.tokens.map((item: { id: string }) => item.id)).toContain(tokenRecord.id);
      expect(listed.mailboxes.map((item: { id: string }) => item.id).sort()).toEqual([accountId, sharedId].sort());
      expect(JSON.stringify(listed)).not.toContain("tokenHash");
    }
  }
  const otherToken = await POST(request(sharedId, "POST", { label: "Synthetic other token" }, other), params(sharedId));
  expect(otherToken.status).toBe(201);
  const otherId = (await otherToken.json()).tokenRecord.id;
  const listed = await (await GET(request(sharedId), params(sharedId))).json();
  expect(listed.tokens.map((item: { id: string }) => item.id)).not.toContain(otherId);
  expect((await DELETE(request(sharedId, "DELETE"), params(sharedId, otherId))).status).toBe(404);
  const managerList = await (await GET(request(sharedId, "GET", undefined, other), params(sharedId))).json();
  expect(managerList.tokens.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([...tokens, otherId]));
  for (const tokenId of tokens) {
    expect((await DELETE(request(sharedId, "DELETE"), params(sharedId, tokenId))).status).toBe(200);
    const master = fixture.master;
    expect(master.prepare("SELECT * FROM mcp_token_accounts WHERE tokenId=?").all(tokenId)).toEqual([]);
    expect((await (await GET(request(accountId), params(accountId))).json()).tokens.map((item: { id: string }) => item.id)).not.toContain(tokenId);
  }
});

test("defaults to drafts and rejects invalid sets/modes or membership without creating tokens", async () => {
  expect((await create({ mode: undefined })).tokenRecord.scopes).toEqual(["read", "drafts"]);
  for (const extra of [{ mode: "send" }, { mode: null }, { accountIds: [] }, { accountIds: [sharedId] }, { accountIds: [accountId, 3] }, { accountIds: "all" }]) {
    expect((await POST(request(accountId, "POST", { label: "Synthetic invalid", ...extra }), params(accountId))).status).toBe(400);
  }
  expect((await POST(request(accountId, "POST", { label: "Synthetic forbidden", accountIds: [accountId, foreignId] }), params(accountId))).status).toBe(403);
  expect(fixture.master.prepare("SELECT id FROM mcp_tokens WHERE label IN ('Synthetic invalid','Synthetic forbidden') AND createdByUserId=?").all(fixture.user.id)).toEqual([]);
});

test("mailbox cascade preserves a multi token, replaces deleted primary, removes empty and legacy tokens", async () => {
  const multi = (await create()).tokenRecord;
  const legacy = (await create()).tokenRecord;
  fixture.master.prepare("DELETE FROM mcp_token_accounts WHERE tokenId=?").run(legacy.id);
  expect(await deleteAccountControlPlane(accountId)).toBe(true);
  const kept = await (await GET(request(sharedId), params(sharedId))).json();
  expect(kept.tokens.find((token: { id: string }) => token.id === multi.id)).toMatchObject({ accountId: sharedId, accountIds: [sharedId] });
  expect(fixture.master.prepare("SELECT id FROM mcp_tokens WHERE id=?").get(legacy.id)).toBeNull();
  expect(await deleteAccountControlPlane(sharedId)).toBe(true);
  expect(fixture.master.prepare("SELECT id FROM mcp_tokens WHERE id=?").get(multi.id)).toBeNull();
  expect(fixture.master.prepare("SELECT tokenId FROM mcp_token_accounts WHERE tokenId=?").all(multi.id)).toEqual([]);
});
