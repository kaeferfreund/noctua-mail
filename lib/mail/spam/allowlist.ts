import { isFreeMailDomain } from "@/lib/senderIdentity";
import type { SpamInput } from "./types";

/**
 * Hard allowlist: these senders are never classified as spam.
 * - addresses of every enrolled mailbox and sender identity,
 * - the household's own domains (domains of enrolled mailboxes, free-mail
 *   providers excluded),
 * - addresses the mailbox has written to (To/Cc of its Sent folder),
 * - senders whose latest user decision is "Kein Spam" (a later "Als Spam"
 *   decision also lifts the correspondent entry).
 * Own addresses and domains do not count when DMARC failed: a forged
 * own-domain From is a common phishing pattern and goes to the model instead.
 */
export type SpamAllowlistContext = {
  ownAddresses: ReadonlySet<string>;
  ownDomains: ReadonlySet<string>;
  isCorrespondent: (email: string) => Promise<boolean>;
  latestDecision: (email: string) => Promise<"spam" | "ham" | null>;
};

export type AllowlistMatch = "own-address" | "own-domain" | "correspondent" | "user-decision";

export function buildOwnIdentitySets(addresses: Iterable<string>) {
  const ownAddresses = new Set<string>();
  const ownDomains = new Set<string>();
  for (const raw of addresses) {
    const address = raw.trim().toLowerCase();
    if (!address.includes("@")) continue;
    ownAddresses.add(address);
    const domain = address.slice(address.lastIndexOf("@") + 1);
    if (domain && !isFreeMailDomain(domain)) ownDomains.add(domain);
  }
  return { ownAddresses, ownDomains };
}

export function dmarcFailed(input: Pick<SpamInput, "authenticationResults">) {
  return input.authenticationResults.some((line) => /\bdmarc\s*=\s*fail\b/i.test(line));
}

export async function matchSpamAllowlist(input: SpamInput, context: SpamAllowlistContext): Promise<AllowlistMatch | null> {
  const email = input.fromEmail?.trim().toLowerCase();
  if (!email) return null;
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (!dmarcFailed(input)) {
    if (context.ownAddresses.has(email)) return "own-address";
    if (context.ownDomains.has(domain)) return "own-domain";
  }
  const decision = await context.latestDecision(email);
  if (decision === "ham") return "user-decision";
  // An explicit "Als Spam" outranks having written to the sender once.
  if (decision !== "spam" && await context.isCorrespondent(email)) return "correspondent";
  return null;
}
