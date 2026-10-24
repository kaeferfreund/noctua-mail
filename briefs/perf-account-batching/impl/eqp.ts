import { dbModulePromise } from "@/lib/testDbHarness";
import { getDb } from "@/lib/db/connection";
await dbModulePromise; await (await import("@/lib/testAuthHarness")).getSharedTestAuthHarness();
const db = await getDb();
const sqls: Record<string, [string, unknown[]]> = {
  candidatesScoped: [`SELECT DISTINCT a.* FROM accounts a LEFT JOIN user_accounts ua ON ua.accountId = a.id WHERE (ua.userId = ? OR a.ownerUserId = ?) AND a.id IN (SELECT value FROM json_each(?)) ORDER BY a.id ASC`, ["u","u","[\"x\"]"]],
  candidates: [`SELECT DISTINCT a.* FROM accounts a LEFT JOIN user_accounts ua ON ua.accountId = a.id WHERE (ua.userId = ? OR a.ownerUserId = ?) ORDER BY a.id ASC`, ["u","u"]],
  roles: [`SELECT a.id AS accountId, CASE WHEN a.ownerUserId=? THEN 'manager' ELSE ua.role END AS role FROM accounts a JOIN users p ON p.id=? JOIN auth_user u ON u.id=p.id LEFT JOIN user_accounts ua ON ua.accountId=a.id AND ua.userId=p.id WHERE a.id IN (SELECT value FROM json_each(?)) AND (a.ownerUserId=p.id OR ua.userId IS NOT NULL) AND NOT (COALESCE(u.banned,0)=1 AND (u.banExpires IS NULL OR julianday(u.banExpires)>julianday('now'))) AND NOT EXISTS (SELECT 1 FROM user_provisioning WHERE userId=p.id AND state NOT IN ('complete','cancelled'))`, ["u","u","[\"x\"]"]],
  counts: [`SELECT m.accountId AS accountId, COUNT(*) AS memberCount FROM (SELECT accountId, userId FROM user_accounts WHERE accountId IN (SELECT value FROM json_each(?1)) UNION SELECT id, ownerUserId FROM accounts WHERE id IN (SELECT value FROM json_each(?1)) AND ownerUserId IS NOT NULL) m JOIN users p ON p.id=m.userId JOIN auth_user u ON u.id=p.id GROUP BY m.accountId`, ["[\"x\"]"]],
  identities: [`SELECT * FROM sender_identities WHERE accountId IN (SELECT value FROM json_each(?)) ORDER BY accountId, isDefault DESC, email COLLATE NOCASE, id`, ["[\"x\"]"]],
  members: [`SELECT p.id, ua.role AS linkRole FROM users p JOIN auth_user u ON u.id=p.id LEFT JOIN user_accounts ua ON ua.accountId=?1 AND ua.userId=p.id WHERE p.id IN (SELECT userId FROM user_accounts WHERE accountId=?1 UNION SELECT ?2)`, ["x","y"]],
};
for (const [name, [sql, args]] of Object.entries(sqls)) {
  console.log("==", name);
  for (const row of db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(args as any[])) as any[]) console.log("  ", row.detail);
}
process.exit(0);
