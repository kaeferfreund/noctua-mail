import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSharedShardFixture } from "../testSharedShardHarness";
import { cleanupUserAccountAccess } from "../membershipCleanup";
import { closeAccountDbConnection, configureAccountDb, getAccountDb } from "./connection";
import { initAccountSchema } from "./schema";
import { SHARD_FORMAT_VERSION, SHARD_FTS_TABLE } from "./shardFormat";

function snapshot(db: any) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name").all() as Array<{ name: string }>;
  return tables.map(({ name }) => ({ name, rows: db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all() }));
}

describe("account shard writer format boundary", () => {
  test("rejecting regression S1: legacy unscoped DELETE/UPDATE/INSERT fail at prepare before changing either account or FTS", async () => {
    const { a, b, db } = await createSharedShardFixture();
    for (const f of [a, b]) {
      await f.seed(f.message("same-thread", {
        id: "same-local-id", body: "Synthetic guarded search body",
        attachments: [{ id: "same-att", filename: "Synthetic.pdf", contentType: "application/pdf", size: 1, inline: false }]
      }));
    }
    const old = new Database(db.prepare("PRAGMA database_list").get().file);
    try {
      // Old initialization can leave IF NOT EXISTS objects alone, but cannot
      // mutate them even when foreign keys are disabled and its SQL is unscoped.
      old.exec("PRAGMA foreign_keys=OFF; CREATE VIRTUAL TABLE IF NOT EXISTS message_fts USING fts5(messageId,body)");
      const before = snapshot(db);
      for (const sql of [
        "DELETE FROM attachments WHERE messageId='same-local-id'",
        "UPDATE attachments SET filename='Destroyed.pdf' WHERE messageId='same-local-id'",
        "INSERT OR REPLACE INTO attachments(id,accountId,messageId,filename,contentType,size,inline) VALUES('same-att','a','same-local-id','Destroyed.pdf','application/pdf',1,0)",
        "DELETE FROM messages WHERE id='same-local-id'",
        "UPDATE messages SET subject='Destroyed' WHERE id='same-local-id'",
        "INSERT INTO messages DEFAULT VALUES"
      ]) {
        expect(() => old.prepare(sql)).toThrow("no such function: noctua_writer_v3");
        expect(snapshot(db)).toEqual(before);
      }
      for (const sql of [
        "DELETE FROM message_fts WHERE messageId='same-local-id'",
        "UPDATE message_fts SET body='Destroyed' WHERE messageId='same-local-id'",
        "INSERT INTO message_fts(messageId,body) VALUES('same-local-id','Destroyed')"
      ]) {
        expect(() => old.prepare(sql)).toThrow("cannot modify message_fts because it is a view");
        expect(snapshot(db)).toEqual(before);
      }
      // Also exercise exec/step, matching the old delete helper's ordering.
      expect(() => old.exec("DELETE FROM attachments WHERE messageId='same-local-id'; DELETE FROM message_fts WHERE messageId='same-local-id';"))
        .toThrow("no such function: noctua_writer_v3");
      expect(snapshot(db)).toEqual(before);
      expect(db.prepare(`SELECT accountId, COUNT(*) AS n FROM ${SHARD_FTS_TABLE}
        WHERE ${SHARD_FTS_TABLE} MATCH 'guarded' GROUP BY accountId ORDER BY accountId`).all())
        .toEqual([a.accountId, b.accountId].sort().map(accountId => ({ accountId, n: 1 })));
    } finally { old.close(); }
  });

  test("every account-scoped ordinary table rejects all three legacy mutations, including empty tables", async () => {
    const { db } = await createSharedShardFixture();
    const old = new Database(db.prepare("PRAGMA database_list").get().file);
    try {
      const tables = db.prepare(`SELECT m.name FROM pragma_table_list m
        WHERE m.schema='main' AND m.type='table' AND EXISTS
          (SELECT 1 FROM pragma_table_info(m.name) WHERE name='accountId')`).all() as Array<{ name: string }>;
      expect(tables.length).toBeGreaterThan(20);
      const before = snapshot(db);
      for (const { name } of tables) {
        for (const sql of [`INSERT INTO "${name}" DEFAULT VALUES`, `UPDATE "${name}" SET accountId=accountId`, `DELETE FROM "${name}"`]) {
          expect(() => old.prepare(sql)).toThrow("no such function: noctua_writer_v3");
        }
      }
      expect(snapshot(db)).toEqual(before);
    } finally { old.close(); }
  });

  test("evicted/reopened handles and membership cleanup install the connection-local writer marker", async () => {
    const { a, b, db } = await createSharedShardFixture();
    const file = db.prepare("PRAGMA database_list").get().file as string;
    db.prepare(`INSERT INTO thread_collab_state(accountId,threadId,status,assigneeUserId,assignedAt,commentCount,updatedAt,lastActivityAt)
      VALUES(?,'synthetic-thread','open','synthetic-user',1,0,1,1)`).run(a.accountId);
    expect(await cleanupUserAccountAccess(a.accountId, "synthetic-user", { userId: "synthetic-admin", clientId: "system" }))
      .toEqual({ status: "complete", unassigned: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM thread_activity WHERE accountId=?").get(a.accountId).n).toBe(1);
    closeAccountDbConnection(file);
    const reopened = await getAccountDb(b.accountId);
    expect(reopened.prepare("SELECT noctua_writer_v3() AS version").get().version).toBe(SHARD_FORMAT_VERSION);
    expect(() => reopened.prepare("UPDATE folders SET count=count WHERE accountId=?").run(b.accountId)).not.toThrow();
  });

  test("future shard formats are refused before configuration, marker registration or schema changes", () => {
    const db = new Database(":memory:");
    try {
      db.exec(`PRAGMA user_version=${SHARD_FORMAT_VERSION + 1}`);
      const before = snapshot(db);
      const schemaVersion = db.prepare("PRAGMA schema_version").get().schema_version;
      for (const open of [() => configureAccountDb(db), () => initAccountSchema(db)]) {
        expect(open).toThrow(`format ${SHARD_FORMAT_VERSION + 1} is newer than supported format ${SHARD_FORMAT_VERSION}`);
        expect(snapshot(db)).toEqual(before);
        expect(db.prepare("PRAGMA schema_version").get().schema_version).toBe(schemaVersion);
        expect(db.prepare("PRAGMA user_version").get().user_version).toBe(SHARD_FORMAT_VERSION + 1);
        expect(db.prepare("PRAGMA foreign_keys").get().foreign_keys).toBe(0);
        expect(() => db.prepare("SELECT noctua_writer_v3()")).toThrow("no such function");
      }
    } finally { db.close(); }
  });
});

test("production shard-opening inventory routes every writable shard connection through configureAccountDb", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const source = (file: string) => readFileSync(path.join(root, file), "utf8");
  const files = ["lib", "scripts", "app", "build-scripts"].flatMap(dir =>
    readdirSync(path.join(root, dir), { recursive: true }).map(file => `${dir}/${file}`))
    .filter(file => /\.tsx?$/.test(file) && !/\.test\.|\/test[^/]*|\/testFixtures\//.test(file));
  const openers = files.filter(file => /new\s+(?:Database|DatabaseCtor)\s*\(|Database\.open\(/.test(source(file))).sort();
  expect(openers).toEqual([
    "lib/db/connection.ts", "lib/mail/spam/evalData.ts", "lib/membershipCleanup.ts", "scripts/checkShardMessageCollisions.ts",
    "scripts/dev-fixture/store.ts", "scripts/spam-apply.ts", "scripts/verifyAdmissionCleanup.ts"
  ]);
  const markerCallers = files.filter(file => /configureAccountDb\(/.test(source(file))).sort();
  expect(markerCallers).toEqual(["lib/db/connection.ts", "lib/membershipCleanup.ts"]);
  expect(source("lib/db/connection.ts")).toContain("configureAccountDb(accountDb)");
  expect(source("lib/membershipCleanup.ts")).toContain("configureAccountDb(db, 0)");
  expect(source("scripts/checkShardMessageCollisions.ts")).toContain("{ readonly: true }");
  // The spam eval and the profile backfill dry run read data dirs read-only and immutable (no -wal/-shm access).
  expect(source("lib/mail/spam/evalData.ts")).toContain("?immutable=1`, flags)");
  expect(source("lib/mail/spam/evalData.ts")).toContain("SQLITE_OPEN_READONLY | (constants as Record<string, number>).SQLITE_OPEN_URI");
  expect(source("lib/mail/spam/evalData.ts").match(/new Database\(/g)).toHaveLength(1);
  // The spam apply script inspects shards read-only; its writes go through the common DB API.
  expect(source("scripts/spam-apply.ts").match(/new Database\(/g)).toHaveLength(2);
  expect(source("scripts/spam-apply.ts").match(/new Database\([^\n]*, \{ readonly: true \}\);/g)).toHaveLength(2);
  // Remaining raw constructors open a synthetic UID store or the master DB.
  expect(source("scripts/dev-fixture/store.ts")).toContain("new Database(this.uidValidityPath)");
  expect(source("scripts/verifyAdmissionCleanup.ts")).toContain("new Database(getMainDbPath())");
  // These entry points consume the common DB API rather than opening SQLite.
  for (const file of ["lib/workers/recomputeThreads.ts", "lib/workers/recomputeCategories.ts", "lib/mailboxWatcher.ts", "lib/syncOperation.ts"]) {
    expect(source(file)).toMatch(/from ["'](?:@\/lib\/|\.\/)db["']/);
  }
  for (const file of ["lib/db/threads.ts", "lib/db/categories.ts", "lib/db/mailboxSummary.ts", "lib/db/folders.ts", "scripts/backfillCalendarSnapshots.ts"]) {
    expect(source(file)).toContain("getAccountDb");
  }
});

// Frozen 112-site corpus extracted from 164a57e by the audited guard-cost probe.
// Preserve each statement, including zero-row predicates and UPSERT variants.
test("all 112 legacy-binary DML sites fail on v3 with FK enforcement disabled", async () => {
  const { db } = await createSharedShardFixture();
  const old = new Database(db.prepare("PRAGMA database_list").get().file);
  try {
    old.exec("PRAGMA foreign_keys=OFF");
    const sites = (await import("../testFixtures/legacyShardDml.json")).default;
    expect(sites).toHaveLength(112);
    const before = snapshot(db);
    let guarded = 0, views = 0;
    for (const site of sites) {
      try {
        old.prepare(site.sql);
        throw new Error(`Legacy statement unexpectedly prepared: ${site.file}:${site.line}`);
      } catch (error) {
        const text = String(error);
        if (text.includes("no such function: noctua_writer_v3")) guarded++;
        else if (text.includes("cannot modify message_fts because it is a view")) views++;
        else throw error;
      }
    }
    expect({ guarded, views }).toEqual({ guarded: 105, views: 7 });
    expect(snapshot(db)).toEqual(before);
  } finally { old.close(); }
});

test("87 guards reject missing/wrong v3 markers and both legacy FTS names reject every DML operation", async () => {
  const { db } = await createSharedShardFixture();
  const old: any = new Database(db.prepare("PRAGMA database_list").get().file);
  try {
    old.function("noctua_writer_v2", () => 2);
    const triggers = db.prepare("SELECT name,tbl_name FROM sqlite_master WHERE type='trigger' AND name LIKE 'noctua_writer_v3_%'").all() as { name: string; tbl_name: string }[];
    expect(triggers).toHaveLength(87);
    const tables = [...new Set(triggers.map(row => row.tbl_name))];
    // 27 audited tables plus spam_examples and spam_sender_profiles (doc/SPAM-DETECTION.md).
    expect(tables).toHaveLength(29);
    expect(tables).toContain("spam_examples");
    expect(tables).toContain("spam_sender_profiles");
    for (const table of tables) {
      for (const sql of [`INSERT INTO "${table}" DEFAULT VALUES`, `UPDATE "${table}" SET accountId=accountId WHERE 0`, `DELETE FROM "${table}" WHERE 0`]) {
        expect(() => old.prepare(sql)).toThrow("no such function: noctua_writer_v3");
      }
    }
    for (const table of ["message_fts", "message_fts_v2"]) {
      for (const sql of [`INSERT INTO ${table}(body) VALUES('bad')`, `UPDATE ${table} SET body='bad'`, `DELETE FROM ${table}`]) {
        expect(() => old.prepare(sql)).toThrow(`cannot modify ${table} because it is a view`);
      }
    }
    old.function("noctua_writer_v3", () => 2);
    // A wrong registered marker must reject at runtime on an actual row.
    db.exec("INSERT INTO mailbox_summary(accountId) VALUES('wrong-marker-probe')");
    expect(() => old.prepare("UPDATE mailbox_summary SET lastSyncAt=1 WHERE accountId='wrong-marker-probe'").run()).toThrow("Unsupported account shard writer");
  } finally { old.close(); }
});
