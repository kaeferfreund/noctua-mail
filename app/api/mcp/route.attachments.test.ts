import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import type { Account, Attachment, Folder, Message } from "@/lib/data";
import { mintMcpToken } from "@/lib/mcpAuth";
import { createAuthenticatedTestSession, getSharedTestAuthHarness } from "@/lib/testAuthHarness";
import { requireActiveUserSession } from "@/lib/auth";
import { dbModulePromise } from "@/lib/testDbHarness";
import { saveAttachmentData, saveMessageSource } from "@/lib/storage";
import { messageDeepLink } from "@/lib/navigation/deepLinks";
import { MCP_ATTACHMENT_MAX_BYTES } from "@/lib/mcpAttachments";

const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;
const { POST } = await import("./route");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("synthetic-png-body")]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x01, 0x02, 0x03]);
// 25,000 characters: one ASCII line repeated, then an emoji right at the default page boundary.
const CSV_TEXT = `${"name;ort\n".repeat(2222)}${"x".repeat(1)}😀${"y".repeat(5000 - 3)}`;
const CSV = Buffer.from(CSV_TEXT, "utf8");
// Untrusted filename characters, built from code points so the source stays plain ASCII.
const RLO = String.fromCharCode(0x202e), BELL = String.fromCharCode(0x07);
const LATIN1 = Buffer.from("Grüße aus Köln", "latin1");

type Seeded = { id: string; filename: string; contentType: string; data: Buffer | null; inline?: boolean };

function buildAccount(accountId: string): Account {
  return {
    id: accountId, name: "MCP Attachment Test", email: "owner@example.test", avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "secret-imap" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "secret-smtp" }
  };
}

function buildMessage(accountId: string, folderId: string, suffix: string, attachments: Attachment[], flags: string[] = []): Message {
  const dateValue = Date.UTC(2026, 10, 10, 9, 0, 0);
  return {
    id: `${accountId}-${suffix}`, accountId, folderId, threadId: `${accountId}-thread-${suffix}`,
    messageId: `<${accountId}-${suffix}@example.test>`, subject: `Anhang ${suffix}`, from: "alice@example.test",
    to: "owner@example.test", preview: "", date: new Date(dateValue).toISOString(), dateValue, body: "Siehe Anhang.",
    mailboxPath: "INBOX", imapUid: 100 + suffix.length, flags, attachments
  };
}

async function seedMessage(accountId: string, folderId: string, suffix: string, items: Seeded[], flags?: string[]) {
  const attachments = items.map(item => ({ id: item.id, filename: item.filename, contentType: item.contentType,
    size: item.data?.length ?? 0, inline: Boolean(item.inline) }));
  const message = buildMessage(accountId, folderId, suffix, attachments, flags);
  await upsertMessages(accountId, folderId, [message]);
  for (const item of items) if (item.data) await saveAttachmentData(accountId, message.id, item.id, item.data);
  return message;
}

async function seedMailbox(accountId: string) {
  const inbox: Folder = { id: `${accountId}-inbox`, accountId, name: "Inbox", count: 0, unreadCount: 0, specialUse: "\\Inbox" };
  const drafts: Folder = { id: `${accountId}:Drafts`, accountId, name: "Drafts", count: 0, unreadCount: 0, specialUse: "\\Drafts" };
  await upsertAccount(buildAccount(accountId));
  await saveFoldersForAccount(accountId, [inbox, drafts]);
  const main = await seedMessage(accountId, inbox.id, "main", [
    { id: "att-0", filename: "foto.png", contentType: "image/png", data: PNG, inline: true },
    { id: "att-1", filename: "liste.csv", contentType: "text/csv; charset=utf-8", data: CSV },
    { id: "att-2", filename: "befund.pdf", contentType: "application/pdf", data: PDF },
    { id: "att-3", filename: "archiv.zip", contentType: "application/zip", data: ZIP },
    { id: "att-4", filename: "fake.png", contentType: "image/png", data: Buffer.from("<script>alert(1)</script>") },
    { id: "att-5", filename: "gross.pdf", contentType: "application/pdf", data: Buffer.alloc(MCP_ATTACHMENT_MAX_BYTES + 1, 0x20) },
    { id: "att-6", filename: "gruss.txt", contentType: "text/plain; charset=ISO-8859-1", data: LATIN1 },
    { id: "att-7", filename: `${RLO}gnp.exe${BELL}\nnotiz.txt`, contentType: "TEXT/Plain\r\nX-Evil: 1", data: Buffer.from("Notiz") },
    { id: "att-8", filename: "fehlt.txt", contentType: "text/plain", data: null }
  ]);
  const other = await seedMessage(accountId, inbox.id, "other", [
    { id: "att-other", filename: "geheim.txt", contentType: "text/plain", data: Buffer.from("other message") }
  ]);
  const draft = await seedMessage(accountId, drafts.id, "draft", [
    { id: "att-0", filename: "entwurf.txt", contentType: "text/plain", data: Buffer.from("Entwurfsanhang") }
  ], ["\\Draft", "\\Seen"]);
  return { main, other, draft, inbox };
}

