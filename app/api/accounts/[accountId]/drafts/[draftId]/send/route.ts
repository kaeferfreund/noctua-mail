import { SenderIdentityError } from "@/lib/senderIdentities";
import { collabActorFromSession } from "@/lib/threadCollab";
import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { DraftSendError, sendDraftForAccount } from "@/lib/drafts";
import {
  getAccountIdFromParams,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { errorResponse, okResponse } from "@/app/api/_helpers/response";
import { smtpUpstreamErrorResponse } from "@/app/api/_helpers/smtpUpstreamError";

/**
 * POST /api/accounts/[accountId]/drafts/[draftId]/send
 *
 * Send a previously-saved draft without re-opening it in compose.
 * Mirrors the response shape of `/smtp/send` (minus invite-specific
 * fields, which drafts carry as part of their raw MIME rather than as
 * a separate side-channel) so the client can use the same post-send
 * UI path.
 */

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; draftId?: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const accountId = await getAccountIdFromParams(params);
  const { draftId: rawDraftId } = await params;
  const draftId = typeof rawDraftId === "string" ? rawDraftId.trim() : "";
  if (!accountId || !draftId) {
    return errorResponse("Missing accountId or draftId", 400);
  }
  const accountContext = await requireAccountContext(request, accountId, {
    minRole: "editor",
    missingAccountMessage: "Missing accountId"
  });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const originError = requireMutationSameOrigin(request);
    if (originError) return originError;
    const { account, accountId: resolvedAccountId, clientId } = accountContext;

    try {
      const result = await sendDraftForAccount({
        account,
        accountId: resolvedAccountId,
        clientId: clientId ?? "",
        draftId,
        actor: collabActorFromSession(accountContext.session, accountContext.clientId)
      });
      return okResponse(result);
    } catch (error) {
      if (error instanceof SenderIdentityError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
      if (error instanceof DraftSendError) {
        return errorResponse(error.message, error.status);
      }
      const upstreamResponse = smtpUpstreamErrorResponse(error, {
        accountId: resolvedAccountId,
        op: "send-draft"
      });
      if (upstreamResponse) return upstreamResponse;
      throw error;
    }
  });
}
