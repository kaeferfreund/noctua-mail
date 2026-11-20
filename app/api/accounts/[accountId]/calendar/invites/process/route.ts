import { getOwnAddresses } from "@/lib/ownAddresses";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { appendMessageIdToError } from "@/app/api/_helpers/message/errorFormatting";
import { processCalendarInviteForMessage } from "@/lib/calendarInviteProcessor";
import { getMessageById } from "@/lib/db";
import { readJsonBody } from "@/app/api/_helpers/readJsonBody";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountId, {
    minRole: "editor",
    missingAccountMessage: "Missing accountId"
  });
  if (accountContext instanceof NextResponse) return accountContext;
  const body = await readJsonBody<{
        accountId?: string;
        messageId?: string;
        icsSource?: string;
      }>(request);
  if (!body.ok) return body.response;
  const payload = body.value;
  const messageId = payload?.messageId?.trim() ?? "";
  const icsSource = payload?.icsSource ?? "";
  return withAuthResponse(accountContext, async () => {
    if (!messageId) {
      return NextResponse.json({ ok: false, message: "Missing messageId" }, { status: 400 });
    }
    if (!icsSource.trim()) {
      return NextResponse.json({ ok: false, message: "Missing icsSource" }, { status: 400 });
    }

    const message = await getMessageById(accountContext.accountId, messageId);
    if (!message) {
      return NextResponse.json(
        { ok: false, message: appendMessageIdToError("Message not found", messageId) },
        { status: 404 }
      );
    }

    const result = await processCalendarInviteForMessage({
      accountId: accountContext.accountId,
      messageId,
      icsSource,
      process: true,
      accountEmail: getOwnAddresses(accountContext.account),
      senderAddress: message.from,
      reminderUserId: accountContext.session.userId,
      processedByUserId: accountContext.session.userId,
      processedAutomatically: false
    });
    if (result.states.length === 0) {
      return NextResponse.json(
        { ok: false, message: "No calendar invite data found in ICS source" },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, states: result.states });
  });
}
