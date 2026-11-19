import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initOutreachSchema } from "../db";
import type { SendableRecipient } from "../contacts";
import { defaultOutreachSettings } from "../settings";
import { OutreachScheduler } from "./scheduler";
import { cancelContact, claimSend, enroll, expandCampaign, expandSequences, settleSend } from "./queue";
import { SendStopped } from "./send";
import { saveCampaign, saveSequence } from "./store";

const accountId = "account";
const listId = "list";
const actor = "editor";
const start = 1_000_000;

function createFixture(db: Database, sendRatePerMinute = 30) {
  initOutreachSchema(db);
  const settings = { ...defaultOutreachSettings(accountId), enabled: true, updatedAt: 0, sendRatePerMinute };
  db.query("INSERT INTO account_settings (accountId, enabled, sendRatePerMinute, updatedAt) VALUES (?, 1, ?, 0)").run(accountId, sendRatePerMinute);
  db.query("INSERT INTO lists (accountId, id, name, createdAt, updatedAt) VALUES (?, ?, 'Liste', 0, 0)").run(accountId, listId);
  let now = start;
  const recipients: SendableRecipient[] = [];
  const mails: string[] = [];
  function addContact(contactId: string) {
    const email = `${contactId}@example.test`;
    db.query(`INSERT INTO contacts (accountId, id, email, emailLower, emailConsent, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'subscribed', 0, 0)`).run(accountId, contactId, email, email);
    db.query("INSERT INTO list_members (accountId, listId, contactId, status) VALUES (?, ?, ?, 'subscribed')").run(accountId, listId, contactId);
    recipients.push({ contactId, email, firstName: "", lastName: "", properties: {} });
  }
  function campaign() {
    const draft = saveCampaign(db, accountId, actor, { name: "Kampagne", subject: "Betreff", html: "<p>Mail</p>", listIds: [listId] });
    db.query("UPDATE campaigns SET status = 'scheduled', sendAt = ?, scheduledByUserId = ? WHERE accountId = ? AND id = ?")
      .run(now, actor, accountId, draft.id);
    return draft;
  }
  function sequence() {
    const draft = saveSequence(db, accountId, { name: "Sequenz", triggerListId: listId, steps: [
      { delayMinutes: 1, subject: "Eins", text: "Willkommen" },
      { delayMinutes: 10, subject: "Aus", enabled: false },
      { delayMinutes: 2, subject: "Zwei", text: "Hallo" }
    ] });
    setStatus(draft.id, "live");
    return draft;
  }
  function setStatus(id: string, status: "live" | "paused") {
    db.query("UPDATE sequences SET status = ?, statusChangedByUserId = ? WHERE accountId = ? AND id = ?").run(status, actor, accountId, id);
  }
  const deps: NonNullable<ConstructorParameters<typeof OutreachScheduler>[0]> = {
    db: async () => db, now: () => now, recipients: async () => recipients, settings: async () => settings, retention: async () => 0,
    send: async input => {
      try { input.assertClaim(); }
      catch (error) {
        if (error instanceof SendStopped) return { status: "skipped", reason: error.reason };
        throw error;
      }
      mails.push(input.sendId);
      return { status: "sent", providerMessageId: "test-provider", messageId: "<test@example.test>", sentAt: now,
        recipients: "alex@example.test", subject: input.content.subject };
    }
  };
  return { db, deps, campaign, sequence, addContact, recipients, mails, setStatus,
    time: (at: number) => { now = at; },
    sends: () => db.query("SELECT * FROM sends WHERE accountId = ? ORDER BY queuedAt, id").all(accountId),
    enrollment: (contactId: string) => db.query("SELECT * FROM sequence_enrollments WHERE accountId = ? AND contactId = ?").get(accountId, contactId)
  };
}

test("two schedulers on separate SQLite handles fan out once and share a durable mailbox throttle", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "outreach-scheduler-"));
  const path = join(scratch, "test.db");
  const db = new Database(path);
  const other = new Database(path);
  try {
    const f = createFixture(db, 1);
    f.addContact("first");
    f.addContact("second");
    const campaign = f.campaign();
    const a = new OutreachScheduler(f.deps);
    const b = new OutreachScheduler({ ...f.deps, db: async () => other });
    await Promise.all([a.tick(), b.tick()]);
    expect(f.sends()).toHaveLength(2);
    expect(f.mails).toHaveLength(1);
    f.time(start + 59_999);
    await b.tick();
    expect(f.mails).toHaveLength(1);
    f.time(start + 60_000);
    await Promise.all([a.tick(), b.tick()]);
    expect(new Set(f.mails).size).toBe(2);
    expect(f.mails).toHaveLength(2);
    expect(db.query("SELECT status FROM campaigns WHERE accountId = ? AND id = ?").get(accountId, campaign.id)).toEqual({ status: "sent" });
  } finally {
    db.close();
    other.close();
    rmSync(scratch, { recursive: true });
  }
});

