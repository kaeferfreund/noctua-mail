import { beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession, issueTestReauthGrant } from "@/lib/testAuthHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { GET, POST } from "./route";
import { PATCH } from "./[tokenId]/route";

type Principal = Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
let fixture: Principal, colleague: Principal;
const accountId = `mcp-route-edit-${crypto.randomUUID()}`, sharedId = `${accountId}-shared`, foreignId = `${accountId}-foreign`;
beforeAll(async () => {
  const db = await dbModulePromise;
  for (const id of [accountId, sharedId, foreignId]) await db.upsertAccount(identityTestAccount(id));
  fixture = await createAuthenticatedTestSession(accountId);
  await fixture.addMembership(fixture.user.id, sharedId, "editor");
  colleague = await createAuthenticatedTestSession(accountId);
});
const params = (id: string, tokenId?: string) => ({ params: Promise.resolve({ accountId: id, tokenId }) });
async function request(id: string, method: string, body?: unknown, { actor = fixture, grant = true }: { actor?: Principal; grant?: boolean } = {}) {
  const headers = actor.jar.headers();
  headers.set("origin", "http://localhost:3000");
  if (body !== undefined) headers.set("content-type", "application/json");
  if (grant) headers.set("x-noctua-reauth", await issueTestReauthGrant(actor, "mcp.create"));
  return new Request(`http://localhost:3000/api/accounts/${id}/mcp-tokens`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function create() {
  const response = await POST(await request(accountId, "POST", { label: "Synthetic editable token" }), params(accountId));
  expect(response.status).toBe(201);
  return (await response.json() as { token: string; tokenRecord: { id: string } });
}
const rows = (tokenId: string) => (fixture.master.prepare("SELECT accountId FROM mcp_token_accounts WHERE tokenId=? ORDER BY accountId").all(tokenId) as { accountId: string }[]).map(row => row.accountId);

test("PATCH replaces the mailbox set with a fresh grant and never returns the token", async () => {
  const { token, tokenRecord } = await create();
  const listed = await (await GET(await request(accountId, "GET", undefined, { grant: false }), params(accountId))).json();
  expect(listed.userId).toBe(fixture.user.id);
  const response = await PATCH(await request(accountId, "PATCH", { accountIds: [accountId, sharedId] }), params(accountId, tokenRecord.id));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({ ok: true, tokenRecord: { id: tokenRecord.id, accountIds: [accountId, sharedId].sort() } });
  expect(JSON.stringify(body)).not.toContain(token);
  expect(JSON.stringify(body)).not.toContain("tokenHash");
  const shared = await (await GET(await request(sharedId, "GET", undefined, { grant: false }), params(sharedId))).json();
  expect(shared.tokens.map((item: { id: string }) => item.id)).toContain(tokenRecord.id);
});

test("PATCH without or with a reused grant is refused with reauth codes and changes nothing", async () => {
  const { tokenRecord } = await create();
  const missing = await PATCH(await request(accountId, "PATCH", { accountIds: [accountId, sharedId] }, { grant: false }), params(accountId, tokenRecord.id));
  expect(missing.status).toBe(403);
  expect(await missing.json()).toMatchObject({ ok: false, code: "reauth_required" });
  const first = await request(accountId, "PATCH", { accountIds: [accountId] });
  expect((await PATCH(first, params(accountId, tokenRecord.id))).status).toBe(200);
  const reused = await request(accountId, "PATCH", { accountIds: [accountId, sharedId] }, { grant: false });
  reused.headers.set("x-noctua-reauth", first.headers.get("x-noctua-reauth")!);
  const reusedResponse = await PATCH(reused, params(accountId, tokenRecord.id));
  expect(reusedResponse.status).toBe(403);
  expect(await reusedResponse.json()).toMatchObject({ ok: false, code: "invalid_proof" });
  expect(rows(tokenRecord.id)).toEqual([accountId]);
});

test("PATCH validates the body like POST, rejects foreign mailboxes and other creators", async () => {
  const { tokenRecord } = await create();
  for (const body of [{}, { accountIds: [] }, { accountIds: [sharedId] }, { accountIds: [accountId, 3] }, { accountIds: [accountId, ` ${sharedId}`] }, { accountIds: "all" }]) {
    expect((await PATCH(await request(accountId, "PATCH", body, { grant: false }), params(accountId, tokenRecord.id))).status).toBe(400);
  }
  expect((await PATCH(await request(accountId, "PATCH", { accountIds: [accountId, foreignId] }), params(accountId, tokenRecord.id))).status).toBe(403);
  expect((await PATCH(await request(accountId, "PATCH", { accountIds: [accountId] }, { actor: colleague }), params(accountId, tokenRecord.id))).status).toBe(404);
  expect((await PATCH(await request(accountId, "PATCH", { accountIds: [accountId] }), params(accountId, crypto.randomUUID()))).status).toBe(404);
  expect(rows(tokenRecord.id)).toEqual([accountId]);
});

test("PATCH requires an authenticated editor", async () => {
  const response = await PATCH(new Request(`http://localhost:3000/api/accounts/${accountId}/mcp-tokens/x`, { method: "PATCH" }), params(accountId, "x"));
  expect(response.status).toBe(401);
});
