import { describe, test, expect } from "bun:test";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { GET, POST } from "./route";
import { PATCH, DELETE } from "./[identityId]/route";
import { PUT as putPrefs, GET as getPrefs } from "../prefs/route";
const parameters = (accountId: string, identityId?: string) => ({ params: Promise.resolve({ accountId, identityId }) });
async function fixture() {
  const db = await dbModulePromise;
  const accountId = `identities-route-${crypto.randomUUID()}`;
  await db.upsertAccount(identityTestAccount(accountId));
  const auth = await createAuthenticatedTestSession(accountId);
  const request = (method: string, body?: unknown, origin = "http://localhost:3000") => new Request(`http://localhost:3000/api/accounts/${accountId}/identities`, {
    method, headers: auth.jar.headers({ origin, "content-type": "application/json" }), body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { ...auth, db, accountId, request };
}
describe("identities REST", () => {
  test("auth, role and origin checks precede validation; admin alone cannot access mail", async () => {
    const f = await fixture(); const p = parameters(f.accountId);
    expect((await GET(new Request("http://localhost:3000"), p)).status).toBe(401);
    expect((await POST(f.request("POST", { email: "alias@example.test", displayName: "Alias" }, "https://other.example.test"), p)).status).toBe(403);
    await f.db.setUserAccountRole(f.user.id, f.accountId, "viewer", f.user.id);
    expect((await GET(f.request("GET"), p)).status).toBe(200);
    expect((await POST(f.request("POST", { invalid: true }), p)).status).toBe(403);
    const admin = await createAuthenticatedTestSession(undefined, "admin");
    expect((await GET(new Request("http://localhost:3000", { headers: admin.jar.headers() }), p)).status).toBe(403);
    expect((await f.db.listSenderIdentities(f.accountId))).toHaveLength(1);
  });
  test("manager creates, promotes, disables, edits and reads own effective defaults; audit once per mutation", async () => {
    const f = await fixture(); const p = parameters(f.accountId);
    const response = await POST(f.request("POST", { email: "Alias@example.test", displayName: "Alias" }), p);
    expect(response.status).toBe(201);
    const { identity, recomputeJob } = await response.json();
    expect(recomputeJob.accountId).toBe(f.accountId);
    expect(["running", "done", "failed"]).toContain(recomputeJob.status);
    const item = parameters(f.accountId, identity.id);
    expect((await POST(f.request("POST", { email: "alias@example.test", displayName: "Duplicate" }), p)).status).toBe(409);
    expect((await PATCH(f.request("PATCH", { isDefault: true }), item)).status).toBe(200);
    expect((await DELETE(f.request("DELETE"), item)).status).toBe(409);
    expect((await PATCH(f.request("PATCH", { email: "changed@example.test" }), item)).status).toBe(400);
    expect((await PATCH(f.request("PATCH", { displayName: "No" }), parameters(f.accountId, "foreign-id"))).status).toBe(404);
    const initial = (await f.db.listSenderIdentities(f.accountId)).find(i => i.id !== identity.id)!;
    expect((await PATCH(f.request("PATCH", { isDefault: true }), parameters(f.accountId, initial.id))).status).toBe(200);
    expect((await DELETE(f.request("DELETE"), item)).status).toBe(200);
    const body = await (await GET(f.request("GET"), p)).json();
    expect(body.identities).toHaveLength(2); expect(body.ownAddresses).toContain("alias@example.test");
    expect(body.effectiveDefaultIdentityId).toBe(initial.id);
    expect((await f.db.listAdminAudit()).filter(entry => entry.targetAccountId === f.accountId && entry.action.startsWith("identity."))).toHaveLength(4);
  });
  test("viewer personal prefs are sparse, owner-only and validate mailbox/enabled identities; stale choices warn", async () => {
    const f = await fixture(); const p = parameters(f.accountId);
    const [identity] = await f.db.listSenderIdentities(f.accountId);
    await f.db.setUserAccountRole(f.user.id, f.accountId, "viewer", f.user.id);
    for (const defaultIdentityId of ["", "foreign-id"]) {
      expect((await putPrefs(f.request("PUT", { defaultIdentityId }), p)).status).toBe(400);
    }
    expect((await putPrefs(f.request("PUT", { defaultIdentityId: identity.id, signatureOverride: "{{user.name}} / {{identity.email}}" }), p)).status).toBe(200);
    expect((await putPrefs(f.request("PUT", { signatureOverride: "{{unsupported.name}}" }), p)).status).toBe(400);
    expect((await getPrefs(f.request("GET"), p)).status).toBe(200);
    expect((await f.db.getUserAccountPrefs("other-user", f.accountId))).toEqual({});
    expect((await putPrefs(f.request("PUT", { defaultIdentityId: null }), p)).status).toBe(200);
    expect((await f.db.getUserAccountPrefs(f.user.id, f.accountId))).toEqual({ signatureOverride: "{{user.name}} / {{identity.email}}" });
  });
});
