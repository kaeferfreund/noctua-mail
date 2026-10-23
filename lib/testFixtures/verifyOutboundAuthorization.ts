// Narrow wrapper seams in a child process keep randomized Bun mocks isolated.
import assert from "node:assert/strict";
import type { OutboundWriteAuthorization } from "../outboundAuthorization";
import { mock, spyOn } from "bun:test";
import nodemailer from "nodemailer";
import { dbModulePromise } from "../testDbHarness";
import { createAuthenticatedTestSession } from "../testAuthHarness";
import { getAccountDb, getDb } from "../db/connection";
import { identityTestAccount } from "./senderIdentities";
import { requireActiveUserSession } from "../auth";
import { mintMcpToken } from "../mcpAuth";
import { startSmtpSink } from "./mail/smtp-sink";
import { demoPass, demoUser } from "./mail/seed";
import { saveMessageSource } from "../storage";
import { SHARD_FTS_TABLE } from "../db/shardFormat";

const path = process.argv[2];
const api = await dbModulePromise;
const accountId = `boundary-${crypto.randomUUID()}`;
const account = identityTestAccount(accountId);
await api.upsertAccount(account);
const user = await createAuthenticatedTestSession(accountId);
const master = await getDb(), shard = await getAccountDb(accountId);
const identityActual = { ...await import("../senderIdentities") };
const alias = await identityActual.createSenderIdentity(accountId, { email: "boundary-alias@example.test", displayName: "Synthetic Boundary" }, { userId: user.user.id }, master);
await api.saveFoldersForAccount(accountId, ["Drafts", "Sent"].map(name => ({ id: `${accountId}:${name}`, accountId, name, count: 0, specialUse: `\\${name}` })));
let smtpConnections = 0;
const smtp = await startSmtpSink({ onConnection: () => { smtpConnections++; }, port: 0, out: `${process.env.TMPDIR}/boundary-smtp-${crypto.randomUUID()}` });
account.smtp = { host: "127.0.0.1", port: smtp.port, secure: false, user: demoUser, password: demoPass };
await api.upsertAccount(account);
const smtpActual = { ...await import("../serverSmtp") };
const dbActual = { ...await import("../serverDb") };
const imapActual = { ...await import("../serverImap") };
let smtpCalls = 0, appendCalls = 0, deleteCalls = 0;
let hook: (() => void) | undefined;
let accountReadHook: (() => void) | undefined;
let afterAcceptance: (() => void) | undefined;
let insideTransport: (() => void) | undefined;
let retryRevoke: (() => void) | undefined;
let retryChecks = 0;
let guardRevoke: (() => void) | undefined;
// Reproduce the review's queueMicrotask gap both as an already queued revocation
// after the async guard and after the actual synchronous effect-boundary assertion.
const authorizationActual = { ...await import("../outboundAuthorization") };
let queuedGuardRevoke: (() => void) | undefined;
let skipGuards = 0;
let probeWrite = false;
let insideWrite = false;
let finalAssertHook: (() => void) | undefined;
let sameContinuation = false;
let effectInitiated = false;
mock.module("@/lib/outboundAuthorization", () => ({ ...authorizationActual,
  authorizeOutbound: async (...args: Parameters<typeof authorizationActual.authorizeOutbound>) => {
    const actor = await authorizationActual.authorizeOutbound(...args);
    const revoke = skipGuards-- > 0 ? undefined : queuedGuardRevoke;
    if (revoke) queuedGuardRevoke = undefined;
    if (revoke) {
      actor.assertCurrent(master);
      queueMicrotask(revoke);
    }
    return { ...actor, assertCurrent: (db: Parameters<typeof actor.assertCurrent>[0]) => {
      actor.assertCurrent(db);
      finalAssertHook?.();
    } };
  }
}));
const writeActual = { ...await import("../outboundWrite") };
mock.module("@/lib/outboundWrite", () => ({
  prepareOutboundWrite: async (...args: Parameters<typeof writeActual.prepareOutboundWrite>) => {
    const guardedWrite = await writeActual.prepareOutboundWrite(...args);
    return <T>(write: (assertCurrent: () => void) => T): T => {
      insideWrite = true;
      try {
        return guardedWrite(assertCurrent => {
          const result = write(() => {
            assertCurrent();
            if (probeWrite) {
              assert.ok(master.inTransaction, "master BEGIN IMMEDIATE must hold authorization through the shard write");
              assert.ok(shard.inTransaction, "local write must consume the assertion inside its shard transaction");
              assert.ok(sameContinuation, "transaction writes must follow the assertion without an await");
            }
          });
          if (probeWrite) {
            assert.ok(master.inTransaction, "master writer must remain held through shard commit");
            assert.ok(sameContinuation, "shard transaction must commit before the queued microtask");
            effectInitiated = true;
          }
          if (probeWrite && path === "draft-save") {
            assert.equal(shard.prepare("SELECT 1 FROM messages WHERE accountId=? AND id=?").get(accountId, draftId), null, "replacement removes the old row inside the guarded transaction");
            assert.equal(shard.prepare("SELECT 1 FROM attachments WHERE accountId=? AND messageId=?").get(accountId, draftId), null, "replacement removes old attachments atomically");
            assert.equal(shard.prepare(`SELECT 1 FROM ${SHARD_FTS_TABLE} WHERE accountId=? AND messageId=?`).get(accountId, draftId), null, "replacement removes the old FTS row atomically");
          }
          return result;
        });
      } finally { insideWrite = false; }
    };
  }
}));
const createTransport = nodemailer.createTransport.bind(nodemailer);
spyOn(nodemailer, "createTransport").mockImplementation(((...args: Parameters<typeof nodemailer.createTransport>) => {
  const transport = createTransport(...args);
  const sendMail = transport.sendMail.bind(transport);
  transport.sendMail = ((...mailArgs: Parameters<typeof sendMail>) => {
    if (finalAssertHook) {
      assert.ok(sameContinuation, "sendMail must start in the assertion's synchronous continuation");
      effectInitiated = true;
    }
    return sendMail(...mailArgs);
  }) as typeof transport.sendMail;
  return transport;
}) as typeof nodemailer.createTransport);
// Exercise the real APPEND implementation after an asynchronous pool acquisition.
let probeAppend = false;
let transportPhase = false;
const poolActual = { ...await import("../mail/imap/connectionPool") };
mock.module("@/lib/mail/imap/connectionPool", () => ({ ...poolActual,
  withPooledImapClient: async (_account: unknown, _context: unknown, action: (client: unknown) => Promise<unknown>) => {
    await Promise.resolve();
    return action({ append: () => {
      assert.ok(sameContinuation, "client.append must start in the assertion's synchronous continuation");
      effectInitiated = true;
      appendCalls++;
      return Promise.resolve({ uid: 1 });
    } });
  }
}));
const imapMutations = await import("../mail/imap/mutations");

