import { createHash, randomBytes, randomUUID } from "crypto";
import type { Account, AccountRole, McpTokenMetadata } from "./data";
import type { ActiveUserSession } from "./auth";
import { getDb } from "./db/connection";
import { mapAccountRow, mapMcpTokenRow } from "./db/rowParsers";
import { resolveAccountRoleRow } from "./db/accountAccess";
import { roleAtLeast } from "./accountRole";
import { withDbWriteRetry } from "./dbWriteRetry";

export type McpAccountContext = { accountId: string; account: Account; role: AccountRole; tokenRecord: McpTokenMetadata };
export const hashMcpToken = (token: string) => createHash("sha256").update(token).digest("hex");
/** One synchronous snapshot: creator, both MFA records, generation and current bound-mailbox role. */
function liveToken(db: any, where: string, value: string): McpAccountContext | null {
  return db.transaction(() => {
  const row = db.prepare(`SELECT t.* FROM mcp_tokens t JOIN users p ON p.id=t.createdByUserId
    JOIN auth_user u ON u.id=p.id JOIN auth_security_state st ON st.userId=u.id
    WHERE ${where}=? AND t.securityGeneration IS NOT NULL AND t.securityGeneration=st.generation
      AND (t.expiresAt IS NULL OR t.expiresAt>?) AND u.twoFactorEnabled=1
      AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))
      AND (SELECT COUNT(*) FROM auth_two_factor WHERE userId=u.id)=1
      AND EXISTS (SELECT 1 FROM auth_two_factor WHERE userId=u.id AND verified=1 AND length(trim(secret))>0)
      AND (p.role<>'admin' OR EXISTS (SELECT 1 FROM auth_account WHERE userId=u.id AND providerId='credential' AND password IS NOT NULL))
      AND NOT EXISTS (SELECT 1 FROM admin_lifecycle_operations WHERE slot='security:' || u.id
        AND action NOT IN ('security.login','security.reauth','security.passkey.reauth','security.passkey.login'))
      AND NOT EXISTS (SELECT 1 FROM user_provisioning WHERE userId=u.id AND state NOT IN ('complete','cancelled'))`).get(value, Date.now()) as
    { accountId: string; createdByUserId: string } | undefined;
  if (!row) return null;
  const role = resolveAccountRoleRow(db, row.createdByUserId, row.accountId);
  const account = db.prepare("SELECT * FROM accounts WHERE id=?").get(row.accountId);
  return role && account ? { accountId: row.accountId, account: mapAccountRow(account), role, tokenRecord: mapMcpTokenRow(row) } : null;
  }).deferred();
}
export async function validateMcpToken(token: string): Promise<McpAccountContext | null> {
  if (!/^mcp_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return liveToken(await getDb(), "t.tokenHash", hashMcpToken(token));
}
/** Tools recheck by id so batched calls and downgrades cannot reuse a role snapshot. */
export async function resolveMcpToolContext(tokenId: string, accountId: string, minRole: AccountRole = "viewer"): Promise<McpAccountContext> {
  const context = liveToken(await getDb(), "t.id", tokenId);
  if (!context) throw new Error("Unauthorized MCP token");
  if (context.accountId !== accountId) throw new Error("MCP token is bound to another mailbox");
  if (!roleAtLeast(context.role, minRole)) throw new Error("Insufficient mailbox role");
  return context;
}
export async function mintMcpToken(session: ActiveUserSession, accountId: string, label: string, ttlSeconds: number) {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 31_536_000) throw new Error("Invalid token TTL");
  const token = `mcp_${randomBytes(32).toString("base64url")}`;
  const db = await getDb();
  return withDbWriteRetry("mintMcpToken", () => db.transaction(() => {
    const proof = db.prepare(`SELECT 1 FROM auth_session s JOIN auth_session_security ss ON ss.sessionId=s.id AND ss.userId=s.userId
      JOIN auth_security_state st ON st.userId=s.userId WHERE s.id=? AND s.userId=? AND ss.assurance='mfa'
      AND ss.generation=st.generation AND st.generation=? AND ss.authenticatedAt=?
      AND julianday(s.expiresAt)>julianday('now') AND ss.authenticatedAt<=? AND ss.authenticatedAt>?`)
      .get(session.sessionId, session.userId, session.generation, session.authenticatedAt, Date.now(), Date.now() - 86_400_000);
    if (!proof || session.assurance !== "mfa" || session.expiresAt <= Date.now() || !roleAtLeast(resolveAccountRoleRow(db, session.userId, accountId), "editor")) throw new Error("MFA session and editor membership required");
    const id = randomUUID(), now = Date.now();
    db.prepare(`INSERT INTO mcp_tokens(id,accountId,createdByUserId,label,tokenHash,tokenSuffix,createdAt,expiresAt,securityGeneration)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(id, accountId, session.userId, label.trim().slice(0, 128), hashMcpToken(token), token.slice(-6), now, now + ttlSeconds * 1000, session.generation);
    const context = liveToken(db, "t.id", id);
    if (!context) throw new Error("MFA enrollment required");
    return { token, tokenRecord: context.tokenRecord };
  }).immediate());
}
