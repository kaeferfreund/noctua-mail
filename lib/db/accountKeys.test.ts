import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { initAccountSchema } from "./schema";
import { ensureAccountKeySchema } from "./accountKeys";
import { getShardCollisionReport } from "./shardCollisionReport";
import { SHARD_FORMAT_VERSION, shardWriterGuardsInstalled } from "./shardFormat";

const legacySql = readFileSync(new URL("../testFixtures/sharedShardLegacy.sql", import.meta.url), "utf8");
function legacyDb() {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(legacySql);
  const insert = db.prepare(`INSERT INTO messages
    (id,accountId,folderId,threadId,messageId,subject,fromAddr,toAddr,preview,date,dateValue,body)
    VALUES(?,?,'INBOX','root',?,'Synthetic','sender@example.test','team@example.test','preview','2026-01-01',1,?)`);
  insert.run("a-row", "a", "<same@example.test>", "syntheticfirstword");
  insert.run("b-row", "b", "<same@example.test>", "syntheticsecondword");
  db.prepare("INSERT INTO attachments VALUES('same-attachment','a-row','A.pdf','application/pdf',1,0,NULL,NULL)").run();
  db.prepare("INSERT INTO message_translations VALUES('a-row','de','text','marker','A translation','en',1)").run();
  db.prepare("INSERT INTO message_calendar_events(accountId,messageId,eventUid) VALUES('a','a-row','event')").run();
  db.prepare("INSERT INTO threads(threadId,accountId,rootMessageId,latestMessageId) VALUES('root','a','a-row','a-row')").run();
  db.prepare("INSERT INTO thread_topics VALUES('root','same-topic','a',1)").run();
  db.exec("CREATE INDEX legacy_subject_index ON messages(subject)");
  db.exec("CREATE TRIGGER legacy_message_trigger AFTER UPDATE ON messages BEGIN SELECT 1; END");
  return db;
}

