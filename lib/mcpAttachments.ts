import type { Attachment } from "@/lib/data";

/**
 * MCP attachment access: classification of untrusted attachment metadata, the
 * caps on what one call loads and returns, and text paging. Pure helpers; the
 * tools in lib/mcpServer.ts do the authorization and loading.
 */

const MIB = 1024 * 1024;
/** Largest attachment one get_message_attachment call loads (and returns as image or file). */
export const MCP_ATTACHMENT_MAX_BYTES = 5 * MIB;
/** Largest raw message source parsed to extract an attachment that has no cached file yet. */
export const MCP_ATTACHMENT_MAX_SOURCE_BYTES = 12 * MIB;
/** Attachment bytes all get_message_attachment calls of one HTTP request (batch) may load together. */
export const MCP_ATTACHMENT_MAX_REQUEST_BYTES = 10 * MIB;
/** Attachment loads running at the same time in this process; further calls wait. */
export const MCP_ATTACHMENT_MAX_CONCURRENT_LOADS = 2;
export const MCP_ATTACHMENT_DEFAULT_TEXT_CHARS = 20_000;
export const MCP_ATTACHMENT_MAX_TEXT_CHARS = 100_000;

export type McpAttachmentSummary = { id: string; filename: string; contentType: string; size: number; inline: boolean };
export type McpAttachmentKind = "image" | "text" | "document" | "binary";
export type McpAttachmentForm = "image" | "text" | "resource" | "metadata";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
type ImageType = typeof IMAGE_TYPES[number];

const TEXT_APPLICATION_TYPES = new Set([
  "application/json", "application/xml", "application/ics", "application/x-yaml", "application/yaml",
  "application/csv", "application/x-csv", "application/javascript", "application/x-sh", "application/sql",
  "application/pgp-signature", "application/pgp-keys", "application/x-pem-file"
]);
const TEXT_MESSAGE_TYPES = new Set(["message/rfc822", "message/delivery-status", "message/disposition-notification", "message/global"]);
/** Extensions treated as text when a mail declares a generic binary type. */
const TEXT_EXTENSIONS = new Set(["txt", "csv", "tsv", "json", "xml", "ics", "vcf", "eml", "md", "log", "yaml", "yml", "html", "htm"]);
const DOCUMENT_TYPES = new Set([
  "application/pdf", "application/msword", "application/rtf", "application/vnd.ms-excel", "application/vnd.ms-powerpoint"
]);
const DOCUMENT_TYPE_PREFIXES = ["application/vnd.openxmlformats-officedocument.", "application/vnd.oasis.opendocument."];
const GENERIC_BINARY_TYPES = new Set(["application/octet-stream", "application/x-download", "application/download", "binary/octet-stream"]);
const MIME_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/;
// C0/C1 controls, bidi overrides/isolates, zero-width and line/paragraph separators.
const hex4 = (code: number) => `\\u${code.toString(16).padStart(4, "0")}`;
const UNSAFE_FILENAME_RANGES = [[0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2066, 0x2069], [0xfeff, 0xfeff]] as const;
const UNSAFE_FILENAME_CHARS = new RegExp(`[${UNSAFE_FILENAME_RANGES.map(([from, to]) => `${hex4(from)}-${hex4(to)}`).join("")}]`, "g");
const MAX_FILENAME_LENGTH = 255;

/** Mail-supplied filenames are untrusted: no control or bidi characters, bounded length. */
export function sanitizeAttachmentFilename(value: unknown) {
  const cleaned = (typeof value === "string" ? value : "").replace(/\s+/g, " ").replace(UNSAFE_FILENAME_CHARS, "").trim();
  return Array.from(cleaned).slice(0, MAX_FILENAME_LENGTH).join("") || "attachment";
}

/** Mail-supplied content types are untrusted: lowercase `type/subtype` without parameters, else octet-stream. */
export function sanitizeAttachmentContentType(value: unknown) {
  const base = (typeof value === "string" ? value : "").split(";")[0]!.trim().toLowerCase();
  return MIME_TYPE_PATTERN.test(base) ? base : "application/octet-stream";
}

