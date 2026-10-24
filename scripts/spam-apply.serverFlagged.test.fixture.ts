/**
 * Seeds a synthetic data dir for scripts/spam-apply.serverFlagged.test.ts:
 *   NOCTUA_DATA_DIR=<dir> bun scripts/spam-apply.serverFlagged.test.fixture.ts <spec.json>
 *   NOCTUA_DATA_DIR=<dir> bun scripts/spam-apply.serverFlagged.test.fixture.ts --flags <accountId> <Message-ID> <flags JSON>
 * The second form changes one row's flags over the app layer (a household
 * member flagging the mail between the dry run and the real run). The spec names the accounts, folders and messages (sources and IMAP UIDs
 * come from the test's in-process IMAP fixture). All addresses are synthetic.
 */
import { readFileSync } from "node:fs";
import type { Account, Folder, Message } from "../lib/data";

export type SeedMessage = {
  key: string; accountId: string; folder: string; messageId: string; from: string; to: string; subject: string;
  dateValue: number; source: string; imapUid: number; flags?: string[]; inReplyTo?: string;
  checked?: boolean; topic?: boolean;
};
export type SeedSpec = {
  accounts: Array<{ id: string; email: string; folders: Array<{ path: string; specialUse?: string }>; imapPort: number }>;
  messages: SeedMessage[];
  hamExamples: Array<{ accountId: string; senderEmail: string; senderDomain: string }>;
  users: Array<{ id: string; email: string; role: "admin" | "user" }>;
  mailboxSettings: Array<{ accountId: string; settings: Record<string, unknown> }>;
};

const db = await import("../lib/db");
const { getAccountDb, getDb } = await import("../lib/db/connection");
const { buildImapMessageRowId } = await import("../lib/messageIds");
if (process.argv[2] === "--flags") {
  const [accountId, messageId, flags] = process.argv.slice(3);
  await db.updateMessageFlags(accountId, buildImapMessageRowId(messageId), JSON.parse(flags));
  (await getAccountDb(accountId)).exec("PRAGMA wal_checkpoint(TRUNCATE)");
  process.exit(0);
}
const spec = JSON.parse(readFileSync(process.argv[2], "utf8")) as SeedSpec;
const { saveMailboxSpamSettings } = await import("../lib/mail/spam/settings");
const { buildFolderId } = await import("../lib/mail/imap/_shared");

const main = await getDb();
for (const user of spec.users) {
  main.prepare("INSERT INTO users (id, email, role, createdAt) VALUES (?, ?, ?, ?)").run(user.id, user.email, user.role, Date.now());
}
for (const entry of spec.accounts) {
  const account: Account = {
    id: entry.id, name: entry.email, email: entry.email, avatar: "",
    imap: { host: "127.0.0.1", port: entry.imapPort, secure: false, user: entry.email, password: "synthetic" },
    smtp: { host: "127.0.0.1", port: 1, secure: false, user: entry.email, password: "synthetic" }
  };
  await db.upsertAccount(account);
  const folders: Folder[] = entry.folders.map((folder) => ({
    id: buildFolderId(entry.id, folder.path), accountId: entry.id, name: folder.path, count: 0, unreadCount: 0, specialUse: folder.specialUse
  }));
  await db.saveFoldersForAccount(entry.id, folders);
}
for (const seed of spec.messages) {
  const folderId = buildFolderId(seed.accountId, seed.folder);
  const message: Message = {
    id: buildImapMessageRowId(seed.messageId), accountId: seed.accountId, folderId, threadId: seed.messageId, messageId: seed.messageId,
    subject: seed.subject, from: seed.from, to: seed.to, preview: "Synthetischer Inhalt", body: "Synthetischer Inhalt",
    date: new Date(seed.dateValue).toISOString(), dateValue: seed.dateValue, mailboxPath: seed.folder, imapUid: seed.imapUid,
    flags: seed.flags ?? [], inReplyTo: seed.inReplyTo, source: seed.source
  };
  await db.upsertMessages(seed.accountId, folderId, [message]);
  if (seed.checked) await db.saveSpamVerdict(seed.accountId, message.id, { verdict: "ham", confidence: 0.9, reasons: ["synthetic"] });
  if (seed.topic) {
    (await getAccountDb(seed.accountId)).prepare("INSERT INTO thread_topics (threadId, topicId, accountId, assignedAt) VALUES (?, ?, ?, ?)")
      .run(message.threadId, "topic-synthetic", seed.accountId, Date.now());
  }
}
for (const example of spec.hamExamples) {
  await db.saveSpamExample(example.accountId, {
    senderEmail: example.senderEmail, senderDomain: example.senderDomain, subject: "Bestellung", snippet: "Synthetisch", label: "ham",
    createdAt: Date.now(), messageId: null, source: "not-spam", decidedByUserId: spec.users[0]?.id ?? null
  });
}
for (const entry of spec.mailboxSettings) await saveMailboxSpamSettings(entry.accountId, entry.settings, spec.users[0].id);

// Leave a copy-like data dir behind: no WAL content, every page in the database files.
main.exec("PRAGMA wal_checkpoint(TRUNCATE)");
for (const entry of spec.accounts) (await getAccountDb(entry.id)).exec("PRAGMA wal_checkpoint(TRUNCATE)");
process.exit(0);
