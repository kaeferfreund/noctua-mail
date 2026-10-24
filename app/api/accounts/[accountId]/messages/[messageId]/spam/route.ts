import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { requireImapMessageMutationContext } from "@/app/api/_helpers/message/routeHelpers";
import { moveMessageToJunk } from "@/app/api/_helpers/message/junkMove";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { recordSpamDecision } from "@/lib/mail/spam/examples";

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; messageId?: string }>;
};

export async function POST(request: Request, { params }: Params) {
  const originError = await requireMutationSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const { messageId: rawMessageId } = await params;
  const messageId = typeof rawMessageId === "string" ? rawMessageId.trim() : "";
  const context = await requireImapMessageMutationContext(request, { accountId, messageId });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const { accountId: resolvedAccountId, account, clientId, message, userId } = context;
    const moved = await moveMessageToJunk({ account, accountId: resolvedAccountId, message, clientId });
    await recordSpamDecision({ accountId: resolvedAccountId, message, label: "spam", source: "mark-spam", userId });
    // The sender loses trusted-sender status in every mailbox; loaded lazily like the sync hook (AI SDK).
    await import("@/lib/mail/spam/service")
      .then(({ revokeSenderTrust }) => revokeSenderTrust(resolvedAccountId, message.from, message.id))
      .catch((error) => console.warn("[spam] failed to revoke sender trust", { accountId: resolvedAccountId, error: String(error) }));
    return NextResponse.json({ ok: true, action: "moved", ...moved });
  });
}
