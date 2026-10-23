// A child process isolates wrapper mocks from the randomized suite's module graph.
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { once } from "node:events";
import { mock } from "bun:test";
import { simpleParser } from "mailparser";
import { dbModulePromise } from "../testDbHarness";
import { createAuthenticatedTestSession } from "../testAuthHarness";
import { getAccountDb, getDb } from "../db/connection";
import { identityTestAccount } from "./senderIdentities";
import { createSenderIdentity, updateSenderIdentity } from "../senderIdentities";
import { startSmtpSink } from "./mail/smtp-sink";
import { demoPass, demoUser } from "./mail/seed";
import { markSmtpUpstreamFailure } from "../mail/smtpError";
import { requireActiveUserSession } from "../auth";
import { mintMcpToken } from "../mcpAuth";
import { parseAddressEmails } from "../ownAddresses";
import { saveMessageSource, getMessageSource } from "../storage";
import { parseDeliveryMetadata } from "../mail/imap/parser";
import type { Message } from "../data";

const api = await dbModulePromise;
const accountId = `sender-${crypto.randomUUID()}`;
const account = identityTestAccount(accountId);
await api.upsertAccount(account);
const manager = await createAuthenticatedTestSession(accountId);
const editor = await createAuthenticatedTestSession();
const viewer = await createAuthenticatedTestSession();
const outsider = await createAuthenticatedTestSession();
await manager.addMembership(editor.user.id, accountId, "editor");
await manager.addMembership(viewer.user.id, accountId, "viewer");
const master = await getDb();
const shard = await getAccountDb(accountId);
const alias = await createSenderIdentity(accountId, { email: "alias@example.test", displayName: "Synthetic Alias", replyTo: "replies@example.test" }, { userId: manager.user.id }, master);
const disabled = await createSenderIdentity(accountId, { email: "disabled@example.test", displayName: "Disabled", enabled: false }, { userId: manager.user.id }, master);
const primary = (await api.listSenderIdentities(accountId)).find(item => item.isDefault)!;
const foreignId = `${accountId}-foreign`;
await api.upsertAccount(identityTestAccount(foreignId));
const foreignIdentity = (await api.listSenderIdentities(foreignId))[0];
await api.mergeUserAccountPrefs(editor.user.id, accountId, { defaultIdentityId: alias.id });
await api.saveFoldersForAccount(accountId, ["Drafts", "Sent", "INBOX"].map(name => ({ id: `${accountId}:${name}`, accountId, name, count: 0, specialUse: `\\${name}` })));

