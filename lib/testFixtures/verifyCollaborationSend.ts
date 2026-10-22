// Run in a child process: shared Bun module mocks in draft/MCP tests must not replace real network IO.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startImapServer } from "./mail/imap-server";
import { startSmtpSink } from "./mail/smtp-sink";
import { MailStore } from "./mail/store";
import { demoUser, demoPass, makeMessage } from "./mail/seed";
import { createAuthenticatedTestSession } from "../testAuthHarness";
import { createCollabFixture } from "../testThreadCollabHarness";
import { listImapFolders, syncImapMessage, drainImapConnectionPool } from "../mail/imap";
import { enrichMessagesWithThreadCollab } from "@/app/api/_helpers/enrichMessagesWithThreadCollab";
import { GET as listSent } from "@/app/api/accounts/[accountId]/threads/[threadId]/collab/route";
import { POST as directSend } from "@/app/api/accounts/[accountId]/smtp/send/route";
import { POST as saveDraft } from "@/app/api/accounts/[accountId]/drafts/save/route";
import { POST as draftSend } from "@/app/api/accounts/[accountId]/drafts/[draftId]/send/route";
import { POST as calendarRespond } from "@/app/api/accounts/[accountId]/calendar/events/[eventId]/respond/route";
import { updateThreadCollabState, getThreadCollabState } from "../threadCollab";

