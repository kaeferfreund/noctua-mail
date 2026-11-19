import { expect, spyOn, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("a bounce retries when the receipt commits immediately after the send lookup snapshot", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "outreach-ses-"));
  const path = join(scratch, "test.db");
  const db = initOutreachSchema(new Database(path));
  const writer = new Database(path);
  const originalQuery = db.query.bind(db);
  const lookup = spyOn(db, "query");
  try {
    db.query("INSERT INTO account_settings (accountId, enabled, updatedAt) VALUES ('mailbox', 1, 0)").run();
    db.query(`INSERT INTO sends (id, accountId, kind, contactId, status, queuedAt)
      VALUES ('send', 'mailbox', 'campaign', 'contact', 'sending', 0)`).run();
    let committed = false;
    lookup.mockImplementation(sql => {
      const statement = originalQuery(sql);
      if (!sql.includes("providerMessageId") || committed) return statement;
      const get = statement.get.bind(statement);
      statement.get = (...args) => {
        const row = get(...args);
        writer.query("UPDATE sends SET status = 'sent', providerMessageId = 'provider' WHERE accountId = 'mailbox' AND id = 'send'").run();
        committed = true;
        return row;
      };
      return statement;
    });
    const matches: NewTrackingEvent[] = [];
    const suppressed: string[] = [];
    const deps: NonNullable<Parameters<typeof applySesEvent>[2]> = {
      db: async () => db, now: () => 1000,
      suppress: async (_accountId, target) => { if (target.contactId) suppressed.push(target.contactId); },
      record: async event => { matches.push(event); }
    };
    const bounce = { eventType: "Bounce", mail: { messageId: "provider", tags: { noctua_send_id: ["send"] } },
      bounce: { bounceType: "Permanent" } };
    await expect(applySesEvent("notification", bounce, deps)).rejects.toThrow();
    expect(committed).toBe(true);
    expect(matches).toEqual([]);
    await applySesEvent("notification", bounce, deps);
    expect(matches).toMatchObject([{ sendId: "send", contactId: "contact", type: "bounce" }]);
    expect(suppressed).toEqual(["contact"]);
  } finally {
    lookup.mockRestore();
    writer.close();
    db.close();
    rmSync(scratch, { recursive: true });
  }
});

test("unmatched SES events retry until seven days after their signed publication timestamp", async () => {
  const db = initOutreachSchema(new Database(":memory:"));
  const publishedAt = 1000;
  let now = publishedAt + 7 * 24 * 60 * 60_000 - 1;
  try {
    const deps: NonNullable<Parameters<typeof applySesEvent>[2]> = {
      db: async () => db, now: () => now,
      suppress: async () => { throw new Error("unmatched suppression"); },
      record: async () => { throw new Error("unmatched event"); }
    };
    const event = { eventType: "Complaint", mail: { messageId: "missing" }, complaint: {} };
    await expect(applySesEvent("notification", event, deps, publishedAt)).rejects.toThrow("SES receipt not found");
    now++;
    await expect(applySesEvent("notification", event, deps, publishedAt)).resolves.toBeUndefined();
  } finally {
    db.close();
  }
});
