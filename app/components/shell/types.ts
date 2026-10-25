import type { ReactNode } from "react";
import type { Account } from "@/lib/data";

/**
 * Membership fields that feat/team-auth adds to `Account` (design §5.3:
 * `accessRole`, `isOwner`, `shared`). They are not on `Account` in this
 * branch yet, so the shell reads them as optional through this alias.
 * Remove the alias at integration, once `Account` carries the fields.
 */
export type AccountAccessFields = {
  accessRole?: "viewer" | "editor" | "manager";
  isOwner?: boolean;
  shared?: boolean;
};

export type ShellAccount = Account & AccountAccessFields;

/**
 * One row of the sidebar "Views" section. The count fields mirror the
 * virtual folder presentation MailClient already computes (label, aria
 * label and title are optional refinements of the plain count).
 */
export type ShellView = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  count?: number | null;
  countLabel?: string;
  countAriaLabel?: string;
  countTitle?: string;
  rowTitle?: string;
  emphasize?: boolean;
  icon: ReactNode;
  onSelect: () => void;
};

/**
 * The "Views" section in display order (design §7.2): Inbox, the
 * collaboration views, then the existing virtual folders.
 */
export type ShellViews = {
  /** Null while the account has no inbox folder (e.g. before folders load). */
  inbox: ShellView | null;
  /**
   * Slot for the collaboration views "Assigned to me", "Unassigned" and
   * "Open" that feat/collab-ui adds (design §6.2 virtual folders). Rendered
   * between Inbox and the virtual folders; empty in this branch.
   */
  collab: ShellView[];
  /** Focused, Action queue, Invite deck with their counts. */
  virtual: ShellView[];
};

/** The accessible mailboxes in sidebar order: name, then e-mail and id. */
export function sortMailboxes(accounts: readonly ShellAccount[]): ShellAccount[] {
  return [...accounts].sort((a, b) =>
    mailboxLabel(a).localeCompare(mailboxLabel(b), "en", { sensitivity: "base" }) ||
    a.email.localeCompare(b.email) || a.id.localeCompare(b.id));
}

/** Up to two initials for the mailbox avatar, from the name or the e-mail. */
export function mailboxInitials(account: Pick<Account, "name" | "email">): string {
  const name = account.name.trim();
  if (name) {
    const words = name.split(/\s+/).filter(Boolean);
    const initials = words.length >= 2 ? `${words[0][0]}${words[words.length - 1][0]}` : name.slice(0, 2);
    return initials.toUpperCase();
  }
  const localPart = account.email.trim().split("@")[0] ?? "";
  return localPart.slice(0, 2).toUpperCase() || "?";
}

/** The mailbox's custom avatar when it is an image URL; other stored values
 * (e.g. the literal initials "NW") count as no avatar. */
export function mailboxAvatarUrl(account: Pick<Account, "avatar">): string | null {
  const avatar = account.avatar?.trim() ?? "";
  return /^(https?:\/\/|\/|data:image\/)/i.test(avatar) ? avatar : null;
}

export function mailboxLabel(account: Pick<Account, "name" | "email">): string {
  return account.name.trim() || account.email;
}

/** Sections with at least this many mailboxes are grouped by domain. */
export const MAILBOX_GROUPING_MIN = 7;

/** Group long mailbox sections by domain, preserving name order within each group. */
export function groupMailboxes(accounts: readonly ShellAccount[]): Array<{
  domain: string | null;
  accounts: ShellAccount[];
}> {
  if (accounts.length < MAILBOX_GROUPING_MIN) return [{ domain: null, accounts: [...accounts] }];
  const groups = new Map<string | null, ShellAccount[]>();
  for (const account of accounts) {
    const domain = account.email.trim().split("@")[1]?.toLowerCase() || null;
    const group = groups.get(domain) ?? [];
    group.push(account);
    groups.set(domain, group);
  }
  return [...groups].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b))).map(([domain, rows]) => ({ domain, accounts: rows }));
}
