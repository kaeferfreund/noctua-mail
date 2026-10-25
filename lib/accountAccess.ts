import type { Account, AccountRole } from "./data";
import { getDb } from "./db/connection";
import { readAccountRowsForUser, withOwnAddresses } from "./db/accounts";
import { countAccountMembers, readAccountMemberRows } from "./db/users";
import { compareDisplayOrder } from "./accountPresentation";
export type { AccountRole } from "./data";
export { teamFeaturesSupported } from "./teamFeatures";

export { ACCOUNT_ROLE_ORDER, roleAtLeast } from "./accountRole";
import { resolveAccountRoleRow, resolveAccountRoleRows } from "./db/accountAccess";

export type AccountAccessEntry = { account: Account; role: AccountRole; isOwner: boolean; memberCount: number };
/** One request's access read. A plain value: never cache it across requests, streams or sessions. */
export type AccountAccessSnapshot = { candidateIds: string[]; entries: AccountAccessEntry[] };

/**
 * Batched access metadata: candidates, roles, member counts, then (optionally) own addresses.
 * Autocommit reads without a snapshot transaction, so the role read sees revocations committed
 * after the candidate read, as the per-account reads did. Scope only narrows the candidates.
 */
export function readAccountAccess(db: any, userId: string, options: { scope?: readonly string[]; identities: boolean }): AccountAccessSnapshot {
  const candidates = readAccountRowsForUser(db, userId, options.scope);
  const roles = resolveAccountRoleRows(db, userId, candidates.map(account => account.id));
  const visible = candidates.filter(account => roles.has(account.id));
  const memberCounts = countAccountMembers(db, visible.map(account => account.id));
  const accounts = options.identities ? withOwnAddresses(db, visible) : visible;
  return { candidateIds: candidates.map(account => account.id), entries: accounts.map(account => ({ account, role: roles.get(account.id)!,
    isOwner: account.ownerUserId === userId, memberCount: memberCounts.get(account.id) ?? 0 }))
    .sort((a, b) => compareDisplayOrder(a.account, b.account)) };
}

export async function resolveAccountRole(userId: string, accountId: string): Promise<AccountRole | null> {
  return resolveAccountRoleRow(await getDb(), userId, accountId);
}
export async function listAccountMembers(accountId: string): Promise<Array<{ userId: string; email: string; name: string | null; role: AccountRole; isOwner: boolean; disabled: boolean }>> {
  const db = await getDb();
  const account = db.prepare("SELECT ownerUserId FROM accounts WHERE id=?").get(accountId) as { ownerUserId: string | null } | undefined;
  if (!account) return [];
  // Raw link roles are returned as stored; only role resolution drops unknown strings.
  return readAccountMemberRows(db, accountId, account.ownerUserId).map(({ user: u, linkRole }) => ({ userId: u.id, email: u.email,
    name: u.name ?? null, role: (account.ownerUserId === u.id ? "manager" : linkRole) as AccountRole, isOwner: account.ownerUserId === u.id, disabled: u.disabled }))
    .sort((a, b) => compareDisplayOrder({ name: a.name, email: a.email, id: a.userId }, { name: b.name, email: b.email, id: b.userId }));
}
/** Public member DTO follows the authenticated mailbox role. */
export async function listAccountMembersForRole(accountId: string, role: AccountRole) {
  const members = await listAccountMembers(accountId);
  return role === "manager" ? members : members.filter(member => !member.disabled).map(({ disabled, ...member }) => { void disabled; return member; });
}
/** Addresses of the mailboxes the user can open (no identity join). */
export async function listAccessibleAccountEmails(userId: string): Promise<string[]> {
  return readAccountAccess(await getDb(), userId, { identities: false }).entries.map(entry => entry.account.email);
}
export async function listAccessibleAccountsForUser(userId: string): Promise<AccountAccessEntry[]> {
  return readAccountAccess(await getDb(), userId, { identities: true }).entries;
}
/**
 * The mailboxes the user is a member of (owner or any role), with own addresses. Admin views and
 * admin routes are limited to these: administrators manage only mailboxes they are a member of.
 */
export async function listMemberAccounts(userId: string): Promise<Account[]> {
  return (await listAccessibleAccountsForUser(userId)).map(entry => entry.account);
}
/** Ids of `listMemberAccounts`, without the identity join. */
export async function listMemberAccountIds(userId: string): Promise<Set<string>> {
  return new Set(readAccountAccess(await getDb(), userId, { identities: false }).entries.map(entry => entry.account.id));
}
