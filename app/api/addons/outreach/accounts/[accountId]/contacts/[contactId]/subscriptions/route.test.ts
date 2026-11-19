import { afterAll, beforeAll, expect, test } from "bun:test";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { getOutreachDb } from "@/lib/addons/outreach/db";
import { unsubscribeGlobally } from "@/lib/addons/outreach/contacts/consent";
import { createContactList, findContact, upsertContact } from "@/lib/addons/outreach/contacts/records";
import { saveOutreachSettings } from "@/lib/addons/outreach/settings";
import type { ResubscribeConfirmationRequired } from "@/lib/addons/outreach/types";
import { POST } from "./route";

const accountId = crypto.randomUUID();
const previous = process.env.NOCTUA_ADDON_OUTREACH;
let editor: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;

beforeAll(async () => {
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  await (await dbModulePromise).upsertAccount(identityTestAccount(accountId));
  const manager = await createAuthenticatedTestSession(accountId);
  editor = await createAuthenticatedTestSession();
  await manager.addMembership(editor.user.id, accountId, "editor");
  await saveOutreachSettings(accountId, { enabled: true }, manager.user.id);
});
afterAll(() => {
  if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH; else process.env.NOCTUA_ADDON_OUTREACH = previous;
});

function subscribe(contactId: string, body: object) {
  const headers = editor.jar.headers();
  headers.set("origin", "http://localhost:3000");
  headers.set("content-type", "application/json");
  return POST(new Request(`http://localhost:3000/api/addons/outreach/accounts/${accountId}/contacts/${contactId}/subscriptions`, {
    method: "POST", headers, body: JSON.stringify(body)
  }), { params: Promise.resolve({ accountId, contactId }) });
}

test("I: REST answers 409 resubscribe_confirmation_required with unsubscribedAt until confirmResubscribe is sent", async () => {
  const list = await createContactList(accountId, { name: "Updates" });
  const { contact } = await upsertContact(accountId, { email: "rest-leaver@example.test" });
  expect((await subscribe(contact.id, { listId: list.id, action: "subscribe" })).status).toBe(200);
  const db = await getOutreachDb();
  db.transaction(() => unsubscribeGlobally(db, findContact(db, accountId, contact.id)!, 1_000)).immediate();
  const before = findContact(db, accountId, contact.id);

  const refused = await subscribe(contact.id, { listId: list.id, action: "subscribe", consentSource: "manual" });
  expect(refused.status).toBe(409);
  const body = await refused.json() as ResubscribeConfirmationRequired;
  expect(body).toMatchObject({ ok: false, code: "resubscribe_confirmation_required", unsubscribedAt: 1_000 });
  expect(typeof body.message).toBe("string");
  expect(findContact(db, accountId, contact.id)).toEqual(before);

  expect((await subscribe(contact.id, { listId: list.id, action: "subscribe", confirmResubscribe: "yes" })).status).toBe(400);
  const confirmed = await subscribe(contact.id, { listId: list.id, action: "subscribe", consentSource: "manual", confirmResubscribe: true });
  expect(confirmed.status).toBe(200);
  expect(await confirmed.json()).toMatchObject({ ok: true, contact: { emailConsent: "subscribed", lists: [{ status: "subscribed" }] } });
});
