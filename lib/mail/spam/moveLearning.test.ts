import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { dbModulePromise } from "@/lib/testDbHarness";
import { getAccountDb } from "../../db/connection";
import { classifyMoveForLearning, learnFromMessageMove, learnFromMessageMoves } from "./moveLearning";
import { spamSenderKey } from "./senderProfile";

const db = await dbModulePromise;
const SENDER = "news@shop.example.test";

function account(id: string): Account {
  return {
    id, name: "Move learning", email: "owner@example.test", avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "secret" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "secret" }
  };
}

function folder(accountId: string, path: string, name: string, specialUse?: string): Folder {
  return { id: `${accountId}:${path}`, accountId, name, count: 0, unreadCount: 0, specialUse };
}

let clock = 0;
function message(accountId: string, folderId: string, subject: string): Message {
  clock += 1;
  const id = `${accountId}-m${clock}`;
  return {
    id, accountId, folderId, threadId: id, messageId: `<${id}@example.test>`, subject,
    from: `Shop <${SENDER}>`, to: "owner@example.test", preview: subject, body: `${subject}\n> zitiert`,
    date: new Date(Date.UTC(2026, 9, 24, 12, clock)).toISOString(), dateValue: Date.UTC(2026, 9, 24, 12, clock),
    mailboxPath: folderId.slice(accountId.length + 1), imapUid: clock
  };
}

type ExampleRow = { messageId: string; label: string; source: string; decidedByUserId: string | null };
async function examples(accountId: string) {
  const shard = await getAccountDb(accountId);
  return shard.prepare("SELECT messageId, label, source, decidedByUserId FROM spam_examples WHERE accountId = ? ORDER BY createdAt")
    .all(accountId) as ExampleRow[];
}

async function fixture() {
  const accountId = `spam-move-${crypto.randomUUID()}`;
  await db.upsertAccount(account(accountId));
  const folders = {
    inbox: folder(accountId, "INBOX", "INBOX", "\\Inbox"),
    // An IMAP path without a special-use attribute: recognised by its name.
    junk: folder(accountId, "INBOX.Spam", "Spam"),
    trash: folder(accountId, "Papierkorb", "Papierkorb", "\\Trash"),
    archive: folder(accountId, "Archiv", "Archiv")
  };
  await db.saveFoldersForAccount(accountId, Object.values(folders));
  const seed = async (folderId: string, subject: string) => {
    const row = message(accountId, folderId, subject);
    await db.upsertMessages(accountId, folderId, [row], true, { recomputeThreads: false });
    return row;
  };
  const move = (row: Message, destinationFolderId: string, userId: string | null = "user-1") =>
    learnFromMessageMove({ accountId, messageId: row.id, sourceFolderId: row.folderId, destinationFolderId, userId });
  return { accountId, folders, seed, move };
}

describe("classifyMoveForLearning", () => {
  const accountId = "acc";
  const folders = [
    folder(accountId, "INBOX", "INBOX", "\\Inbox"),
    folder(accountId, "INBOX.Spam", "Spam"),
    folder(accountId, "Junk E-Mail", "Junk E-Mail", "\\Junk"),
    folder(accountId, "Trash", "Deleted", "\\Trash"),
    folder(accountId, "Archive", "Archive")
  ];
  const classify = (sourceFolderId: string, destinationFolderId: string) =>
    classifyMoveForLearning({ accountId, sourceFolderId: `acc:${sourceFolderId}`, destinationFolderId: `acc:${destinationFolderId}` }, folders);

  test("into Junk is spam, out of Junk is ham, Trash and non-Junk moves teach nothing", () => {
    expect(classify("INBOX", "INBOX.Spam")).toBe("spam");
    expect(classify("Archive", "Junk E-Mail")).toBe("spam");
    expect(classify("INBOX.Spam", "INBOX")).toBe("ham");
    expect(classify("Junk E-Mail", "Archive")).toBe("ham");
    expect(classify("INBOX.Spam", "Trash")).toBeNull();
    expect(classify("INBOX.Spam", "Junk E-Mail")).toBeNull();
    expect(classify("INBOX", "Archive")).toBeNull();
    expect(classify("INBOX", "Trash")).toBeNull();
    expect(classify("INBOX.Spam", "INBOX.Spam")).toBeNull();
    expect(classify("INBOX", "Unknown")).toBeNull();
  });
});

describe("learnFromMessageMove", () => {
  test("a move into Junk stores the spam example of the acting user and revokes the sender's trust", async () => {
    const f = await fixture();
    const row = await f.seed(f.folders.inbox.id, "Gewinnspiel");
    expect(await f.move(row, f.folders.junk.id, "user-7")).toBe("spam");
    expect(await examples(f.accountId)).toEqual([{ messageId: row.id, label: "spam", source: "move-junk", decidedByUserId: "user-7" }]);
    expect(await db.getLatestSpamDecision(f.accountId, SENDER)).toBe("spam");
    expect((await db.getSenderProfile(f.accountId, spamSenderKey(SENDER)!))?.lastUserSpamAt).toBeGreaterThan(0);
  });

  test("a move out of Junk into the inbox stores a ham example and clears the suspicious mark", async () => {
    const f = await fixture();
    const row = await f.seed(f.folders.junk.id, "Rechnung");
    await db.saveSpamVerdict(f.accountId, row.id, { verdict: "spam", confidence: 0.95, reasons: ["Test"] }, { automatic: true });
    expect(await f.move(row, f.folders.inbox.id)).toBe("ham");
    expect(await examples(f.accountId)).toEqual([{ messageId: row.id, label: "ham", source: "move-from-junk", decidedByUserId: "user-1" }]);
    expect((await db.getMessageById(f.accountId, row.id))?.spamVerdict).toBe("ham");
    expect(await db.getLatestSpamDecision(f.accountId, SENDER)).toBe("ham");
  });

  test("Junk to Trash and inbox to archive record nothing", async () => {
    const f = await fixture();
    const junkRow = await f.seed(f.folders.junk.id, "Alt");
    const inboxRow = await f.seed(f.folders.inbox.id, "Ablage");
    expect(await f.move(junkRow, f.folders.trash.id)).toBeNull();
    expect(await f.move(inboxRow, f.folders.archive.id)).toBeNull();
    expect(await examples(f.accountId)).toEqual([]);
  });

  test("a repeated call for the same move keeps one example", async () => {
    const f = await fixture();
    const row = await f.seed(f.folders.inbox.id, "Doppelt");
    await f.move(row, f.folders.junk.id);
    await f.move(row, f.folders.junk.id);
    await learnFromMessageMoves([
      { accountId: f.accountId, messageId: row.id, sourceFolderId: row.folderId, destinationFolderId: f.folders.junk.id, userId: "user-1" }
    ]);
    expect(await examples(f.accountId)).toHaveLength(1);
  });

  test("a missing message or folder list never throws", async () => {
    const f = await fixture();
    expect(await f.move(message(f.accountId, f.folders.inbox.id, "Weg"), f.folders.junk.id)).toBeNull();
    expect(await learnFromMessageMove({ accountId: "no-such-account", messageId: "x", sourceFolderId: "a", destinationFolderId: "b", userId: null }))
      .toBeNull();
  });
});
