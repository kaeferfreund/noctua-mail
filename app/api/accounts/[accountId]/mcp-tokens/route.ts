import { NextResponse } from "next/server";
import { requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { listMcpTokens } from "@/lib/serverDb";
import { mintMcpToken } from "@/lib/mcpAuth";
export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const tokens = await listMcpTokens(context.accountId);
    return NextResponse.json({ ok: true, tokens: context.role === "manager" ? tokens : tokens.filter(t => t.createdByUserId === context.userId) });
  });
}
export async function POST(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const origin = requireJsonSameOrigin(request); if (origin) return origin;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.label !== "string" || (body.ttlSeconds !== undefined && (!Number.isSafeInteger(body.ttlSeconds) || body.ttlSeconds < 60 || body.ttlSeconds > 31_536_000))) return NextResponse.json({ ok: false, message: "Invalid token parameters" }, { status: 400 });
    try { return NextResponse.json({ ok: true, ...await mintMcpToken(context.session, context.accountId, body.label, body.ttlSeconds ?? 2_592_000) }, { status: 201 }); }
    catch { return NextResponse.json({ ok: false, message: "MFA session and editor membership required" }, { status: 403 }); }
  });
}
