import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { requireAccountAndMessageContext } from "@/app/api/_helpers/message/routeHelpers";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { markMessageNotSuspicious, recordSpamDecision } from "@/lib/mail/spam/examples";

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; messageId?: string }>;
};

/** Corrects a "Verdächtig" mark: the message stays where it is and becomes a "Kein Spam" example. */
export async function POST(request: Request, { params }: Params) {
  const originError = await requireMutationSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const { messageId: rawMessageId } = await params;
  const messageId = typeof rawMessageId === "string" ? rawMessageId.trim() : "";
  const context = await requireAccountAndMessageContext(request, { accountId, messageId }, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const { accountId: resolvedAccountId, message, userId } = context;
    await recordSpamDecision({ accountId: resolvedAccountId, message, label: "ham", source: "not-suspicious", userId });
    const updated = await markMessageNotSuspicious(resolvedAccountId, message.id);
    if (!updated) return NextResponse.json({ ok: false, message: "Message could not be updated" }, { status: 409 });
    return NextResponse.json({ ok: true, messageId: message.id, spamVerdict: "ham" });
  });
}
