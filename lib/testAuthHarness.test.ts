import { expect, spyOn, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { existsSync, readdirSync, readlinkSync } from "fs";
import path from "path";
import { createTestAuthHarness } from "./testAuthHarness";

test("throwing options callback closes both harness DB handles and removes storage", async () => {
  let database: Database | undefined;
  let dir = "";
  const openFiles = () => readdirSync("/proc/self/fd").flatMap(fd => {
    try { return [readlinkSync(`/proc/self/fd/${fd}`)]; }
    catch { return []; } // A descriptor may close between directory listing and readlink.
  }).filter(file => file.startsWith(`${dir}/`));
  const failure = new Error("synthetic harness configuration failure");
  await expect(createTestAuthHarness(options => {
    database = options.database as unknown as Database;
    dir = path.dirname(database.prepare("PRAGMA database_list").get().file);
    expect(existsSync(dir)).toBe(true);
    if (existsSync("/proc/self/fd")) {
      // Prove the check covers both the master and dedicated auth connection.
      expect(openFiles().filter(file => file === path.join(dir, "main.db"))).toHaveLength(2);
    }
    throw failure;
  })).rejects.toBe(failure);
  expect(dir).not.toBe("");
  expect(existsSync(dir)).toBe(false);
  expect(() => database!.prepare("SELECT 1")).toThrow();
  // Bun uses sqlite3_close_v2: temporary prepare() statements from schema
  // setup defer physical closure until finalized. Keep the auth handle alive
  // above to prove explicit close(), then collect statements before the FD check.
  (globalThis as unknown as { Bun: { gc(force: boolean): void } }).Bun.gc(true);
  if (existsSync("/proc/self/fd")) expect(openFiles()).toEqual([]);
});


test("fixture user and credential inserts yield through contention without replaying committed users", async () => {
  const f = await createTestAuthHarness();
  const context = await f.auth.$context;
  const original = context.internalAdapter.linkAccount.bind(context.internalAdapter);
  let credentialAttempts = 0;
  let unlock: ReturnType<typeof setTimeout> | undefined;
  let locked = false;
  const holdWriter = () => {
    f.master.exec("BEGIN IMMEDIATE");
    locked = true;
    unlock = setTimeout(() => {
      f.master.exec("ROLLBACK");
      locked = false;
    }, 25);
  };
  const link = spyOn(context.internalAdapter, "linkAccount").mockImplementation(async account => {
    if (++credentialAttempts === 1) holdWriter();
    return original(account);
  });
  try {
    holdWriter();
    const user = await f.createUser("contended-fixture@example.test");
    expect(credentialAttempts).toBeGreaterThan(1);
    expect(f.master.prepare("SELECT COUNT(*) AS n FROM auth_user WHERE email=?").get(user.email).n).toBe(1);
    expect(f.master.prepare("SELECT COUNT(*) AS n FROM auth_account WHERE userId=? AND providerId='credential'").get(user.id).n).toBe(1);
    expect(f.master.prepare("PRAGMA busy_timeout").get().timeout).toBe(0);
    expect(f.database.prepare("PRAGMA busy_timeout").get().timeout).toBe(0);
    const { session } = await f.signIn(user.email);
    expect(session?.user.id).toBe(user.id);
  } finally {
    if (unlock) clearTimeout(unlock);
    if (locked) f.master.exec("ROLLBACK");
    link.mockRestore();
    f.close();
  }
});
