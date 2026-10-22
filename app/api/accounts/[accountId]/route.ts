import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { deleteAccountControlPlane, AccountDeletionForbiddenError } from "@/lib/serverDb";
import { requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { handleMailboxCredentialMutation } from "@/app/api/_helpers/mailboxPatch";
import { errorResponse, okResponse } from "@/app/api/_helpers/response";
import { revokeAuthStreams } from "@/lib/authStreams";
import { recordAdminAudit } from "@/lib/serverDb";
export async function PUT(request: Request, { params }: AccountRouteParams) {
  return handleMailboxCredentialMutation(request, "put", params);
}

export async function DELETE(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    if (context.account.ownerUserId !== context.userId && context.session.role !== "admin") return errorResponse("Only the owner can delete this mailbox", 403);
    const origin = await requireBodylessSameOrigin(request); if (origin) return origin;
    let deleted: boolean;
    try { deleted = await deleteAccountControlPlane(context.accountId, context.userId); }
    catch (error) { if (error instanceof AccountDeletionForbiddenError) return errorResponse(error.message, 403); throw error; }
    if (!deleted) return errorResponse("Account not found", 404);
    revokeAuthStreams({ accountId: context.accountId });
    await recordAdminAudit({ actorUserId: context.userId, action: "account.delete", targetAccountId: context.accountId });
    return okResponse();
  });
}
