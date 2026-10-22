import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAccountIdFromParams, requireAccountContext, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { listMcpTokens } from "@/lib/serverDb";
import { deleteMcpToken } from "@/lib/serverDb";

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; tokenId?: string }>;
};

export async function DELETE(request: Request, { params }: Params) {
  const accountId = await getAccountIdFromParams(params);
  const context = await requireAccountContext(request, accountId, { minRole: "editor" });
  if (context instanceof NextResponse) {
    return context;
  }
  return withAuthResponse(context, async () => {

    const origin = await requireBodylessSameOrigin(request); if (origin) return origin;
    const { tokenId: rawTokenId } = await params;
    const tokenId = typeof rawTokenId === "string" ? rawTokenId.trim() : "";
    if (!tokenId) {
      return NextResponse.json({ ok: false, message: "Missing tokenId" }, { status: 400 });
    }

    const token = (await listMcpTokens(context.accountId)).find(t => t.id === tokenId);
    if (!token || (context.role !== "manager" && token.createdByUserId !== context.userId)) return NextResponse.json({ ok: false, message: "Token not found" }, { status: 404 });
    const deleted = await deleteMcpToken(context.accountId, tokenId);
    if (!deleted) {
      return NextResponse.json({ ok: false, message: "Token not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  });
}
