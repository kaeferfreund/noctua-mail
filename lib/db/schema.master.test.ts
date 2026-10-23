import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { Database } from "bun:sqlite";
import { initMasterSchema } from "./schema";

// Each test gets its own in-memory master DB so legacy layouts can be
// pre-seeded before `initMasterSchema` runs; the shared harness DB is
// already migrated.
const openDbs: Database[] = [];

function openMemoryDb() {
  const db = new Database(":memory:");
  openDbs.push(db);
  return db;
}

afterEach(() => {
  while (openDbs.length > 0) openDbs.pop()?.close();
});

// The master tables as they existed before the team migration.
function createLegacyMasterTables(db: Database) {
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE user_accounts (
      userId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      PRIMARY KEY (userId, accountId)
    );
    CREATE TABLE mcp_tokens (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      createdByUserId TEXT NOT NULL,
      label TEXT NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      tokenSuffix TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      expiresAt INTEGER,
      lastUsedAt INTEGER
    );
  `);
}

function insertLegacyUser(db: Database, id: string, email: string, createdAt: number) {
  db.prepare(`INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, 'user', ?)`).run(
    id,
    email,
    createdAt
  );
}

function columnNames(db: Database, table: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
    (row) => row.name
  );
}

function emailIndex(db: Database) {
  return (
    db.prepare(`PRAGMA index_list(users)`).all() as Array<{ name: string; unique: number }>
  ).find((row) => row.name === "idx_users_email_lower");
}

function emailsById(db: Database) {
  const rows = db.prepare(`SELECT id, email FROM users ORDER BY id`).all() as Array<{
    id: string;
    email: string;
  }>;
  return Object.fromEntries(rows.map((row) => [row.id, row.email]));
}

function runMigrationQuietly(db: Database) {
  const info = spyOn(console, "info").mockImplementation(() => {});
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  const error = spyOn(console, "error").mockImplementation(() => {});
  try {
    initMasterSchema(db);
    return { warnCalls: [...warn.mock.calls], errorCalls: [...error.mock.calls] };
  } finally {
    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();
  }
}

describe("initMasterSchema: clean install", () => {
  test("creates the team tables, columns and a unique lower(email) index", () => {
    const db = openMemoryDb();
    const { warnCalls, errorCalls } = runMigrationQuietly(db);
    expect(warnCalls).toEqual([]);
    expect(errorCalls).toEqual([]);

    expect(columnNames(db, "users")).toEqual(["id", "email", "role", "createdAt", "uiLocale"]);
    expect(columnNames(db, "user_accounts")).toEqual(
      expect.arrayContaining(["role", "grantedByUserId", "grantedAt"])
    );
    expect(columnNames(db, "mcp_tokens")).toContain("scopes");
    expect(columnNames(db, "mcp_token_accounts")).toEqual(["tokenId", "accountId"]);
    expect(columnNames(db, "user_account_prefs")).toEqual([
      "userId",
      "accountId",
      "prefs",
      "updatedAt"
    ]);
    expect(columnNames(db, "admin_audit")).toEqual([
      "id",
      "actorUserId",
      "action",
      "targetUserId",
      "targetAccountId",
      "payload",
      "createdAt"
    ]);

    const indexNames = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index'`).all() as Array<{
        name: string;
      }>
    ).map((row) => row.name);
    expect(indexNames).toEqual(
      expect.arrayContaining(["idx_user_accounts_account", "idx_admin_audit_created"])
    );
    expect(emailIndex(db)?.unique).toBe(1);

    insertLegacyUser(db, "user-a", "person@example.test", 1);
    expect(() => insertLegacyUser(db, "user-b", "PERSON@example.test", 2)).toThrow(
      /UNIQUE constraint failed: index 'idx_users_email_lower'/
    );
  });

  test("is idempotent", () => {
    const db = openMemoryDb();
    runMigrationQuietly(db);
    const { warnCalls, errorCalls } = runMigrationQuietly(db);
    expect(warnCalls).toEqual([]);
    expect(errorCalls).toEqual([]);
    expect(emailIndex(db)?.unique).toBe(1);
  });
});

