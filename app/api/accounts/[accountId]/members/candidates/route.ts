import { NextResponse } from "next/server";
import { requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { listAccountMemberCandidates } from "@/lib/serverDb";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const search = new URL(request.url).searchParams;
    const query = search.get("q") ?? "";
    if (query.length > 128) return NextResponse.json({ ok: false, code: "invalid_request", message: "Search query too long" }, { status: 400 });
    const candidates = await listAccountMemberCandidates(context.accountId, query, search.has("limit") ? Number(search.get("limit")) : undefined);
    return NextResponse.json({ ok: true, candidates }, { headers: { "cache-control": "no-store" } });
  });
}