function charsetOf(contentType: unknown) {
  const match = (typeof contentType === "string" ? contentType : "").match(/;\s*charset\s*=\s*"?([A-Za-z0-9_.:-]{1,40})"?/i);
  return match?.[1]?.toLowerCase() ?? "utf-8";
}

function extensionOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function toMcpAttachmentSummary(attachment: Pick<Attachment, "id" | "filename" | "contentType" | "size" | "inline">): McpAttachmentSummary {
  return {
    id: attachment.id,
    filename: sanitizeAttachmentFilename(attachment.filename),
    contentType: sanitizeAttachmentContentType(attachment.contentType),
    size: Number.isFinite(attachment.size) ? Math.max(0, Math.floor(attachment.size)) : 0,
    inline: Boolean(attachment.inline)
  };
}

/** What a declared (sanitized) type and filename suggest. Images are confirmed later against the bytes. */
export function classifyAttachment(contentType: string, filename: string): McpAttachmentKind {
  if ((IMAGE_TYPES as readonly string[]).includes(contentType)) return "image";
  if (contentType.startsWith("text/") || TEXT_APPLICATION_TYPES.has(contentType) || TEXT_MESSAGE_TYPES.has(contentType) ||
      /^application\/[a-z0-9.-]+\+(json|xml)$/.test(contentType)) return "text";
  if (DOCUMENT_TYPES.has(contentType) || DOCUMENT_TYPE_PREFIXES.some(prefix => contentType.startsWith(prefix))) return "document";
  if (GENERIC_BINARY_TYPES.has(contentType) && TEXT_EXTENSIONS.has(extensionOf(filename))) return "text";
  return "binary";
}

/** The image type the bytes actually are, from their signature; null for anything outside the allowed list. */
export function detectImageType(data: Uint8Array): ImageType | null {
  const startsWith = (bytes: number[], offset = 0) => bytes.every((byte, index) => data[offset + index] === byte);
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x47, 0x49, 0x46, 0x38]) && (data[4] === 0x37 || data[4] === 0x39) && data[5] === 0x61) return "image/gif";
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/** Decodes text-like attachment bytes with the declared charset (UTF-8 when unknown). Null for content with NUL bytes. */
export function decodeAttachmentText(data: Uint8Array, rawContentType: unknown) {
  let decoder: TextDecoder;
  try { decoder = new TextDecoder(charsetOf(rawContentType)); } catch { decoder = new TextDecoder("utf-8"); }
  const text = decoder.decode(data);
  return text.includes("\u0000") ? null : text;
}

/** One page of a decoded text; never splits a surrogate pair. */
export function pageAttachmentText(text: string, offset = 0, maxChars = MCP_ATTACHMENT_DEFAULT_TEXT_CHARS) {
  const start = Math.min(Math.max(0, Math.floor(offset)), text.length);
  let end = Math.min(text.length, start + Math.max(1, Math.floor(maxChars)));
  if (end < text.length && end > start + 1 && /[\ud800-\udbff]/.test(text[end - 1]!)) end -= 1;
  const truncated = end < text.length;
  return { text: text.slice(start, end), offset: start, returnedChars: end - start, totalChars: text.length, truncated,
    ...(truncated ? { nextOffset: end } : {}) };
}

export function formatByteSize(bytes: number) {
  return bytes >= MIB ? `${(bytes / MIB).toFixed(1)} MiB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KiB` : `${bytes} bytes`;
}

let activeLoads = 0;
const waitingLoads: Array<() => void> = [];
/** Runs `load` once fewer than MCP_ATTACHMENT_MAX_CONCURRENT_LOADS loads are active, so parallel calls cannot pile up buffers. */
export async function withAttachmentLoadSlot<T>(load: () => Promise<T>): Promise<T> {
  if (activeLoads >= MCP_ATTACHMENT_MAX_CONCURRENT_LOADS) await new Promise<void>(resolve => waitingLoads.push(resolve));
  else activeLoads += 1;
  try {
    return await load();
  } finally {
    const next = waitingLoads.shift();
    if (next) next(); else activeLoads -= 1;
  }
}
