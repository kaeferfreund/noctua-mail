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
        expect(() => old.prepare(sql)).toThrow("no such function: noctua_writer_v2");
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
        .toThrow("no such function: noctua_writer_v2");
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
          expect(() => old.prepare(sql)).toThrow("no such function: noctua_writer_v2");
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
    expect(reopened.prepare("SELECT noctua_writer_v2() AS version").get().version).toBe(SHARD_FORMAT_VERSION);
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
        expect(() => db.prepare("SELECT noctua_writer_v2()")).toThrow("no such function");
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
    "lib/db/connection.ts", "lib/membershipCleanup.ts", "scripts/checkShardMessageCollisions.ts",
    "scripts/dev-fixture/store.ts", "scripts/verifyAdmissionCleanup.ts"
  ]);
  const markerCallers = files.filter(file => /configureAccountDb\(/.test(source(file))).sort();
  expect(markerCallers).toEqual(["lib/db/connection.ts", "lib/membershipCleanup.ts"]);
  expect(source("lib/db/connection.ts")).toContain("configureAccountDb(accountDb)");
  expect(source("lib/membershipCleanup.ts")).toContain("configureAccountDb(db, 0)");
  expect(source("scripts/checkShardMessageCollisions.ts")).toContain("{ readonly: true }");
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
