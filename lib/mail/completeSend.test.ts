import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { Account, Message } from "@/lib/data";
import { DONE_FLAG, TODO_FLAG } from "@/lib/messageFlags";
import { dbModulePromise } from "@/lib/testDbHarness";

// No Sent folder exists, so completeSend skips the Sent copy and only runs the
// post-send flag loop against the stubbed reply source rows.
type FlagCall = { messageId: string; flag?: string; keyword?: string; value: boolean };

let storedMessages = new Map<string, Message>();
let failKeyword: string | null = null;
const flagCalls: FlagCall[] = [];

const applyFlagMutationsToMessage = mock(async (params: {
  messageId: string; message: Pick<Message, "flags">; flag?: string; keyword?: string; value: boolean;
}) => {
  const { messageId, flag, keyword, value } = params;
  flagCalls.push({ messageId, flag, keyword, value });
  if (keyword && keyword === failKeyword) throw new Error("STORE rejected");
  const name = keyword ?? (flag === "answered" ? "\\Answered" : "\\Forwarded");
  const flags = params.message.flags ?? [];
  return value ? Array.from(new Set([...flags, name])) : flags.filter((item) => item !== name);
});
const listReplySourceMessageIds = mock(async (_accountId: string, messageId: string) =>
  [...storedMessages.values()].filter((message) => message.messageId === messageId).map((message) => ({ id: message.id })));
const recordReplySent = mock(async () => {});
const getMessageById = mock(async (_accountId: string, id: string) => storedMessages.get(id) ?? null);

const actualThreadCollab = await import("@/lib/threadCollab");
const actualServerDb = await import("@/lib/serverDb");
const actualServerImap = await import("@/lib/serverImap");
const actualFlagMutation = await import("@/lib/messageFlagMutation");

mock.module("@/lib/threadCollab", () => ({ ...actualThreadCollab, recordReplySent, listReplySourceMessageIds }));
mock.module("@/lib/serverDb", () => ({
  ...actualServerDb,
  getFolders: mock(async () => []),
  saveFoldersForAccount: mock(async () => {}),
  getMessageById
}));
mock.module("@/lib/serverImap", () => ({ ...actualServerImap, listImapFolders: mock(async () => []) }));
mock.module("@/lib/messageFlagMutation", () => ({ ...actualFlagMutation, applyFlagMutationsToMessage }));

await dbModulePromise;
const { completeSend } = await import("./completeSend");

mock.restore();

const account = { id: "complete-send", name: "Complete Send", email: "owner@example.test", avatar: "" } as Account;
const actor = { userId: "user-1", clientId: "client-1" };

function storeOriginal(flags: string[]) {
  const message = {
    id: "complete-send-inbox-1", accountId: account.id, folderId: `${account.id}:INBOX`,
    messageId: "<original@example.test>", threadId: "<original@example.test>", subject: "Task",
    from: "sender@example.test", to: account.email, preview: "", date: "", body: "",
    mailboxPath: "INBOX", imapUid: 1, flags
  } as Message;
  storedMessages.set(message.id, message);
  return message;
}

function send(params: { inReplyTo?: string; xForwardedMessageId?: string }) {
  return completeSend({ account, raw: Buffer.from("raw"), messageId: "<sent@example.test>", actor, clientId: "client-1", ...params });
}

describe("completeSend post-send flags", () => {
  beforeEach(() => {
    storedMessages = new Map();
    failKeyword = null;
    flagCalls.length = 0;
  });

  test("a reply to a to-do sets answered and marks the to-do done", async () => {
    const original = storeOriginal([TODO_FLAG]);
    const result = await send({ inReplyTo: original.messageId });
    expect(flagCalls).toEqual([
      { messageId: original.id, flag: "answered", keyword: undefined, value: true },
      { messageId: original.id, flag: undefined, keyword: TODO_FLAG, value: false },
      { messageId: original.id, flag: undefined, keyword: DONE_FLAG, value: true }
    ]);
    expect(result.postSendWarning).toBeNull();
  });

  test("a reply to a message without a to-do only sets answered", async () => {
    const original = storeOriginal(["\\Seen"]);
    await send({ inReplyTo: original.messageId });
    expect(flagCalls).toEqual([{ messageId: original.id, flag: "answered", keyword: undefined, value: true }]);
  });

  test("a forward of a to-do only sets forwarded", async () => {
    const original = storeOriginal([TODO_FLAG]);
    await send({ inReplyTo: original.messageId, xForwardedMessageId: original.messageId });
    expect(flagCalls).toEqual([{ messageId: original.id, flag: undefined, keyword: "$Forwarded", value: true }]);
  });

  test("a reply to a message that is already done leaves the to-do state alone", async () => {
    const original = storeOriginal([DONE_FLAG]);
    await send({ inReplyTo: original.messageId });
    expect(flagCalls).toEqual([{ messageId: original.id, flag: "answered", keyword: undefined, value: true }]);
  });

  test("a failing to-do update keeps the send successful with a warning", async () => {
    const original = storeOriginal([TODO_FLAG]);
    failKeyword = TODO_FLAG;
    const result = await send({ inReplyTo: original.messageId });
    expect(result.messageId).toBe("<sent@example.test>");
    expect(result.sentCopy).toBe("no-sent-folder");
    expect(result.postSendWarning).toBe("Email sent, but updating reply, forward or to-do flags failed.");
    expect(flagCalls.map((call) => call.flag ?? call.keyword)).toEqual(["answered", TODO_FLAG]);
  });
});
