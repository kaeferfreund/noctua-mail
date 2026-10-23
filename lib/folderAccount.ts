import type { Folder } from "./data";

export class FolderAccountMismatchError extends Error {
  readonly code = "folder_account_mismatch";

  constructor() {
    super("folder_account_mismatch");
    this.name = "FolderAccountMismatchError";
  }
}

export function folderIdBelongsToAccount(accountId: string, folderId: unknown): folderId is string {
  return typeof folderId === "string" && folderId.startsWith(`${accountId}:`) &&
    folderId.length > accountId.length + 1;
}

export function isAccountFolder(accountId: string, folderId: unknown, folders: readonly Folder[]): folderId is string {
  return folderIdBelongsToAccount(accountId, folderId) &&
    folders.some(folder => folder.id === folderId && folder.accountId === accountId);
}
