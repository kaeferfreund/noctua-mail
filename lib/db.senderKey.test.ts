import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createCollabFixture } from "./testThreadCollabHarness";
import { initAccountSchema } from "./db/schema";
import { saveMessageSource } from "./storage";
import { ingestSenderPermissionMessage, ingestedSenderCases } from "./testFixtures/ingestedSenders";
import { legacyUnkeyedSenders } from "./testFixtures/senderPermissions";

test("senderKey migration is additive, nullable and leaves the v2 writer guard/version intact", () => {
  const db = new Database(":memory:") as Database & { function(name: string, callback: () => number): void };
  try {
    initAccountSchema(db);
    db.exec(`INSERT INTO messages (id, accountId, folderId, threadId, subject, fromAddr, toAddr, preview, date, dateValue, body)
      VALUES ('legacy', 'synthetic', 'inbox', 'thread', 'Synthetic', 'trusted@example.test', 'team@example.test', '', '', 0, '')`);
    db.exec("ALTER TABLE messages DROP COLUMN senderKey; ALTER TABLE messages DROP COLUMN sourceSha256; PRAGMA user_version = 2");
    // Same connection-local function/trigger contract as fix/audit-s1s2.
    db.function("noctua_writer_v2", () => 2);
    db.exec(`CREATE TRIGGER noctua_writer_v2_messages_update BEFORE UPDATE ON messages
      BEGIN SELECT CASE WHEN noctua_writer_v2() IS NOT 2
      THEN RAISE(ABORT, 'Unsupported account shard writer') END; END`);
    initAccountSchema(db);
    initAccountSchema(db);
    const column = (db.prepare("PRAGMA table_info(messages)").all() as { name: string; notnull: number }[])
      .find(column => column.name === "senderKey");
    expect(column?.notnull).toBe(0);
    expect(db.prepare("SELECT sourceSha256 FROM messages WHERE id = 'legacy'").get()).toEqual({ sourceSha256: null });
    expect(db.prepare("SELECT senderKey FROM messages WHERE id = 'legacy'").get()).toEqual({ senderKey: null });
    expect(db.prepare("PRAGMA user_version").get()).toEqual({ user_version: 2 });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'noctua_writer_v2_messages_update'").get()).toBeTruthy();
    db.function("noctua_writer_v2", () => 1);
    expect(() => db.exec("UPDATE messages SET senderKey = NULL")).toThrow();
  } finally { db.close(); }
});

test("unkeyed legacy rows stay unknown without source, and re-ingestion stores every wire sender key", async () => {
  const f = await createCollabFixture();
  for (const from of legacyUnkeyedSenders) {
    const [message] = await f.seed(f.message(`<${crypto.randomUUID()}@example.test>`, { from }));
    expect((await f.api.getMessageById(f.accountId, message.id))?.senderKey).toBeNull();
  }
  for (const entry of ingestedSenderCases) {
    for (const headerFallback of [false, true]) {
      const fresh = await ingestSenderPermissionMessage(f.account, entry, "<p>Synthetic</p>", headerFallback);
      // A legacy row is replaced by the same parsed-message path used by resync.
      await f.seed({ ...fresh, senderKey: null, source: undefined });
      expect((await f.api.getMessageById(f.accountId, fresh.id))?.senderKey).toBeNull();
      await f.seed(fresh);
      expect((await f.api.getMessageById(f.accountId, fresh.id))?.senderKey, entry.name).toBe(entry.key);
      expect((await f.api.listThreadMessages({ accountId: f.accountId, threadIds: [fresh.threadId] })).items[0].senderKey).toBe(entry.key);
    }
  }
});

test("opening individual messages and threads backfills senderKey only from owned retained raw From", async () => {
  const f = await createCollabFixture();
  for (const thread of [false, true]) {
    for (const entry of ingestedSenderCases) {
      const [message] = await f.seed(f.message(`<${crypto.randomUUID()}@example.test>`, {
        from: "trusted@example.test", senderKey: null
      }));
      await f.seed({ ...message, source:
        `From: ${entry.from}\r\nContent-Type: text/plain\r\n\r\nFrom: trusted@example.test` });
      const opened = thread
        ? (await f.api.listThreadMessages({ accountId: f.accountId, threadIds: [message.threadId] })).items[0]
        : await f.api.getMessageById(f.accountId, message.id);
      expect(opened?.senderKey, entry.name).toBe(entry.key);
      expect(f.db.prepare("SELECT senderKey FROM messages WHERE accountId = ? AND id = ?").get(f.accountId, message.id)).toEqual({ senderKey: entry.key });
    }
  }
});

test("raw sources without a valid From stay unknown and existing keys are never re-derived", async () => {
  const f = await createCollabFixture();
  for (const source of ["Subject: Synthetic\r\n\r\nFrom: trusted@example.test", "From: invalid\r\n\r\nSynthetic"]) {
    const [message] = await f.seed(f.message(`<${crypto.randomUUID()}@example.test>`, { from: "trusted@example.test" }));
    await f.seed({ ...message, source });
    expect((await f.api.getMessageById(f.accountId, message.id))?.senderKey).toBeNull();
  }
  const [message] = await f.seed(f.message("<keyed@example.test>", { senderKey: "actual@example.test" }));
  await saveMessageSource(f.accountId, message.id, "From: trusted@example.test\r\n\r\nSynthetic");
  expect((await f.api.getMessageById(f.accountId, message.id))?.senderKey).toBe("actual@example.test");
});

test("sender backfill never borrows a collision base row's source", async () => {
  const f = await createCollabFixture();
  const base = `msg-${"a".repeat(24)}`;
  const [message] = await f.seed(f.message("<collision@example.test>", { id: `${base}-0123456789ab` }));
  await saveMessageSource(f.accountId, base, "From: trusted@example.test\r\n\r\nSynthetic");
  expect((await f.api.getMessageById(f.accountId, message.id))?.senderKey).toBeNull();
});

test("legacy exact caches without ownership provenance cannot backfill a sender permission", async () => {
  const f = await createCollabFixture();
  const [message] = await f.seed(f.message("<unowned@example.test>", { senderKey: null }));
  await saveMessageSource(f.accountId, message.id, "From: second@example.test\r\n\r\nSynthetic");
  expect((await f.api.getMessageById(f.accountId, message.id))?.senderKey).toBeNull();
  expect((await f.api.listThreadMessages({ accountId: f.accountId, threadIds: [message.threadId] })).items[0].senderKey).toBeNull();
});

test("source ownership digest rejects a file replaced outside the final-id writer", async () => {
  const f = await createCollabFixture();
  const [message] = await f.seed(f.message("<owned@example.test>", {
    senderKey: null, source: "From: first@example.test\r\n\r\nSynthetic"
  }));
  await saveMessageSource(f.accountId, message.id, "From: second@example.test\r\n\r\nSynthetic");
  expect((await f.api.getMessageById(f.accountId, message.id))?.senderKey).toBeNull();
});
