import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getFolders, saveFoldersForAccount } from "@/lib/db";
import type { Folder } from "@/lib/data";
import { FolderAccountMismatchError, folderIdBelongsToAccount } from "@/lib/folderAccount";
import { folderAccountMismatchResponse } from "@/app/api/_helpers/folderAccount";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { readJsonBody } from "@/app/api/_helpers/readJsonBody";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountId, { minRole: "viewer" });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    return NextResponse.json(await getFolders(accountContext.accountId));
  });
}

export async function PUT(request: Request, { params }: AccountRouteParams) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountId, { minRole: "manager" });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const body = await readJsonBody<Folder[]>(request);
    if (!body.ok) return body.response;
    const payload = body.value ?? ({} as NonNullable<typeof body.value>);
    if (!Array.isArray(payload)) {
      return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
    }
    // The folder id (and parent id) is the shard-wide key, so it must carry this
    // mailbox's namespace, not just the accountId field next to it.
    const invalidFolder = payload.find((folder) =>
      folder?.accountId !== accountContext.accountId ||
      !folderIdBelongsToAccount(accountContext.accountId, folder.id) ||
      (folder.parentId != null && !folderIdBelongsToAccount(accountContext.accountId, folder.parentId)));
    if (invalidFolder) {
      return NextResponse.json({ ok: false, message: "Folder account mismatch" }, { status: 400 });
    }
    try {
      await saveFoldersForAccount(accountContext.accountId, payload);
    } catch (error) {
      if (error instanceof FolderAccountMismatchError) return folderAccountMismatchResponse();
      throw error;
    }
    return NextResponse.json({ ok: true });
  });
}
