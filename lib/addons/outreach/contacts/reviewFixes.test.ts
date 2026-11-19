import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import "@/lib/testDbHarness";
import { importKlaviyoContacts } from "@/scripts/outreach-import-klaviyo-contacts";
import { getOutreachDb } from "../db";
import { registerOutreachContactTools } from "../mcp/contacts";
import { changeContactSubscription, eraseContact, getMembership, unsubscribeGlobally } from "./consent";
import { createContactList, findContact, findContactByEmail, patchContact, upsertContact } from "./records";
import { createUnsubscribeUrls } from "./unsubscribe";

const previousOrigin = process.env.NOCTUA_OUTREACH_PUBLIC_URL;
beforeAll(() => { process.env.NOCTUA_OUTREACH_PUBLIC_URL = "https://links.example.test"; });
afterAll(() => {
  if (previousOrigin === undefined) delete process.env.NOCTUA_OUTREACH_PUBLIC_URL;
  else process.env.NOCTUA_OUTREACH_PUBLIC_URL = previousOrigin;
});

async function unsubscribe(accountId: string, contactId: string, at: number) {
  const db = await getOutreachDb();
  return db.transaction(() => unsubscribeGlobally(db, findContact(db, accountId, contactId)!, at)).immediate();
}

test("D: an erased contact's restored unsubscribe keeps its address", async () => {
  const accountId = crypto.randomUUID();
  const list = await createContactList(accountId, { name: "Updates" });
  const { contact } = await upsertContact(accountId, { email: "leaver@example.test" });
  await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: list.id }, 100);
  await unsubscribe(accountId, contact.id, 200);
  await eraseContact(accountId, contact.id, 300);
  const returned = (await upsertContact(accountId, { email: "leaver@example.test" })).contact;
  expect(findContact(await getOutreachDb(), accountId, returned.id)).toMatchObject({ emailConsent: "never", unsubscribedAt: 300 });
  await expect(patchContact(accountId, returned.id, { email: "other@example.test" })).rejects.toMatchObject({ status: 409, code: "email_change_conflict" });
  // A contact without any consent history can still correct its address.
  const fresh = (await upsertContact(accountId, { email: "typo@example.test" })).contact;
  expect((await patchContact(accountId, fresh.id, { email: "fixed@example.test" })).email).toBe("fixed@example.test");
});

test("E: a later unsubscribe of an unsubscribed contact is stored; a replay changes nothing", async () => {
  const accountId = crypto.randomUUID();
  const list = await createContactList(accountId, { name: "Updates" });
  const { contact } = await upsertContact(accountId, { email: "twice@example.test" });
  await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: list.id }, 500);
  expect(await unsubscribe(accountId, contact.id, 1000)).toBe(true);
  expect(await unsubscribe(accountId, contact.id, 3000)).toBe(false);
  const db = await getOutreachDb();
  const raised = findContact(db, accountId, contact.id)!;
  expect(raised).toMatchObject({ emailConsent: "unsubscribed", consentAt: 3000, unsubscribedAt: 3000 });
  await unsubscribe(accountId, contact.id, 3000);
  await unsubscribe(accountId, contact.id, 2000);
  expect(findContact(db, accountId, contact.id)).toEqual(raised);
});

