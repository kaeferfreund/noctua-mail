import { handleMailboxCredentialMutation } from "@/app/api/_helpers/mailboxPatch";
import { setTimeout as sleep } from "node:timers/promises";
import { describe, test, expect } from "bun:test";
import { CookieJar, totpFromUri, createAuthenticatedTestSession } from "./testAuthHarness";
import { dbModulePromise } from "./testDbHarness";
import {reauthenticate,mutateSecurity} from "./authSecurity";
import {readSessionSecurity} from "./db/authPolicy";
import {createRateLimiter} from "./rateLimit";
import { requireActiveUserSession } from "./auth";
import { resolveAccountRole, listAccessibleAccountsForUser, listAccountMembers } from "./accountAccess";
import { sanitizeAccountForClient } from "./accountPresentation";
import { updateMailboxCredentials, type MailboxPatch } from "./mailboxCredentials";
import { mintMcpToken, validateMcpToken, resolveMcpToolContext } from "./mcpAuth";
import { assertStreamAuthorized, registerAuthStream, revokeAuthStreams } from "./authStreams";
import { cleanupUserAccountAccess, retryMembershipCleanup } from "./membershipCleanup";
import { changeAccountMember } from "./accountMembers";
import { createAdminMailbox } from "./adminMailbox";
import { mailboxFailure, mailboxErrorResponse } from "./mailboxFailure";
import { stripPersonalSettings } from "./accountPrefs";
import { Database } from "bun:sqlite";
import { getDefaultAccountDbPath } from "./runtimePaths";
import { mkdirSync } from "fs";
import path from "path";
import type { Account } from "./data";
import { GET as getPrefs, PUT as putPrefs } from "@/app/api/accounts/[accountId]/prefs/route";
import { GET as getMembers } from "@/app/api/accounts/[accountId]/members/route";

async function fixture() {
  const id = `s3-${crypto.randomUUID()}`;
  const db = await dbModulePromise;
  const account: Account = { id, name: "Synthetic Mailbox", email: "mailbox@example.test", avatar: "",
    imap: { host: "imap.example.test", user: "mailbox@example.test", password: "old-imap", port: 993, secure: true },
    smtp: { host: "smtp.example.test", user: "MAILBOX@example.test", password: "old-imap", port: 465, secure: true },
    caldav: { url: "https://calendar.example.test", user: "synthetic", password: "secret" },
    deepl: { enabled: true, apiKey: "secret-key", targetLang: "EN" } };
  await db.upsertAccount(account);
  const auth = await createAuthenticatedTestSession(id);
  const session = await requireActiveUserSession(new Request("http://localhost:3000", { headers: auth.jar.headers() }));
  if (session instanceof Response) throw new Error("Missing fixture session");
  return { id, account, db, ...auth, context: session };
}
const verified = { imap: async () => true, smtp: async () => true };
const parameters = (accountId: string) => ({ params: Promise.resolve({ accountId }) });
function jsonRequest(f: Awaited<ReturnType<typeof fixture>>, body: unknown) {
  return new Request(`http://localhost:3000/api/accounts/${f.id}/prefs`, { method: "PUT", headers: f.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }), body: JSON.stringify(body) });
}

