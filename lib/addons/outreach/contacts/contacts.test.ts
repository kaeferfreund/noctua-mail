import { expect, test } from "bun:test";
import "@/lib/testDbHarness";
import { getOutreachDb } from "../db";
import type { EmailConsent, ListMemberStatus, SuppressionReason } from "../types";
import { changeContactSubscription, changeManualSuppression, eraseContact, getMembership, subscriptionDecision } from "./consent";
import { getSendableRecipient, listSendableRecipients, suppressContact } from "./index";
import { archiveContactList, createContactList, findContact, getContactDetail, patchContact, searchContacts, upsertContact } from "./records";

type ConsentCase = [EmailConsent, number | null, SuppressionReason | null, ListMemberStatus | null, number | null, number, boolean, string];
test.each<ConsentCase>([
  ["never", null, null, null, null, 100, false, "subscribe"],
  ["never", null, null, "pending", null, 100, true, "subscribe"],
  ["subscribed", 20, "manual", "subscribed", null, 100, true, "contact_suppressed"],
  ["never", null, "hard_bounce", null, null, 100, true, "contact_suppressed"],
  ["unsubscribed", 90, "complaint", null, null, 100, true, "contact_suppressed"],
  ["unsubscribed", 90, null, null, null, 89, true, "new_consent_required"],
  ["unsubscribed", 90, null, null, null, 90, true, "new_consent_required"],
  ["unsubscribed", 90, null, null, null, 91, true, "subscribe"],
  ["unsubscribed", 90, null, null, null, 91, false, "new_consent_required"],
  ["unsubscribed", 90, null, "unsubscribed", 95, 94, true, "new_consent_required"],
  ["subscribed", 20, null, "unsubscribed", 30, 29, true, "new_consent_required"],
  ["subscribed", 20, null, "unsubscribed", 30, 40, true, "subscribe"]
])("consent policy %#", (emailConsent, consentAt, suppressedReason, status, unsubscribedAt, at, fresh, decision) => {
  const membership = status ? { status, subscribedAt: null, unsubscribedAt } : null;
  expect(subscriptionDecision({ emailConsent, consentAt, suppressedReason }, membership, at, fresh)).toBe(decision);
});

test("campaign selection deduplicates members, honors exclusions, and rechecks consent and list status", async () => {
  const accountId = crypto.randomUUID();
  const first = await createContactList(accountId, { name: "First list" });
  const second = await createContactList(accountId, { name: "Second list" });
  const excluded = await createContactList(accountId, { name: "Excluded list" });
  const addContact = async (email: string, listIds: string[]) => {
    const { contact } = await upsertContact(accountId, { email });
    for (const listId of listIds) await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId }, 100);
    return contact.id;
  };
  const included = await addContact("include@example.test", [first.id, second.id]);
  const excludedId = await addContact("exclude@example.test", [first.id, excluded.id]);
  const suppressed = await addContact("blocked@example.test", [first.id]);
  await suppressContact(accountId, { contactId: suppressed, reason: "hard_bounce" });
  await addContact("no-consent@example.test", []);
  await addContact("archive@example.test", [second.id]);
  const listIds = [first.id, first.id, second.id];
  expect((await listSendableRecipients(accountId, { listIds, excludedListIds: [excluded.id] })).map(row => row.email))
    .toEqual(["archive@example.test", "include@example.test"]);
  await archiveContactList(accountId, second.id);
  expect((await listSendableRecipients(accountId, { listIds, excludedListIds: [excluded.id] })).map(row => row.contactId)).toEqual([included]);
  expect((await listSendableRecipients(accountId, { listIds: [first.id], excludedListIds: [second.id] })).map(row => row.contactId))
    .toEqual([excludedId]);
  expect(await listSendableRecipients("foreign", { listIds })).toEqual([]);
  expect(await getSendableRecipient(accountId, suppressed)).toBeNull();
  expect(await getSendableRecipient(accountId, included, { listId: second.id })).toBeNull();
  const updated = await changeContactSubscription(accountId, excludedId, { action: "unsubscribe", listId: excluded.id }, 200);
  expect(updated).toMatchObject({ emailConsent: "subscribed" });
  expect(await getSendableRecipient(accountId, excludedId, { listId: excluded.id })).toBeNull();
  expect(await getSendableRecipient(accountId, excludedId, { listId: first.id })).not.toBeNull();
  expect(await getSendableRecipient("foreign", excludedId)).toBeNull();
});

