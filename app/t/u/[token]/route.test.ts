import { afterAll, beforeAll, expect, test } from "bun:test";
import "@/lib/testDbHarness";
import { getOutreachDb } from "@/lib/addons/outreach/db";
import { newOutreachToken } from "@/lib/addons/outreach/ids";
import { saveOutreachSettings } from "@/lib/addons/outreach/settings";
import { changeContactSubscription } from "@/lib/addons/outreach/contacts/consent";
import { createUnsubscribeUrls, unsubscribeByToken } from "@/lib/addons/outreach/contacts/unsubscribe";
import { createContactList, getContactDetail, upsertContact } from "@/lib/addons/outreach/contacts/records";
import type { NewTrackingEvent } from "@/lib/addons/outreach/tracking";
import { GET, POST } from "./route";

const previous = process.env.NOCTUA_ADDON_OUTREACH;
const previousOrigin = process.env.NOCTUA_OUTREACH_PUBLIC_URL;
beforeAll(() => {
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  process.env.NOCTUA_OUTREACH_PUBLIC_URL = "https://links.example.test";
});
afterAll(() => {
  if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH; else process.env.NOCTUA_ADDON_OUTREACH = previous;
  if (previousOrigin === undefined) delete process.env.NOCTUA_OUTREACH_PUBLIC_URL; else process.env.NOCTUA_OUTREACH_PUBLIC_URL = previousOrigin;
});

async function subscribedContact() {
  const accountId = crypto.randomUUID();
  await saveOutreachSettings(accountId, { enabled: true, organizationName: "Synthetic <Example> & Co." }, "user-1");
  const { contact } = await upsertContact(accountId, { email: "fixture@example.test" });
  const first = await createContactList(accountId, { name: "First" });
  const second = await createContactList(accountId, { name: "Second" });
  for (const { id } of [first, second]) await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: id }, 10);
  const db = await getOutreachDb();
  const sendId = crypto.randomUUID();
  db.query("INSERT INTO sends (id, accountId, contactId, kind, status, queuedAt) VALUES (?, ?, ?, 'campaign', 'sent', 20)")
    .run(sendId, accountId, contact.id);
  const urls = await createUnsubscribeUrls(accountId, { sendId, contactId: contact.id, listId: first.id });
  expect(urls?.oneClickUrl).toBe(urls?.url);
  const url = urls!.url;
  const token = new URL(url).pathname.split("/").at(-1)!;
  return { accountId, contactId: contact.id, sendId, token, url, params: { params: Promise.resolve({ token }) } };
}

test("GET renders an escaped confirmation with no side effects, and the form opts out globally", async () => {
  const fixture = await subscribedContact();
  const page = await GET(new Request(fixture.url, { headers: { "Accept-Language": "en;q=0.5,de-DE;q=0.9" } }), fixture.params);
  expect(page.status).toBe(200);
  expect(page.headers.get("content-language")).toBe("de");
  expect(page.headers.get("set-cookie")).toBeNull();
  expect(page.headers.get("content-security-policy")).toContain("default-src 'none'");
  const html = await page.text();
  expect(html).toContain("Synthetic &lt;Example&gt; &amp; Co.");
  expect(html).toContain("<form method=\"post\">");
  expect(html).not.toContain("<script");
  expect(html).not.toContain("fixture@example.test");
  expect((await getContactDetail(fixture.accountId, fixture.contactId)).lists.map(list => list.status)).toEqual(["subscribed", "subscribed"]);
  const invalid = await POST(new Request(fixture.url, { method: "POST", body: new URLSearchParams({ wrong: "One-Click" }) }), fixture.params);
  expect(invalid.status).toBe(400);
  expect((await getContactDetail(fixture.accountId, fixture.contactId)).emailConsent).toBe("subscribed");
  const response = await POST(new Request(fixture.url, {
    method: "POST", body: new URLSearchParams({ "List-Unsubscribe": "One-Click" })
  }), fixture.params);
  expect(await response.text()).toContain("If this link is valid");
  const contact = await getContactDetail(fixture.accountId, fixture.contactId);
  expect(contact).toMatchObject({ emailConsent: "unsubscribed", consentSource: "unsubscribe_link" });
  expect(contact.lists.map(list => list.status)).toEqual(["unsubscribed", "unsubscribed"]);
});

