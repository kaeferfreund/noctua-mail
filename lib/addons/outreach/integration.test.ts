import { afterAll, beforeAll, expect, test } from "bun:test";
import "@/lib/testDbHarness";
import type { Account } from "@/lib/data";
import { POST as unsubscribePost } from "@/app/t/u/[token]/route";
import { createApiToken, subscribeWithApiToken } from "./contacts/apiTokens";
import { changeContactSubscription, eraseContact, getMembership } from "./contacts/consent";
import { createContactList, findContactByEmail, getContactDetail, upsertContact } from "./contacts/records";
import { getSendableRecipient, listSendableRecipients } from "./contacts";
import { getOutreachDb } from "./db";
import { OutreachScheduler } from "./sending/scheduler";
import { defaultSendDependencies, sendOutreachMail } from "./sending/send";
import { saveCampaign, saveSequence } from "./sending/store";
import { getOutreachSettings, saveOutreachSettings } from "./settings";
import { getMessageTracking, getSendStats, trackingClickResponse, trackingOpenResponse } from "./tracking";

/**
 * The three areas together, with the real consent, sequence, rendering, tracking and
 * unsubscribe code. Only the transport, the mailbox lookup and the outbound authorization
 * are replaced, so nothing leaves the process.
 */
const saved = { flag: process.env.NOCTUA_ADDON_OUTREACH, origin: process.env.NOCTUA_OUTREACH_PUBLIC_URL };
beforeAll(() => {
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  process.env.NOCTUA_OUTREACH_PUBLIC_URL = "https://links.example.test";
});
afterAll(() => {
  if (saved.flag === undefined) delete process.env.NOCTUA_ADDON_OUTREACH; else process.env.NOCTUA_ADDON_OUTREACH = saved.flag;
  if (saved.origin === undefined) delete process.env.NOCTUA_OUTREACH_PUBLIC_URL; else process.env.NOCTUA_OUTREACH_PUBLIC_URL = saved.origin;
});

const browser = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "x-forwarded-for": "198.51.100.23" };

