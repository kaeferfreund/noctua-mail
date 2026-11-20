import { NextResponse } from "next/server";
import { type AccountRouteParams, getAccountIdFromParams, requireAccountContext } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { getMessageById, getUserAccountPrefs } from "@/lib/db";
import { remoteContentSenderDecision } from "@/lib/html/remoteContentSender.server";

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; messageId?: string }>;
};

/**
 * The reader's remote-content decision for one message: whether the user's
 * "always load from this sender" permission applies (only for a sender the
 * receiving server authenticated, see remoteContentSenderDecision).
 */
export async function GET(request: Request, { params }: Params) {
  const accountId = await getAccountIdFromParams(params);
  const { messageId: rawMessageId } = await params;
  const messageId = typeof rawMessageId === "string" ? rawMessageId : "";
  const context = await requireAccountContext(request, accountId, {
    minRole: "viewer",
    missingAccountMessage: "Missing accountId or messageId"
  });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    if (!messageId) return NextResponse.json({ ok: false, message: "Missing accountId or messageId" }, { status: 400 });
    const message = await getMessageById(context.accountId, messageId);
    if (!message) return NextResponse.json({ ok: false, message: "Message not found" }, { status: 404 });
    const prefs = await getUserAccountPrefs(context.userId, context.accountId);
    const decision = await remoteContentSenderDecision(prefs, context.accountId, message);
    return NextResponse.json({ ok: true, ...decision }, { headers: { "Cache-Control": "no-store" } });
  });
}
