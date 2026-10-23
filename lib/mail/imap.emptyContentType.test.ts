import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Keep the real IMAP/parser/DB graph separate from the pool unit tests' mocks.
test("full sync resumes past an attachment with an empty MIME content type", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ["-e", String.raw`
    import assert from "node:assert/strict";
    import { mkdtempSync, rmSync } from "node:fs";
    import { tmpdir } from "node:os";
    import { join } from "node:path";
    const dir = mkdtempSync(join(tmpdir(), "empty-content-type-sync-"));
    process.env.NOCTUA_DATA_DIR = dir;
    process.env.IMAP_CREDENTIALS_STORAGE = "db";
    process.env.IMAP_SECRET_KEY = "synthetic-empty-content-type-secret-32-chars";
    process.env.NOCTUA_MAILBOX_WATCHER = "0";
    const { startImapServer } = await import("./lib/testFixtures/mail/imap-server");
    const db = await import("./lib/db");
    const { runSyncOperation } = await import("./lib/syncOperation");
    const { drainImapConnectionPool } = await import("./lib/mail/imap/connectionPool");
    const { simpleParser } = await import("mailparser");
    const { extractAttachmentBufferFromSource, extractIcsSourceFromEmailSource,
      mergeAttachmentMetadataFromParsedAttachments } = await import("./lib/mail/attachmentFromSource");
    const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic" });
    const source = (uid, contentType = "") => [
      "From: sender@example.test", "To: team@example.test",
      "Message-ID: <empty-type-" + uid + "@example.test>",
      "Subject: Synthetic MIME regression", "MIME-Version: 1.0",
      "Content-Type: multipart/mixed; boundary=regression", "",
      "--regression", "Content-Type: text/plain", "", "Synthetic message",
      "--regression", "Content-Type: " + contentType,
      "Content-Disposition: attachment; filename=synthetic.pdf",
      "Content-Transfer-Encoding: base64", "", "U3ludGhldGljIFBERg==", "--regression--", ""
    ].join("\r\n");
    try {
      const raw = source(7811);
      const parsed = await simpleParser(raw);
      // mailsplit uses false for a present but empty Content-Type header;
      // mailparser's declared string type does not describe this runtime value.
      assert.equal(parsed.attachments[0].contentType, false);
      const inbox = server.store.get("INBOX");
      inbox.messages.length = 0;
      inbox.uidNext = 7810;
      server.store.append("INBOX", Buffer.from(source(7810, "application/pdf")));
      server.store.append("INBOX", Buffer.from(raw));
      server.store.append("INBOX", Buffer.from(source(7812, "application/pdf")));
      const endpoint = { host: "127.0.0.1", port: server.port, secure: false,
        user: "team@example.test", password: "synthetic" };
      const account = { id: "synthetic-empty-type", name: "Synthetic", email: "team@example.test",
        avatar: "", imap: endpoint, smtp: endpoint };
      await db.upsertAccount(account);
      const folderId = account.id + ":INBOX";
      await db.saveFoldersForAccount(account.id, [{ id: folderId, accountId: account.id,
        name: "INBOX", count: 0, unreadCount: 0 }]);
      await db.saveMailboxState({ accountId: account.id, folderId, mailboxPath: "INBOX",
        uidValidity: String(inbox.uidValidity), highestUid: 7810 });
      const progress = [];
      const result = await runSyncOperation({ accountId: account.id, folderId,
        mode: "full", fullSync: true, resumeFromUid: 7810 }, undefined,
        { onProgress: item => progress.push(item) });
      assert.equal(result.count, 2);
      assert.equal(result.highestProcessedUid, 7812);
      assert.equal((await db.getMailboxState(account.id, folderId)).highestUid, 7812);
      assert(progress.some(item => item.highestProcessedUid === 7812));
      const rows = await db.withAccountDb(account.id, shard => shard.query(
        "SELECT imapUid FROM messages WHERE accountId=? ORDER BY imapUid").all(account.id));
      assert.deepEqual(rows.map(row => row.imapUid), [7811, 7812]);

      const target = { id: "att-synthetic-7811-0", filename: "synthetic.pdf", contentType: "application/pdf" };
      assert.equal((await extractAttachmentBufferFromSource(raw, target)).toString(), "Synthetic PDF");
      assert.equal(mergeAttachmentMetadataFromParsedAttachments([target], parsed.attachments)[0].contentType,
        "application/pdf");
      // CID selection bypasses type matching but must not call .trim() on false either.
      assert.equal(mergeAttachmentMetadataFromParsedAttachments([{ ...target, cid: "synthetic@example.test" }],
        [{ ...parsed.attachments[0], contentId: "<synthetic@example.test>" }])[0].contentType, "application/pdf");
      assert.equal(await extractIcsSourceFromEmailSource(raw), null);
      const calendar = raw.replace("synthetic.pdf", "synthetic.ics").replace("U3ludGhldGljIFBERg==",
        Buffer.from("BEGIN:VCALENDAR\r\nEND:VCALENDAR").toString("base64"));
      assert.equal(await extractIcsSourceFromEmailSource(calendar), "BEGIN:VCALENDAR\r\nEND:VCALENDAR");
      console.log("EMPTY_CONTENT_TYPE_SYNC PASS: resumed 7811..7812; cursor persisted; extraction and calendar checked");
    } finally {
      await drainImapConnectionPool();
      await server.stop();
      db.closeAllDbConnections();
      rmSync(dir, { recursive: true, force: true });
    }
  `], { cwd: process.cwd(), env: process.env, timeout: 20_000, maxBuffer: 1024 * 1024 });
  expect(stdout).toContain("EMPTY_CONTENT_TYPE_SYNC PASS");
}, 25_000);
