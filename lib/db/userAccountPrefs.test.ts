import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import type { Account } from "../data";
import { getMainDbPath } from "../runtimePaths";
import { dbModulePromise } from "../testDbHarness";

const {
  deleteAccountControlPlane,
  deleteUserAccountPrefsForAccount,
  deleteUserAccountPrefsForUser,
  getUserAccountPrefs,
  mergeUserAccountPrefs,
  upsertAccount
} = await dbModulePromise;

function ids() {
  return { userId: randomUUID(), accountId: `acc-prefs-${randomUUID()}` };
}

// Reads the raw row through a second connection to the harness master DB;
// the module API deliberately exposes only the sparse prefs object.
function readStoredRow(userId: string, accountId: string) {
  const db = new Database(getMainDbPath());
  try {
    return db
      .prepare(`SELECT prefs, updatedAt FROM user_account_prefs WHERE userId = ? AND accountId = ?`)
      .get(userId, accountId) as { prefs: string; updatedAt: number } | null;
  } finally {
    db.close();
  }
}

describe("getUserAccountPrefs", () => {
  test("returns an empty object when nothing is stored", async () => {
    const { userId, accountId } = ids();
    expect(await getUserAccountPrefs(userId, accountId)).toEqual({});
  });
});

describe("mergeUserAccountPrefs", () => {
  test("writes only the keys present and stamps updatedAt", async () => {
    const { userId, accountId } = ids();
    const before = Date.now();

    const stored = await mergeUserAccountPrefs(userId, accountId, {
      layout: { defaultView: "table" },
      defaultSignatureId: "sig-1"
    });

    expect(stored).toEqual({ layout: { defaultView: "table" }, defaultSignatureId: "sig-1" });
    expect(await getUserAccountPrefs(userId, accountId)).toEqual(stored);
    const row = readStoredRow(userId, accountId);
    expect(JSON.parse(row!.prefs)).toEqual(stored);
    expect(row!.updatedAt).toBeGreaterThanOrEqual(before);
  });

  test("deep-merges nested objects and keeps untouched siblings", async () => {
    const { userId, accountId } = ids();
    await mergeUserAccountPrefs(userId, accountId, {
      appearance: { dateFormat: "dmy", senderIcons: false },
      calendar: { weekStartsOn: "sunday" }
    });

    const merged = await mergeUserAccountPrefs(userId, accountId, {
      appearance: { topicColorRows: false, senderIcons: true }
    });

    expect(merged).toEqual({
      appearance: { dateFormat: "dmy", senderIcons: true, topicColorRows: false },
      calendar: { weekStartsOn: "sunday" }
    });
  });

  test("null deletes a key and objects left empty are dropped", async () => {
    const { userId, accountId } = ids();
    await mergeUserAccountPrefs(userId, accountId, {
      appearance: { dateFormat: "ymd", senderIcons: false },
      threading: { includeAcrossFolders: false },
      defaultSignatureId: "sig-2"
    });

    const merged = await mergeUserAccountPrefs(userId, accountId, {
      appearance: { dateFormat: null },
      threading: { includeAcrossFolders: null },
      defaultSignatureId: null,
      layout: {}
    });
    expect(merged).toEqual({ appearance: { senderIcons: false } });

    expect(await mergeUserAccountPrefs(userId, accountId, { appearance: null })).toEqual({});
    expect(await getUserAccountPrefs(userId, accountId)).toEqual({});
  });

  test("ignores prototype keys", async () => {
    const { userId, accountId } = ids();
    const merged = await mergeUserAccountPrefs(
      userId,
      accountId,
      JSON.parse('{"__proto__":{"polluted":true},"layout":{"constructor":{"x":1},"defaultView":"card"}}')
    );
    expect(merged).toEqual({ layout: { defaultView: "card" } });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(await getUserAccountPrefs(userId, accountId)).toEqual({ layout: { defaultView: "card" } });
  });

  test("keeps users and mailboxes apart", async () => {
    const { userId, accountId } = ids();
    const otherUserId = randomUUID();
    const otherAccountId = `acc-prefs-${randomUUID()}`;
    await mergeUserAccountPrefs(userId, accountId, { layout: { defaultView: "table" } });
    await mergeUserAccountPrefs(otherUserId, accountId, { layout: { defaultView: "compact" } });
    await mergeUserAccountPrefs(userId, otherAccountId, { layout: { defaultView: "threads" } });

    expect(await getUserAccountPrefs(userId, accountId)).toEqual({ layout: { defaultView: "table" } });
    expect(await getUserAccountPrefs(otherUserId, accountId)).toEqual({
      layout: { defaultView: "compact" }
    });
    expect(await getUserAccountPrefs(userId, otherAccountId)).toEqual({
      layout: { defaultView: "threads" }
    });
  });

  test("concurrent patches do not drop each other's keys", async () => {
    const { userId, accountId } = ids();
    await Promise.all([
      mergeUserAccountPrefs(userId, accountId, { layout: { defaultView: "table" } }),
      mergeUserAccountPrefs(userId, accountId, { appearance: { senderIcons: false } }),
      mergeUserAccountPrefs(userId, accountId, { calendar: { weekStartsOn: "monday" } })
    ]);
    expect(await getUserAccountPrefs(userId, accountId)).toEqual({
      layout: { defaultView: "table" },
      appearance: { senderIcons: false },
      calendar: { weekStartsOn: "monday" }
    });
  });
});

