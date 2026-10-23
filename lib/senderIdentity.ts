import addressParser from "nodemailer/lib/addressparser/index.js";
import * as punycode from "nodemailer/lib/punycode/index.js";

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.de",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "yahoo.com",
  "yahoo.de",
  "yahoo.co.uk",
  "gmx.de",
  "gmx.net",
  "web.de",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "mail.com"
]);

const SENDER_ICON_PALETTE = [
  { background: "#F7E3C6", foreground: "#7A3E00" },
  { background: "#DCEBFF", foreground: "#17428C" },
  { background: "#DFF4E8", foreground: "#165B3D" },
  { background: "#F5DDEB", foreground: "#7A1F4A" },
  { background: "#E8E1FF", foreground: "#432A87" },
  { background: "#F8E6D8", foreground: "#8A3F12" },
  { background: "#E4EEF0", foreground: "#27525C" },
  { background: "#EEE7D7", foreground: "#6B5420" }
] as const;

export type SenderIdentity = {
  displayName: string;
  email: string | null;
  domain: string | null;
  rootDomain: string | null;
  isFreeMailDomain: boolean;
  initials: string;
  paletteIndex: number;
};

/**
 * Collapses any whitespace run to a single space and trims both ends. Used to
 * normalize RFC 5322-style address strings before the other parsers in this
 * module inspect them — callers that want the same behavior for their own
 * preprocessing (e.g., before splitting lists) can import this directly
 * rather than rolling their own copy.
 */
export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeEmailAddress(value?: string | null) {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized || null;
}

export function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }
  return value;
}

export function extractDisplayName(value?: string | null) {
  const normalized = normalizeWhitespace(value ?? "");
  if (!normalized) return "";
  const ltIndex = normalized.lastIndexOf("<");
  if (ltIndex <= 0 || !normalized.endsWith(">")) return "";
  const rawName = normalizeWhitespace(normalized.slice(0, ltIndex));
  if (!rawName) return "";
  return stripWrappingQuotes(rawName);
}

// RFC 6531 extends atext and qtext with UTF-8; only the domain is punycoded.
const DOT_ATOM_LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~\x80-\u{10ffff}-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~\x80-\u{10ffff}-]+)*$/iu;
const QUOTED_LOCAL = /^"(?:[\x20\x21\x23-\x5b\x5d-\x7e\x80-\u{10ffff}]|\\[\x20-\x7e\x80-\u{10ffff}])*"$/u;

function formatMailboxLocalPart(local: string) {
  return DOT_ATOM_LOCAL.test(local) ? local : `"${local.replace(/["\\]/g, "\\$&")}"`;
}

/** Serialize a decoded mailbox without changing the local part's identity/case. */
export function formatMailboxAddress(value: string, localPartIsDecoded = false) {
  const at = value.lastIndexOf("@");
  if (at <= 0) return "";
  let local = value.slice(0, at);
  if (!localPartIsDecoded && QUOTED_LOCAL.test(local)) local = local.slice(1, -1).replace(/\\(.)/g, "$1");
  const address = `${formatMailboxLocalPart(local)}@${value.slice(at + 1)}`;
  return canonicalizeMailboxAddress(address) ? address : "";
}

