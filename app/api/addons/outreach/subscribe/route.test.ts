import { afterAll, beforeAll, expect, test } from "bun:test";
import "@/lib/testDbHarness";
import { getOutreachDb } from "@/lib/addons/outreach/db";
import { saveOutreachSettings } from "@/lib/addons/outreach/settings";
import { CONSENT_CLOCK_SKEW_MS, createApiToken, listApiTokens, revokeApiToken } from "@/lib/addons/outreach/contacts/apiTokens";
import { suppressContact } from "@/lib/addons/outreach/contacts";
import { changeContactSubscription } from "@/lib/addons/outreach/contacts/consent";
import { createContactList, findContactByEmail, getContactDetail } from "@/lib/addons/outreach/contacts/records";
import { newOutreachToken } from "@/lib/addons/outreach/ids";
import { POST } from "./route";

const previous = process.env.NOCTUA_ADDON_OUTREACH;
beforeAll(() => { process.env.NOCTUA_ADDON_OUTREACH = "1"; });
afterAll(() => {
  if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH; else process.env.NOCTUA_ADDON_OUTREACH = previous;
});

const email = "subscriber@example.test";
function subscribe(secret: string | null, body: object, headers?: Record<string, string>) {
  return POST(new Request("https://mail.example.test/api/addons/outreach/subscribe", {
    method: "POST", body: JSON.stringify(body),
    headers: { ...(secret ? { Authorization: `Bearer ${secret}` } : {}), "Content-Type": "application/json", ...headers }
  }));
}

async function fixture() {
  const accountId = crypto.randomUUID();
  await saveOutreachSettings(accountId, { enabled: true }, "user-1");
  const allowed = await createContactList(accountId, { name: "Allowed" });
  const other = await createContactList(accountId, { name: "Other" });
  const double = await createContactList(accountId, { name: "Double", optIn: "double" });
  const { token, secret } = await createApiToken(accountId, "user-1", { name: "Registration", listIds: [allowed.id, double.id] });
  return { accountId, allowed, other, double, token, secret };
}

test("requires a live scoped bearer and an activated mailbox", async () => {
  const { accountId, allowed, other, double, token, secret } = await fixture();
  const input = { email, listId: allowed.id };
  const missing = await subscribe(null, input);
  expect(missing.status).toBe(401);
  expect(missing.headers.get("www-authenticate")).toBe("Bearer");
  expect((await subscribe(newOutreachToken(), input)).status).toBe(401);
  expect((await subscribe(secret, { ...input, listId: other.id })).status).toBe(403);
  const doubleResult = await subscribe(secret, { ...input, listId: double.id });
  expect(doubleResult.status).toBe(409);
  expect(await doubleResult.json()).toMatchObject({ code: "double_opt_in_unsupported" });
  await saveOutreachSettings(accountId, { enabled: false }, "user-1");
  expect(await (await subscribe(secret, input)).json()).toMatchObject({ ok: false, code: "outreach_disabled" });
  await revokeApiToken(accountId, token.id);
  expect((await subscribe(secret, input)).status).toBe(401);
  expect(findContactByEmail(await getOutreachDb(), accountId, email)).toBeNull();
});

test("validates input strictly and stores only the token digest", async () => {
  const { accountId, allowed, token, secret } = await fixture();
  for (const input of [
    { email: "Person <person@example.test>" },
    { email, properties: { nested: { value: "Synthetic" } } },
    { email, firstName: "a".repeat(201) },
    { email, properties: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`key${i}`, i])) },
    // Beyond the tolerance for a caller whose clock runs ahead.
    { email, consentAt: Date.now() + 10 * CONSENT_CLOCK_SKEW_MS },
    { email, emailConsent: "subscribed" }
  ]) expect((await subscribe(secret, { listId: allowed.id, ...input })).status).toBe(400);
  expect((await subscribe(secret, { email, listId: allowed.id }, { "Content-Type": "text/plain" })).status).toBe(400);
  expect(findContactByEmail(await getOutreachDb(), accountId, email)).toBeNull();
  const [listed] = await listApiTokens(accountId);
  expect(listed).toEqual(token);
  expect(JSON.stringify(listed)).not.toContain(secret);
  const db = await getOutreachDb();
  const { tokenHash } = db.query("SELECT tokenHash FROM api_tokens WHERE accountId = ? AND id = ?").get(accountId, token.id);
  expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  expect(tokenHash).not.toBe(secret);
});

test("subscribe retries preserve consent and an opt-out requires a newer explicit timestamp", async () => {
  const { accountId, allowed, secret } = await fixture();
  const body = { email, listId: allowed.id, consentAt: 100, consentSource: "synthetic_signup" };
  const first = await subscribe(secret, { ...body, email: email.toUpperCase() });
  expect(first.status).toBe(200);
  const created = await first.json();
  expect(created).toEqual({ ok: true, contactId: expect.any(String), status: "subscribed" });
  const duplicate = await subscribe(secret, { ...body, consentAt: 150 });
  // The same answer for a known address: a token does not learn whether a contact existed.
  expect(await duplicate.json()).toEqual(created);
  expect(await getContactDetail(accountId, created.contactId)).toMatchObject({
    email, consentAt: 100, consentSource: "synthetic_signup", lists: [{ subscribedAt: 100 }]
  });
  await changeContactSubscription(accountId, created.contactId, { action: "unsubscribe", listId: allowed.id }, 200);
  // The claim must be later than the unsubscribe by more than the clock tolerance.
  for (const consentAt of [undefined, 100, 200, 201, 200 + CONSENT_CLOCK_SKEW_MS]) {
    const stale = await subscribe(secret, { ...body, consentAt });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "new_consent_required" });
  }
  const fresh = 201 + CONSENT_CLOCK_SKEW_MS;
  expect((await subscribe(secret, { ...body, consentAt: fresh })).status).toBe(200);
  expect(await getContactDetail(accountId, created.contactId)).toMatchObject({ consentAt: fresh, lists: [{ status: "subscribed", subscribedAt: fresh }] });
});

test("a suppressed address cannot subscribe or update its profile through this endpoint", async () => {
  const { accountId, allowed, secret } = await fixture();
  await suppressContact(accountId, { email, reason: "hard_bounce" });
  const blocked = await subscribe(secret, { email, listId: allowed.id, firstName: "Overwrite" });
  expect(blocked.status).toBe(409);
  expect(await blocked.json()).toMatchObject({ code: "contact_suppressed" });
  const row = findContactByEmail(await getOutreachDb(), accountId, email)!;
  expect(row).toMatchObject({ firstName: "", emailConsent: "never", suppressedReason: "hard_bounce" });
  expect((await getContactDetail(accountId, row.id)).lists).toEqual([]);
});

test("subscribe rate limits are independent per bearer token", async () => {
  const limited = await fixture();
  const unaffected = await fixture();
  for (let i = 0; i < 120; i++) {
    expect((await subscribe(limited.secret, {})).status).toBe(400);
  }
  expect((await subscribe(limited.secret, { email, listId: limited.allowed.id })).status).toBe(429);
  expect((await subscribe(unaffected.secret, { email, listId: unaffected.allowed.id })).status).toBe(200);
});
