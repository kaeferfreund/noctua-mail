import { simpleParser } from "mailparser";
import type { Message, SenderIdentity } from "./data";
import { normalizeIdentityDisplayName, normalizeIdentityEmail, parseAddressEmails } from "./ownAddresses";
import { configuredReplyTo, IDENTITY_HEADER } from "./sendIdentity";
import { SenderIdentityError } from "./senderIdentityError";

function changed(): never {
  throw new SenderIdentityError("draft_identity_changed", 409, "Open this draft, review From, and save it again.");
}
function unavailable(): never {
  throw new SenderIdentityError("identity_unavailable", 409, "The draft sender identity is unavailable. Choose an enabled identity and save it again.");
}

/**
 * The From display name as the header carries it. A name equal to the address (default
 * identities use their address as name) counts as none: the MIME parser drops it from
 * `"a@example.test" <a@example.test>`, so both sides are compared without it. Whitespace is
 * normalized on both sides: the parser trims quoted names, legacy rows may carry extra spaces.
 */
function fromDisplayName(name: string, email: string) {
  const normalized = normalizeIdentityDisplayName(name);
  return normalizeIdentityEmail(normalized) === email ? "" : normalized;
}

/** Inspect outer headers, including duplicates the MIME parser would collapse. */
export async function validateDraftIdentity(raw: string, draft: Message, identities: readonly SenderIdentity[]) {
  const headerBlock = raw.split(/\r?\n\r?\n/, 1)[0];
  if (/\r(?!\n)/.test(headerBlock)) changed();
  const headers = new Map<string, string[]>();
  for (const line of headerBlock.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const match = /^([!-9;-~]+):[ \t]*(.*)$/.exec(line);
    if (!match) changed();
    const key = match[1].toLowerCase();
    headers.set(key, [...(headers.get(key) ?? []), match[2]]);
  }
  if (headers.get("from")?.length !== 1 || [...headers.keys()].some(key => key.startsWith("resent-"))) changed();
  const markers = headers.get(IDENTITY_HEADER.toLowerCase()) ?? [];
  if (markers.length > 1 || markers.some(marker => !marker.length || marker.length > 256)) changed();
  const parsed = await simpleParser(raw);
  const from = parsed.from?.value;
  if (from?.length !== 1 || !from[0].address || parseAddressEmails(headers.get("from")![0]).length !== 1) changed();
  const email = normalizeIdentityEmail(from[0].address);
  const candidates = identities.filter(item => item.accountId === draft.accountId);
  const marker = markers[0];
  const identity = marker ? candidates.find(item => item.id === marker) : candidates.find(item => item.email === email);
  if (!identity || !identity.enabled) unavailable();
  if (identity.email !== email || fromDisplayName(from[0].name, email) !== fromDisplayName(identity.displayName, identity.email)) changed();
  if (draft.senderIdentityId !== undefined && draft.senderIdentityId !== marker) changed();
  const metadataFrom = parseAddressEmails(draft.from);
  if (metadataFrom.length !== 1 || metadataFrom[0] !== email) changed();
  const senders = headers.get("sender") ?? [];
  if (senders.length > 1 || senders.some(value => {
    const addresses = parseAddressEmails(value);
    return addresses.length !== 1 || addresses[0] !== email;
  })) changed();
  const replyHeaders = headers.get("reply-to") ?? [];
  const replyTo = configuredReplyTo(identity);
  if (replyHeaders.length > 1 || (replyTo ? replyHeaders.length !== 1 : replyHeaders.length !== 0)) changed();
  if (replyTo && (parsed.replyTo?.value.length !== 1 || parsed.replyTo.value[0].address !== replyTo)) changed();
  const metadataReply = parseAddressEmails(draft.replyTo);
  if (replyTo ? metadataReply.length !== 1 || metadataReply[0] !== replyTo : Boolean(draft.replyTo)) changed();
  return identity;
}
