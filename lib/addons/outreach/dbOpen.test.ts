import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeOutreachDb, getOutreachDb, getOutreachDbPath, initOutreachSchema, OUTREACH_SCHEMA_VERSION } from "./db";
import { removeHistorySchema } from "./testFixtures/legacySchema";

const previousDataDir = process.env.NOCTUA_DATA_DIR;
let dir: string;

beforeEach(() => {
  closeOutreachDb();
  dir = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "outreach-db-open-"));
  process.env.NOCTUA_DATA_DIR = dir;
});
afterEach(() => {
  closeOutreachDb();
  if (previousDataDir === undefined) delete process.env.NOCTUA_DATA_DIR;
  else process.env.NOCTUA_DATA_DIR = previousDataDir;
  rmSync(dir, { recursive: true, force: true });
});

test("AL: concurrent first calls share one handle, and a close leaves none open", async () => {
  const [first, second, third] = await Promise.all([getOutreachDb(), getOutreachDb(), getOutreachDb()]);
  expect(second).toBe(first);
  expect(third).toBe(first);
  closeOutreachDb();
  expect(() => first.query("SELECT 1").get()).toThrow();
  // A close while an open is in flight hands out a fresh, open handle.
  const pending = getOutreachDb();
  closeOutreachDb();
  const reopened = await pending;
  expect(reopened.query("SELECT 1 AS one").get()).toEqual({ one: 1 });
  expect(await getOutreachDb()).toBe(reopened);
});

test("AL: a migration reads the schema version under the write lock", async () => {
  const { Database } = await import("bun:sqlite");
  const file = getOutreachDbPath();
  // An outreach.db at v3 without the later columns and indexes.
  const old = initOutreachSchema(await getOutreachDb());
  removeHistorySchema(old);
  old.exec(`ALTER TABLE campaigns DROP COLUMN scheduledVia; ALTER TABLE sequences DROP COLUMN statusChangedVia;
    PRAGMA user_version = 3;`);
  closeOutreachDb();

  // Another process takes the write lock first and migrates the file while this one waits for it.
  const other = Bun.spawn([process.execPath, "-e", `
    const { Database } = require("bun:sqlite");
    const db = new Database(process.argv[1]);
    db.exec("PRAGMA busy_timeout = 15000; BEGIN IMMEDIATE");
    console.log("locked");
    Bun.sleepSync(400);
    db.exec("ALTER TABLE campaigns ADD COLUMN scheduledVia TEXT; ALTER TABLE sequences ADD COLUMN statusChangedVia TEXT; PRAGMA user_version = 4; COMMIT");
    db.close();
  `, file], { stdout: "pipe", stderr: "inherit" });
  const reader = other.stdout.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toContain("locked");
  const handle = new Database(file);
  try {
    expect(() => initOutreachSchema(handle)).not.toThrow();
    expect(handle.query("PRAGMA user_version").get()).toEqual({ user_version: OUTREACH_SCHEMA_VERSION });
  } finally {
    handle.close();
    reader.releaseLock();
    expect(await other.exited).toBe(0);
  }
});