test("I: subscribing someone who unsubscribed needs confirmResubscribe and changes nothing without it", async () => {
  const accountId = crypto.randomUUID();
  const listA = await createContactList(accountId, { name: "List A" });
  const listB = await createContactList(accountId, { name: "List B" });
  const db = await getOutreachDb();
  const { contact } = await upsertContact(accountId, { email: "returning@example.test" });
  await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: listA.id }, 100);
  // A retry of an active subscription needs no confirmation.
  await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: listA.id }, 150);

  await unsubscribe(accountId, contact.id, 200);
  const before = findContact(db, accountId, contact.id);
  for (const listId of [listA.id, listB.id]) {
    await expect(changeContactSubscription(accountId, contact.id, { action: "subscribe", listId }, 300))
      .rejects.toMatchObject({ status: 409, code: "resubscribe_confirmation_required", details: { unsubscribedAt: 200 } });
  }
  expect(findContact(db, accountId, contact.id)).toEqual(before);
  expect(getMembership(db, accountId, contact.id, listB.id)).toBeNull();
  await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: listA.id, confirmResubscribe: true }, 300);
  expect(findContact(db, accountId, contact.id)).toMatchObject({ emailConsent: "subscribed", consentAt: 300 });

  // An unsubscribe of only this list counts as well; another list does not.
  const { contact: listLeaver } = await upsertContact(accountId, { email: "list-leaver@example.test" });
  await changeContactSubscription(accountId, listLeaver.id, { action: "subscribe", listId: listA.id }, 100);
  await changeContactSubscription(accountId, listLeaver.id, { action: "unsubscribe", listId: listB.id }, 400);
  await expect(changeContactSubscription(accountId, listLeaver.id, { action: "subscribe", listId: listB.id }, 500))
    .rejects.toMatchObject({ code: "resubscribe_confirmation_required", details: { unsubscribedAt: 400 } });
  const { contact: never } = await upsertContact(accountId, { email: "new@example.test" });
  await changeContactSubscription(accountId, never.id, { action: "subscribe", listId: listB.id }, 500);
  expect(getMembership(db, accountId, never.id, listB.id)?.status).toBe("subscribed");
});

test("I: the MCP tool subscribe_contact documents and passes confirmResubscribe", async () => {
  const accountId = crypto.randomUUID();
  const list = await createContactList(accountId, { name: "MCP list" });
  const { contact } = await upsertContact(accountId, { email: "mcp-leaver@example.test" });
  await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: list.id }, 100);
  await unsubscribe(accountId, contact.id, 200);
  const server = new McpServer({ name: "Synthetic outreach", version: "1" });
  const resolveAccount = async () => ({ accountId, role: "editor" as const, userId: "user-1", tokenId: "token-1", tokenLabel: "Synthetic", tokenSuffix: "a1b2" });
  registerOutreachContactTools({
    server, resolveAccount, outreachAccount: resolveAccount,
    resolveMessage: async () => { throw new Error("Unused in contact tools"); },
    result: (summary, structuredContent) => ({ content: [{ type: "text", text: summary }], structuredContent }),
    appUrl: () => "https://mail.example.test"
  });
  const client = new Client({ name: "Synthetic client", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    const subscribeTool = tools.find(tool => tool.name === "subscribe_contact")!;
    expect(subscribeTool.description).toContain("confirmResubscribe");
    expect(subscribeTool.inputSchema.properties).toHaveProperty("confirmResubscribe");
    expect(tools.find(tool => tool.name === "unsubscribe_contact")!.inputSchema.properties).not.toHaveProperty("confirmResubscribe");
    const refused = await client.callTool({ name: "subscribe_contact", arguments: { contactId: contact.id, listId: list.id } });
    expect(refused.isError).toBe(true);
    expect(JSON.stringify(refused.content)).toContain("confirmResubscribe");
    expect(findContact(await getOutreachDb(), accountId, contact.id)?.emailConsent).toBe("unsubscribed");
    const confirmed = await client.callTool({ name: "subscribe_contact", arguments: { contactId: contact.id, listId: list.id, confirmResubscribe: true } });
    expect(confirmed.structuredContent).toMatchObject({ ok: true, contact: { emailConsent: "subscribed" } });
  } finally {
    await client.close();
    await server.close();
  }
});