async function mint(accountId: string, options: { mode?: "read" | "drafts" | "full"; accountIds?: string[] } = {}, setup?: (userId: string) => Promise<void>) {
  const fixture = await createAuthenticatedTestSession(accountId);
  await setup?.(fixture.user.id);
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: fixture.jar.headers() }));
  if (session instanceof Response) throw new Error("Fixture session missing");
  const minted = await mintMcpToken(session, accountId, "Synthetic attachments", 86400, options);
  return { token: minted.token, tokenId: minted.tokenRecord.id, userId: fixture.user.id, fixture };
}

type ToolResult = { isError?: boolean; content: Array<{ type: string; text?: string; data?: string; mimeType?: string;
  resource?: { uri: string; mimeType: string; blob: string } }>; structuredContent: Record<string, any> };

async function post(body: unknown, token: string) {
  const response = await POST(new Request("http://localhost:3000/api/mcp", { method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));
  expect(response.status).toBe(200);
  return response.json();
}
async function callTool(token: string, name: string, args: Record<string, unknown>, id = 1): Promise<ToolResult> {
  return ((await post({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } }, token)) as { result: ToolResult }).result;
}
const errorText = (result: ToolResult) => { expect(result.isError).toBe(true); return result.content[0]?.text ?? ""; };

describe("MCP attachment tools", () => {
  test("list_message_attachments and message details list sanitized attachments", async () => {
    const accountId = `acc-mcp-att-list-${randomUUID()}`;
    const { main } = await seedMailbox(accountId);
    const { token } = await mint(accountId, { mode: "read" });

    const listed = await callTool(token, "list_message_attachments", { messageId: main.id });
    expect(listed.isError).toBeUndefined();
    expect(listed.structuredContent).toMatchObject({ ok: true, accountId, messageId: main.id });
    const origin = new URL(listed.structuredContent.url).origin;
    expect(listed.structuredContent.url).toBe(messageDeepLink(main, origin));
    const attachments = listed.structuredContent.attachments as Array<Record<string, unknown>>;
    expect(attachments).toHaveLength(9);
    expect(attachments[0]).toEqual({ id: "att-0", filename: "foto.png", contentType: "image/png", size: PNG.length, inline: true });
    expect(attachments.find(item => item.id === "att-1")).toMatchObject({ contentType: "text/csv" });
    // Untrusted metadata: bidi/control characters and header injection are removed, a malformed type becomes octet-stream.
    expect(attachments.find(item => item.id === "att-7")).toMatchObject({ filename: "gnp.exe notiz.txt", contentType: "application/octet-stream" });
    expect(listed.content[0]!.text).toContain('"foto.png" id=att-0 image/png');

    const viaUrl = await callTool(token, "list_message_attachments", { url: messageDeepLink(main, "https://mail.example.test") }, 2);
    expect(viaUrl.structuredContent.attachments).toEqual(attachments);

    const resolved = await callTool(token, "resolve_link", { url: messageDeepLink(main, "https://mail.example.test") }, 3);
    expect(resolved.structuredContent.message.attachments).toMatchObject(attachments);

    expect(errorText(await callTool(token, "list_message_attachments", { messageId: "missing" }, 4))).toContain("Message not found");
  });

  test("get_message_attachment returns images, paged text, documents and binaries in the right form", async () => {
    const accountId = `acc-mcp-att-get-${randomUUID()}`;
    const { main } = await seedMailbox(accountId);
    const { token } = await mint(accountId, { mode: "read" });
    const get = (attachmentId: string, extra: Record<string, unknown> = {}, id = 1) =>
      callTool(token, "get_message_attachment", { messageId: main.id, attachmentId, ...extra }, id);

    const image = await get("att-0");
    expect(image.isError).toBeUndefined();
    expect(image.content[1]).toEqual({ type: "image", data: PNG.toString("base64"), mimeType: "image/png" });
    expect(image.structuredContent).toMatchObject({ ok: true, form: "image", dataIncluded: true, truncated: false, bytes: PNG.length,
      attachment: { id: "att-0", filename: "foto.png" } });
    const origin = new URL(image.structuredContent.url).origin;
    expect(image.structuredContent.url).toBe(messageDeepLink(main, origin));
    expect(JSON.stringify(image.structuredContent)).not.toContain(PNG.toString("base64"));

    const first = await get("att-1", {}, 2);
    expect(first.structuredContent).toMatchObject({ form: "text", offset: 0, totalChars: CSV_TEXT.length, truncated: true, dataIncluded: false });
    // The default page ends before the emoji's high surrogate instead of splitting it.
    expect(first.structuredContent.returnedChars).toBe(19_999);
    expect(first.content[1]).toEqual({ type: "text", text: CSV_TEXT.slice(0, 19_999) });
    const second = await get("att-1", { offset: first.structuredContent.nextOffset, maxChars: 100_000 }, 3);
    expect(second.structuredContent).toMatchObject({ form: "text", offset: 19_999, truncated: false });
    expect(second.structuredContent.nextOffset).toBeUndefined();
    expect(`${first.content[1]!.text}${second.content[1]!.text}`).toBe(CSV_TEXT);
    expect(second.structuredContent.text).toBe(second.content[1]!.text);
    const small = await get("att-1", { offset: 9, maxChars: 8 }, 4);
    expect(small.structuredContent).toMatchObject({ text: "name;ort", returnedChars: 8, truncated: true, nextOffset: 17 });
    expect(errorText(await get("att-1", { maxChars: 100_001 }, 5))).toContain("100000");

    const latin = await get("att-6", {}, 6);
    expect(latin.structuredContent).toMatchObject({ form: "text", text: "Grüße aus Köln" });

    const pdf = await get("att-2", {}, 7);
    expect(pdf.structuredContent).toMatchObject({ form: "metadata", dataIncluded: false, attachment: { contentType: "application/pdf" } });
    expect(pdf.structuredContent.note).toContain("Text extraction is not available");
    expect(pdf.content).toHaveLength(1);
    const pdfData = await get("att-2", { includeData: true }, 8);
    expect(pdfData.structuredContent).toMatchObject({ form: "resource", dataIncluded: true, bytes: PDF.length });
    expect(pdfData.content[1]).toEqual({ type: "resource", resource: { mimeType: "application/pdf", blob: PDF.toString("base64"),
      uri: `${origin}/api/accounts/${encodeURIComponent(accountId)}/messages/${encodeURIComponent(main.id)}/attachments/att-2` } });

    const zip = await get("att-3", {}, 9);
    expect(zip.structuredContent).toMatchObject({ form: "metadata", dataIncluded: false });
    expect(zip.structuredContent.bytes).toBeUndefined();
    const zipData = await get("att-3", { includeData: true }, 10);
    expect(zipData.content[1]!.resource).toMatchObject({ mimeType: "application/zip", blob: ZIP.toString("base64") });

    // A declared image whose bytes are no allowed image is never returned as an image block.
    const fake = await get("att-4", {}, 11);
    expect(fake.structuredContent).toMatchObject({ form: "metadata", note: "The file content is not the declared image type." });
    expect(fake.content.some(block => block.type === "image")).toBe(false);
    const fakeData = await get("att-4", { includeData: true }, 12);
    expect(fakeData.structuredContent.form).toBe("resource");
    expect(fakeData.content[1]!.resource!.mimeType).toBe("image/png");

    const missingData = errorText(await get("att-8", {}, 13));
    expect(missingData).toContain("not available on the server");
  });

  test("an attachment over the cap is rejected with its size and the cap", async () => {
    const accountId = `acc-mcp-att-cap-${randomUUID()}`;
    const { main } = await seedMailbox(accountId);
    const { token } = await mint(accountId, { mode: "read" });
    const text = errorText(await callTool(token, "get_message_attachment", { messageId: main.id, attachmentId: "att-5", includeData: true }));
    expect(text).toContain(`${MCP_ATTACHMENT_MAX_BYTES + 1} bytes`);
    expect(text).toContain(`the limit is 5.0 MiB (${MCP_ATTACHMENT_MAX_BYTES} bytes)`);
    expect(text).toContain("Open in Noctua Mail:");
    // Without includeData the oversized PDF is only described; nothing is loaded.
    const meta = await callTool(token, "get_message_attachment", { messageId: main.id, attachmentId: "att-5" }, 2);
    expect(meta.structuredContent).toMatchObject({ form: "metadata", attachment: { size: MCP_ATTACHMENT_MAX_BYTES + 1 } });
  });

  test("calls of one batch share the per-request byte budget", async () => {
    const accountId = `acc-mcp-att-budget-${randomUUID()}`;
    const { inbox } = await seedMailbox(accountId);
    const chunk = Buffer.alloc(4 * 1024 * 1024, 0x41);
    const big = await seedMessage(accountId, inbox.id, "big", [0, 1, 2].map(index =>
      ({ id: `att-${index}`, filename: `teil-${index}.bin`, contentType: "application/octet-stream", data: chunk })));
    const { token } = await mint(accountId, { mode: "read" });
    const responses = (await post([0, 1, 2].map(index => ({ jsonrpc: "2.0", id: index + 1, method: "tools/call",
      params: { name: "get_message_attachment", arguments: { messageId: big.id, attachmentId: `att-${index}`, includeData: true } } })), token)) as
      Array<{ id: number; result: ToolResult }>;
    const errors = responses.filter(response => response.result.isError);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.result.content[0]!.text).toContain("the limit per request is 10.0 MiB");
    // A separate request has its own budget.
    const again = await callTool(token, "get_message_attachment", { messageId: big.id, attachmentId: "att-0", includeData: true }, 9);
    expect(again.structuredContent.form).toBe("resource");
  });

  test("an uncached attachment is extracted from the stored message source", async () => {
    const accountId = `acc-mcp-att-source-${randomUUID()}`;
    const { inbox } = await seedMailbox(accountId);
    const message = await seedMessage(accountId, inbox.id, "source", [
      { id: "att-0", filename: "notiz.txt", contentType: "text/plain", data: null }
    ]);
    await saveMessageSource(accountId, message.id, [
      "From: alice@example.test", "To: owner@example.test", "Subject: Quelle", "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="b1"', "", "--b1", "Content-Type: text/plain", "", "Text", "--b1",
      'Content-Type: text/plain; name="notiz.txt"', 'Content-Disposition: attachment; filename="notiz.txt"',
      "Content-Transfer-Encoding: base64", "", Buffer.from("Aus der Quelle").toString("base64"), "--b1--", ""
    ].join("\r\n"));
    const { token } = await mint(accountId, { mode: "read" });
    const result = await callTool(token, "get_message_attachment", { messageId: message.id, attachmentId: "att-0" });
    expect(result.structuredContent).toMatchObject({ form: "text", text: "Aus der Quelle" });
  });

  test("draft attachments open through the same tool", async () => {
    const accountId = `acc-mcp-att-draft-${randomUUID()}`;
    const { draft } = await seedMailbox(accountId);
    const { token } = await mint(accountId, { mode: "read" });
    const listed = await callTool(token, "list_message_attachments", { messageId: draft.id });
    expect(listed.structuredContent.attachments).toEqual([{ id: "att-0", filename: "entwurf.txt", contentType: "text/plain", size: 14, inline: false }]);
    const result = await callTool(token, "get_message_attachment", { messageId: draft.id, attachmentId: "att-0" }, 2);
    expect(result.structuredContent).toMatchObject({ form: "text", text: "Entwurfsanhang" });
  });

  test("access is exactly the access to the message: wrong, foreign and uncovered ids are refused", async () => {
    const accountId = `acc-mcp-att-perm-${randomUUID()}`;
    const sharedId = `${accountId}-shared`;
    const uncoveredId = `${accountId}-uncovered`;
    const { main, other } = await seedMailbox(accountId);
    const shared = await seedMailbox(sharedId);
    const uncovered = await seedMailbox(uncoveredId);
    const { token, tokenId, userId, fixture } = await mint(accountId, { mode: "read", accountIds: [accountId, sharedId] }, async id => {
      const harness = await getSharedTestAuthHarness();
      await harness.addMembership(id, sharedId, "viewer");
      await harness.addMembership(id, uncoveredId, "manager");
    });
    const get = (args: Record<string, unknown>, id = 1) => callTool(token, "get_message_attachment", args, id);
    const notFound = "Attachment not found";

    // Wrong or guessed ids, and the id of another message's attachment, all give the same answer.
    expect(errorText(await get({ messageId: main.id, attachmentId: "att-guess" }))).toBe(notFound);
    expect(errorText(await get({ messageId: main.id, attachmentId: "att-other" }, 2))).toBe(notFound);
    expect(errorText(await get({ messageId: other.id, attachmentId: "att-1" }, 3))).toBe(notFound);
    // A path-like id is only ever compared against the message's attachment rows.
    expect(errorText(await get({ messageId: main.id, attachmentId: "../att-0" }, 4))).toBe(notFound);
    // An attachment of a message in another mailbox, addressed through this mailbox.
    expect(errorText(await get({ messageId: main.id, attachmentId: "att-other", accountId }, 5))).toBe(notFound);
    expect(errorText(await get({ messageId: shared.other.id, attachmentId: "att-other" }, 6))).toContain("Message not found");

    // Covered shared mailbox with viewer role: readable.
    const viaShared = await get({ accountId: sharedId, messageId: shared.other.id, attachmentId: "att-other" }, 7);
    expect(viaShared.structuredContent).toMatchObject({ accountId: sharedId, form: "text", text: "other message" });
    // Mailbox membership exists but the token does not cover it.
    for (const args of [{ accountId: uncoveredId, messageId: uncovered.main.id, attachmentId: "att-0" },
      { url: messageDeepLink(uncovered.main, "https://mail.example.test"), attachmentId: "att-0" }]) {
      expect(errorText(await get(args, 8))).toContain("Mailbox is not covered by MCP token");
      expect(errorText(await callTool(token, "list_message_attachments", { ...args, attachmentId: undefined }, 9))).toContain("Mailbox is not covered by MCP token");
    }
    // Losing the membership revokes access at once.
    fixture.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(userId, sharedId);
    expect((await get({ accountId: sharedId, messageId: shared.other.id, attachmentId: "att-other" }, 10)).isError).toBe(true);

    // A token whose stored scopes lack read is refused before the handler runs, and the tools are not listed.
    fixture.master.prepare(`UPDATE mcp_tokens SET scopes='["drafts"]' WHERE id=?`).run(tokenId);
    for (const name of ["get_message_attachment", "list_message_attachments"]) {
      expect(errorText(await callTool(token, name, { messageId: main.id, attachmentId: "att-0" }, 11))).toBe("Token has no read permission");
    }
    const listed = (await post({ jsonrpc: "2.0", id: 12, method: "tools/list", params: {} }, token)) as { result: { tools: Array<{ name: string }> } };
    expect(listed.result.tools.map(tool => tool.name)).not.toContain("get_message_attachment");
  });

  test("tools/list advertises both tools as read-only with the limits in the description", async () => {
    const accountId = `acc-mcp-att-meta-${randomUUID()}`;
    await seedMailbox(accountId);
    const { token } = await mint(accountId, { mode: "read" });
    const listed = (await post({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }, token)) as
      { result: { tools: Array<{ name: string; description: string; annotations?: { readOnlyHint?: boolean } }> } };
    const get = listed.result.tools.find(tool => tool.name === "get_message_attachment");
    expect(get?.annotations?.readOnlyHint).toBe(true);
    expect(get?.description).toContain("5.0 MiB");
    expect(listed.result.tools.find(tool => tool.name === "list_message_attachments")?.annotations?.readOnlyHint).toBe(true);
    const init = (await post({ jsonrpc: "2.0", id: 2, method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test-client", version: "1.0.0" } } }, token)) as { result: { instructions: string } };
    expect(init.result.instructions).toContain("get_message_attachment");
  });
});
