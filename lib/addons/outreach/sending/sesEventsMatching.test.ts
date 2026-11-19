import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { initOutreachSchema } from "../db";
import type { NewTrackingEvent } from "../tracking";
import { createSnsHandler } from "@/app/t/ses-events/sns";
import { applySesEvent } from "./sesEvents";

function fixture() {
  const db = initOutreachSchema(new Database(":memory:"));
  db.query("INSERT INTO account_settings (accountId, enabled, updatedAt) VALUES ('mailbox', 1, 0)").run();
  db.query(`INSERT INTO sends (id, accountId, kind, contactId, recipients, status, error, queuedAt) VALUES
    ('uncertain', 'mailbox', 'campaign', 'c-uncertain', 'a@example.test', 'failed', 'send_uncertain', 0),
    ('interrupted', 'mailbox', 'sequence', 'c-interrupted', 'b@example.test', 'failed', 'interrupted', 0),
    ('rejected', 'mailbox', 'campaign', 'c-rejected', 'c@example.test', 'failed', 'ses_rejected', 0),
    ('skipped', 'mailbox', 'campaign', 'c-skipped', 'd@example.test', 'skipped', 'cancelled', 0)`).run();
  const events: NewTrackingEvent[] = [];
  const suppressed: unknown[] = [];
  const deps: NonNullable<Parameters<typeof applySesEvent>[2]> = {
    db: async () => db, now: () => 1000,
    suppress: async (accountId, target) => { suppressed.push({ accountId, ...target }); },
    record: async event => {
      db.query("INSERT INTO tracking_events (accountId, sendId, contactId, type, at, detail) VALUES (?, ?, ?, ?, ?, ?)")
        .run(event.accountId, event.sendId, event.contactId ?? null, event.type, event.at, JSON.stringify(event.detail));
      events.push(event);
    }
  };
  const provider = (id: string) => db.query("SELECT providerMessageId FROM sends WHERE accountId = 'mailbox' AND id = ?").get(id);
  return { db, deps, events, suppressed, provider };
}

const bounce = (messageId: string, sendId?: string) => ({
  eventType: "Bounce", bounce: { bounceType: "Permanent" },
  mail: { messageId, ...(sendId ? { tags: { noctua_send_id: [sendId] } } : {}) }
});

test("an event for a send that failed as uncertain or interrupted is matched by its tag and suppresses", async () => {
  const { db, deps, events, suppressed, provider } = fixture();
  try {
    await applySesEvent("one", bounce("ses-uncertain", "uncertain"), deps);
    await applySesEvent("two", { eventType: "Complaint", complaint: {}, mail: { messageId: "ses-interrupted", tags: { noctua_send_id: ["interrupted"] } } }, deps);
    expect(suppressed).toEqual([
      { accountId: "mailbox", contactId: "c-uncertain", reason: "hard_bounce", at: 1000 },
      { accountId: "mailbox", contactId: "c-interrupted", reason: "complaint", at: 1000 }
    ]);
    expect(events.map(event => [event.sendId, event.type])).toEqual([["uncertain", "bounce"], ["interrupted", "complaint"]]);
    expect(provider("uncertain")).toEqual({ providerMessageId: "ses-uncertain" });
    expect(provider("interrupted")).toEqual({ providerMessageId: "ses-interrupted" });
    // Replays stay deduplicated; a later event of the same mail still matches.
    await applySesEvent("one", bounce("ses-uncertain", "uncertain"), deps);
    await applySesEvent("three", { eventType: "Delivery", delivery: {}, mail: { messageId: "ses-uncertain", tags: { noctua_send_id: ["uncertain"] } } }, deps);
    expect(events.map(event => [event.sendId, event.type])).toEqual([["uncertain", "bounce"], ["interrupted", "complaint"], ["uncertain", "delivered"]]);
    // A tag cannot attach a second provider message to the row.
    await applySesEvent("four", bounce("ses-other", "uncertain"), deps);
    expect(events).toHaveLength(3);
    expect(provider("uncertain")).toEqual({ providerMessageId: "ses-uncertain" });
  } finally {
    db.close();
  }
});

test("events of other senders and closed rows are acknowledged at once without effect", async () => {
  const { db, deps, events, suppressed } = fixture();
  try {
    for (const event of [bounce("foreign"), bounce("foreign", "snd_unknown"), bounce("ses-rejected", "rejected"), bounce("ses-skipped", "skipped")]) {
      await expect(applySesEvent("sns", event, deps, 1000)).resolves.toBeUndefined();
    }
    expect(events).toEqual([]);
    expect(suppressed).toEqual([]);

    const handler = createSnsHandler({
      enabled: () => true, topic: () => "arn:aws:sns:eu-central-1:000000000000:test-topic", isLimited: () => false,
      fetch: async () => new Response(null), verify: async () => true,
      apply: (id, event, publishedAt) => applySesEvent(id, event, deps, publishedAt)
    });
    const notify = (message: unknown) => handler(new Request("https://mail.example.test/t/ses-events", { method: "POST", body: JSON.stringify({
      Type: "Notification", TopicArn: "arn:aws:sns:eu-central-1:000000000000:test-topic", MessageId: "c6512800-891c-4664-945a-e17cc00f1a6a",
      Message: JSON.stringify(message), Timestamp: "1970-01-01T00:00:01.000Z", SignatureVersion: "2", Signature: "c2lnbmF0dXJl",
      SigningCertURL: "https://sns.eu-central-1.amazonaws.com/SimpleNotificationService-abcd1234.pem"
    }) }));
    expect((await notify(bounce("foreign"))).status).toBe(200);
    db.query(`INSERT INTO sends (id, accountId, kind, contactId, status, queuedAt) VALUES ('pending', 'mailbox', 'campaign', 'c', 'sending', 0)`).run();
    expect((await notify(bounce("ses-pending", "pending"))).status).toBe(503);
  } finally {
    db.close();
  }
});