describe("Slice 3 mailbox roles and presentation", () => {
  test("owner manager, owner counted once, current role, stable sorting and no lower-role secrets", async () => {
    const f = await fixture();
    await f.db.upsertAccount({ ...f.account, ownerUserId: f.user.id });
    await f.db.setUserAccountRole(f.user.id, f.id, "viewer", f.user.id);
    expect(await resolveAccountRole(f.user.id, f.id)).toBe("manager");
    expect((await listAccountMembers(f.id)).length).toBe(1);
    const other = await f.createUser(`other-${crypto.randomUUID()}@example.test`);
    await f.db.addUserAccountLink(other.id, f.id, "viewer");
    expect((await listAccessibleAccountsForUser(f.user.id)).find(a => a.account.id === f.id)?.memberCount).toBe(2);
    for (const role of ["viewer", "editor"] as const) {
      const shown = sanitizeAccountForClient(f.account, { role, viewerUserId: other.id, memberCount: 2 });
      expect(shown.accessRole).toBe(role); expect(shown.shared).toBe(true); expect(shown.isOwner).toBe(false);
      expect(shown.imap.host).toBe(""); expect(shown.imap.user).toBe(""); expect(shown.smtp.host).toBe("");
      expect(shown.caldav).toBeUndefined(); expect(JSON.stringify(shown)).not.toContain("secret");
      expect(mailboxFailure(f.id, role)).toMatchObject({ repairAllowed: false, reauthRequired: false });
    }
    const ownerless = sanitizeAccountForClient(f.account, { role: "manager", viewerUserId: f.user.id, memberCount: 1 });
    expect(ownerless.shared).toBe(false); expect(ownerless.isOwner).toBe(false);
    const sorted = await listAccessibleAccountsForUser(f.user.id);
    expect(sorted.map(x => x.account.id)).toEqual([...sorted].sort((a,b) => (a.account.name || a.account.email).localeCompare(b.account.name || b.account.email,"en") || a.account.email.toLowerCase().localeCompare(b.account.email.toLowerCase(),"en") || a.account.id.localeCompare(b.account.id,"en")).map(x => x.account.id));
  });
  test("member limits, enabled targets, viewer member DTO and audit", async () => {
    const f = await fixture();
    const other = await f.createUser(`member-${crypto.randomUUID()}@example.test`);
    await expect(changeAccountMember(f.id, f.user.id, f.user.id, "viewer")).rejects.toThrow("own role");
    await expect(changeAccountMember(f.id, f.user.id, f.user.id, null)).rejects.toThrow("last manager");
    await expect(changeAccountMember(f.id, "missing", f.user.id, "viewer")).rejects.toThrow("enabled user");
    await changeAccountMember(f.id, other.id, f.user.id, "viewer");
    expect(await resolveAccountRole(other.id, f.id)).toBe("viewer");
    await f.db.setUserAccountRole(f.user.id, f.id, "viewer", f.user.id);
    const response = await getMembers(new Request("http://localhost:3000", { headers: f.jar.headers() }), parameters(f.id));
    expect((await response.json()).members.every((m: Record<string, unknown>) => !("disabled" in m))).toBe(true);
    await f.db.setUserAccountRole(f.user.id, f.id, "manager", f.user.id);
    await f.auth.api.banUser({ body: { userId: other.id }, headers: (await createAuthenticatedTestSession(undefined, "admin")).jar.headers() });
    await expect(changeAccountMember(f.id, other.id, f.user.id, "editor")).rejects.toThrow("enabled user");
    await f.db.upsertAccount({ ...f.account, ownerUserId: other.id });
    await expect(changeAccountMember(f.id, other.id, f.user.id, "editor")).rejects.toThrow("owner");
    await expect(changeAccountMember(f.id, other.id, f.user.id, null)).rejects.toThrow("owner");
    expect((await f.db.listAdminAudit()).some(a => a.action === "member.grant" && a.targetUserId === other.id)).toBe(true);
  });
  test("viewer prefs sparse merge, null deletion, body identity rejected and team settings stripped", async () => {
    const f = await fixture(); await f.db.setUserAccountRole(f.user.id, f.id, "viewer", f.user.id);
    for (const body of [{ appearance: { dateFormat: "ymd", senderIcons: true }, notifications: { newMail: true } }, { appearance: { dateFormat: null } }]) {
      expect((await putPrefs(jsonRequest(f, body), parameters(f.id))).status).toBe(200);
    }
    const prefs = await getPrefs(new Request("http://localhost:3000", { headers: f.jar.headers() }), parameters(f.id));
    expect((await prefs.json()).prefs).toEqual({ appearance: { senderIcons: true }, notifications: { newMail: true } });
    expect((await putPrefs(jsonRequest(f, { userId: "another", appearance: {} }), parameters(f.id))).status).toBe(400);
    expect(stripPersonalSettings({ layout: { defaultView: "table" }, sync: { maxIdleSessions: 2 } }, false)).toEqual({ sync: { maxIdleSessions: 2 } });
  });
});

