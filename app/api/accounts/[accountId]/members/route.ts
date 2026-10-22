import { NextResponse } from "next/server";
import { requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { listAccountMembersForRole } from "@/lib/accountAccess";
export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "viewer" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const members = await listAccountMembersForRole(context.accountId, context.role);
    return NextResponse.json({ ok: true, members: members });
  });
}
