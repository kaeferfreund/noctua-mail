/**
 * Mailbox domains („Sammler“): conversations across the mailboxes of one
 * domain and the combined thread list of a domain.
 *
 * Access rule: only mailboxes the signed-in user may open take part. The
 * set is read per request with the same role resolution as opening a
 * mailbox (`readAccountAccess` → `resolveAccountRoleRows`), never cached.
 */
import type { Account, Folder, Message } from "./data";
import { getDb } from "./db/connection";
import { readAccountAccess } from "./accountAccess";
import { mailboxGroupDomain } from "./senderIdentity";
import { getFolderRecords } from "./db/folders";
import { getLoadedDateGroups, listThreads, type GroupMeta } from "./db/messages/query";
import { listLinkedConversationMessages } from "./db/messages/linkedConversation";
import type { ThreadDateSource } from "./threadDate";
import { DOMAIN_FOLDER_ROLES, findDomainRoleFolder, type DomainFolderRole } from "./domainView";

export { DOMAIN_FOLDER_ROLES, type DomainFolderRole };

/** Lower-case mail domain of a mailbox address, as the sidebar groups it. */
export function accountDomain(account: Pick<Account, "email">) {
  return mailboxGroupDomain(account.email);
}

/** Mailboxes of `domain` the user may open, in display order. */
export async function listReadableDomainAccounts(userId: string, domain: string): Promise<Account[]> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return [];
  return readAccountAccess(await getDb(), userId, { identities: false })
    .entries.map((entry) => entry.account)
    .filter((account) => accountDomain(account) === normalized);
}

/**
 * Messages of the conversation `threadId` of `account` that live in other
 * mailboxes of the same domain the user may open (see linkedConversation.ts).
 */
export async function listDomainLinkedMessages(params: {
  userId: string;
  account: Account;
  threadId: string;
  excludeFolderIds?: string[];
  groupBy?: string;
  threadDateSource?: ThreadDateSource;
}): Promise<Message[]> {
  const domain = accountDomain(params.account);
  if (!domain) return [];
  const peers = (await listReadableDomainAccounts(params.userId, domain)).filter(
    (account) => account.id !== params.account.id
  );
  if (peers.length === 0) return [];
  return listLinkedConversationMessages({
    accountId: params.account.id,
    threadId: params.threadId,
    peerAccountIds: peers.map((account) => account.id),
    excludeFolderIds: params.excludeFolderIds,
    groupBy: params.groupBy,
    threadDateSource: params.threadDateSource
  });
}

/** The folder playing `role` in one mailbox, or null when it has none. */
export async function resolveDomainRoleFolder(accountId: string, role: DomainFolderRole) {
  return findDomainRoleFolder(await getFolderRecords(accountId), accountId, role);
}

/**
 * Trash and spam folders of one mailbox, which a conversation leaves out (as
 * `isThreadExcludedFolder`: by special use only). For a reader that does not
 * hold this mailbox's folder list, e.g. a domain view row of another mailbox.
 */
export async function threadExcludedFolderIds(accountId: string) {
  return (await getFolderRecords(accountId))
    .filter((folder) => ["\\trash", "\\junk", "\\spam"].includes((folder.specialUse ?? "").toLowerCase()))
    .map((folder) => folder.id);
}

const threadSortValue = (item: Message) => item.threadSortDateValue ?? item.dateValue;

/**
 * One thread list across mailboxes: each mailbox's own list of the role
 * folder, merged newest first. One conversation is listed once:
 * - a row that is the same message in two mailboxes (equal row id, i.e. equal
 *   Message-ID) is kept for the first mailbox in display order;
 * - a thread id listed by several mailboxes is kept for the mailbox with its
 *   newest message (the reader merges the other mailboxes' messages, see
 *   listDomainLinkedMessages), so the list never groups rows of two mailboxes.
 * Paging reads the first `page * pageSize` threads of every mailbox, so deep
 * pages cost more than in one mailbox.
 */
export async function listDomainThreads(params: {
  accounts: readonly Account[];
  role: DomainFolderRole;
  page: number;
  pageSize: number;
  groupBy?: string;
  threadDateSource?: ThreadDateSource;
  query?: string | null;
  fields?: string[];
  viewerUserId: string;
}) {
  const page = Math.max(1, Math.trunc(params.page) || 1);
  const pageSize = Math.max(1, Math.trunc(params.pageSize) || 1);
  const groupBy = params.groupBy ?? "date";
  const perAccount = await Promise.all(
    params.accounts.map(async (account) => {
      const folder = await resolveDomainRoleFolder(account.id, params.role);
      if (!folder) return null;
      const data = await listThreads({
        accountId: account.id,
        folderId: folder.id,
        page: 1,
        pageSize: page * pageSize,
        groupBy,
        threadDateSource: params.threadDateSource,
        query: params.query,
        fields: params.fields,
        viewerUserId: params.viewerUserId
      });
      return { account, folder, data };
    })
  );
  const results = perAccount.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const seen = new Set<string>();
  const rows: Message[] = [];
  for (const { data } of results) {
    for (const item of data.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      rows.push(item);
    }
  }
  const threadOwner = new Map<string, Message>();
  for (const item of rows) {
    const owner = threadOwner.get(item.threadId);
    if (!owner || threadSortValue(item) > threadSortValue(owner)) threadOwner.set(item.threadId, item);
  }
  const merged = rows.filter((item) => threadOwner.get(item.threadId)?.accountId === item.accountId);
  merged.sort((a, b) => threadSortValue(b) - threadSortValue(a) || b.dateValue - a.dateValue || a.id.localeCompare(b.id));
  const offset = (page - 1) * pageSize;
  const items = merged.slice(offset, offset + pageSize);
  const total = results.reduce((sum, { data }) => sum + (data.total ?? 0), 0);
  const baseCount = results.reduce((sum, { data }) => sum + (data.baseCount ?? 0), 0);
  const hasMore = merged.length > offset + pageSize || results.some(({ data }) => data.hasMore);
  let groups: GroupMeta[];
  if (groupBy === "date") {
    groups = getLoadedDateGroups(items);
  } else {
    const counts = new Map<string, GroupMeta>();
    for (const { data } of results) {
      for (const group of data.groups ?? []) {
        const existing = counts.get(group.key);
        counts.set(group.key, existing ? { ...existing, count: existing.count + group.count } : { ...group });
      }
    }
    groups = Array.from(counts.values());
  }
  return {
    items,
    groups,
    total,
    baseCount,
    hasMore,
    folders: results.map(({ account, folder }) => ({ accountId: account.id, folderId: folder.id }))
  };
}
