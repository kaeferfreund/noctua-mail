import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { requireAccountAndMessageContext } from "@/app/api/_helpers/message/routeHelpers";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import type { LookupFn } from "@/lib/net/urlSafety";
import { publicRequest, PublicRequestError, type HopTransport, type PublicRequestFailure } from "@/lib/net/publicHttp";

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; messageId?: string }>;
};

/**
 * Performs the RFC 8058 one-click unsubscribe POST. Extracted from the route
 * handler so it can be unit-tested with injected transport/DNS.
 *
 * SSRF-critical: `targetUrl` comes from an attacker-controlled email header
 * (`List-Unsubscribe`). `publicRequest` checks it and every redirect hop with
 * `assertPublicUrl` (https only, public addresses only), connects to the
 * checked addresses (no second DNS lookup) and bounds the redirects, time and
 * response size.
 */
export type OneClickUnsubscribeResult =
  | { ok: true; status: number }
  | { ok: false; status: number; message: string };

const UNSUBSCRIBE_MAX_REDIRECTS = 3;
/** Only status and headers count; a longer confirmation page is cut, not treated as a failure. */
const UNSUBSCRIBE_MAX_RESPONSE_BYTES = 64 * 1024;
/** Failures caused by the remote server (502); every other guard reason is a rejected URL (400). */
const UPSTREAM_FAILURES = new Set<PublicRequestFailure>(["network-error", "timeout", "response-too-large", "too-many-redirects", "redirect-not-allowed"]);

export async function performOneClickUnsubscribe(
  targetUrl: string,
  options?: {
    transport?: HopTransport;
    lookup?: LookupFn;
    timeoutMs?: number;
  }
): Promise<OneClickUnsubscribeResult> {
  try {
    const res = await publicRequest(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
      lookup: options?.lookup,
      transport: options?.transport,
      maxRedirects: UNSUBSCRIBE_MAX_REDIRECTS,
      maxResponseBytes: UNSUBSCRIBE_MAX_RESPONSE_BYTES,
      truncateResponse: true,
      timeoutMs: options?.timeoutMs ?? 15000
    });
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status };
    }
    return {
      ok: false,
      status: 502,
      message: `Unsubscribe request returned status ${res.status}`
    };
  } catch (error) {
    if (error instanceof PublicRequestError && !UPSTREAM_FAILURES.has(error.reason)) {
      return { ok: false, status: 400, message: `Unsubscribe URL rejected: ${error.reason}` };
    }
    const msg = error instanceof Error ? error.message : "Network error";
    return { ok: false, status: 502, message: `Unsubscribe request failed: ${msg}` };
  }
}

/**
 * Parse List-Unsubscribe header to extract HTTPS URLs, HTTP URLs, and
 * mailto URLs. The header format is: <url1>, <url2>, ...
 *
 * `http:` and `https:` are kept in separate buckets because the one-click
 * POST path can only safely use `https:` (RFC 8058; `assertPublicUrl`
 * rejects `http:` as `unsupported-protocol`). Lumping them together would
 * make a header like `<http://evil/>, <https://legit/>` pick the
 * attacker's `http` URL, fail validation, and silently skip the valid
 * `https` one.
 */
export function parseListUnsubscribeUrls(raw: string): {
  https: string[];
  http: string[];
  mailto: string[];
} {
  const https: string[] = [];
  const http: string[] = [];
  const mailto: string[] = [];
  const matches = raw.match(/<[^>]+>/g) ?? [];
  for (const match of matches) {
    const url = match.slice(1, -1).trim();
    if (url.startsWith("https://")) {
      https.push(url);
    } else if (url.startsWith("http://")) {
      http.push(url);
    } else if (url.startsWith("mailto:")) {
      mailto.push(url);
    }
  }
  return { https, http, mailto };
}

/**
 * Parse HTTP header format string (newline-separated headers).
 * Returns an object with List-Unsubscribe value and whether Post header exists.
 */
function parseUnsubscribeHeaders(headerString: string): {
  listUnsubscribe: string | null;
  hasOneClick: boolean;
} {
  const lines = headerString.split("\n");
  let listUnsubscribe: string | null = null;
  let hasOneClick = false;

  for (const line of lines) {
    if (line.startsWith("List-Unsubscribe:")) {
      listUnsubscribe = line.substring("List-Unsubscribe:".length).trim();
    } else if (line.startsWith("List-Unsubscribe-Post:")) {
      hasOneClick = line.toLowerCase().includes("one-click");
    }
  }

  return { listUnsubscribe, hasOneClick };
}

export async function POST(request: Request, { params }: Params) {
  const originError = await requireMutationSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const { messageId: rawMessageId } = await params;
  const messageId = typeof rawMessageId === "string" ? rawMessageId.trim() : "";
  const context = await requireAccountAndMessageContext(
    request,
    { accountId, messageId },
    { minRole: "editor", missingFieldsMessage: "Missing accountId or messageId" }
  );
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const { message } = context;

    if (!message.listUnsubscribe) {
      return NextResponse.json(
        { ok: false, message: "Message has no unsubscribe header" },
        { status: 400 }
      );
    }

    const { listUnsubscribe, hasOneClick } = parseUnsubscribeHeaders(message.listUnsubscribe);

    if (!listUnsubscribe) {
      return NextResponse.json(
        { ok: false, message: "Could not parse List-Unsubscribe header" },
        { status: 400 }
      );
    }

    const urls = parseListUnsubscribeUrls(listUnsubscribe);

    // Case 1: RFC 8058 one-click (has List-Unsubscribe-Post + HTTPS URL).
    // Server-side fetch — https-only, and validated before sending (SSRF
    // guard). We deliberately skip `urls.http` here because RFC 8058 says
    // one-click SHOULD be https and `assertPublicUrl` rejects http anyway.
    if (hasOneClick && urls.https.length > 0) {
      const targetUrl = urls.https[0];
      const result = await performOneClickUnsubscribe(targetUrl);
      if (result.ok) {
        return NextResponse.json({ ok: true, method: "one-click", status: result.status });
      }
      return NextResponse.json(
        { ok: false, message: result.message, method: "one-click" },
        { status: result.status }
      );
    }

    // Case 2: No one-click, but has an http(s) URL -> return it for the
    // browser to open. No server-side fetch happens here, so plain http
    // is acceptable. Prefer https when both are present.
    const browserUrl = urls.https[0] ?? urls.http[0];
    if (browserUrl) {
      return NextResponse.json({
        ok: true,
        method: "browser",
        url: browserUrl
      });
    }

    // Case 3: Only mailto URLs
    if (urls.mailto.length > 0) {
      return NextResponse.json({
        ok: true,
        method: "mailto",
        url: urls.mailto[0]
      });
    }

    return NextResponse.json(
      { ok: false, message: "No usable unsubscribe URL found" },
      { status: 400 }
    );
  });
}
