import { listAccessibleAccountsForUser } from "@/lib/accountAccess";
import { MCP_PERMISSION_MODES, mcpTokenListItem } from "@/lib/mcpPermissions";
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
    const mailboxes = (await listAccessibleAccountsForUser(context.userId)).map(({ account, role }) => ({ id: account.id, name: account.name, email: account.email, accessRole: role }));
    const accessible = new Set(mailboxes.map(mailbox => mailbox.id));
    const visible = context.role === "manager" ? tokens : tokens.filter(t => t.createdByUserId === context.userId);
    return NextResponse.json({ ok: true, mailboxes, tokens: visible.map(token => mcpTokenListItem(token, accessible)) });
  });
}
export async function POST(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const origin = requireJsonSameOrigin(request); if (origin) return origin;
    const body = await request.json().catch(() => null);
    if (!body || typeof body.label !== "string" || (body.ttlSeconds !== undefined && (!Number.isSafeInteger(body.ttlSeconds) || body.ttlSeconds < 60 || body.ttlSeconds > 31_536_000))) return NextResponse.json({ ok: false, message: "Invalid token parameters" }, { status: 400 });
    if ((body.mode !== undefined && !MCP_PERMISSION_MODES.includes(body.mode)) ||
      (body.accountIds !== undefined && (!Array.isArray(body.accountIds) || !body.accountIds.length ||
        !body.accountIds.every((id: unknown) => typeof id === "string" && id.trim() === id && id.length > 0) ||
        !body.accountIds.includes(context.accountId)))) {
      return NextResponse.json({ ok: false, message: "Invalid token mailboxes or permission mode" }, { status: 400 });
    }
    try { return NextResponse.json({ ok: true, ...await mintMcpToken(context.session, context.accountId, body.label, body.ttlSeconds ?? 2_592_000, { accountIds: body.accountIds, mode: body.mode }) }, { status: 201 }); }
    catch { return NextResponse.json({ ok: false, message: "MFA session and editor membership required" }, { status: 403 }); }
  });
}