test("profile search is account-scoped, pages real matches, and treats LIKE metacharacters literally", async () => {
  const accountId = crypto.randomUUID();
  const { contact } = await upsertContact(accountId, { email: "FIRST@EXAMPLE.TEST", firstName: "Synthetic", lastName: "Contact" });
  expect(await upsertContact(accountId, { email: "first@example.test" })).toMatchObject({ created: false, contact: { id: contact.id, firstName: "Synthetic" } });
  const second = await upsertContact(accountId, { email: "second@example.test", firstName: "Synthetic_2" });
  await upsertContact("foreign", { email: "foreign@example.test", firstName: "Synthetic" });
  await suppressContact(accountId, { contactId: second.contact.id, reason: "manual" });
  const list = await createContactList(accountId, { name: "Subscribers" });
  await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: list.id }, 100);
  expect(await searchContacts(accountId, { q: "synthetic", page: 2, pageSize: 1 })).toMatchObject({
    total: 2, page: 2, contacts: [{ id: second.contact.id }]
  });
  expect(await searchContacts(accountId, { q: "_", suppressed: true, page: 1, pageSize: 10 })).toMatchObject({
    total: 1, contacts: [{ id: second.contact.id }]
  });
  expect(await searchContacts(accountId, { consent: "subscribed", listId: list.id, page: 1, pageSize: 10 })).toMatchObject({
    total: 1, contacts: [{ id: contact.id }]
  });
  await expect(patchContact(accountId, contact.id, { email: "replacement@example.test" })).rejects.toMatchObject({ code: "email_change_conflict" });
  await expect(patchContact(accountId, second.contact.id, { email: "first@example.test" })).rejects.toMatchObject({ code: "email_in_use" });
  const fresh = await upsertContact(accountId, { email: "fresh@example.test" });
  expect(await patchContact(accountId, fresh.contact.id, { email: "replacement@example.test" })).toMatchObject({ email: "replacement@example.test" });
  expect(await getContactDetail(accountId, contact.id)).toMatchObject({ lists: [{ listId: list.id, status: "subscribed" }] });
});

test("manual suppression can be lifted, stronger suppression cannot, and an unknown bounced address is saved", async () => {
  const accountId = crypto.randomUUID();
  const list = await createContactList(accountId, { name: "Updates" });
  const { contact } = await upsertContact(accountId, { email: "blocked@example.test" });
  const change = { action: "subscribe", listId: list.id } as const;
  await changeManualSuppression(accountId, contact.id, true);
  await expect(changeContactSubscription(accountId, contact.id, change)).rejects.toMatchObject({ code: "contact_suppressed" });
  await changeManualSuppression(accountId, contact.id, false);
  await changeContactSubscription(accountId, contact.id, change);
  await suppressContact(accountId, { contactId: contact.id, reason: "complaint", at: 100 });
  await changeManualSuppression(accountId, contact.id, true);
  await expect(changeManualSuppression(accountId, contact.id, false)).rejects.toMatchObject({ code: "suppression_locked" });
  expect(await getContactDetail(accountId, contact.id)).toMatchObject({ suppressedReason: "complaint", suppressedAt: 100 });
  await suppressContact(accountId, { email: "Unknown@Example.test", reason: "hard_bounce" });
  expect(await searchContacts(accountId, { q: "unknown", suppressed: true, page: 1, pageSize: 10 })).toMatchObject({
    total: 1, contacts: [{ email: "unknown@example.test", suppressedReason: "hard_bounce", emailConsent: "never" }]
  });
});

test("erasing a contact removes dependent data and keeps only scrubbed sends in its mailbox totals", async () => {
  const accountId = crypto.randomUUID();
  const foreign = crypto.randomUUID();
  const db = await getOutreachDb();
  const { contact } = await upsertContact(accountId, { email: "erase@example.test" });
  const list = await createContactList(accountId, { name: "Updates" });
  await changeContactSubscription(accountId, contact.id, { action: "subscribe", listId: list.id });
  const send = (id: string, mailbox: string, status: string) => {
    db.query(`INSERT INTO sends (id, accountId, contactId, kind, recipients, subject, error, campaignId, status, queuedAt)
      VALUES (?, ?, ?, 'campaign', ?, 'Synthetic subject', ?, ?, ?, 5)`)
      .run(id, mailbox, contact.id, contact.email, contact.email, `campaign-${id}`, status);
    db.query("INSERT INTO tracking_links (token, accountId, sendId, kind, createdAt) VALUES (?, ?, ?, 'open', 6)").run(id, mailbox, id);
    db.query("INSERT INTO tracking_events (accountId, sendId, type, at) VALUES (?, ?, 'open', 7)").run(mailbox, id);
  };
  send("erase-sent", accountId, "sent");
  send("erase-queued", accountId, "queued");
  send("erase-foreign", foreign, "sent");
  db.query("INSERT INTO sequence_enrollments (id, sequenceId, accountId, contactId, enrolledAt) VALUES (?, ?, ?, ?, 5)")
    .run("enrollment-1", "sequence-1", accountId, contact.id);
  db.query("INSERT INTO tracking_events (accountId, contactId, type, at) VALUES (?, ?, 'unsubscribe', 8)").run(accountId, contact.id);
  await expect(eraseContact(foreign, contact.id)).rejects.toMatchObject({ status: 404 });
  await eraseContact(accountId, contact.id);
  expect(findContact(db, accountId, contact.id)).toBeNull();
  expect(getMembership(db, accountId, contact.id, list.id)).toBeNull();
  for (const table of ["sequence_enrollments", "tracking_links", "tracking_events"]) {
    expect(db.query(`SELECT * FROM ${table} WHERE accountId = ?`).all(accountId)).toEqual([]);
  }
  expect(db.query("SELECT id, contactId, recipients, subject, error, status FROM sends WHERE accountId = ? ORDER BY id").all(accountId)).toEqual([
    { id: "erase-queued", contactId: null, recipients: "", subject: "", error: null, status: "skipped" },
    { id: "erase-sent", contactId: null, recipients: "", subject: "", error: null, status: "sent" }
  ]);
  expect(db.query("SELECT contactId FROM sends WHERE accountId = ?").get(foreign)).toEqual({ contactId: contact.id });
  expect(db.query("SELECT * FROM tracking_events WHERE accountId = ?").all(foreign)).toHaveLength(1);
});