const beforeRetry = (authorize: OutboundWriteAuthorization) => async () => {
  retryChecks++;
  const actor = await authorize();
  const revokeAtWrite = guardRevoke; guardRevoke = undefined; revokeAtWrite?.();
  if (retryRevoke) {
    const revoke = retryRevoke; retryRevoke = undefined; revoke();
    throw Object.assign(new Error("Synthetic database is locked"), { code: "SQLITE_BUSY" });
  }
  return actor;
};
const mutate = () => { const current = hook; hook = undefined; current?.(); };
mock.module("@/lib/serverDb", () => ({ ...dbActual,
  getAccountById: async (...args: Parameters<typeof dbActual.getAccountById>) => {
    const account = await dbActual.getAccountById(...args);
    const current = accountReadHook; accountReadHook = undefined; current?.();
    return account;
  },
  upsertMessages: async (...args: Parameters<typeof dbActual.upsertMessages>) => dbActual.upsertMessages(args[0], args[1], args[2], args[3], { ...args[4], beforeWrite: args[4]?.beforeWrite ? beforeRetry(args[4].beforeWrite) : undefined }),
  mergeUserAccountPrefs: async (...args: Parameters<typeof dbActual.mergeUserAccountPrefs>) => dbActual.mergeUserAccountPrefs(args[0], args[1], args[2], args[3] ? beforeRetry(args[3]) : undefined),
  listSenderIdentities: async (...args: Parameters<typeof dbActual.listSenderIdentities>) => {
    const rows = await dbActual.listSenderIdentities(...args);
    mutate(); // Exact review seam: rows already read, authorization snapshot stale.
    return rows;
  }
}));
mock.module("@/lib/senderIdentities", () => ({ ...identityActual,
  createSenderIdentityWithRecompute: async (...args: Parameters<typeof identityActual.createSenderIdentityWithRecompute>) => {
    mutate(); // After MCP entry guard, before the service's awaited write boundary.
    return identityActual.createSenderIdentityWithRecompute(args[0], args[1], { ...args[2], beforeWrite: args[2].beforeWrite ? beforeRetry(args[2].beforeWrite) : undefined });
  },
  updateSenderIdentity: async (...args: Parameters<typeof identityActual.updateSenderIdentity>) => {
    mutate();
    return identityActual.updateSenderIdentity(args[0], args[1], args[2], { ...args[3], beforeWrite: args[3].beforeWrite ? beforeRetry(args[3].beforeWrite) : undefined }, args[4]);
  }
}));
mock.module("@/lib/serverSmtp", () => ({ ...smtpActual,
  sendSmtpMessage: async (...args: Parameters<typeof smtpActual.sendSmtpMessage>) => {
    smtpCalls++;
    transportPhase = true;
    insideTransport?.(); insideTransport = undefined;
    const result = await smtpActual.sendSmtpMessage(...args);
    afterAcceptance?.(); afterAcceptance = undefined;
    return result;
  },
  sendRawSmtpMessage: async (...args: Parameters<typeof smtpActual.sendRawSmtpMessage>) => {
    smtpCalls++;
    transportPhase = true;
    insideTransport?.(); insideTransport = undefined;
    const result = await smtpActual.sendRawSmtpMessage(...args);
    afterAcceptance?.(); afterAcceptance = undefined;
    return result;
  }
}));
mock.module("@/lib/serverImap", () => ({ ...imapActual,
  appendImapMessage: async (...args: Parameters<typeof imapActual.appendImapMessage>) => {
    if (probeAppend) { transportPhase = true; return imapMutations.appendImapMessage(...args); }
    // Match the real pool's asynchronous preparation before consuming the guard.
    await Promise.resolve();
    args[6]?.beforeAppend?.();
    appendCalls++; return 1;
  },
  deleteImapMessage: async () => { deleteCalls++; },
  listImapFolders: async () => [],
  // No Sent folder persistence is needed to prove accepted delivery survives revocation.
  syncImapMessage: async () => null
}));
const { POST: direct } = await import("../../app/api/accounts/[accountId]/smtp/send/route");
const { POST: save } = await import("../../app/api/accounts/[accountId]/drafts/save/route");
const { POST: sendDraft } = await import("../../app/api/accounts/[accountId]/drafts/[draftId]/send/route");
const { POST: respond } = await import("../../app/api/accounts/[accountId]/calendar/events/[eventId]/respond/route");
const { POST: mcp } = await import("../../app/api/mcp/route");
const outbound = { identityId: alias.id, to: "recipient@example.test", subject: "Synthetic boundary", text: "Synthetic body" };
const request = (body: unknown) => new Request("http://localhost:3000/api/send", { method: "POST", headers: user.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }), body: JSON.stringify(body) });
const params = (extra = {}) => ({ params: Promise.resolve({ accountId, ...extra }) });
const draftId = "synthetic-boundary-draft";
const messageId = "<synthetic-boundary-draft@example.test>";
const raw = [`From: ${alias.displayName} <${alias.email}>`, "To: recipient@example.test", `Message-ID: ${messageId}`, `X-Noctua-Identity-Id: ${alias.id}`, "Subject: Synthetic boundary", "", "Synthetic body"].join("\r\n");
await api.upsertMessages(accountId, null, [{ id: draftId, messageId, threadId: messageId, accountId, folderId: `${accountId}:Drafts`, from: `${alias.displayName} <${alias.email}>`, to: outbound.to, subject: outbound.subject, body: outbound.text, preview: "", date: new Date().toISOString(), dateValue: Date.now(), flags: ["\\Draft"], senderIdentityId: alias.id, source: raw, attachments: [{ id: "synthetic-boundary-attachment", filename: "synthetic.txt", contentType: "text/plain", size: 4, inline: false }], mailboxPath: "Drafts", imapUid: 22 }]);
await saveMessageSource(accountId, draftId, raw);
const eventId = "synthetic-boundary-event";
await api.upsertCalendarEvent(accountId, { id: eventId, accountId, eventUid: eventId, summary: "Synthetic RSVP", startAtMs: Date.UTC(2026, 9, 23, 10), allDay: false, sourceType: "email", myAttendeeEmail: alias.email, createdAtMs: Date.now(), updatedAtMs: Date.now(), organizer: "organizer@example.test", rawIcs: ["BEGIN:VCALENDAR", "VERSION:2.0", "METHOD:REQUEST", "BEGIN:VEVENT", `UID:${eventId}`, "DTSTART:20261023T100000Z", "ORGANIZER:mailto:organizer@example.test", `ATTENDEE;PARTSTAT=NEEDS-ACTION:mailto:${alias.email}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n") });
const session = await requireActiveUserSession(request({}));
if (session instanceof Response) throw new Error("Missing synthetic session");
const minted = await mintMcpToken(session, accountId, "Synthetic boundary", 3600);
const isMcp = path.startsWith("mcp-");
const management = path === "mcp-create-identity" || path === "mcp-update-identity";
const ensureDraft = async () => {
  if (["draft-save", "draft-send"].includes(path) && !await api.getMessageById(accountId, draftId)) {
    await api.upsertMessages(accountId, null, [{ id: draftId, messageId, threadId: messageId, accountId, folderId: `${accountId}:Drafts`, from: `${alias.displayName} <${alias.email}>`, to: outbound.to, subject: outbound.subject, body: outbound.text, preview: "", date: new Date().toISOString(), dateValue: Date.now(), flags: ["\\Draft"], senderIdentityId: alias.id, source: raw, attachments: [{ id: "synthetic-boundary-attachment", filename: "synthetic.txt", contentType: "text/plain", size: 4, inline: false }], mailboxPath: "Drafts", imapUid: 22 }]);
    await saveMessageSource(accountId, draftId, raw);
  }
};
const run = async (sendReply = true, scope = "series") => {
  await ensureDraft();
  if (isMcp) {
    const [name, args] = path === "mcp-create-draft" ? ["create_draft_message", outbound] : path === "mcp-set-preferences" ? ["set_sender_preferences", { patch: { defaultIdentityId: alias.id, signatureOverride: "Synthetic" } }] : path === "mcp-create-identity" ? ["create_sender_identity", { email: `created-${crypto.randomUUID()}@example.test`, displayName: "Synthetic created" }] : ["update_sender_identity", { identityId: alias.id, patch: { displayName: "Synthetic updated" } }];
    return mcp(new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${minted.token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/call", params: { name, arguments: args } }) }));
  }
  if (path === "direct") return direct(request(outbound), params());
  if (path === "draft-save") return save(request({ ...outbound, draftId }), params());
  if (path === "draft-send") return sendDraft(request({}), params({ draftId }));
  return respond(request({ partstat: "ACCEPTED", identityId: alias.id, sendReply, scope, occurrenceStartAtMs: scope === "occurrence" ? Date.UTC(2026, 9, 23, 10) : undefined }), params({ eventId }));
};
const snapshot = () => JSON.stringify({
  counters: [smtpCalls, smtpConnections, appendCalls, deleteCalls, smtp.received.length],
  identities: master.prepare("SELECT * FROM sender_identities WHERE accountId=? ORDER BY id").all(accountId),
  preferences: master.prepare("SELECT * FROM user_account_prefs WHERE accountId=?").all(accountId),
  audit: master.prepare("SELECT * FROM admin_audit WHERE targetAccountId=?").all(accountId),
  messages: shard.prepare("SELECT * FROM messages WHERE accountId=?").all(accountId),
  sentBy: shard.prepare("SELECT * FROM sent_by WHERE accountId=?").all(accountId),
  calendar: shard.prepare("SELECT * FROM calendar_events WHERE accountId=?").all(accountId),
  overrides: shard.prepare("SELECT * FROM calendar_participation_overrides WHERE accountId=?").all(accountId),
  attachments: shard.prepare("SELECT * FROM attachments WHERE accountId=?").all(accountId),
  fts: shard.prepare(`SELECT * FROM ${SHARD_FTS_TABLE} WHERE accountId=?`).all(accountId),
  tombstones: shard.prepare("SELECT * FROM draft_tombstones WHERE accountId=?").all(accountId)
});
const restore = () => {
  master.prepare("INSERT INTO user_accounts(userId,accountId,role) VALUES (?,?,'manager') ON CONFLICT(userId,accountId) DO UPDATE SET role='manager'").run(user.user.id, accountId);
  master.prepare("UPDATE auth_user SET banned=0 WHERE id=?").run(user.user.id);
  master.prepare("UPDATE sender_identities SET enabled=1 WHERE id=?").run(alias.id);
  master.prepare("UPDATE auth_security_state SET generation=? WHERE userId=?").run(session.generation, user.user.id);
};
try {
  for (const variant of ["membership", "user-disabled", "role", "identity-disabled", "generation", "credential-revoked"]) {
    if (variant === "identity-disabled" && management) continue; // Managers must be able to edit/re-enable disabled identities.
    if (variant === "role" && path === "mcp-set-preferences") continue; // Viewer is the documented minimum.
    const credentialTable = isMcp ? "mcp_tokens" : "auth_session";
    const credentialId = isMcp ? minted.tokenRecord.id : session.sessionId;
    const credential = master.prepare(`SELECT * FROM ${credentialTable} WHERE id=?`).get(credentialId) as Record<string, unknown>;
    const sidecar = !isMcp ? master.prepare("SELECT * FROM auth_session_security WHERE sessionId=?").get(session.sessionId) as Record<string, unknown> : undefined;
    let fired = false;
    let expected = "";
    hook = () => {
      fired = true;
      if (variant === "membership") master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(user.user.id, accountId);
      if (variant === "user-disabled") master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(user.user.id);
      if (variant === "role") master.prepare("UPDATE user_accounts SET role=? WHERE userId=? AND accountId=?").run(management ? "editor" : "viewer", user.user.id, accountId);
      if (variant === "identity-disabled") master.prepare("UPDATE sender_identities SET enabled=0 WHERE id=?").run(alias.id);
      if (variant === "generation") master.prepare("UPDATE auth_security_state SET generation=generation+1 WHERE userId=?").run(user.user.id);
      if (variant === "credential-revoked") master.prepare(`DELETE FROM ${credentialTable} WHERE id=?`).run(credentialId);
      expected = snapshot(); // Excludes only the deliberately revoked auth/config state.
    };
    const response = await run();
    const body = await response.json();
    assert.ok(fired, `mid-request hook must execute: ${path}/${variant}`);
    if (isMcp) assert.equal(body.result?.isError, true, JSON.stringify(body));
    else assert.equal(response.status, variant === "identity-disabled" ? 409 : ["user-disabled", "generation", "credential-revoked"].includes(variant) ? 401 : 403, JSON.stringify(body));
    assert.equal(snapshot(), expected, `zero SMTP/APPEND/cleanup/DB mutations: ${path}/${variant}`);
    restore();
    if (variant === "credential-revoked") {
      const keys = Object.keys(credential);
      master.prepare(`INSERT INTO ${credentialTable} (${keys.map(key => `"${key}"`).join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...Object.values(credential) as never[]);
      if (sidecar) {
        const keys = Object.keys(sidecar);
        master.prepare(`INSERT INTO auth_session_security (${keys.map(key => `"${key}"`).join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...Object.values(sidecar) as never[]);
      }
    }
    console.log(`PASS ${path}/${variant}`);
  }
  if (["direct", "draft-save", "draft-send", "calendar-respond", "mcp-create-draft"].includes(path)) {
    for (const variant of ["membership", "user-disabled", "role", "identity-disabled"]) {
      const revoke = () => {
        if (variant === "membership") master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(user.user.id, accountId);
        if (variant === "user-disabled") master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(user.user.id);
        if (variant === "role") master.prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(user.user.id, accountId);
        if (variant === "identity-disabled") master.prepare("UPDATE sender_identities SET enabled=0 WHERE id=?").run(alias.id);
      };
      // An assertion inside the async helper cannot authorize a later continuation.
      const before = snapshot();
      queuedGuardRevoke = revoke;
      const response = await run();
      const body = await response.json();
      if (isMcp) assert.equal(body.result?.isError, true, JSON.stringify(body));
      else assert.equal(response.status, variant === "user-disabled" ? 401 : variant === "identity-disabled" ? 409 : 403, JSON.stringify(body));
      restore();
      assert.equal(snapshot(), before, `queued revocation denies all effects: ${path}/${variant}`);
      restore();
      if (path === "calendar-respond") {
        queuedGuardRevoke = revoke;
        assert.equal((await run(false)).status, variant === "user-disabled" ? 401 : variant === "identity-disabled" ? 200 : 403);
        // Local-only RSVP has no selected identity to disable.
        if (variant !== "identity-disabled") assert.equal(snapshot(), before, "local-only RSVP must write nothing on denial");
        restore();
      }
      console.log(`PASS ${path}/queued-microtask-denied/${variant}`);
    }
    for (const variant of ["membership", "user-disabled", "role", "identity-disabled"]) {
      let fired = false;
      finalAssertHook = () => {
        if (fired || !transportPhase) return;
        // Ignore the draft preflight, consume only the real APPEND assertion.
        if (["draft-save", "mcp-create-draft"].includes(path) && !probeAppend) return;
        fired = true;
        sameContinuation = true;
        queueMicrotask(() => {
          assert.ok(effectInitiated, "effect must be initiated before revocation's microtask");
          sameContinuation = false;
          if (variant === "membership") master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(user.user.id, accountId);
          if (variant === "user-disabled") master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(user.user.id);
          if (variant === "role") master.prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(user.user.id, accountId);
          if (variant === "identity-disabled") master.prepare("UPDATE sender_identities SET enabled=0 WHERE id=?").run(alias.id);
        });
      };
      effectInitiated = false;
      transportPhase = false;
      probeAppend = ["draft-save", "mcp-create-draft"].includes(path);
      const beforeMessages = JSON.stringify(shard.prepare("SELECT * FROM messages WHERE accountId=?").all(accountId));
      const response = await run();
      const body = await response.json();
      assert.ok(fired && effectInitiated, `same-continuation assertion/transport exercised: ${path}/${variant}`);
      if (["draft-save", "mcp-create-draft"].includes(path)) {
        if (isMcp) assert.equal(body.result?.isError, true, JSON.stringify(body));
        else assert.equal(response.status, variant === "user-disabled" ? 401 : variant === "identity-disabled" ? 409 : 403, JSON.stringify(body));
        assert.equal(JSON.stringify(shard.prepare("SELECT * FROM messages WHERE accountId=?").all(accountId)), beforeMessages, "revocation after APPEND must still deny local replacement/creation");
      } else {
        assert.equal(response.status, 200, JSON.stringify(body));
        assert.equal(body.ok, true, "SMTP initiated before revocation retains acceptance processing");
      }
      finalAssertHook = undefined; probeAppend = false; restore();
      await ensureDraft();
      console.log(`PASS ${path}/same-continuation/${variant}`);
    }
  }
  if (["draft-save", "mcp-create-draft", "calendar-respond"].includes(path)) {
    const scopes = path === "calendar-respond" ? ["series", "occurrence"] : ["series"];
    if (path === "calendar-respond") shard.prepare("UPDATE calendar_events SET recurrenceRule='FREQ=WEEKLY' WHERE id=?").run(eventId);
    for (const scope of scopes) {
      for (const variant of ["membership", "user-disabled", "role"]) {
        await ensureDraft();
        const revoke = () => {
          if (variant === "membership") master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(user.user.id, accountId);
          if (variant === "user-disabled") master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(user.user.id);
          if (variant === "role") master.prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(user.user.id, accountId);
        };
        const before = JSON.parse(snapshot());
        // Skip the pre-APPEND guard: revoke after the guard preparing the DB write.
        skipGuards = path === "calendar-respond" ? 0 : 1;
        queuedGuardRevoke = revoke;
        const response = await run(false, scope);
        const body = await response.json();
        if (isMcp) assert.equal(body.result?.isError, true, JSON.stringify(body));
        else assert.equal(response.status, variant === "user-disabled" ? 401 : 403, JSON.stringify(body));
        const after = JSON.parse(snapshot());
        for (const key of ["messages", "attachments", "fts", "tombstones", "calendar", "overrides", "sentBy"]) {
          assert.deepEqual(after[key], before[key], `revoked before transaction: ${path}/${scope}/${variant}/${key}`);
        }
        restore();
        let fired = false;
        probeWrite = true; effectInitiated = false;
        finalAssertHook = () => {
          if (!insideWrite || fired) return;
          fired = true; sameContinuation = true;
          queueMicrotask(() => {
            assert.ok(effectInitiated, "transaction must initiate its writes before the revocation microtask");
            sameContinuation = false;
            revoke();
          });
        };
        const written = await run(false, scope);
        const writtenBody = await written.json();
        assert.ok(fired && effectInitiated, `transaction probe executed: ${path}/${scope}/${variant}`);
        // A later cleanup guard may deny, but the authorized transaction itself
        // must already have committed in the assertion's synchronous continuation.
        if (path === "calendar-respond" || isMcp) assert.equal(written.status, 200, JSON.stringify(writtenBody));
        if (path === "calendar-respond") {
          if (scope === "series") assert.equal((shard.prepare("SELECT myPartstat FROM calendar_events WHERE id=?").get(eventId) as { myPartstat: string }).myPartstat, "ACCEPTED");
          else assert.equal((shard.prepare("SELECT partstat FROM calendar_participation_overrides WHERE accountId=?").get(accountId) as { partstat: string }).partstat, "ACCEPTED");
        } else {
          const rows = shard.prepare("SELECT id,flags FROM messages WHERE accountId=? AND id<>?").all(accountId, draftId) as { id: string; flags: string }[];
          assert.ok(rows.length > 0, "draft write committed");
          if (isMcp) assert.ok(rows.some(row => JSON.parse(row.flags).includes("$NoctuaAI")), "MCP AI flag shares the guarded creation transaction");
        }
        finalAssertHook = undefined; probeWrite = false; restore();
        if (path !== "calendar-respond") {
          const rows = shard.prepare("SELECT id FROM messages WHERE accountId=? AND id<>?").all(accountId, draftId) as { id: string }[];
          for (const row of rows) await api.deleteMessageById(accountId, row.id);
          await ensureDraft();
        }
        console.log(`PASS ${path}/transaction/${scope}/${variant}`);
      }
    }
  }
  if (path === "calendar-respond") {
    hook = undefined;
    // Local-only RSVP has no identity read; revoke just after the entry guard's account read.
    accountReadHook = () => { master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(user.user.id, accountId); };
    const before = snapshot();
    assert.equal((await run(false)).status, 403);
    assert.equal(snapshot(), before);
    restore();
  }
  if (["direct", "draft-send", "calendar-respond"].includes(path)) {
    insideTransport = () => master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(user.user.id, accountId);
    const before = [smtpConnections, appendCalls, deleteCalls, smtp.received.length];
    assert.equal((await run()).status, 403, "Transport rechecks after asynchronous loading/composition");
    assert.deepEqual([smtpConnections, appendCalls, deleteCalls, smtp.received.length], before);
    restore();
    afterAcceptance = () => master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(user.user.id, accountId);
  }
  if (["draft-save", "mcp-create-draft"].includes(path)) {
    let expected = "";
    retryChecks = 0;
    retryRevoke = () => {
      master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(user.user.id, accountId);
      expected = snapshot();
    };
    const response = await run();
    const body = await response.json();
    if (isMcp) assert.equal(body.result?.isError, true, JSON.stringify(body));
    else assert.equal(response.status, 403, JSON.stringify(body));
    assert.equal(retryChecks, 2, "Draft DB retries must prepare fresh authorization");
    assert.equal(snapshot(), expected, "Revoked draft DB retries must persist no replacement/creation/cleanup");
    restore();
    console.log(`PASS ${path}/revoked-during-db-retry`);
  }
  if (management || path === "mcp-set-preferences") {
    let expected = "";
    guardRevoke = () => {
      master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(user.user.id, accountId);
      expected = snapshot();
    };
    assert.equal((await (await run()).json()).result?.isError, true);
    assert.equal(snapshot(), expected, "The transaction must recheck after the asynchronous guard resolves");
    restore();
    console.log(`PASS ${path}/revoked-before-transaction`);
    retryChecks = 0;
    retryRevoke = () => {
      master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(user.user.id, accountId);
      expected = snapshot();
    };
    const body = await (await run()).json();
    assert.equal(body.result?.isError, true, JSON.stringify(body));
    assert.equal(retryChecks, 2, "DB retry must reauthorize instead of reusing a successful check");
    assert.equal(snapshot(), expected, "Revoked DB retries must persist nothing");
    restore();
    console.log(`PASS ${path}/revoked-during-db-retry`);
  }
  if (management) master.prepare("UPDATE sender_identities SET enabled=0 WHERE id=?").run(alias.id);
  if (path === "mcp-set-preferences") master.prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(user.user.id, accountId);
  const positive = await run();
  const positiveBody = await positive.json();
  assert.equal(positive.status, 200, JSON.stringify(positiveBody));
  if (isMcp) assert.notEqual(positiveBody.result?.isError, true, JSON.stringify(positiveBody));
  else assert.equal(positiveBody.ok, true, JSON.stringify(positiveBody));
  console.log(`PASS final boundary ${path}`);
} finally { await smtp.stop(); }
