import type { Account, SenderIdentity } from "./data";
import { splitRecipientEntries } from "./recipientLists";

/** Canonical single addr-spec. Plus tags and dots are significant. */
export function normalizeIdentityEmail(value: string): string | null {
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
  return splitRecipientEntries(value ?? "").flatMap(entry => {
    const angle = entry.match(/^[^<>]*<([^<>]+)>\s*$/);
    const email = normalizeIdentityEmail(angle ? angle[1] : entry);
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
  const own = new Set(ownAddresses.map(email => normalizeIdentityEmail(email)).filter(Boolean));
  return parseAddressEmails(value).some(email => own.has(email));
}

export type OwnAddressInput = string | readonly string[] | null | undefined;
/** Compatibility at single-address seams while all callers carry the mailbox set. */
export function ownAddressList(input: OwnAddressInput): string[] {
  return [...new Set((typeof input === "string" ? [input] : input ?? [])
    .flatMap(email => normalizeIdentityEmail(email) ?? []))];
}