const directory = mkdtempSync(join(tmpdir(), "collab-send-fixture-"));
const a = await createAuthenticatedTestSession();
const b = await createAuthenticatedTestSession();
const store = new MailStore("monkeydent", new Date("2026-10-22T10:00:00Z"), join(directory, "uid.sqlite"));
let connections = 0;
const serverOptions = { port: 0, controlPort: 0, store, onConnection: () => { connections++; }, appendUid: true };
const imap = await startImapServer(serverOptions);
const smtp = await startSmtpSink({ port: 0, out: directory, deliver: source => { store.append("INBOX", source); } });
let cases = 0;
try {
  for (const entry of ["direct", "draft", "calendar"] as const) {
    for (const scenario of ["appended", "retry", "no-uid", "no-sent-folder", "failed", "smtp-failed"] as const) {
      const f = await createCollabFixture();
      f.account.email = demoUser;
      f.account.imap = { host: "127.0.0.1", port: imap.port, secure: false, user: demoUser, password: demoPass };
      f.account.smtp = { host: "127.0.0.1", port: smtp.port, secure: false, user: demoUser, password: demoPass };
      await f.api.upsertAccount(f.account);
      await a.addMembership(a.user.id, f.accountId, "editor");
      await b.addMembership(b.user.id, f.accountId, "viewer");
      // Each scenario seeds and reads an actual IMAP source message for reply flags.
      const original = store.append("INBOX", makeMessage({ id: `source-${crypto.randomUUID()}`, subject: "Synthetic team request", from: "organizer@example.test", to: demoUser }));
      const source = (await syncImapMessage(f.account, "INBOX", original.uid))!;
      assert.ok(source);
      await f.api.upsertMessages(f.accountId, null, [source], false);
      const actor = { userId: a.user.id, clientId: "web:fixtureA" };
      await updateThreadCollabState(f.accountId, source.threadId, { status: "waiting" }, actor);
      const headers = a.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json", "x-noctua-client": "fixtureA" });
      const req = (body: unknown) => new Request("http://localhost:3000/api/send", { method: "POST", headers, body: JSON.stringify(body) });
      const params = (extra = {}) => ({ params: Promise.resolve({ accountId: f.accountId, ...extra }) });
      const to = demoUser;
      const forward = entry !== "calendar" && (scenario === "retry" || scenario === "failed");
      await f.api.saveFoldersForAccount(f.accountId, await listImapFolders(f.account));
      let draftId: string | undefined;
      if (entry === "draft") {
        const saved = await saveDraft(req({ to, bcc: "blind@example.test", subject: "Synthetic draft reply", text: "Draft body", inReplyTo: source.messageId, references: [source.messageId], xForwardedMessageId: forward ? source.messageId : undefined }), params());
        assert.equal(saved.status, 200, await saved.clone().text());
        draftId = (await saved.json()).draftId;
        assert.ok(draftId);
      }
      const eventId = `event-${crypto.randomUUID()}`;
      if (entry === "calendar") {
        await f.api.upsertCalendarEvent(f.accountId, { id: eventId, accountId: f.accountId, eventUid: eventId,
          summary: "Synthetic appointment", startAtMs: Date.UTC(2026, 9, 23, 10), endAtMs: Date.UTC(2026, 9, 23, 11), allDay: false,
          sourceType: "email", messageId: source.id, myAttendeeEmail: demoUser, createdAtMs: Date.now(), updatedAtMs: Date.now(),
          rawIcs: ["BEGIN:VCALENDAR", "VERSION:2.0", "METHOD:REQUEST", "BEGIN:VEVENT", `UID:${eventId}`, "DTSTART:20261023T100000Z", "DTEND:20261023T110000Z",
            "SUMMARY:Synthetic appointment", "ORGANIZER:mailto:organizer@example.test", `ATTENDEE;PARTSTAT=NEEDS-ACTION:mailto:${demoUser}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n") });
      }
      const sentBox = store.get("Sent");
      const beforeSent = sentBox.messages.length;
      // Exercise missing cached folder: completeSend must re-LIST and prefer SPECIAL-USE.
      await f.api.saveFoldersForAccount(f.accountId, (await listImapFolders(f.account)).filter(folder => folder.specialUse !== "\\Sent"));
      if (scenario === "no-sent-folder") store.boxes.delete("Sent");
      serverOptions.appendUid = scenario !== "no-uid";
      const append = store.append.bind(store);
      let appendAttempts = 0;
      const appendConnections: number[] = [];
      store.append = (...args: Parameters<MailStore["append"]>) => {
        if (args[0] === "Sent") {
          appendAttempts++; appendConnections.push(connections);
          if (scenario === "failed" || (scenario === "retry" && appendAttempts === 1)) throw new Error("Synthetic APPEND failure");
        }
        return append(...args);
      };
      const beforeSmtp = smtp.received.length;
      if (scenario === "smtp-failed") {
        f.account.smtp.password = "synthetic-wrong-password";
        await f.api.upsertAccount(f.account);
      }
      const invoke = (request: Request) => entry === "direct" ? directSend(request, params())
        : entry === "draft" ? draftSend(request, params({ draftId })) : calendarRespond(request, params({ eventId }));
      if (scenario === "appended") {
        const viewerRequest = new Request("http://localhost:3000/api/send", { method: "POST", headers: b.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }), body: "{}" });
        assert.equal((await invoke(viewerRequest)).status, 403);
        const foreignRequest = new Request("http://localhost:3000/api/send", { method: "POST", headers: a.jar.headers({ origin: "https://evil.example.test", "content-type": "application/json" }), body: "{}" });
        assert.equal((await invoke(foreignRequest)).status, 403);
      }
      let response: Response | undefined;
      let sendError: unknown;
      try {
        response = entry === "direct"
          ? await directSend(req({ to, bcc: "blind@example.test", subject: "Synthetic direct reply", text: "Team reply", inReplyTo: source.messageId, references: [source.messageId], xForwardedMessageId: forward ? source.messageId : undefined }), params())
          : entry === "draft" ? await draftSend(req({}), params({ draftId }))
          : await calendarRespond(req({ partstat: "ACCEPTED" }), params({ eventId }));
      } catch (error) {
        if (scenario !== "smtp-failed") throw error;
        sendError = error;
      } finally { store.append = append; store.boxes.set("Sent", sentBox); serverOptions.appendUid = true; }
      if (scenario === "smtp-failed") {
        // Preserve the existing SMTP rejection contract: direct/draft rethrow EAUTH;
        // calendar wraps it in its existing 400 response. Neither is a delivered send.
        if (sendError) assert.equal((sendError as { code: string }).code, "EAUTH");
        else { assert.ok(response); assert.equal(response.status, 400); assert.equal((await response.json()).ok, false); }
        assert.equal(smtp.received.length, beforeSmtp);
        assert.equal(appendAttempts, 0);
        if (draftId) assert.ok(await f.api.getMessageById(f.accountId, draftId));
        console.log(`PASS fixture ${entry} SMTP rejected: no delivery, no Sent APPEND`);
        cases++; continue;
      }
      assert.ok(response);
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      assert.equal(result.ok, true);
      assert.equal(result.sentCopy, scenario === "failed" || scenario === "no-sent-folder" ? scenario : "appended", JSON.stringify(result));
      assert.equal(smtp.received.length - beforeSmtp, 1, "Exactly one SMTP delivery regardless of APPEND failure");
      assert.equal((await getThreadCollabState(f.accountId, source.threadId)).status, "waiting");
      assert.equal(original.flags.has("\\Answered"), !forward, "Only replies set server Answered flag");
      assert.equal(original.flags.has("$Forwarded"), forward, "Only forwards set server keyword");
      if (entry === "draft") {
        assert.equal(await f.api.getMessageById(f.accountId, draftId!), null);
        assert.ok(!smtp.received.at(-1)!.source.toString().match(/^Bcc:/im), "Wire copy must strip BCC");
      }
      const attribution = f.db.prepare("SELECT userId FROM sent_by WHERE accountId=? AND messageId=?").get(f.accountId, result.messageId) as { userId: string };
      assert.equal(attribution.userId, a.user.id);
      if (scenario === "retry") { assert.equal(appendAttempts, 2); assert.ok(appendConnections[1] > appendConnections[0], "Retry uses a new connection"); }
      else if (scenario === "failed") { assert.equal(appendAttempts, 2); assert.ok(result.sentCopyWarning.includes("Do not send it again")); }
      else if (scenario === "no-sent-folder") { assert.equal(appendAttempts, 0); assert.ok(result.sentCopyWarning); }
      else assert.equal(appendAttempts, 1, "Missing APPENDUID must search, never append twice");
      if (result.sentCopy === "appended") {
        assert.equal(sentBox.messages.length, beforeSent + 1);
        const sent = await f.api.getMessageById(f.accountId, result.messageId);
        assert.ok(sent, "Sent copy is ingested before responding");
        assert.equal(sent.folderId, `${f.accountId}:Sent`);
        await enrichMessagesWithThreadCollab([sent], { accountId: f.accountId });
        assert.equal(sent.collab?.status, "waiting");
        const shared = await listSent(new Request("http://localhost:3000/api/collab", { headers: b.jar.headers() }),
          { params: Promise.resolve({ accountId: f.accountId, threadId: encodeURIComponent(sent.threadId) }) });
        assert.equal(shared.status, 200);
        const sharedData = await shared.json();
        assert.equal(sharedData.activity.filter((item: { type: string; actorUserId: string }) => item.type === "reply_sent" && item.actorUserId === a.user.id).length, 1);
        const sentForB = await f.api.listMessages({ accountId: f.accountId, folderId: `${f.accountId}:Sent`, page: 1, pageSize: 10, viewerUserId: b.user.id });
        await enrichMessagesWithThreadCollab(sentForB.items, { accountId: f.accountId });
        assert.equal(sentForB.items[0].messageId, result.messageId);
        assert.equal(sentForB.items[0].collab?.status, "waiting");
      }
      console.log(`PASS fixture ${entry} ${scenario}: SMTP=1 APPEND=${appendAttempts} sentCopy=${result.sentCopy}; A attribution${result.sentCopy === "appended" ? " and B shared view" : ""} verified`);
      cases++;
    }
  }
  const fresh = await createCollabFixture();
  fresh.account.email = demoUser;
  fresh.account.imap = { host: "127.0.0.1", port: imap.port, secure: false, user: demoUser, password: demoPass };
  fresh.account.smtp = { host: "127.0.0.1", port: smtp.port, secure: false, user: demoUser, password: demoPass };
  await fresh.api.upsertAccount(fresh.account); await a.addMembership(a.user.id, fresh.accountId, "editor");
  const response = await directSend(new Request("http://localhost:3000/api/send", { method: "POST",
    headers: a.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }),
    body: JSON.stringify({ to: "recipient@example.test", subject: "Synthetic new outbound", text: "New thread" }) }), { params: Promise.resolve({ accountId: fresh.accountId }) });
  const result = await response.json(); assert.equal(result.sentCopy, "appended");
  assert.equal((fresh.db.prepare("SELECT userId FROM sent_by WHERE accountId=? AND messageId=?").get(fresh.accountId, result.messageId) as { userId: string }).userId, a.user.id);
  assert.equal((fresh.db.prepare("SELECT COUNT(*) AS n FROM thread_activity WHERE accountId=? AND type='reply_sent'").get(fresh.accountId) as { n: number }).n, 0);
  console.log("PASS fixture new outbound: Sent ingested and attributed without reply activity"); cases++;
  console.log(`PASS ${cases} fixture send scenarios`);
} finally {
  await drainImapConnectionPool(); await smtp.stop(); await imap.stop(); rmSync(directory, { recursive: true, force: true });
}
