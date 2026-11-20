import { validateAccountFolders } from "@/app/api/_helpers/folderAccount";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getFolders, saveFoldersForAccount, updateMessagesFolderPrefix } from "@/lib/db";
import { listImapFolders, renameImapFolder } from "@/lib/mail/imap";
import { mailboxPathFromFolderId } from "@/lib/mailboxPaths";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { readJsonBody } from "@/app/api/_helpers/readJsonBody";

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; folderId?: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const { folderId: rawFolderId } = await params;
  const folderId = typeof rawFolderId === "string" ? rawFolderId.trim() : "";
  const accountContext = await requireAccountContext(request, accountId, { minRole: "manager" });
  if (accountContext instanceof NextResponse) return accountContext;
  const body = await readJsonBody<{
    accountId?: string;
    folderId?: string;
    name: string;
  }>(request);
  if (!body.ok) return body.response;
  const payload = body.value ?? ({} as NonNullable<typeof body.value>);
  if (!accountId || !folderId || !payload?.name) {
    return NextResponse.json({ ok: false, message: "Missing accountId, folderId, or name" }, { status: 400 });
  }
  return withAuthResponse(accountContext, async () => {
    const { account, clientId } = accountContext;
    const folders = await getFolders(accountId);
    const folderError = await validateAccountFolders(accountId, [folderId]);
    if (folderError) return folderError;
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) {
      return NextResponse.json({ ok: false, message: "Folder not found" }, { status: 404 });
    }
    const delimiter = folder.delimiter ?? "/";
    const mailboxPath = mailboxPathFromFolderId(folder.id, accountId);
    const parts = mailboxPath.split(delimiter);
    parts[parts.length - 1] = payload.name;
    const newPath = parts.join(delimiter);

    await renameImapFolder(account, mailboxPath, newPath, clientId);
    await updateMessagesFolderPrefix(accountId, mailboxPath, newPath);
    const updated = await listImapFolders(account, clientId);
    await saveFoldersForAccount(account.id, updated);
    return NextResponse.json({ ok: true, folders: updated });
  });
}
