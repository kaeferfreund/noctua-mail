import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Account, Message } from "@/lib/data";
import { DONE_FLAG, TODO_FLAG } from "@/lib/messageFlags";
import { dbModulePromise } from "@/lib/testDbHarness";

// No Sent folder exists, so completeSend skips the Sent copy and only runs the
// post-send flag loop against the stubbed reply source rows.
type FlagCall = { messageId: string; flag?: string; keyword?: string; value: boolean };

let storedMessages = new Map<string, Message>();
let failKeyword: string | null = null;
const flagCalls: FlagCall[] = [];

// `mock.module` would replace these modules for the whole test process (and
// `mock.restore()` does not undo it), so the stubs are `spyOn` overrides that
// are installed in `beforeAll` and restored in `afterAll`.
import * as threadCollab from "@/lib/threadCollab";
import * as serverDb from "@/lib/serverDb";
import * as serverImap from "@/lib/serverImap";
import * as flagMutation from "@/lib/messageFlagMutation";

async function applyFlagMutationsStub(params: Parameters<typeof flagMutation.applyFlagMutationsToMessage>[0]) {
  const { messageId, flag, keyword, value } = params;
  flagCalls.push({ messageId, flag, keyword, value });
  if (keyword && keyword === failKeyword) throw new Error("STORE rejected");
  const name = keyword ?? (flag === "answered" ? "\\Answered" : "\\Forwarded");
  const flags = params.message.flags ?? [];
  return value ? Array.from(new Set([...flags, name])) : flags.filter((item) => item !== name);
}

await dbModulePromise;
const { completeSend } = await import("./completeSend");

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
  const spies: Array<{ mockRestore: () => void }> = [];
  beforeAll(() => {
    spies.push(
      spyOn(flagMutation, "applyFlagMutationsToMessage").mockImplementation(applyFlagMutationsStub),
      spyOn(threadCollab, "listReplySourceMessageIds").mockImplementation(async (_accountId: string, messageId: string) =>
        [...storedMessages.values()].filter((message) => message.messageId === messageId).map((message) => ({ id: message.id }))),
      spyOn(threadCollab, "recordReplySent").mockImplementation(async () => {}),
      spyOn(serverDb, "getMessageById").mockImplementation(async (_accountId: string, id: string) => storedMessages.get(id) ?? null),
      spyOn(serverDb, "getFolders").mockImplementation(async () => []),
      spyOn(serverDb, "saveFoldersForAccount").mockImplementation(async () => {}),
      spyOn(serverImap, "listImapFolders").mockImplementation(async () => [])
    );
  });
  afterAll(() => { spies.forEach((spy) => spy.mockRestore()); });
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
