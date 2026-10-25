import { NextResponse } from "next/server";
import { adminAccountNotFound, requireAdminSessionOr403, resolveAdminMemberAccount } from "../../_auth";
import { withAuthResponse } from "@/lib/auth";
import { deleteAccountControlPlane, AccountDeletionForbiddenError } from "@/lib/serverDb";
import type { AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";
/** Only for a mailbox the admin is a member of; unknown and foreign mailboxes are both 404. */
export async function DELETE(request: Request, { params }: AccountRouteParams) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const origin = await requireBodylessSameOrigin(request); if (origin) return origin;
    const accountId = await resolveAdminMemberAccount(params, session.userId);
    if (!accountId) return adminAccountNotFound();
    let deleted: boolean;
    try { deleted = await deleteAccountControlPlane(accountId, session.userId); }
    catch (error) { if (error instanceof AccountDeletionForbiddenError) return NextResponse.json({ ok: false, message: error.message }, { status: 403 }); throw error; }
    if (!deleted) return adminAccountNotFound();
    return NextResponse.json({ ok: true });
  });
}
