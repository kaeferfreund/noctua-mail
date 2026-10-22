import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { type AccountRouteParams, getAccountIdFromParams } from "@/app/api/_helpers/accountContext";
import { getMessageById, getUserAccountPrefs } from "@/lib/db";
import { enforceSafeLinks } from "@/lib/html";
import { messageHtmlCsp, senderAllowsRemoteContent, type RemoteContentMode } from "@/lib/html/remoteContent";
import { requireActiveUserSession } from "@/lib/auth";
import { formatMessageHtmlPageTitle } from "@/lib/appBranding";
import { appendMessageIdToError } from "@/app/api/_helpers/message/errorFormatting";
import {
  appendUnreferencedInlineImages,
  ensureHtmlDocumentTitle,
  escapeHtml,
  replaceInlineImageSources,
  sanitizeHtmlForDisplay,
  stripRedundantInlineImageFallbacks,
  stripRemovedInlineImages,
  stripConditionalComments
} from "@/lib/html";

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; messageId?: string }>;
};

function postprocessHtml(
  html: string,
  attachments: Array<{
    id?: string;
    inline?: boolean;
    cid?: string;
    url?: string;
    dataUrl?: string;
    contentType?: string;
    filename?: string;
  }>,
  mode: RemoteContentMode
) {
  let nextHtml = html;
  attachments.forEach((attachment) => {
    if (attachment.url && attachment.dataUrl) {
      nextHtml = nextHtml.replaceAll(attachment.dataUrl, attachment.url);
    }
  });
  nextHtml = replaceInlineImageSources(nextHtml, attachments);
  nextHtml = stripRedundantInlineImageFallbacks(nextHtml, attachments);
  nextHtml = appendUnreferencedInlineImages(nextHtml, attachments);
  nextHtml = stripRemovedInlineImages(nextHtml, attachments);
  return enforceSafeLinks(sanitizeHtmlForDisplay(stripConditionalComments(nextHtml), mode)).replace(
    /data:(?!image\/)[^'")\s]+/gi,
    "about:blank"
  );
}

function asHtmlDocument(subject: string, html: string) {
  return ensureHtmlDocumentTitle(html, formatMessageHtmlPageTitle(subject));
}

function htmlError(status: number, message: string) {
  return new NextResponse(
    asHtmlDocument(
      "",
      `<main><h1>HTML Debug View</h1><p>${escapeHtml(message)}</p></main>`
    ),
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": messageHtmlCsp(),
        "Referrer-Policy": "no-referrer"
      }
    }
  );
}

export async function GET(request: Request, { params }: Params) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accountId = await getAccountIdFromParams(params);
    const { messageId: rawMessageId } = await params;
    const messageId = typeof rawMessageId === "string" ? rawMessageId : "";

    if (!accountId || !messageId) {
      return htmlError(400, "Missing accountId or messageId.");
    }
    const access = await requireAccountContext(request, accountId, { minRole: "viewer" });
    if (access instanceof NextResponse) return htmlError(403, "Forbidden.");

    const message = await getMessageById(accountId, messageId);
    if (!message) {
      return htmlError(404, appendMessageIdToError("Message not found.", messageId));
    }

    if (!message.htmlBody || !message.htmlBody.trim()) {
      return htmlError(404, "Message has no HTML body.");
    }

    const decision = new URL(request.url).searchParams.get("remoteContent");
    const prefs = await getUserAccountPrefs(access.userId, accountId);
    const mode: RemoteContentMode = decision === "allow" ||
      (decision !== "block" && senderAllowsRemoteContent(prefs, message.from)) ? "allow" : "block";
    const html = postprocessHtml(message.htmlBody, message.attachments ?? [], mode);
    const payload = asHtmlDocument(message.subject ?? "", html);
    return new NextResponse(payload, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": messageHtmlCsp(mode),
        "Referrer-Policy": "no-referrer"
      }
    });
  });
}
