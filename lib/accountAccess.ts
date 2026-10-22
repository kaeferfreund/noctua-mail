import type { Account, AccountRole } from "./data";
import { getDb } from "./db/connection";
import { getAccountsForUser } from "./db/accounts";
import { getUsers } from "./db/users";
export type { AccountRole } from "./data";
export { teamFeaturesSupported } from "./teamFeatures";

export { ACCOUNT_ROLE_ORDER, roleAtLeast } from "./accountRole";
import { resolveAccountRoleRow } from "./db/accountAccess";

export async function resolveAccountRole(userId: string, accountId: string): Promise<AccountRole | null> {
  return resolveAccountRoleRow(await getDb(), userId, accountId);
}
export async function listAccountMembers(accountId: string): Promise<Array<{ userId: string; email: string; name: string | null; role: AccountRole; isOwner: boolean; disabled: boolean }>> {
  const db = await getDb();
  const account = db.prepare("SELECT ownerUserId FROM accounts WHERE id=?").get(accountId) as { ownerUserId: string | null } | undefined;
  if (!account) return [];
  const links = db.prepare("SELECT userId,role FROM user_accounts WHERE accountId=?").all(accountId) as { userId: string; role: AccountRole }[];
  const roles = new Map(links.map(l => [l.userId, l.role]));
  if (account.ownerUserId) roles.set(account.ownerUserId, "manager");
  return (await getUsers()).filter(u => roles.has(u.id)).map(u => ({ userId: u.id, email: u.email,
    name: u.name ?? null, role: roles.get(u.id)!, isOwner: account.ownerUserId === u.id, disabled: u.disabled }))
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "en") || a.email.trim().toLowerCase().localeCompare(b.email.trim().toLowerCase(), "en") || a.userId.localeCompare(b.userId, "en"));
}
export async function listAccessibleAccountsForUser(userId: string): Promise<Array<{ account: Account; role: AccountRole; isOwner: boolean; memberCount: number }>> {
  const result = [];
  for (const account of await getAccountsForUser(userId)) {
    const role = await resolveAccountRole(userId, account.id);
    if (role) result.push({ account, role, isOwner: account.ownerUserId === userId, memberCount: (await listAccountMembers(account.id)).length });
  }
  return result.sort((a, b) => (a.account.name || a.account.email).localeCompare(b.account.name || b.account.email, "en") ||
    a.account.email.trim().toLowerCase().localeCompare(b.account.email.trim().toLowerCase(), "en") || a.account.id.localeCompare(b.account.id, "en"));
}
