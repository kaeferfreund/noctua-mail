import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { MockLanguageModelV4 } from "ai/test";
import type { Account, Message } from "@/lib/data";
import { createAuthenticatedTestSession, syntheticRequestIp } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { AI_MODIFIED_FLAG } from "@/lib/messageFlags";
import { replaceAiReplyModelFactory } from "@/lib/aiReply";

// Real route, session and DB; IMAP/SMTP and the model are stubbed, so no network is used.
type BuiltMail = { to?: string; subject: string; text: string; html?: string; inReplyTo?: string; references?: string[] };
let lastMail: BuiltMail | null = null;
const actualServerImap = await import("@/lib/serverImap");
const actualServerSmtp = await import("@/lib/serverSmtp");
mock.module("@/lib/serverImap", () => ({
  ...actualServerImap,
  appendImapMessage: async () => 9101,
  deleteImapMessage: async () => {},
  updateImapFlags: async () => {},
  syncImapMessage: async (account: Account, mailboxPath: string, uid: number): Promise<Message> => ({
    id: `${account.id}-draft-${uid}`, accountId: account.id, folderId: `${account.id}:Drafts`, threadId: `${account.id}-draft-thread`,
    messageId: `<ai-draft-${uid}@example.test>`, inReplyTo: lastMail?.inReplyTo, references: lastMail?.references,
    subject: lastMail?.subject ?? "", from: account.email, to: lastMail?.to ?? "", preview: "", date: "2026-10-27T09:00:00.000Z",
    dateValue: Date.UTC(2026, 9, 27, 9), body: lastMail?.text ?? "", htmlBody: lastMail?.html, mailboxPath, imapUid: uid,
    flags: ["\\Draft", "\\Seen"], draft: true, attachments: []
  })
}));
mock.module("@/lib/serverSmtp", () => ({
  ...actualServerSmtp,
  buildRawMessage: async (_account: Account, built: BuiltMail) => { lastMail = built; return `raw:${built.subject}`; }
}));
const { POST } = await import("./route");
mock.restore();

const api = await dbModulePromise;
const ORIGIN = "http://localhost:3000";
const accountId = `ai-reply-${crypto.randomUUID()}`;
const account: Account = {
  id: accountId, name: "Synthetic mailbox", email: "owner@example.test", avatar: "",
  imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "synthetic" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "synthetic" }
};
await api.upsertAccount(account);
await api.saveFoldersForAccount(accountId, [
  { id: `${accountId}-inbox`, accountId, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" },
  { id: `${accountId}:Drafts`, accountId, name: "Drafts", count: 0, unreadCount: 0, specialUse: "\\Drafts" }
]);
const incoming: Message = {
  id: `${accountId}-msg-1`, accountId, folderId: `${accountId}-inbox`, threadId: "<thanks@example.test>", messageId: "<thanks@example.test>",
  subject: "Unterlagen", from: "Erika Beispiel <erika@example.test>", to: "owner@example.test", preview: "Anbei",
  date: "2026-10-27T08:00:00.000Z", dateValue: Date.UTC(2026, 9, 27, 8), body: "Hallo,\nanbei die Unterlagen.\nErika",
  mailboxPath: "INBOX", imapUid: 11, flags: []
};
const savedDraft: Message = { ...incoming, id: `${accountId}-old-draft`, messageId: "<old-draft@example.test>", draft: true, imapUid: 12, flags: ["\\Draft"] };
await api.upsertMessages(accountId, `${accountId}-inbox`, [incoming, savedDraft]);

const editor = await createAuthenticatedTestSession(accountId);
const viewer = await createAuthenticatedTestSession();
await viewer.addMembership(viewer.user.id, accountId, "viewer");

let modelCalls = 0;
let lastPrompt = "";
let answer: () => string = () => "Hallo Erika,\n\nvielen Dank, das passt so!\n\nViele Grüße\nMax";
const stub = new MockLanguageModelV4({
  doGenerate: async (options) => {
    modelCalls += 1;
    lastPrompt = JSON.stringify(options.prompt.filter(part => part.role === "user"));
    return { content: [{ type: "text", text: answer() }], finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: { total: 50, noCache: 50, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 20, text: 20, reasoning: undefined } },
      warnings: [] };
  }
});
let available = true;
const restore = replaceAiReplyModelFactory(() => available ? stub : null);
afterAll(restore);

