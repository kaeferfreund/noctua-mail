import { describe, test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { createTempDir, openMasterDb } from "../testAuthHarness";
import { initMasterSchema, initAccountSchema, ensureSenderIdentityMessageRuntimeSchema } from "./schema";
import { persistAccountRow } from "./rowParsers";
import { listSenderIdentityRows } from "./senderIdentities";
import { identityTestAccount } from "../testFixtures/senderIdentities";

describe("sender identity migrations", () => {
  test("fresh account seeds in creation transaction; edits and second open preserve seed ID", () => {
    const temp = createTempDir("sender-migration-");
    let db = openMasterDb(temp.dbPath);
    try {
      expect(listSenderIdentityRows(db, "a")).toEqual([]);
      db.transaction(() => persistAccountRow(db, identityTestAccount("a"))).immediate();
      const [seed] = listSenderIdentityRows(db, "a");
      expect(seed).toMatchObject({ email: "primary@example.test", displayName: "Synthetic Mailbox", isDefault: true, enabled: true, createdBy: null });
      db.prepare("UPDATE sender_identities SET displayName='Manager label' WHERE id=?").run(seed.id);
      persistAccountRow(db, { ...identityTestAccount("a"), name: "Sidebar label" });
      db.close(); db = openMasterDb(temp.dbPath);
      expect(listSenderIdentityRows(db, "a")[0]).toMatchObject({ id: seed.id, displayName: "Manager label" });
    } finally { db.close(); temp.cleanup(); }
  });
  test("legacy seed only for mailbox without rows; per-mailbox NOCASE uniqueness and enabled default constraints", () => {
    const temp = createTempDir("sender-legacy-"); const db = openMasterDb(temp.dbPath);
    try {
      persistAccountRow(db, identityTestAccount("a")); persistAccountRow(db, identityTestAccount("b"));
      db.exec("DROP TABLE sender_identities"); initMasterSchema(db);
      const [seed] = listSenderIdentityRows(db, "a");
      expect(listSenderIdentityRows(db, "b")).toHaveLength(1);
      expect(() => db.prepare("INSERT INTO sender_identities SELECT 'duplicate',accountId,upper(email),displayName,replyTo,signatureId,0,1,createdBy,createdAt,updatedAt FROM sender_identities WHERE id=?").run(seed.id)).toThrow();
      expect(() => db.prepare("UPDATE sender_identities SET enabled=0 WHERE id=?").run(seed.id)).toThrow();
      db.prepare("UPDATE sender_identities SET email='changed@example.test' WHERE id=?").run(seed.id);
      initMasterSchema(db);
      expect(listSenderIdentityRows(db, "a")).toHaveLength(1);
      expect(listSenderIdentityRows(db, "a")[0].email).toBe("changed@example.test");
    } finally { db.close(); temp.cleanup(); }
  });
  test("legacy and fresh shards gain nullable observations without rewriting existing mail; runtime ensure twice", () => {
    const db = new Database(":memory:");
    try {
      db.exec("CREATE TABLE messages(id TEXT PRIMARY KEY, accountId TEXT); INSERT INTO messages VALUES('old','a')");
      ensureSenderIdentityMessageRuntimeSchema(db); ensureSenderIdentityMessageRuntimeSchema(db);
      expect(db.prepare("SELECT deliveredTo,originalTo,senderIdentityId FROM messages WHERE id='old'").get()).toEqual({ deliveredTo: null, originalTo: null, senderIdentityId: null });
    } finally { db.close(); }
    const fresh = new Database(":memory:");
    try { initAccountSchema(fresh); initAccountSchema(fresh); expect((fresh.prepare("PRAGMA table_info(messages)").all() as { name: string }[]).some(row => row.name === "originalTo")).toBe(true); }
    finally { fresh.close(); }
  });
});
