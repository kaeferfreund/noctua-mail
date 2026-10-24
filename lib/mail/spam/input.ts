import { convert as htmlToTextConvert } from "html-to-text";
import { isQuoteBoundaryText } from "@/lib/html/quoteBoundary";
import { normalizeIdentityEmail, parseAddressEmails } from "@/lib/ownAddresses";
import { extractDisplayName } from "@/lib/senderIdentity";
import type { SpamInput } from "./types";

export const SPAM_TEXT_LIMIT = 4096;
const HEADER_VALUE_LIMIT = 600;
const MAX_SPAM_HEADERS = 12;
const MAX_LINK_DOMAINS = 30;
const MAX_ATTACHMENTS = 10;

/** Drops "> " lines and everything from the first reply attribution / forward marker. */
export function stripQuotedText(text: string) {
  const kept: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*>/.test(line)) continue;
    if (isQuoteBoundaryText(line)) break;
    kept.push(line.trimEnd());
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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

function capText(text: string) {
  return stripQuotedText(text).replace(/[ \t]+/g, " ").slice(0, SPAM_TEXT_LIMIT);
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
  subject?: string;
  date?: Date;
  text?: string;
  html?: string | false;
  headerLines?: ReadonlyArray<{ key: string; line: string }>;
  attachments?: ReadonlyArray<{ filename?: string; contentType: string }>;
};

const unfold = (value: string) => value.replace(/\r?\n[ \t]+/g, " ").trim().slice(0, HEADER_VALUE_LIMIT);

function addressText(value: ParsedSpamSource["to"]) {
  if (!value) return "";
  return (Array.isArray(value) ? value : [value]).map((entry) => entry.text ?? "").filter(Boolean).join(", ");
}

/** Builds the classifier input from a parsed RFC 822 source. */
export function buildSpamInput(parsed: ParsedSpamSource): SpamInput {
  const lines = (parsed.headerLines ?? []).map((header) => ({
    key: header.key.toLowerCase(),
    value: unfold(header.line.slice(header.line.indexOf(":") + 1))
  }));
  const header = (key: string) => lines.find((line) => line.key === key)?.value ?? null;
  const from = parsed.from?.text ?? "";
  const plain = parsed.text?.trim()
    ? parsed.text
    : typeof parsed.html === "string" ? htmlToTextConvert(parsed.html, { wordwrap: false, selectors: [{ selector: "img", format: "skip" }] }) : "";
  return {
    from,
    ...firstMailbox(from),
    replyTo: parsed.replyTo?.text || null,
    to: addressText(parsed.to),
    subject: parsed.subject ?? "",
    date: parsed.date ? parsed.date.toISOString() : null,
    listId: header("list-id"),
    listUnsubscribe: header("list-unsubscribe"),
    authenticationResults: lines.filter((line) => line.key === "authentication-results").map((line) => line.value),
    spamHeaders: lines.filter((line) => line.key.startsWith("x-spam")).slice(0, MAX_SPAM_HEADERS)
      .map((line) => `${line.key}: ${line.value}`),
    linkDomains: extractLinkDomains(plain, typeof parsed.html === "string" ? parsed.html : null),
    attachments: (parsed.attachments ?? []).slice(0, MAX_ATTACHMENTS)
      .map((attachment) => `${attachment.filename || "(ohne Namen)"} (${attachment.contentType})`),
    text: capText(plain)
  };
}

/** Fallback when no stored source exists: the columns the message row keeps. */
export function buildSpamInputFromMessage(message: {
  from: string; to: string; subject: string; date?: string | null; replyTo?: string | null;
  listId?: string | null; listUnsubscribe?: string | null; body?: string | null;
  attachments?: Array<{ filename: string; contentType: string }>;
}): SpamInput {
  const text = message.body ?? "";
  return {
    from: message.from,
    ...firstMailbox(message.from),
    replyTo: message.replyTo ?? null,
    to: message.to,
    subject: message.subject,
    date: message.date ?? null,
    listId: message.listId ?? null,
    listUnsubscribe: message.listUnsubscribe ?? null,
    authenticationResults: [],
    spamHeaders: [],
    linkDomains: extractLinkDomains(text),
    attachments: (message.attachments ?? []).slice(0, MAX_ATTACHMENTS)
      .map((attachment) => `${attachment.filename} (${attachment.contentType})`),
    text: capText(text)
  };
}
