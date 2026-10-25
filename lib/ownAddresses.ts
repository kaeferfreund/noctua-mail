import type { Account, SenderIdentity } from "./data";
import addressParser from "nodemailer/lib/addressparser/index.js";

// Both parsers below are pure but costly (tokenizer, one URL per address). A message
// list derives sender and recipient labels from the same few header values hundreds
// of times per render, so results are memoized in small bounded caches. Long values
// (large recipient lists) are not kept.
const ADDRESS_MEMO_LIMIT = 2000;
const ADDRESS_MEMO_MAX_KEY_LENGTH = 512;

function memoizeAddressResult<T>(cache: Map<string, T>, key: string, compute: (key: string) => T): T {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = compute(key);
  if (key.length > ADDRESS_MEMO_MAX_KEY_LENGTH) return value;
  if (cache.size >= ADDRESS_MEMO_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, value);
  return value;
}

const normalizedIdentityEmails = new Map<string, string | null>();
const parsedAddressEmails = new Map<string, readonly string[]>();

/**
 * Canonical sender display name: trimmed, inner whitespace runs collapsed to one space.
 * Header parsers trim quoted names, so a stored trailing space would never match the draft.
 */
export function normalizeIdentityDisplayName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Canonical single addr-spec. Plus tags and dots are significant. */
export function normalizeIdentityEmail(value: string): string | null {
  return memoizeAddressResult(normalizedIdentityEmails, value, computeIdentityEmail);
}

function computeIdentityEmail(value: string): string | null {
  if (/[\x00-\x1f\x7f]/.test(value)) return null;
  const email = value.trim();
  if (email.length > 254 || !/^[^\s<>(),;:"\\@]+@[^\s<>(),;:"\\@]+$/.test(email)) return null;
  const [local, domain] = email.split("@");
  if (!/^[\p{L}\p{M}\p{N}.-]+$/u.test(domain)) return null;
  if (!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(local)) return null;
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  try {
    const asciiDomain = new URL(`http://${domain}`).hostname.toLowerCase();
    if (!asciiDomain.includes(".") || asciiDomain.length > 253 ||
        !asciiDomain.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
    const normalized = `${local.toLowerCase()}@${asciiDomain}`;
    return normalized.length <= 254 ? normalized : null;
  } catch { return null; }
}

/** Parse complete address entries, never substring-match another mailbox. */
export function parseAddressEmails(value?: string | null): string[] {
  if (!value) return [];
  // Callers own the returned array; the memoized entry stays untouched.
  return memoizeAddressResult(parsedAddressEmails, value, computeAddressEmails).slice();
}

function computeAddressEmails(value: string): readonly string[] {
  // HTAB is legal observed folding whitespace; configuration remains strict.
  if (/[\x00-\x08\x0a-\x1f\x7f]/.test(value)) return [];
  // This dependency-free Nodemailer submodule also runs in the browser. Its
  // mailbox parser separates comments, quoted names and groups from addr-specs.
  // Remove CFWS comments (including nested comments) and quoted display text
  // first. The parser's permissive name-only fallback must not invent mailboxes
  // from a comment or a quoted display name without an actual address.
  let mailboxSyntax = "";
  let commentDepth = 0;
  let quoted = false;
  let escaped = false;
  for (const char of value) {
    if (escaped) { escaped = false; continue; }
    if ((quoted || commentDepth > 0) && char === "\\") { escaped = true; continue; }
    if (!commentDepth && char === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (char === "(") { commentDepth++; continue; }
    if (char === ")" && commentDepth) { commentDepth--; continue; }
    if (!commentDepth) mailboxSyntax += char;
  }
  if (commentDepth || quoted) return [];
  return addressParser(mailboxSyntax, { flatten: true }).flatMap(entry => {
    const email = normalizeIdentityEmail(entry.address);
    return email ? [email] : [];
  });
}

export function getOwnAddresses(
  account: Pick<Account, "email" | "id"> & { ownAddresses?: readonly string[] },
  identities: readonly Pick<SenderIdentity, "email" | "accountId">[] = []
): string[] {
  return [...new Set([account.email, ...(account.ownAddresses ?? []),
    ...identities.filter(identity => identity.accountId === account.id).map(identity => identity.email)]
    .flatMap(email => normalizeIdentityEmail(email) ?? []))];
}

export function isOwnAddress(value: string | null | undefined, ownAddresses: readonly string[]): boolean {
  return ownAddressMatcher(ownAddresses)(value);
}

/** `isOwnAddress` with the own-address set normalized once, for checking many values. */
export function ownAddressMatcher(ownAddresses: readonly string[]): (value: string | null | undefined) => boolean {
  const own = new Set(ownAddresses.map(email => normalizeIdentityEmail(email)).filter(Boolean));
  return value => parseAddressEmails(value).some(email => own.has(email));
}

export type OwnAddressInput = string | readonly string[] | null | undefined;
/** Compatibility at single-address seams while all callers carry the mailbox set. */
export function ownAddressList(input: OwnAddressInput): string[] {
  return [...new Set((typeof input === "string" ? [input] : input ?? [])
    .flatMap(email => normalizeIdentityEmail(email) ?? []))];
}