describe("Slice 3 credentials", () => {
  test.each(["relogin", "put", "post-existing", "imap-login"])("SMTP coupling permutations through %s entry", async (entry: string) => {
    const f = await fixture();
    for (const sameUser of [true, false]) for (const stored of ["", "old-imap", "independent"]) for (const explicit of [false, true]) {
      const account = { ...f.account, smtp: { ...f.account.smtp, user: sameUser ? "MAILBOX@example.test" : "different@example.test", password: stored } };
      await f.db.upsertAccount(account);
      let smtpTests = 0;
      const verification = { imap: async () => true, smtp: async () => { smtpTests++; return true; } };
      let next: Account;
      // relogin changes only IMAP; explicit SMTP input is deliberately ignored at that endpoint.
      const explicitSmtp = explicit && entry !== "relogin";
      const patch = { imap: { password: "new-imap" }, ...(explicit ? { smtp: { password: "explicit" } } : {}) };
      if (entry === "imap-login") next = await updateMailboxCredentials(f.id, patch, { userId: f.user.id }, verification);
      else {
        const payload = entry === "post-existing" ? { ...patch, id: f.id, email: account.email } : patch;
        const response = await handleMailboxCredentialMutation(jsonRequest(f, payload), entry as "put" | "relogin" | "post-existing", parameters(f.id).params, verification);
        expect(response.status).toBe(200);
        next = (await f.db.getAccountById(f.id))!;
      }
      expect(next.smtp.password).toBe(explicitSmtp ? "explicit" : sameUser && stored !== "independent" ? "new-imap" : stored);
      expect(smtpTests).toBe(explicitSmtp ? 1 : 0);
    }
  });
  test("new endpoints verified, immutable fields, blank unchanged, rejection/race never writes", async () => {
    const f = await fixture();
    for (const patch of [{ email: "changed@example.test" }, { id: "changed" }, { dbPath: "changed" }, { imap: { host: "new.example.test" } }, { smtp: { user: "new@example.test" } }]) {
      await expect(updateMailboxCredentials(f.id, patch as MailboxPatch, { userId: f.user.id }, verified)).rejects.toThrow();
    }
    expect((await updateMailboxCredentials(f.id, { imap: { password: "" } }, { userId: f.user.id }, verified)).imap.password).toBe("old-imap");
    await expect(updateMailboxCredentials(f.id, { imap: { host: "new.example.test", password: "new" } }, { userId: f.user.id }, { imap: async account => { expect(account.imap.host).toBe("new.example.test"); return false; }, smtp: verified.smtp })).rejects.toThrow("Invalid IMAP");
    expect((await f.db.getAccountById(f.id))?.imap.host).toBe("imap.example.test");
    await expect(updateMailboxCredentials(f.id, { imap: { password: "new" } }, { userId: f.user.id }, { imap: async () => { await f.db.patchAccount(f.id, { name: "Concurrent update" }); return true; }, smtp: verified.smtp })).rejects.toThrow("retry");
  });
  test("login-owner generation, sessions/tokens/challenges revoked atomically; ownerless stays ownerless", async () => {
    const f = await fixture(); await f.db.upsertAccount({ ...f.account, email: f.user.email, imap: { ...f.account.imap, user: f.user.email }, ownerUserId: f.user.id });
    const token = await mintMcpToken(f.context, f.id, "Synthetic", 3600);
    const before = f.master.prepare("SELECT generation FROM auth_security_state WHERE userId=?").get(f.user.id).generation;
    f.master.prepare("INSERT INTO auth_pending_challenges(identifier,userId,generation,authenticatedAt,kind,expiresAt) VALUES(?,?,?,?,?,?)").run(crypto.randomUUID(), f.user.id, before, Date.now(), "totp", Date.now()+10000);
    let closed = 0; registerAuthStream({ ...f.context, accountId: f.id }, () => { closed++; });
    await updateMailboxCredentials(f.id, { imap: { password: "new" } }, { userId: f.user.id }, verified);
    expect(f.master.prepare("SELECT generation FROM auth_security_state WHERE userId=?").get(f.user.id).generation).toBe(before + 1);
    expect(await validateMcpToken(token.token)).toBeNull(); expect(closed).toBe(1);
    expect(f.master.prepare("SELECT id FROM auth_session WHERE userId=?").get(f.user.id)).toBeNull();
    expect(f.master.prepare("SELECT identifier FROM auth_pending_challenges WHERE userId=?").get(f.user.id)).toBeNull();
    const ownerless = await fixture(); await updateMailboxCredentials(ownerless.id, { imap: { password: "new" } }, { userId: ownerless.user.id }, verified);
    expect((await ownerless.db.getAccountById(ownerless.id))?.ownerUserId).toBeUndefined();
  });
});

