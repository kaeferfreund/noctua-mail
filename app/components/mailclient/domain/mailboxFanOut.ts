import { roleAtLeast } from "@/lib/accountRole";
import type { AccountRole, Folder, Message } from "@/lib/data";
import { domainFolderRoleOf, findDomainRoleFolder } from "@/lib/domainView";

/**
 * Actions on messages of several mailboxes (the domain view, „Sammler“): each
 * message is changed in its own mailbox, through that mailbox's routes, which
 * the server authorises one by one. The client's knowledge of roles only
 * decides what to skip up front and how to word the notice; a 403 from the
 * server is counted the same way.
 */

export type MailboxMessageRef = Pick<Message, "id" | "accountId">;

/** The action named in a notice about skipped messages. */
export type MailboxAction =
  | "delete"
  | "archive"
  | "move"
  | "markRead"
  | "markUnread"
  | "flag"
  | "unflag"
  | "todo"
  | "untodo"
  | "spam"
  | "notSpam"
  | "topic"
  | "copyAccount"
  | "moveAccount"
  | "answered"
  | "unanswered"
  | "done"
  | "category";

/** Why messages were left out: no permission, or no matching folder in their mailbox. */
export type MailboxSkipReason = "permission" | "noFolder";

export type MailboxSkipReport = {
  action: MailboxAction;
  /** Messages the action was asked for. */
  total: number;
  /** Messages left out, with the reason per message. */
  skipped: Array<MailboxMessageRef & { reason: MailboxSkipReason }>;
};

export type ReportMailboxSkips = (report: MailboxSkipReport) => void;

/** Whether the signed-in user may change messages of a mailbox. */
export type CanEditMailbox = (accountId: string) => boolean;

/** Messages may be changed with editor rights; an unknown role is left to the server. */
export function canEditWithRole(role: AccountRole | null | undefined) {
  return role ? roleAtLeast(role, "editor") : true;
}

/** Groups items by mailbox, in first-seen order. */
export function groupByAccount<T extends { accountId: string }>(
  items: readonly T[],
  fallbackAccountId = ""
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const accountId = item.accountId || fallbackAccountId;
    const list = groups.get(accountId);
    if (list) list.push(item);
    else groups.set(accountId, [item]);
  }
  return groups;
}

/** Splits items into those of mailboxes the user may change and the rest. */
export function partitionByPermission<T extends { accountId: string }>(
  items: readonly T[],
  canEdit: CanEditMailbox
): { allowed: T[]; denied: T[] } {
  const allowed: T[] = [];
  const denied: T[] = [];
  for (const item of items) {
    (canEdit(item.accountId) ? allowed : denied).push(item);
  }
  return { allowed, denied };
}

/** The skipped messages of one report, grouped per reason, with the mailboxes concerned. */
export function summarizeMailboxSkips(report: MailboxSkipReport) {
  const byReason = new Map<MailboxSkipReason, { count: number; accountIds: string[] }>();
  const seen = new Set<string>();
  for (const item of report.skipped) {
    const key = `${item.accountId}\u0000${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = byReason.get(item.reason) ?? { count: 0, accountIds: [] };
    entry.count += 1;
    if (!entry.accountIds.includes(item.accountId)) entry.accountIds.push(item.accountId);
    byReason.set(item.reason, entry);
  }
  const skippedCount = seen.size;
  const total = Math.max(report.total, skippedCount);
  return {
    total,
    skippedCount,
    doneCount: total - skippedCount,
    reasons: Array.from(byReason, ([reason, entry]) => ({ reason, ...entry }))
  };
}

/**
 * Where a message of another mailbox goes when the destination folder belongs
 * to one mailbox: the same special folder (inbox, archive, trash, …) of its own
 * mailbox, or nothing for a custom folder, which has no equivalent elsewhere.
 */
export function resolveEquivalentFolderId(params: {
  destination: Pick<Folder, "id" | "accountId" | "name" | "specialUse">;
  accountId: string;
  accountFolders: Folder[];
}): string | null {
  const { destination, accountId, accountFolders } = params;
  if (destination.accountId === accountId) return destination.id;
  const role = domainFolderRoleOf(destination);
  if (!role) return null;
  return findDomainRoleFolder(accountFolders, accountId, role)?.id ?? null;
}

/** The one mailbox all items lie in, or null for a mixed or empty selection. */
export function singleAccountOf(items: readonly { accountId: string }[]): string | null {
  const first = items[0]?.accountId;
  if (!first) return null;
  return items.every((item) => item.accountId === first) ? first : null;
}
