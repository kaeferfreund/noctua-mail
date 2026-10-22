import type { AccountRole, User, UserAccountLink } from "../data";
import { isAccountRole } from "../data";
import { withDbWriteRetry } from "../dbWriteRetry";
import { getDb } from "./connection";
import { deleteMcpTokenRowsForUser } from "./mcpTokens";
import {
  USER_ROW_SELECT,
  mapUserAccountLinkRow,
  mapUserRow,
  type StoredUserAccountLinkRow,
  type StoredUserRow
} from "./rowParsers";
import { deleteUserAccountPrefRowsForUser } from "./userAccountPrefs";

export type UserRole = User["role"];

/** Normalization only; Better Auth owns identity creation. */
export function normalizeUserEmail(email: string) { return email.trim().toLowerCase(); }

function assertAccountRole(role: string): asserts role is AccountRole {
  if (!isAccountRole(role)) {
    throw new Error(`Invalid mailbox role: ${role}`);
  }
}

function changedRows(result: unknown) {
  return Number((result as { changes?: number } | undefined)?.changes ?? 0);
}

function readUserById(db: any, userId: string): User | null {
  const row = db.prepare(`SELECT ${USER_ROW_SELECT} FROM users p JOIN auth_user u ON u.id=p.id WHERE p.id = ?`).get(userId) as
    | StoredUserRow
    | undefined;
  return row ? mapUserRow(row) : null;
}

export async function getUsers() {
  const db = await getDb();
  const rows = db
    .prepare(`SELECT ${USER_ROW_SELECT} FROM users p JOIN auth_user u ON u.id=p.id ORDER BY p.createdAt ASC, p.id ASC`)
    .all() as StoredUserRow[];
  return rows.map(mapUserRow);
}

export async function getUserById(userId: string) {
  const db = await getDb();
  return readUserById(db, userId);
}

/** Deletes every membership of `userId`. Runs on the caller's connection (user delete). */
export function deleteUserAccountLinkRowsForUser(db: any, userId: string): number {
  return changedRows(db.prepare(`DELETE FROM user_accounts WHERE userId = ?`).run(userId));
}

export async function deleteUserAccountLinksForUser(userId: string) {
  return withDbWriteRetry("deleteUserAccountLinksForUser", async () => {
    const db = await getDb();
    return deleteUserAccountLinkRowsForUser(db, userId);
  });
}

/**
 * Deletes a user with their memberships, per-mailbox preferences and MCP
 * tokens in one immediate transaction (§4.5). Mailboxes the user owns move
 * to `reassignOwnerTo`; the caller validates that target. Deleting an owner
 * without a target is refused so no mailbox is left with a dangling owner.
 * Unassigning the user in the account shards is the caller's job. Returns
 * false when the user does not exist.
 */
export async function deleteUser(
  userId: string,
  options: { reassignOwnerTo?: string } = {}
): Promise<boolean> {
  return withDbWriteRetry("deleteUser", async () => {
    const db = await getDb();
    const deleted: boolean = db
      .transaction(() => {
        if (options.reassignOwnerTo) {
          db.prepare(`UPDATE accounts SET ownerUserId = ? WHERE ownerUserId = ?`).run(
            options.reassignOwnerTo,
            userId
          );
        }
        const owned = db
          .prepare(`SELECT COUNT(*) AS count FROM accounts WHERE ownerUserId = ?`)
          .get(userId) as { count: number };
        if (owned.count > 0) {
          throw new Error(`User ${userId} still owns ${owned.count} mailbox(es)`);
        }
        deleteUserAccountLinkRowsForUser(db, userId);
        deleteUserAccountPrefRowsForUser(db, userId);
        deleteMcpTokenRowsForUser(db, userId);
        return changedRows(db.prepare(`DELETE FROM users WHERE id = ?`).run(userId)) > 0;
      })
      .immediate();
    return deleted;
  });
}

export async function getUserAccounts(): Promise<UserAccountLink[]> {
  const db = await getDb();
  const rows = db.prepare(`SELECT * FROM user_accounts`).all() as StoredUserAccountLinkRow[];
  return rows.map(mapUserAccountLinkRow);
}

