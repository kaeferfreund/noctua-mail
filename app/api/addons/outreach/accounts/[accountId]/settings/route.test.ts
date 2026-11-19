import { afterAll, beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { getOutreachSettings } from "@/lib/addons/outreach/settings";
import { PUT } from "./route";

const accountId = crypto.randomUUID();
const previous = process.env.NOCTUA_ADDON_OUTREACH;
let manager: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;

beforeAll(async () => {
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  await (await dbModulePromise).upsertAccount(identityTestAccount(accountId));
  manager = await createAuthenticatedTestSession(accountId);
});
afterAll(() => {
  if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH; else process.env.NOCTUA_ADDON_OUTREACH = previous;
});

function put(body: string) {
  const headers = manager.jar.headers();
  headers.set("origin", "http://localhost:3000");
  headers.set("content-type", "application/json");
  return PUT(new Request(`http://localhost:3000/api/addons/outreach/accounts/${accountId}/settings`, { method: "PUT", headers, body }),
    { params: Promise.resolve({ accountId }) });
}

test("AM: the settings PUT reads a bounded body and answers 413 above the limit", async () => {
  const oversized = await put(JSON.stringify({ organizationName: "Synthetic", padding: " ".repeat(128 * 1024) }));
  expect(oversized.status).toBe(413);
  expect(await oversized.json()).toMatchObject({ ok: false });
  expect((await put("{not json")).status).toBe(400);
  const saved = await put(JSON.stringify({ enabled: true, organizationName: "Synthetic Org" }));
  expect(saved.status).toBe(200);
  expect(await getOutreachSettings(accountId)).toMatchObject({ enabled: true, organizationName: "Synthetic Org" });
});