describe("Slice 3 live MCP/streams and shard cleanup", () => {
  test("MCP foreign mailbox, role downgrade, null/stale generation, ban and both factor records", async () => {
    const f = await fixture(); const { token, tokenRecord } = await mintMcpToken(f.context, f.id, "Synthetic", 3600);
    expect(token).toMatch(/^mcp_[A-Za-z0-9_-]{43}$/); expect(await validateMcpToken(token)).not.toBeNull();
    await expect(resolveMcpToolContext(tokenRecord.id, "foreign")).rejects.toThrow("another mailbox");
    await f.db.setUserAccountRole(f.user.id, f.id, "viewer", f.user.id);
    await expect(resolveMcpToolContext(tokenRecord.id, f.id, "editor")).rejects.toThrow("Insufficient mailbox role");
    expect((await validateMcpToken(token))?.role).toBe("viewer");
    const generation = f.master.prepare("SELECT securityGeneration FROM mcp_tokens WHERE id=?").get(tokenRecord.id).securityGeneration;
    f.master.prepare("UPDATE mcp_tokens SET securityGeneration=NULL WHERE id=?").run(tokenRecord.id); expect(await validateMcpToken(token)).toBeNull();
    f.master.prepare("UPDATE mcp_tokens SET securityGeneration=? WHERE id=?").run(generation-1,tokenRecord.id); expect(await validateMcpToken(token)).toBeNull();
    f.master.prepare("UPDATE mcp_tokens SET securityGeneration=? WHERE id=?").run(generation,tokenRecord.id);
    f.master.prepare("UPDATE auth_user SET twoFactorEnabled=0 WHERE id=?").run(f.user.id); expect(await validateMcpToken(token)).toBeNull();
    f.master.prepare("UPDATE auth_user SET twoFactorEnabled=1 WHERE id=?").run(f.user.id);
    f.master.prepare("UPDATE auth_two_factor SET verified=0 WHERE userId=?").run(f.user.id); expect(await validateMcpToken(token)).toBeNull();
    f.master.prepare("UPDATE auth_two_factor SET verified=1 WHERE userId=?").run(f.user.id);
    f.master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(f.user.id);
    f.master.prepare("UPDATE mcp_tokens SET securityGeneration=(SELECT generation FROM auth_security_state WHERE userId=?) WHERE id=?").run(f.user.id, tokenRecord.id);
    expect(await validateMcpToken(token)).toBeNull();
  });
  test.each(["revoke", "membership", "ban", "delete", "expire", "generation"])("open stream rejects next sensitive enqueue after %s and disposes once", async (kind: string) => {
    const f = await fixture(); const identity = { ...f.context, accountId: f.id };
    let disposed = 0;
    let controller!: ReadableStreamDefaultController<string>;
    const stream = new ReadableStream<string>({ start(next) { controller = next; } });
    const reader = stream.getReader();
    const registration = registerAuthStream(identity, () => { disposed++; controller.close(); });
    const emit = async (message: string) => {
      try { await assertStreamAuthorized(identity, () => controller.enqueue(message)); }
      catch (error) { registration.close(); throw error; }
    };
    await emit("synthetic initial envelope");
    expect((await reader.read()).value).toBe("synthetic initial envelope");
    if (kind === "revoke") f.master.prepare("DELETE FROM auth_session WHERE id=?").run(identity.sessionId);
    if (kind === "membership") await f.db.removeUserAccountLink(f.user.id, f.id);
    if (kind === "ban") f.master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(f.user.id);
    if (kind === "delete") await f.auth.api.removeUser({ body: { userId: f.user.id }, headers: (await createAuthenticatedTestSession(undefined, "admin")).jar.headers() });
    if (kind === "expire") f.master.prepare("UPDATE auth_session SET expiresAt=? WHERE id=?").run(new Date(Date.now()-1000).toISOString(), identity.sessionId);
    if (kind === "generation") f.master.prepare("UPDATE auth_security_state SET generation=generation+1 WHERE userId=?").run(f.user.id);
    await expect(emit("must never enqueue")).rejects.toThrow("revoked");
    expect((await reader.read()).done).toBe(true);
    revokeAuthStreams({ sessionId: identity.sessionId }); registration.close();
    expect(registration.closed).toBe(true); expect(disposed).toBe(1);
  });
  test("absolute expiry and idle liveness close without emitter, even if cleanup throws", async () => {
    const f = await fixture(); let closed = 0;
    const expiry = registerAuthStream({ ...f.context, expiresAt: Date.now()+20 }, () => { closed++; throw new Error("Synthetic cleanup failure"); });
    await sleep(40); expect(expiry.closed).toBe(true); expect(closed).toBe(1);
    const idle = registerAuthStream({ ...f.context, accountId: f.id }, () => { closed++; });
    await f.db.removeUserAccountLink(f.user.id, f.id);
    await sleep(5100); expect(idle.closed).toBe(true); expect(closed).toBe(2);
  });
  test("absent both, installed idempotent unassign/audit, partial schema durable failure after revoke", async () => {
    const f = await fixture();
    expect((await cleanupUserAccountAccess(f.id, f.user.id, { userId: f.user.id, clientId: "synthetic" })).status).toBe("not_installed");
    const shardPath = getDefaultAccountDbPath(f.id); mkdirSync(path.dirname(shardPath), { recursive: true });
    const shard = new Database(shardPath);
    try {
      shard.exec("CREATE TABLE thread_collab_state(accountId TEXT,threadId TEXT,assigneeUserId TEXT,assignedAt INTEGER,updatedAt INTEGER,lastActivityAt INTEGER)");
      const target = await f.createUser(`cleanup-${crypto.randomUUID()}@example.test`); await f.db.addUserAccountLink(target.id, f.id, "editor");
      expect((await changeAccountMember(f.id, target.id, f.user.id, null)).cleanupPending).toBe(true);
      expect(await resolveAccountRole(target.id, f.id)).toBeNull();
      const op = f.master.prepare("SELECT id,state FROM admin_lifecycle_operations WHERE targetUserId=? AND action='member.revoke'").get(target.id);
      expect(op.state).toBe("cleanup_pending");
      shard.exec("CREATE TABLE thread_activity(id TEXT PRIMARY KEY,accountId TEXT,threadId TEXT,type TEXT,actorUserId TEXT,actorClientId TEXT,payload TEXT,createdAt INTEGER)");
      shard.prepare("INSERT INTO thread_collab_state VALUES(?,?,?,1,1,1)").run(f.id, "synthetic-thread", target.id);
      expect(await retryMembershipCleanup(op.id)).toBe(true); expect(await retryMembershipCleanup(op.id)).toBe(true);
      expect(shard.prepare("SELECT assigneeUserId FROM thread_collab_state").get().assigneeUserId).toBeNull();
      expect(shard.prepare("SELECT COUNT(*) AS n FROM thread_activity WHERE type='unassigned' AND actorClientId='system'").get().n).toBe(1);
    } finally { shard.close(); }
  });
});