test("F: an imported list join older than an unsubscribe on record does not subscribe", async () => {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "outreach-import-fix-"));
  const accountId = crypto.randomUUID();
  const lists = join(dir, "lists.json");
  const profiles = join(dir, "profiles.json");
  const members = join(dir, "members");
  mkdirSync(members);
  const write = (file: string, data: unknown[]) => Bun.write(file, JSON.stringify({ data }));
  const iso = (at: number) => new Date(at).toISOString();
  const consentAt = Date.parse("2025-01-01T00:00:00Z");
  const oldJoin = Date.parse("2025-02-01T00:00:00Z");
  const unsubscribedAt = Date.parse("2025-03-01T00:00:00Z");
  const resubscribedAt = Date.parse("2025-04-01T00:00:00Z");
  const newJoin = Date.parse("2025-05-01T00:00:00Z");
  const now = Date.parse("2025-06-01T00:00:00Z");
  try {
    await Promise.all([
      write(lists, [{ id: "list-old", attributes: { name: "Old join" } }, { id: "list-new", attributes: { name: "New join" } },
        { id: "list-undated", attributes: { name: "Undated join" } }]),
      write(profiles, [{ id: "profile-r", attributes: { email: "returning@example.test",
        subscriptions: { email: { marketing: { consent: "SUBSCRIBED", consent_timestamp: iso(consentAt) } } } } }]),
      write(join(members, "list-old.json"), [{ id: "profile-r", attributes: { joined_group_at: iso(oldJoin) } }]),
      write(join(members, "list-new.json"), [{ id: "profile-r", attributes: { joined_group_at: iso(newJoin) } }]),
      write(join(members, "list-undated.json"), [{ id: "profile-r" }])
    ]);
    // The person unsubscribed globally in Noctua and later re-subscribed to one local list.
    const { contact } = await upsertContact(accountId, { email: "returning@example.test" });
    const local = await createContactList(accountId, { name: "Local" });
    await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: local.id }, consentAt);
    await unsubscribe(accountId, contact.id, unsubscribedAt);
    await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: local.id, confirmResubscribe: true }, resubscribedAt);

    const summary = await importKlaviyoContacts({ accountId, lists, profiles, members, write: true }, now);
    expect(summary.memberships).toMatchObject({ created: 1, skipped: { unsubscribed_after_join: 2 } });
    const db = await getOutreachDb();
    const listId = (externalId: string) => (db.query("SELECT id FROM lists WHERE accountId = ? AND externalId = ?")
      .get(accountId, externalId) as { id: string }).id;
    expect(getMembership(db, accountId, contact.id, listId("list-old"))).toBeNull();
    expect(getMembership(db, accountId, contact.id, listId("list-undated"))).toBeNull();
    expect(getMembership(db, accountId, contact.id, listId("list-new"))).toMatchObject({ status: "subscribed", subscribedAt: newJoin });
    expect(findContactByEmail(db, accountId, "returning@example.test")).toMatchObject({ emailConsent: "subscribed", consentAt: resubscribedAt });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AH: a retried send gets the unsubscribe token of its earlier attempt", async () => {
  const accountId = crypto.randomUUID();
  const listA = await createContactList(accountId, { name: "List A" });
  const listB = await createContactList(accountId, { name: "List B" });
  const { contact } = await upsertContact(accountId, { email: "retry@example.test" });
  const db = await getOutreachDb();
  const sendId = crypto.randomUUID();
  db.query("INSERT INTO sends (id, accountId, contactId, kind, status, queuedAt) VALUES (?, ?, ?, 'campaign', 'sending', 20)")
    .run(sendId, accountId, contact.id);
  const first = await createUnsubscribeUrls(accountId, { sendId, contactId: contact.id, listId: listA.id });
  expect(await createUnsubscribeUrls(accountId, { sendId, contactId: contact.id, listId: listA.id })).toEqual(first);
  const other = await createUnsubscribeUrls(accountId, { sendId, contactId: contact.id, listId: listB.id });
  expect(other?.url).not.toBe(first?.url);
  expect(await createUnsubscribeUrls(accountId, { sendId, contactId: crypto.randomUUID(), listId: listA.id })).toBeNull();
  expect(db.query("SELECT count(*) AS n FROM tracking_links WHERE accountId = ? AND sendId = ?").get(accountId, sendId)).toEqual({ n: 2 });
});
