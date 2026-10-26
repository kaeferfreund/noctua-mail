import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { createCollabFixture } from "../testThreadCollabHarness";
import { getDefaultAccountDbPath, getMainDbPath } from "../runtimePaths";
import { AccountNotFoundError, getAccountDb, closeAccountDbConnection } from "./connection";
import { setMailboxWatcherState, recordMailboxSync } from "./mailboxSummary";

test("unknown accounts cannot create a shard", async () => {
  const f = await createCollabFixture();
  const id = `unknown-${crypto.randomUUID()}`;
  await expect(getAccountDb(id)).rejects.toBeInstanceOf(AccountNotFoundError);
  await expect(f.api.getFolders(id)).rejects.toBeInstanceOf(AccountNotFoundError);
  expect(existsSync(getDefaultAccountDbPath(id))).toBe(false);
});

test("late watcher, sync, spam and reminder accesses cannot recreate a deleted shard", async () => {
  const f = await createCollabFixture();
  const file = getDefaultAccountDbPath(f.accountId);
  expect(existsSync(file)).toBe(true);
  expect(await f.api.deleteAccountControlPlane(f.accountId)).toBe(true);
  expect(existsSync(file)).toBe(false);
  const stale = [
    () => setMailboxWatcherState(f.accountId, "stopped"),
    () => recordMailboxSync(f.accountId),
    () => f.api.getMailboxState(f.accountId, f.folderId),
    () => f.api.getSenderProfile(f.accountId, "sender@example.test"),
    () => f.api.listCalendarReminders(f.accountId, "synthetic-user")
  ];
  for (const run of stale) {
    await expect(run()).rejects.toBeInstanceOf(AccountNotFoundError);
    expect(existsSync(file)).toBe(false);
  }
});

test("a deletion on another master connection invalidates cached account paths", async () => {
  const f = await createCollabFixture();
  await getAccountDb(f.accountId); // Prime the path and connection caches.
  const otherMaster = new Database(getMainDbPath());
  try { otherMaster.prepare("DELETE FROM accounts WHERE id=?").run(f.accountId); }
  finally { otherMaster.close(); }
  await expect(getAccountDb(f.accountId)).rejects.toBeInstanceOf(AccountNotFoundError);
  closeAccountDbConnection(getDefaultAccountDbPath(f.accountId));
});
