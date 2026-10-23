import { extractVisibleHtmlText, selectPreferredHtmlDocument } from "@/lib/html/extract";

/**
 * Whether a message payload carries its readable content.
 *
 * - `omitted`: header projection; the body was not sent and must be read from
 *   the message detail route before it is displayed, quoted or printed.
 * - `stored`: text or HTML content is stored locally.
 * - `empty`: the raw source is stored but yields no readable content; a resync
 *   would not change that.
 * - `missing`: neither content nor source is stored locally; only an IMAP
 *   resync can fill it.
 */
export type MessageContentState = "omitted" | "stored" | "empty" | "missing";

export function hasTextContent(body?: string | null) {
  return typeof body === "string" && body.length > 0;
}

export function hasHtmlContent(html?: string | null) {
  if (!html) return false;
  const trimmed = selectPreferredHtmlDocument(html);
  if (!trimmed || trimmed === "0") return false;
  if (/<(img|table|svg|video|iframe|canvas|object|embed)\b/i.test(trimmed)) return true;
  const textOnly = extractVisibleHtmlText(trimmed);
  return textOnly.length > 0;
}

export function resolveStoredMessageContentState(row: {
  body?: string | null;
  htmlBody?: string | null;
  hasSource?: unknown;
}): Exclude<MessageContentState, "omitted"> {
  if (hasTextContent(row.body) || hasHtmlContent(row.htmlBody)) return "stored";
  return row.hasSource ? "empty" : "missing";
}
