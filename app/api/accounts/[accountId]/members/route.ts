import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { listCollabMembers } from "@/lib/threadCollab";
import { requireCollabAccountContext, collabJson } from "@/app/api/_helpers/threadCollabContext";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
export async function GET(request: Request, { params }: AccountRouteParams) {
  const ctx = await requireCollabAccountContext(request, await getAccountIdFromParams(params));
  if (ctx instanceof NextResponse) return ctx;
  return withAuthResponse(ctx, async () => collabJson({ ok: true, members: await listCollabMembers(ctx.accountId) }));
}
