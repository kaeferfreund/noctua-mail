import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { initOutreachSchema } from "../db";
import type { NewTrackingEvent } from "../tracking";
import { applySesEvent } from "./sesEvents";

test("SES maps the stored provider id, suppresses only permanent bounce and complaint, and deduplicates SNS replays", async () => {
  const db = initOutreachSchema(new Database(":memory:"));
  try {
    db.query("INSERT INTO account_settings (accountId, enabled, updatedAt) VALUES ('other', 1, 0), ('mailbox', 0, 0)").run();
    db.query(`INSERT INTO sends (id, accountId, kind, contactId, recipients, providerMessageId, status, queuedAt) VALUES
      ('send', 'mailbox', 'campaign', 'contact', 'alex@example.test', 'provider-test', 'sent', 0),
      ('test', 'mailbox', 'test', NULL, 'test@example.test', 'provider-test-mail', 'sent', 0)`).run();
    const events: NewTrackingEvent[] = [];
    const suppressions: unknown[] = [];
    const deps: NonNullable<Parameters<typeof applySesEvent>[2]> = {
      db: async () => db, now: () => 1000,
      suppress: async (accountId, target) => { suppressions.push({ accountId, ...target }); },
      record: async event => {
        db.query("INSERT INTO tracking_events (accountId, sendId, contactId, type, at, detail) VALUES (?, ?, ?, ?, ?, ?)")
          .run(event.accountId, event.sendId, event.contactId ?? null, event.type, event.at, JSON.stringify(event.detail));
        events.push(event);
      }
    };
    const mail = { messageId: "provider-test" };
    await applySesEvent("one", { eventType: "Bounce", mail, bounce: { bounceType: "Transient" } }, deps);
    const permanent = { notificationType: "Bounce", mail, bounce: { bounceType: "Permanent" } };
    await applySesEvent("two", permanent, deps);
    await applySesEvent("two", permanent, deps);
    await applySesEvent("three", { eventType: "Complaint", mail, complaint: {} }, deps);
    const delivery = { eventType: "Delivery", mail, delivery: {} };
    await Promise.all([applySesEvent("four", delivery, deps), applySesEvent("four", delivery, deps)]);
    await applySesEvent("five", { ...delivery, mail: { messageId: "provider-test-mail" } }, deps);
    expect(events.map(event => [event.accountId, event.sendId, event.type])).toEqual([
      ["mailbox", "send", "bounce"], ["mailbox", "send", "bounce"], ["mailbox", "send", "complaint"], ["mailbox", "send", "delivered"]
    ]);
    expect(suppressions).toEqual([
      { accountId: "mailbox", contactId: "contact", reason: "hard_bounce", at: 1000 },
      { accountId: "mailbox", contactId: "contact", reason: "complaint", at: 1000 }
    ]);
  } finally {
    db.close();
  }
});
