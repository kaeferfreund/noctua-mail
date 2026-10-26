import { randomUUID } from "crypto";
import { expect } from "bun:test";
import type { Account } from "@/lib/data";
import { dbModulePromise } from "@/lib/testDbHarness";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { requireActiveUserSession } from "@/lib/auth";
import { mintMcpToken } from "@/lib/mcpAuth";
import { isolatedImapTest } from "@/lib/testFixtures/isolatedImapTest";
import { listImapFolders, syncImapMessage } from "@/lib/serverImap";
import { sanitizeSyncedMessage } from "@/lib/mail/syncMessageSanitizer";
import { drainImapConnectionPool } from "@/lib/mail/imap/connectionPool";
import { startImapServer } from "@/scripts/dev-fixture/imap-server";
import { demoPass, demoUser } from "@/scripts/dev-fixture/seed";
import { simpleParser } from "mailparser";
import { saveDraftForAccount } from "@/lib/drafts";
import { COMPOSE_INVITE_HEADER, decodeComposeInviteHeader } from "@/lib/composeInviteMetadata";

const fixtureTest = (name: string, run: () => Promise<void>) =>
  isolatedImapTest(import.meta.url, "NOCTUA_MCP_DRAFT_EDIT_FIXTURE", name, run);

type ToolResult = { isError?: boolean; content: Array<{ text: string }>; structuredContent: Record<string, any> };

