import { describe, expect, test } from "bun:test";
import type { Account } from "@/lib/data";
import { createAuthenticatedTestSession, syntheticRequestIp } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { GET as listAccounts } from "./accounts/route";
import { DELETE as deleteAccount } from "./accounts/[accountId]/route";
import { PUT as putMember, DELETE as deleteMember } from "./accounts/[accountId]/members/[userId]/route";
import { GET as getMailboxSpam, PUT as putMailboxSpam } from "./accounts/[accountId]/spam-settings/route";
import { GET as getSpamSettings } from "./spam-settings/route";
import { GET as listUsers } from "./users/route";
import { DELETE as deleteUser } from "./users/[userId]/route";
import { GET as listAudit } from "./audit/route";

// Administrators see and manage only mailboxes they are a member of (owner or any role).
// Foreign mailbox ids answer 404 like unknown ones; non-admins keep their 403.
const ORIGIN = "http://localhost:3000";
const { upsertAccount } = await dbModulePromise;
type Session = Awaited<ReturnType<typeof createAuthenticatedTestSession>>;

function mailbox(prefix: string, ownerUserId?: string): Account {
  const id = `${prefix}-${crypto.randomUUID()}`;
  return { id, name: `Synthetic ${prefix}`, email: `${id}@example.test`, avatar: "", ownerUserId,
    imap: { host: "imap.example.test", port: 993, secure: true, user: `${id}@example.test`, password: "synthetic-secret" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: `${id}@example.test`, password: "synthetic-secret" } };
}
function request(session: Session, path: string, method = "GET", body?: unknown) {
  return new Request(`${ORIGIN}/api/${path}`, { method,
    headers: session.jar.headers({ origin: ORIGIN, "x-forwarded-for": syntheticRequestIp(), ...(body === undefined ? {} : { "content-type": "application/json" }) }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const accountParams = (accountId: string, userId = "") => ({ params: Promise.resolve({ accountId, userId }) });

async function fixture() {
  const admin = await createAuthenticatedTestSession(undefined, "admin");
  const owner = await admin.createUser(`owner-${crypto.randomUUID()}@example.test`);
  const own = mailbox("own"), foreign = mailbox("foreign", owner.id);
  await upsertAccount(own); await upsertAccount(foreign);
  // The reader role is enough for every admin surface of a mailbox.
  await admin.addMembership(admin.user.id, own.id, "viewer");
  const member = await admin.createUser(`member-${crypto.randomUUID()}@example.test`);
  await admin.addMembership(member.id, own.id, "editor"); await admin.addMembership(member.id, foreign.id, "viewer");
  const user = await createAuthenticatedTestSession(own.id);
  return { admin, owner, member, own, foreign, user };
}

describe("admin routes are limited to the admin's own mailboxes", () => {
  test("Postfächer lists only member mailboxes", async () => {
    const f = await fixture();
    const response = await listAccounts(request(f.admin, "admin/accounts"));
    expect(response.status).toBe(200);
    const ids = (await response.json()).accounts.map((account: { id: string }) => account.id);
    expect(ids).toContain(f.own.id); expect(ids).not.toContain(f.foreign.id);
    expect((await listAccounts(request(f.user, "admin/accounts"))).status).toBe(403);
  });

  test("member management: foreign 404 without a change, reader-role admin may manage, non-admin 403", async () => {
    const f = await fixture(), target = await f.admin.createUser(`target-${crypto.randomUUID()}@example.test`);
    for (const response of [await putMember(request(f.admin, "members", "PUT", { role: "viewer" }), accountParams(f.foreign.id, target.id)),
      await deleteMember(request(f.admin, "members", "DELETE"), accountParams(f.foreign.id, f.member.id))]) {
      expect(response.status).toBe(404); expect(await response.json()).toMatchObject({ ok: false, code: "account_not_found" });
    }
    expect(f.admin.master.prepare("SELECT 1 FROM user_accounts WHERE userId=? AND accountId=?").get(target.id, f.foreign.id)).toBeNull();
    expect(f.admin.master.prepare("SELECT 1 FROM user_accounts WHERE userId=? AND accountId=?").get(f.member.id, f.foreign.id)).not.toBeNull();
    expect((await putMember(request(f.admin, "members", "PUT", { role: "viewer" }), accountParams(f.own.id, target.id))).status).toBe(200);
    expect((await putMember(request(f.user, "members", "PUT", { role: "viewer" }), accountParams(f.own.id, target.id))).status).toBe(403);
    // An unknown mailbox answers exactly like a foreign one.
    const unknown = await putMember(request(f.admin, "members", "PUT", { role: "viewer" }), accountParams(`missing-${crypto.randomUUID()}`, target.id));
    expect([unknown.status, (await unknown.json()).code]).toEqual([404, "account_not_found"]);
  });

  test("per-mailbox spam settings: foreign 404 for read and write, reader-role admin 200, non-admin 403", async () => {
    const f = await fixture();
    const settings = { enabled: true, moveToJunk: false, threshold: null };
    const foreignRead = await getMailboxSpam(request(f.admin, "spam"), accountParams(f.foreign.id));
    expect([foreignRead.status, (await foreignRead.json()).code]).toEqual([404, "account_not_found"]);
    expect((await putMailboxSpam(request(f.admin, "spam", "PUT", settings), accountParams(f.foreign.id))).status).toBe(404);
    expect(f.admin.master.prepare("SELECT 1 FROM admin_audit WHERE action='spam_settings.update' AND targetAccountId=?").get(f.foreign.id)).toBeNull();
    expect((await getMailboxSpam(request(f.admin, "spam"), accountParams(f.own.id))).status).toBe(200);
    expect((await getMailboxSpam(request(f.user, "spam"), accountParams(f.own.id))).status).toBe(403);
  });

  test("deleting a mailbox: foreign 404 and kept, non-admin 403", async () => {
    const f = await fixture();
    expect((await deleteAccount(request(f.admin, "admin/accounts", "DELETE"), accountParams(f.foreign.id))).status).toBe(404);
    expect(f.admin.master.prepare("SELECT 1 FROM accounts WHERE id=?").get(f.foreign.id)).not.toBeNull();
    expect((await deleteAccount(request(f.user, "admin/accounts", "DELETE"), accountParams(f.own.id))).status).toBe(403);
  });

  test("Benutzer: users stay global, their mailbox column shows only the admin's mailboxes", async () => {
    const f = await fixture();
    const response = await listUsers(request(f.admin, "admin/users"));
    expect(response.status).toBe(200);
    const users = (await response.json()).users as Array<{ id: string; accounts: Array<{ id: string }> }>;
    expect(users.find(user => user.id === f.member.id)?.accounts.map(account => account.id)).toEqual([f.own.id]);
    // The owner of a foreign mailbox is still listed, without that mailbox.
    expect(users.find(user => user.id === f.owner.id)?.accounts).toEqual([]);
  });

  test("deleting a user with a foreign membership is refused before anything changes", async () => {
    const f = await fixture();
    const params = { params: Promise.resolve({ userId: f.member.id }) };
    const response = await deleteUser(request(f.admin, "admin/users", "DELETE", {}), params);
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ ok: false, code: "foreign_mailbox_membership" });
    expect(f.admin.master.prepare("SELECT COUNT(*) AS n FROM user_accounts WHERE userId=?").get(f.member.id)).toEqual({ n: 2 });
    expect(f.admin.master.prepare("SELECT banned FROM auth_user WHERE id=?").get(f.member.id).banned).toBeFalsy();
    expect(f.admin.master.prepare("SELECT 1 FROM admin_audit WHERE action='user.delete' AND targetUserId=?").get(f.member.id)).toBeNull();
    // A user whose memberships are all visible can be deleted.
    await f.admin.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(f.member.id, f.foreign.id);
    expect((await deleteUser(request(f.admin, "admin/users", "DELETE", {}), params)).status).toBe(200);
  });

  test("Protokoll hides entries of foreign mailboxes; entries without a mailbox and own actions stay", async () => {
    const f = await fixture(), createdAt = Date.now() + 2_000_000;
    const rows = [["foreign", f.owner.id, f.foreign.id], ["own", f.owner.id, f.own.id], ["none", f.owner.id, null], ["self", f.admin.user.id, f.foreign.id]] as const;
    const ids = rows.map(([name]) => `${f.own.id}-${name}`);
    rows.forEach(([, actor, accountId], index) => f.admin.master.prepare("INSERT INTO admin_audit(id,actorUserId,action,targetAccountId,createdAt) VALUES(?,?,'member.update',?,?)")
      .run(ids[index], actor, accountId, createdAt + index));
    try {
      const page = await listAudit(request(f.admin, "admin/audit?limit=3"));
      expect(page.status).toBe(200);
      // Filtered before the limit: three visible entries, newest first, the foreign one never.
      expect((await page.json()).entries.map((entry: { id: string }) => entry.id)).toEqual([ids[3], ids[2], ids[1]]);
      const outsider = await createAuthenticatedTestSession(undefined, "admin");
      const seen = (await (await listAudit(request(outsider, "admin/audit?limit=10"))).json()).entries.map((entry: { id: string }) => entry.id);
      expect(seen).toContain(ids[2]); expect(seen).not.toContain(ids[0]); expect(seen).not.toContain(ids[1]); expect(seen).not.toContain(ids[3]);
    } finally { for (const id of ids) f.admin.master.prepare("DELETE FROM admin_audit WHERE id=?").run(id); }
  });

  test("Spam-Erkennung trusted-sender counters cover only the admin's mailboxes", async () => {
    const f = await fixture();
    const response = await getSpamSettings(request(f.admin, "admin/spam-settings"));
    expect(response.status).toBe(200);
    const trust = (await response.json()).trust as Array<{ accountId: string; email: string }>;
    expect(trust.map(entry => entry.accountId)).toContain(f.own.id);
    expect(trust.some(entry => entry.accountId === f.foreign.id || entry.email === f.foreign.email)).toBe(false);
  });
});
