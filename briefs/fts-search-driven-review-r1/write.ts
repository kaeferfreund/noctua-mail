// Child-process writer for the F3 race harness: one production write, then exit.
import { openOrSeed, WT } from "./seed";
const [dataDir, op, accountId, id] = process.argv.slice(2);
const { api } = await openOrSeed(dataDir);
const base = Date.UTC(2027, 0, 1, 8, 0, 0);
const mk = (over: any) => ({
  accountId, folderId: "inbox", threadId: "th-race-" + id, messageId: `<race-${id}@mail.example.test>`,
  subject: "needle race insert", from: "Alice Example <alice@example.test>", to: "team@example.test",
  preview: "needle race", body: "needle race body", date: new Date(base).toISOString(), dateValue: base, attachments: [], ...over
});
if (op === "insert") {
  await api.upsertMessages(accountId, null, [mk({ id })]);
} else if (op === "delete") {
  const { deleteMessageById } = await import(WT + "/lib/db/messages/delete.ts");
  await deleteMessageById(accountId, id);
} else if (op === "edit") {
  // Same id, content no longer matches "needle".
  const { getAccountDb } = await import(WT + "/lib/db/connection.ts");
  const db: any = await getAccountDb(accountId);
  const row = db.prepare("SELECT * FROM messages WHERE accountId=? AND id=?").get(accountId, id);
  await api.upsertMessages(accountId, null, [{
    id, accountId, folderId: row.folderId, threadId: row.threadId, messageId: row.messageId, subject: "edited plain subject",
    from: row.fromAddr, to: row.toAddr, preview: "edited", body: "edited body without the token", date: row.date, dateValue: row.dateValue, attachments: []
  }]);
} else if (op === "move") {
  const { updateMessageFolder } = await import(WT + "/lib/db/messages/move.ts");
  await updateMessageFolder(accountId, id, "archive", "Archive");
}
process.exit(0);
