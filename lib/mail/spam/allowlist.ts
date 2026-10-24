import { isFreeMailDomain } from "@/lib/senderIdentity";
import { parseAuthenticationResults } from "./senderProfile";
import type { SpamInput } from "./types";

/**
 * Hard allowlist: these senders are never classified as spam.
 * - addresses of every enrolled mailbox and sender identity, and the
 *   household's own domains (domains of enrolled mailboxes, free-mail
 *   providers excluded) — but only when SPF or DKIM passed for the sender's
 *   domain: a forged own-domain From is a known spam pattern and goes to the
 *   model instead (briefs/spam/static-rules-report.md §4),
 * - addresses the mailbox has written to (To/Cc of its Sent folder),
 * - senders whose latest user decision is "Kein Spam" (a later "Als Spam"
 *   decision also lifts the correspondent entry).
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

const inDomain = (candidate: string, domain: string) => candidate === domain || candidate.endsWith(`.${domain}`);

/**
 * Whether the receiving server's Authentication-Results show `spf=pass` or
 * `dkim=pass` for an identity in `domain`. Only the identity the method
 * authenticates counts, as for trusted senders (parseAuthenticationResults):
 * DKIM `header.d` (else `header.i`), SPF `smtp.mailfrom`. `smtp.helo`,
 * selectors, other properties and comments are chosen by the sender.
 */
export function senderAuthPassed(input: Pick<SpamInput, "authenticationResults">, domain: string) {
  const wanted = domain.trim().toLowerCase();
  if (!wanted) return false;
  return parseAuthenticationResults(input.authenticationResults).some((entry) =>
    entry.result === "pass" && (entry.method === "spf" || entry.method === "dkim") && !!entry.domain && inDomain(entry.domain, wanted));
}

export async function matchSpamAllowlist(input: SpamInput, context: SpamAllowlistContext): Promise<AllowlistMatch | null> {
  const email = input.fromEmail?.trim().toLowerCase();
  if (!email) return null;
  const domain = email.slice(email.lastIndexOf("@") + 1);
  if (context.ownAddresses.has(email) && senderAuthPassed(input, domain)) return "own-address";
  const ownDomain = [...context.ownDomains].find((own) => inDomain(domain, own));
  if (ownDomain && senderAuthPassed(input, ownDomain)) return "own-domain";
  const decision = await context.latestDecision(email);
  if (decision === "ham") return "user-decision";
  // An explicit "Als Spam" outranks having written to the sender once.
  if (decision !== "spam" && await context.isCorrespondent(email)) return "correspondent";
  return null;
}
