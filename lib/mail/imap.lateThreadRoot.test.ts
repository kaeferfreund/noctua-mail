import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Conversation window 5.10: an INBOX reply synced before its Archive thread kept a
// thread of its own. Real IMAP fixture, parser, sync and DB in a separate process.
test("a reply synced before its thread root joins the thread when the root arrives", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ["-e", String.raw`
    import assert from "node:assert/strict";
    import { mkdtempSync, rmSync } from "node:fs";
    import { tmpdir } from "node:os";
    import { join } from "node:path";
    const dir = mkdtempSync(join(tmpdir(), "late-thread-root-"));
    process.env.NOCTUA_DATA_DIR = dir;
    process.env.IMAP_CREDENTIALS_STORAGE = "db";
    process.env.IMAP_SECRET_KEY = "synthetic-late-thread-root-secret-32-chars";
    process.env.NOCTUA_MAILBOX_WATCHER = "0";
    const { startImapServer } = await import("./lib/testFixtures/mail/imap-server");
    const db = await import("./lib/db");
    const { runSyncOperation } = await import("./lib/syncOperation");
    const { drainImapConnectionPool } = await import("./lib/mail/imap/connectionPool");
    const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic" });
    const id = name => "<late-root-" + name + "@example.test>";
    const source = (name, day, parents) => Buffer.from([
      "From: Synthetic Sender <sender@example.test>", "To: team@example.test",
      "Message-ID: " + id(name), "Date: " + new Date(Date.UTC(2026, 9, day, 9)).toUTCString(),
      "Subject: " + (parents.length ? "Re: " : "") + "Synthetic late root",
      ...(parents.length ? ["In-Reply-To: " + id(parents.at(-1)), "References: " + parents.map(id).join(" ")] : []),
      "", "Synthetic body " + name, ""
    ].join("\r\n"));
    try {
      for (const box of ["INBOX", "Archive"]) server.store.get(box).messages.length = 0;
      // Archive holds root, first and second reply; INBOX the third reply, synced first.
      server.store.append("Archive", source("root", 1, []));
      server.store.append("Archive", source("first", 2, ["root"]));
      server.store.append("Archive", source("second", 3, ["root", "first"]));
      server.store.append("INBOX", source("third", 4, ["root", "first", "second"]));
      const endpoint = { host: "127.0.0.1", port: server.port, secure: false,
        user: "team@example.test", password: "synthetic" };
      const account = { id: "synthetic-late-root", name: "Synthetic", email: "team@example.test",
        avatar: "", imap: endpoint, smtp: endpoint };
      await db.upsertAccount(account);
      await db.saveFoldersForAccount(account.id, ["INBOX", "Archive"].map(name => ({
        id: account.id + ":" + name, accountId: account.id, name, count: 0, unreadCount: 0 })));
      const rows = () => db.withAccountDb(account.id, shard => shard.query(
        "SELECT id, messageId, threadId, parentId FROM messages WHERE accountId=? ORDER BY dateValue").all(account.id));
      await runSyncOperation({ accountId: account.id, folderId: account.id + ":INBOX", mode: "full", fullSync: true });
      const orphan = await rows();
      assert.equal(orphan.length, 1);
      assert.equal(orphan[0].threadId, id("second"));
      await runSyncOperation({ accountId: account.id, folderId: account.id + ":Archive", mode: "full", fullSync: true });
      const synced = await rows();
      assert.deepEqual(synced.map(row => row.messageId), ["root", "first", "second", "third"].map(id));
      assert.deepEqual([...new Set(synced.map(row => row.threadId))], [id("root")]);
      assert.equal(synced[3].parentId, synced[2].id);
      const threads = await db.withAccountDb(account.id, shard => shard.query(
        "SELECT DISTINCT threadId FROM threads WHERE accountId=?").all(account.id));
      assert.deepEqual(threads.map(row => row.threadId), [id("root")]);
      console.log("LATE_THREAD_ROOT PASS: four messages, one thread");
    } finally {
      await drainImapConnectionPool();
      await server.stop();
      db.closeAllDbConnections();
      rmSync(dir, { recursive: true, force: true });
    }
  `], { cwd: process.cwd(), env: process.env, timeout: 20_000, maxBuffer: 1024 * 1024 });
  expect(stdout).toContain("LATE_THREAD_ROOT PASS");
}, 25_000);