const call = (cookie: string, messageId = incoming.id, body: unknown = { locale: "de" }) => POST(
  new Request(`${ORIGIN}/api/accounts/${encodeURIComponent(accountId)}/messages/${encodeURIComponent(messageId)}/ai-reply`, {
    method: "POST", headers: { cookie, origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": syntheticRequestIp() },
    body: JSON.stringify(body)
  }),
  { params: Promise.resolve({ accountId, messageId }) }
);

describe("POST ai-reply", () => {
  beforeEach(() => { available = true; lastMail = null; });

  test("writes a reply draft with the generated text above the quote, marks it AI-written and never sends", async () => {
    const before = modelCalls;
    const response = await call(editor.jar.header());
    expect(response.status).toBe(200);
    const data = await response.json() as { ok: boolean; draftId: string; url: string; message: Message };
    expect(data.ok).toBe(true);
    expect(modelCalls).toBe(before + 1);
    expect(data.draftId).toBe(`${accountId}-draft-9101`);
    expect(new URL(data.url).searchParams.get("m")).toBeTruthy();
    expect(lastMail).toMatchObject({ to: "Erika Beispiel <erika@example.test>", subject: "Re: Unterlagen", inReplyTo: "<thanks@example.test>" });
    expect(lastMail!.text).toStartWith("Hallo Erika,\n\nvielen Dank, das passt so!\n\nViele Grüße\nMax\n\nAm ");
    expect(lastMail!.text).toContain("schrieb Erika Beispiel <erika@example.test>:\n> Hallo,\n> anbei die Unterlagen.");
    const stored = await api.getMessageById(accountId, data.draftId);
    expect(stored?.flags).toContain(AI_MODIFIED_FLAG);
  });

  test("forwards the instruction to the model; whitespace only is no instruction", async () => {
    expect((await call(editor.jar.header(), incoming.id, { locale: "de", instruction: "  Zusage für\n Donnerstag " })).status).toBe(200);
    expect(lastPrompt).toContain("<instruction>\\nZusage für Donnerstag\\n</instruction>");
    expect((await call(editor.jar.header(), incoming.id, { locale: "de", instruction: " \n\t " })).status).toBe(200);
    expect(lastPrompt).not.toContain("<instruction>");
  });

  test("400 instruction_too_long beyond 200 characters after trimming; the model is not called", async () => {
    const before = modelCalls;
    const tooLong = await call(editor.jar.header(), incoming.id, { locale: "de", instruction: "a".repeat(201) });
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toMatchObject({ ok: false, code: "instruction_too_long" });
    expect((await call(editor.jar.header(), incoming.id, { locale: "de", instruction: 42 })).status).toBe(400);
    expect(modelCalls).toBe(before);
    expect((await call(editor.jar.header(), incoming.id, { locale: "de", instruction: `  ${"a".repeat(200)}  ` })).status).toBe(200);
    expect(modelCalls).toBe(before + 1);
  });

  test("503 ai_unavailable without an API key; the model is not called", async () => {
    available = false;
    const before = modelCalls;
    const response = await call(editor.jar.header());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, code: "ai_unavailable" });
    expect(modelCalls).toBe(before);
  });

  test("viewers cannot write drafts (403), drafts are not answered (400)", async () => {
    const before = modelCalls;
    expect((await call(viewer.jar.header())).status).toBe(403);
    const draft = await call(editor.jar.header(), savedDraft.id);
    expect(draft.status).toBe(400);
    expect(modelCalls).toBe(before);
  });

  test("a failing model call answers 502 ai_failed and saves nothing", async () => {
    answer = () => { throw new Error("overloaded"); };
    try {
      const response = await call(editor.jar.header());
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ ok: false, code: "ai_failed", reason: "ai_call_failed" });
      expect(lastMail).toBeNull();
    } finally {
      answer = () => "Danke!";
    }
  });

  test("more than ten calls per user and minute answer 429", async () => {
    const fresh = await createAuthenticatedTestSession(accountId);
    const statuses: number[] = [];
    for (let index = 0; index < 11; index += 1) statuses.push((await call(fresh.jar.header())).status);
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
