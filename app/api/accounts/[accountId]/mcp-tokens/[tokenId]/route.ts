import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAccountIdFromParams, requireAccountContext, requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireBodylessSameOrigin, requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { listMcpTokens } from "@/lib/serverDb";
import { deleteMcpToken } from "@/lib/serverDb";
import { updateMcpTokenAccounts } from "@/lib/mcpAuth";
import { isMcpAccountIdList } from "@/lib/mcpPermissions";
import { requireMcpGrant } from "../mcpGrant";

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

/** Replaces the token's mailbox set; only its creator may. The token secret is unchanged and never returned. */
export async function PATCH(request: Request, { params }: Params) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const origin = requireJsonSameOrigin(request); if (origin) return origin;
    const tokenId = (await params).tokenId?.trim();
    if (!tokenId) return NextResponse.json({ ok: false, message: "Missing tokenId" }, { status: 400 });
    const body = await request.json().catch(() => null);
    if (!body || !isMcpAccountIdList(body.accountIds, context.accountId)) return NextResponse.json({ ok: false, message: "Invalid token mailboxes" }, { status: 400 });
    // Widening a token's reach is as sensitive as creating one: same fresh factor proof.
    const proof = await requireMcpGrant(context.session, request); if (proof) return proof;
    const tokenRecord = await updateMcpTokenAccounts(context.session, context.accountId, tokenId, body.accountIds).catch(() => undefined);
    if (tokenRecord === undefined) return NextResponse.json({ ok: false, message: "MFA session and membership in every selected mailbox required" }, { status: 403 });
    if (!tokenRecord) return NextResponse.json({ ok: false, message: "Token not found" }, { status: 404 });
    return NextResponse.json({ ok: true, tokenRecord });
  });
}
