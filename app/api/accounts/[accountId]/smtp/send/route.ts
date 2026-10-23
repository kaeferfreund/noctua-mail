import { authorizeOutbound, OutboundAuthorizationError, prepareOutboundAssertion } from "@/lib/outboundAuthorization";
import { resolveSendIdentity, validateManagedReplyTo } from "@/lib/sendIdentity";
import { SenderIdentityError } from "@/lib/senderIdentities";
import { collabActorFromSession } from "@/lib/threadCollab";
import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { upsertCalendarEvent } from "@/lib/db";
import type { ComposeInvitePayload } from "@/lib/composeInvite";
import { completeSend } from "@/lib/mail/completeSend";
import {
  normalizeCalendarAttachments,
  parseComposeAttachments,
  resolveComposeHtml,
  resolveComposeText
} from "@/lib/mail/composePayload";
import { buildSentInvite } from "@/lib/mail/sentInvite";
import { sendSmtpMessage } from "@/lib/serverSmtp";
import {
  getAccountIdFromParams,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { toFiniteNumber } from "@/app/api/_helpers/numberParsing";
import { smtpUpstreamErrorResponse } from "@/app/api/_helpers/smtpUpstreamError";

function buildMessageId(address: string) {
  const domain = address.split("@")[1]?.trim();
  const safeDomain = domain && domain.length > 0 ? domain : "noctua.local";
  return `<${randomUUID()}@${safeDomain}>`;
}

export async function POST(request: Request, { params }: AccountRouteParams) {
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountId, {
    minRole: "editor",
    missingAccountMessage: "Missing accountId"
  });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const originError = requireJsonSameOrigin(request);
    if (originError) return originError;
    const payload = (await request.json()) as {
      accountId?: string;
      identityId?: string;
      from?: never;
      envelopeFrom?: never;
      to?: string;
      cc?: string;
      bcc?: string;
      subject: string;
      text: string;
      markdown?: string;
      html?: string;
      composeFormat?: string;
      invite?: ComposeInvitePayload;
      inReplyTo?: string;
      references?: string[];
      replyTo?: string;
      xForwardedMessageId?: string;
      attachments?: Array<{
        filename: string;
        contentType: string;
        inline?: boolean;
        cid?: string;
        dataUrl?: string;
      }>;
    };
    const { account, clientId } = accountContext;
    let identity;
    try {
      if ("from" in payload || "envelopeFrom" in payload) throw new SenderIdentityError("invalid_identity", 400, "Use identityId to select a sender.");
      identity = await resolveSendIdentity({ accountId, userId: accountContext.userId,
        identityId: payload.identityId, inReplyTo: payload.inReplyTo, mode: payload.xForwardedMessageId ? "forward" : undefined });
      validateManagedReplyTo(identity, payload.replyTo);
    } catch (error) {
      if (error instanceof SenderIdentityError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
      throw error;
    }
    const to = payload.to?.trim() ?? "";
    const cc = payload.cc?.trim() ?? "";
    const bcc = payload.bcc?.trim() ?? "";
    if (!to && !cc && !bcc) {
      return NextResponse.json(
        { ok: false, message: "Please add at least one recipient." },
        { status: 400 }
      );
    }
    const outboundTo = !to && !cc && bcc ? "undisclosed-recipients:;" : to;
    if (payload.invite && !to && !cc) {
      return NextResponse.json(
        { ok: false, message: "Event invitations require at least one To or Cc recipient." },
        { status: 400 }
      );
    }
    if (payload.invite) {
      const startAtMs = toFiniteNumber(payload.invite.startAtMs);
      if (!Number.isFinite(startAtMs)) {
        return NextResponse.json(
          { ok: false, message: "Invalid invite: startAtMs must be a valid number." },
          { status: 400 }
        );
      }
      if (payload.invite.endAtMs !== undefined) {
        const endAtMs = toFiniteNumber(payload.invite.endAtMs);
        if (!Number.isFinite(endAtMs) || endAtMs < startAtMs) {
          return NextResponse.json(
            { ok: false, message: "Invalid invite: endAtMs must be a valid time not before startAtMs." },
            { status: 400 }
          );
        }
      }
      if (typeof payload.invite.location !== "undefined" && typeof payload.invite.location !== "string") {
        return NextResponse.json(
          { ok: false, message: "Invalid invite: location must be a string." },
          { status: 400 }
        );
      }
      if (typeof payload.invite.recurrenceRule !== "undefined" && typeof payload.invite.recurrenceRule !== "string") {
        return NextResponse.json(
          { ok: false, message: "Invalid invite: recurrenceRule must be a string." },
          { status: 400 }
        );
      }
    }

    const attachments = normalizeCalendarAttachments(parseComposeAttachments(payload.attachments));
    const html = await resolveComposeHtml({
      composeFormat: payload.composeFormat,
      markdown: payload.markdown,
      html: payload.html,
      attachments: payload.attachments
    });
    const text = resolveComposeText({
      composeFormat: payload.composeFormat,
      text: payload.text,
      html: payload.html
    });

    const inviteResult = payload.invite
      ? buildSentInvite({
          account,
          sender: identity,
          invite: payload.invite,
          subject: payload.subject,
          to,
          cc,
          descriptionText: text
        })
      : null;
    if (inviteResult) {
      attachments.push({
        filename: inviteResult.filename,
        contentType: "text/calendar; method=REQUEST; charset=UTF-8",
        content: Buffer.from(inviteResult.ics, "utf8")
      });
    }

    const messageId = buildMessageId(identity.email);
    let result: Awaited<ReturnType<typeof sendSmtpMessage>>;
    try {
      const authorization = await authorizeOutbound({ request }, { accountId, minRole: "editor", identity });
      const beforeSend = await prepareOutboundAssertion(authorization);
      beforeSend();
      result = await sendSmtpMessage(account, {
        to: outboundTo || undefined,
        cc: cc || undefined,
        bcc: bcc || undefined,
        keepBcc: true,
        subject: payload.subject,
        text,
        html,
        messageId,
        inReplyTo: payload.inReplyTo,
        references: payload.references,
        xForwardedMessageId: payload.xForwardedMessageId,
        ...(attachments.length > 0 ? { attachments } : {})
      }, identity, beforeSend);
    } catch (error) {
      if (error instanceof OutboundAuthorizationError) return error.response;
      if (error instanceof SenderIdentityError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
      const upstreamResponse = smtpUpstreamErrorResponse(error, {
        accountId: account.id,
        op: "send-message"
      });
      if (upstreamResponse) return upstreamResponse;
      throw error;
    }

    const sentResult = await completeSend({ account, clientId, raw: result.raw, messageId,
      actor: collabActorFromSession(accountContext.session, accountContext.clientId), inReplyTo: payload.inReplyTo, references: payload.references,
      xForwardedMessageId: payload.xForwardedMessageId });

    let inviteScheduled = false;
    let inviteEventId: string | null = null;
    let inviteWarning: string | null = null;
    if (inviteResult) {
      try {
        await upsertCalendarEvent(account.id, inviteResult.event);
        inviteScheduled = true;
        inviteEventId = inviteResult.event.id;
      } catch (error) {
        console.error("[smtp] failed to persist sent invite event", {
          accountId: account.id,
          error
        });
        inviteWarning = "The invitation email was sent, but the local calendar event could not be scheduled.";
      }
    }

    return NextResponse.json({
      ok: true,
      ...sentResult,
      identityId: identity.id,
      inviteScheduled,
      inviteEventId,
      inviteWarning
    });
  });
}
