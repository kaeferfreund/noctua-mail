import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { dbModulePromise } from "@/lib/testDbHarness";
import {
  cleanupAccountLifecycleArtifacts,
  closeAccountDbConnection,
  getAccountDb,
  getDb
} from "./connection";

const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

function buildAccount(accountId: string): Account {
  return {
    id: accountId,
    name: "Probe Test",
    email: "owner@example.com",
    avatar: "",
    imap: {
      host: "imap.example.com",
      port: 993,
      secure: true,
      user: "owner@example.com",
      password: "secret"
    },
    smtp: {
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "owner@example.com",
      password: "secret"
    }
  };
}

function buildFolder(accountId: string): Folder {
  return {
    id: `${accountId}-inbox`,
    accountId,
    name: "Inbox",
    count: 0,
    unreadCount: 0,
    specialUse: "\\Inbox"
  };
}

function buildMessage(accountId: string, folderId: string): Message {
  return {
    id: `${accountId}-message`,
    accountId,
    folderId,
    threadId: `${accountId}-thread`,
    messageId: `<${accountId}@example.com>`,
    subject: "Probe",
    from: "Alerts <alerts@example.test>",
    fromEmail: "alerts@example.test",
    to: "owner@example.com",
    preview: "Probe",
    date: new Date(Date.UTC(2026, 2, 2)).toISOString(),
    dateValue: Date.UTC(2026, 2, 2),
    body: "Probe"
  };
}

function isProbeSql(sql: string) {
  return (
    sql.includes("FROM messages") ||
    sql.includes("FROM thread_topics") ||
    sql.includes("FROM thread_signals") ||
    sql.includes("FROM topic_learning_signals") ||
    sql.includes("latestReceivedDateValue IS NULL")
  );
}