test("signup → welcome series → tracked mail → click → unsubscribe stops the series", async () => {
  const accountId = crypto.randomUUID();
  const db = await getOutreachDb();
  await saveOutreachSettings(accountId, { enabled: true, transport: "mailbox-smtp", organizationName: "Example GmbH", organizationAddress: "Musterweg 1, 12345 Musterstadt" }, "manager-1");
  const list = await createContactList(accountId, { name: "Welcome" });
  const sequence = saveSequence(db, accountId, { name: "Welcome series", triggerListId: list.id, steps: [
    { delayMinutes: 0, subject: "Willkommen, {{ first_name|default:'du' }}", html: `<html><body><p>Hallo {{ first_name }}</p><p><a href="https://www.example.test/start?a=1&amp;b=2">Los geht's</a></p><p>{% unsubscribe 'Abmelden' %}</p></body></html>` },
    { delayMinutes: 1440, subject: "Tag zwei", html: "<p>Zweite Mail</p>" }
  ] });
  db.query("UPDATE sequences SET status = 'live', statusChangedByUserId = 'editor-1' WHERE accountId = ? AND id = ?").run(accountId, sequence.id);

  // Server-to-server signup, as the registration backend will do it.
  const { token } = await createApiToken(accountId, "manager-1", { name: "Registration", listIds: [list.id] });
  const signedUpAt = Date.now() - 20 * 60_000;
  const signup = await subscribeWithApiToken({ accountId, id: token.id }, { email: "Erika@Example.test", firstName: "Erika <b>", listId: list.id }, signedUpAt);
  expect(signup).toMatchObject({ ok: true, status: "subscribed", created: true });
  const contact = findContactByEmail(db, accountId, "erika@example.test")!;
  expect(db.query("SELECT status, nextStepPosition FROM sequence_enrollments WHERE accountId = ? AND contactId = ?").all(accountId, contact.id))
    .toEqual([{ status: "active", nextStepPosition: expect.any(Number) }]);
  // A repeated signup neither enrolls nor mails twice.
  await subscribeWithApiToken({ accountId, id: token.id }, { email: "erika@example.test", listId: list.id }, signedUpAt + 1000);

  type Wire = { to: string; subject: string; html: string; text: string; messageId: string; headers: Record<string, string> };
  const mails: Wire[] = [];
  const account = { id: accountId, smtp: { host: "smtp.example.test", port: 587, secure: false, user: "news@example.test", password: "synthetic" } } as unknown as Account;
  let now = Date.now() - 10 * 60_000;
  const scheduler = new OutreachScheduler({
    db: getOutreachDb, now: () => now, recipients: listSendableRecipients, settings: getOutreachSettings, retention: async () => 0,
    send: input => sendOutreachMail(input, {
      ...defaultSendDependencies, now: () => now,
      getAccount: async () => account,
      resolveIdentity: async () => ({ id: "identity-1", email: "news@example.test", displayName: "Example News", replyTo: undefined }),
      authorize: (async () => ({})) as unknown as typeof defaultSendDependencies.authorize,
      prepareAssertion: (async () => () => {}) as unknown as typeof defaultSendDependencies.prepareAssertion,
      transport: {
        ses: async () => { throw new Error("SES must not be used in this test"); },
        "mailbox-smtp": async (mail, _account, _identity, beforeSend) => {
          (await beforeSend())();
          mails.push(mail);
          return { messageId: mail.messageId, providerMessageId: null };
        }
      }
    })
  });
  await scheduler.tick();
  expect(mails).toHaveLength(1);
  const [first] = mails;
  expect(first).toMatchObject({ to: "erika@example.test", subject: "Willkommen, Erika <b>" });
  // The name is escaped in HTML; the link goes through /t/c; the unsubscribe link stays direct.
  expect(first.html).toContain("Hallo Erika &lt;b&gt;");
  expect(first.html).not.toContain("https://www.example.test/start");
  const click = /href="(https:\/\/links\.example\.test\/t\/c\/([A-Za-z0-9_-]{27}))"/.exec(first.html)!;
  const pixel = /src="https:\/\/links\.example\.test\/t\/o\/([A-Za-z0-9_-]{27}\.gif)"/.exec(first.html)!;
  const unsubscribe = /href="(https:\/\/links\.example\.test\/t\/u\/([A-Za-z0-9_-]{27}))"/.exec(first.html)!;
  expect(click && pixel && unsubscribe).toBeTruthy();
  expect(first.headers).toEqual({ "List-Unsubscribe": `<${unsubscribe[1]}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });
  expect(first.text).toContain(unsubscribe[1]);

  // The recipient opens and clicks ten minutes later, from a browser.
  expect((await trackingOpenResponse(new Request(`https://links.example.test/t/o/${pixel[1]}`, { headers: browser }), pixel[1])).status).toBe(200);
  const redirect = await trackingClickResponse(new Request(click[1], { headers: browser }), click[2]);
  expect(redirect.status).toBe(302);
  expect(redirect.headers.get("location")).toBe("https://www.example.test/start?a=1&b=2");
  const tracking = await getMessageTracking(accountId, { messageId: first.messageId });
  expect(tracking).toMatchObject({ kind: "sequence", opens: 1, clicks: 1, machineOpens: 0, bounced: false });
  expect(tracking?.lastEvent).toMatchObject({ type: "click", clientName: "Chrome", clientOs: "Windows", machine: false });
  expect(await getSendStats(accountId, { sequenceId: sequence.id })).toMatchObject({ recipients: 1, sent: 1, opened: 1, clicked: 1, unsubscribed: 0 });
  // Another mailbox sees nothing of it.
  expect(await getMessageTracking("another-mailbox", { messageId: first.messageId })).toBeNull();

  // One-click unsubscribe: global, recorded, and the rest of the series is cancelled.
  const form = { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...browser }, body: "List-Unsubscribe=One-Click" };
  expect((await unsubscribePost(new Request(unsubscribe[1], form), { params: Promise.resolve({ token: unsubscribe[2] }) })).status).toBe(200);
  expect(await getSendableRecipient(accountId, contact.id, { listId: list.id })).toBeNull();
  expect(db.query("SELECT status FROM sequence_enrollments WHERE accountId = ? AND contactId = ?").all(accountId, contact.id)).toEqual([{ status: "cancelled" }]);
  now += 3 * 24 * 60 * 60_000;
  await scheduler.tick();
  expect(mails).toHaveLength(1);
  expect(await getSendStats(accountId, { sequenceId: sequence.id })).toMatchObject({ sent: 1, unsubscribed: 1 });
  const detail = await getContactDetail(accountId, contact.id);
  expect(detail).toMatchObject({ emailConsent: "unsubscribed", stats: { sent: 1, opened: 1, clicked: 1, unsubscribed: 1 } });
  expect(detail.lists).toMatchObject([{ listId: list.id, status: "unsubscribed" }]);
  // A late signup without a new consent time does not bring the person back.
  await expect(subscribeWithApiToken({ accountId, id: token.id }, { email: "erika@example.test", listId: list.id })).rejects.toMatchObject({ code: "new_consent_required" });
  await scheduler.stop();
});

test("an accepted send settles anonymously if the contact was erased before its receipt", async () => {
  const accountId = crypto.randomUUID();
  const db = await getOutreachDb();
  await saveOutreachSettings(accountId, { enabled: true }, "editor");
  const { contact } = await upsertContact(accountId, { email: "erased@example.test" });
  const list = await createContactList(accountId, { name: "List" });
  await changeContactSubscription(accountId, contact.id, { listId: list.id, action: "subscribe" });
  const campaign = saveCampaign(db, accountId, "editor", { subject: "Hallo {{ first_name }}", listIds: [list.id] });
  const now = Date.now();
  db.query("UPDATE campaigns SET status = 'scheduled', sendAt = ?, scheduledByUserId = 'editor' WHERE accountId = ? AND id = ?")
    .run(now, accountId, campaign.id);
  const scheduler = new OutreachScheduler({
    db: getOutreachDb, now: () => now, recipients: listSendableRecipients, settings: getOutreachSettings, retention: async () => 0,
    send: async input => {
      input.assertClaim();
      await eraseContact(accountId, contact.id);
      return { status: "sent", recipients: contact.email, subject: "Hallo Alex", sentAt: now + 1,
        messageId: "<sent@example.test>", providerMessageId: "receipt" };
    }
  });
  await scheduler.tick();
  expect(db.query("SELECT contactId, status, recipients, subject, sentAt, providerMessageId FROM sends WHERE accountId = ? AND campaignId = ?")
    .get(accountId, campaign.id)).toEqual({ contactId: null, status: "sent", recipients: "", subject: "", sentAt: now + 1, providerMessageId: "receipt" });
});

test("a failed welcome enrollment rolls back API and editor subscriptions, which can then be retried", async () => {
  const accountId = crypto.randomUUID();
  const db = await getOutreachDb();
  await saveOutreachSettings(accountId, { enabled: true }, "editor");
  const list = await createContactList(accountId, { name: "Welcome" });
  const sequence = saveSequence(db, accountId, { triggerListId: list.id, steps: [{ subject: "Willkommen", text: "Hallo" }] });
  db.query("UPDATE sequences SET status = 'live' WHERE accountId = ? AND id = ?").run(accountId, sequence.id);
  const { token } = await createApiToken(accountId, "editor", { name: "Registration", listIds: [list.id] });
  const { contact } = await upsertContact(accountId, { email: "manual@example.test" });
  const subscribeApi = () => subscribeWithApiToken({ accountId, id: token.id }, { listId: list.id, email: "signup@example.test" });
  const subscribeEditor = () => changeContactSubscription(accountId, contact.id, { listId: list.id, action: "subscribe" });
  db.exec(`CREATE TEMP TRIGGER fail_enrollment BEFORE INSERT ON sequence_enrollments
    WHEN NEW.accountId = '${accountId}' BEGIN SELECT RAISE(ABORT, 'synthetic enrollment failure'); END`);
  try {
    await expect(subscribeApi()).rejects.toThrow("synthetic enrollment failure");
    await expect(subscribeEditor()).rejects.toThrow("synthetic enrollment failure");
    expect(findContactByEmail(db, accountId, "signup@example.test")).toBeNull();
    expect(getMembership(db, accountId, contact.id, list.id)).toBeNull();
  } finally {
    db.exec("DROP TRIGGER fail_enrollment");
  }

  await subscribeApi();
  await subscribeEditor();
  await subscribeApi();
  await subscribeEditor();
  expect(db.query("SELECT count(*) AS count FROM sequence_enrollments WHERE accountId = ? AND sequenceId = ?")
    .get(accountId, sequence.id)).toEqual({ count: 2 });
});
