import type { AccountRole } from "../data";

const RESOLVABLE_ROLES: readonly string[] = ["viewer", "editor", "manager"];

/** One eligibility definition for the single and the batched role read; parameters: userId, userId, account predicate. */
function accountRoleSql(accountPredicate: string) {
  return `SELECT a.id AS accountId, CASE WHEN a.ownerUserId=? THEN 'manager' ELSE ua.role END AS role
    FROM accounts a JOIN users p ON p.id=? JOIN auth_user u ON u.id=p.id
    LEFT JOIN user_accounts ua ON ua.accountId=a.id AND ua.userId=p.id
    WHERE ${accountPredicate} AND (a.ownerUserId=p.id OR ua.userId IS NOT NULL)
      AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))
      AND NOT EXISTS (SELECT 1 FROM user_provisioning WHERE userId=p.id AND state NOT IN ('complete','cancelled'))`;
}
const ROLE_SQL = accountRoleSql("a.id=?");
const ROLES_SQL = accountRoleSql("a.id IN (SELECT value FROM json_each(?))");

/** Synchronous core for authorization rechecks inside master transactions. */
export function resolveAccountRoleRow(db: any, userId: string, accountId: string): AccountRole | null {
  const row = db.query(ROLE_SQL).get(userId, userId, accountId) as { role: AccountRole } | undefined;
  return row && RESOLVABLE_ROLES.includes(row.role) ? row.role : null;
}

/** Batched `resolveAccountRoleRow`: one statement, same eligibility; accounts without a role are absent. */
export function resolveAccountRoleRows(db: any, userId: string, accountIds: readonly string[]): Map<string, AccountRole> {
  const roles = new Map<string, AccountRole>();
  if (!accountIds.length) return roles;
  for (const row of db.query(ROLES_SQL).all(userId, userId, JSON.stringify(accountIds)) as Array<{ accountId: string; role: AccountRole }>) {
    if (RESOLVABLE_ROLES.includes(row.role)) roles.set(row.accountId, row.role);
  }
  return roles;
}
