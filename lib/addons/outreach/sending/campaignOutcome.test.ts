import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { TEST_BASE_URL, createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { POST as scheduleCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/[campaignId]/schedule/route";
import { getOutreachDb } from "../db";
import { saveOutreachSettings } from "../settings";
import { enroll, expandCampaign } from "./queue";
import { OutreachScheduler } from "./scheduler";
import { SendStopped } from "./send";
import { saveCampaign } from "./store";
import { createQueueFixture, fixtureAccountId as accountId, fixtureListId as listId, fixtureStart as start } from "./queueTestFixture";

const campaignStatus = (db: Database, id: string) =>
  (db.query("SELECT status FROM campaigns WHERE accountId = ? AND id = ?").get(accountId, id) as { status: string }).status;

test("a campaign whose sends were all skipped ends as failed", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    f.addContact("first");
    f.addContact("second");
    const campaign = f.campaign();
    expandCampaign(db, campaign, f.recipients.get(accountId)!, start);
    db.query("UPDATE contacts SET emailConsent = 'unsubscribed' WHERE accountId = ?").run(accountId);
    await new OutreachScheduler(f.deps).tick();
    expect(f.sends().map(row => row.status)).toEqual(["skipped", "skipped"]);
    expect(campaignStatus(db, campaign.id)).toBe("failed");
  } finally {
    db.close();
  }
});

test("a campaign that had nobody to send to at fan-out ends as failed", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    const campaign = f.campaign();
    await new OutreachScheduler(f.deps).tick();
    expect(f.sends()).toHaveLength(0);
    expect(campaignStatus(db, campaign.id)).toBe("failed");
  } finally {
    db.close();
  }
});

test("a campaign that reached at least one recipient ends as sent", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    f.addContact("first");
    f.addContact("second");
    const campaign = f.campaign();
    expandCampaign(db, campaign, f.recipients.get(accountId)!, start);
    db.query("UPDATE contacts SET emailConsent = 'unsubscribed' WHERE accountId = ? AND id = 'second'").run(accountId);
    await new OutreachScheduler(f.deps).tick();
    expect(f.sends().map(row => row.status).sort()).toEqual(["sent", "skipped"]);
    expect(campaignStatus(db, campaign.id)).toBe("sent");
  } finally {
    db.close();
  }
});

test("queued, skipped and failed rows carry the subject rendered for their recipient", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    f.addContact("alex", accountId, "Alex");
    f.addContact("kim", accountId, "Kim");
    f.addContact("noname");
    const campaign = f.campaign(accountId, "Hallo {{ first_name|default:\"zusammen\" }} von {{ organization.name }}");
    f.sequence([{ subject: "Willkommen {{ first_name }}", text: "Hallo", delayMinutes: 0 }]);
    enroll(db, accountId, { listId, contactId: "alex", at: start });
    db.query("UPDATE contacts SET emailConsent = 'unsubscribed' WHERE accountId = ? AND id = 'kim'").run(accountId);
    f.recipients.set(accountId, f.recipients.get(accountId)!.filter(contact => contact.contactId !== "kim"));
    expandCampaign(db, campaign, [...f.recipients.get(accountId)!, { contactId: "kim", email: "kim@example.test", firstName: "Kim", lastName: "", properties: {} }], start);
    f.deps.send = async input => {
      try { input.assertClaim(); } catch (error) {
        if (error instanceof SendStopped) return { status: "skipped", reason: error.reason };
        throw error;
      }
      return "contactId" in input.recipient && input.recipient.contactId === "noname"
        ? { status: "failed", reason: "recipient_invalid" }
        : { status: "retry", reason: "smtp_before_data" };
    };
    await new OutreachScheduler(f.deps).tick();
    const subjects = Object.fromEntries(f.sends().map(row => [`${row.kind}:${row.contactId}:${row.status}`, row.subject]));
    expect(subjects).toEqual({
      "campaign:alex:queued": "Hallo Alex von Verein",
      "campaign:kim:skipped": "Hallo Kim von Verein",
      "campaign:noname:failed": "Hallo zusammen von Verein",
      "sequence:alex:queued": "Willkommen Alex"
    });
  } finally {
    db.close();
  }
});

test("scheduling a campaign that reaches nobody is refused; the dry run still answers the count", async () => {
  const previousFlag = process.env.NOCTUA_ADDON_OUTREACH;
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  try {
    const account = crypto.randomUUID();
    await (await dbModulePromise).upsertAccount(identityTestAccount(account));
    const editor = await createAuthenticatedTestSession();
    await editor.addMembership(editor.user.id, account, "editor");
    await saveOutreachSettings(account, { enabled: true, transport: "mailbox-smtp" }, editor.user.id);
    const db = await getOutreachDb();
    db.query("INSERT INTO lists (accountId, id, name, createdAt, updatedAt) VALUES (?, ?, 'Leer', 0, 0)").run(account, account);
    const campaign = saveCampaign(db, account, editor.user.id, { name: "Leer", subject: "Betreff", html: "<p>Hallo</p>", listIds: [account] });
    const schedule = (body: unknown) => scheduleCampaign(new Request(
      `${TEST_BASE_URL}/api/addons/outreach/accounts/${account}/campaigns/${campaign.id}/schedule`, {
        method: "POST", headers: editor.jar.headers({ origin: TEST_BASE_URL, "content-type": "application/json" }), body: JSON.stringify(body)
      }), { params: Promise.resolve({ accountId: account, campaignId: campaign.id }) });
    const dryRun = await schedule({ sendAt: null, dryRun: true });
    expect({ status: dryRun.status, ...await dryRun.json() }).toMatchObject({ status: 200, recipients: 0, campaign: { status: "draft" } });
    const refused = await schedule({ sendAt: null });
    expect({ status: refused.status, ...await refused.json() }).toMatchObject({ status: 409, code: "no_recipients" });
    expect(db.query("SELECT status FROM campaigns WHERE accountId = ? AND id = ?").get(account, campaign.id)).toEqual({ status: "draft" });
  } finally {
    if (previousFlag === undefined) delete process.env.NOCTUA_ADDON_OUTREACH;
    else process.env.NOCTUA_ADDON_OUTREACH = previousFlag;
  }
});
