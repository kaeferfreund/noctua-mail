import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import "@/lib/testDbHarness";
import { importKlaviyoContacts } from "@/scripts/outreach-import-klaviyo-contacts";
import { getOutreachDb } from "../db";
import { registerOutreachContactTools } from "../mcp/contacts";
import { saveOutreachSettings } from "../settings";
import { createApiToken, subscribeWithApiToken } from "./apiTokens";
import { changeContactSubscription, eraseContact, getMembership } from "./consent";
import { getSendableRecipient, listSendableRecipients } from "./index";
import { createContactList, findContactByEmail, upsertContact } from "./records";

/** Decision AA: erasing a contact always leaves a block for the address (synthetic data only). */

const iso = (at: number) => new Date(at).toISOString();
const consentAt = Date.parse("2025-01-01T00:00:00Z");
const erasedAt = Date.parse("2025-03-01T00:00:00Z");
const laterConsent = Date.parse("2025-04-01T00:00:00Z");
const now = Date.parse("2025-06-01T00:00:00Z");

/** A consenting, never unsubscribed, unsuppressed contact on one list, erased at `erasedAt`. */
async function erasedSubscriber(email: string) {
  const accountId = crypto.randomUUID();
  await saveOutreachSettings(accountId, { enabled: true }, "manager-1", consentAt);
  const list = await createContactList(accountId, { name: "Updates" }, consentAt);
  const { contact } = await upsertContact(accountId, { email }, consentAt);
  await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: list.id }, consentAt);
  await eraseContact(accountId, contact.id, erasedAt);
  return { accountId, list };
}

test("AA: erasing a consenting contact keeps the address blocked as of the erase", async () => {
  const { accountId } = await erasedSubscriber("consenting@example.test");
  const db = await getOutreachDb();
  const kept = db.query("SELECT * FROM erased_addresses WHERE accountId = ?").all(accountId) as Array<Record<string, unknown>>;
  expect(kept).toHaveLength(1);
  expect(kept[0]).toMatchObject({ suppressedReason: null, suppressedAt: null, unsubscribedAt: erasedAt, erasedAt });
  expect(JSON.stringify(kept)).not.toContain("example.test");
  // Upserting the address again takes the block over.
  await upsertContact(accountId, { email: "Consenting@example.test" }, now);
  expect(findContactByEmail(db, accountId, "consenting@example.test")).toMatchObject({ emailConsent: "never", unsubscribedAt: erasedAt });
  expect(db.query("SELECT count(*) AS n FROM erased_addresses WHERE accountId = ?").get(accountId)).toEqual({ n: 0 });
});

test("AA: a later unsubscribe on record stays the block time; a suppression is kept as before", async () => {
  const accountId = crypto.randomUUID();
  const list = await createContactList(accountId, { name: "Updates" });
  const { contact } = await upsertContact(accountId, { email: "future-leaver@example.test" });
  await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: list.id }, 100);
  await changeContactSubscription(accountId, contact.id, { action: "unsubscribe", listId: list.id }, 900);
  await eraseContact(accountId, contact.id, 500);
  const db = await getOutreachDb();
  expect(db.query("SELECT unsubscribedAt, erasedAt FROM erased_addresses WHERE accountId = ?").get(accountId)).toEqual({ unsubscribedAt: 900, erasedAt: 500 });
});

test("AA: the subscribe API brings an erased address back only with a consent later than the erase", async () => {
  const { accountId, list } = await erasedSubscriber("api@example.test");
  const { token } = await createApiToken(accountId, "manager-1", { name: "Website", listIds: [list.id] }, erasedAt);
  const auth = { accountId, id: token.id };
  const db = await getOutreachDb();
  for (const request of [{}, { consentAt }, { consentAt: erasedAt }]) {
    await expect(subscribeWithApiToken(auth, { email: "api@example.test", listId: list.id, ...request }, now))
      .rejects.toMatchObject({ status: 409, code: "new_consent_required" });
  }
  expect(findContactByEmail(db, accountId, "api@example.test")).toBeNull();
  // Nothing was mailable meanwhile.
  expect(await listSendableRecipients(accountId, { listIds: [list.id] })).toEqual([]);
  const accepted = await subscribeWithApiToken(auth, { email: "api@example.test", listId: list.id, consentAt: laterConsent }, now);
  expect(accepted).toMatchObject({ ok: true, status: "subscribed", created: true });
  expect(findContactByEmail(db, accountId, "api@example.test")).toMatchObject({ emailConsent: "subscribed", consentAt: laterConsent, unsubscribedAt: erasedAt });
  expect(await getSendableRecipient(accountId, accepted.contactId, { listId: list.id })).toMatchObject({ email: "api@example.test" });
});