const RFC5322_SPECIALS = /[(),.:;<>@[\]\\"]/;
// Whitespace separates words, so a failed phrase cannot cause nested repetition
// to backtrack over every possible split of an attacker-controlled atom.
const DISPLAY_WORD = String.raw`(?:[a-z0-9!#$%&'*+\-/=?^_\x60{|}~.\x80-\uffff]+|"(?:[\x20\x21\x23-\x5b\x5d-\x7e]|\\[\x20-\x7e])*")`;
const DISPLAY_PHRASE = new RegExp(`^(?:${DISPLAY_WORD}(?:\\s+${DISPLAY_WORD})*)?$`, "i");

/** Shared by ingestion and address menus; names never become mailbox syntax. */
export function formatAddress(displayName: string, email: string, localPartIsDecoded = false): string {
  const address = formatMailboxAddress(email, localPartIsDecoded);
  if (!address) return "";
  const name = displayName.trim();
  if (!name) return address;
  if (!RFC5322_SPECIALS.test(name)) return `${name} <${address}>`;
  return `"${name.replace(/(["\\])/g, "\\$1")}" <${address}>`;
}

/** Canonicalize one addr-spec, never a display name or an address list. */
export function canonicalizeMailboxAddress(value: string): string | null {
  const address = value.trim();
  const at = address.lastIndexOf("@");
  if (at <= 0) return null;
  let local = address.slice(0, at);
  if (QUOTED_LOCAL.test(local)) {
    local = local.slice(1, -1).replace(/\\(.)/g, "$1");
  } else if (!DOT_ATOM_LOCAL.test(local)) {
    return null;
  }
  if (!local || local.length > 64) return null;
  // Keep the existing case-insensitive sender policy, but retain every space
  // and special character in a quoted local part. The key is a valid addr-spec.
  local = local.toLowerCase();
  local = formatMailboxLocalPart(local);
  try {
    const domain = punycode.toASCII(address.slice(at + 1).toLowerCase());
    if (!domain || domain.length > 253 || !domain.split(".").every(label =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return null;
    return `${local}@${domain}`;
  } catch {
    return null;
  }
}

/** Retain the first mailbox's original spelling before the parser unquotes it. */
function firstMailboxSource(value: string, strict = false) {
  let mailbox = "";
  let inAngles = false;
  let closedAngles = false;
  let quoted = false;
  let comments = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if ((quoted || comments > 0) && char === "\\") {
      if (quoted) mailbox += value.slice(i, i + 2);
      i++;
      continue;
    }
    if (!quoted && char === "(") { comments++; continue; }
    if (comments > 0) { if (char === ")") comments--; continue; }
    if (char === '"') quoted = !quoted;
    if (!quoted && char === "<") {
      if (strict && (inAngles || closedAngles)) return "";
      // A display phrase may contain quoted strings and atoms, never an
      // unquoted address or unmatched quote/special left by an old formatter.
      if (strict && !DISPLAY_PHRASE.test(mailbox.trim())) return "";
      inAngles = true; mailbox = ""; continue;
    }
    if (!quoted && char === ">") {
      if (!strict && inAngles) return mailbox.trim();
      if (inAngles) { inAngles = false; closedAngles = true; continue; }
      if (strict) return "";
    }
    if (!quoted && !inAngles) {
      if (char === ":" && !closedAngles) {
        if (strict && !DISPLAY_PHRASE.test(mailbox.trim())) return "";
        mailbox = ""; continue; // RFC 5322 group label
      }
      if (char === "," || char === ";") return mailbox.trim();
    }
    if (closedAngles) {
      if (!/\s/.test(char)) return "";
      continue;
    }
    mailbox += char;
  }
  if (strict && (quoted || comments > 0 || inAngles)) return "";
  return mailbox.trim();
}

/** Permission decisions must not use the permissive parser's recovery guesses. */
export function extractUnambiguousPrimaryMailbox(value?: string | null) {
  const source = value ?? "";
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(source)) return null;
  const mailbox = firstMailboxSource(source, true);
  return canonicalizeMailboxAddress(mailbox) ? mailbox : null;
}

export function extractUnambiguousPrimaryEmail(value?: string | null) {
  const mailbox = extractUnambiguousPrimaryMailbox(value);
  return mailbox ? canonicalizeMailboxAddress(mailbox) : null;
}

/**
 * Splits an RFC 5322 address-list string on commas while respecting quoted
 * display names, angle-bracketed addresses and nested comments with escapes.
 */
export function splitAddressList(value: string | null | undefined): string[] {
  const text = (value ?? "").trim();
  if (!text) return [];
  const parts: string[] = [];
  let buf = "";
  let inQuotes = false;
  let inAngles = false;
  let comments = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ((inQuotes || comments > 0) && ch === "\\" && i + 1 < text.length) {
      buf += ch + text[i + 1];
      i += 1;
      continue;
    }
    if (!inQuotes && ch === "(") comments++;
    else if (comments > 0 && ch === ")") comments--;
    else if (comments === 0 && ch === '"') {
      inQuotes = !inQuotes;
      buf += ch;
      continue;
    }
    if (ch === "<" && !inQuotes && comments === 0) inAngles = true;
    else if (ch === ">" && !inQuotes && comments === 0) inAngles = false;
    if (ch === "," && !inQuotes && !inAngles && comments === 0) {
      const trimmed = buf.trim();
      if (trimmed) parts.push(trimmed);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const tail = buf.trim();
  if (tail) parts.push(tail);
  return parts;
}

export function extractPrimaryEmail(value?: string | null) {
  const source = value ?? "";
  // Nodemailer removes quotes (and trims their contents) from bare quoted
  // local parts. Preserve a valid original addr-spec before that lossy step,
  // including angle brackets or another @ inside its quoted local part.
  const mailboxSource = firstMailboxSource(source);
  // A comment or quoted display name alone is not a mailbox. Nodemailer's
  // permissive fallback can otherwise promote its address-shaped text.
  if (!mailboxSource || QUOTED_LOCAL.test(mailboxSource)) return null;
  const originalMailbox = canonicalizeMailboxAddress(mailboxSource);
  if (originalMailbox) return originalMailbox;
  // Use the mail stack's RFC 5322 parser: quoted display names may themselves
  // contain angle brackets and addresses, but never identify the mailbox.
  const mailbox = addressParser(source, { flatten: true })[0];
  return mailbox?.address ? canonicalizeMailboxAddress(mailbox.address) : null;
}

export function getRootDomain(domain?: string | null) {
  const normalized = normalizeEmailAddress(domain);
  if (!normalized) return null;
  const parts = normalized.split(".").filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  return normalized;
}

export function isFreeMailDomain(domain?: string | null) {
  const normalized = normalizeEmailAddress(domain);
  return normalized ? FREE_MAIL_DOMAINS.has(normalized) : false;
}

function computeInitialsSeed(identity: {
  displayName: string;
  email: string | null;
  rootDomain: string | null;
}) {
  return identity.displayName || identity.email || identity.rootDomain || "?";
}

export function getSenderInitials(identity: {
  displayName: string;
  email: string | null;
  rootDomain: string | null;
}) {
  const seed = computeInitialsSeed(identity);
  const wordInitials = seed
    .split(/[\s._@-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  if (wordInitials) return wordInitials;
  return seed.slice(0, 2).toUpperCase() || "?";
}

function getPaletteIndex(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % SENDER_ICON_PALETTE.length;
}

export function getSenderIconColors(paletteIndex: number) {
  return SENDER_ICON_PALETTE[paletteIndex] ?? SENDER_ICON_PALETTE[0];
}

export function getSenderIdentity(params: {
  from?: string | null;
  fromEmail?: string | null;
}) {
  const fromEmail = normalizeEmailAddress(params.fromEmail) ?? extractPrimaryEmail(params.from);
  const domain = fromEmail?.split("@")[1] ?? null;
  const rootDomain = getRootDomain(domain);
  const displayName = extractDisplayName(params.from);
  const initials = getSenderInitials({ displayName, email: fromEmail, rootDomain });
  const seed = computeInitialsSeed({ displayName, email: fromEmail, rootDomain });
  return {
    displayName,
    email: fromEmail,
    domain,
    rootDomain,
    isFreeMailDomain: isFreeMailDomain(domain),
    initials,
    paletteIndex: getPaletteIndex(seed)
  } satisfies SenderIdentity;
}