test("credential generation failure rolls back write-back; non-owner identity changes denied", async () => {
  const f = await fixture();
  const personal = { ...f.account, ownerUserId: f.user.id, email: f.user.email, imap: { ...f.account.imap, user: f.user.email } };
  await f.db.upsertAccount(personal);
  const manager = await createAuthenticatedTestSession(f.id);
  await expect(updateMailboxCredentials(f.id, { imap: { host: "new.example.test", password: "new" } }, { userId: manager.user.id }, verified)).rejects.toThrow("owner or admin");
  const token = await mintMcpToken(f.context, f.id, "Synthetic rollback", 3600);
  const trigger = `s3_failure_${f.id.replaceAll("-", "_")}`;
  f.master.exec(`CREATE TRIGGER ${trigger} BEFORE UPDATE OF generation ON auth_security_state WHEN OLD.userId='${f.user.id}' BEGIN SELECT RAISE(ABORT,'Synthetic generation fault'); END`);
  try {
    await expect(updateMailboxCredentials(f.id, { imap: { password: "new" } }, { userId: f.user.id }, verified)).rejects.toThrow("Synthetic generation fault");
    expect((await f.db.getAccountById(f.id))?.imap.password).toBe("old-imap");
    expect(await validateMcpToken(token.token)).not.toBeNull();
    expect(f.master.prepare("SELECT id FROM auth_session WHERE id=?").get(f.context.sessionId)).not.toBeNull();
  } finally { f.master.exec(`DROP TRIGGER ${trigger}`); }
});