test("durable retry uses the scheduled-send delays and uncertain results are terminal", async () => {
  const db = new Database(":memory:");
  try {
    const f = createFixture(db);
    f.addContact("first");
    const campaign = f.campaign();
    f.deps.send = async () => ({ status: "retry", reason: "smtp_before_data" });
    const scheduler = new OutreachScheduler(f.deps);
    await scheduler.tick();
    expect(f.sends()[0]).toMatchObject({ status: "queued", attempts: 1, sendAt: start + 60_000 });
    f.time(start + 60_000);
    await scheduler.tick();
    expect(f.sends()[0]).toMatchObject({ status: "queued", attempts: 2, sendAt: start + 360_000 });
    f.time(start + 360_000);
    f.deps.send = async () => ({ status: "failed", reason: "send_uncertain" });
    await scheduler.tick();
    f.time(start + 10_000_000);
    await scheduler.tick();
    expect(f.sends()[0]).toMatchObject({ status: "failed", error: "send_uncertain", attempts: 3 });
    expect(db.query("SELECT status FROM campaigns WHERE accountId = ? AND id = ?").get(accountId, campaign.id)).toEqual({ status: "failed" });
  } finally {
    db.close();
  }
});

test("a claimed row of a dead owner is marked interrupted and never attempted again", async () => {
  const db = new Database(":memory:");
  try {
    const f = createFixture(db);
    f.addContact("first");
    const campaign = f.campaign();
    expandCampaign(db, campaign, f.recipients, start);
    expect(claimSend(db, accountId, "dead-owner", start)).not.toBeNull();
    await new OutreachScheduler(f.deps).tick();
    expect(f.sends()[0]).toMatchObject({ status: "failed", error: "interrupted", attempts: 1 });
    expect(f.mails).toHaveLength(0);
  } finally {
    db.close();
  }
});

test("sequence enrolls once, waits from accepted send time, resumes overdue and cancels pending mail", async () => {
  const db = new Database(":memory:");
  try {
    const f = createFixture(db);
    const sequence = f.sequence();
    f.addContact("first");
    const event = { listId, contactId: "first", at: start };
    enroll(db, accountId, event);
    enroll(db, accountId, event);
    expect(db.query("SELECT COUNT(*) AS count FROM sequence_enrollments WHERE accountId = ?").get(accountId)).toEqual({ count: 1 });
    expect(f.enrollment("first")).toMatchObject({ status: "active", nextSendAt: start + 60_000 });
    const scheduler = new OutreachScheduler(f.deps);
    await scheduler.tick();
    expect(f.mails).toHaveLength(0);
    f.setStatus(sequence.id, "paused");
    f.time(start + 80_000);
    await scheduler.tick();
    expect(f.mails).toHaveLength(0);
    f.setStatus(sequence.id, "live");
    await scheduler.tick();
    expect(f.mails).toHaveLength(1);
    expect(f.enrollment("first")).toMatchObject({ nextStepPosition: 2, nextSendAt: start + 200_000 });
    f.time(start + 199_999);
    await scheduler.tick();
    expect(f.mails).toHaveLength(1);
    f.time(start + 200_000);
    await scheduler.tick();
    expect(f.mails).toHaveLength(2);
    expect(f.enrollment("first")).toMatchObject({ status: "completed", nextSendAt: null });

    f.addContact("second");
    enroll(db, accountId, { listId, contactId: "second", at: start });
    expandSequences(db, accountId, start + 200_000);
    cancelContact(db, accountId, "second", start + 200_000);
    await scheduler.tick();
    expect(f.enrollment("second")).toMatchObject({ status: "cancelled" });
    expect(f.sends().find(send => send.contactId === "second")).toMatchObject({ status: "skipped", error: "recipient_unmailable" });
    expect(f.mails).toHaveLength(2);
  } finally {
    db.close();
  }
});

test("revalidates an archived campaign exclusion added after fan-out", async () => {
  const db = new Database(":memory:");
  try {
    const f = createFixture(db);
    f.addContact("first");
    const campaign = f.campaign();
    db.query(`INSERT INTO lists (accountId, id, name, createdAt, updatedAt) VALUES (?, 'excluded', 'Ausschluss', 0, 0)`).run(accountId);
    db.query("UPDATE campaigns SET excludedListIds = ? WHERE accountId = ? AND id = ?")
      .run(JSON.stringify(["excluded"]), accountId, campaign.id);
    expandCampaign(db, campaign, f.recipients, start);
    db.query("INSERT INTO list_members (accountId, listId, contactId, status) VALUES (?, 'excluded', 'first', 'subscribed')").run(accountId);
    db.query("UPDATE lists SET archivedAt = ? WHERE accountId = ? AND id = 'excluded'").run(start, accountId);
    await new OutreachScheduler(f.deps).tick();
    expect(f.sends()[0]).toMatchObject({ status: "skipped", error: "recipient_unmailable" });
    expect(f.mails).toHaveLength(0);
  } finally {
    db.close();
  }
});

