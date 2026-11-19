/** Public contacts surface shared with the other outreach areas. */
import { getOutreachDb } from "../db";

export { createUnsubscribeUrls } from "./unsubscribe";
export { suppressContact } from "./consent";

export type SendableRecipient = {
  contactId: string;
  email: string;
  firstName: string;
  lastName: string;
  properties: Record<string, string | number | boolean>;
};

type RecipientRow = Omit<SendableRecipient, "properties"> & { properties: string };

const mailable = `SELECT c.id AS contactId, c.email, c.firstName, c.lastName, c.properties FROM contacts c
  WHERE c.accountId = ?1 AND c.emailConsent = 'subscribed' AND c.suppressedReason IS NULL`;
const subscribedMembership = `SELECT 1 FROM list_members m JOIN lists l ON l.accountId = m.accountId AND l.id = m.listId
  WHERE m.accountId = c.accountId AND m.contactId = c.id AND m.status = 'subscribed'`;

function recipient(row: RecipientRow): SendableRecipient {
  return { ...row, properties: JSON.parse(row.properties) };
}

/** Include subscribers in any selected list and omit subscribers in any excluded list. */
export async function listSendableRecipients(accountId: string, selection: { listIds: readonly string[]; excludedListIds?: readonly string[] }): Promise<SendableRecipient[]> {
  if (!selection.listIds.length) return [];
  const db = await getOutreachDb();
  const rows = db.query(`${mailable}
    AND EXISTS (${subscribedMembership} AND l.archivedAt IS NULL AND m.listId IN (SELECT value FROM json_each(?2)))
    AND NOT EXISTS (${subscribedMembership} AND m.listId IN (SELECT value FROM json_each(?3)))
    ORDER BY c.emailLower`).all(accountId, JSON.stringify(selection.listIds), JSON.stringify(selection.excludedListIds ?? [])) as RecipientRow[];
  return rows.map(recipient);
}

/** Re-check consent and optional list membership immediately before delivery. */
export async function getSendableRecipient(accountId: string, contactId: string, options: { listId?: string | null } = {}): Promise<SendableRecipient | null> {
  const db = await getOutreachDb();
  const row = db.query(`${mailable} AND c.id = ?2
    AND (?3 IS NULL OR EXISTS (${subscribedMembership} AND l.archivedAt IS NULL AND m.listId = ?3))`).get(accountId, contactId, options.listId ?? null) as RecipientRow | null;
  return row ? recipient(row) : null;
}
