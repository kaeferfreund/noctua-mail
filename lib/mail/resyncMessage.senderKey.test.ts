import { expect, test } from "bun:test";
import { createCollabFixture } from "../testThreadCollabHarness";
import { buildImapMessageRowId } from "../messageIds";
import { buildFolderId } from "./imap/_shared";
import { drainImapConnectionPool } from "./imap/connectionPool";
import { resyncImapMessageIntoDb } from "./resyncMessage";
import { startImapServer } from "../../scripts/dev-fixture/imap-server";

test("real IMAP resync replaces an unkeyed legacy row with the parsed sender key", async () => {
  const f = await createCollabFixture();
  const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic" });
  try {
    const account = { ...f.account, imap: { ...f.account.imap, host: "127.0.0.1", port: server.port, secure: false } };
    const folderId = buildFolderId(account.id, "INBOX");
    await f.api.saveFoldersForAccount(account.id, [{ id: folderId, accountId: account.id, name: "INBOX", count: 0, unreadCount: 0 }]);
    const messageId = "<sender-key-resync@example.test>";
    const wire = server.store.append("INBOX", Buffer.from(
      `From: tést@example.test\r\nTo: team@example.test\r\nMessage-ID: ${messageId}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Synthetic resync</p>`));
    const legacy = f.message(messageId, {
      id: buildImapMessageRowId(messageId), folderId, mailboxPath: "INBOX", imapUid: wire.uid,
      from: "attacker:trusted@example.test", senderKey: null
    });
    await f.api.upsertMessages(account.id, null, [legacy]);
    const refreshed = await resyncImapMessageIntoDb(account, legacy, wire.uid);
    expect(refreshed?.senderKey).toBe("tést@example.test");
    expect(refreshed?.from).toBe("tést@example.test");
    expect((await f.api.getMessageById(account.id, legacy.id))?.senderKey).toBe("tést@example.test");
  } finally {
    await drainImapConnectionPool();
    await server.stop();
  }
});
