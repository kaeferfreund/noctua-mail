import { randomUUID } from "crypto";
import type { AccountRole } from "./data";
import { getDb } from "./db/connection";
import { resolveAccountRoleRow } from "./db/accountAccess";
import { roleAtLeast } from "./accountRole";
import { withDbWriteRetry } from "./dbWriteRetry";
import { revokeAuthStreams } from "./authStreams";
import { retryMembershipCleanup } from "./membershipCleanup";
import { insertUserAccountLinkRow } from "./db/users";

export class MembershipError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}
export async function changeAccountMember(accountId: string, userId: string, actorUserId: string, role: AccountRole | null, options: { admin?: boolean } = {}) {
  const db = await getDb();
  const operationId = randomUUID();
  const result = await withDbWriteRetry("changeAccountMember", () => db.transaction(() => {
    const admin = options.admin === true && !!db.prepare(`SELECT u.id FROM auth_user u JOIN users p ON p.id=u.id
      WHERE u.id=? AND p.role='admin' AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))` ).get(actorUserId);
    if (!admin && !roleAtLeast(resolveAccountRoleRow(db, actorUserId, accountId), "manager")) throw new MembershipError("Insufficient mailbox role");
    const account = db.prepare("SELECT ownerUserId FROM accounts WHERE id=?").get(accountId) as { ownerUserId: string | null };
    if (!account) throw new MembershipError("Account not found", 404);
    if (account.ownerUserId === userId) throw new MembershipError("Cannot modify the mailbox owner");
    if (role && !admin && userId === actorUserId) throw new MembershipError("Cannot change your own role");
    const previous = db.prepare("SELECT role FROM user_accounts WHERE userId=? AND accountId=?").get(userId, accountId) as { role: AccountRole } | undefined;
      if (previous?.role === "manager" && role !== "manager") {
        const others = db.prepare(`SELECT COUNT(*) AS count FROM auth_user u JOIN users p ON p.id=u.id
          WHERE u.id<>? AND (u.id=? OR EXISTS (SELECT 1 FROM user_accounts ua WHERE ua.userId=u.id AND ua.accountId=? AND ua.role='manager'))
          AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))`)
          .get(userId, account.ownerUserId, accountId) as { count: number };
        if (!others.count) throw new MembershipError("Cannot remove the last manager");
      }
    if (role) {
      if (!["viewer", "editor", "manager"].includes(role)) throw new MembershipError("Invalid role", 400);
      const target = db.prepare(`SELECT u.id FROM auth_user u JOIN users p ON p.id=u.id WHERE u.id=?
        AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))
        AND NOT EXISTS (SELECT 1 FROM user_provisioning WHERE userId=u.id AND state NOT IN ('complete','cancelled'))`).get(userId);
      if (!target) throw new MembershipError("Target must be an existing enabled user", 400);
      insertUserAccountLinkRow(db, userId, accountId, role, actorUserId);
      db.prepare("UPDATE user_accounts SET role=?,grantedByUserId=?,grantedAt=? WHERE userId=? AND accountId=?").run(role, actorUserId, Date.now(), userId, accountId);
    } else {
      db.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(userId, accountId);
      db.prepare("DELETE FROM mcp_tokens WHERE createdByUserId=? AND accountId=?").run(userId, accountId);
      db.prepare("DELETE FROM user_account_prefs WHERE userId=? AND accountId=?").run(userId, accountId);
      const now = Date.now();
      db.prepare(`INSERT INTO admin_lifecycle_operations(id,actorUserId,targetUserId,action,payload,state,createdAt,updatedAt)
        VALUES (?,?,?,'member.revoke',?,'cleanup_pending',?,?)`).run(operationId, actorUserId, userId, JSON.stringify({ accountId }), now, now);
    }
    if (previous?.role !== role) db.prepare(`INSERT INTO admin_audit(id,actorUserId,action,targetUserId,targetAccountId,payload,createdAt) VALUES (?,?,?,?,?,?,?)`)
      .run(randomUUID(), actorUserId, role ? previous ? "member.update" : "member.grant" : "member.revoke", userId, accountId, JSON.stringify({ role, previousRole: previous?.role ?? null }), Date.now());
    return { revoked: !role };
  }).immediate());
  revokeAuthStreams({ userId, accountId });
  return { cleanupPending: result.revoked ? !await retryMembershipCleanup(operationId) : false };
}
