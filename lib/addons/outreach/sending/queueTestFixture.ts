import type { Database } from "bun:sqlite";
import { initOutreachSchema } from "../db";
import type { SendableRecipient } from "../contacts";
import { defaultOutreachSettings } from "../settings";
import type { SequenceStepInput } from "../types";
import type { OutreachScheduler } from "./scheduler";
import { SendStopped } from "./send";
import { saveCampaign, saveSequence } from "./store";

export const fixtureAccountId = "account";
export const fixtureListId = "list";
export const fixtureStart = 1_000_000;
const actor = "editor";
/** List ids are unique across mailboxes. */
const listFor = (accountId: string) => accountId === fixtureAccountId ? fixtureListId : `${fixtureListId}-${accountId}`;

export type FixtureSend = {
  id: string; accountId: string; kind: string; campaignId: string | null; sequenceId: string | null; sequenceStepId: string | null;
  contactId: string | null; subject: string; status: string; error: string | null; attempts: number; sendAt: number | null;
};
export type FixtureEnrollment = { status: string; nextStepPosition: number | null; nextSendAt: number | null; finishedAt: number | null };

/** A queue with one or more mailboxes on a test database and a scheduler whose send records what it was asked to send. */
export function createQueueFixture(db: Database, options: { accountIds?: string[]; sendRatePerMinute?: number } = {}) {
  initOutreachSchema(db);
  const accountIds = options.accountIds ?? [fixtureAccountId];
  const sendRatePerMinute = options.sendRatePerMinute ?? 30;
  for (const accountId of accountIds) {
    db.query(`INSERT INTO account_settings (accountId, enabled, sendRatePerMinute, organizationName, updatedAt)
      VALUES (?, 1, ?, 'Verein', 0)`).run(accountId, sendRatePerMinute);
    db.query("INSERT INTO lists (accountId, id, name, createdAt, updatedAt) VALUES (?, ?, 'Liste', 0, 0)").run(accountId, listFor(accountId));
  }
  let now = fixtureStart;
  const recipients = new Map<string, SendableRecipient[]>();
  const mails: Array<{ accountId: string; sendId: string; subject: string }> = [];
  function addContact(contactId: string, accountId = fixtureAccountId, firstName = "") {
    const email = `${contactId}@example.test`;
    db.query(`INSERT INTO contacts (accountId, id, email, emailLower, firstName, emailConsent, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 'subscribed', 0, 0)`).run(accountId, contactId, email, email, firstName);
    db.query("INSERT INTO list_members (accountId, listId, contactId, status) VALUES (?, ?, ?, 'subscribed')").run(accountId, listFor(accountId), contactId);
    recipients.set(accountId, [...recipients.get(accountId) ?? [], { contactId, email, firstName, lastName: "", properties: {} }]);
  }
  function campaign(accountId = fixtureAccountId, subject = "Betreff") {
    const draft = saveCampaign(db, accountId, actor, { name: "Kampagne", subject, html: "<p>Mail</p>", listIds: [listFor(accountId)] });
    db.query("UPDATE campaigns SET status = 'scheduled', sendAt = ?, scheduledByUserId = ? WHERE accountId = ? AND id = ?")
      .run(now, actor, accountId, draft.id);
    return draft;
  }
  function sequence(steps: SequenceStepInput[], accountId = fixtureAccountId) {
    const draft = saveSequence(db, accountId, { name: "Sequenz", triggerListId: listFor(accountId), steps });
    db.query("UPDATE sequences SET status = 'live', statusChangedByUserId = ? WHERE accountId = ? AND id = ?").run(actor, accountId, draft.id);
    return draft;
  }
  const deps: NonNullable<ConstructorParameters<typeof OutreachScheduler>[0]> = {
    db: async () => db, now: () => now, recipients: async accountId => recipients.get(accountId) ?? [],
    settings: async accountId => ({ ...defaultOutreachSettings(accountId), enabled: true, updatedAt: 0, sendRatePerMinute }),
    retention: async () => 0,
    send: async input => {
      try { input.assertClaim(); }
      catch (error) {
        if (error instanceof SendStopped) return { status: "skipped", reason: error.reason };
        throw error;
      }
      mails.push({ accountId: input.settings.accountId, sendId: input.sendId, subject: input.content.subject });
      return { status: "sent", providerMessageId: "test-provider", messageId: "<test@example.test>", sentAt: now,
        recipients: "alex@example.test", subject: input.content.subject };
    }
  };
  return {
    db, deps, campaign, sequence, addContact, recipients, mails,
    now: () => now,
    time: (at: number) => { now = at; },
    sends: (accountId = fixtureAccountId) => db.query("SELECT * FROM sends WHERE accountId = ? ORDER BY queuedAt, id").all(accountId) as FixtureSend[],
    enrollment: (contactId: string, accountId = fixtureAccountId) => db.query(`SELECT status, nextStepPosition, nextSendAt, finishedAt
      FROM sequence_enrollments WHERE accountId = ? AND contactId = ?`).get(accountId, contactId) as FixtureEnrollment | null,
    /** Subjects of the mails sent so far, in order. */
    sent: () => mails.map(mail => mail.subject)
  };
}
