import { validateAccountFolders } from "@/app/api/_helpers/folderAccount";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getFolders, saveFoldersForAccount } from "@/lib/db";
import { createImapFolder, listImapFolders } from "@/lib/mail/imap";
import { mailboxPathFromFolderId } from "@/lib/mailboxPaths";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { readJsonBody } from "@/app/api/_helpers/readJsonBody";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountId, { minRole: "manager" });
  if (accountContext instanceof NextResponse) return accountContext;
  const body = await readJsonBody<{
    accountId?: string;
    name: string;
    parentId?: string | null;
  }>(request);
  if (!body.ok) return body.response;
  const payload = body.value ?? ({} as NonNullable<typeof body.value>);
  if (!accountId || !payload?.name) {
    return NextResponse.json({ ok: false, message: "Missing accountId or name" }, { status: 400 });
  }
  return withAuthResponse(accountContext, async () => {
    const { account, clientId } = accountContext;
    const folderError = await validateAccountFolders(accountId, [payload.parentId]);
    if (folderError) return folderError;
    const folders = await getFolders(accountId);
    const parent = payload.parentId
      ? folders.find((folder) => folder.id === payload.parentId)
      : null;
    const delimiter = parent?.delimiter ?? "/";
    const parentPath = parent ? mailboxPathFromFolderId(parent.id, accountId) : "";
    const path = parentPath ? `${parentPath}${delimiter}${payload.name}` : payload.name;

    await createImapFolder(account, path, clientId);
    const updated = await listImapFolders(account, clientId);
    await saveFoldersForAccount(account.id, updated);
    return NextResponse.json({ ok: true, folders: updated });
  });
}
