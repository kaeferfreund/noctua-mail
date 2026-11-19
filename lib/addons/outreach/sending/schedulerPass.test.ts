import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { defaultOutreachSettings } from "../settings";
import { assertClaim, claimSend, enroll, expandCampaign } from "./queue";
import { OutreachScheduler } from "./scheduler";
import { SendStopped } from "./send";
import { createQueueFixture, fixtureAccountId as accountId, fixtureListId as listId, fixtureStart as start } from "./queueTestFixture";

const configurationReasons = [
  "outreach_disabled", "transport_unavailable", "unsubscribe_unavailable", "identity_unavailable", "permission_revoked", "configuration_changed"
];

for (const reason of configurationReasons) {
  test(`a deferred ${reason} spends no attempt, keeps the enrollment and stops the mailbox's pass`, async () => {
    const db = new Database(":memory:");
    try {
      const f = createQueueFixture(db);
      f.sequence([{ subject: "A", text: "Eins", delayMinutes: 1 }, { subject: "B", text: "Zwei", delayMinutes: 1 }]);
      for (const contactId of ["first", "second", "third"]) {
        f.addContact(contactId);
        enroll(db, accountId, { listId, contactId, at: start });
      }
      const sent = f.deps.send;
      let calls = 0;
      f.deps.send = async () => {
        calls += 1;
        return { status: "deferred", reason };
      };
      const scheduler = new OutreachScheduler(f.deps);
      f.time(start + 60_000);
      await scheduler.tick();
      expect(calls).toBe(1);
      f.time(start + 120_000);
      await scheduler.tick();
      expect(calls).toBe(2);
      expect(f.sends().map(row => ({ status: row.status, attempts: row.attempts })))
        .toEqual(Array.from({ length: 3 }, () => ({ status: "queued", attempts: 0 })));
      for (const contactId of ["first", "second", "third"]) {
        expect(f.enrollment(contactId)).toMatchObject({ status: "active", nextStepPosition: 0 });
      }

      // Once the configuration is repaired, the same rows go out on a later pass and the sequence moves on.
      f.deps.send = sent;
      f.time(start + 180_000);
      await scheduler.tick();
      expect(f.sent()).toEqual(["A", "A", "A"]);
      expect(f.enrollment("first")).toMatchObject({ status: "active", nextStepPosition: 1 });
    } finally {
      db.close();
    }
  });
}

test("a deferred configuration outcome leaves a campaign row queued and the campaign sending", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    f.addContact("first");
    f.addContact("second");
    const campaign = f.campaign();
    f.deps.send = async () => ({ status: "deferred", reason: "transport_unavailable" });
    await new OutreachScheduler(f.deps).tick();
    expect(f.sends().map(row => [row.status, row.attempts])).toEqual([["queued", 0], ["queued", 0]]);
    expect(db.query("SELECT status FROM campaigns WHERE accountId = ? AND id = ?").get(accountId, campaign.id)).toEqual({ status: "sending" });
  } finally {
    db.close();
  }
});

test("a deferral for a paused or rescheduled step does not stop the mailbox's pass", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    f.addContact("first");
    f.addContact("second");
    f.campaign();
    const send = f.deps.send;
    let first = true;
    f.deps.send = async input => {
      if (first) {
        first = false;
        return { status: "deferred", reason: "rescheduled" };
      }
      return send(input);
    };
    await new OutreachScheduler(f.deps).tick();
    expect(f.mails).toHaveLength(2);
  } finally {
    db.close();
  }
});

test("disabling the mailbox during a claim defers the send instead of cancelling it", () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    f.addContact("first");
    const campaign = f.campaign();
    expandCampaign(db, campaign, f.recipients.get(accountId)!, start);
    const row = claimSend(db, accountId, "owner", start)!;
    db.query("UPDATE account_settings SET enabled = 0 WHERE accountId = ?").run(accountId);
    const settings = { ...defaultOutreachSettings(accountId), enabled: true, updatedAt: 0 };
    expect(() => assertClaim(db, row, settings, start)).toThrow(new SendStopped("configuration_changed"));
  } finally {
    db.close();
  }
});

test("one mailbox's claim loop has a wall-clock budget so other mailboxes and retention run in the same pass", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db, { accountIds: ["busy", "quiet"], sendRatePerMinute: 600 });
    for (let index = 0; index < 20; index += 1) f.addContact(`busy${index}`, "busy");
    f.addContact("quiet0", "quiet");
    f.campaign("busy");
    f.campaign("quiet");
    const send = f.deps.send;
    // A slow transport: every send takes 5 seconds.
    f.deps.send = async input => {
      f.time(f.now() + 5_000);
      return send(input);
    };
    let retention = 0;
    f.deps.retention = async () => { retention += 1; return 0; };
    await new OutreachScheduler(f.deps).tick();
    const busy = f.mails.filter(mail => mail.accountId === "busy").length;
    expect(busy).toBeGreaterThan(0);
    expect(busy).toBeLessThan(20);
    expect(f.mails.filter(mail => mail.accountId === "quiet")).toHaveLength(1);
    expect(retention).toBe(1);
  } finally {
    db.close();
  }
});

test("one mailbox's claim loop has a count budget per pass", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db, { sendRatePerMinute: 600 });
    for (let index = 0; index < 200; index += 1) f.addContact(`c${index}`);
    f.campaign();
    await new OutreachScheduler(f.deps).tick();
    expect(f.mails.length).toBeGreaterThan(0);
    expect(f.mails.length).toBeLessThan(200);
  } finally {
    db.close();
  }
});

test("a failing campaign expansion does not stop the mailbox's other campaigns, sequences and sends", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    f.addContact("first");
    f.sequence([{ subject: "Willkommen", text: "Hallo", delayMinutes: 0 }]);
    enroll(db, accountId, { listId, contactId: "first", at: start });
    const broken = f.campaign(accountId, "Kaputt");
    const working = f.campaign(accountId, "Läuft");
    // Ordered first by sendAt and id; make the broken one come first.
    db.query("UPDATE campaigns SET sendAt = ?, listIds = 'not json' WHERE accountId = ? AND id = ?").run(start - 1, accountId, broken.id);
    const warn = console.warn;
    console.warn = () => {};
    try {
      await new OutreachScheduler(f.deps).tick();
    } finally {
      console.warn = warn;
    }
    expect(f.sent().sort()).toEqual(["Läuft", "Willkommen"]);
    expect(db.query("SELECT status FROM campaigns WHERE accountId = ? AND id = ?").get(accountId, working.id)).toEqual({ status: "sent" });
    expect(db.query("SELECT status FROM campaigns WHERE accountId = ? AND id = ?").get(accountId, broken.id)).toEqual({ status: "scheduled" });
  } finally {
    db.close();
  }
});

test("a throwing recipient lookup of one campaign does not stop the next campaign", async () => {
  const db = new Database(":memory:");
  try {
    const f = createQueueFixture(db);
    f.addContact("first");
    const broken = f.campaign(accountId, "Kaputt");
    f.campaign(accountId, "Läuft");
    db.query("UPDATE campaigns SET sendAt = ? WHERE accountId = ? AND id = ?").run(start - 1, accountId, broken.id);
    const recipients = f.deps.recipients;
    f.deps.recipients = async (account, campaign) => {
      if (campaign.id === broken.id) throw new Error("lookup failed");
      return recipients(account, campaign);
    };
    const warn = console.warn;
    console.warn = () => {};
    try {
      await new OutreachScheduler(f.deps).tick();
    } finally {
      console.warn = warn;
    }
    expect(f.sent()).toEqual(["Läuft"]);
  } finally {
    db.close();
  }
});
