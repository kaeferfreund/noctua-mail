import { requireAccountContext } from "@/app/api/_helpers/accountContext";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { type AccountRouteParams, getAccountIdFromParams } from "@/app/api/_helpers/accountContext";
import { getMessageSource, getMessageSourceBuffer, statMessageSource } from "@/lib/storage";
import { attachmentContentDisposition, attachmentDocumentCsp } from "@/lib/attachmentDocument";
import { rawMessageSourceBytes, rawMessageSourceText } from "@/lib/messageSource";
import { MESSAGE_SOURCE_EML_FORMAT } from "@/lib/accountApiPaths";
import { getMessageById } from "@/lib/db";
import { requireActiveUserSession } from "@/lib/auth";
import { appendMessageIdToError } from "@/app/api/_helpers/message/errorFormatting";
import { entityTagForStat, ifNoneMatchMatches } from "@/app/api/_helpers/etag";

/**
 * Private cache, revalidated on every use (ETag/304), same pattern as attachment bytes: a stored copy is only
 * shown after the server re-checked session and membership, so logout/revocation take effect immediately.
 */
export const MESSAGE_SOURCE_CACHE_CONTROL = "private, no-cache";

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; messageId?: string }>;
};

export async function handleGetMessageSourceRequest(
  request: Request,
  options?: {
    accountId?: string | null;
    messageId?: string | null;
  }
) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accountId = options?.accountId ?? "";
    const messageId = options?.messageId ?? "";

    if (!accountId || !messageId) {
      return NextResponse.json({ ok: false, message: "Missing parameters" }, { status: 400 });
    }
    const access = await requireAccountContext(request, accountId, { minRole: "viewer" });
    if (access instanceof NextResponse) return access;

    const message = await getMessageById(accountId, messageId);
    if (!message) {
      return NextResponse.json(
        { ok: false, message: appendMessageIdToError("Message not found", messageId) },
        { status: 404 }
      );
    }

    // Validate against the stored file's stat before reading/scrubbing the
    // source, so a matching If-None-Match skips both. The scrubbed payload
    // derives deterministically from the file, so the file tag validates it.
    // A DB-only fallback source (no file) keeps the previous uncached reply.
    const fileStat = await statMessageSource(accountId, message.id);
    const etag = fileStat ? entityTagForStat(fileStat) : null;
    const cacheHeaders = etag
      ? { ETag: etag, "Cache-Control": MESSAGE_SOURCE_CACHE_CONTROL }
      : null;
    if (etag && cacheHeaders && ifNoneMatchMatches(request.headers.get("if-none-match"), etag)) {
      return new NextResponse(null, { status: 304, headers: cacheHeaders });
    }

    // `?format=eml`: the stored bytes unchanged as a download (no scrubbing, no
    // truncation, no UTF-8 decoding), so 8bit parts in other charsets survive.
    if (new URL(request.url).searchParams.get("format") === MESSAGE_SOURCE_EML_FORMAT) {
      const storedBytes = await getMessageSourceBuffer(accountId, message.id);
      const bytes = storedBytes ?? (message.source !== undefined ? rawMessageSourceBytes(message.source) : null);
      if (!bytes?.length) {
        return NextResponse.json({ ok: false, message: "Source not found" }, { status: 404 });
      }
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "message/rfc822",
          "Content-Disposition": attachmentContentDisposition("attachment", "message.eml"),
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": attachmentDocumentCsp("message/rfc822"),
          ...(storedBytes && cacheHeaders ? cacheHeaders : { "Cache-Control": "private, no-store" })
        }
      });
    }

    const storedSource = await getMessageSource(accountId, message.id);
    const fallbackSource = message.source !== undefined ? rawMessageSourceText(message.source) : null;
    const source = storedSource ?? fallbackSource;
    if (!source) {
      return NextResponse.json({ ok: false, message: "Source not found" }, { status: 404 });
    }

    const scrubbed = source.replace(/([A-Za-z0-9+/=]{200,})/g, "[base64 omitted]");
    const maxChars = 200_000;
    const trimmed =
      scrubbed.length > maxChars ? `${scrubbed.slice(0, maxChars)}\n\n[truncated]` : scrubbed;

    return NextResponse.json(
      {
        ok: true,
        source: trimmed
      },
      storedSource && cacheHeaders ? { headers: cacheHeaders } : undefined
    );
  });
}

export async function GET(request: Request, { params }: Params) {
  const accountId = await getAccountIdFromParams(params);
  const { messageId } = await params;
  return handleGetMessageSourceRequest(request, { accountId, messageId });
}
