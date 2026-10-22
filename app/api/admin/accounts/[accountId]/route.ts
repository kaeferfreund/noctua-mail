import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../../_auth";
import { withAuthResponse } from "@/lib/auth";
import { deleteAccountControlPlane, AccountDeletionForbiddenError } from "@/lib/serverDb";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";
export async function DELETE(request: Request, { params }: AccountRouteParams) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const origin = await requireBodylessSameOrigin(request); if (origin) return origin;
    const accountId = await getAccountIdFromParams(params);
    let deleted: boolean;
    try { deleted = await deleteAccountControlPlane(accountId, session.userId); }
    catch (error) { if (error instanceof AccountDeletionForbiddenError) return NextResponse.json({ ok: false, message: error.message }, { status: 403 }); throw error; }
    if (!deleted) return NextResponse.json({ ok: false, message: "Account not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}
