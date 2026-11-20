import { NextResponse, type NextRequest } from "next/server";
import { buildAppContentSecurityPolicy, createCspNonce } from "./lib/securityHeaders";

/**
 * Content-Security-Policy for app pages with a fresh script nonce per request.
 * Next.js reads the nonce from the request's CSP header and puts it on its own
 * scripts; the root layout passes `x-nonce` to the inline scripts it renders.
 * Every page is rendered per request (the root layout reads cookies), so no
 * prerendered page carries a stale nonce.
 */
export function proxy(request: NextRequest) {
  const nonce = createCspNonce();
  const policy = buildAppContentSecurityPolicy({ nonce, dev: process.env.NODE_ENV === "development" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes, /t/ tracking and unsubscribe routes and icon
      // routes set policies of their own; build output and public files
      // (anything with a file extension, e.g. /sw.js) are no pages.
      source: "/((?!api/|_next/|t/|icons/|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
};