test("SMTP verifies the new endpoint before persisting, blank CalDAV secret preserved", async () => {
  const f = await fixture();
  const patch = { smtp: { host: "new-smtp.example.test", password: "new-smtp" } };
  await expect(updateMailboxCredentials(f.id, patch, { userId: f.user.id }, { imap: verified.imap, smtp: async account => {
    expect(account.smtp.host).toBe("new-smtp.example.test"); expect(account.smtp.password).toBe("new-smtp"); return false;
  } })).rejects.toThrow("Invalid SMTP");
  expect((await f.db.getAccountById(f.id))?.smtp.host).toBe("smtp.example.test");
  const changed = await updateMailboxCredentials(f.id, { caldav: { ...f.account.caldav!, password: "" } }, { userId: f.user.id }, verified);
  expect(changed.caldav?.password).toBe("secret");
});

test("admin ownerless mailbox creation and override; manager failures carry no repair payload for viewers", async () => {
  const admin = await createAuthenticatedTestSession(undefined, "admin");
  const f = await fixture();
  const { id: _id, ...body } = { ...f.account, email: `admin-mailbox-${crypto.randomUUID()}@example.test` };
  void _id;
  const { caldav: _c, deepl: _d, ...creation } = body; void _c; void _d;
  const account = await createAdminMailbox(admin.user.id, creation, "synthetic", verified);
  expect(account.ownerUserId).toBeUndefined(); expect(await listAccountMembers(account.id)).toEqual([]);
  await changeAccountMember(account.id, f.user.id, admin.user.id, "manager", { admin: true });
  expect(await resolveAccountRole(f.user.id, account.id)).toBe("manager");
  await expect(changeAccountMember(account.id, f.user.id, admin.user.id, "viewer", { admin: true })).rejects.toThrow("last manager");
  for (const role of ["viewer", "editor"] as const) {
    const response = await mailboxErrorResponse({ authenticationFailed: true, message: "Synthetic upstream credential detail" }, account.id, role);
    expect(response?.status).toBe(503);
    const dto = await response!.json(); expect(dto).toMatchObject({ repairAllowed: false, reauthRequired: false, managerContact: [{ email: f.user.email }] });
    expect(JSON.stringify(dto)).not.toContain("upstream credential detail");
  }
});


test("copy destination independently requires editor while viewers can read folders", async () => {
  const f = await fixture();
  const destination = `destination-${crypto.randomUUID()}`;
  await f.db.upsertAccount({ ...f.account, id: destination });
  await f.db.addUserAccountLink(f.user.id, destination, "viewer");
  const { POST } = await import("@/app/api/accounts/[accountId]/messages/copy-to-account/route");
  const response = await POST(new Request(`http://localhost:3000/api/accounts/${f.id}/messages/copy-to-account`, {
    method: "POST", headers: f.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }),
    body: JSON.stringify({ messageIds: ["synthetic-message"], destinationAccountId: destination, destinationFolderId: "synthetic-folder" })
  }), parameters(f.id));
  expect(response.status).toBe(403); expect((await response.json()).requiredRole).toBe("editor");
  const { GET } = await import("@/app/api/accounts/[accountId]/folders/route");
  const read = await GET(new Request(`http://localhost:3000/api/accounts/${destination}/folders`, { headers: f.jar.headers() }), parameters(destination));
  expect(read.status).toBe(200);
});


test("relogin verifies even an unchanged submitted password; setup assurance cannot mint MCP", async () => {
  const f = await fixture();
  let attempts = 0;
  const response = await handleMailboxCredentialMutation(jsonRequest(f, { password: "old-imap" }), "relogin", parameters(f.id).params, {
    imap: async () => { attempts++; return false; }, smtp: verified.smtp
  });
  expect(response.status).toBe(400); expect(attempts).toBe(1);
  f.master.prepare("UPDATE auth_session_security SET assurance='setup' WHERE sessionId=?").run(f.context.sessionId);
  await expect(mintMcpToken(f.context, f.id, "must fail", 3600)).rejects.toThrow("MFA session");
});

