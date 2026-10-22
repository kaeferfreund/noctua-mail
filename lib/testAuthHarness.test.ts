import { expect, test } from "bun:test";
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
