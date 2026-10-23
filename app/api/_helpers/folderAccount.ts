import { NextResponse } from "next/server";
import { FolderAccountMismatchError } from "@/lib/folderAccount";
import { assertAccountFolder } from "@/lib/folderAccountGuard";

export function folderAccountMismatchResponse() {
  return NextResponse.json({ ok: false, code: "folder_account_mismatch" }, { status: 400 });
}

export async function validateAccountFolders(accountId: string, folderIds: unknown[]) {
  try {
    for (const folderId of folderIds) {
      if (folderId != null) await assertAccountFolder(accountId, folderId);
    }
    return null;
  } catch (error) {
    if (error instanceof FolderAccountMismatchError) return folderAccountMismatchResponse();
    throw error;
  }
}
