import type { Folder } from "@/lib/data";
import type { FolderSpecialKind } from "@/lib/specialFolders";
import type { UiLocale } from "./config";
import { getTranslator } from "./translator";

const specialUseNames: Readonly<Record<string, FolderSpecialKind>> = {
  "\\inbox": "inbox", "\\sent": "sent", "\\drafts": "drafts",
  "\\trash": "trash", "\\junk": "spam", "\\spam": "spam", "\\archive": "archive"
};
const translators = new Map<UiLocale, ReturnType<typeof getTranslator>>();

/** Display only: never infer a special-use role from a user-created name. */
export function getFolderDisplayName(folder: Pick<Folder, "name" | "specialUse">, locale: UiLocale): string {
  const kind = specialUseNames[(folder.specialUse ?? "").toLowerCase()];
  if (!kind) return folder.name;
  let t = translators.get(locale);
  if (!t) {
    t = getTranslator(locale);
    translators.set(locale, t);
  }
  return t(`Folders.${kind}`);
}

/** Search accepts the displayed label as well as the literal IMAP name. */
export function folderNameMatches(folder: Pick<Folder, "name" | "specialUse">, query: string, locale: UiLocale): boolean {
  return folder.name.toLowerCase().includes(query) || getFolderDisplayName(folder, locale).toLowerCase().includes(query);
}
