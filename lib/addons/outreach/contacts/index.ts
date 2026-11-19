/**
 * Contacts area (owner: contacts task). Public surface used by the other areas.
 * The signatures are the contract; the bodies below are placeholders of the base branch.
 */
import type { SuppressionReason } from "../types";

export type SendableRecipient = {
  contactId: string;
  email: string;
  firstName: string;
  lastName: string;
  properties: Record<string, string | number | boolean>;
};

/**
 * Everyone a campaign may reach: `subscribed` member of at least one of `listIds`, not a
 * `subscribed` member of any of `excludedListIds`, `emailConsent = 'subscribed'`, not
 * suppressed. One entry per address.
 */
export async function listSendableRecipients(accountId: string, selection: { listIds: readonly string[]; excludedListIds?: readonly string[] }): Promise<SendableRecipient[]> {
  void accountId; void selection;
  return [];
}

/**
 * The same rule for one contact, re-checked immediately before each send. With `listId` the
 * contact must still be subscribed to that list (sequence steps). `null` = do not mail.
 */
export async function getSendableRecipient(accountId: string, contactId: string, options: { listId?: string | null } = {}): Promise<SendableRecipient | null> {
  void accountId; void contactId; void options;
  return null;
}

/**
 * Unsubscribe links of one send: `url` opens the confirmation page (`GET /t/u/<token>`),
 * `oneClickUrl` is the RFC 8058 target (`POST /t/u/<token>`). `null` without a public origin —
 * the caller must then NOT send a campaign or sequence mail.
 */
export async function createUnsubscribeUrls(accountId: string, target: { sendId: string; contactId: string; listId?: string | null }): Promise<{ url: string; oneClickUrl: string } | null> {
  void accountId; void target;
  return null;
}

/** Marks a contact (by id or address) as never-mail and tells the sending area. Idempotent; unknown addresses are stored as suppressed contacts. */
export async function suppressContact(accountId: string, target: { contactId?: string; email?: string; reason: SuppressionReason; at?: number }): Promise<void> {
  void accountId; void target;
}
