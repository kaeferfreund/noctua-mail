import { ifNoneMatchMatches } from "@/app/api/_helpers/etag";
import type { DomainIconOverride } from "@/lib/domainIcons";
import type { resolveSenderIcon } from "@/lib/senderIcons";

/** Image replies never run as a document and vary by session. */
export const ICON_RESPONSE_HEADERS = {
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'"
};

/** Fetched logos and initials stay cached for six hours. */
const SENDER_ICON_CACHE_CONTROL = "private, max-age=21600";

/**
 * An admin-uploaded domain icon: private, revalidated on every use (ETag/304)
 * like message source and attachment bytes, so a reset or a new upload is
 * seen on the next request; clients add the version to the URL as well.
 */
export function domainIconOverrideResponse(request: Request, override: DomainIconOverride) {
  const headers = { ...ICON_RESPONSE_HEADERS, "Cache-Control": "private, no-cache", ETag: override.etag };
  if (ifNoneMatchMatches(request.headers.get("if-none-match"), override.etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(new Uint8Array(override.body), { headers: { ...headers, "Content-Type": "image/png" } });
}

/** The resolver's logo or initials; `fallbackNone` answers 404 instead of the
 * initials so the caller can draw its own. */
export function senderIconResponse(result: Awaited<ReturnType<typeof resolveSenderIcon>>, fallbackNone: boolean) {
  const headers = { ...ICON_RESPONSE_HEADERS, "Cache-Control": SENDER_ICON_CACHE_CONTROL };
  if (result.provider === null && fallbackNone) {
    return new Response(null, { status: 404, headers });
  }
  return new Response(new Uint8Array(result.body), { headers: { "Content-Type": result.contentType, ...headers } });
}