let rejectCopyRecipient = false;
const sink = await startSmtpSink({ rejectRecipient: address => rejectCopyRecipient && address === "copy@example.test" ? "550 5.1.1 Synthetic recipient rejected" : undefined, port: 0, out: `${process.env.TMPDIR}/sender-smtp-${crypto.randomUUID()}` });
account.smtp = { host: "127.0.0.1", port: sink.port, secure: false, user: demoUser, password: demoPass };
await api.upsertAccount(account);
const smtpActual = { ...await import("../serverSmtp") };
const imapActual = { ...await import("../serverImap") };
let smtpCalls = 0, appendCalls = 0, deleteCalls = 0, listCalls = 0, uid = 0;
let failure: Record<string, unknown> | undefined;
const appended = new Map<number, { raw: Buffer; mailbox: string }>();
let rawEnvelope: { from: string; to: string[] } | undefined;
mock.module("@/lib/serverSmtp", () => ({ ...smtpActual,
  sendSmtpMessage: async (...args: Parameters<typeof smtpActual.sendSmtpMessage>) => {
    smtpCalls++;
    if (failure) throw markSmtpUpstreamFailure(Object.assign(new Error("Synthetic upstream failure"), failure), args[2].email);
    return smtpActual.sendSmtpMessage(...args);
  },
  sendRawSmtpMessage: async (...args: Parameters<typeof smtpActual.sendRawSmtpMessage>) => {
    smtpCalls++; rawEnvelope = args[2];
    if (failure) throw markSmtpUpstreamFailure(Object.assign(new Error("Synthetic upstream failure"), failure), args[2].from);
    return smtpActual.sendRawSmtpMessage(...args);
  }
}));
mock.module("@/lib/serverImap", () => ({ ...imapActual,
  appendImapMessage: async (_account: unknown, mailbox: string, raw: Buffer | string) => {
    appendCalls++; appended.set(++uid, { raw: Buffer.from(raw), mailbox }); return uid;
  },
  deleteImapMessage: async () => { deleteCalls++; },
  updateImapFlags: async () => {},
  listImapFolders: async () => { listCalls++; return []; },
  syncImapMessage: async (_account: unknown, mailbox: string, imapUid: number): Promise<Message> => {
    const raw = appended.get(imapUid)!.raw;
    const parsed = await simpleParser(raw);
    return { id: `sent-row-${imapUid}`, accountId, folderId: `${accountId}:${mailbox}`, threadId: parsed.messageId!, messageId: parsed.messageId,
      subject: parsed.subject!, from: parsed.from!.text, replyTo: parsed.replyTo?.text, to: Array.isArray(parsed.to) ? parsed.to.map((item: { text: string }) => item.text).join(", ") : parsed.to?.text ?? "",
      preview: "Synthetic", body: parsed.text ?? "", date: new Date().toISOString(), dateValue: Date.now(), source: raw.toString(),
      mailboxPath: mailbox, imapUid, ...parseDeliveryMetadata(raw) };
  }
}));
const { POST: direct } = await import("../../app/api/accounts/[accountId]/smtp/send/route");
const { POST: save } = await import("../../app/api/accounts/[accountId]/drafts/save/route");
const { POST: sendDraft } = await import("../../app/api/accounts/[accountId]/drafts/[draftId]/send/route");
const { POST: respond } = await import("../../app/api/accounts/[accountId]/calendar/events/[eventId]/respond/route");
const { POST: mcp } = await import("../../app/api/mcp/route");
const request = (body: unknown, auth = editor) => new Request("http://localhost:3000/api/send", { method: "POST", headers: auth.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }), body: JSON.stringify(body) });
const params = (extra = {}) => ({ params: Promise.resolve({ accountId, ...extra }) });
const outbound = { to: "recipient@example.test", cc: "copy@example.test", bcc: "blind@example.test", subject: "Synthetic", text: "Synthetic body" };
const counts = () => [smtpCalls, appendCalls, deleteCalls, listCalls];
async function rejected(run: () => Promise<Response>, status: number, code?: string) {
  const before = counts();
  const response = await run();
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  if (code) assert.equal(body.code, code);
  assert.deepEqual(counts(), before, "Validation/authorization must precede ALL SMTP, APPEND, cleanup and LIST work");
}
function checkSent(identityId: string, email: string) {
  const last = sink.received.at(-1)!;
  assert.equal(last.from, email, "Actual transport SMTP envelope uses approved identity");
  assert.equal(parseAddressEmails(last.source.toString().match(/^From: (.*)$/im)?.[1]?.trim())[0], email);
  assert.ok(!/^Bcc:/im.test(last.source.toString()));
  assert.ok(!/^X-Noctua-Identity-Id:/im.test(last.source.toString()));
  const mid = last.source.toString().match(/^Message-ID: (.*)$/im)![1].trim();
  assert.equal((shard.prepare("SELECT userId FROM sent_by WHERE accountId=? AND messageId=?").get(accountId, mid) as { userId: string }).userId, editor.user.id);
  assert.ok(identityId);
}
try {
  for (const [identityId, status, code] of [[foreignIdentity.id, 404, "identity_not_found"], ["unknown", 404, "identity_not_found"], [disabled.id, 409, "identity_unavailable"], [null, 400, "invalid_identity"]] as const) {
    await rejected(() => direct(request({ ...outbound, identityId, invite: { startAtMs: "invalid" } }), params()), status, code);
    await rejected(() => save(request({ ...outbound, identityId }), params()), status, code);
  }
  await rejected(() => direct(request({ ...outbound, from: "spoof@example.test" }), params()), 400, "invalid_identity");
  await rejected(() => direct(request({ ...outbound, replyTo: "injected@example.test" }), params()), 400, "reply_to_managed");
  await rejected(() => save(request({ ...outbound, envelopeFrom: "spoof@example.test" }), params()), 400, "invalid_identity");
  for (const replyTo of [undefined, "", alias.replyTo]) {
    const response = await direct(request({ ...outbound, replyTo }), params());
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json(); assert.equal(body.identityId, alias.id); assert.equal(body.sentCopy, "appended");
    checkSent(body.identityId, alias.email);
    assert.deepEqual(sink.received.at(-1)!.to, [outbound.to, outbound.cc, outbound.bcc]);
    assert.equal((await simpleParser(sink.received.at(-1)!.source)).replyTo?.value[0].address, alias.replyTo);
  }
  const mixedCase = await direct(request({ ...outbound, identityId: alias.id, to: "CaseRecipient@example.test" }), params());
  assert.equal(mixedCase.status, 200); assert.equal(sink.received.at(-1)!.to[0], "CaseRecipient@example.test", "Explicit envelope preserves recipient local-part casing");
  // Partial RCPT acceptance remains a successful single delivery, never a resend.
  rejectCopyRecipient = true;
  const beforePartial = smtpCalls, deliveriesBeforePartial = sink.received.length;
  const partial = await direct(request({ ...outbound, identityId: alias.id }), params());
  assert.equal(partial.status, 200, await partial.clone().text());
  assert.equal(smtpCalls, beforePartial + 1); assert.equal(sink.received.length, deliveriesBeforePartial + 1);
  assert.deepEqual(sink.received.at(-1)!.to, [outbound.to, outbound.bcc]);
  rejectCopyRecipient = false;
  await api.upsertMessages(accountId, null, [{ id: "reply-source", messageId: "<reply-source@example.test>", threadId: "reply-thread", accountId,
    folderId: `${accountId}:INBOX`, from: "customer@example.test", to: alias.email, subject: "Source", body: "Synthetic", preview: "", date: new Date().toISOString(), dateValue: Date.now(), mailboxPath: "INBOX", imapUid: 999 }]);
  await api.mergeUserAccountPrefs(editor.user.id, accountId, { defaultIdentityId: primary.id });
  const replyResponse = await direct(request({ ...outbound, inReplyTo: "<reply-source@example.test>" }), params());
  assert.equal((await replyResponse.json()).identityId, alias.id, "In-account reply evidence beats personal default");
  // Explicit primary wins over alias reply evidence and emits no Reply-To.
  const explicit = await direct(request({ ...outbound, identityId: primary.id, inReplyTo: "<reply-source@example.test>" }), params());
  assert.equal((await explicit.json()).identityId, primary.id);
  assert.equal((await simpleParser(sink.received.at(-1)!.source)).replyTo, undefined);

  const saved = await save(request({ ...outbound, identityId: alias.id, attachments: [{ id: "synthetic-attachment", filename: "synthetic.txt", contentType: "text/plain", size: 9, inline: false, dataUrl: "data:text/plain;base64,U3ludGhldGlj" }] }), params());
  assert.equal(saved.status, 200, await saved.clone().text());
  const savedBody = await saved.json(); const draftId = savedBody.draftId as string;
  assert.equal(savedBody.identityId, alias.id); assert.equal(savedBody.message.senderIdentityId, alias.id);
  assert.equal(savedBody.message.attachments[0].filename, "synthetic.txt");
  assert.equal((await simpleParser(appended.get(uid)!.raw)).from?.value[0].address, alias.email);
  // Editing with no ID preserves alias even though editor now prefers primary.
  const edited = await save(request({ ...outbound, draftId }), params());
  assert.equal((await edited.json()).identityId, alias.id);
  const currentDraft = (await api.getMessageById(accountId, draftId))!;
  assert.ok(currentDraft);

  const eventId = `event-${crypto.randomUUID()}`;
  const event = { id: eventId, accountId, eventUid: eventId, summary: "Synthetic RSVP", startAtMs: Date.UTC(2026, 9, 23, 10), allDay: false,
    sourceType: "email" as const, myAttendeeEmail: alias.email, createdAtMs: Date.now(), updatedAtMs: Date.now(), organizer: "Organizer <organizer@example.test>",
    rawIcs: ["BEGIN:VCALENDAR", "VERSION:2.0", "METHOD:REQUEST", "BEGIN:VEVENT", `UID:${eventId}`, "DTSTART:20261023T100000Z", "SUMMARY:Synthetic", "ORGANIZER:mailto:organizer@example.test", `ATTENDEE;PARTSTAT=NEEDS-ACTION:mailto:${alias.email}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n") };
  await api.upsertCalendarEvent(accountId, event);
  // Real nodemailer CONN/EPROTOCOL failure, including the review's private greeting.
  const protocolSink = createServer(socket => {
    socket.on("error", () => {});
    socket.end("554 5.7.1 synthetic-provider-private-detail\r\n");
  });
  protocolSink.listen(0, "127.0.0.1");
  await once(protocolSink, "listening");
  const protocolPort = (protocolSink.address() as { port: number }).port;
  const workingSmtp = account.smtp;
  try {
    await api.upsertAccount({ ...account, smtp: { ...workingSmtp, port: protocolPort } });
    for (const [name, run] of [
      ["direct", () => direct(request({ ...outbound, identityId: alias.id }), params())],
      ["draft", () => sendDraft(request({}), params({ draftId }))],
      ["calendar", () => respond(request({ partstat: "ACCEPTED", identityId: alias.id }), params({ eventId }))]
    ] as const) {
      const before = [appendCalls, deleteCalls, sink.received.length];
      const response = await run();
      assert.equal(response.status, 502, await response.clone().text());
      const body = await response.json();
      assert.equal(body.code, "smtp_upstream_error");
      assert.ok(!JSON.stringify(body).includes("synthetic-provider-private-detail"));
      assert.deepEqual([appendCalls, deleteCalls, sink.received.length], before);
      assert.ok(await api.getMessageById(accountId, draftId));
      console.log(`PASS private SMTP greeting sanitized: ${name}`);
    }
  } finally {
    await api.upsertAccount({ ...account, smtp: workingSmtp });
    await new Promise<void>((resolve, reject) => protocolSink.close(error => error ? reject(error) : resolve()));
  }
  for (const auth of [viewer, outsider]) {
    await rejected(() => direct(request({ ...outbound, identityId: alias.id }, auth), params()), 403);
    await rejected(() => save(request({ ...outbound, identityId: alias.id }, auth), params()), 403);
    await rejected(() => sendDraft(request({}, auth), params({ draftId })), 403);
    await rejected(() => respond(request({ partstat: "ACCEPTED" }, auth), params({ eventId })), 403);
  }
  master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(editor.user.id, accountId);
  await rejected(() => direct(request(outbound), params()), 403);
  await rejected(() => save(request(outbound), params()), 403);
  await rejected(() => sendDraft(request({}), params({ draftId })), 403);
  await rejected(() => respond(request({ partstat: "ACCEPTED" }), params({ eventId })), 403);
  await manager.addMembership(editor.user.id, accountId, "editor");

  for (const identityId of [primary.id, foreignIdentity.id, disabled.id, "unknown"]) {
    await rejected(() => respond(request({ partstat: "ACCEPTED", identityId }), params({ eventId })), 409, "identity_unavailable");
  }
  const rsvp = await respond(request({ partstat: "ACCEPTED", identityId: alias.id }), params({ eventId }));
  const rsvpBody = await rsvp.json(); assert.equal(rsvp.status, 200, JSON.stringify(rsvpBody)); assert.equal(rsvpBody.identityId, alias.id);
  checkSent(alias.id, alias.email);
  const rsvpMail = await simpleParser(sink.received.at(-1)!.source);
  const rsvpIcs = rsvpMail.attachments[0].content.toString().replace(/\r?\n[ \t]/g, "");
  assert.ok(rsvpIcs.includes(`:mailto:${alias.email}`)); assert.ok(rsvpIcs.includes("ORGANIZER:mailto:organizer@example.test"));
  assert.equal((await api.getCalendarEventById(accountId, eventId))!.organizer, event.organizer);
  for (const myAttendeeEmail of [undefined, "stale@example.test", disabled.email]) {
    await api.upsertCalendarEvent(accountId, { ...event, myAttendeeEmail });
    await rejected(() => respond(request({ partstat: "ACCEPTED" }), params({ eventId })), 409, "identity_unavailable");
  }
  await api.upsertCalendarEvent(accountId, event);
  const invite = await direct(request({ ...outbound, identityId: alias.id, to: alias.email, invite: { startAtMs: event.startAtMs, allDay: false } }), params());
  const inviteBody = await invite.json(); assert.equal(invite.status, 200, JSON.stringify(inviteBody));
  const invitation = (await simpleParser(sink.received.at(-1)!.source)).attachments[0].content.toString().replace(/\r?\n[ \t]/g, "");
  assert.ok(invitation.includes(`ORGANIZER;CN=Synthetic Alias:mailto:${alias.email}`));
  assert.ok(invitation.includes(`PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${alias.email}`));

  // Config drift and malformed raw headers preserve the draft and create no network side effects.
  await updateSenderIdentity(accountId, alias.id, { displayName: "Changed label" }, { userId: manager.user.id }, master);
  await rejected(() => sendDraft(request({}), params({ draftId })), 409, "draft_identity_changed");
  assert.ok(await api.getMessageById(accountId, draftId));
  await updateSenderIdentity(accountId, alias.id, { displayName: alias.displayName, enabled: false }, { userId: manager.user.id }, master);
  await rejected(() => sendDraft(request({}), params({ draftId })), 409, "identity_unavailable");
  await rejected(() => save(request({ ...outbound, draftId }), params()), 409, "identity_unavailable");
  await updateSenderIdentity(accountId, alias.id, { enabled: true }, { userId: manager.user.id }, master);
  const originalSource = (await getMessageSource(accountId, draftId))!;
  for (const corrupted of [
    "Sender: foreign@example.test\r\n" + originalSource,
    "From: foreign@example.test\r\n" + originalSource,
    originalSource.replace(/^(X-Noctua-Identity-Id:) .*/im, `$1 ${primary.id}`),
    originalSource.replace(/^From: .*/im, "From: Forged <foreign@example.test>")
  ]) {
    await saveMessageSource(accountId, draftId, corrupted);
    await rejected(() => sendDraft(request({}), params({ draftId })), 409, "draft_identity_changed");
    assert.ok(await api.getMessageById(accountId, draftId));
  }
  const unknownLegacy = originalSource.replace(/^X-Noctua-Identity-Id:.*\r?\n/im, "").replace(/^From: .*/im, "From: unknown@example.test");
  await saveMessageSource(accountId, draftId, unknownLegacy);
  await rejected(() => sendDraft(request({}), params({ draftId })), 409, "identity_unavailable");
  await saveMessageSource(accountId, draftId, originalSource);
  const wireBefore = sink.received.length, sentBefore = appendCalls, deleteBefore = deleteCalls;
  failure = { code: "EENVELOPE", command: "RCPT TO", responseCode: 553, response: "553 Sender address rejected: not owned by user" };
  const rejectedDraft = await sendDraft(request({}), params({ draftId }));
  assert.equal(rejectedDraft.status, 422); assert.equal((await rejectedDraft.json()).code, "smtp_sender_rejected");
  assert.equal(appendCalls, sentBefore); assert.equal(deleteCalls, deleteBefore); assert.equal(sink.received.length, wireBefore);
  assert.ok(await api.getMessageById(accountId, draftId));
  assert.equal(shard.prepare("SELECT 1 FROM sent_by WHERE accountId=? AND messageId=?").get(accountId, currentDraft.messageId!), null);
  failure = undefined;
  const smtpBefore = smtpCalls;
  const sentDraft = await sendDraft(request({}), params({ draftId }));
  assert.equal(sentDraft.status, 200, await sentDraft.clone().text());
  assert.equal((await sentDraft.json()).identityId, alias.id); assert.equal(smtpCalls, smtpBefore + 1);
  assert.equal(rawEnvelope!.from, alias.email); assert.deepEqual(rawEnvelope!.to, [outbound.to, outbound.cc, outbound.bcc]);
  checkSent(alias.id, alias.email);
  assert.equal(await api.getMessageById(accountId, draftId), null);
  const sentRaw = appended.get(uid)!.raw.toString();
  assert.ok(!/^X-Noctua-Identity-Id:/im.test(sentRaw)); assert.ok(/^Bcc:/im.test(sentRaw));
  assert.equal((await simpleParser(sentRaw)).from?.text, (await simpleParser(sink.received.at(-1)!.source)).from?.text);

  const bccOnlySave = await save(request({ ...outbound, to: "", cc: "", identityId: alias.id }), params());
  const bccOnlyId = (await bccOnlySave.json()).draftId;
  const bccOnlySend = await sendDraft(request({}), params({ draftId: bccOnlyId }));
  assert.equal(bccOnlySend.status, 200); assert.deepEqual(sink.received.at(-1)!.to, [outbound.bcc]);
  assert.ok(/^To: undisclosed-recipients:;/im.test(sink.received.at(-1)!.source.toString()));
  assert.ok(/^To: undisclosed-recipients:;/im.test(appended.get(uid)!.raw.toString()));
  assert.ok(/^Bcc:/im.test(appended.get(uid)!.raw.toString()));

  // SMTP rejection classes use the same route mapper; none append a Sent copy.
  for (const [upstream, code, status] of [
    [{ code: "EENVELOPE", command: "MAIL FROM", responseCode: 553, response: "Sender rejected" }, "smtp_sender_rejected", 422],
    [{ code: "EENVELOPE", command: "RCPT TO", responseCode: 550, response: "No such recipient", rejected: [outbound.to] }, "smtp_recipient_rejected", 422],
    [{ code: "EMESSAGE", command: "DATA", responseCode: 554, response: "Content rejected" }, "smtp_message_rejected", 422],
    [{ code: "EENVELOPE", command: "MAIL FROM", responseCode: 451 }, "smtp_temporary_failure", 502],
    [{ code: "EAUTH", responseCode: 535 }, "smtp_configuration_error", 502],
    [{ code: "ETIMEDOUT" }, "smtp_server_timeout", 504]
  ] as const) {
    failure = upstream; const before = appendCalls;
    const response = await direct(request({ ...outbound, identityId: alias.id }), params());
    assert.equal(response.status, status); const body = await response.json(); assert.equal(body.code, code);
    if (code === "smtp_sender_rejected") assert.equal(body.rejectedAddress, alias.email);
    assert.equal(appendCalls, before);
  }
  failure = undefined;

  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: manager.jar.headers() }));
  if (session instanceof Response) throw new Error("No synthetic session");
  const minted = await mintMcpToken(session, accountId, "Synthetic sender contract", 3600);
  const rpc = async (method: string, tool?: string, args?: Record<string, unknown>) => (await mcp(new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${minted.token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, ...(tool ? { params: { name: tool, arguments: args ?? {} } } : {}) }) }))).json();
  const call = (tool: string, args?: Record<string, unknown>) => rpc("tools/call", tool, args);
  const listed = await rpc("tools/list");
  for (const name of ["list_sender_identities", "create_sender_identity", "update_sender_identity", "get_sender_preferences", "set_sender_preferences", "create_draft_message"]) {
    const tool = listed.result.tools.find((item: { name: string }) => item.name === name);
    assert.ok(tool?.inputSchema); assert.ok(tool?.outputSchema, `${name} must publish output schema`);
    assert.equal(tool.outputSchema.anyOf.length, 2, "Published schema includes success/error variants");
  }
  assert.equal((await call("list_sender_identities", { accountId: foreignId })).result.isError, true);
  const identities = (await call("list_sender_identities")).result.structuredContent;
  assert.equal(identities.ok, true); assert.ok(!identities.identities.some((item: { id: string }) => item.id === foreignIdentity.id));
  const badSignature = (await call("create_sender_identity", { email: "new@example.test", displayName: "Synthetic", signatureId: "foreign-signature" })).result;
  assert.equal(badSignature.isError, true); assert.equal(badSignature.structuredContent.code, "invalid_identity");
  const createdResult = (await call("create_sender_identity", { email: "mcp-created@example.test", displayName: "MCP Synthetic" })).result;
  assert.notEqual(createdResult.isError, true, JSON.stringify(createdResult));
  const created = createdResult.structuredContent.identity;
  assert.equal(created.accountId, accountId); assert.equal(created.createdBy, manager.user.id);
  const audit = (await api.listAdminAudit()).find(item => item.targetAccountId === accountId && item.payload?.identityId === created.id)!;
  assert.equal(audit.actorUserId, manager.user.id); assert.equal(audit.payload?.clientId, `mcp:${minted.tokenRecord.id}`);
  const disabledCreated = (await call("update_sender_identity", { identityId: created.id, patch: { enabled: false } })).result.structuredContent;
  assert.equal(disabledCreated.identity.enabled, false);
  const changed = await call("update_sender_identity", { identityId: alias.id, patch: { replyTo: alias.replyTo } });
  assert.equal(changed.result.structuredContent.identity.id, alias.id);
  const badPrefs = (await call("set_sender_preferences", { patch: { defaultIdentityId: foreignIdentity.id } })).result;
  assert.equal(badPrefs.isError, true); assert.equal(badPrefs.structuredContent.code, "invalid_preferences");
  assert.equal((await call("set_sender_preferences", { patch: { defaultSignatureId: "foreign-template" } })).result.structuredContent.code, "invalid_preferences");
  const prefs = (await call("set_sender_preferences", { patch: { defaultIdentityId: alias.id, signatureOverride: "Synthetic personal" } })).result.structuredContent;
  assert.equal(prefs.prefs.defaultIdentityId, alias.id);
  assert.equal((await api.getUserAccountPrefs(editor.user.id, accountId)).defaultIdentityId, primary.id, "MCP prefs belong only to token creator");
  assert.equal((await call("list_sender_identities")).result.structuredContent.effectiveDefaultIdentityId, alias.id);
  const mcpDraft = (await call("create_draft_message", { ...outbound })).result;
  assert.notEqual(mcpDraft.isError, true, JSON.stringify(mcpDraft)); assert.equal(mcpDraft.structuredContent.identityId, alias.id);
  const beforeMcpInvalid = counts();
  const invalidDraft = (await call("create_draft_message", { ...outbound, identityId: foreignIdentity.id })).result;
  assert.equal(invalidDraft.isError, true); assert.equal(invalidDraft.structuredContent.code, "identity_not_found"); assert.deepEqual(counts(), beforeMcpInvalid);
  const foreignRef = (await call("create_draft_message", { mode: "reply", messageId: "foreign-source" })).result;
  assert.equal(foreignRef.isError, true);
  master.prepare("UPDATE user_accounts SET role='editor' WHERE userId=? AND accountId=?").run(manager.user.id, accountId);
  assert.equal((await call("update_sender_identity", { identityId: alias.id, patch: { enabled: false } })).result.isError, true);
  master.prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(manager.user.id, accountId);
  const beforeDowngrade = counts();
  assert.equal((await call("create_draft_message", outbound)).result.isError, true); assert.deepEqual(counts(), beforeDowngrade);
  assert.equal((await call("list_sender_identities")).result.structuredContent.ok, true);
  master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(manager.user.id, accountId);
  assert.deepEqual(await call("list_sender_identities"), { ok: false, message: "Unauthorized" });
  console.log("PASS sender identity route contracts");
} finally { await sink.stop(); }
