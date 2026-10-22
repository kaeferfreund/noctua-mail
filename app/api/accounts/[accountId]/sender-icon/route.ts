import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireActiveUserSession } from "@/lib/auth";
import { getAccountById } from "@/lib/db";
import { resolveSenderIcon } from "@/lib/senderIcons";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {

    const url = new URL(request.url);
    const accountId = await getAccountIdFromParams(params);
    const from = url.searchParams.get("from") ?? "";
    const fromEmail = url.searchParams.get("fromEmail") ?? "";

    if (!accountId) {
      return NextResponse.json({ ok: false, message: "Missing accountId" }, { status: 400 });
    }

    const access = await requireAccountContext(request, accountId, { minRole: "viewer" });
    if (access instanceof NextResponse) return access;

    const account = await getAccountById(accountId);
    if (!account) {
      return NextResponse.json({ ok: false, message: "Account not found" }, { status: 404 });
    }

    const result = await resolveSenderIcon({
      from,
      fromEmail,
      enabled: account.settings?.appearance?.senderIcons ?? true
    });

    return new Response(new Uint8Array(result.body), {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "private, max-age=21600",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'"
      }
    });
  });
}
