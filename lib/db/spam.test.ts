import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { buildAccountSenderProfiles } from "../mail/spam/profileBuild";
import { ownAddresses, trustedFacts, trustedProfile } from "../mail/spam/testProfiles";
import { createCollabFixture } from "../testThreadCollabHarness";
import { initAccountSchema } from "./schema";
import { prepareAccountShardConnection, shardWriterGuardsInstalled } from "./shardFormat";

const spamColumns = ["spamVerdict", "spamConfidence", "spamReasons", "spamCheckedAt"];

describe("spam shard migration", () => {
  test("is additive on an existing v3 shard and installs the new table's writer guards", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "spam-shard-"));
    const file = path.join(dir, "acc.db");
    try {
      const legacy = new Database(file);
      prepareAccountShardConnection(legacy);
      initAccountSchema(legacy);
      legacy.exec(`INSERT INTO messages (id, accountId, folderId, threadId, subject, fromAddr, toAddr, preview, date, dateValue, body)
        VALUES ('legacy', 'synthetic', 'inbox', 'thread', 'Synthetic', 'a@example.test', 'b@example.test', '', '', 0, '')`);
      // Reproduce a shard written before this feature: no table, guards, index or columns.
      for (const { name } of legacy.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('spam_examples', 'spam_sender_profiles')").all() as Array<{ name: string }>) {
        legacy.exec(`DROP TRIGGER "${name}"`);
      }
      legacy.exec("DROP TABLE spam_examples; DROP TABLE spam_sender_profiles; DROP INDEX idx_messages_account_spam");
      for (const column of spamColumns) legacy.exec(`ALTER TABLE messages DROP COLUMN ${column}`);
      expect(shardWriterGuardsInstalled(legacy)).toBe(true);
      legacy.close();

      const db = new Database(file);
      prepareAccountShardConnection(db);
      initAccountSchema(db);
      const columns = (db.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string; notnull: number }>);
      for (const column of spamColumns) expect(columns.find((entry) => entry.name === column)?.notnull).toBe(0);
      expect(db.prepare("SELECT spamVerdict, spamCheckedAt FROM messages WHERE id = 'legacy'").get()).toEqual({ spamVerdict: null, spamCheckedAt: null });
      expect(db.prepare("PRAGMA user_version").get()).toEqual({ user_version: 3 });
      expect(shardWriterGuardsInstalled(db)).toBe(true);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='noctua_writer_v3_spam_examples_insert'").get()).toBeTruthy();
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='noctua_writer_v3_spam_sender_profiles_update'").get()).toBeTruthy();
      db.close();

      // A connection without the v3 writer function cannot write examples.
      const old = new Database(file);
      expect(() => old.prepare("INSERT INTO spam_examples (id, accountId, subject, snippet, label, source, createdAt) VALUES ('x','a','s','s','spam','t',0)"))
        .toThrow("no such function: noctua_writer_v3");
      expect(() => old.prepare("INSERT INTO spam_sender_profiles (accountId, senderKey, count, firstSeenAt, lastSeenAt, patterns, updatedAt) VALUES ('a','s',0,0,0,'{}',0)"))
        .toThrow("no such function: noctua_writer_v3");
      old.close();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("spam storage", () => {
  test("verdicts are hydrated, filtered by the suspicious badge, and never overwrite a user correction", async () => {
    const f = await createCollabFixture();
    const [suspicious, other] = await f.seed(f.message("<s@example.test>"), f.message("<o@example.test>"));
    expect(await f.api.saveSpamVerdict(f.accountId, suspicious.id, { verdict: "spam", confidence: 0.9, reasons: ["Phishing"] }, { automatic: true })).toBe(true);
    expect(await f.api.getMessageById(f.accountId, suspicious.id)).toMatchObject({ spamVerdict: "spam", spamConfidence: 0.9, spamReasons: ["Phishing"] });
    expect((await f.api.getMessageById(f.accountId, other.id))?.spamVerdict).toBeUndefined();
    const listed = await f.api.listMessages({ accountId: f.accountId, page: 1, pageSize: 10, badges: ["suspicious"] });
    expect(listed.items.map((item) => item.id)).toEqual([suspicious.id]);
    expect(listed.items[0].spamReasons).toEqual(["Phishing"]);
    // A user correction wins over a later automatic result.
    await f.api.saveSpamVerdict(f.accountId, other.id, { verdict: "ham", confidence: 1, reasons: [] });
    expect(await f.api.saveSpamVerdict(f.accountId, other.id, { verdict: "spam", confidence: 1, reasons: [] }, { automatic: true })).toBe(false);
    expect((await f.api.getMessageById(f.accountId, other.id))?.spamVerdict).toBe("ham");
    // Re-syncing the same message keeps the verdict.
    await f.seed({ ...suspicious, subject: "Updated" });
    expect((await f.api.getMessageById(f.accountId, suspicious.id))?.spamVerdict).toBe("spam");
    expect(await f.api.listUncheckedSpamMessages(f.accountId, f.folderId, 0, 10, 3)).toEqual([]);
  });

  test("unchecked messages are listed oldest first", async () => {
    const f = await createCollabFixture();
    const [newer, older] = await f.seed(f.message("<new@example.test>", { dateValue: 1767225600000 + 60_000 }),
      f.message("<old@example.test>", { dateValue: 1767225600000 }));
    expect(await f.api.listUncheckedSpamMessages(f.accountId, f.folderId, 0, 10, 3)).toEqual([{ id: older.id, failedAttempts: 0 }, { id: newer.id, failedAttempts: 0 }]);
  });

  test("failed attempts persist on the unchecked row until the limit; a verdict replaces them", async () => {
    const f = await createCollabFixture();
    const [first, second] = await f.seed(f.message("<a@example.test>"), f.message("<b@example.test>"));
    await f.api.recordSpamCheckFailure(f.accountId, first.id, 2);
    await f.api.recordSpamCheckFailure(f.accountId, second.id, 3);
    expect(await f.api.listUncheckedSpamMessages(f.accountId, f.folderId, 0, 10, 3)).toEqual([{ id: first.id, failedAttempts: 2 }]);
    expect((await f.api.getMessageById(f.accountId, first.id))?.spamVerdict).toBeUndefined();
    expect(await f.api.saveSpamVerdict(f.accountId, first.id, { verdict: "ham", confidence: 0.9, reasons: ["Rechnung"] }, { automatic: true })).toBe(true);
    await f.api.recordSpamCheckFailure(f.accountId, first.id, 3);
    expect(await f.api.getMessageById(f.accountId, first.id)).toMatchObject({ spamVerdict: "ham", spamReasons: ["Rechnung"] });
    expect(await f.api.listUncheckedSpamMessages(f.accountId, f.folderId, 0, 10, 4)).toEqual([{ id: second.id, failedAttempts: 3 }]);
  });

  test("examples: latest decision per sender and subject wins; candidates by sender, domain and recency", async () => {
    const f = await createCollabFixture();
    const base = { messageId: null, source: "mark-spam", decidedByUserId: null, snippet: "Synthetisch" };
    await f.api.saveSpamExample(f.accountId, { ...base, senderEmail: "a@shop.example", senderDomain: "shop.example", subject: "Angebot", label: "spam", createdAt: 1 });
    await f.api.saveSpamExample(f.accountId, { ...base, senderEmail: "a@shop.example", senderDomain: "shop.example", subject: "Angebot", label: "ham", createdAt: 2 });
    await f.api.saveSpamExample(f.accountId, { ...base, senderEmail: "b@shop.example", senderDomain: "shop.example", subject: "Andere", label: "spam", createdAt: 3 });
    expect(await f.api.getLatestSpamDecision(f.accountId, "a@shop.example")).toBe("ham");
    expect(await f.api.getLatestSpamDecision(f.accountId, "nobody@shop.example")).toBeNull();
    const candidates = await f.api.listSpamExampleCandidates(f.accountId, { senderEmail: "a@shop.example", senderDomain: "shop.example" });
    expect(candidates.map((entry) => [entry.senderEmail, entry.label]).sort()).toEqual([["a@shop.example", "ham"], ["b@shop.example", "spam"]]);
  });

  test("pruning keeps the newest examples and every sender's latest \"Kein Spam\"", async () => {
    const f = await createCollabFixture();
    const base = { messageId: null, decidedByUserId: null, snippet: "Synthetisch" };
    await f.api.saveSpamExample(f.accountId, { ...base, source: "not-spam", senderEmail: "kept@shop.example", senderDomain: "shop.example", subject: "Rechnung", label: "ham", createdAt: 1 });
    await f.api.saveSpamExample(f.accountId, { ...base, source: "not-spam", senderEmail: "flipped@shop.example", senderDomain: "shop.example", subject: "Alt", label: "ham", createdAt: 2 });
    await f.api.saveSpamExample(f.accountId, { ...base, source: "mark-spam", senderEmail: "flipped@shop.example", senderDomain: "shop.example", subject: "Neu", label: "spam", createdAt: 3 });
    const insert = f.db.prepare(`INSERT INTO spam_examples (id, accountId, messageId, senderEmail, senderDomain, subject, snippet, label, source, decidedByUserId, createdAt)
      VALUES (?, ?, NULL, ?, 'bulk.example', ?, 'Synthetisch', 'spam', 'mark-spam', NULL, ?)`);
    f.db.transaction(() => {
      for (let index = 0; index < 2000; index += 1) insert.run(crypto.randomUUID(), f.accountId, `s${index}@bulk.example`, `Werbung ${index}`, 10 + index);
    })();
    await f.api.saveSpamExample(f.accountId, { ...base, source: "mark-spam", senderEmail: "last@bulk.example", senderDomain: "bulk.example", subject: "Letzte", label: "spam", createdAt: 5_000 });
    const count = (f.db.prepare("SELECT COUNT(*) AS n FROM spam_examples WHERE accountId = ?").get(f.accountId) as { n: number }).n;
    expect(count).toBe(2001);
    expect(await f.api.getLatestSpamDecision(f.accountId, "kept@shop.example")).toBe("ham");
    // Older decisions of a sender whose latest one is "Als Spam" age out as before.
    expect(await f.api.getLatestSpamDecision(f.accountId, "flipped@shop.example")).toBeNull();
    expect(await f.api.getLatestSpamDecision(f.accountId, "s0@bulk.example")).toBeNull();
    expect(await f.api.getLatestSpamDecision(f.accountId, "s1@bulk.example")).toBe("spam");
  });

  test("correspondents match exact Sent recipients, never substrings", async () => {
    const f = await createCollabFixture();
    const sentFolderId = `${f.accountId}-sent`;
    await f.api.saveFoldersForAccount(f.accountId, [
      { id: f.folderId, accountId: f.accountId, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" },
      { id: sentFolderId, accountId: f.accountId, name: "Sent", count: 0, unreadCount: 0, specialUse: "\\Sent" }
    ]);
    await f.api.upsertMessages(f.accountId, sentFolderId, [f.message("<sent@example.test>", { folderId: sentFolderId,
      to: "\"Partner\" <partner@example.test>", cc: "jimbob@example.test" })]);
    expect(await f.api.hasSentToAddress(f.accountId, sentFolderId, "partner@example.test")).toBe(true);
    expect(await f.api.hasSentToAddress(f.accountId, sentFolderId, "bob@example.test")).toBe(false);
    expect(await f.api.hasSentToAddress(f.accountId, f.folderId, "partner@example.test")).toBe(false);
  });

  test("a short address is found behind many substring candidates", async () => {
    const f = await createCollabFixture();
    const sentFolderId = `${f.accountId}-sent`;
    await f.api.saveFoldersForAccount(f.accountId, [
      { id: f.folderId, accountId: f.accountId, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" },
      { id: sentFolderId, accountId: f.accountId, name: "Sent", count: 0, unreadCount: 0, specialUse: "\\Sent" }
    ]);
    const decoys = Array.from({ length: 40 }, (_, index) => f.message(`<decoy${index}@example.test>`, { folderId: sentFolderId, to: `user${index}a@example.test` }));
    await f.api.upsertMessages(f.accountId, sentFolderId, [...decoys, f.message("<exact@example.test>", { folderId: sentFolderId, to: "A@example.test" })]);
    expect(await f.api.hasSentToAddress(f.accountId, sentFolderId, "a@example.test")).toBe(true);
    expect(await f.api.hasSentToAddress(f.accountId, sentFolderId, "b@example.test")).toBe(false);
  });

  test("settings round-trip in the master database", async () => {
    const { getSpamSettings, saveSpamSettings } = await (await import("../testDbHarness")).dbModulePromise;
    const scope = `spam-${crypto.randomUUID()}`;
    expect(await getSpamSettings(scope)).toBeNull();
    await saveSpamSettings(scope, { autoMove: true }, "admin");
    await saveSpamSettings(scope, { autoMove: false, threshold: 0.9 }, "admin");
    expect(await getSpamSettings(scope)).toEqual({ autoMove: false, threshold: 0.9 });
  });
});

describe("sender profiles", () => {
  const sender = "notify@service.example.test";

  test("checked mails fold into the profile; \"Als Spam\" marks existing and unknown senders", async () => {
    const f = await createCollabFixture();
    expect(await f.api.getSenderProfile(f.accountId, sender)).toBeNull();
    await f.api.recordSenderProfileMail(f.accountId, trustedFacts({ date: 1_000 }), "m1");
    await f.api.recordSenderProfileMail(f.accountId, trustedFacts({ date: 2_000 }), "m2");
    expect(await f.api.getSenderProfile(f.accountId, sender)).toMatchObject({ count: 2, firstSeenAt: 1_000, lastSeenAt: 2_000, authAligned: 2, lastUserSpamAt: null });
    await f.api.markSenderProfileUserSpam(f.accountId, sender, 5_000);
    await f.api.markSenderProfileUserSpam(f.accountId, sender, 4_000);
    expect(await f.api.getSenderProfile(f.accountId, sender)).toMatchObject({ count: 2, lastUserSpamAt: 5_000 });
    await f.api.markSenderProfileUserSpam(f.accountId, "new@example.test", 6_000);
    expect(await f.api.getSenderProfile(f.accountId, "new@example.test")).toMatchObject({ count: 0, lastUserSpamAt: 6_000 });
  });

  test("a mail counts into the profile once, also when it is checked again after a revocation", async () => {
    const f = await createCollabFixture();
    expect(await f.api.recordSenderProfileMail(f.accountId, trustedFacts({ date: 1_000 }), "m1")).toBe(true);
    expect(await f.api.recordSenderProfileMail(f.accountId, trustedFacts({ date: 2_000 }), "m2")).toBe(true);
    expect(await f.api.recordSenderProfileMail(f.accountId, trustedFacts({ date: 1_000 }), "m1")).toBe(false);
    expect(await f.api.getSenderProfile(f.accountId, sender)).toMatchObject({ count: 2, lastSeenAt: 2_000 });
  });

  test("junk counts live: \"Als Spam\" and auto-move count each mail once; auto-move creates no profile", async () => {
    const f = await createCollabFixture();
    expect(await f.api.recordSenderProfileJunk(f.accountId, sender, "j1")).toBe(false);
    expect(await f.api.getSenderProfile(f.accountId, sender)).toBeNull();
    await f.api.recordSenderProfileMail(f.accountId, trustedFacts({ date: 1_000 }), "m1");
    expect(await f.api.recordSenderProfileJunk(f.accountId, sender, "j1")).toBe(true);
    expect(await f.api.recordSenderProfileJunk(f.accountId, sender, "j1")).toBe(false);
    await f.api.markSenderProfileUserSpam(f.accountId, sender, 5_000, "j2");
    await f.api.markSenderProfileUserSpam(f.accountId, sender, 6_000, "j2");
    expect(await f.api.getSenderProfile(f.accountId, sender)).toMatchObject({ count: 1, junkCount: 2, lastUserSpamAt: 6_000 });
    await f.api.markSenderProfileUserSpam(f.accountId, "new@example.test", 7_000, "j3");
    expect(await f.api.getSenderProfile(f.accountId, "new@example.test")).toMatchObject({ count: 0, junkCount: 1, lastUserSpamAt: 7_000 });
  });

  test("the backfill catches up with mail stored while it builds and keeps junk counted live meanwhile", async () => {
    const f = await createCollabFixture();
    const from = `Service <${sender}>`;
    const day = 24 * 60 * 60_000;
    await f.seed(...[1, 2, 3].map((index) => f.message(`<b${index}@example.test>`, { from, dateValue: Date.UTC(2026, 5, index) })));
    const folders = await f.api.getFolders(f.accountId);
    const late = f.message("<late@example.test>", { from, dateValue: Date.UTC(2026, 5, 4) });
    let builds = 0;
    const { written, build } = await f.api.backfillSenderProfiles(f.accountId, async (db, previous) => {
      builds += 1;
      const built = await buildAccountSenderProfiles({ accountId: f.accountId, db, folders, ownAddresses, previous: previous ?? undefined });
      if (!previous) {
        // Meanwhile a mail arrives and is learned live, and another one is auto-moved to Junk.
        await f.seed(late);
        await f.api.recordSenderProfileMail(f.accountId, trustedFacts({ date: Date.UTC(2026, 5, 4) }), late.id);
        await f.api.recordSenderProfileJunk(f.accountId, sender, "junk-live");
      }
      return built;
    });
    expect({ builds, written, rows: build.rows }).toEqual({ builds: 2, written: 1, rows: 4 });
    expect(await f.api.getSenderProfile(f.accountId, sender)).toMatchObject({ count: 4, junkCount: 1, lastSeenAt: Date.UTC(2026, 5, 4) });
    // The caught-up mail is not counted again when its check arrives later.
    expect(await f.api.recordSenderProfileMail(f.accountId, trustedFacts({ date: Date.UTC(2026, 5, 4) + day }), late.id)).toBe(false);
  });

  test("the backfill replaces profiles and keeps stored \"Als Spam\" times", async () => {
    const f = await createCollabFixture();
    await f.api.markSenderProfileUserSpam(f.accountId, sender, 5_000);
    await f.api.markSenderProfileUserSpam(f.accountId, "gone@example.test", 6_000);
    await f.api.recordSenderProfileMail(f.accountId, { ...trustedFacts(), senderKey: "stale@example.test" }, "m1");
    expect(await f.api.replaceSenderProfiles(f.accountId, [trustedProfile(25, 60)])).toBe(1);
    expect(await f.api.getSenderProfile(f.accountId, sender)).toMatchObject({ count: 25, lastUserSpamAt: 5_000 });
    expect(await f.api.getSenderProfile(f.accountId, "gone@example.test")).toMatchObject({ count: 0, lastUserSpamAt: 6_000 });
    expect(await f.api.getSenderProfile(f.accountId, "stale@example.test")).toBeNull();
  });

  test("revocation resets only the sender's recent trusted skips; counters come from stored verdicts", async () => {
    const f = await createCollabFixture();
    const day = 24 * 60 * 60_000;
    const now = 1767225600000 + 30 * day;
    const from = `Service <${sender}>`;
    const [skipped, modelChecked, old, other, canary, canaryMismatch] = await f.seed(
      f.message("<a@example.test>", { from, dateValue: now - day }),
      f.message("<b@example.test>", { from, dateValue: now - day }),
      f.message("<c@example.test>", { from, dateValue: now - 10 * day }),
      f.message("<d@example.test>", { from: "other@example.test", dateValue: now - day }),
      f.message("<e@example.test>", { from, dateValue: now - 2 * day }),
      f.message("<f@example.test>", { from, dateValue: now - 2 * day }));
    const trusted = { verdict: "ham" as const, confidence: 1, reasons: ["trusted:profile (25 Mails seit 2026-03, DKIM service.example.test)"] };
    for (const message of [skipped, other]) await f.api.saveSpamVerdict(f.accountId, message.id, trusted, { checkedAt: now - day });
    await f.api.saveSpamVerdict(f.accountId, old.id, trusted, { checkedAt: now - 10 * day });
    await f.api.saveSpamVerdict(f.accountId, modelChecked.id, { verdict: "ham", confidence: 0.9, reasons: ["Benachrichtigung"] });
    await f.api.saveSpamVerdict(f.accountId, canary.id, { verdict: "ham", confidence: 0.9, reasons: ["trusted:canary (Stichprobe, 25 Mails seit 2026-03)"] });
    await f.api.saveSpamVerdict(f.accountId, canaryMismatch.id, { verdict: "unsure", confidence: 0.7, reasons: ["trusted:canary (Stichprobe, 25 Mails seit 2026-03)", "Link"] });
    expect(await f.api.countSpamTrustDecisions(f.accountId)).toEqual({ trustedSkips: 3, canaryChecks: 2, canaryMismatches: 1 });

    expect(await f.api.resetTrustedSpamChecks(f.accountId, f.folderId, sender, now - 7 * day)).toEqual([skipped.id]);
    expect((await f.api.getMessageById(f.accountId, skipped.id))?.spamVerdict).toBeUndefined();
    expect((await f.api.getMessageById(f.accountId, modelChecked.id))?.spamVerdict).toBe("ham");
    expect((await f.api.getMessageById(f.accountId, old.id))?.spamVerdict).toBe("ham");
    expect(await f.api.countSpamTrustDecisions(f.accountId)).toEqual({ trustedSkips: 2, canaryChecks: 2, canaryMismatches: 1 });

    // Same sender in another spelling: legacy row without fromEmail, upper case, comment instead of brackets, IDN domain.
    const idnSender = "info@xn--bcher-kva.example.test";
    const [legacy, idn, backdated] = await f.seed(
      f.message("<g@example.test>", { from: "NOTIFY@Service.Example.Test (Service)", dateValue: now - day }),
      f.message("<h@example.test>", { from: "Bücher <Info@Bücher.example.test>", dateValue: now - day }),
      f.message("<i@example.test>", { from, dateValue: now - 400 * day }));
    f.db.prepare("UPDATE messages SET fromEmail = NULL WHERE id = ?").run(legacy.id);
    for (const message of [legacy, idn, backdated]) await f.api.saveSpamVerdict(f.accountId, message.id, trusted, { checkedAt: now - day });
    expect((await f.api.resetTrustedSpamChecks(f.accountId, f.folderId, sender, now - 7 * day)).sort()).toEqual([legacy.id, backdated.id].sort());
    expect(await f.api.resetTrustedSpamChecks(f.accountId, f.folderId, idnSender, now - 7 * day)).toEqual([idn.id]);

    // Burst candidates: the sender's rows stored closest to the mail, whatever their Date header says.
    const near = await f.api.listSenderMailsNear(f.accountId, f.folderId, sender, skipped.id, 2);
    expect(near.map((row) => row.id)).toEqual([modelChecked.id, old.id]);
    expect(near[0]).toMatchObject({ dateValue: now - day, spamCheckedAt: expect.any(Number), hasSource: 0 });
    expect((await f.api.listSenderMailsNear(f.accountId, f.folderId, sender, skipped.id, 20)).map((row) => row.id))
      .toEqual([modelChecked.id, old.id, canary.id, canaryMismatch.id, legacy.id, backdated.id]);
  });
});
