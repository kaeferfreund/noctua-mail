// IMAP body-structure and header/envelope parsing helpers.
//
// Public surface (re-exported from the barrel index.ts): ImapBodyStructure
// (itself re-exported from _shared) and extractMessageStructureMetadata.
//
// The remaining helpers in this file (formatEnvelopeAddresses,
// parseHeaderMap, resolveHeaderDate, etc.) are intentionally exported so
// lib/mail/imap/sync.ts can consume them across file boundaries, but they
// are NOT re-exported from the barrel — they remain an internal API of the
// imap/ subtree.

import type { Account } from "@/lib/data";
import addressParser from "nodemailer/lib/addressparser/index.js";
import { canonicalizeMailboxAddress, extractUnambiguousPrimaryEmail, extractUnambiguousPrimaryMailbox, formatAddress, formatMailboxAddress, splitAddressList } from "@/lib/senderIdentity";
import type { ImapBodyStructure, ImapEnvelope, ImapEnvelopeAddress } from "./_shared";

export type { ImapBodyStructure } from "./_shared";

export function formatEnvelopeAddresses(addresses?: ImapEnvelopeAddress[] | null) {
  if (!addresses || addresses.length === 0) return "";
  const parts: string[] = [];
  for (const addr of addresses) {
    const email = addr?.address || (addr?.mailbox && addr?.host ? `${addr.mailbox}@${addr.host}` : "");
    if (!email) continue; // IMAP group delimiters have no mailbox.
    const formatted = formatAddress(addr?.name ?? "", email, true);
    // Never discard a malformed first mailbox and promote a later one.
    if (!formatted) return "";
    parts.push(formatted);
  }
  return parts.join(", ");
}

export function formatHeaderAddresses(value?: string | null) {
  if (!value) return "";
  const sources = splitAddressList(value).map(extractUnambiguousPrimaryMailbox);
  const addresses = addressParser(value, { flatten: true });
  if (sources.length !== addresses.length || sources.some(source => !source)) return "";
  // addressparser removes quotes and trims quoted local parts. Restore their
  // original spelling before serialization so no mailbox characters are lost.
  return addresses.map((address, index) => formatAddress(address.name ?? "", sources[index]!)).join(", ");
}

/** Derive identity from parsed wire data, never from a stored display string. */
export function resolveMessageSenderKey(envelope: ImapEnvelope | undefined, headers: Map<string, string[]>) {
  if (envelope?.from?.length) {
    const first = envelope.from.find(address => address.address || (address.mailbox && address.host));
    if (!first) return null;
    const mailbox = first.address || `${first.mailbox}@${first.host}`;
    return canonicalizeMailboxAddress(formatMailboxAddress(mailbox, true));
  }
  return extractUnambiguousPrimaryEmail(getHeaderValue(headers, "from"));
}

export function resolveMessageAddresses(
  envelope: ImapEnvelope | undefined,
  headers: Map<string, string[]>,
  fallbackFrom: string
) {
  const resolve = (field: "from" | "to" | "cc" | "bcc") => {
    if (envelope?.[field]?.length) return formatEnvelopeAddresses(envelope[field]);
    const header = getHeaderValue(headers, field);
    if (header !== undefined) return formatHeaderAddresses(header);
    return field === "from" ? formatAddress("", fallbackFrom) : "";
  };
  return {
    senderKey: resolveMessageSenderKey(envelope, headers),
    from: resolve("from"), to: resolve("to"), cc: resolve("cc"), bcc: resolve("bcc"),
    replyTo: formatHeaderAddresses(getHeaderValue(headers, "reply-to")) || undefined
  };
}

export function normalizeEnvelopeHeaderId(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function resolveEnvelopeInReplyTo(envelope?: ImapEnvelope) {
  const raw = envelope?.inReplyTo;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const normalized = normalizeEnvelopeHeaderId(typeof item === "string" ? item : null);
      if (normalized) return normalized;
    }
    return undefined;
  }
  if (typeof raw === "string") return normalizeEnvelopeHeaderId(raw);
  return undefined;
}

export function resolveEnvelopeAddressEmail(address?: ImapEnvelopeAddress | null) {
  if (!address) return "";
  const direct = address.address?.trim();
  if (direct) return direct;
  if (address.mailbox && address.host) {
    return `${address.mailbox}@${address.host}`;
  }
  return "";
}

export function parseHeaderMap(raw?: Buffer) {
  const map = new Map<string, string[]>();
  if (!raw || raw.length === 0) return map;
  const unfolded: string[] = [];
  const lines = raw.toString("utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line) break;
    if (/^\s/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] = `${unfolded[unfolded.length - 1]} ${line.trim()}`;
      continue;
    }
    unfolded.push(line);
  }
  unfolded.forEach((line) => {
    const separator = line.indexOf(":");
    if (separator <= 0) return;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(value);
  });
  return map;
}

