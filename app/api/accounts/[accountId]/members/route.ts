import { NextResponse } from "next/server";
import { requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { listAccountMembers } from "@/lib/accountAccess";
export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "viewer" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const members = await listAccountMembers(context.accountId);
    return NextResponse.json({ ok: true, members: context.role === "manager" ? members : members.filter(m => !m.disabled).map(({ disabled, ...member }) => { void disabled; return member; }) });
  });
}
