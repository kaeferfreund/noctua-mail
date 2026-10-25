import { beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession, issueTestReauthGrant } from "@/lib/testAuthHarness";
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
/** Creation spends a fresh `mcp.create` grant. */
async function withGrant(input: Request, actor = fixture) {
  input.headers.set("x-noctua-reauth", await issueTestReauthGrant(actor, "mcp.create"));
  return input;
}
async function create(extra: Record<string, unknown> = {}) {
  const response = await POST(await withGrant(request(accountId, "POST", { label: "Synthetic multi token", accountIds: [accountId, sharedId], ...extra })), params(accountId));
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
  const otherToken = await POST(await withGrant(request(sharedId, "POST", { label: "Synthetic other token" }, other), other), params(sharedId));
  expect(otherToken.status).toBe(201);
  const otherId = (await otherToken.json()).tokenRecord.id;
  const listed = await (await GET(request(sharedId), params(sharedId))).json();
  expect(listed.tokens.map((item: { id: string }) => item.id)).not.toContain(otherId);
  expect((await DELETE(request(sharedId, "DELETE"), params(sharedId, otherId))).status).toBe(404);
  const managerList = await (await GET(request(sharedId, "GET", undefined, other), params(sharedId))).json();
  expect(managerList.tokens.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([...tokens, otherId]));
  // The manager of the shared mailbox cannot access the creator's own mailbox: no ID (nor primary), only a count.
  for (const item of managerList.tokens.filter((token: { id: string }) => tokens.includes(token.id))) {
    expect(item).toMatchObject({ accountIds: [sharedId], hiddenMailboxCount: 1 });
    expect(item).not.toHaveProperty("accountId");
  }
  expect((await (await GET(request(accountId), params(accountId))).json()).tokens.find((token: { id: string }) => token.id === tokens[0]))
    .toMatchObject({ accountIds: [accountId, sharedId].sort(), hiddenMailboxCount: 0 });
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
  expect((await POST(await withGrant(request(accountId, "POST", { label: "Synthetic forbidden", accountIds: [accountId, foreignId] })), params(accountId))).status).toBe(403);
  expect(fixture.master.prepare("SELECT id FROM mcp_tokens WHERE label IN ('Synthetic invalid','Synthetic forbidden') AND createdByUserId=?").all(fixture.user.id)).toEqual([]);
});

test("creation requires a fresh mcp.create grant: missing, wrong-purpose and reused grants fail; deletion needs none", async () => {
  const body = { label: "Synthetic proof token" };
  const created = () => fixture.master.prepare("SELECT id FROM mcp_tokens WHERE label=? AND createdByUserId=?").all(body.label, fixture.user.id);
  const missing = await POST(request(accountId, "POST", body), params(accountId));
  expect(missing.status).toBe(403);
  expect(await missing.json()).toMatchObject({ ok: false, code: "reauth_required" });
  const wrong = request(accountId, "POST", body);
  wrong.headers.set("x-noctua-reauth", await issueTestReauthGrant(fixture, "sessions.revoke"));
  const wrongResponse = await POST(wrong, params(accountId));
  expect(wrongResponse.status).toBe(403);
  expect(await wrongResponse.json()).toMatchObject({ ok: false, code: "invalid_proof" });
  expect(created()).toEqual([]);
  const grant = await issueTestReauthGrant(fixture, "mcp.create");
  const valid = request(accountId, "POST", body); valid.headers.set("x-noctua-reauth", grant);
  const validResponse = await POST(valid, params(accountId));
  expect(validResponse.status).toBe(201);
  const tokenId = (await validResponse.json()).tokenRecord.id;
  const reused = request(accountId, "POST", body); reused.headers.set("x-noctua-reauth", grant);
  const reusedResponse = await POST(reused, params(accountId));
  expect(reusedResponse.status).toBe(403);
  expect(await reusedResponse.json()).toMatchObject({ ok: false, code: "invalid_proof" });
  expect(created()).toEqual([{ id: tokenId }]);
  expect((await DELETE(request(accountId, "DELETE"), params(accountId, tokenId))).status).toBe(200);
  expect(created()).toEqual([]);
});

test("mailbox cascade preserves a multi token, replaces deleted primary, removes empty and legacy tokens", async () => {
  const multi = (await create()).tokenRecord;
  const legacy = (await create()).tokenRecord;
  fixture.master.prepare("DELETE FROM mcp_token_accounts WHERE tokenId=?").run(legacy.id);
  expect(await deleteAccountControlPlane(accountId)).toBe(true);
  const kept = await (await GET(request(sharedId), params(sharedId))).json();
  expect(kept.tokens.find((token: { id: string }) => token.id === multi.id)).toMatchObject({ accountIds: [sharedId], hiddenMailboxCount: 0 });
  expect(fixture.master.prepare("SELECT accountId FROM mcp_tokens WHERE id=?").get(multi.id)).toEqual({ accountId: sharedId });
  expect(fixture.master.prepare("SELECT id FROM mcp_tokens WHERE id=?").get(legacy.id)).toBeNull();
  expect(await deleteAccountControlPlane(sharedId)).toBe(true);
  expect(fixture.master.prepare("SELECT id FROM mcp_tokens WHERE id=?").get(multi.id)).toBeNull();
  expect(fixture.master.prepare("SELECT tokenId FROM mcp_token_accounts WHERE tokenId=?").all(multi.id)).toEqual([]);
});
