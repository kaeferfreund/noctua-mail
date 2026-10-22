import { requireCollabAccountContext as requireAccountContext } from "@/app/api/_helpers/threadCollabContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { DraftSaveError, saveDraftForAccount, type SaveDraftInput } from "@/lib/drafts";
import {
  getAccountIdFromParams,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const payload = (await request.json()) as SaveDraftInput & {
    accountId?: string;
  };
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountId, "editor");
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const originError = requireJsonSameOrigin(request);
    if (originError) return originError;
    const { account, accountId: resolvedAccountId, clientId } = accountContext;
    try {
      const result = await saveDraftForAccount({
        account,
        accountId: resolvedAccountId,
        clientId: clientId ?? "",
        payload
      });
      return NextResponse.json({ ok: true, draftId: result.draftId, message: result.message });
    } catch (error) {
      if (error instanceof DraftSaveError) {
        return NextResponse.json(
          { ok: false, message: error.message },
          { status: error.status }
        );
      }
      throw error;
    }
  });
}
