import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { initAccountSchema } from "./schema";
import { ensureAccountKeySchema } from "./accountKeys";
import { DELETE_MESSAGE_FTS_SQL, getFtsOrphanCount, validateFtsIdentity } from "./ftsIdentity";
import { shardWriterGuardsInstalled } from "./shardFormat";
import { createV2FtsShard, shardSnapshot } from "../testFixtures/v2FtsShard";
import { createSharedShardFixture } from "../testSharedShardHarness";

function diskFixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "fts-identity-"));
  const file = path.join(dir, "shard.db");
  const db = new Database(file);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON");
  createV2FtsShard(db);
  return { db, file, cleanup() { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

describe("FTS integer identity", () => {
  test("v2 migration drops and reports orphans, repairs duplicate/missing FTS rows from canonical messages, preserves every message column", () => {
    const db = new Database(":memory:");
    try {
      createV2FtsShard(db);
      const before = db.prepare("SELECT * FROM messages ORDER BY accountId,id").all();
      const queries = ["alpha", "beta", "café", "CAFÉ", "subject:synthetic", "fromAddr:example",
        '"alpha café"', "NEAR(alpha cafe, 5)", "alpha OR beta", "cafe NOT beta", "nohits"];
      const orderedSearch = (table: string) => queries.map(query => db.prepare(`
        SELECT m.accountId,m.id FROM messages m WHERE (m.accountId,m.id) IN (
          SELECT accountId,messageId FROM ${table} WHERE ${table} MATCH ?)
        ORDER BY m.dateValue DESC,m.accountId,m.id`).all(query));
      const beforeSearch = orderedSearch("message_fts_v2");
      db.exec(`DELETE FROM message_fts_v2 WHERE accountId='b';
        INSERT INTO message_fts_v2(accountId,messageId,body) VALUES('a','same','duplicate'),('absent','same','orphan'),('a','absent','orphan')`);
      expect(getFtsOrphanCount(db)).toBe(2);
      const result = initAccountSchema(db);
      expect(result).toEqual({ migrated: true, droppedFtsOrphans: 2 });
      expect(db.prepare("SELECT * FROM messages ORDER BY accountId,id").all()).toEqual(before);
      expect(orderedSearch("message_fts_v3")).toEqual(beforeSearch);
      expect(db.prepare("SELECT * FROM message_fts_identity ORDER BY ftsRowid").all()).toEqual([
        { ftsRowid: 1, accountId: "a", messageId: "same" }, { ftsRowid: 2, accountId: "b", messageId: "same" }
      ]);
      expect(() => validateFtsIdentity(db)).not.toThrow();
      expect(initAccountSchema(db)).toEqual({ migrated: false, droppedFtsOrphans: 0 });
      expect(db.prepare("SELECT noctua_writer_v2() AS v2,noctua_writer_v3() AS v3").get()).toEqual({ v2: 2, v3: 3 });
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${DELETE_MESSAGE_FTS_SQL}`).all("a", "same") as { detail: string }[];
      expect(plan.some(row => row.detail.includes("VIRTUAL TABLE INDEX 0:="))).toBe(true);
    } finally { db.close(); }
  });

  test("pre-migration inventory CLI reports v2 orphans without changing schema, rows or version", () => {
    const fixture = diskFixture();
    try {
      fixture.db.exec("INSERT INTO message_fts_v2(accountId,messageId,body) VALUES('a','missing','orphan')");
      const before = shardSnapshot(fixture.db);
      const result = spawnSync(process.execPath, ["scripts/checkShardMessageCollisions.ts", fixture.file], { encoding: "utf8" });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ shardVersion: 2, ftsOrphanCount: 1 });
      expect(shardSnapshot(fixture.db)).toEqual(before);
    } finally { fixture.cleanup(); }
  });

  for (const point of ["side-table", "population", "guards", "before-version", "after-version"]) {
    test(`SIGKILL at ${point} restores complete v2 state; retry migrates exactly once`, () => {
      const fixture = diskFixture();
      try {
        const before = shardSnapshot(fixture.db);
        const result = spawnSync(process.execPath, ["lib/testFixtures/ftsV3CrashWorker.ts", fixture.file, point], { encoding: "utf8", timeout: 10000 });
        expect(result.signal).toBe("SIGKILL");
        expect(shardSnapshot(fixture.db)).toEqual(before);
        expect(initAccountSchema(fixture.db)).toEqual({ migrated: true, droppedFtsOrphans: 0 });
        const after = shardSnapshot(fixture.db);
        expect(initAccountSchema(fixture.db).migrated).toBe(false);
        expect(shardSnapshot(fixture.db)).toEqual(after);
        expect(() => validateFtsIdentity(fixture.db)).not.toThrow();
      } finally { fixture.cleanup(); }
    });
  }

  for (const damage of [
    "DROP TABLE message_fts_v3", "DROP VIEW message_fts_v2", "DROP TABLE message_fts_identity", "DROP TABLE topics",
    "DROP TRIGGER noctua_writer_v3_messages_update",
    `DROP TRIGGER noctua_writer_v3_messages_update;
      CREATE TRIGGER noctua_writer_v3_messages_update BEFORE UPDATE ON messages BEGIN SELECT 1; END`
  ]) {
    test(`damaged v3 shape fails explicitly before additive initialization: ${damage}`, () => {
      const db = new Database(":memory:");
      try {
        initAccountSchema(db);
        db.exec(damage);
        const before = db.prepare("SELECT * FROM sqlite_master ORDER BY name").all();
        expect(() => initAccountSchema(db)).toThrow("explicit atomic repair required");
        expect(() => ensureAccountKeySchema(db)).toThrow("explicit atomic repair required");
        expect(db.prepare("SELECT * FROM sqlite_master ORDER BY name").all()).toEqual(before);
      } finally { db.close(); }
    });
  }

  test("cold open checks schema without a writer lock, even with a concurrent writer", () => {
    const fixture = diskFixture();
    const reader = new Database(fixture.file);
    try {
      initAccountSchema(fixture.db);
      const version = reader.prepare("PRAGMA schema_version").get();
      fixture.db.exec("BEGIN IMMEDIATE");
      expect(() => initAccountSchema(reader)).not.toThrow();
      expect(reader.prepare("PRAGMA schema_version").get()).toEqual(version);
      fixture.db.exec("ROLLBACK");
    } finally { reader.close(); fixture.cleanup(); }
  });

  test("v2 upgrade keeps foreign keys ON; failed validation rolls back with original enforcement", () => {
    const fixture = diskFixture();
    try {
      const before = shardSnapshot(fixture.db);
      const exec = fixture.db.exec.bind(fixture.db);
      (fixture.db as any).exec = (sql: string) => {
        expect(fixture.db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
        exec(sql);
        if (sql.startsWith("INSERT INTO message_fts_v3(rowid")) throw new Error("Synthetic population failure");
      };
      expect(() => initAccountSchema(fixture.db)).toThrow("Synthetic population failure");
      (fixture.db as any).exec = exec;
      expect(shardSnapshot(fixture.db)).toEqual(before);
      expect(fixture.db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    } finally { fixture.cleanup(); }
  });

  test("existing identities survive repeated updates; deleted IDs allocate new integers, collisions own separate integers", async () => {
    const { a, b, db } = await createSharedShardFixture();
    const msg = a.message("same-thread", { id: "same", body: "oldtoken", mailboxPath: "INBOX", imapUid: 1 });
    await a.seed(msg);
    const identity = () => db.prepare("SELECT ftsRowid FROM message_fts_identity WHERE accountId=? AND messageId='same'").get(a.accountId).ftsRowid;
    const first = identity();
    for (let i = 0; i < 3; i++) {
      await a.seed({ ...msg, body: "newtoken" });
      expect(identity()).toBe(first);
      validateFtsIdentity(db);
    }
    expect(db.prepare("SELECT rowid FROM message_fts_v3 WHERE message_fts_v3 MATCH 'newtoken' AND accountId=?").all(a.accountId))
      .toEqual([{ rowid: first }]);
    expect(db.prepare("SELECT rowid FROM message_fts_v3 WHERE message_fts_v3 MATCH 'oldtoken' AND accountId=?").all(a.accountId)).toEqual([]);
    await b.seed(b.message("same-thread", { id: "same", body: "othertoken" }));
    expect(db.prepare("SELECT DISTINCT ftsRowid FROM message_fts_identity WHERE messageId='same'").all()).toHaveLength(2);
    await a.seed({ ...msg, mailboxPath: "Archive", folderId: `${a.accountId}:Archive`, imapUid: 2 });
    expect(db.prepare("SELECT id FROM messages WHERE accountId=?").all(a.accountId)).toHaveLength(2);
    validateFtsIdentity(db);
    await a.api.deleteMessageById(a.accountId, "same");
    await a.seed(msg);
    expect(identity()).toBeGreaterThan(first);
    validateFtsIdentity(db);
    await a.api.upsertMessages(a.accountId, null, [msg], true);
    validateFtsIdentity(db);
    expect(shardWriterGuardsInstalled(db)).toBe(true);
  });

  test("missing existing mapping errors and rolls back without a key-scan fallback", async () => {
    const { a, db } = await createSharedShardFixture();
    const msg = a.message("same-thread", { id: "missing-map" });
    await a.seed(msg);
    db.prepare("DELETE FROM message_fts_identity WHERE accountId=? AND messageId=?").run(a.accountId, msg.id);
    const before = shardSnapshot(db);
    await expect(a.seed({ ...msg, body: "changed" })).rejects.toThrow("Missing FTS identity");
    expect(shardSnapshot(db)).toEqual(before);
    expect(() => validateFtsIdentity(db)).toThrow("coverage is inconsistent");
  });
});

test("stale v2 statements prepared before migration fail after the guard/view swap", () => {
  const fixture = diskFixture();
  const old: any = new Database(fixture.file);
  try {
    old.function("noctua_writer_v2", () => 2);
    const message = old.prepare("DELETE FROM messages WHERE accountId='a' AND id='same'");
    const fts = old.prepare("DELETE FROM message_fts_v2 WHERE accountId='a' AND messageId='same'");
    initAccountSchema(fixture.db);
    const before = shardSnapshot(fixture.db);
    expect(() => message.run()).toThrow("no such function: noctua_writer_v3");
    expect(() => fts.run()).toThrow("cannot modify message_fts_v2 because it is a view");
    expect(shardSnapshot(fixture.db)).toEqual(before);
  } finally { old.close(); fixture.cleanup(); }
});

test("two simultaneous production openers converge on one migration", async () => {
  const fixture = diskFixture();
  try {
    const start = () => Bun.spawn([process.execPath, "lib/testFixtures/ftsV3CrashWorker.ts", fixture.file, "normal"], { stdout: "pipe", stderr: "pipe" });
    const children = [start(), start()];
    const results = await Promise.all(children.map(async child => ({ code: await child.exited, output: await new Response(child.stdout).text(), error: await new Response(child.stderr).text() })));
    for (const result of results) expect(result.code, result.error).toBe(0);
    expect(results.map(result => JSON.parse(result.output).migrated).sort()).toEqual([false, true]);
    validateFtsIdentity(fixture.db);
  } finally { fixture.cleanup(); }
});

test("a reader retains its v2 snapshot during migration; busy writer failure leaves v2 untouched and retries", () => {
  const fixture = diskFixture();
  const reader = new Database(fixture.file);
  try {
    fixture.db.exec("BEGIN IMMEDIATE");
    const before = shardSnapshot(fixture.db);
    expect(() => initAccountSchema(reader)).toThrow("database is locked");
    expect(shardSnapshot(fixture.db)).toEqual(before);
    fixture.db.exec("ROLLBACK");
    reader.exec("BEGIN");
    expect(reader.prepare("PRAGMA user_version").get()).toEqual({ user_version: 2 });
    initAccountSchema(fixture.db);
    expect(reader.prepare("PRAGMA user_version").get()).toEqual({ user_version: 2 });
    expect(reader.prepare("SELECT COUNT(*) AS n FROM message_fts_v2 WHERE message_fts_v2 MATCH 'cafe'").get().n).toBe(2);
    reader.exec("COMMIT");
    expect(reader.prepare("PRAGMA user_version").get()).toEqual({ user_version: 3 });
    const identities = fixture.db.prepare("SELECT * FROM message_fts_identity ORDER BY ftsRowid").all();
    fixture.db.exec("VACUUM");
    expect(fixture.db.prepare("SELECT * FROM message_fts_identity ORDER BY ftsRowid").all()).toEqual(identities);
  } finally { reader.close(); fixture.cleanup(); }
});

test("a crash after commit leaves complete v3 and reopen performs no migration", () => {
  const fixture = diskFixture();
  try {
    const child = spawnSync(process.execPath, ["lib/testFixtures/ftsV3CrashWorker.ts", fixture.file, "after-commit"], { timeout: 10000 });
    expect(child.signal).toBe("SIGKILL");
    expect(initAccountSchema(fixture.db)).toEqual({ migrated: false, droppedFtsOrphans: 0 });
    validateFtsIdentity(fixture.db);
  } finally { fixture.cleanup(); }
});

test("failure allocating an identity rolls back message, attachment and FTS writes", async () => {
  const { a, db } = await createSharedShardFixture();
  const before = db.prepare("SELECT COUNT(*) AS n FROM messages").get();
  db.exec("CREATE TRIGGER synthetic_identity_failure BEFORE INSERT ON message_fts_identity BEGIN SELECT RAISE(ABORT,'Synthetic identity allocation failure'); END");
  await expect(a.seed(a.message("failure", { id: "failure", source: "Synthetic source" }))).rejects.toThrow("Synthetic identity allocation failure");
  db.exec("DROP TRIGGER synthetic_identity_failure");
  expect(db.prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual(before);
  validateFtsIdentity(db);
});
