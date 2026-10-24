import type { UiLocale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/translator";
import type { Folder } from "@/lib/data";
import { getFolderSpecialKind, isDraftsFolderRecord, type FolderSpecialKind } from "@/lib/specialFolders";

export function getFolderBadgeLabel(
  folder: Pick<Folder, "name" | "specialUse"> | null | undefined,
  fallbackName: string
): string {
  if (getFolderSpecialKind(folder)) return "";
  const name = folder?.name?.trim();
  return name || fallbackName;
}

export function getFolderBadgeKind(
  folder: Pick<Folder, "name" | "specialUse"> | null | undefined
): FolderSpecialKind | "folder" {
  return getFolderSpecialKind(folder) ?? "folder";
}

export function getFolderCountTitle(
  folderPath: string,
  totalCount: number,
  unreadCount: number,
  locale: UiLocale = "de"
): string {
  const normalizedTotalCount = Math.max(0, totalCount);
  const normalizedUnreadCount = Math.max(0, unreadCount);

  return getTranslator(locale)("List.folderCountTitle", { path: folderPath, total: normalizedTotalCount, unread: normalizedUnreadCount });
}

/**
 * The number next to a folder in the tree: unread mail, except for Drafts,
 * where the total is what matters (the same number as the pinned "Drafts"
 * entry; seeded or imported drafts may lack \\Seen).
 */
export function getFolderTreeCount(
  folder: Pick<Folder, "specialUse" | "count" | "unreadCount">
): { kind: "unread" | "drafts"; count: number } {
  if (isDraftsFolderRecord(folder)) return { kind: "drafts", count: Math.max(0, folder.count ?? 0) };
  return { kind: "unread", count: Math.max(0, folder.unreadCount ?? 0) };
}
