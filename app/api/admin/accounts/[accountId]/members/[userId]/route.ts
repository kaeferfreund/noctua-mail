import { NextResponse } from "next/server";
import { membershipErrorResponse } from "@/app/api/_helpers/membershipResponse";
import { requireAdminSessionOr403 } from "../../../../_auth";
import { withAuthResponse } from "@/lib/auth";
import { changeAccountMember, MembershipError } from "@/lib/accountMembers";
import { isAccountRole } from "@/lib/data";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin, requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";
async function mutate(request: Request, params: AccountRouteParams["params"], remove: boolean) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return membershipErrorResponse(session);
  return withAuthResponse(session, async () => {
    const origin = remove ? await requireBodylessSameOrigin(request) : requireJsonSameOrigin(request); if (origin) return membershipErrorResponse(origin);
    const accountId = await getAccountIdFromParams(params), { userId } = await params;
    const body = remove ? null : await request.json().catch(() => null);
    if (typeof userId !== "string" || (!remove && !isAccountRole(body?.role))) return NextResponse.json({ ok: false, code: typeof userId !== "string" ? "invalid_request" : "above_manager", message: "Invalid member" }, { status: 400 });
    try { return NextResponse.json({ ok: true, ...await changeAccountMember(accountId, userId, session.userId, remove ? null : body.role, { admin: true }) }); }
    catch (error) { if (error instanceof MembershipError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status }); throw error; }
  });
}
export async function PUT(request: Request, { params }: AccountRouteParams) { return mutate(request, params, false); }
export async function DELETE(request: Request, { params }: AccountRouteParams) { return mutate(request, params, true); }