test.each(["put", "relogin", "post-existing", "settings"])("%s commits secret-free changed-field audit with mailbox updates", async (entry: string) => {
  const f = await fixture();
  const payload = entry === "settings" ? { settings: { sync: { maxIdleSessions: 7 } } }
    : entry === "relogin" ? { password: "synthetic-new-secret" }
    : { imap: { password: "synthetic-new-secret" }, ...(entry === "post-existing" ? { id: f.id, email: f.account.email } : {}) };
  const response = entry === "settings"
    ? await (await import("@/app/api/accounts/[accountId]/settings/route")).PUT(jsonRequest(f, payload), parameters(f.id))
    : await handleMailboxCredentialMutation(jsonRequest(f, payload), entry as "put" | "relogin" | "post-existing", parameters(f.id).params, verified);
  expect(response.status).toBe(200);
  const audit = f.master.prepare("SELECT * FROM admin_audit WHERE action='account.update' AND targetAccountId=?").all(f.id);
  expect(audit).toHaveLength(1);
  expect(audit[0].actorUserId).toBe(f.user.id);
  expect(JSON.parse(audit[0].payload)).toEqual({ changedFields: entry === "settings" ? ["settings.sync.maxIdleSessions"] : ["imap.password", "smtp.password"] });
  const stored = (await f.db.getAccountById(f.id))!;
  if (entry !== "settings") expect(stored.smtp.password).toBe("synthetic-new-secret");
  expect(audit[0].payload).not.toContain("synthetic-new-secret");
  expect(audit[0].payload).not.toContain("old-imap");
});

test("audit failure rolls back credential, generation and settings updates", async () => {
  const f = await fixture();
  await f.db.upsertAccount({ ...f.account, email: f.user.email, ownerUserId: f.user.id, imap: { ...f.account.imap, user: f.user.email } });
  const before = await f.db.getAccountById(f.id);
  const generation = f.master.prepare("SELECT generation FROM auth_security_state WHERE userId=?").get(f.user.id).generation;
  f.master.exec(`CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON admin_audit WHEN NEW.targetAccountId='${f.id}' BEGIN SELECT RAISE(ABORT,'Synthetic audit failure'); END`);
  try {
    for (const patch of [{ imap: { password: "synthetic-new-secret" } }, { settings: { sync: { maxIdleSessions: 7 } } }]) {
      await expect(updateMailboxCredentials(f.id, patch, { userId: f.user.id }, verified)).rejects.toThrow("Synthetic audit failure");
      expect(await f.db.getAccountById(f.id)).toEqual(before);
      expect(f.master.prepare("SELECT generation FROM auth_security_state WHERE userId=?").get(f.user.id).generation).toBe(generation);
      expect(await requireActiveUserSession(new Request("http://localhost:3000", { headers: f.jar.headers() }))).not.toBeInstanceOf(Response);
    }
  } finally { f.master.exec("DROP TRIGGER synthetic_audit_failure"); }
});

test.each(["owner", "admin"])("%s deletion audit failure preserves account, links, prefs, tokens and shard", async (entry: string) => {
  const f = await fixture();
  await f.db.upsertAccount({ ...f.account, ownerUserId: f.user.id });
  await f.db.mergeUserAccountPrefs(f.user.id, f.id, { appearance: { senderIcons: true } });
  const minted = await mintMcpToken(f.context, f.id, "Synthetic deletion", 3600);
  await f.db.saveFoldersForAccount(f.id, [{ id: `${f.id}:INBOX`, name: "Inbox", accountId: f.id, count: 0 }]);
  const auth = entry === "owner" ? f : await createAuthenticatedTestSession(undefined, "admin");
  const route = entry === "owner" ? await import("@/app/api/accounts/[accountId]/route") : await import("@/app/api/admin/accounts/[accountId]/route");
  const request = () => new Request(`http://localhost:3000/api/accounts/${f.id}`, { method: "DELETE", headers: auth.jar.headers({ origin: "http://localhost:3000" }) });
  f.master.exec(`CREATE TRIGGER synthetic_delete_audit_failure BEFORE INSERT ON admin_audit WHEN NEW.targetAccountId='${f.id}' BEGIN SELECT RAISE(ABORT,'Synthetic delete audit failure'); END`);
  try {
    await expect(route.DELETE(request(), parameters(f.id))).rejects.toThrow("Synthetic delete audit failure");
    expect(await f.db.getAccountById(f.id)).not.toBeNull();
    expect(await resolveAccountRole(f.user.id, f.id)).toBe("manager");
    expect(await f.db.getUserAccountPrefs(f.user.id, f.id)).toEqual({ appearance: { senderIcons: true } });
    expect(await validateMcpToken(minted.token)).not.toBeNull();
    expect(await f.db.getFolders(f.id)).toHaveLength(1);
  } finally { f.master.exec("DROP TRIGGER synthetic_delete_audit_failure"); }
  expect((await route.DELETE(request(), parameters(f.id))).status).toBe(200);
  const audit = f.master.prepare("SELECT actorUserId FROM admin_audit WHERE action='account.delete' AND targetAccountId=?").all(f.id);
  expect(audit).toEqual([{ actorUserId: auth.user.id }]);
});

