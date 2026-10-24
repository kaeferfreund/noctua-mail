import type { McpTokenMetadata } from "../data";
import { withDbWriteRetry } from "../dbWriteRetry";
import { getDb } from "./connection";
import { resolveAccountRoleRows } from "./accountAccess";
import { ACCOUNT_ROLE_ORDER } from "../accountRole";
import { mapMcpTokenRow, type StoredMcpTokenRow } from "./rowParsers";

export type StoredMcpTokenRecord = McpTokenMetadata & {
  tokenHash: string;
};

/** Empty mapping is the legacy primary-only representation. */
export function mcpTokenAccountIds(db: import("bun:sqlite").Database, token: { id: string; accountId: string }): string[] {
  const rows = db.prepare("SELECT accountId FROM mcp_token_accounts WHERE tokenId=? ORDER BY accountId").all(token.id) as { accountId: string }[];
  return rows.length ? rows.map(row => row.accountId) : [token.accountId];
}
function tokenMetadata(db: import("bun:sqlite").Database, row: StoredMcpTokenRow): McpTokenMetadata {
  const token = mapMcpTokenRow(row);
  return { ...token, accountIds: mcpTokenAccountIds(db, token) };
}
/** Called inside the mailbox-deletion or membership-revoke transaction. Keep surviving shared tokens.
 *  With createdByUserId only that user's tokens lose the mailbox (membership revoke). */
export function deleteMcpTokenAccountRows(db: import("bun:sqlite").Database, accountId: string, createdByUserId?: string) {
  const owner = createdByUserId == null ? "" : " AND createdByUserId=?";
  const args = createdByUserId == null ? [accountId] : [accountId, createdByUserId];
  const ownedTokens = createdByUserId == null ? "" : " AND tokenId IN (SELECT id FROM mcp_tokens WHERE createdByUserId=?)";
  db.prepare(`DELETE FROM mcp_token_accounts WHERE accountId=?${ownedTokens}`).run(...args);
  db.prepare(`DELETE FROM mcp_tokens WHERE accountId=?${owner} AND NOT EXISTS
    (SELECT 1 FROM mcp_token_accounts a WHERE a.tokenId=mcp_tokens.id)`).run(...args);
  const moved = db.prepare(`SELECT id, accountId, createdByUserId FROM mcp_tokens WHERE accountId=?${owner}`).all(...args) as
    { id: string; accountId: string; createdByUserId: string }[];
  for (const token of moved) {
    // New primary: the remaining mailbox with the creator's highest live role; ties (and no role) by ID.
    const remaining = mcpTokenAccountIds(db, token);
    const roles = resolveAccountRoleRows(db, token.createdByUserId, remaining);
    const rank = (id: string) => { const role = roles.get(id); return role ? ACCOUNT_ROLE_ORDER[role] : 0; };
    const primary = remaining.reduce((best, id) => rank(id) > rank(best) ? id : best);
    db.prepare("UPDATE mcp_tokens SET accountId=? WHERE id=?").run(primary, token.id);
  }
}
export async function listMcpTokens(accountId: string) {
  const db = await getDb();
  const rows = db
    .prepare(
      `SELECT * FROM mcp_tokens t
       WHERE EXISTS (SELECT 1 FROM mcp_token_accounts a WHERE a.tokenId=t.id AND a.accountId=?)
          OR (t.accountId=? AND NOT EXISTS (SELECT 1 FROM mcp_token_accounts a WHERE a.tokenId=t.id))
       ORDER BY createdAt DESC, id ASC`
    )
    .all(accountId, accountId) as StoredMcpTokenRow[];
  return rows.map(row => tokenMetadata(db, row));
}

export async function getMcpTokenByHash(tokenHash: string): Promise<StoredMcpTokenRecord | null> {
  const db = await getDb();
  const row = db
    .prepare(
      `SELECT *
       FROM mcp_tokens
       WHERE tokenHash = ?
       LIMIT 1`
    )
    .get(tokenHash) as StoredMcpTokenRow | undefined;
  if (!row) return null;
  return {
    ...tokenMetadata(db, row),
    tokenHash: String(row.tokenHash ?? "")
  };
}

export async function insertMcpToken(params: {
  id: string;
  accountId: string;
  createdByUserId: string;
  label: string;
  tokenHash: string;
  tokenSuffix: string;
  createdAt: number;
  expiresAt: number | null;
}) {
  return withDbWriteRetry("insertMcpToken", async () => {
    const db = await getDb();
    db.prepare(
      `INSERT INTO mcp_tokens
       (id, accountId, createdByUserId, label, tokenHash, tokenSuffix, createdAt, expiresAt, lastUsedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    ).run(
      params.id,
      params.accountId,
      params.createdByUserId,
      params.label,
      params.tokenHash,
      params.tokenSuffix,
      params.createdAt,
      params.expiresAt
    );
    return {
      id: params.id,
      accountId: params.accountId,
      createdByUserId: params.createdByUserId,
      label: params.label,
      tokenSuffix: params.tokenSuffix,
      createdAt: params.createdAt,
      expiresAt: params.expiresAt,
      lastUsedAt: null
    } satisfies McpTokenMetadata;
  });
}

export async function deleteMcpToken(accountId: string, tokenId: string) {
  return withDbWriteRetry("deleteMcpToken", async () => {
    const db = await getDb();
    const result = db
      .prepare(`DELETE FROM mcp_tokens WHERE id=? AND (
        EXISTS (SELECT 1 FROM mcp_token_accounts a WHERE a.tokenId=mcp_tokens.id AND a.accountId=?)
        OR (accountId=? AND NOT EXISTS (SELECT 1 FROM mcp_token_accounts a WHERE a.tokenId=mcp_tokens.id)))`)
      .run(tokenId, accountId, accountId) as { changes?: number };
    return Number(result?.changes ?? 0) > 0;
  });
}

/**
 * Deletes every MCP token created by `userId`, across all mailboxes. Runs on
 * the caller's connection so it can join a larger transaction (user delete).
 */
export function deleteMcpTokenRowsForUser(db: any, userId: string): number {
  const result = db
    .prepare(`DELETE FROM mcp_tokens WHERE createdByUserId = ?`)
    .run(userId) as { changes?: number };
  return Number(result?.changes ?? 0);
}

/** Revokes a user's MCP tokens (disable, admin password reset, delete). */
export async function deleteMcpTokensForUser(userId: string) {
  return withDbWriteRetry("deleteMcpTokensForUser", async () => {
    const db = await getDb();
    return deleteMcpTokenRowsForUser(db, userId);
  });
}

export async function touchMcpTokenLastUsed(tokenId: string, lastUsedAt = Date.now()) {
  return withDbWriteRetry("touchMcpTokenLastUsed", async () => {
    const db = await getDb();
    db.prepare(`UPDATE mcp_tokens SET lastUsedAt = ? WHERE id = ?`).run(lastUsedAt, tokenId);
  });
}
