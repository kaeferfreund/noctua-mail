/** Shared client/server vocabulary of the domain view („Sammler“). */
import type { Folder } from "@/lib/data";
import {
  findArchiveFolder,
  findDraftsFolder,
  findInboxFolder,
  findJunkFolder,
  findSentFolder,
  findTrashFolder,
  getFolderSpecialKind
} from "@/lib/specialFolders";

/** Special folders the domain view can switch between, in display order. */
export const DOMAIN_FOLDER_ROLES = ["inbox", "sent", "drafts", "archive", "trash", "spam"] as const;
export type DomainFolderRole = (typeof DOMAIN_FOLDER_ROLES)[number];

export function parseDomainFolderRole(value: unknown): DomainFolderRole {
  return typeof value === "string" && (DOMAIN_FOLDER_ROLES as readonly string[]).includes(value)
    ? (value as DomainFolderRole)
    : "inbox";
}

/** Normalised domain key (lower-case, trimmed), or null when it is not a plain domain. */
export function normalizeDomainKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > 253 || !/^[^\s/\\?#@%]+$/.test(trimmed) || !trimmed.includes(".")) return null;
  return trimmed;
}

export function buildDomainThreadsPath(domain: string, params?: URLSearchParams) {
  const base = `/api/domains/${encodeURIComponent(domain)}/threads`;
  const query = params?.toString();
  return query ? `${base}?${query}` : base;
}

const ROLE_FINDERS: Record<DomainFolderRole, (folders: Folder[], accountId: string) => Folder | null | undefined> = {
  inbox: findInboxFolder,
  sent: findSentFolder,
  drafts: findDraftsFolder,
  archive: findArchiveFolder,
  trash: findTrashFolder,
  spam: findJunkFolder
};

/** The folder playing `role` in one mailbox (from its folder list), or null when it has none. */
export function findDomainRoleFolder(folders: Folder[], accountId: string, role: DomainFolderRole): Folder | null {
  return ROLE_FINDERS[role](folders, accountId) ?? null;
}

/** The special role of a folder (inbox, sent, drafts, archive, trash, spam), or null for a custom folder. */
export function domainFolderRoleOf(folder: Pick<Folder, "name" | "specialUse"> | null | undefined): DomainFolderRole | null {
  return getFolderSpecialKind(folder);
}