describe("account shard key migration", () => {
  test("legacy files preserve ids and dependent data, rebuild FTS, and migrate idempotently", () => {
    const db = legacyDb();
    try {
      initAccountSchema(db);
      expect(db.prepare("SELECT id,messageId FROM messages ORDER BY id").all()).toEqual([
        { id: "a-row", messageId: "<same@example.test>" }, { id: "b-row", messageId: "<same@example.test>" }
      ]);
      expect(db.prepare("SELECT accountId,filename FROM attachments").get()).toEqual({ accountId: "a", filename: "A.pdf" });
      expect(db.prepare("SELECT accountId,translatedText FROM message_translations").get()).toEqual({ accountId: "a", translatedText: "A translation" });
      expect(db.prepare("SELECT accountId FROM message_calendar_events").get()?.accountId).toBe("a");
      expect(db.prepare("SELECT rootMessageId FROM threads").get()?.rootMessageId).toBe("a-row");
      expect(db.prepare("SELECT accountId FROM thread_topics").get()?.accountId).toBe("a");
      expect(db.prepare("SELECT accountId FROM message_fts_v2 WHERE message_fts_v2 MATCH 'syntheticfirstword'").all()).toEqual([{ accountId: "a" }]);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name='legacy_subject_index'").get()).not.toBeNull();
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name='legacy_message_trigger'").get()).not.toBeNull();
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      expect(db.prepare("PRAGMA foreign_keys").get().foreign_keys).toBe(1);
      expect(db.prepare("PRAGMA user_version").get().user_version).toBe(SHARD_FORMAT_VERSION);
      const version = db.prepare("PRAGMA schema_version").get().schema_version;
      initAccountSchema(db);
      expect(db.prepare("PRAGMA schema_version").get().schema_version).toBe(version);
      // Identical local ids can coexist after migration. Deleting A cascades
      // only through A's composite foreign keys.
      db.exec(`INSERT INTO messages(id,accountId,folderId,threadId,subject,fromAddr,toAddr,preview,date,dateValue,body)
        VALUES('a-row','b','INBOX','root','B','b@example.test','team@example.test','','2026-01-01',1,'B');
        INSERT INTO attachments(id,accountId,messageId,filename,contentType,size,inline)
        VALUES('same-attachment','b','a-row','B.pdf','application/pdf',1,0);
        INSERT INTO threads(threadId,accountId) VALUES('root','b');
        INSERT INTO thread_topics VALUES('root','same-topic','b',1);
        DELETE FROM messages WHERE accountId='a' AND id='a-row';`);
      expect(db.prepare("SELECT accountId,filename FROM attachments").all()).toEqual([{ accountId: "b", filename: "B.pdf" }]);
      expect(db.prepare("SELECT * FROM message_translations").all()).toEqual([]);
      expect(db.prepare("SELECT * FROM message_calendar_events").all()).toEqual([]);
      expect(db.prepare("SELECT * FROM threads WHERE threadId='root'").all()).toHaveLength(2);
    } finally { db.close(); }
  });

  for (const order of ["before", "after"] as const) {
    test(`sender provenance added ${order} the v2 rebuild survives reopen with writer guards`, () => {
      const db = legacyDb();
      try {
        if (order === "before") {
          db.exec("ALTER TABLE messages ADD COLUMN senderKey TEXT; ALTER TABLE messages ADD COLUMN sourceSha256 TEXT");
          db.prepare("UPDATE messages SET senderKey=?,sourceSha256=? WHERE id='a-row'")
            .run("sender@example.test", "a".repeat(64));
        } else {
          initAccountSchema(db);
          // A shard migrated by round 4 has v2 keys/guards, but neither S3 column.
          db.exec("ALTER TABLE messages DROP COLUMN senderKey; ALTER TABLE messages DROP COLUMN sourceSha256");
        }
        const rootPage = db.prepare("SELECT rootpage FROM sqlite_master WHERE name='messages'").get().rootpage;
        initAccountSchema(db);
        if (order === "after") {
          expect(db.prepare("SELECT rootpage FROM sqlite_master WHERE name='messages'").get().rootpage).toBe(rootPage);
        }
        const columns = db.prepare("PRAGMA table_info(messages)").all() as { name: string; notnull: number }[];
        for (const name of ["senderKey", "sourceSha256"]) {
          expect(columns.find(column => column.name === name)?.notnull).toBe(0);
        }
        expect(db.prepare("SELECT senderKey,sourceSha256 FROM messages WHERE accountId='a' AND id='a-row'").get()).toEqual({
          senderKey: order === "before" ? "sender@example.test" : null,
          sourceSha256: order === "before" ? "a".repeat(64) : null
        });
        expect(db.prepare("SELECT accountId,filename FROM attachments").all()).toEqual([{ accountId: "a", filename: "A.pdf" }]);
        expect(db.prepare("SELECT COUNT(*) AS n FROM messages").get().n).toBe(2);
        expect(db.prepare("SELECT COUNT(*) AS n FROM message_fts_v2").get().n).toBe(2);
        expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
        expect(shardWriterGuardsInstalled(db)).toBe(true);
        const schemaVersion = db.prepare("PRAGMA schema_version").get().schema_version;
        initAccountSchema(db);
        expect(db.prepare("PRAGMA schema_version").get().schema_version).toBe(schemaVersion);
        expect(shardWriterGuardsInstalled(db)).toBe(true);
      } finally { db.close(); }
    });
  }

  test("a failed rebuild rolls back every table and restores foreign key enforcement", () => {
    const db = legacyDb();
    const before = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
    try {
      const interrupted = {
        prepare: db.prepare.bind(db), transaction: db.transaction.bind(db),
        exec(sql: string) {
          if (sql.startsWith('ALTER TABLE "attachments_account_key"')) throw new Error("Synthetic interrupted migration");
          db.exec(sql);
        }
      };
      expect(() => ensureAccountKeySchema(interrupted)).toThrow("Synthetic interrupted migration");
      expect(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name").all()).toEqual(before);
      expect(db.prepare("SELECT filename FROM attachments").get().filename).toBe("A.pdf");
      expect(db.prepare("PRAGMA foreign_keys").get().foreign_keys).toBe(1);
      initAccountSchema(db);
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { db.close(); }
  });

  test("an initialized shard's key check needs no writer lock on another connection", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "noctua-account-key-"));
    const file = path.join(dir, "shard.db");
    const db = new Database(file);
    let reader: Database | undefined;
    try {
      initAccountSchema(db);
      db.exec("PRAGMA journal_mode=WAL");
      reader = new Database(file);
      db.exec("BEGIN IMMEDIATE");
      expect(() => ensureAccountKeySchema(reader)).not.toThrow();
      db.exec("ROLLBACK");
    } finally { reader?.close(); db.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  test("unowned legacy dependents fail migration without discarding data", () => {
    const db = legacyDb();
    try {
      db.exec("PRAGMA foreign_keys=OFF");
      db.exec("INSERT INTO attachments VALUES('orphan','absent','orphan.pdf','application/pdf',1,0,NULL,NULL)");
      db.exec("PRAGMA foreign_keys=ON");
      expect(() => ensureAccountKeySchema(db)).toThrow("could not preserve dependent rows");
      expect(db.prepare("SELECT COUNT(*) AS n FROM attachments").get().n).toBe(2);
      expect(db.prepare("PRAGMA foreign_keys").get().foreign_keys).toBe(1);
    } finally { db.close(); }
  });

  for (const failurePoint of ["ALTER TABLE message_fts RENAME", "CREATE TRIGGER IF NOT EXISTS", "PRAGMA user_version ="]) {
    test(`failure after ${failurePoint} rolls back keys, FTS, guards and format version together`, () => {
      const db = legacyDb();
      const before = db.prepare("SELECT * FROM sqlite_master ORDER BY name").all();
      try {
        const interrupted = {
          prepare: db.prepare.bind(db), transaction: db.transaction.bind(db),
          exec(sql: string) {
            db.exec(sql);
            if (sql.startsWith(failurePoint)) throw new Error("Synthetic guard migration interruption");
          }
        };
        expect(() => ensureAccountKeySchema(interrupted)).toThrow("Synthetic guard migration interruption");
        expect(db.prepare("SELECT * FROM sqlite_master ORDER BY name").all()).toEqual(before);
        expect(db.prepare("PRAGMA user_version").get().user_version).toBe(0);
        expect(db.prepare("PRAGMA foreign_keys").get().foreign_keys).toBe(1);
        expect(db.prepare("SELECT COUNT(*) AS n FROM messages").get().n).toBe(2);
        expect(db.prepare("SELECT filename FROM attachments").get().filename).toBe("A.pdf");
        initAccountSchema(db);
        expect(db.prepare("PRAGMA user_version").get().user_version).toBe(SHARD_FORMAT_VERSION);
      } finally { db.close(); }
    });
  }

  test("a legacy connection and DELETE prepared before migration fail closed after migration", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "noctua-preopened-legacy-"));
    const file = path.join(dir, "shard.db");
    const legacy = legacyDb();
    let writer: Database | undefined, old: Database | undefined;
    try {
      legacy.prepare("VACUUM INTO ?").run(file);
      old = new Database(file);
      const previouslyPreparedDelete = old.prepare("DELETE FROM attachments WHERE messageId='a-row'");
      writer = new Database(file);
      initAccountSchema(writer);
      expect(() => previouslyPreparedDelete.run()).toThrow("no such function: noctua_writer_v2");
      expect(() => old!.prepare("DELETE FROM message_fts WHERE messageId='a-row'")).toThrow("cannot modify message_fts because it is a view");
      expect(writer.prepare("SELECT COUNT(*) AS n FROM attachments").get().n).toBe(1);
      expect(writer.prepare("SELECT COUNT(*) AS n FROM message_fts_v2").get().n).toBe(2);
    } finally { old?.close(); writer?.close(); legacy.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  test("round-1 composite-key shards gain writer guards without rebuilding or losing FTS", () => {
    const db = legacyDb();
    try {
      initAccountSchema(db);
      // Synthetic round-1 format: composite keys and account-linked FTS, but
      // no writer guards, read-only legacy view or declared format version.
      for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'noctua_writer_v2_%'").all()) {
        db.exec(`DROP TRIGGER "${name}"`);
      }
      db.exec("DROP VIEW message_fts; ALTER TABLE message_fts_v2 RENAME TO message_fts; PRAGMA user_version=0");
      const beforeFts = db.prepare("SELECT rowid,* FROM message_fts ORDER BY rowid").all();
      const messageRootPage = db.prepare("SELECT rootpage FROM sqlite_master WHERE name='messages'").get().rootpage;
      initAccountSchema(db);
      expect(db.prepare("SELECT rootpage FROM sqlite_master WHERE name='messages'").get().rootpage).toBe(messageRootPage);
      expect(db.prepare("SELECT rowid,* FROM message_fts_v2 ORDER BY rowid").all()).toEqual(beforeFts);
      expect(db.prepare("SELECT type FROM sqlite_master WHERE name='message_fts'").get().type).toBe("view");
      expect(db.prepare("PRAGMA user_version").get().user_version).toBe(SHARD_FORMAT_VERSION);
      const schemaVersion = db.prepare("PRAGMA schema_version").get().schema_version;
      initAccountSchema(db);
      expect(db.prepare("PRAGMA schema_version").get().schema_version).toBe(schemaVersion);
    } finally { db.close(); }
  });

  test("50k-message legacy migration preserves every row and FTS entry with idempotent reopen", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "noctua-migration-timing-"));
    const file = path.join(dir, "shard.db");
    const db = new Database(file);
    try {
      db.exec(legacySql);
      db.exec(`WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<50000)
        INSERT INTO messages(id,accountId,folderId,threadId,messageId,subject,fromAddr,toAddr,preview,date,dateValue,body)
        SELECT 'row-'||i, CASE WHEN i%2=0 THEN 'a' ELSE 'b' END, 'INBOX', 'root',
          '<duplicate-'||(i/2)||'@example.test>', 'Synthetic', 'sender@example.test', 'team@example.test',
          'preview', '2026-01-01', i, 'Synthetic migration body' FROM n;`);
      const start = performance.now();
      initAccountSchema(db);
      const migratedMs = performance.now() - start;
      const version = db.prepare("PRAGMA schema_version").get().schema_version;
      const reopen = performance.now();
      initAccountSchema(db);
      const repeatedMs = performance.now() - reopen;
      expect(db.prepare("PRAGMA schema_version").get().schema_version).toBe(version);
      expect(db.prepare("SELECT COUNT(*) AS n FROM messages").get().n).toBe(50000);
      expect(db.prepare("SELECT COUNT(*) AS n FROM message_fts_v2").get().n).toBe(50000);
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      console.info(`[shard-migration-timing] 50000 messages: migration=${migratedMs.toFixed(2)}ms repeat=${repeatedMs.toFixed(2)}ms`);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  test("collision inventory CLI opens an existing shard read-only and deduplicates paths", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "noctua-collision-report-"));
    const file = path.join(dir, "legacy.db");
    const db = legacyDb();
    try {
      db.prepare("VACUUM INTO ?").run(file);
      const result = spawnSync(process.execPath, ["scripts/checkShardMessageCollisions.ts", file, file], { encoding: "utf8", timeout: 10000 });
      expect(result.status).toBe(0);
      const lines = result.stdout.trim().split("\n");
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toMatchObject({ sharedMessageIdCount: 1, sharedMessageRowCount: 2, legacyMessageKey: true });
      const checked = new Database(file, { readonly: true });
      try { expect(getShardCollisionReport(checked).legacyMessageKey).toBe(true); }
      finally { checked.close(); }
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  });

  test("collision inventory counts surviving shared headers without changing the file", () => {
    const db = legacyDb();
    try {
      const version = db.prepare("PRAGMA schema_version").get().schema_version;
      expect(getShardCollisionReport(db)).toMatchObject({ sharedMessageIdCount: 1, sharedMessageRowCount: 2, storedAccountCount: 2, legacyMessageKey: true });
      db.exec("DELETE FROM messages WHERE accountId='a'");
      expect(getShardCollisionReport(db)).toMatchObject({ sharedMessageRowCount: 0, legacyMessageKey: true, resyncRequiredForLegacySharedShard: true });
      expect(db.prepare("PRAGMA schema_version").get().schema_version).toBe(version);
    } finally { db.close(); }
  });
});
