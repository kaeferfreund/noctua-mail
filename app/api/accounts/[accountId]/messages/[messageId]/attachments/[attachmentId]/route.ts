import { mailboxErrorResponse } from "@/lib/mailboxFailure";
import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { type AccountRouteParams, getAccountIdFromParams } from "@/app/api/_helpers/accountContext";
import { statAttachmentData } from "@/lib/storage";
import { readStoredAttachmentData } from "@/lib/mail/storedAttachmentData";
import { getAttachmentMeta } from "@/lib/db";
import { requireActiveUserSession } from "@/lib/auth";
import { ensureHtmlDocumentTitle, escapeHtml } from "@/lib/html";
import { formatAttachmentPageTitle } from "@/lib/appBranding";
import { removeMessageAttachmentEverywhere } from "@/lib/mail/removeMessageAttachment";
import { requireAccountAndMessageContext } from "@/app/api/_helpers/message/routeHelpers";
import { appendMessageIdToError } from "@/app/api/_helpers/message/errorFormatting";
import { entityTagForStat, ifNoneMatchMatches } from "@/app/api/_helpers/etag";

/**
 * Private cache, revalidated on every use (ETag/304): a stored copy is only shown after the server re-checked
 * session and membership, so logout/revocation take effect immediately. Attachment ids are reused across resync.
 */
export const ATTACHMENT_CACHE_CONTROL = "private, no-cache";

export const attachmentEntityTag = entityTagForStat;
export { ifNoneMatchMatches };

function attachmentCacheHeaders(etag: string) {
  return {
    ETag: etag,
    "Cache-Control": ATTACHMENT_CACHE_CONTROL
  };
}

type Params = AccountRouteParams & {
  params: Promise<{
    id?: string;
    accountId?: string;
    messageId?: string;
    attachmentId?: string;
  }>;
};

export async function GET(request: Request, { params }: Params) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accountId = await getAccountIdFromParams(params);
    const { messageId: messageIdParam, attachmentId: attachmentIdParam } = await params;
    const { searchParams } = new URL(request.url);
    const messageId = messageIdParam ?? "";
    const attachmentId = attachmentIdParam ?? "";

    if (!accountId || !messageId || !attachmentId) {
      return NextResponse.json({ ok: false, message: "Missing parameters" }, { status: 400 });
    }
    const access = await requireAccountContext(request, accountId, { minRole: "viewer" });
    if (access instanceof NextResponse) return access;

    // Resolve ownership before preview, cache validation, or filesystem access.
    const attachment = await getAttachmentMeta(accountId, messageId, attachmentId);
    if (!attachment) {
      return NextResponse.json({ ok: false, message: "Attachment not found" }, { status: 404 });
    }

    // A directly served attachment is titled by the browser from the URL's last
    // segment — the opaque attachment id — so a preview window asks for a
    // titled shell around it instead. The data is not touched here; the frame
    // fetches it from this same route without the flag.
    if (searchParams.get("preview") === "1") {
      const frameUrl = new URL(request.url);
      frameUrl.searchParams.delete("preview");
      const shell = [
        '<!doctype html><html lang="en"><head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        "<style>html,body{margin:0;height:100%;background:#1f1d1a}",
        "iframe{border:0;display:block;width:100%;height:100%}</style>",
        "</head><body>",
        `<iframe src="${escapeHtml(frameUrl.pathname + frameUrl.search)}"></iframe>`,
        "</body></html>"
      ].join("");
      return new NextResponse(
        ensureHtmlDocumentTitle(shell, formatAttachmentPageTitle(attachment.filename)),
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store"
          }
        }
      );
    }

    const notModified = (etag: string) =>
      new NextResponse(null, { status: 304, headers: attachmentCacheHeaders(etag) });

    let fileStat = await statAttachmentData(accountId, messageId, attachmentId);
    const currentTag = fileStat ? attachmentEntityTag(fileStat) : null;
    if (currentTag && ifNoneMatchMatches(request.headers.get("if-none-match"), currentTag)) {
      return notModified(currentTag);
    }

    const data = await readStoredAttachmentData(accountId, messageId, { ...attachment, id: attachmentId });
    if (!data) {
      return NextResponse.json({ ok: false, message: "Attachment data not found" }, { status: 404 });
    }
    fileStat ??= await statAttachmentData(accountId, messageId, attachmentId);

    const rawName = attachment.filename ?? "attachment";
    const asciiName = rawName.replace(/[^\x20-\x7E]+/g, "_");
    const encodedName = encodeURIComponent(rawName);
    const shouldDownload = searchParams.get("download") === "1";
    const disposition = shouldDownload ? "attachment" : "inline";
    const etag = fileStat ? attachmentEntityTag(fileStat) : null;
    if (etag && ifNoneMatchMatches(request.headers.get("if-none-match"), etag)) {
      return notModified(etag);
    }

    return new NextResponse(data, {
      headers: {
        "Content-Type": attachment.contentType ?? "application/octet-stream",
        ...(etag ? attachmentCacheHeaders(etag) : {}),
        "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'"
      }
    });
  });
}

// Maps orchestrator failures to HTTP status codes: validation problems the
// client can't retry away (400/404/422) vs. an IMAP round-trip that failed
// mid-rewrite (502).
function statusForRemovalError(message: string) {
  if (message === "Attachment not found") return 404;
  if (message === "Message is missing IMAP metadata") return 400;
  if (
    message === "Message source is unavailable" ||
    message === "Could not locate the attachment in the message source"
  ) {
    return 422;
  }
  return 502;
}

export async function DELETE(request: Request, { params }: Params) {
  const originError = await requireMutationSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const { messageId: messageIdParam, attachmentId: attachmentIdParam } = await params;
  const messageId = (messageIdParam ?? "").trim();
  const attachmentId = (attachmentIdParam ?? "").trim();

  const context = await requireAccountAndMessageContext(
    request,
    { accountId, messageId },
    { minRole: "editor",
      missingFieldsMessage: "Missing accountId/messageId",
      missingMessageMessage: "Message not found in local cache.",
      requireImapMetadata: true,
      missingImapMetadataMessage: "Message is missing IMAP metadata to rewrite."
    }
  );
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {

    if (!attachmentId) {
      return NextResponse.json({ ok: false, message: "Missing attachmentId" }, { status: 400 });
    }

    const { account, clientId, message } = context;
    try {
      const result = await removeMessageAttachmentEverywhere(account, message, attachmentId, clientId);
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      const failure = await mailboxErrorResponse(error, accountId, context.role);
      if (failure) return failure;
      const detail = error instanceof Error ? error.message : "Failed to remove attachment";
      return NextResponse.json(
        { ok: false, message: appendMessageIdToError(detail, messageId) },
        { status: statusForRemovalError(detail) }
      );
    }
  });
}
