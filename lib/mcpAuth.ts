import { assertMcpScope, mcpToolScope, scopesForMcpMode, type McpPermissionMode, type McpScope } from "./mcpPermissions";
import { mcpTokenAccountIds } from "./db/mcpTokens";
import { readAccountAccess, type AccountAccessEntry } from "./accountAccess";
import { createHash, randomBytes, randomUUID } from "crypto";
import type { Account, AccountRole, McpTokenMetadata } from "./data";
import type { ActiveUserSession } from "./auth";
import { getDb } from "./db/connection";
import { mapAccountRow, mapMcpTokenRow } from "./db/rowParsers";
import { resolveAccountRoleRow } from "./db/accountAccess";
import { listSenderIdentityRows } from "./db/senderIdentities";
import { getOwnAddresses } from "./ownAddresses";
import { roleAtLeast } from "./accountRole";
import { withDbWriteRetry } from "./dbWriteRetry";
import { consumeActionGrant } from "./authPolicy";

export type McpAccountContext = { accountId: string; account: Account; role: AccountRole; tokenRecord: McpTokenMetadata };
export const hashMcpToken = (token: string) => createHash("sha256").update(token).digest("hex");
/** One synchronous snapshot: creator, both MFA records, generation and current selected-mailbox role. */
function liveToken(db: any, where: string, value: string, authorize?: (db: import("bun:sqlite").Database, context: McpAccountContext) => void, requestedAccountId?: string | null): McpAccountContext | null {
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
  const tokenRecord = mapMcpTokenRow(row);
  const accountIds = mcpTokenAccountIds(db, tokenRecord);
  tokenRecord.accountIds = accountIds;
  // Authentication may use any surviving membership; tool defaults always mean primary.
  const accountId = requestedAccountId === null ? row.accountId : requestedAccountId ?? [row.accountId, ...accountIds].find(id =>
    accountIds.includes(id) && resolveAccountRoleRow(db, row.createdByUserId, id));
  if (!accountId) return null;
  if (!accountIds.includes(accountId)) throw new Error("Mailbox is not covered by MCP token");
  const role = resolveAccountRoleRow(db, row.createdByUserId, accountId);
  const account = db.prepare("SELECT * FROM accounts WHERE id=?").get(accountId);
  if (!role || !account) return null;
  const mapped = mapAccountRow(account);
  // Same scoped read snapshot as the live membership check. Only address data is
  // attached; personal prefs and identity configuration are never token output.
  mapped.ownAddresses = getOwnAddresses(mapped, listSenderIdentityRows(db, accountId));
  const context = { accountId, account: mapped, role, tokenRecord };
  authorize?.(db, context);
  return context;
  }).deferred();
}
export async function validateMcpToken(token: string): Promise<McpAccountContext | null> {
  return validateMcpTokenRow(await getDb(),token);
}
/** Same synchronous bearer boundary for isolated storage and the request wrapper. */
export function validateMcpTokenRow(db:import("bun:sqlite").Database,token:string):McpAccountContext|null {
  if (!/^mcp_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return liveToken(db, "t.tokenHash", hashMcpToken(token));
}
/** Tools recheck by id so batched calls and downgrades cannot reuse a role snapshot. */
export async function resolveMcpToolContext(tokenId: string, accountId: string | undefined = undefined, minRole: AccountRole = "viewer", authorize?: (db: import("bun:sqlite").Database) => void, scope?: McpScope): Promise<McpAccountContext> {
  return resolveMcpToolContextRow(await getDb(), tokenId, accountId, minRole, authorize, scope);
}
/** Reuse the bearer policy while holding the caller's immediate write transaction. */
export function resolveMcpToolContextRow(db: import("bun:sqlite").Database, tokenId: string, accountId: string | undefined = undefined, minRole: AccountRole = "viewer", authorize?: (db: import("bun:sqlite").Database) => void, scope?: McpScope): McpAccountContext {
  const context = liveToken(db, "t.id", tokenId, (db, live) => {
    if (scope) assertMcpScope(live.tokenRecord.scopes, scope);
    if (!roleAtLeast(live.role, minRole)) throw new Error("Insufficient mailbox role");
    authorize?.(db);
  }, accountId ?? null);
  if (!context) throw new Error("Unauthorized MCP token");
  return context;
}
/** Central tools/call boundary: use stored scopes, never client authInfo or an entry snapshot. */
export async function assertMcpToolPermission(tokenId: string, toolName: string) {
  const scope = mcpToolScope(toolName);
  const context = liveToken(await getDb(), "t.id", tokenId, (_db, live) => assertMcpScope(live.tokenRecord.scopes, scope));
  if (!context) throw new Error("Unauthorized MCP token");
}
/** Live stored scopes for the tools/list filter (same token policy as the tools/call gate). */
export async function mcpTokenScopes(tokenId: string): Promise<readonly McpScope[]> {
  const context = liveToken(await getDb(), "t.id", tokenId);
  if (!context) throw new Error("Unauthorized MCP token");
  return context.tokenRecord.scopes ?? scopesForMcpMode("drafts");
}
/** Enumerate only covered mailboxes with live membership, independent of primary membership. */
export async function listMcpTokenAccounts(tokenId: string): Promise<AccountAccessEntry[]> {
  const db = await getDb();
  return db.transaction(() => {
    const context = liveToken(db, "t.id", tokenId);
    if (!context) throw new Error("Unauthorized MCP token");
    assertMcpScope(context.tokenRecord.scopes, "read");
    return readAccountAccess(db, context.tokenRecord.createdByUserId, { scope: context.tokenRecord.accountIds, identities: true }).entries;
  }).deferred();
}
/** A token outlives session expiry and revocation, so creating one spends a fresh `mcp.create` grant. */
export async function consumeMcpCreateGrant(session: ActiveUserSession, grant: string | null) {
  await consumeActionGrant(await getDb(), grant, session, "mcp.create");
}
export async function mintMcpToken(session: ActiveUserSession, accountId: string, label: string, ttlSeconds: number,
  options: { accountIds?: string[]; mode?: McpPermissionMode } = {}) {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 31_536_000) throw new Error("Invalid token TTL");
  const token = `mcp_${randomBytes(32).toString("base64url")}`;
  const db = await getDb();
  return withDbWriteRetry("mintMcpToken", () => db.transaction(() => {
    const proof = db.prepare(`SELECT 1 FROM auth_session s JOIN auth_session_security ss ON ss.sessionId=s.id AND ss.userId=s.userId
      JOIN auth_security_state st ON st.userId=s.userId WHERE s.id=? AND s.userId=? AND ss.assurance='mfa'
      AND ss.generation=st.generation AND st.generation=? AND ss.authenticatedAt=?
      AND julianday(s.expiresAt)>julianday('now') AND ss.authenticatedAt<=?`)
      .get(session.sessionId, session.userId, session.generation, session.authenticatedAt, Date.now());
    if (!proof || session.assurance !== "mfa" || session.expiresAt <= Date.now() || !roleAtLeast(resolveAccountRoleRow(db, session.userId, accountId), "editor")) throw new Error("MFA session and editor membership required");
    const accountIds = [...new Set(options.accountIds ?? [accountId])];
    if (!accountIds.length || !accountIds.includes(accountId) || accountIds.some(id => !resolveAccountRoleRow(db, session.userId, id))) {
      throw new Error("Mailbox membership required for every selected mailbox");
    }
    const id = randomUUID(), now = Date.now();
    db.prepare(`INSERT INTO mcp_tokens(id,accountId,createdByUserId,label,tokenHash,tokenSuffix,createdAt,expiresAt,securityGeneration,scopes)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, accountId, session.userId, label.trim().slice(0, 128), hashMcpToken(token), token.slice(-6), now, now + ttlSeconds * 1000, session.generation, JSON.stringify(scopesForMcpMode(options.mode ?? "drafts")));
    for (const selected of accountIds) db.prepare("INSERT INTO mcp_token_accounts(tokenId,accountId) VALUES (?,?)").run(id, selected);
    const context = liveToken(db, "t.id", id);
    if (!context) throw new Error("MFA enrollment required");
    return { token, tokenRecord: context.tokenRecord };
  }).immediate());
}
