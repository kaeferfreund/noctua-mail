import type { AuthorizedOutboundActor, OutboundWriteAuthorization } from "../outboundAuthorization";
import type { UserAccountPrefs, UserAccountPrefsPatch } from "../data";
import { withDbWriteRetry } from "../dbWriteRetry";
import { getDb } from "./connection";
import { isPlainObject, parseUserAccountPrefs } from "./rowParsers";

// Keys that would reach the prototype chain through plain assignment.
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Sparse deep-merge (§6.4): only keys present in `patch` are written, `null`
 * deletes a key, `undefined` is ignored, and nested objects are merged
 * recursively. Objects left empty by deletions are dropped so the stored
 * value stays sparse. Arrays and primitives replace the stored value.
 */
function applySparsePatch(
  target: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (UNSAFE_KEYS.has(key) || value === undefined) continue;
    if (value === null) {
      delete next[key];
      continue;
    }
    if (isPlainObject(value)) {
      const current = next[key];
      const merged = applySparsePatch(isPlainObject(current) ? current : {}, value);
      if (Object.keys(merged).length === 0) {
        delete next[key];
      } else {
        next[key] = merged;
      }
      continue;
    }
    next[key] = value;
  }
  return next;
}

/** The stored sparse preferences of `userId` for `accountId`; `{}` when none are stored. */
export async function getUserAccountPrefs(
  userId: string,
  accountId: string
): Promise<UserAccountPrefs> {
  const db = await getDb();
  const row = db
    .prepare(`SELECT prefs FROM user_account_prefs WHERE userId = ? AND accountId = ?`)
    .get(userId, accountId) as { prefs?: string | null } | undefined;
  return parseUserAccountPrefs(row?.prefs);
}

/**
 * Applies a sparse patch to the stored preferences and returns the result.
 * Read, merge and write run in one immediate transaction so concurrent
 * patches from two tabs cannot drop each other's keys. The patch must be
 * validated by the caller; this only merges.
 */
export async function mergeUserAccountPrefs(
  userId: string,
  accountId: string,
  patch: UserAccountPrefsPatch,
  beforeWrite?: OutboundWriteAuthorization
): Promise<UserAccountPrefs> {
  return withDbWriteRetry("mergeUserAccountPrefs", async () => {
    const db = await getDb();
    let authorization: AuthorizedOutboundActor | undefined;
    const merge = (): UserAccountPrefs => {
      authorization?.assertCurrent(db);
      if (patch.defaultIdentityId != null && !db.prepare(
        "SELECT 1 FROM sender_identities WHERE id=? AND accountId=? AND enabled=1"
      ).get(patch.defaultIdentityId, accountId)) throw new InvalidAccountPreferencesError();
      const row = db
        .prepare(`SELECT prefs FROM user_account_prefs WHERE userId = ? AND accountId = ?`)
        .get(userId, accountId) as { prefs?: string | null } | undefined;
      const next = applySparsePatch(parseUserAccountPrefs(row?.prefs), patch) as UserAccountPrefs;
      db.prepare(
        `INSERT INTO user_account_prefs (userId, accountId, prefs, updatedAt)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(userId, accountId) DO UPDATE SET
           prefs = excluded.prefs,
           updatedAt = excluded.updatedAt`
      ).run(userId, accountId, JSON.stringify(next), Date.now());
      return next;
    };
    authorization = await beforeWrite?.();
    const merged: UserAccountPrefs = db.transaction(merge).immediate();
    return merged;
  });
}

/** Deletes all preference rows of `userId`. Runs on the caller's connection (user delete). */
export function deleteUserAccountPrefRowsForUser(db: any, userId: string): number {
  const result = db
    .prepare(`DELETE FROM user_account_prefs WHERE userId = ?`)
    .run(userId) as { changes?: number };
  return Number(result?.changes ?? 0);
}

/** Deletes all preference rows for `accountId`. Runs on the caller's connection (mailbox delete). */
export function deleteUserAccountPrefRowsForAccount(db: any, accountId: string): number {
  const result = db
    .prepare(`DELETE FROM user_account_prefs WHERE accountId = ?`)
    .run(accountId) as { changes?: number };
  return Number(result?.changes ?? 0);
}

export async function deleteUserAccountPrefsForUser(userId: string) {
  return withDbWriteRetry("deleteUserAccountPrefsForUser", async () => {
    const db = await getDb();
    return deleteUserAccountPrefRowsForUser(db, userId);
  });
}

export async function deleteUserAccountPrefsForAccount(accountId: string) {
  return withDbWriteRetry("deleteUserAccountPrefsForAccount", async () => {
    const db = await getDb();
    return deleteUserAccountPrefRowsForAccount(db, accountId);
  });
}

export class InvalidAccountPreferencesError extends Error {
  constructor() { super("Choose an enabled identity in this mailbox"); }
}
