/**
 * How attachment bytes may be shown as a document. Attachments come from any
 * sender and are served from the app's origin, so a rendered attachment must
 * never act with the viewer's session (scripts, forms, navigation).
 * Client-safe: used by the attachment route and the attachment list.
 */

export function normalizeMimeType(contentType?: string | null) {
  return contentType?.split(";")[0]?.toLowerCase().trim() ?? "";
}

export function isPdfMimeType(contentType?: string | null) {
  return normalizeMimeType(contentType) === "application/pdf";
}

const BASE_ATTACHMENT_CSP = "default-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'";

/**
 * CSP for attachment bytes. `sandbox` gives the document an opaque origin
 * without scripts, forms, popups or top-level navigation, whatever type the
 * sender declared (HTML, SVG, XML with a stylesheet …), also when the URL is
 * opened directly. PDF viewers do not run in sandboxed documents, and a PDF is
 * not rendered by the page engine, so PDFs keep the plain policy.
 */
export function attachmentDocumentCsp(contentType?: string | null) {
  return isPdfMimeType(contentType) ? BASE_ATTACHMENT_CSP : `sandbox; ${BASE_ATTACHMENT_CSP}`;
}

/** Types a browser shows passively (no markup, no script). */
const PASSIVE_PREVIEW_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/bmp"
]);

/**
 * Type for a blob: preview of an attachment that only exists in the browser
 * (a draft's data: URL). A blob: document has the app's origin and no
 * response headers of its own, so active types are shown as plain text.
 */
export function blobPreviewMimeType(contentType?: string | null) {
  // Parameters (a text charset) cannot make a type active, so a passive type is kept as declared.
  return PASSIVE_PREVIEW_TYPES.has(normalizeMimeType(contentType)) ? contentType!.trim() : "text/plain;charset=utf-8";
}

/** `filename="…"` keeps printable ASCII only; quotes and backslashes would end or escape the value. */
export function attachmentContentDisposition(disposition: "inline" | "attachment", filename: string) {
  const asciiName = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\]/g, "_");
  // RFC 5987 attr-char excludes ' ( ) *, which encodeURIComponent keeps.
  const encodedName = encodeURIComponent(filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}
