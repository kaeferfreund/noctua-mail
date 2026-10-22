import { NextResponse } from "next/server";
import { membershipErrorResponse } from "@/app/api/_helpers/membershipResponse";
import { requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin, requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { isAccountRole } from "@/lib/data";
import { changeAccountMember, MembershipError } from "@/lib/accountMembers";
async function mutate(request: Request, params: AccountRouteParams["params"], remove: boolean) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return membershipErrorResponse(context);
  return withAuthResponse(context, async () => {
    const origin = remove ? await requireBodylessSameOrigin(request) : requireJsonSameOrigin(request);
    if (origin) return membershipErrorResponse(origin);
    const { userId } = await params;
    if (typeof userId !== "string" || !userId.trim()) return NextResponse.json({ ok: false, code: "invalid_request", message: "Missing userId" }, { status: 400 });
    const body = remove ? null : await request.json().catch(() => null);
    if (!remove && !isAccountRole(body?.role)) return NextResponse.json({ ok: false, code: "above_manager", message: "Invalid role" }, { status: 400 });
    try { return NextResponse.json({ ok: true, ...await changeAccountMember(context.accountId, userId, context.userId, remove ? null : body.role) }); }
    catch (error) { if (error instanceof MembershipError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status }); throw error; }
  });
}
export async function PUT(request: Request, { params }: AccountRouteParams) { return mutate(request, params, false); }
export async function DELETE(request: Request, { params }: AccountRouteParams) { return mutate(request, params, true); }