test("campaign fan-out drops deleted contacts and reads the current address for surviving contacts", async () => {
  const scratch = mkdtempSync(join(tmpdir(), "outreach-fanout-"));
  const path = join(scratch, "test.db");
  const db = new Database(path);
  const writer = new Database(path);
  try {
    const f = createFixture(db);
    f.addContact("gone");
    f.addContact("changed");
    f.campaign();
    f.deps.recipients = async () => {
      writer.query("DELETE FROM contacts WHERE accountId = ? AND id = 'gone'").run(accountId);
      writer.query("UPDATE contacts SET email = 'new@example.test' WHERE accountId = ? AND id = 'changed'").run(accountId);
      return f.recipients;
    };
    f.deps.send = async () => ({ status: "retry", reason: "smtp_before_data" });
    await new OutreachScheduler(f.deps).tick();
    expect(f.sends().map(({ contactId, recipients }) => ({ contactId, recipients })))
      .toEqual([{ contactId: "changed", recipients: "new@example.test" }]);
  } finally {
    writer.close();
    db.close();
    rmSync(scratch, { recursive: true });
  }
});

test("sequence delay edits reschedule pending steps and preserve a later retry back-off", async () => {
  const db = new Database(":memory:");
  try {
    const f = createFixture(db);
    const sequence = f.sequence();
    for (const [contactId, at] of [["pending", start], ["retry", start], ["waiting", start + 60_000]] as const) {
      f.addContact(contactId);
      enroll(db, accountId, { listId, contactId, at });
    }
    expandSequences(db, accountId, start + 60_000);
    db.query("UPDATE sends SET attempts = 1, sendAt = ? WHERE accountId = ? AND contactId = 'retry'")
      .run(start + 600_000, accountId);
    saveSequence(db, accountId, { steps: sequence.steps.map((step, index) => ({ ...step, delayMinutes: index ? step.delayMinutes : 4 })) },
      { id: sequence.id });
    expect(f.enrollment("waiting")).toMatchObject({ nextSendAt: start + 300_000 });
    expect(f.enrollment("pending")).toMatchObject({ nextSendAt: start + 240_000 });
    expect(f.sends().find(send => send.contactId === "pending")).toMatchObject({ sendAt: start + 240_000 });
    expect(f.sends().find(send => send.contactId === "retry")).toMatchObject({ sendAt: start + 600_000 });

    const changeDelay = (delayMinutes: number) => saveSequence(db, accountId, {
      steps: sequence.steps.map((step, index) => index === 0 ? { ...step, delayMinutes } : step)
    }, { id: sequence.id });
    changeDelay(20);
    expect(claimSend(db, accountId, "owner", start + 600_000)).toBeNull();
    changeDelay(1);
    const first = claimSend(db, accountId, "owner", start + 600_000)!;
    settleSend(db, first, { status: "skipped", reason: "cancelled" }, start + 600_000);
    expect(claimSend(db, accountId, "owner", start + 600_000)).toMatchObject({ contactId: "retry" });
  } finally {
    db.close();
  }
});

test("sequence attempts use live tracking choices and refuse MIME prepared before a tracking edit", async () => {
  const db = new Database(":memory:");
  try {
    const f = createFixture(db);
    const sequence = f.sequence();
    f.addContact("first");
    enroll(db, accountId, { listId, contactId: "first", at: start });
    expandSequences(db, accountId, start + 60_000);
    saveSequence(db, accountId, { trackOpens: false, trackClicks: false }, { id: sequence.id });
    f.time(start + 60_000);
    const choices: boolean[][] = [];
    const blocks: unknown[] = [];
    f.deps.send = async input => {
      choices.push([input.trackOpens, input.trackClicks]);
      saveSequence(db, accountId, { trackOpens: true, trackClicks: true }, { id: sequence.id });
      try { input.assertClaim(); } catch (error) { blocks.push(error); }
      return { status: "retry", reason: "configuration_changed" };
    };
    await new OutreachScheduler(f.deps).tick();
    expect(choices).toEqual([[false, false]]);
    expect(blocks).toEqual([new SendStopped("configuration_changed")]);
  } finally {
    db.close();
  }
});

test("a delay edit during a claim defers the step to its new due date without spending an attempt", async () => {
  const db = new Database(":memory:");
  try {
    const f = createFixture(db);
    const sequence = f.sequence();
    f.addContact("first");
    enroll(db, accountId, { listId, contactId: "first", at: start });
    f.time(start + 60_000);
    const { settings } = f.deps;
    f.deps.settings = async account => {
      saveSequence(db, account, { steps: sequence.steps.map((step, index) => index === 0 ? { ...step, delayMinutes: 10 } : step) },
        { id: sequence.id });
      return settings(account);
    };
    f.deps.send = async input => {
      expect(() => input.assertClaim()).toThrow(new SendStopped("rescheduled"));
      return { status: "deferred", reason: "rescheduled" };
    };
    await new OutreachScheduler(f.deps).tick();
    expect(f.sends()[0]).toMatchObject({ status: "queued", sendAt: start + 600_000, attempts: 0 });
  } finally {
    db.close();
  }
});
