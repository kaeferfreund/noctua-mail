import { randomUUID } from "crypto";
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

/** Auth fields for the login path. Only ever used server-side. */
export type UserAuthRecord = {
  id: string;
  role: UserRole;
  passwordHash: string | null;
  disabledAt: number | null;
  mustChangePassword: boolean;
};

/** What every session guard re-checks per request (§4.1). */
export type UserLiveness = {
  disabledAt: number | null;
  /** Unix seconds; sessions with `iat` below it are invalid. */
  passwordUpdatedAt: number | null;
  mustChangePassword: boolean;
  role: UserRole;
};

export type NewUser = {
  /** Defaults to a random UUID. */
  id?: string;
  email: string;
  role: UserRole;
  name?: string | null;
  /** argon2id hash from `hashPassword`; omit for a legacy (IMAP login) user. */
  passwordHash?: string | null;
  mustChangePassword?: boolean;
  /** Unix milliseconds; defaults to now. */
  createdAt?: number;
};

/** Thrown by `insertUser` when the e-mail is already taken. Routes answer 409. */
export class DuplicateUserEmailError extends Error {
  readonly email: string;

  constructor(email: string) {
    super("A user with this email address already exists");
    this.name = "DuplicateUserEmailError";
    this.email = email;
  }
}

/** `users.email` is stored, compared and looked up lowercased and trimmed (§3.1). */
export function normalizeUserEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeUserName(name: string | null | undefined) {
  const trimmed = name?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

function assertUserRole(role: string): asserts role is UserRole {
  if (role !== "admin" && role !== "user") {
    throw new Error(`Invalid user role: ${role}`);
  }
}

function assertAccountRole(role: string): asserts role is AccountRole {
  if (!isAccountRole(role)) {
    throw new Error(`Invalid mailbox role: ${role}`);
  }
}

function changedRows(result: unknown) {
  return Number((result as { changes?: number } | undefined)?.changes ?? 0);
}

function isUserEmailUniqueViolation(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const message = error instanceof Error ? error.message : "";
  return (
    code === "SQLITE_CONSTRAINT_UNIQUE" &&
    (message.includes("users.email") || message.includes("idx_users_email_lower"))
  );
}

function readUserById(db: any, userId: string): User | null {
  const row = db.prepare(`SELECT ${USER_ROW_SELECT} FROM users WHERE id = ?`).get(userId) as
    | StoredUserRow
    | undefined;
  return row ? mapUserRow(row) : null;
}

export async function getUsers() {
  const db = await getDb();
  const rows = db
    .prepare(`SELECT ${USER_ROW_SELECT} FROM users ORDER BY createdAt ASC, id ASC`)
    .all() as StoredUserRow[];
  return rows.map(mapUserRow);
}

export async function getUserById(userId: string) {
  const db = await getDb();
  return readUserById(db, userId);
}

/**
 * Login lookup by e-mail through the `lower(email)` index. While case-variant
 * duplicates from before the e-mail normalisation exist (see
 * `normalizeUserEmails` in schema.ts), the row already stored in normalised
 * form wins, then the oldest one.
 */
export async function getUserAuthByEmail(email: string): Promise<UserAuthRecord | null> {
  const normalized = normalizeUserEmail(email);
  if (!normalized) return null;
  const db = await getDb();
  const row = db
    .prepare(
      `SELECT id, role, passwordHash, disabledAt, mustChangePassword
       FROM users
       WHERE lower(email) = ?
       ORDER BY (email = ?) DESC, createdAt ASC, id ASC
       LIMIT 1`
    )
    .get(normalized, normalized) as
    | {
        id: string;
        role?: string | null;
        passwordHash?: string | null;
        disabledAt?: number | null;
        mustChangePassword?: number | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    role: row.role === "admin" ? "admin" : "user",
    passwordHash: row.passwordHash ? String(row.passwordHash) : null,
    disabledAt: row.disabledAt == null ? null : Number(row.disabledAt),
    mustChangePassword: Boolean(Number(row.mustChangePassword ?? 0))
  };
}

/** One primary-key SELECT, no caching: revocation must take effect on the next request. */
export async function getUserLiveness(userId: string): Promise<UserLiveness | null> {
  const db = await getDb();
  const row = db
    .prepare(
      `SELECT disabledAt, passwordUpdatedAt, mustChangePassword, role
       FROM users
       WHERE id = ?`
    )
    .get(userId) as
    | {
        disabledAt?: number | null;
        passwordUpdatedAt?: number | null;
        mustChangePassword?: number | null;
        role?: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    disabledAt: row.disabledAt == null ? null : Number(row.disabledAt),
    passwordUpdatedAt: row.passwordUpdatedAt == null ? null : Number(row.passwordUpdatedAt),
    mustChangePassword: Boolean(Number(row.mustChangePassword ?? 0)),
    role: row.role === "admin" ? "admin" : "user"
  };
}

/**
 * Synchronous core of `insertUser` for callers that compose one transaction
 * on the master connection (signup). Must run inside an immediate
 * transaction so the duplicate check and the insert are one unit.
 *
 * The duplicate check compares `lower(trim(email))` rather than relying on
 * the unique index alone: the index is only unique once no legacy
 * case-variant duplicates remain (§3.1), and until then this check is what
 * enforces uniqueness.
 */
export function insertUserRow(db: any, input: NewUser): User {
  const email = normalizeUserEmail(input.email);
  if (!email) {
    throw new Error("User e-mail is required");
  }
  assertUserRole(input.role);
  const taken = db.prepare(`SELECT 1 FROM users WHERE lower(trim(email)) = ? LIMIT 1`).get(email);
  if (taken) {
    throw new DuplicateUserEmailError(email);
  }
  const id = input.id ?? randomUUID();
  const createdAt = input.createdAt ?? Date.now();
  const passwordHash = input.passwordHash ? input.passwordHash : null;
  try {
    db.prepare(
      `INSERT INTO users
       (id, email, name, role, createdAt, passwordHash, passwordUpdatedAt, mustChangePassword, disabledAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    ).run(
      id,
      email,
      normalizeUserName(input.name),
      input.role,
      createdAt,
      passwordHash,
      passwordHash ? nowUnixSeconds() : null,
      input.mustChangePassword ? 1 : 0
    );
  } catch (error) {
    if (isUserEmailUniqueViolation(error)) {
      throw new DuplicateUserEmailError(email);
    }
    throw error;
  }
  const user = readUserById(db, id);
  if (!user) {
    throw new Error(`User ${id} vanished right after insert`);
  }
  return user;
}

/**
 * Inserts one user. Throws `DuplicateUserEmailError` when another user
 * already has the (normalised) e-mail address.
 */
export async function insertUser(input: NewUser): Promise<User> {
  return withDbWriteRetry("insertUser", async () => {
    const db = await getDb();
    const user: User = db.transaction(() => insertUserRow(db, input)).immediate();
    return user;
  });
}

/**
 * Stores a new password hash and bumps `passwordUpdatedAt`, which
 * invalidates every session and token issued before it (§4.1). Pass the
 * `iat` of the cookie the caller is about to issue as `passwordUpdatedAt` so
 * the caller's own new session is never older than the change. Returns
 * false when the user does not exist.
 */
export async function updateUserPassword(
  userId: string,
  passwordHash: string,
  options: { mustChangePassword: boolean; passwordUpdatedAt?: number }
): Promise<boolean> {
  if (!passwordHash) {
    throw new Error("Password hash is required");
  }
  return withDbWriteRetry("updateUserPassword", async () => {
    const db = await getDb();
    const result = db
      .prepare(
        `UPDATE users
         SET passwordHash = ?, passwordUpdatedAt = ?, mustChangePassword = ?
         WHERE id = ?`
      )
      .run(
        passwordHash,
        options.passwordUpdatedAt ?? nowUnixSeconds(),
        options.mustChangePassword ? 1 : 0,
        userId
      );
    return changedRows(result) > 0;
  });
}

/**
 * Updates the present fields only; `name: null` or a blank name clears it.
 * Returns the updated user, or null when the user does not exist.
 */
export async function updateUserProfile(
  userId: string,
  patch: { name?: string | null; role?: UserRole }
): Promise<User | null> {
  const assignments: string[] = [];
  const args: Array<string | null> = [];
  if (patch.name !== undefined) {
    assignments.push("name = ?");
    args.push(normalizeUserName(patch.name));
  }
  if (patch.role !== undefined) {
    assertUserRole(patch.role);
    assignments.push("role = ?");
    args.push(patch.role);
  }
  return withDbWriteRetry("updateUserProfile", async () => {
    const db = await getDb();
    if (assignments.length > 0) {
      db.prepare(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?`).run(...args, userId);
    }
    return readUserById(db, userId);
  });
}

/**
 * Disables (keeping the first `disabledAt`, unix milliseconds) or re-enables
 * a user. Returns the updated user, or null when the user does not exist.
 */
export async function setUserDisabled(userId: string, disabled: boolean): Promise<User | null> {
  return withDbWriteRetry("setUserDisabled", async () => {
    const db = await getDb();
    db.prepare(
      `UPDATE users
       SET disabledAt = CASE WHEN ? THEN COALESCE(disabledAt, ?) ELSE NULL END
       WHERE id = ?`
    ).run(disabled ? 1 : 0, Date.now(), userId);
    return readUserById(db, userId);
  });
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
