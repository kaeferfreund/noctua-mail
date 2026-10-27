import { convert as htmlToTextConvert } from "html-to-text";
import { isQuoteBoundaryText } from "@/lib/html/quoteBoundary";
import { normalizeIdentityEmail, parseAddressEmails } from "@/lib/ownAddresses";
import { extractDisplayName, getRootDomain } from "@/lib/senderIdentity";
import type { SpamInput } from "./types";

export const SPAM_TEXT_LIMIT = 4096;
const HEADER_VALUE_LIMIT = 600;
/**
 * X-Spam-Status lists the server's test names after the score; static rules
 * match tests anywhere in that list, so it keeps far more than other headers.
 */
const SPAM_STATUS_VALUE_LIMIT = 4000;
const MAX_SPAM_HEADERS = 12;
const MAX_LINK_DOMAINS = 30;
const MAX_ATTACHMENTS = 10;

/**
 * Own text the classifier always sees: a reply attribution or forward marker
 * before this many characters does not cut, so a fake attribution line at the
 * top cannot hide the body from the model.
 */
export const SPAM_OWN_TEXT_MIN = 1024;

/**
 * Drops "> " lines and everything from the first reply attribution / forward
 * marker that follows at least `keepAtLeast` characters of kept text.
 */
export function stripQuotedText(text: string, keepAtLeast = 0) {
  const kept: string[] = [];
  let length = 0;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*>/.test(line)) continue;
    if (length >= keepAtLeast && isQuoteBoundaryText(line)) break;
    kept.push(line.trimEnd());
    length += line.trim().length;
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Plain text of an HTML-only body: no line wrapping, images skipped. */
export function htmlToPlainText(html: string) {
  return htmlToTextConvert(html, { wordwrap: false, selectors: [{ selector: "img", format: "skip" }] });
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'()]+/gi;
const HREF_PATTERN = /\bhref\s*=\s*["']?\s*(https?:\/\/[^\s"'<>]+)/gi;

export function extractLinkDomains(text: string, html?: string | null) {
  const domains = new Set<string>();
  const add = (url: string) => {
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
      if (host) domains.add(host);
    } catch { /* not a URL */ }
  };
  for (const match of text.matchAll(URL_PATTERN)) add(match[0]);
  if (html) for (const match of html.matchAll(HREF_PATTERN)) add(match[1]);
  return [...domains].slice(0, MAX_LINK_DOMAINS);
}

const ANCHOR_OPEN = /<a\b[^>]*>/gi;
const ANCHOR_HREF = /\bhref\s*=\s*["']?\s*(https?:\/\/[^\s"'<>]+)/i;
const SHOWN_URL_PATTERN = /^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:[/?#]\S*)?$/i;
const ANCHOR_TEXT_LIMIT = 300;

/**
 * Link targets whose visible text is itself a URL or domain of another root
 * domain ("www.bank.example" pointing to elsewhere.example). Newsletters do
 * this with tracking links too, so the profile decides whether it is unusual.
 */
export function extractMaskedLinkDomains(html: string | null | undefined) {
  if (!html) return [];
  const masked = new Set<string>();
  for (const match of html.matchAll(ANCHOR_OPEN)) {
    const href = match[0].match(ANCHOR_HREF)?.[1];
    if (!href) continue;
    const start = match.index + match[0].length;
    const close = html.slice(start, start + ANCHOR_TEXT_LIMIT).search(/<\/a\s*>/i);
    if (close < 0) continue;
    const shown = html.slice(start, start + close).replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim().match(SHOWN_URL_PATTERN)?.[1];
    if (!shown) continue;
    try {
      const target = new URL(href).hostname.toLowerCase().replace(/^www\./, "");
      if (target && getRootDomain(target) !== getRootDomain(shown.toLowerCase())) masked.add(target);
    } catch { /* not a URL */ }
    if (masked.size >= MAX_LINK_DOMAINS) break;
  }
  return [...masked];
}

function capText(text: string) {
  return stripQuotedText(text, SPAM_OWN_TEXT_MIN).replace(/[ \t]+/g, " ").slice(0, SPAM_TEXT_LIMIT);
}

function firstMailbox(from: string) {
  const email = parseAddressEmails(from)[0] ?? null;
  return { fromEmail: email ? normalizeIdentityEmail(email) ?? email.toLowerCase() : null, fromName: extractDisplayName(from) || null };
}

/** The parts of mailparser's result the classifier reads (the repo types simpleParser as any). */
type ParsedAddress = { text?: string };
export type ParsedSpamSource = {
  from?: ParsedAddress;
  replyTo?: ParsedAddress;
  to?: ParsedAddress | ParsedAddress[];
  cc?: ParsedAddress | ParsedAddress[];
  messageId?: string;
  subject?: string;
  date?: Date;
  text?: string;
  html?: string | false;
  headerLines?: ReadonlyArray<{ key: string; line: string }>;
  attachments?: ReadonlyArray<{ filename?: string; contentType: string }>;
};

const unfold = (value: string) => value.replace(/\r?\n[ \t]+/g, " ").trim();

function addressText(value: ParsedSpamSource["to"] | ParsedSpamSource["cc"]) {
  if (!value) return "";
  return (Array.isArray(value) ? value : [value]).map((entry) => entry.text ?? "").filter(Boolean).join(", ");
}

export type HeaderLine = { key: string; value: string };

/** Comma-separated authserv-ids of the receiving server; when set, only these exact ids count. */
export const SPAM_AUTHSERV_ID_ENV = "NOCTUA_SPAM_AUTHSERV_ID";

export function configuredAuthservIds(env: Record<string, string | undefined> = process.env) {
  return (env[SPAM_AUTHSERV_ID_ENV] ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
}

const authservId = (value: string) =>
  value.split(";")[0].replace(/\([^()]*\)/g, " ").trim().split(/\s+/)[0]?.toLowerCase().replace(/\.$/, "") ?? "";

/** The host after "by" in a Received value: the server that stamped it. */
function receivedByHost(value: string) {
  return value.replace(/\([^()]*\)/g, " ").match(/(?:^|\s)by\s+([a-z0-9.-]+)/i)?.[1].toLowerCase().replace(/\.$/, "") ?? null;
}

/**
 * The receiving server's Authentication-Results (RFC 8601 §5), shared by the
 * allowlist and the trusted-sender profiles: only blocks above the second
 * Received line whose authserv-id belongs to the receiving server count; of
 * those, the top-most id's block. The receiving server is the configured
 * `NOCTUA_SPAM_AUTHSERV_ID` list (exact ids) or else the host that stamped
 * the top-most Received line, which no sender can write: an id matches when it
 * is that host, its first label (some providers write `by mx1.mail.example.com` and
 * `Authentication-Results: mx1;`) or in its registrable domain. A block the sender inserted under another id (no A-R of our server)
 * is ignored. A mail without any Received line never passed an MX (local
 * append); there the top-most block counts as before.
 */
export function receivingAuthenticationResults(lines: HeaderLine[], configured: readonly string[] = configuredAuthservIds()) {
  // Our receiving server writes its Received line and its Authentication-Results
  // next to each other at the top. Anything below the second Received line was
  // written by an earlier hop or by the sender, so a forged block that copies the
  // authserv-id of our server is ignored there (verify-r2 R1).
  const receivedIndexes = lines.flatMap((line, index) => (line.key === "received" ? [index] : []));
  const limit = receivedIndexes.length >= 2 ? receivedIndexes[1] : lines.length;
  const byHost = receivedIndexes.length ? receivedByHost(lines[receivedIndexes[0]].value) : null;
  const receiver = byHost ? getRootDomain(byHost) ?? byHost : null;
  const isReceiver = (id: string) => byHost !== null
    && (id === byHost || id === byHost.split(".")[0] || (getRootDomain(id) ?? id) === receiver);
  const pinned = (id: string) => (configured.length ? configured.includes(id)
    : byHost === null ? receivedIndexes.length === 0 : isReceiver(id));
  const results = lines.filter((line, index) => line.key === "authentication-results" && index < limit && pinned(authservId(line.value)));
  const first = results[0] ? authservId(results[0].value) : "";
  return results.filter((line) => authservId(line.value) === first).map((line) => line.value);
}

function topSpamHeaders(lines: HeaderLine[]) {
  const seen = new Set<string>();
  return lines.filter((line) => line.key.startsWith("x-spam") && !seen.has(line.key) && seen.add(line.key))
    .slice(0, MAX_SPAM_HEADERS).map((line) => `${line.key}: ${line.value}`);
}

/** Unfolded header lines of a raw header block (the part of a source before the first empty line). */
export function parseHeaderBlock(block: string): HeaderLine[] {
  const lines: HeaderLine[] = [];
  for (const raw of block.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const colon = raw.indexOf(":");
    if (colon > 0) lines.push({ key: raw.slice(0, colon).trim().toLowerCase(), value: raw.slice(colon + 1).trim() });
  }
  return lines;
}

/**
 * Arrival time: the date of the top-most Received header (after its last ";"),
 * stamped by the receiving server. The sender's Date header never counts; the
 * sender can only add Received headers below the server's own.
 */
export function topReceivedAt(lines: HeaderLine[]) {
  const value = lines.find((line) => line.key === "received")?.value;
  if (!value) return null;
  const stamp = value.slice(value.lastIndexOf(";") + 1).replace(/\([^()]*\)/g, " ").replace(/\s+/g, " ").trim();
  const time = Date.parse(stamp);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** The header-derived fields of SpamInput; `lines` hold the full unfolded values. */
function headerFields(lines: HeaderLine[]) {
  const capped = lines.map((line) => ({
    key: line.key,
    value: line.value.slice(0, line.key === "x-spam-status" ? SPAM_STATUS_VALUE_LIMIT : HEADER_VALUE_LIMIT)
  }));
  const header = (key: string) => capped.find((line) => line.key === key)?.value ?? null;
  return {
    listId: header("list-id"),
    listUnsubscribe: header("list-unsubscribe"),
    autoSubmitted: header("auto-submitted"),
    authenticationResults: receivingAuthenticationResults(lines).map((value) => value.slice(0, HEADER_VALUE_LIMIT)),
    spamHeaders: topSpamHeaders(capped),
    receivedAt: topReceivedAt(lines)
  };
}

/** Builds the classifier input from a parsed RFC 822 source. */
export function buildSpamInput(parsed: ParsedSpamSource): SpamInput {
  const lines = (parsed.headerLines ?? []).map((header) => ({
    key: header.key.toLowerCase(),
    value: unfold(header.line.slice(header.line.indexOf(":") + 1))
  }));
  const from = parsed.from?.text ?? "";
  const plain = parsed.text?.trim()
    ? parsed.text
    : typeof parsed.html === "string" ? htmlToPlainText(parsed.html) : "";
  return {
    from,
    ...firstMailbox(from),
    replyTo: parsed.replyTo?.text || null,
    to: addressText(parsed.to),
    cc: addressText(parsed.cc),
    messageId: parsed.messageId ?? null,
    subject: parsed.subject ?? "",
    date: parsed.date ? parsed.date.toISOString() : null,
    ...headerFields(lines),
    linkDomains: extractLinkDomains(plain, typeof parsed.html === "string" ? parsed.html : null),
    maskedLinkDomains: extractMaskedLinkDomains(typeof parsed.html === "string" ? parsed.html : null),
    attachments: (parsed.attachments ?? []).slice(0, MAX_ATTACHMENTS)
      .map((attachment) => `${attachment.filename || "(ohne Namen)"} (${attachment.contentType})`),
    text: capText(plain)
  };
}

/**
 * Fallback when no stored source exists: the columns the message row keeps.
 * `headers` (the source's raw header block) adds the receiving server's
 * verdicts without parsing the whole source (sender profile backfill).
 */
export function buildSpamInputFromMessage(message: {
  from: string; to: string; cc?: string | null; subject: string; date?: string | null; replyTo?: string | null;
  messageId?: string | null; listId?: string | null; listUnsubscribe?: string | null; body?: string | null; htmlBody?: string | null;
  attachments?: Array<{ filename: string; contentType: string }>; headers?: string | null;
}): SpamInput {
  const text = message.body ?? "";
  const headers = message.headers ? headerFields(parseHeaderBlock(message.headers)) : null;
  return {
    from: message.from,
    ...firstMailbox(message.from),
    replyTo: message.replyTo ?? null,
    to: message.to,
    cc: message.cc ?? "",
    messageId: message.messageId ?? null,
    subject: message.subject,
    date: message.date ?? null,
    listId: message.listId ?? headers?.listId ?? null,
    listUnsubscribe: message.listUnsubscribe ?? headers?.listUnsubscribe ?? null,
    autoSubmitted: headers?.autoSubmitted ?? null,
    authenticationResults: headers?.authenticationResults ?? [],
    spamHeaders: headers?.spamHeaders ?? [],
    receivedAt: headers?.receivedAt ?? null,
    linkDomains: extractLinkDomains(text, message.htmlBody),
    maskedLinkDomains: extractMaskedLinkDomains(message.htmlBody),
    attachments: (message.attachments ?? []).slice(0, MAX_ATTACHMENTS)
      .map((attachment) => `${attachment.filename} (${attachment.contentType})`),
    text: capText(text)
  };
}
