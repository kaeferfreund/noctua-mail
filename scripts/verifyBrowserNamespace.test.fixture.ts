/** Unit regression for the actual SSE route; only the IMAP transport is fake. */
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "noctua-browser-namespace-"));
process.env.NOCTUA_DATA_DIR = dir;
process.env.ACCOUNT_DB_IDLE_MS = "0";
process.env.IMAP_CREDENTIALS_STORAGE = "db";
process.env.IMAP_SECRET_KEY = "synthetic-browser-namespace-proof-secret";
const { getAccountDb, closeAllDbConnections } = await import("@/lib/db/connection");
const { upsertAccount } = await import("@/lib/db/accounts");
const { saveMailboxState, getMailboxState } = await import("@/lib/db/folders");
const { sealSession } = await import("@/lib/auth");
let validity = 2n;
const transport = Object.assign(new EventEmitter(), {
  capabilities: new Set(),
  mailboxOpen: async () => ({ uidNext: 62, uidValidity: validity, exists: 61 }),
  status: async () => ({ uidNext: 62, uidValidity: validity }),
  logout: async () => {},
  usable: true
});
mock.module("@/lib/mail/imap/idle", () => ({
  connectIdleImapClient: async () => transport,
  runImapIdleLoop: async () => {}
}));
const { GET } = await import("@/app/api/accounts/[accountId]/imap/stream/route");
const accountId = "synthetic-browser";
const folderId = `${accountId}:INBOX`;
const endpoint = { host: "mail.example.test", port: 993, secure: true, user: "demo@example.test", password: "synthetic" };
const abort = new AbortController();
try {
  await upsertAccount({ id: accountId, name: "Synthetic browser", email: "demo@example.test", avatar: "S", imap: endpoint, smtp: endpoint });
  const db = await getAccountDb(accountId);
  db.prepare("INSERT INTO folders(id,accountId,name,specialUse) VALUES (?,?,?,?)").run(folderId, accountId, "INBOX", "\\Inbox");
  await saveMailboxState({ accountId, folderId, mailboxPath: "INBOX", uidValidity: "1", highestUid: 61, highestModSeq: "99" });
  function seedOldRows() {
    db.prepare(`INSERT INTO messages(id,accountId,folderId,threadId,subject,fromAddr,toAddr,preview,date,dateValue,body,imapUid,
      pendingMoveSourceFolderId,pendingMoveSourceMailboxPath,pendingMoveSourceUid,pendingMoveStartedAt)
      VALUES (?,?,?,?,'OLD','','','','',0,'OLD body',61,?,?,61,1)`)
      .run("old", accountId, folderId, "old", folderId, "INBOX");
    db.prepare(`INSERT INTO messages(id,accountId,folderId,threadId,subject,fromAddr,toAddr,preview,date,dateValue,body,
      pendingMoveSourceFolderId,pendingMoveSourceMailboxPath,pendingMoveSourceUid,pendingMoveStartedAt)
      VALUES (?,?,?,?,'staged','','','','',0,'staged body',?,?,61,1)`)
      .run("staged", accountId, `${accountId}:Archive`, "staged", folderId, "INBOX");
  }
  seedOldRows();
  // Inspect the database at the exact write boundary. Any writer advancing the
  // validity while content/markers/watermarks remain makes the actual route fail.
  db.exec(`CREATE TRIGGER assert_namespace_invalidated BEFORE INSERT ON mailbox_state
    WHEN NEW.uidValidity != (SELECT uidValidity FROM mailbox_state WHERE folderId=NEW.folderId)
    BEGIN
      SELECT CASE WHEN EXISTS(SELECT 1 FROM messages WHERE accountId=NEW.accountId AND
        (folderId=NEW.folderId OR pendingMoveSourceFolderId=NEW.folderId))
        OR NEW.highestUid IS NOT NULL OR NEW.highestModSeq IS NOT NULL
        THEN RAISE(ABORT, 'UIDVALIDITY published before invalidation') END;
    END`);
  const response = await GET(new Request(`http://example.test/api/accounts/${accountId}/imap/stream`, {
    signal: abort.signal, headers: { cookie: `noctua_session=${sealSession({ userId: "synthetic", accountId,
      exp: Math.floor(Date.now() / 1000) + 600 })}` }
  }), { params: Promise.resolve({ accountId }) });
  assert.equal(response.status, 200);
  const reader = response.body!.getReader();
  let events = "";
  while (!events.includes("event: folder:update")) {
    const chunk = await reader.read();
    assert(!chunk.done, events);
    events += new TextDecoder().decode(chunk.value);
    assert(!events.includes("event: error"), events);
  }
  assert.equal((await getMailboxState(accountId, folderId))?.uidValidity, "2");
  assert.equal(db.prepare("SELECT 1 FROM messages WHERE id='old'").get(), null);
  const staged = db.prepare("SELECT body,pendingMoveSourceUid FROM messages WHERE id='staged'").get() as { body: string; pendingMoveSourceUid: number | null };
  assert.equal(staged.body, "staged body");
  assert.equal(staged.pendingMoveSourceUid, null);

  // A later STATUS resets the namespace without an increasing UIDNEXT. Ensure
  // fetchNew's early return and SELECT-time closure cannot hide the reset.
  db.prepare("DELETE FROM messages WHERE id='staged'").run();
  seedOldRows();
  await saveMailboxState({ accountId, folderId, mailboxPath: "INBOX", uidValidity: "2", highestUid: 61, highestModSeq: "100" });
  validity = 3n;
  transport.emit("exists");
  const deadline = Date.now() + 3000;
  while ((await getMailboxState(accountId, folderId))?.uidValidity !== "3" && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  const state = await getMailboxState(accountId, folderId);
  assert.equal(state?.uidValidity, "3");
  assert.equal(state?.highestUid, null);
  assert.equal(state?.highestModSeq, null);
  assert.equal(db.prepare("SELECT 1 FROM messages WHERE id='old'").get(), null);
  abort.abort(); await reader.cancel();
  console.info("BROWSER_NAMESPACE_UNIT PASS SELECT and equal-UIDNEXT STATUS invalidate before persistence");
} finally {
  abort.abort();
  mock.restore();
  closeAllDbConnections();
  rmSync(dir, { recursive: true, force: true });
}
