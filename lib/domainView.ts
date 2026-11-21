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

/** The role folders a domain list response names, with the role they play (role null: not a domain list). */
export type DomainRoleFolders = { role: DomainFolderRole | null; folderIds: string[] };

export const NO_DOMAIN_ROLE_FOLDERS: DomainRoleFolders = { role: null, folderIds: [] };

/** Reads `role` and `folders` of a list response; ids are only kept together with the role they came with. */
export function readDomainRoleFolders(
  data: { role?: unknown; folders?: Array<{ folderId?: unknown }> } | null | undefined
): DomainRoleFolders {
  const role = typeof data?.role === "string" && (DOMAIN_FOLDER_ROLES as readonly string[]).includes(data.role)
    ? (data.role as DomainFolderRole)
    : null;
  const folderIds = Array.isArray(data?.folders)
    ? data.folders.map((entry) => entry?.folderId).filter((id): id is string => typeof id === "string")
    : [];
  return role || folderIds.length > 0 ? { role, folderIds } : NO_DOMAIN_ROLE_FOLDERS;
}

/**
 * Folder ids a domain list response proves to be Sent or Drafts folders (the
 * server resolves them with the same finders as `collectRecipientListFolderIds`).
 * Ids of any other role add nothing, so a response still on screen from the
 * previous role (e.g. Inbox while Sent loads) never marks its folders.
 */
export function domainRecipientListFolderIds(roleFolders: DomainRoleFolders): readonly string[] {
  return roleFolders.role === "sent" || roleFolders.role === "drafts" ? roleFolders.folderIds : [];
}
