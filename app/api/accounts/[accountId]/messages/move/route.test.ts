import { describe, expect, mock, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import type { QueuedMessageMove } from "@/lib/messageMoveJobs";

// The queue itself is covered by lib/messageMoveJobs.test.ts; here the route's
// contribution is checked (folders, acting user) and the learning step the
// queue runs after a successful IMAP move is applied to the captured tasks.
const enqueued: QueuedMessageMove[] = [];
const actualMoveJobs = await import("@/lib/messageMoveJobs");
mock.module("@/lib/messageMoveJobs", () => ({
  ...actualMoveJobs,
  enqueueMessageMoveJobs: (tasks: QueuedMessageMove[]) => { enqueued.push(...tasks); }
}));
const { POST } = await import("./route");
mock.restore();

const db = await dbModulePromise;
const { learnFromMessageMoves } = await import("@/lib/mail/spam/moveLearning");

function account(id: string): Account {
  return {
    id, name: "Move route", email: "owner@example.test", avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "secret" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "secret" }
  };
}

function folder(accountId: string, path: string, specialUse?: string): Folder {
  return { id: `${accountId}:${path}`, accountId, name: path, count: 0, unreadCount: 0, specialUse };
}

function message(accountId: string, folderId: string, index: number): Message {
  const id = `${accountId}-m${index}`;
  return {
    id, accountId, folderId, threadId: id, messageId: `<${id}@example.test>`, subject: `Angebot ${index}`,
    from: `Shop <news${index}@shop.example.test>`, to: "owner@example.test", preview: "", body: "Text",
    date: new Date(Date.UTC(2026, 9, 24, 12, index)).toISOString(), dateValue: Date.UTC(2026, 9, 24, 12, index),
    mailboxPath: folderId.slice(accountId.length + 1), imapUid: 100 + index
  };
}

async function fixture() {
  const accountId = `move-route-${crypto.randomUUID()}`;
  await db.upsertAccount(account(accountId));
  const inbox = folder(accountId, "INBOX", "\\Inbox");
  const junk = folder(accountId, "Junk", "\\Junk");
  await db.saveFoldersForAccount(accountId, [inbox, junk]);
  const rows = [message(accountId, inbox.id, 1), message(accountId, junk.id, 2)];
  await db.upsertMessages(accountId, null, rows, true, { recomputeThreads: false });
  const auth = await createAuthenticatedTestSession(accountId);
  const post = (body: unknown, origin = "http://localhost:3000") => POST(
    new Request(`http://localhost:3000/api/accounts/${accountId}/messages/move`, {
      method: "POST", headers: auth.jar.headers({ origin, "content-type": "application/json" }), body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ accountId }) }
  );
  enqueued.length = 0;
  return { accountId, inbox, junk, rows, auth, post };
}

async function examples(accountId: string) {
  const rows = await db.listSpamExampleCandidates(accountId, { senderEmail: null, senderDomain: "shop.example.test" });
  return rows.map((row) => ({ senderEmail: row.senderEmail, label: row.label }));
}

/** What the move queue does after a successful IMAP move (lib/messageMoveJobs.ts). */
const learn = () => learnFromMessageMoves(enqueued.map((task) => ({
  accountId: task.accountId, messageId: task.messageId, sourceFolderId: task.sourceFolderId,
  destinationFolderId: task.destinationFolderId, userId: task.userId ?? null
})));

describe("move route spam learning", () => {
  test("queues the move with the acting user; the completed move into Junk records that user's spam decision", async () => {
    const f = await fixture();
    const response = await f.post({ messageIds: [f.rows[0].id], destinationFolderId: f.junk.id });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, queued: true, moved: 1 });
    expect(enqueued).toEqual([
      expect.objectContaining({
        accountId: f.accountId, messageId: f.rows[0].id, sourceFolderId: f.inbox.id, destinationFolderId: f.junk.id, userId: f.auth.user.id
      })
    ]);
    expect(await examples(f.accountId)).toEqual([]);

    await learn();
    expect(await examples(f.accountId)).toEqual([{ senderEmail: "news1@shop.example.test", label: "spam" }]);
    expect(await db.getLatestSpamDecision(f.accountId, "news1@shop.example.test")).toBe("spam");
  });

  test("a move out of Junk records ham; a viewer cannot move and therefore cannot teach", async () => {
    const f = await fixture();
    expect((await f.post({ messageIds: [f.rows[1].id], destinationFolderId: f.inbox.id })).status).toBe(200);
    expect(enqueued).toEqual([expect.objectContaining({ sourceFolderId: f.junk.id, destinationFolderId: f.inbox.id, userId: f.auth.user.id })]);
    await learn();
    expect(await examples(f.accountId)).toEqual([{ senderEmail: "news2@shop.example.test", label: "ham" }]);
    expect(await db.getLatestSpamDecision(f.accountId, "news2@shop.example.test")).toBe("ham");

    enqueued.length = 0;
    await db.setUserAccountRole(f.auth.user.id, f.accountId, "viewer", f.auth.user.id);
    expect((await f.post({ messageIds: [f.rows[0].id], destinationFolderId: f.junk.id })).status).toBe(403);
    expect(enqueued).toEqual([]);
  });
});