test("RFC 8058 accepts multipart without an origin or cookies; retries and unknown tokens are neutral", async () => {
  const fixture = await subscribedContact();
  const submit = (token: string) => {
    const body = new FormData();
    body.set("List-Unsubscribe", "One-Click");
    return POST(new Request(`https://links.example.test/t/u/${token}`, { method: "POST", body }),
      { params: Promise.resolve({ token }) });
  };
  const known = await submit(fixture.token);
  expect(known.status).toBe(200);
  const first = await getContactDetail(fixture.accountId, fixture.contactId);
  expect(first.emailConsent).toBe("unsubscribed");
  expect((await submit(fixture.token)).status).toBe(200);
  expect((await getContactDetail(fixture.accountId, fixture.contactId)).consentAt).toBe(first.consentAt);
  const unknown = await submit(newOutreachToken());
  expect(unknown.status).toBe(200);
  expect(await unknown.text()).toBe(await known.text());
});

test("a global unsubscribe records one tracking event even across repeated submissions", async () => {
  const fixture = await subscribedContact();
  const events: NewTrackingEvent[] = [];
  const record = async (event: NewTrackingEvent) => { events.push(event); };
  await unsubscribeByToken(fixture.token, { userAgent: "Synthetic Mail" }, 100, record);
  await unsubscribeByToken(fixture.token, { userAgent: "Synthetic Mail" }, 200, record);
  expect(events).toEqual([{
    accountId: fixture.accountId, contactId: fixture.contactId, sendId: fixture.sendId, at: 100, type: "unsubscribe", userAgent: "Synthetic Mail"
  }]);
});

test("a test send's link does not change consent for the contact used to render it", async () => {
  const fixture = await subscribedContact();
  const db = await getOutreachDb();
  const sendId = crypto.randomUUID();
  db.query("INSERT INTO sends (id, accountId, kind, status, queuedAt) VALUES (?, ?, 'test', 'sent', 20)")
    .run(sendId, fixture.accountId);
  const urls = await createUnsubscribeUrls(fixture.accountId, { sendId, contactId: fixture.contactId });
  const token = new URL(urls!.url).pathname.split("/").at(-1)!;
  await unsubscribeByToken(token, {});
  expect(await getContactDetail(fixture.accountId, fixture.contactId)).toMatchObject({ emailConsent: "subscribed" });
});

test("unsubscribe routes are inaccessible when the server flag is off", async () => {
  delete process.env.NOCTUA_ADDON_OUTREACH;
  try {
    const token = newOutreachToken();
    const url = `https://links.example.test/t/u/${token}`;
    const params = { params: Promise.resolve({ token }) };
    expect((await GET(new Request(url), params)).status).toBe(404);
    expect((await POST(new Request(url, { method: "POST" }), params)).status).toBe(404);
  } finally {
    process.env.NOCTUA_ADDON_OUTREACH = "1";
  }
});

test("the confirmation page allows exactly its own style block and nothing else", async () => {
  const { createHash } = await import("node:crypto");
  const response = await GET(new Request("https://links.example.test/t/u/unknown-token"), { params: Promise.resolve({ token: "unknown-token" }) });
  const html = await response.text();
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
  expect(style.length).toBeGreaterThan(0);
  const policy = response.headers.get("content-security-policy") ?? "";
  expect(policy).toContain(`style-src 'sha256-${createHash("sha256").update(style).digest("base64")}'`);
  expect(policy).toContain("default-src 'none'");
  expect(policy).not.toContain("unsafe-inline");
  expect(html).not.toMatch(/<script|<link|<img|url\(/i);
});
