import { afterAll, beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { requireActiveUserSession } from "@/lib/auth";
import { mintMcpToken } from "@/lib/mcpAuth";
import { executeMcpHttpRequest } from "@/lib/mcpServer";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { saveOutreachSettings } from "@/lib/addons/outreach/settings";
import { OUTREACH_IMAGE_MAX_BYTES } from "@/lib/addons/outreach/types";
import { GET, POST } from "./route";

const accountId = crypto.randomUUID();
const otherId = crypto.randomUUID();
const previous = process.env.NOCTUA_ADDON_OUTREACH;
const origin = "http://localhost:3000";
const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64");
let fixture: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;

beforeAll(async () => {
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  const db = await dbModulePromise;
  for (const id of [accountId, otherId]) {
    await db.upsertAccount(identityTestAccount(id));
    await saveOutreachSettings(id, { enabled: true }, "test-user");
  }
  fixture = await createAuthenticatedTestSession(accountId);
  await fixture.addMembership(fixture.user.id, otherId, "viewer");
});
afterAll(() => {
  if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH; else process.env.NOCTUA_ADDON_OUTREACH = previous;
});

function list(id: string) {
  return GET(new Request(`${origin}/api/addons/outreach/accounts/${id}/images`, { headers: fixture.jar.headers() }),
    { params: Promise.resolve({ accountId: id }) });
}

function post(id = accountId, name = "one.gif", body: BodyInit = gif, headers: Record<string, string> = {}) {
  return POST(new Request(`${origin}/api/addons/outreach/accounts/${id}/images?filename=${name}`, {
    method: "POST", body, headers: fixture.jar.headers({ origin, "content-type": "application/octet-stream", ...headers })
  }), { params: Promise.resolve({ accountId: id }) });
}

test("editors upload and viewers list only their mailbox; unsafe requests are rejected", async () => {
  expect((await post(otherId)).status).toBe(403);
  expect((await post(accountId, "one.gif", gif, { origin: "https://foreign.example.test" })).status).toBe(403);
  expect((await post(accountId, "one.gif", gif, { "content-type": "text/plain" })).status).toBe(400);
  expect((await post(accountId, "one.gif", gif, { "content-length": String(OUTREACH_IMAGE_MAX_BYTES + 1) })).status).toBe(413);
  expect((await post(accountId, "one.png", gif)).status).toBe(415);
  expect((await post(accountId, "one.png", "<svg/>")).status).toBe(415);
  expect((await post(accountId, "one.gif", "GIF89a")).status).toBe(415);
  const upload = await post();
  expect(upload.status).toBe(200);
  const result = await upload.json();
  expect(result).toMatchObject({ ok: true, created: true, image: { accountId, contentType: "image/gif", filename: "one.gif" } });
  expect(await (await post(accountId, "two.gif")).json()).toEqual({ ...result, created: false });
  expect(await (await list(accountId)).json()).toEqual({ ok: true, images: [result.image] });
  expect(await (await list(otherId)).json()).toEqual({ ok: true, images: [] });
});

test("MCP tools use the read and drafts scopes and apply the live mailbox role", async () => {
  const session = await requireActiveUserSession(new Request(origin, { headers: fixture.jar.headers() }));
  if (session instanceof Response) throw new Error("Synthetic session missing");
  const mint = (mode: "read" | "drafts") => mintMcpToken(session, accountId, `Image fixture ${mode}`, 3600, {
    mode, accountIds: [accountId, otherId]
  });
  const read = await mint("read");
  const drafts = await mint("drafts");
  const call = async (tokenRecord: typeof read.tokenRecord, name: string, args: Record<string, unknown> = {}) => {
    const { responses } = await executeMcpHttpRequest({
      accountId, account: identityTestAccount(accountId), tokenRecord,
      body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }
    });
    return responses[0];
  };

  const upload = { filename: "one.gif", data: gif.toString("base64") };
  expect(await call(read.tokenRecord, "upload_email_image", upload)).toMatchObject({ result: { isError: true } });
  expect(await call(drafts.tokenRecord, "upload_email_image", { ...upload, accountId: otherId })).toMatchObject({ result: { isError: true } });
  expect(await call(drafts.tokenRecord, "upload_email_image", { ...upload, data: "bad %% base64" })).toMatchObject({ result: { isError: true } });
  expect(await call(drafts.tokenRecord, "upload_email_image", { ...upload, data: Buffer.from("GIF89a").toString("base64") })).toMatchObject({ result: { isError: true } });
  expect(await call(drafts.tokenRecord, "upload_email_image", upload)).toMatchObject({
    result: { structuredContent: { ok: true, image: { accountId, url: expect.stringMatching(/^\/t\/m\/[a-f0-9]{64}\.gif$/) } } }
  });
  expect(await call(read.tokenRecord, "list_email_images", { accountId: otherId })).toMatchObject({
    result: { structuredContent: { ok: true, images: [] } }
  });
});