function insertUnsettledRows(db: any, accountId: string, folder: Folder) {
  db.prepare(
    `INSERT INTO messages (
       id, accountId, folderId, threadId, subject, fromAddr, fromEmail, toAddr,
       preview, date, dateValue, body, messageId
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `${accountId}-raw`,
    accountId,
    folder.id,
    `${accountId}-thread`,
    "Backfill",
    "Alerts <alerts@example.test>",
    "alerts@example.test",
    "owner@example.com",
    "Backfill",
    "2026-03-02T00:00:00.000Z",
    Date.UTC(2026, 2, 2),
    "Backfill",
    `<${accountId}-raw@example.com>`
  );
  db.prepare(
    `INSERT INTO threads (
       threadId, accountId, latestDateValue, latestReceivedDateValue, messageCount, unreadCount
     ) VALUES (?, ?, ?, NULL, 1, 0)`
  ).run(`${accountId}-thread`, accountId, Date.UTC(2026, 2, 2));
}

function expectBackfilled(db: any, accountId: string) {
  const signal = db
    .prepare(`SELECT signalValue FROM thread_signals WHERE accountId = ? AND signalType = ?`)
    .get(accountId, "senderEmail") as { signalValue?: string } | null;
  expect(signal?.signalValue).toBe("alerts@example.test");
  const thread = db
    .prepare(`SELECT latestReceivedDateValue FROM threads WHERE accountId = ?`)
    .get(accountId) as { latestReceivedDateValue?: number | null };
  expect(typeof thread.latestReceivedDateValue).toBe("number");
}

async function settledAccount() {
  const accountId = `acc-settled-${crypto.randomUUID()}`;
  const folder = buildFolder(accountId);
  await upsertAccount(buildAccount(accountId));
  await saveFoldersForAccount(accountId, [folder]);
  await upsertMessages(accountId, folder.id, [buildMessage(accountId, folder.id)], true);
  const db = await getAccountDb(accountId);
  const dbPath = db.prepare(`PRAGMA database_list`).get().file as string;
  return { accountId, db, dbPath };
}

function unsetBackfills(db: any, accountId: string) {
  db.prepare(`DELETE FROM thread_signals WHERE accountId = ?`).run(accountId);
  db.prepare(`UPDATE threads SET latestReceivedDateValue = NULL WHERE accountId = ?`).run(accountId);
}

describe("getAccountDb runtime probes", () => {
  test("backfills an unsettled shard once, then skips the probe queries", async () => {
    const accountId = `acc-probes-${crypto.randomUUID()}`;
    const folder = buildFolder(accountId);
    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    const db = await getAccountDb(accountId);
    insertUnsettledRows(db, accountId, folder);

    await getAccountDb(accountId);

    expectBackfilled(db, accountId);

    const originalPrepare = db.prepare.bind(db);
    const originalQuery = db.query.bind(db);
    let probePrepares = 0;
    db.prepare = ((sql: string) => {
      if (isProbeSql(sql)) probePrepares += 1;
      return originalPrepare(sql);
    }) as typeof db.prepare;
    db.query = ((sql: string) => {
      if (isProbeSql(sql)) probePrepares += 1;
      return originalQuery(sql);
    }) as typeof db.query;
    try {
      await getAccountDb(accountId);
      await getAccountDb(accountId);
      expect(probePrepares).toBe(0);
    } finally {
      db.prepare = originalPrepare;
      db.query = originalQuery;
    }
  });

  test("reuses the resolved account db path", async () => {
    const accountId = `acc-path-${crypto.randomUUID()}`;
    const folder = buildFolder(accountId);
    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);
    await upsertMessages(accountId, folder.id, [buildMessage(accountId, folder.id)], true);
    await getAccountDb(accountId);

    const master = await getDb();
    const originalPrepare = master.prepare.bind(master);
    let pathReads = 0;
    master.prepare = ((sql: string) => {
      if (sql.includes("SELECT id, dbPath FROM accounts WHERE id = ?")) pathReads += 1;
      return originalPrepare(sql);
    }) as typeof master.prepare;
    try {
      await getAccountDb(accountId);
      await getAccountDb(accountId);
      expect(pathReads).toBe(0);
    } finally {
      master.prepare = originalPrepare;
    }
  });

  test("rechecks settled backfills after closing and reopening a shard", async () => {
    const { accountId, db, dbPath } = await settledAccount();
    unsetBackfills(db, accountId);
    closeAccountDbConnection(dbPath);

    const reopened = await getAccountDb(accountId);
    expect(reopened).not.toBe(db);
    expectBackfilled(reopened, accountId);
  });

  test("resolves the current shard path after closing its cached connection", async () => {
    const { accountId, dbPath } = await settledAccount();
    closeAccountDbConnection(dbPath);
    const replacementPath = `${dbPath}.replacement`;
    const master = await getDb();
    master.prepare(`UPDATE accounts SET dbPath = ? WHERE id = ?`).run(replacementPath, accountId);

    const reopened = await getAccountDb(accountId);
    expect(reopened.prepare(`PRAGMA database_list`).get().file).toBe(replacementPath);
  });

  test("lifecycle cleanup invalidates readiness and the path even for a retained shard", async () => {
    const { accountId, db, dbPath } = await settledAccount();
    unsetBackfills(db, accountId);
    await cleanupAccountLifecycleArtifacts(accountId, dbPath, false);
    expect(await getAccountDb(accountId)).toBe(db);
    expectBackfilled(db, accountId);

    const replacementPath = `${dbPath}.replacement`;
    const master = await getDb();
    master.prepare(`UPDATE accounts SET dbPath = ? WHERE id = ?`).run(replacementPath, accountId);
    await cleanupAccountLifecycleArtifacts(accountId, dbPath, false);
    const reopened = await getAccountDb(accountId);
    expect(reopened.prepare(`PRAGMA database_list`).get().file).toBe(replacementPath);
  });

  test("live path changes share a shard, settle independently and both recheck after close", async () => {
    const first = await settledAccount();
    const accountId = `acc-shared-${crypto.randomUUID()}`;
    const folder = buildFolder(accountId);
    await upsertAccount(buildAccount(accountId));
    const master = await getDb();
    master.prepare(`UPDATE accounts SET dbPath = ? WHERE id = ?`).run(first.dbPath, accountId);
    await saveFoldersForAccount(accountId, [folder]);
    insertUnsettledRows(first.db, accountId, folder);

    expect(await getAccountDb(accountId)).toBe(first.db);
    expectBackfilled(first.db, accountId);
    unsetBackfills(first.db, first.accountId);
    unsetBackfills(first.db, accountId);
    closeAccountDbConnection(first.dbPath);

    expectBackfilled(await getAccountDb(first.accountId), first.accountId);
    expectBackfilled(await getAccountDb(accountId), accountId);
  });
});
