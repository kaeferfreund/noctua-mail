import { afterAll, beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { saveOutreachSettings } from "@/lib/addons/outreach/settings";
import { GET as listTokens, POST as createToken } from "../api-tokens/route";
import { DELETE as revokeToken } from "../api-tokens/[tokenId]/route";
import { POST as setSuppression } from "./[contactId]/suppression/route";
import { GET, POST } from "./route";

type Principal = Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
const accountId = crypto.randomUUID();
const previous = process.env.NOCTUA_ADDON_OUTREACH;
let manager: Principal;
let editor: Principal;
let viewer: Principal;

beforeAll(async () => {
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  await (await dbModulePromise).upsertAccount(identityTestAccount(accountId));
  manager = await createAuthenticatedTestSession(accountId);
  editor = await createAuthenticatedTestSession();
  viewer = await createAuthenticatedTestSession();
  await manager.addMembership(editor.user.id, accountId, "editor");
  await manager.addMembership(viewer.user.id, accountId, "viewer");
  await saveOutreachSettings(accountId, { enabled: true }, manager.user.id);
});
afterAll(() => {
  if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH; else process.env.NOCTUA_ADDON_OUTREACH = previous;
});

const params = (extra: Record<string, string> = {}) => ({ params: Promise.resolve({ accountId, ...extra }) });

function request(actor: Principal, method: string, path = "contacts", body?: object, origin = "http://localhost:3000") {
  const headers = actor.jar.headers();
  headers.set("origin", origin);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://localhost:3000/api/addons/outreach/accounts/${accountId}/${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
}

test("viewers can read but cannot upsert contacts; editors can write from the same origin", async () => {
  const input = { email: "synthetic@example.test" };
  expect((await GET(request(viewer, "GET"), params())).status).toBe(200);
  expect((await POST(request(viewer, "POST", "contacts", input), params())).status).toBe(403);
  expect((await POST(request(editor, "POST", "contacts", input, "https://other.example.test"), params())).status).toBe(403);
  const created = await POST(request(editor, "POST", "contacts", input), params());
  expect(created.status).toBe(200);
  expect(await created.json()).toMatchObject({ ok: true, created: true, contact: { email: input.email } });
});

test("only managers can list, issue and revoke API tokens or lift manual suppression", async () => {
  expect((await listTokens(request(editor, "GET", "api-tokens"), params())).status).toBe(403);
  expect((await createToken(request(editor, "POST", "api-tokens", { name: "Synthetic", listIds: ["list-1"] }), params())).status).toBe(403);
  expect((await revokeToken(request(editor, "DELETE", "api-tokens/token-1"), params({ tokenId: "token-1" }))).status).toBe(403);
  expect((await setSuppression(request(editor, "POST", "contacts/contact-1/suppression", { suppressed: false }),
    params({ contactId: "contact-1" }))).status).toBe(403);
  expect((await listTokens(request(manager, "GET", "api-tokens"), params())).status).toBe(200);
});

test("flag off returns 404 before authentication", async () => {
  delete process.env.NOCTUA_ADDON_OUTREACH;
  try {
    const response = await GET(new Request("http://localhost:3000/api/addons/outreach/contacts"), params());
    expect(response.status).toBe(404);
  } finally {
    process.env.NOCTUA_ADDON_OUTREACH = "1";
  }
});