export function getHeaderValue(headers: Map<string, string[]>, key: string) {
  const values = headers.get(key.toLowerCase());
  if (!values || values.length === 0) return undefined;
  return values[0];
}

export function getHeaderValues(headers: Map<string, string[]>, key: string) {
  return headers.get(key.toLowerCase()) ?? [];
}

export function parseHeaderMessageIdList(value?: string) {
  if (!value) return undefined;
  const bracketMatches = value.match(/<[^>]+>/g);
  if (bracketMatches && bracketMatches.length > 0) {
    const normalized = bracketMatches
      .map((item) => normalizeEnvelopeHeaderId(item))
      .filter((item): item is string => Boolean(item));
    return normalized.length > 0 ? normalized : undefined;
  }
  const normalized = value
    .split(/\s+/)
    .map((item) => normalizeEnvelopeHeaderId(item))
    .filter((item): item is string => Boolean(item));
  return normalized.length > 0 ? normalized : undefined;
}

export function resolveHeaderInReplyTo(headers: Map<string, string[]>) {
  const values = getHeaderValues(headers, "in-reply-to");
  for (const value of values) {
    const parsed = parseHeaderMessageIdList(value);
    if (parsed && parsed.length > 0) return parsed[0];
  }
  return undefined;
}

export function resolveHeaderDate(headers: Map<string, string[]>) {
  const dateHeader = getHeaderValue(headers, "date");
  if (dateHeader) {
    const parsedDate = new Date(dateHeader);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
  }
  const receivedHeaders = getHeaderValues(headers, "received");
  for (const value of receivedHeaders) {
    const match = value.match(/;\s*(.+)$/);
    if (!match?.[1]) continue;
    const parsedDate = new Date(match[1].trim());
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
  }
  return undefined;
}

function choosePreferredTextPart(parts: string[]) {
  if (parts.length === 0) return undefined;
  const sorted = [...parts].sort((left, right) => {
    const leftDepth = left.split(".").length;
    const rightDepth = right.split(".").length;
    if (leftDepth !== rightDepth) return leftDepth - rightDepth;
    return left.localeCompare(right);
  });
  return sorted[0];
}

export function extractMessageStructureMetadata(
  account: Account,
  uid: number,
  bodyStructure?: ImapBodyStructure
) {
  const attachments: Array<{
    id: string;
    filename: string;
    contentType: string;
    size: number;
    inline: boolean;
    cid?: string;
    partKey?: string;
  }> = [];
  const plainTextParts: string[] = [];
  const htmlParts: string[] = [];
  let attachmentIndex = 0;

  const walk = (node?: ImapBodyStructure) => {
    if (!node) return;
    const children = Array.isArray(node.childNodes) ? node.childNodes : [];
    if (children.length > 0) {
      children.forEach((child) => walk(child));
      return;
    }

    const contentType = (node.type ?? "").toLowerCase().trim();
    const disposition = (node.disposition ?? "").toLowerCase().trim();
    const filename =
      node.dispositionParameters?.filename ?? node.parameters?.name ?? undefined;
    const cid = node.id?.replace(/[<>]/g, "").trim() || undefined;
    const isTextPlain = contentType === "text/plain";
    const isTextHtml = contentType === "text/html";
    const partKey =
      typeof node.part === "string" && node.part.trim().length > 0
        ? node.part
        : isTextPlain || isTextHtml
          ? "1"
          : "";

    const isBodyTextPart =
      (isTextPlain || isTextHtml) &&
      disposition !== "attachment" &&
      !filename &&
      !cid;
    if (partKey && isBodyTextPart) {
      if (isTextPlain && !plainTextParts.includes(partKey)) plainTextParts.push(partKey);
      if (isTextHtml && !htmlParts.includes(partKey)) htmlParts.push(partKey);
    }

    const shouldTreatAsAttachment =
      disposition === "attachment" ||
      Boolean(filename) ||
      (Boolean(cid) && !isTextPlain && !isTextHtml) ||
      (contentType.length > 0 && !isTextPlain && !isTextHtml);

    if (!shouldTreatAsAttachment) return;

    const index = attachmentIndex++;
    attachments.push({
      id: `att-${account.id}-${uid}-${index}`,
      filename: filename ?? `attachment-${index + 1}`,
      contentType: contentType || "application/octet-stream",
      size: typeof node.size === "number" && Number.isFinite(node.size) ? node.size : 0,
      inline: disposition === "inline" || Boolean(cid),
      cid,
      partKey:
        typeof node.part === "string" && node.part.trim().length > 0
          ? node.part
          : contentType
            ? "1"
            : undefined
    });
  };

  walk(bodyStructure);
  return {
    attachments,
    plainTextPart: choosePreferredTextPart(plainTextParts),
    htmlPart: choosePreferredTextPart(htmlParts)
  };
}
