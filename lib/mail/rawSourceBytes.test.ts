import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Real IMAP fixture, sync, storage and copy graph in a child process, so no
// module mocks of other test files can leak in (same pattern as
// imap.emptyContentType.test.ts).
test("8bit Latin-1 source bytes survive sync, attachment extraction and copy unchanged", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ["-e", String.raw`
    import assert from "node:assert/strict";
    import { mkdtempSync, rmSync } from "node:fs";
    import { tmpdir } from "node:os";
    import { join } from "node:path";
    const dir = mkdtempSync(join(tmpdir(), "raw-source-bytes-"));
    process.env.NOCTUA_DATA_DIR = dir;
    process.env.IMAP_CREDENTIALS_STORAGE = "db";
    process.env.IMAP_SECRET_KEY = "synthetic-raw-source-bytes-secret-32chars";
    process.env.NOCTUA_MAILBOX_WATCHER = "0";
    const { startImapServer } = await import("./lib/testFixtures/mail/imap-server");
    const db = await import("./lib/db");
    const { runSyncOperation } = await import("./lib/syncOperation");
    const { drainImapConnectionPool } = await import("./lib/mail/imap/connectionPool");
    const { deleteAttachmentData, getMessageSource, getMessageSourceBuffer } = await import("./lib/storage");
    const { readStoredAttachmentData } = await import("./lib/mail/storedAttachmentData");
    const { copyMessageToAccount } = await import("./lib/crossAccountCopy");
    const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic" });

    // Latin-1 bytes that are not valid UTF-8; 8bit and binary parts carry them unencoded.
    const csv = Buffer.from("Name;Straße\r\nMüller;Hauptstraße 1\r\n", "latin1");
    const binary = Buffer.from([0xc4, 0xd6, 0xdc, 0xe4, 0xf6, 0xfc, 0xdf, 0xa7, 0xb0, 0x80, 0xff]);
    const raw = Buffer.concat([
      Buffer.from([
        "From: sender@example.test", "To: team@example.test",
        "Message-ID: <raw-bytes-1@example.test>", "Subject: Synthetic Latin-1 export",
        "Date: Thu, 19 Nov 2026 10:00:00 +0100", "MIME-Version: 1.0",
        "Content-Type: multipart/mixed; boundary=latin1", "",
        "--latin1", "Content-Type: text/plain; charset=iso-8859-1", "Content-Transfer-Encoding: 8bit", "", ""
      ].join("\r\n")),
      Buffer.from("Grüße aus Köln\r\n", "latin1"),
      Buffer.from([
        "--latin1", "Content-Type: text/csv; charset=iso-8859-1; name=liste.csv",
        "Content-Disposition: attachment; filename=liste.csv", "Content-Transfer-Encoding: 8bit", "", ""
      ].join("\r\n")),
      csv,
      Buffer.from([
        "", "--latin1", "Content-Type: application/octet-stream; name=daten.bin",
        "Content-Disposition: attachment; filename=daten.bin", "Content-Transfer-Encoding: binary", "", ""
      ].join("\r\n")),
      binary,
      Buffer.from("\r\n--latin1--\r\n")
    ]);
    assert.notDeepEqual(Buffer.from(raw.toString("utf8")), raw, "fixture must not survive a UTF-8 round trip");

    try {
      const inbox = server.store.get("INBOX");
      inbox.messages.length = 0;
      inbox.uidNext = 9100;
      server.store.append("INBOX", raw);
      const endpoint = { host: "127.0.0.1", port: server.port, secure: false,
        user: "team@example.test", password: "synthetic" };
      const account = { id: "synthetic-raw-bytes", name: "Synthetic", email: "team@example.test",
        avatar: "", imap: endpoint, smtp: endpoint };
      const destination = { ...account, id: "synthetic-raw-bytes-copy", name: "Synthetic copy" };
      await db.upsertAccount(account);
      await db.upsertAccount(destination);
      const folderId = account.id + ":INBOX";
      await db.saveFoldersForAccount(account.id, [{ id: folderId, accountId: account.id,
        name: "INBOX", count: 0, unreadCount: 0 }]);
      await db.saveFoldersForAccount(destination.id, [{ id: destination.id + ":Archive", accountId: destination.id,
        name: "Archive", count: 0, unreadCount: 0, specialUse: "\\Archive" }]);
      const result = await runSyncOperation({ accountId: account.id, folderId, mode: "full", fullSync: true });
      assert.equal(result.count, 1);

      // Sync: the cached file holds the wire bytes, and the recorded size is their length.
      const row = await db.withAccountDb(account.id, shard => shard.query(
        "SELECT id, sizeBytes, body FROM messages WHERE accountId=? AND imapUid=9100").get(account.id));
      assert.ok(row, "synced row");
      assert.ok((await getMessageSourceBuffer(account.id, row.id)).equals(raw), "stored source bytes unchanged");
      assert.equal(row.sizeBytes, raw.length);
      assert.match(row.body, /Grüße aus Köln/);
      // The text view (display) still reads the stored file.
      assert.match(await getMessageSource(account.id, row.id), /Subject: Synthetic Latin-1 export/);

      // Extraction: drop the cached parts so they are cut out of the stored source again.
      const attachments = await db.withAccountDb(account.id, shard => shard.query(
        "SELECT id, filename, contentType FROM attachments WHERE accountId=? AND messageId=? ORDER BY filename")
        .all(account.id, row.id));
      assert.deepEqual(attachments.map(item => item.filename), ["daten.bin", "liste.csv"]);
      for (const attachment of attachments) await deleteAttachmentData(account.id, row.id, attachment.id);
      const extracted = Object.fromEntries(await Promise.all(attachments.map(async attachment =>
        [attachment.filename, await readStoredAttachmentData(account.id, row.id, attachment)])));
      assert.ok(extracted["liste.csv"]?.equals(csv), "8bit CSV attachment bytes unchanged");
      assert.ok(extracted["daten.bin"]?.equals(binary), "binary attachment bytes unchanged");

      // Copy: APPEND uploads the stored bytes unchanged.
      const message = await db.getMessageById(account.id, row.id);
      const archive = server.store.get("Archive");
      const before = archive.messages.length;
      await copyMessageToAccount({ sourceAccount: account, sourceAccountId: account.id, message,
        destinationAccount: destination, destinationMailboxPath: "Archive" });
      assert.equal(archive.messages.length, before + 1);
      assert.ok(archive.messages.at(-1).mime.raw.equals(raw), "appended bytes unchanged");
      console.log("RAW_SOURCE_BYTES PASS");
    } finally {
      await drainImapConnectionPool();
      await server.stop();
      db.closeAllDbConnections();
      rmSync(dir, { recursive: true, force: true });
    }
  `], { cwd: process.cwd(), env: process.env, timeout: 20_000, maxBuffer: 1024 * 1024 });
  expect(stdout).toContain("RAW_SOURCE_BYTES PASS");
}, 25_000);
