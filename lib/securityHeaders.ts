/**
 * Response security headers for app pages and attachment documents.
 * Imported by next.config.ts and proxy.ts, so keep it free of path aliases and
 * server-only modules.
 */

type HeaderList = { key: string; value: string }[];

/** Headers for every response. Route handlers that set their own value win. */
export const GLOBAL_SECURITY_HEADERS: HeaderList = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Mail links open with noreferrer anyway; app pages send no referrer to other sites.
  { key: "Referrer-Policy", value: "same-origin" }
];

/**
 * App pages are never framed. API documents (message HTML, attachment data)
 * are framed by Noctua's own pages and attachment preview shell.
 */
export const PAGE_FRAME_HEADERS: HeaderList = [{ key: "X-Frame-Options", value: "DENY" }];
export const API_FRAME_HEADERS: HeaderList = [{ key: "X-Frame-Options", value: "SAMEORIGIN" }];

/**
 * Policy for app pages. Scripts run only with the per-request nonce (Next.js
 * puts it on its own scripts) or when a nonced script loads them
 * ('strict-dynamic'); 'self' is the fallback for browsers without CSP 3.
 *
 * Message HTML is shown in srcdoc frames, which inherit this policy on top of
 * their own: images therefore allow https:/http: (remote content after the
 * user's consent; the frame's own policy still blocks them otherwise) and
 * styles stay 'unsafe-inline' (mail and component styles; a style nonce would
 * disable 'unsafe-inline').
 */
export function buildAppContentSecurityPolicy({ nonce, dev = false }: { nonce: string; dev?: boolean }) {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(nonce)) throw new Error("Invalid CSP nonce");
  return [
    "default-src 'self'",
    // React needs eval in development only, for server error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    // data: and blob: for previews of attachments that are still in the browser.
    "connect-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "frame-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join("; ");
}

/** A 128-bit random nonce, base64. */
export function createCspNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}