fixtureTest("MCP drafts over the HTTP route against the dev fixture: create, get, update in place, edit a synced draft", async () => {
  const server = await startImapServer({ port: 0, user: demoUser, pass: demoPass, seed: "monkeydent", date: new Date("2026-10-22T08:00:00Z") });
  try {
    const db = await dbModulePromise;
    const accountId = `mcp-draft-fixture-${randomUUID()}`;
    const account: Account = { id: accountId, name: "MonkeyDent", email: demoUser, avatar: "MD",
      imap: { host: "127.0.0.1", port: server.port, secure: false, user: demoUser, password: demoPass },
      smtp: { host: "127.0.0.1", port: 9, secure: false, user: demoUser, password: demoPass } };
    await db.upsertAccount(account);
    await db.saveFoldersForAccount(accountId, await listImapFolders(account));
    const fixture = await createAuthenticatedTestSession(accountId);
    const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: fixture.jar.headers() }));
    if (session instanceof Response) throw new Error("Synthetic session missing");
    const { token } = await mintMcpToken(session, accountId, "Synthetic fixture", 3600, { mode: "drafts" });
    const { POST } = await import("./route");
    let nextId = 1;
    const call = async (name: string, args: Record<string, unknown>) => {
      const response = await POST(new Request("http://localhost:3000/api/mcp", { method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } }) }));
      expect(response.status).toBe(200);
      const result = (await response.json() as { result: ToolResult }).result;
      expect(result.isError).toBeUndefined();
      return result.structuredContent;
    };
    const drafts = () => server.store.get("Drafts")!.messages;
    const uids = () => drafts().map(message => message.uid);
    const parsed = (uid: number) => simpleParser(drafts().find(message => message.uid === uid)!.mime.raw, { skipImageLinks: true });
    const seededDraftUids = uids();

    // create → the fixture's Drafts mailbox holds the new message with its attachment
    const created = await call("create_draft_message", { to: "patient@example.test", subject: "Terminbestätigung",
      text: "Hallo,\n\nIhr Termin ist am Dienstag.",
      attachments: [{ filename: "anfahrt.txt", contentType: "text/plain", dataUrl: `data:text/plain;base64,${Buffer.from("Synthetische Anfahrt").toString("base64")}` }] });
    const createdId = created.draftId as string;
    const [createdUid] = uids().filter(uid => !seededDraftUids.includes(uid));
    const createdMail = await parsed(createdUid!);
    expect(createdMail.subject).toBe("Terminbestätigung");

    // get → the editable view of what was saved
    const before = (await call("get_draft_message", { draftId: createdId })).draft;
    expect(before).toMatchObject({ draftId: createdId, to: "patient@example.test", subject: "Terminbestätigung", composeFormat: "text",
      text: expect.stringContaining("Ihr Termin ist am Dienstag."), attachments: [{ filename: "anfahrt.txt", inline: false }] });

    // update → appended in place: the old IMAP message is gone, one new message keeps Message-ID and attachment
    const updated = await call("update_draft_message", { draftId: createdId, appendBody: "Bitte bringen Sie Ihre Versichertenkarte mit." });
    expect(updated.previousDraftId).toBe(createdId);
    expect(updated.draftIdChanged).toBe(updated.draftId !== createdId);
    expect(uids()).not.toContain(createdUid);
    const updatedUids = uids().filter(uid => !seededDraftUids.includes(uid));
    expect(updatedUids).toHaveLength(1);
    const updatedMail = await parsed(updatedUids[0]!);
    expect(updatedMail.text).toContain("Ihr Termin ist am Dienstag.\n\nBitte bringen Sie Ihre Versichertenkarte mit.");
    expect(updatedMail.messageId).toBe(createdMail.messageId);
    expect(updatedMail.attachments.map((item: { filename: string; content: Buffer }) => [item.filename, item.content.toString()])).toEqual([["anfahrt.txt", "Synthetische Anfahrt"]]);
    if (updated.draftIdChanged) expect(await db.getMessageById(accountId, createdId)).toBeNull();

    // get → shows the change under the returned id
    const after = (await call("get_draft_message", { draftId: updated.draftId })).draft;
    expect(after.text).toContain("Ihr Termin ist am Dienstag.");
    expect(after.text).toContain("Bitte bringen Sie Ihre Versichertenkarte mit.");
    expect(after).toMatchObject({ to: "patient@example.test", subject: "Terminbestätigung", identityId: before.identityId,
      attachments: [{ filename: "anfahrt.txt" }] });

    // a draft written by another client and synced from IMAP is editable the same way
    const seededUid = seededDraftUids[0]!;
    const synced = await syncImapMessage(account, "Drafts", seededUid, "synthetic-sync");
    if (!synced) throw new Error("Seeded draft did not sync");
    await db.upsertMessages(accountId, null, [await sanitizeSyncedMessage(synced, accountId)]);
    const listed = await call("list_draft_messages", {});
    expect(listed.drafts.map((item: { draftId: string }) => item.draftId)).toContain(synced.id);
    const beforeSeededEdit = uids();
    const seeded = await call("update_draft_message", { draftId: synced.id, subject: "Entwurf: Angebot geprüft" });
    expect(uids()).not.toContain(seededUid);
    const [seededEditUid] = uids().filter(uid => !beforeSeededEdit.includes(uid));
    const seededMail = await parsed(seededEditUid!);
    expect(seededMail.subject).toBe("Entwurf: Angebot geprüft");
    expect(seededMail.text?.trimEnd()).toBe(synced.body.trimEnd());
    expect(seededMail.from?.value[0]?.address).toBe(demoUser);
    expect((await call("get_draft_message", { draftId: seeded.draftId })).draft).toMatchObject({ subject: "Entwurf: Angebot geprüft",
      text: expect.stringContaining("synthetische Praxisnotiz") });

    // Markdown source follows the same append semantics as the UI editor.
    const markdown = await call("create_draft_message", { to: "peer@example.test", subject: "Markdown", markdown: "**Original**" });
    const markdownRead = (await call("get_draft_message", { draftId: markdown.draftId })).draft;
    const markdownUpdated = await call("update_draft_message", { draftId: markdown.draftId,
      expectedUpdatedAt: markdownRead.updatedAt, appendBody: "*Addition*" });
    const markdownMail = await parsed(markdownUpdated.message.imapUid);
    expect(markdownMail.text).toContain("**Original**\n\n*Addition*");
    expect(markdownMail.html).toContain("<em>Addition</em>");

    // A UI-created text reply retains its invitation, quoted original and inline image.
    // This image deliberately has no Content-ID until the MCP re-save repairs it.
    const invite = { start: "2026-11-01T10:00:00Z", end: "2026-11-01T11:00:00Z", allDay: false, location: "Synthetic room" };
    const reply = await saveDraftForAccount({ account, accountId, clientId: "synthetic-ui", actor: { userId: fixture.user.id, clientId: "synthetic-ui" }, payload: {
      to: "peer@example.test", subject: "Reply", text: "Authored\n\nOn Monday, Sender wrote:\n> Original", composeFormat: "text",
      html: '<p>Authored</p><div id="noctua-quoted-html"><blockquote>Original</blockquote></div>',
      inReplyTo: "<original@example.test>", references: ["<original@example.test>"], invite,
      attachments: [{ filename: "inline.png", contentType: "image/png", inline: true, dataUrl: `data:image/png;base64,${Buffer.from("synthetic image").toString("base64")}` }]
    } });
    expect(reply.message!.htmlBody).toContain("/attachments/");
    const replyUpdated = await call("update_draft_message", { draftId: reply.draftId, appendBody: "Addition" });
    const replyMail = await parsed(replyUpdated.message.imapUid);
    expect(replyMail.text).toContain("Authored\n\nAddition\n\nOn Monday, Sender wrote:\n> Original");
    expect(replyMail.inReplyTo).toBe("<original@example.test>");
    expect(decodeComposeInviteHeader(String(replyMail.headers.get(COMPOSE_INVITE_HEADER)))).toEqual(invite);
    expect(replyMail.attachments[0]!.cid).toBeTruthy();
    expect(replyMail.attachments[0]!.content.toString()).toBe("synthetic image");

    const inline = await saveDraftForAccount({ account, accountId, clientId: "synthetic-ui", payload: {
      to: "peer@example.test", subject: "HTML image", text: "Authored", composeFormat: "html", html: "<p>Authored</p>",
      attachments: [{ filename: "inline.png", contentType: "image/png", inline: true,
        dataUrl: `data:image/png;base64,${Buffer.from("synthetic image").toString("base64")}` }]
    } });
    const oldUrl = inline.message!.attachments![0]!.url!;
    expect(inline.message!.htmlBody).toContain(oldUrl);
    const inlineUpdated = await call("update_draft_message", { draftId: inline.draftId, subject: "Image kept" });
    const inlineMail = await parsed(inlineUpdated.message.imapUid);
    expect(inlineMail.html).toContain(`cid:${inlineMail.attachments[0]!.cid}`);
    expect(inlineMail.html).not.toContain(oldUrl);
    expect(inlineUpdated.message.htmlBody).toContain(inlineUpdated.message.attachments[0].url);
    expect(inlineUpdated.message.attachments[0].url).not.toBe(oldUrl);
  } finally {
    await drainImapConnectionPool();
    await server.stop();
  }
});
