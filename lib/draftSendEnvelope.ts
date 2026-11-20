// Pure helper for building the SMTP envelope recipient list from a draft's
// parsed `to` / `cc` / `bcc` strings. Extracted so `lib/drafts.ts` —
// which is hard to unit-test because it reaches into the DB, IMAP, and
// SMTP transports — can pass through to a tested function for the
// address-parsing portion of draft-send.
//
// Addresses come from the shared RFC 5322 mailbox parser
// (`parseEnvelopeAddresses`): quoted display names and comments are removed
// before parsing, so a display name such as `"Eve, eve@example.test"` can
// never become an envelope recipient.

import { parseEnvelopeAddresses } from "@/lib/ownAddresses";

export type DraftSendEnvelopeInput = {
  to?: string | null;
  cc?: string | null;
  bcc?: string | null;
};

/**
 * Build the SMTP envelope recipient list (unique, combining `to` + `cc`
 * + `bcc`). Returns an empty array if no address is parseable — the
 * caller is expected to reject the send in that case.
 *
 * Dedup is case-insensitive (so `User@x.com` and `USER@x.com` don't
 * both end up in the envelope), but the original casing of the first
 * occurrence is preserved. Per RFC 5321 §4.1.2 only the domain part is
 * required to be case-insensitive; local-parts are technically case-
 * sensitive, and some SMTP servers (including a handful of enterprise
 * mail systems) treat them that way. Lowercasing here would change the
 * actual `RCPT TO` address, which could bounce a message that would
 * have delivered with the user's original casing.
 */
export function buildDraftSendEnvelopeRecipients(
  draft: DraftSendEnvelopeInput
): string[] {
  const merged = [
    ...parseEnvelopeAddresses(draft.to),
    ...parseEnvelopeAddresses(draft.cc),
    ...parseEnvelopeAddresses(draft.bcc)
  ];
  const byLowercase = new Map<string, string>();
  for (const address of merged) {
    const key = address.toLowerCase();
    if (!byLowercase.has(key)) {
      byLowercase.set(key, address);
    }
  }
  return Array.from(byLowercase.values());
}

/**
 * True when at least one of `to` / `cc` / `bcc` has a parseable address.
 * Checked before send — mirrors `/api/accounts/[accountId]/smtp/send`'s
 * own guard so list-level draft send and compose-editor send reject the
 * same empty-recipient case.
 */
export function draftHasSendableRecipients(draft: DraftSendEnvelopeInput): boolean {
  return buildDraftSendEnvelopeRecipients(draft).length > 0;
}
