import { getOwnAddresses } from "../ownAddresses";
import { listSenderIdentityRows } from "./senderIdentities";
import { recordAdminAuditRow } from "./adminAudit";
import { revokeAuthStreams } from "../authStreams";
import type { Account } from "../data";
import { withDbWriteRetry } from "../dbWriteRetry";
import { getMainDbPath } from "../runtimePaths";
import {
  areEquivalentDbPaths,
  cleanupAccountLifecycleArtifacts,
  closeAccountDbConnection,
  getDb
} from "./connection";
import {
  mapAccountRow,
  mergeAccount,
  persistAccountRow,
  resolveAccountDbPathForPersist
} from "./rowParsers";
import { deleteUserAccountPrefRowsForAccount } from "./userAccountPrefs";

// Category-linear-model seeding is lazy-imported because `./categories`
// pulls in `getAccountById` from this module; a top-level import would
// introduce an eager cycle.
async function ensureCategoryLinearModelForAccount(accountId: string) {
  const { getCategoryLinearModel } = await import("./categories");
  await getCategoryLinearModel(accountId);
}

export async function getAccounts() {
  const db = await getDb();
  const rows = db.prepare(`SELECT * FROM accounts`).all() as any[];
  return rows.map((row) => { const account = mapAccountRow(row); return { ...account, ownAddresses: getOwnAddresses(account, listSenderIdentityRows(db, account.id)) }; }) as Account[];
}

export async function getAccountsForUser(userId: string) {
  const db = await getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT a.*
       FROM accounts a
       LEFT JOIN user_accounts ua ON ua.accountId = a.id
       WHERE ua.userId = ? OR a.ownerUserId = ?
       ORDER BY a.id ASC`
    )
    .all(userId, userId) as any[];
  return rows.map((row) => { const account = mapAccountRow(row); return { ...account, ownAddresses: getOwnAddresses(account, listSenderIdentityRows(db, account.id)) }; }) as Account[];
}

export async function saveAccounts(nextAccounts: Account[]) {
  return withDbWriteRetry("saveAccounts", async () => {
    const db = await getDb();
    const existingPaths = new Map<string, string | null>(
      (
        db.prepare(`SELECT id, dbPath FROM accounts`).all() as Array<{
          id: string;
          dbPath?: string | null;
        }>
      ).map((row) => [row.id, row.dbPath ?? null])
    );
    db.transaction(() => {
      db.exec(`DELETE FROM accounts`);
      nextAccounts.forEach((account) => {
        persistAccountRow(db, account, existingPaths.get(account.id));
      });
    }).immediate();
    const newAccountIds = nextAccounts
      .map((account) => account.id)
      .filter((accountId) => !existingPaths.has(accountId));
    await Promise.all(newAccountIds.map((accountId) => ensureCategoryLinearModelForAccount(accountId)));
  });
}

export async function getAccountById(accountId: string) {
  const db = await getDb();
  const row = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(accountId) as any;
  if (!row) return null;
  const account = mapAccountRow(row);
  return { ...account, ownAddresses: getOwnAddresses(account, listSenderIdentityRows(db, accountId)) };
}

/**
 * @internal
 *
 * Lightweight lookup used by thread-signal and message-list queries that need
 * the account's "self" email to distinguish outbound from inbound messages.
 * Not exported from the `@/lib/db` barrel.
 */
export async function getAccountEmail(accountId: string): Promise<string> {
  const db = await getDb();
  const row = db
    .prepare(`SELECT email FROM accounts WHERE id = ?`)
    .get(accountId) as { email?: string | null } | undefined;
  return row?.email?.toLowerCase() ?? "";
}

export async function upsertAccount(account: Account) {
  return withDbWriteRetry("upsertAccount", async () => {
    const db = await getDb();
    const existing = db
      .prepare(`SELECT dbPath FROM accounts WHERE id = ?`)
      .get(account.id) as { dbPath?: string | null } | undefined;
    db.transaction(() => {
      persistAccountRow(db, account, existing?.dbPath ?? null);
    }).immediate();
    if (!existing) {
      await ensureCategoryLinearModelForAccount(account.id);
    }
    return account;
  });
}

export async function patchAccount(accountId: string, payload: Partial<Account>) {
  return withDbWriteRetry("patchAccount", async () => {
    const db = await getDb();
    const row = db.prepare(`SELECT * FROM accounts WHERE id = ?`).get(accountId) as any;
    if (!row) return null;
    const current = mapAccountRow(row);
    const next = mergeAccount(current, payload);
    db.transaction(() => {
      persistAccountRow(db, next, row.dbPath ?? null);
    }).immediate();
    return next;
  });
}

export class AccountDeletionForbiddenError extends Error {
  constructor() { super("Only the owner can delete this mailbox"); }
}

export async function deleteAccountControlPlane(accountId: string, actorUserId?: string) {
  return withDbWriteRetry("deleteAccountControlPlane", async () => {
    const db = await getDb();
    const row = db
      .prepare(`SELECT id, dbPath FROM accounts WHERE id = ?`)
      .get(accountId) as { id?: string; dbPath?: string | null } | undefined;
    if (!row?.id) return false;

    const dbPath = resolveAccountDbPathForPersist(accountId, row.dbPath ?? null);
    const sharedPathRow = db
      .prepare(`SELECT COUNT(*) as count FROM accounts WHERE id <> ? AND dbPath = ?`)
      .get(accountId, dbPath) as { count: number } | undefined;
    const mainDbPath = getMainDbPath();
    const deleteShardFile =
      (sharedPathRow?.count ?? 0) === 0 && !(await areEquivalentDbPaths(dbPath, mainDbPath));

    db.transaction(() => {
      if (actorUserId) {
        const allowed = db.prepare(`SELECT 1 FROM accounts a JOIN auth_user u ON u.id=? JOIN users p ON p.id=u.id
          WHERE a.id=? AND (a.ownerUserId=u.id OR p.role='admin')
          AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))`)
          .get(actorUserId, accountId);
        if (!allowed) throw new AccountDeletionForbiddenError();
      }
      db.prepare(`DELETE FROM user_accounts WHERE accountId = ?`).run(accountId);
      deleteUserAccountPrefRowsForAccount(db, accountId);
      db.prepare(`DELETE FROM mcp_tokens WHERE accountId = ?`).run(accountId);
      db.prepare(`DELETE FROM sender_identities WHERE accountId = ?`).run(accountId);
      db.prepare(`DELETE FROM accounts WHERE id = ?`).run(accountId);
      if (actorUserId) recordAdminAuditRow(db, { actorUserId, action: "account.delete", targetAccountId: accountId });
    }).immediate();

    closeAccountDbConnection(dbPath);

    revokeAuthStreams({ accountId });
    await cleanupAccountLifecycleArtifacts(accountId, dbPath, deleteShardFile);
    return true;
  });
}
