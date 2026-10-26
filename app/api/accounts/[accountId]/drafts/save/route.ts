import { OutboundAuthorizationError } from "@/lib/outboundAuthorization";
import { saveDraftSchema } from "@/lib/draftSchemas";
import { SenderIdentityError } from "@/lib/senderIdentities";
import { collabActorFromSession } from "@/lib/threadCollab";
import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { DraftSaveError, saveDraftForAccount, type SaveDraftInput } from "@/lib/drafts";
import {
  getAccountIdFromParams,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountId, {
    minRole: "editor",
    missingAccountMessage: "Missing accountId"
  });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const originError = requireJsonSameOrigin(request);
    if (originError) return originError;
    const parsed = saveDraftSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ ok: false, code: "invalid_identity", message: "Invalid draft payload" }, { status: 400 });
    const payload: SaveDraftInput = parsed.data;
    const { account, accountId: resolvedAccountId, clientId } = accountContext;
    try {
      const result = await saveDraftForAccount({
        account,
        authorization: { request },
        accountId: resolvedAccountId,
        clientId: clientId ?? "",
        payload,
        actor: collabActorFromSession(accountContext.session, accountContext.clientId)
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof OutboundAuthorizationError) return error.response;
      if (error instanceof SenderIdentityError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
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