describe("deleting preferences", () => {
  test("deleteUserAccountPrefsForUser removes every mailbox of one user", async () => {
    const { userId, accountId } = ids();
    const otherUserId = randomUUID();
    const otherAccountId = `acc-prefs-${randomUUID()}`;
    await mergeUserAccountPrefs(userId, accountId, { defaultSignatureId: "a" });
    await mergeUserAccountPrefs(userId, otherAccountId, { defaultSignatureId: "b" });
    await mergeUserAccountPrefs(otherUserId, accountId, { defaultSignatureId: "c" });

    expect(await deleteUserAccountPrefsForUser(userId)).toBe(2);
    expect(await getUserAccountPrefs(userId, accountId)).toEqual({});
    expect(await getUserAccountPrefs(userId, otherAccountId)).toEqual({});
    expect(await getUserAccountPrefs(otherUserId, accountId)).toEqual({ defaultSignatureId: "c" });
  });

  test("deleteUserAccountPrefsForAccount removes every user of one mailbox", async () => {
    const { userId, accountId } = ids();
    const otherUserId = randomUUID();
    const otherAccountId = `acc-prefs-${randomUUID()}`;
    await mergeUserAccountPrefs(userId, accountId, { defaultSignatureId: "a" });
    await mergeUserAccountPrefs(otherUserId, accountId, { defaultSignatureId: "b" });
    await mergeUserAccountPrefs(userId, otherAccountId, { defaultSignatureId: "c" });

    expect(await deleteUserAccountPrefsForAccount(accountId)).toBe(2);
    expect(await getUserAccountPrefs(otherUserId, accountId)).toEqual({});
    expect(await getUserAccountPrefs(userId, otherAccountId)).toEqual({ defaultSignatureId: "c" });
  });

  test("deleting a mailbox deletes its preference rows", async () => {
    const { userId, accountId } = ids();
    const account: Account = {
      id: accountId,
      name: "Prefs Test",
      email: `${accountId}@example.test`,
      avatar: "PT",
      imap: { host: "imap.example.test", port: 993, secure: true, user: "u", password: "p" },
      smtp: { host: "smtp.example.test", port: 465, secure: true, user: "u", password: "p" }
    };
    await upsertAccount(account);
    await mergeUserAccountPrefs(userId, accountId, { layout: { defaultView: "table" } });

    expect(await deleteAccountControlPlane(accountId)).toBe(true);
    expect(readStoredRow(userId, accountId)).toBeNull();
  });
});