test("AA: a manual subscribe of an erased address asks for the re-subscription confirmation", async () => {
  const { accountId, list } = await erasedSubscriber("manual@example.test");
  const { contact } = await upsertContact(accountId, { email: "manual@example.test" }, now);
  await expect(changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: list.id }, now))
    .rejects.toMatchObject({ status: 409, code: "resubscribe_confirmation_required", details: { unsubscribedAt: erasedAt } });
  expect(await getSendableRecipient(accountId, contact.id, { listId: list.id })).toBeNull();
  const confirmed = await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: list.id, confirmResubscribe: true }, now);
  expect(confirmed).toMatchObject({ emailConsent: "subscribed", consentAt: now });
  expect(await getSendableRecipient(accountId, contact.id, { listId: list.id })).not.toBeNull();
});

test("AA: the MCP tool subscribe_contact asks for confirmResubscribe for an erased address", async () => {
  const { accountId, list } = await erasedSubscriber("mcp@example.test");
  const { contact } = await upsertContact(accountId, { email: "mcp@example.test" }, now);
  const server = new McpServer({ name: "Synthetic outreach", version: "1" });
  const resolveAccount = async () => ({ accountId, role: "editor" as const, userId: "user-1", tokenId: "token-1", tokenLabel: "Assistent", tokenSuffix: "a1b2" });
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
    const refused = await client.callTool({ name: "subscribe_contact", arguments: { contactId: contact.id, listId: list.id } });
    expect(refused.isError).toBe(true);
    expect(JSON.stringify(refused.content)).toContain("confirmResubscribe");
    expect(findContactByEmail(await getOutreachDb(), accountId, "mcp@example.test")?.emailConsent).toBe("never");
  } finally {
    await client.close();
    await server.close();
  }
});

test("AA: the Klaviyo import does not activate an erased address with an older consent or membership", async () => {
  const { accountId } = await erasedSubscriber("klaviyo@example.test");
  const dir = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "outreach-erase-block-"));
  const lists = join(dir, "lists.json");
  const profiles = join(dir, "profiles.json");
  const members = join(dir, "members");
  mkdirSync(members);
  const write = (file: string, data: unknown[]) => Bun.write(file, JSON.stringify({ data }));
  const profile = (marketing: object) => [{ id: "profile-k", attributes: { email: "klaviyo@example.test", subscriptions: { email: { marketing } } } }];
  try {
    await Promise.all([
      write(lists, [{ id: "list-k", attributes: { name: "Imported" } }]),
      write(join(members, "list-k.json"), [{ id: "profile-k", attributes: { joined_group_at: iso(consentAt) } }])
    ]);
    const db = await getOutreachDb();
    const importedListId = () => (db.query("SELECT id FROM lists WHERE accountId = ? AND externalId = 'list-k'").get(accountId) as { id: string }).id;
    for (const marketing of [{ consent: "SUBSCRIBED", consent_timestamp: iso(consentAt) }, { consent: "SUBSCRIBED" }]) {
      await write(profiles, profile(marketing));
      await importKlaviyoContacts({ accountId, lists, profiles, members, write: true }, now);
      const row = findContactByEmail(db, accountId, "klaviyo@example.test")!;
      expect(row).toMatchObject({ emailConsent: "never", unsubscribedAt: erasedAt });
      expect(getMembership(db, accountId, row.id, importedListId())?.status).not.toBe("subscribed");
      expect(await getSendableRecipient(accountId, row.id, { listId: importedListId() })).toBeNull();
    }
    // A consent given after the erase is a new consent.
    await write(profiles, profile({ consent: "SUBSCRIBED", consent_timestamp: iso(laterConsent) }));
    await importKlaviyoContacts({ accountId, lists, profiles, members, write: true }, now);
    expect(findContactByEmail(db, accountId, "klaviyo@example.test")).toMatchObject({ emailConsent: "subscribed", consentAt: laterConsent });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
