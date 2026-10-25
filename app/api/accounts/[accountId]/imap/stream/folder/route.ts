import { validateAccountFolders } from "@/app/api/_helpers/folderAccount";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { isStreamKey, switchStreamFolder } from "@/lib/mail/imapStreamRegistry";
import { NextResponse } from "next/server";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";

type StreamFolderPayload = { streamKey?: unknown; folderId?: unknown; seq?: unknown };

/** Moves the active folder of this session's open IMAP stream without reconnecting it. */
export async function POST(request: Request, { params }: AccountRouteParams) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  const accountIdParam = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountIdParam, {
    minRole: "viewer",
    missingAccountMessage: "Missing accountId"
  });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const { accountId, session } = accountContext;
    const payload = (await request.json().catch(() => null)) as StreamFolderPayload | null;
    const folderId = payload?.folderId ?? null;
    const seq = payload?.seq;
    if (!isStreamKey(payload?.streamKey) || (folderId !== null && typeof folderId !== "string") ||
        typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0) {
      return NextResponse.json({ ok: false, message: "Invalid stream folder switch" }, { status: 400 });
    }
    const folderError = await validateAccountFolders(accountId, [folderId]);
    if (folderError) return folderError;
    const owner = { key: payload.streamKey, userId: session.userId, sessionId: session.sessionId };
    if (!switchStreamFolder(accountId, owner, folderId, seq)) {
      return NextResponse.json({ ok: false, code: "stream_not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  });
}
