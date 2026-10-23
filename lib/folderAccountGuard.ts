import { getAccountDb } from "./db/connection";
import { FolderAccountMismatchError, folderIdBelongsToAccount } from "./folderAccount";

/** Validate against the account shard before any queue or IMAP operation. */
export async function assertAccountFolder(accountId: string, folderId: unknown) {
  if (!folderIdBelongsToAccount(accountId, folderId)) throw new FolderAccountMismatchError();
  const db = await getAccountDb(accountId);
  if (!db.prepare("SELECT 1 FROM folders WHERE accountId = ? AND id = ?").get(accountId, folderId)) {
    throw new FolderAccountMismatchError();
  }
}
