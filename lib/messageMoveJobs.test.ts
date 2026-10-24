import { beforeEach, describe, expect, mock, test } from "bun:test";
import "./testDbHarness";
import type { Account } from "@/lib/data";

const updateMessageFolder = mock(async () => undefined);
const moveImapMessages = mock<typeof import("./mail/imap").moveImapMessages>(async () => new Map<number, number | null>());

const actualDb = await import("./db");
const actualImap = await import("./mail/imap");
const { upsertAccount } = actualDb;

mock.module("@/lib/db", () => ({
  ...actualDb,
  updateMessageFolder
}));

mock.module("@/lib/mail/imap", () => ({
  ...actualImap,
  moveImapMessages
}));

const {
  enqueueMessageMoveJobs,
  waitForMessageMoveJobsIdle
} = await import("./messageMoveJobs");

// Restore the global module registry immediately so parallel test files do not
// observe this file's mocked db module while messageMoveJobs keeps its captured
// mocked imports.
mock.restore();

const account: Account = {
  id: "acc-move-jobs",
  name: "Move Jobs",
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

beforeEach(async () => {
  updateMessageFolder.mockReset();
  moveImapMessages.mockReset();
  await upsertAccount(account);
  await waitForMessageMoveJobsIdle(account.id);
});

describe("message move jobs", () => {
  test("batches moves by source and destination mailbox", async () => {
    moveImapMessages.mockResolvedValue(
      new Map([
        [10, 110],
        [11, 111],
        [12, 112]
      ])
    );

    enqueueMessageMoveJobs([
      {
        accountId: account.id,
        messageId: "m-1",
        sourceFolderId: "acc:Source",
        sourceMailboxPath: "Source",
        sourceUid: 10,
        destinationFolderId: "acc:Target",
        destinationMailboxPath: "Target"
      },
      {
        accountId: account.id,
        messageId: "m-2",
        sourceFolderId: "acc:Source",
        sourceMailboxPath: "Source",
        sourceUid: 11,
        destinationFolderId: "acc:Target",
        destinationMailboxPath: "Target"
      },
      {
        accountId: account.id,
        messageId: "m-3",
        sourceFolderId: "acc:Source",
        sourceMailboxPath: "Source",
        sourceUid: 12,
        destinationFolderId: "acc:Target",
        destinationMailboxPath: "Target"
      }
    ]);

    await waitForMessageMoveJobsIdle(account.id);

    expect(moveImapMessages).toHaveBeenCalledTimes(1);
    expect(moveImapMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        id: account.id,
        email: account.email,
        imap: expect.objectContaining({
          host: account.imap.host,
          user: account.imap.user
        }),
        smtp: expect.objectContaining({
          host: account.smtp.host,
          user: account.smtp.user
        })
      }),
      "Source",
      [10, 11, 12],
      "Target",
      undefined
    );
    expect(updateMessageFolder).toHaveBeenCalledTimes(3);
    expect(updateMessageFolder).toHaveBeenNthCalledWith(
      1,
      account.id,
      "m-1",
      "acc:Target",
      "Target",
      110
    );
  });

  test("splits large batches into chunks of 200 messages", async () => {
    moveImapMessages.mockImplementation(async (_account, _source, uids) => {
      return new Map(uids.map((uid) => [uid, uid + 1000] as const));
    });

    enqueueMessageMoveJobs(
      Array.from({ length: 205 }, (_, index) => ({
        accountId: account.id,
        messageId: `m-${index + 1}`,
        sourceFolderId: "acc:Source",
        sourceMailboxPath: "Source",
        sourceUid: index + 1,
        destinationFolderId: "acc:Target",
        destinationMailboxPath: "Target"
      }))
    );

    await waitForMessageMoveJobsIdle(account.id);

    expect(moveImapMessages).toHaveBeenCalledTimes(2);
    expect(moveImapMessages.mock.calls[0]?.[2]).toHaveLength(200);
    expect(moveImapMessages.mock.calls[1]?.[2]).toHaveLength(5);
    expect(updateMessageFolder).toHaveBeenCalledTimes(205);
  });

  test("rolls back a failed batch to the source folder", async () => {
    moveImapMessages.mockRejectedValue(new Error("move failed"));

    enqueueMessageMoveJobs([
      {
        accountId: account.id,
        messageId: "m-1",
        sourceFolderId: "acc:Source",
        sourceMailboxPath: "Source",
        sourceUid: 20,
        destinationFolderId: "acc:Target",
        destinationMailboxPath: "Target"
      },
      {
        accountId: account.id,
        messageId: "m-2",
        sourceFolderId: "acc:Source",
        sourceMailboxPath: "Source",
        sourceUid: 21,
        destinationFolderId: "acc:Target",
        destinationMailboxPath: "Target"
      }
    ]);

    await waitForMessageMoveJobsIdle(account.id);

    expect(moveImapMessages).toHaveBeenCalledTimes(1);
    expect(updateMessageFolder).toHaveBeenCalledTimes(2);
    expect(updateMessageFolder).toHaveBeenNthCalledWith(
      1,
      account.id,
      "m-1",
      "acc:Source",
      "Source",
      20
    );
    expect(updateMessageFolder).toHaveBeenNthCalledWith(
      2,
      account.id,
      "m-2",
      "acc:Source",
      "Source",
      21
    );
  });

  test("records a spam decision after a successful move into Junk, nothing after a failed one", async () => {
    const { saveFoldersForAccount, upsertMessages, listSpamExampleCandidates } = actualDb;
    const inbox = { id: `${account.id}:INBOX`, accountId: account.id, name: "INBOX", count: 0, specialUse: "\\Inbox" };
    const junk = { id: `${account.id}:Junk`, accountId: account.id, name: "Junk", count: 0, specialUse: "\\Junk" };
    await saveFoldersForAccount(account.id, [inbox, junk]);
    const message = (id: string, uid: number) => ({
      id, accountId: account.id, folderId: inbox.id, threadId: id, messageId: `<${id}@example.test>`,
      subject: `Angebot ${id}`, from: `Shop <${id}@shop.example.test>`, to: account.email, preview: "", body: "Text",
      date: new Date(Date.UTC(2026, 9, 24, 12, uid)).toISOString(), dateValue: Date.UTC(2026, 9, 24, 12, uid),
      mailboxPath: "INBOX", imapUid: uid
    });
    await upsertMessages(account.id, inbox.id, [message("m-learn-ok", 30), message("m-learn-fail", 31)], true, { recomputeThreads: false });
    const task = (messageId: string, sourceUid: number) => ({
      accountId: account.id, messageId, sourceFolderId: inbox.id, sourceMailboxPath: "INBOX", sourceUid,
      destinationFolderId: junk.id, destinationMailboxPath: "Junk", userId: "user-1"
    });

    moveImapMessages.mockResolvedValueOnce(new Map([[30, 130]]));
    enqueueMessageMoveJobs([task("m-learn-ok", 30)]);
    await waitForMessageMoveJobsIdle(account.id);
    moveImapMessages.mockRejectedValueOnce(new Error("move failed"));
    enqueueMessageMoveJobs([task("m-learn-fail", 31)]);
    await waitForMessageMoveJobsIdle(account.id);

    expect(moveImapMessages).toHaveBeenCalledTimes(2);
    const examples = await listSpamExampleCandidates(account.id, { senderEmail: null, senderDomain: "shop.example.test" });
    expect(examples.map((example) => ({ subject: example.subject, label: example.label })))
      .toEqual([{ subject: "Angebot m-learn-ok", label: "spam" }]);
  });
});
