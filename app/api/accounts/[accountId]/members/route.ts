// Team-auth owns this route at integration; keep its implementation when merging slice 3.
import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { listAccountMembers } from "@/lib/threadCollab";
import { requireCollabAccountContext, collabJson } from "@/app/api/_helpers/threadCollabContext";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
export async function GET(request: Request, { params }: AccountRouteParams) {
  const ctx = await requireCollabAccountContext(request, await getAccountIdFromParams(params));
  if (ctx instanceof NextResponse) return ctx;
  return withAuthResponse(ctx, async () => collabJson({ ok: true, members: (await listAccountMembers(ctx.accountId)).filter(member => ctx.role === "manager" || !member.disabled) }));
}