export async function listAccessibleAccountIdsForUser(userId: string) {
  const db = await getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT a.id as id
       FROM accounts a
       LEFT JOIN user_accounts ua ON ua.accountId = a.id
       WHERE ua.userId = ? OR a.ownerUserId = ?
       ORDER BY a.id ASC`
    )
    .all(userId, userId) as Array<{ id?: string | null }>;
  return rows
    .map((row) => String(row.id ?? "").trim())
    .filter(Boolean);
}

/**
 * Synchronous core of `addUserAccountLink` for callers that compose one
 * transaction on the master connection (signup). Returns true when a new
 * link was created.
 */
export function insertUserAccountLinkRow(
  db: any,
  userId: string,
  accountId: string,
  role: AccountRole = "manager",
  grantedByUserId: string | null = null
): boolean {
  assertAccountRole(role);
  const result = db
    .prepare(
      `INSERT INTO user_accounts (userId, accountId, role, grantedByUserId, grantedAt)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(userId, accountId) DO NOTHING`
    )
    .run(userId, accountId, role, grantedByUserId, Date.now());
  return changedRows(result) > 0;
}

/**
 * Creates a membership. An existing link is left untouched, so this never
 * resets a role; role changes go through `setUserAccountRole`. Returns true
 * when a new link was created.
 */
export async function addUserAccountLink(
  userId: string,
  accountId: string,
  role: AccountRole = "manager",
  grantedByUserId: string | null = null
): Promise<boolean> {
  return withDbWriteRetry("addUserAccountLink", async () => {
    const db = await getDb();
    return insertUserAccountLinkRow(db, userId, accountId, role, grantedByUserId);
  });
}

/** Grants `role` on `accountId`, creating or updating the membership. */
export async function setUserAccountRole(
  userId: string,
  accountId: string,
  role: AccountRole,
  grantedByUserId: string | null
): Promise<UserAccountLink> {
  assertAccountRole(role);
  return withDbWriteRetry("setUserAccountRole", async () => {
    const db = await getDb();
    const row = db
      .prepare(
        `INSERT INTO user_accounts (userId, accountId, role, grantedByUserId, grantedAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(userId, accountId) DO UPDATE SET
           role = excluded.role,
           grantedByUserId = excluded.grantedByUserId,
           grantedAt = excluded.grantedAt
         RETURNING userId, accountId, role, grantedByUserId, grantedAt`
      )
      .get(userId, accountId, role, grantedByUserId, Date.now()) as StoredUserAccountLinkRow;
    return mapUserAccountLinkRow(row);
  });
}

/**
 * The role stored on the membership row, or null without one. Ownership
 * (`accounts.ownerUserId`) is not considered here; `resolveAccountRole`
 * combines both.
 */
export async function getUserAccountRole(
  userId: string,
  accountId: string
): Promise<AccountRole | null> {
  const db = await getDb();
  const row = db
    .prepare(
      `SELECT userId, accountId, role, grantedByUserId, grantedAt
       FROM user_accounts
       WHERE userId = ? AND accountId = ?`
    )
    .get(userId, accountId) as StoredUserAccountLinkRow | undefined;
  return row ? mapUserAccountLinkRow(row).role : null;
}

/** Revokes a membership. Returns true when a link was removed. */
export async function removeUserAccountLink(userId: string, accountId: string) {
  return withDbWriteRetry("removeUserAccountLink", async () => {
    const db = await getDb();
    const result = db
      .prepare(`DELETE FROM user_accounts WHERE userId = ? AND accountId = ?`)
      .run(userId, accountId);
    return changedRows(result) > 0;
  });
}

/** Memberships on one mailbox (indexed by `idx_user_accounts_account`). */
export async function listUserAccountLinks(accountId: string): Promise<UserAccountLink[]> {
  const db = await getDb();
  const rows = db
    .prepare(
      `SELECT userId, accountId, role, grantedByUserId, grantedAt
       FROM user_accounts
       WHERE accountId = ?
       ORDER BY userId ASC`
    )
    .all(accountId) as StoredUserAccountLinkRow[];
  return rows.map(mapUserAccountLinkRow);
}

/** Memberships of one user (primary-key prefix). */
export async function listUserAccountLinksForUser(userId: string): Promise<UserAccountLink[]> {
  const db = await getDb();
  const rows = db
    .prepare(
      `SELECT userId, accountId, role, grantedByUserId, grantedAt
       FROM user_accounts
       WHERE userId = ?
       ORDER BY accountId ASC`
    )
    .all(userId) as StoredUserAccountLinkRow[];
  return rows.map(mapUserAccountLinkRow);
}