describe("initMasterSchema: legacy install", () => {
  test("adds the columns with their defaults to existing rows", () => {
    const db = openMemoryDb();
    createLegacyMasterTables(db);
    insertLegacyUser(db, "user-legacy", "legacy@example.test", 1);
    db.prepare(`INSERT INTO user_accounts (userId, accountId) VALUES (?, ?)`).run(
      "user-legacy",
      "acc-legacy"
    );

    runMigrationQuietly(db);

    expect(db.prepare("SELECT id,email,role,createdAt FROM users WHERE id=?").get("user-legacy")).toEqual({id:"user-legacy",email:"legacy@example.test",role:"user",createdAt:1});
    expect(db.prepare("SELECT uiLocale FROM users WHERE id=?").get("user-legacy")).toEqual({uiLocale:null});
    db.prepare("UPDATE users SET uiLocale='en' WHERE id=?").run("user-legacy");
    runMigrationQuietly(db);
    expect(db.prepare("SELECT uiLocale FROM users WHERE id=?").get("user-legacy")).toEqual({uiLocale:"en"});
    expect(() => db.prepare("UPDATE users SET uiLocale='fr' WHERE id=?").run("user-legacy")).toThrow();
    // Links that predate roles were self-created, so they become managers.
    expect(
      db
        .prepare(`SELECT role, grantedByUserId, grantedAt FROM user_accounts WHERE userId = ?`)
        .get("user-legacy")
    ).toEqual({ role: "manager", grantedByUserId: null, grantedAt: null });
  });

  test("tolerates columns that a concurrent start already added", () => {
    const db = openMemoryDb();
    createLegacyMasterTables(db);
    db.exec(`ALTER TABLE users ADD COLUMN name TEXT`);
    db.exec(`ALTER TABLE user_accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'manager'`);

    expect(() => runMigrationQuietly(db)).not.toThrow();
    expect(columnNames(db, "users").filter((name) => name === "name")).toHaveLength(1);
    expect(columnNames(db, "users")).not.toContain("disabledAt");
    expect(columnNames(db, "user_accounts")).toContain("grantedAt");
  });

  test("normalises e-mail addresses that do not collide and creates the unique index", () => {
    const db = openMemoryDb();
    createLegacyMasterTables(db);
    insertLegacyUser(db, "user-mixed", "  Mixed.Case@Example.TEST ", 1);
    insertLegacyUser(db, "user-plain", "plain@example.test", 2);

    const { warnCalls } = runMigrationQuietly(db);

    expect(warnCalls).toEqual([]);
    expect(emailsById(db)).toEqual({
      "user-mixed": "mixed.case@example.test",
      "user-plain": "plain@example.test"
    });
    expect(emailIndex(db)?.unique).toBe(1);
  });

  test("with pre-seeded case duplicates: starts, logs the ids, and creates a non-unique index", () => {
    const db = openMemoryDb();
    createLegacyMasterTables(db);
    insertLegacyUser(db, "user-dup-upper", "Dup@Example.test", 1);
    insertLegacyUser(db, "user-dup-lower", "dup@example.test", 2);
    insertLegacyUser(db, "user-dup-padded", " DUP@example.test", 3);
    insertLegacyUser(db, "user-other", "Other@Example.test", 4);

    const { warnCalls, errorCalls } = runMigrationQuietly(db);

    expect(errorCalls).toEqual([]);
    // Colliding rows are left as they are; the others are normalised.
    expect(emailsById(db)).toEqual({
      "user-dup-lower": "dup@example.test",
      "user-dup-padded": " DUP@example.test",
      "user-dup-upper": "Dup@Example.test",
      "user-other": "other@example.test"
    });
    expect(emailIndex(db)?.unique).toBe(0);
    expect(warnCalls).toHaveLength(1);
    expect(warnCalls[0][1]).toEqual({
      duplicateUserIds: [["user-dup-lower", "user-dup-padded", "user-dup-upper"]]
    });
    // Ids only: the addresses themselves stay out of the log.
    expect(JSON.stringify(warnCalls[0])).not.toContain("example.test");

    // A second start is just as safe and keeps the non-unique index.
    const second = runMigrationQuietly(db);
    expect(second.errorCalls).toEqual([]);
    expect(second.warnCalls).toHaveLength(1);
    expect(emailIndex(db)?.unique).toBe(0);
  });

  test("replaces the non-unique index once the duplicates are resolved", () => {
    const db = openMemoryDb();
    createLegacyMasterTables(db);
    insertLegacyUser(db, "user-dup-upper", "Dup@Example.test", 1);
    insertLegacyUser(db, "user-dup-lower", "dup@example.test", 2);
    runMigrationQuietly(db);
    expect(emailIndex(db)?.unique).toBe(0);

    db.prepare(`DELETE FROM users WHERE id = ?`).run("user-dup-lower");
    const { warnCalls } = runMigrationQuietly(db);

    expect(warnCalls).toEqual([]);
    expect(emailsById(db)).toEqual({ "user-dup-upper": "dup@example.test" });
    expect(emailIndex(db)?.unique).toBe(1);
  });
});


test("MCP mapping migration is additive/idempotent and token deletion cleans mappings without FK pragma", () => {
  const db = openMemoryDb();
  createLegacyMasterTables(db);
  db.exec("INSERT INTO mcp_tokens(id,accountId,createdByUserId,label,tokenHash,tokenSuffix,createdAt) VALUES ('legacy','primary','synthetic','Synthetic','synthetic-hash','123456',1)");
  runMigrationQuietly(db);
  runMigrationQuietly(db);
  expect(db.prepare("SELECT accountId,scopes FROM mcp_tokens WHERE id='legacy'").get()).toEqual({ accountId: "primary", scopes: null });
  expect(db.prepare("SELECT * FROM mcp_token_accounts").all()).toEqual([]);
  db.exec("INSERT INTO mcp_token_accounts VALUES ('legacy','primary')");
  expect(() => db.exec("INSERT INTO mcp_token_accounts VALUES ('legacy','primary')")).toThrow("UNIQUE constraint");
  db.exec("INSERT INTO mcp_token_accounts VALUES ('legacy','shared')");
  db.exec("DELETE FROM mcp_tokens WHERE id='legacy'");
  expect(db.prepare("SELECT * FROM mcp_token_accounts").all()).toEqual([]);
});
