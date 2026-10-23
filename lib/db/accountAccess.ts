import type { AccountRole } from "../data";

/** Synchronous core for authorization rechecks inside master transactions. */
export function resolveAccountRoleRow(db: any, userId: string, accountId: string): AccountRole | null {
  const row = db.query(`SELECT CASE WHEN a.ownerUserId=? THEN 'manager' ELSE ua.role END AS role
    FROM accounts a JOIN users p ON p.id=? JOIN auth_user u ON u.id=p.id
    LEFT JOIN user_accounts ua ON ua.accountId=a.id AND ua.userId=p.id
    WHERE a.id=? AND (a.ownerUserId=p.id OR ua.userId IS NOT NULL)
      AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now')))
      AND NOT EXISTS (SELECT 1 FROM user_provisioning WHERE userId=p.id AND state NOT IN ('complete','cancelled'))`)
    .get(userId, userId, accountId) as { role: AccountRole } | undefined;
  return row && ["viewer", "editor", "manager"].includes(row.role) ? row.role : null;
}
