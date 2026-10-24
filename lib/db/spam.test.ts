import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
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
      for (const { name } of legacy.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='spam_examples'").all() as Array<{ name: string }>) {
        legacy.exec(`DROP TRIGGER "${name}"`);
      }
      legacy.exec("DROP TABLE spam_examples; DROP INDEX idx_messages_account_spam");
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
      db.close();

      // A connection without the v3 writer function cannot write examples.
      const old = new Database(file);
      expect(() => old.prepare("INSERT INTO spam_examples (id, accountId, subject, snippet, label, source, createdAt) VALUES ('x','a','s','s','spam','t',0)"))
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
    expect(await f.api.listUncheckedSpamMessageIds(f.accountId, f.folderId, 0, 10)).toEqual([]);
  });

  test("unchecked messages are listed oldest first", async () => {
    const f = await createCollabFixture();
    const [newer, older] = await f.seed(f.message("<new@example.test>", { dateValue: 1767225600000 + 60_000 }),
      f.message("<old@example.test>", { dateValue: 1767225600000 }));
    expect(await f.api.listUncheckedSpamMessageIds(f.accountId, f.folderId, 0, 10)).toEqual([older.id, newer.id]);
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

  test("settings round-trip in the master database", async () => {
    const { getSpamSettings, saveSpamSettings } = await (await import("../testDbHarness")).dbModulePromise;
    const scope = `spam-${crypto.randomUUID()}`;
    expect(await getSpamSettings(scope)).toBeNull();
    await saveSpamSettings(scope, { autoMove: true }, "admin");
    await saveSpamSettings(scope, { autoMove: false, threshold: 0.9 }, "admin");
    expect(await getSpamSettings(scope)).toEqual({ autoMove: false, threshold: 0.9 });
  });
});
