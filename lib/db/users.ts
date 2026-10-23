import { isUiLocale, type UiLocalePreference } from "../i18n/config";
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

/** Link holders plus the owner of one mailbox, with their raw link role; never scans the whole directory. */
export function readAccountMemberRows(db: any, accountId: string, ownerUserId: string | null): Array<{ user: User; linkRole: string | null }> {
  return (db.query(`SELECT ${USER_ROW_SELECT}, ua.role AS linkRole FROM users p JOIN auth_user u ON u.id=p.id
    LEFT JOIN user_accounts ua ON ua.accountId=?1 AND ua.userId=p.id
    WHERE p.id IN (SELECT userId FROM user_accounts WHERE accountId=?1 UNION SELECT ?2)`)
    .all(accountId, ownerUserId) as Array<StoredUserRow & { linkRole: string | null }>)
    .map(row => ({ user: mapUserRow(row), linkRole: row.linkRole }));
}

/** Member counts as `readAccountMemberRows(...).length`: links and owner, deduplicated, only existing users. */
export function countAccountMembers(db: any, accountIds: readonly string[]): Map<string, number> {
  if (!accountIds.length) return new Map();
  const rows = db.query(`SELECT m.accountId AS accountId, COUNT(*) AS memberCount
    FROM (SELECT accountId, userId FROM user_accounts WHERE accountId IN (SELECT value FROM json_each(?1))
      UNION SELECT id, ownerUserId FROM accounts WHERE id IN (SELECT value FROM json_each(?1)) AND ownerUserId IS NOT NULL) m
    JOIN users p ON p.id=m.userId JOIN auth_user u ON u.id=p.id
    GROUP BY m.accountId`).all(JSON.stringify(accountIds)) as Array<{ accountId: string; memberCount: number }>;
  return new Map(rows.map(row => [row.accountId, row.memberCount]));
}

/** Bounded manager directory; select only the identity fields needed for membership. */
export async function listAccountMemberCandidates(accountId: string, query = "", limit = 25) {
  const db = await getDb();
  const search = query.trim().toLowerCase();
  const cap = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.floor(limit))) : 25;
  return db.prepare(`SELECT u.id, u.name, u.email FROM auth_user u JOIN users p ON p.id=u.id
    WHERE NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))
      AND NOT EXISTS (SELECT 1 FROM user_provisioning WHERE userId=u.id AND state NOT IN ('complete','cancelled'))
      AND NOT EXISTS (SELECT 1 FROM user_accounts WHERE userId=u.id AND accountId=?)
      AND NOT EXISTS (SELECT 1 FROM accounts WHERE id=? AND ownerUserId=u.id)
      AND (?='' OR instr(lower(COALESCE(u.name,'')),?)>0 OR instr(lower(u.email),?)>0)
    ORDER BY lower(COALESCE(NULLIF(u.name,''),u.email)), lower(u.email), u.id LIMIT ?`)
    .all(accountId, accountId, search, search, search, cap) as Array<{id: string; name: string | null; email: string}>;
}

/** Resource identifiers only. Better Auth 1.7.12 does not store passkey last-use time. */
export async function listAdminUserPasskeys() {
  const db = await getDb();
  return db.prepare(`SELECT userId,id,name,
    CAST(round((julianday(createdAt)-2440587.5)*86400000) AS INTEGER) AS createdAt
    FROM auth_passkey ORDER BY createdAt,id`).all() as Array<{
      userId: string; id: string; name: string | null; createdAt: number | null;
    }>;
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

/** Domain detach phase; caller validates ownership replacement and owns the transaction. */
export function detachUserDomainRows(db:any,userId:string,reassignOwnerTo?:string) {
  if (reassignOwnerTo) db.prepare(`UPDATE accounts SET ownerUserId=? WHERE ownerUserId=?`).run(reassignOwnerTo,userId);
  const owned=db.prepare(`SELECT COUNT(*) AS count FROM accounts WHERE ownerUserId=?`).get(userId) as {count:number};
  if(owned.count>0)throw new Error(`User ${userId} still owns ${owned.count} mailbox(es)`);
  deleteUserAccountLinkRowsForUser(db,userId);
  deleteUserAccountPrefRowsForUser(db,userId);
  deleteMcpTokenRowsForUser(db,userId);
}

export function deleteUserProfileRow(db:any,userId:string) {
  return changedRows(db.prepare(`DELETE FROM users WHERE id=?`).run(userId))>0;
}

/** @deprecated Domain-only legacy API, retained for storage tests; production must use removeUserLifecycle. */
export async function deleteUser(userId:string,options:{reassignOwnerTo?:string}={}):Promise<boolean> {
  return withDbWriteRetry("deleteUser",async()=>{
    const db=await getDb();
    return db.transaction(()=>{
      detachUserDomainRows(db,userId,options.reassignOwnerTo);
      return deleteUserProfileRow(db,userId);
    }).immediate();
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

/** App-wide personal setting; never changes Better Auth identity/security tables. */
export async function setUserUiLocale(userId: string, uiLocale: UiLocalePreference): Promise<{ uiLocale: UiLocalePreference } | null> {
  if (uiLocale !== null && !isUiLocale(uiLocale)) throw new Error("Invalid UI locale");
  return withDbWriteRetry("setUserUiLocale", async () => {
    const db = await getDb();
    return db.prepare("UPDATE users SET uiLocale=? WHERE id=? RETURNING uiLocale").get(uiLocale, userId) as { uiLocale: UiLocalePreference } | null;
  });
}
