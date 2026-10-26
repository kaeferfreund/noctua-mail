import { createHash } from "node:crypto";
import type { Message } from "./data";
import { buildDraftSendEnvelopeRecipients } from "./draftSendEnvelope";
import { parseAddressEmails } from "./ownAddresses";

const envelopeAddresses = (value?: string | null) =>
  buildDraftSendEnvelopeRecipients({ to: value }).map(address => address.toLowerCase()).sort();

/** Bind both the MIME source and the parsed SMTP envelope to what the user planned. */
export function scheduledDraftFingerprint(draft: Pick<Message, "messageId" | "from" | "to" | "cc" | "bcc">, rawSource: string) {
  // IMAP resync changes display-name quoting and absent fields, not the delivery.
  // Reuse the send path's recipient extraction so every actual RCPT TO stays bound;
  // raw MIME bytes still detect content/header edits, including display-name changes.
  return createHash("sha256").update(JSON.stringify([
    rawSource, draft.messageId ?? null, parseAddressEmails(draft.from).sort(),
    envelopeAddresses(draft.to), envelopeAddresses(draft.cc), envelopeAddresses(draft.bcc)
  ])).digest("hex");
}