test("installed malformed activity schema with zero assignments remains cleanup_pending", async () => {
  const f = await fixture();
  const shardPath = getDefaultAccountDbPath(f.id); mkdirSync(path.dirname(shardPath), { recursive: true });
  const shard = new Database(shardPath);
  try {
    shard.exec("CREATE TABLE thread_collab_state(accountId TEXT,threadId TEXT,assigneeUserId TEXT,assignedAt INTEGER,updatedAt INTEGER,lastActivityAt INTEGER)");
    shard.exec("CREATE TABLE thread_activity(id TEXT PRIMARY KEY)");
    const target = await f.createUser(`zero-assignment-${crypto.randomUUID()}@example.test`);
    await f.db.addUserAccountLink(target.id, f.id, "editor");
    await expect(cleanupUserAccountAccess(f.id, target.id, { userId: f.user.id, clientId: "system" })).rejects.toThrow();
    expect((await changeAccountMember(f.id, target.id, f.user.id, null)).cleanupPending).toBe(true);
    const op = f.master.prepare("SELECT id,state FROM admin_lifecycle_operations WHERE targetUserId=? AND action='member.revoke'").get(target.id);
    expect(op.state).toBe("cleanup_pending");
    expect(await retryMembershipCleanup(op.id)).toBe(false);
  } finally { shard.close(); }
});

test("complete TOTP replacement rejects the old MCP bearer and old seed on next login",async()=>{
  const f=await fixture(),password="synthetic-password-123";
  const old=(await f.auth.api.getTOTPURI({headers:f.jar.headers(),body:{password}})).totpURI;
  const bearer=await mintMcpToken(f.context,f.id,"Synthetic replacement",3600);
  expect(await validateMcpToken(bearer.token)).not.toBeNull();
  const req=jsonRequest(f,{});
  const g=await reauthenticate(f.auth,f.master,readSessionSecurity(f.master,f.context.sessionId),req,{purpose:"totp.replace",currentPassword:password,totpCode:totpFromUri(old)},createRateLimiter({max:50}));
  req.headers.set("x-noctua-reauth",g.grant);
  const replacement=await mutateSecurity(f.auth,f.master,readSessionSecurity(f.master,f.context.sessionId),req,{currentPassword:password},"totp-replace");
  f.jar.absorb(replacement.headers);
  async function http(path:string,body:unknown,jar=f.jar,grant?:string) {
    const result=await f.auth.handler(new Request(`http://localhost:3000/api/ba${path}`,{method:"POST",headers:jar.headers({origin:"http://localhost:3000","content-type":"application/json",...(grant?{"x-noctua-reauth":grant}:{})}),body:JSON.stringify(body)}));
    jar.absorb(result.headers);return result;
  }
  const token=replacement.body.grant as string;
  const seed=await (await http("/two-factor/enable",{password},f.jar,token)).json();
  expect((await http("/two-factor/verify-totp",{code:totpFromUri(seed.totpURI)},f.jar,token)).status).toBe(200);
  expect(await validateMcpToken(bearer.token)).toBeNull();
  const next=new CookieJar();
  expect((await http("/sign-in/email",{email:f.user.email,password},next)).status).toBe(200);
  expect((await http("/two-factor/verify-totp",{code:totpFromUri(old)},next)).status).not.toBe(200);
  expect((await http("/two-factor/verify-totp",{code:totpFromUri(seed.totpURI)},next)).status).toBe(200);
  expect(await validateMcpToken(bearer.token)).toBeNull();
});
