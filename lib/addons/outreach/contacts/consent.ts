import type { Database } from "bun:sqlite";
import { getOutreachDb } from "../db";
import { enrollListSubscription, onContactUnmailable } from "../sending";
import type { ListMemberStatus, SubscriptionChange, SuppressionReason } from "../types";
import { ContactError, emailSchema, parseContactInput } from "./input";
import { findContact, findContactByEmail, getContactDetail, insertContact, rememberErasedAddress, requireContact, requireList, type ContactRow } from "./records";

type Member = { status: ListMemberStatus; subscribedAt: number | null; unsubscribedAt: number | null };
type ConsentState = Pick<ContactRow, "emailConsent" | "consentAt" | "suppressedReason" | "unsubscribedAt">;

export function subscriptionDecision(contact: ConsentState, membership: Member | null, at: number, freshConsent: boolean) {
  if (contact.suppressedReason) return "contact_suppressed";
  // The newest global unsubscribe counts for every list, also after a re-subscription to one of them.
  const unsubscribedAt = Math.max(
    contact.unsubscribedAt ?? -1,
    contact.emailConsent === "unsubscribed" ? contact.consentAt ?? 0 : -1,
    membership?.unsubscribedAt ?? -1
  );
  if (unsubscribedAt >= 0 && (!freshConsent || at <= unsubscribedAt)) return "new_consent_required";
  return "subscribe";
}

export function getMembership(db: Database, accountId: string, contactId: string, listId: string): Member | null {
  return db.query(`
    SELECT status, subscribedAt, unsubscribedAt FROM list_members WHERE accountId = ? AND contactId = ? AND listId = ?
  `).get(accountId, contactId, listId) as Member | null;
}

export function writeMembership(db: Database, accountId: string, contactId: string, listId: string, member: Member, source: string) {
  db.query(`INSERT INTO list_members (accountId, contactId, listId, status, subscribedAt, unsubscribedAt, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(listId, contactId) DO UPDATE SET status = excluded.status, subscribedAt = excluded.subscribedAt,
      unsubscribedAt = excluded.unsubscribedAt, source = excluded.source
    WHERE list_members.accountId = excluded.accountId`)
    .run(accountId, contactId, listId, member.status, member.subscribedAt, member.unsubscribedAt, source);
}

/** Call inside the caller's write transaction to commit membership and enrollment together. */
export function subscribeToList(db: Database, contact: ContactRow, listId: string,
  consent: { at: number; source: string; explicit: boolean }, now: number) {
  const { accountId, id: contactId } = contact;
  const member = getMembership(db, accountId, contactId, listId);
  // An already active membership is a retry. Preserve the original consent and enrollment.
  if (!contact.suppressedReason && contact.emailConsent === "subscribed" && member?.status === "subscribed") return;
  const decision = subscriptionDecision(contact, member, consent.at, consent.explicit);
  if (decision === "contact_suppressed") throw new ContactError("Contact is suppressed", 409, decision);
  if (decision === "new_consent_required") throw new ContactError("New consent after the unsubscribe is required", 409, decision);
  if (contact.emailConsent !== "subscribed" || contact.consentAt === null || consent.at > contact.consentAt) {
    db.query(`UPDATE contacts SET emailConsent = 'subscribed', consentAt = ?, consentSource = ?, updatedAt = ?
      WHERE accountId = ? AND id = ?`).run(consent.at, consent.source, now, accountId, contactId);
  }
  if (member?.status === "subscribed") return;
  writeMembership(db, accountId, contactId, listId, {
    status: "subscribed", subscribedAt: consent.at, unsubscribedAt: null
  }, consent.source);
  enrollListSubscription(db, accountId, { contactId, listId, at: now });
}

export async function notifyContactUnmailable(accountId: string, contactId: string) {
  try {
    await onContactUnmailable(accountId, contactId);
  } catch {
    console.warn("Outreach failed to notify sending of an unmailable contact");
  }
}

/**
 * A person with an unsubscribe on record (global, or of this list) is subscribed again by an editor or
 * an MCP client only on purpose: the caller repeats the request with `confirmResubscribe: true`.
 */
function requireResubscribeConfirmation(db: Database, contact: ContactRow, listId: string) {
  // A suppression cannot be confirmed away; `subscribeToList` answers it.
  if (contact.suppressedReason) return;
  const member = getMembership(db, contact.accountId, contact.id, listId);
  // A retry of an active subscription changes nothing.
  if (contact.emailConsent === "subscribed" && member?.status === "subscribed") return;
  const unsubscribedAt = Math.max(
    contact.unsubscribedAt ?? -1,
    contact.emailConsent === "unsubscribed" ? contact.consentAt ?? 0 : -1,
    member?.status === "unsubscribed" ? member.unsubscribedAt ?? 0 : -1
  );
  if (unsubscribedAt < 0) return;
  throw new ContactError(`The contact unsubscribed on ${new Date(unsubscribedAt).toISOString()}; send confirmResubscribe: true to subscribe it again`,
    409, "resubscribe_confirmation_required", { unsubscribedAt });
}

export async function changeContactSubscription(accountId: string, contactId: string, change: SubscriptionChange, now = Date.now()) {
  const db = await getOutreachDb();
  db.transaction(() => {
    const contact = requireContact(db, accountId, contactId);
    const list = requireList(db, accountId, change.listId);
    const source = change.consentSource ?? "manual";
    if (change.action === "subscribe") {
      if (list.optIn === "double") throw new ContactError("Double opt-in is not supported", 409, "double_opt_in_unsupported");
      if (!change.confirmResubscribe) requireResubscribeConfirmation(db, contact, list.id);
      return subscribeToList(db, contact, list.id, { at: now, source, explicit: true }, now);
    }
    const member = getMembership(db, accountId, contactId, list.id);
    if (member?.status !== "unsubscribed") {
      writeMembership(db, accountId, contactId, list.id, {
        status: "unsubscribed", subscribedAt: member?.subscribedAt ?? null, unsubscribedAt: now
      }, source);
    }
    // The contact can still receive mail for other lists. The per-list send check enforces this opt-out.
  }).immediate();
  return getContactDetail(accountId, contactId);
}

export function unsubscribeGlobally(db: Database, contact: ContactRow, at: number, source = "unsubscribe_link"): boolean {
  const { accountId, id } = contact;
  const members = db.query(`UPDATE list_members SET status = 'unsubscribed', unsubscribedAt = max(coalesce(unsubscribedAt, 0), ?), source = ?
    WHERE accountId = ? AND contactId = ? AND (status != 'unsubscribed' OR ? = 1)`).run(at, source, accountId, id,
    contact.emailConsent === "unsubscribed" ? 0 : 1);
  if (contact.emailConsent === "unsubscribed") {
    // A later unsubscribe is the one that counts against a late consent; a replay changes nothing.
    db.query(`UPDATE contacts SET consentSource = CASE WHEN coalesce(consentAt, 0) < ?1 THEN ?2 ELSE consentSource END,
        consentAt = max(coalesce(consentAt, 0), ?1), unsubscribedAt = max(coalesce(unsubscribedAt, 0), ?1),
        updatedAt = max(updatedAt, ?1)
      WHERE accountId = ?3 AND id = ?4 AND (coalesce(consentAt, 0) < ?1 OR coalesce(unsubscribedAt, 0) < ?1)`)
      .run(at, source, accountId, id);
    return members.changes > 0;
  }
  db.query(`UPDATE contacts SET emailConsent = 'unsubscribed', consentAt = ?, consentSource = ?,
      unsubscribedAt = max(coalesce(unsubscribedAt, 0), ?), updatedAt = max(updatedAt, ?)
    WHERE accountId = ? AND id = ?`).run(at, source, at, at, accountId, id);
  return true;
}

const suppressionPriority: Record<SuppressionReason, number> = { manual: 1, hard_bounce: 2, complaint: 3 };

export function shouldApplySuppression(contact: ConsentState, reason: SuppressionReason) {
  return !contact.suppressedReason || suppressionPriority[reason] > suppressionPriority[contact.suppressedReason];
}

function setSuppression(db: Database, contact: ContactRow, reason: SuppressionReason, at: number, now: number) {
  if (!shouldApplySuppression(contact, reason)) return false;
  db.query("UPDATE contacts SET suppressedReason = ?, suppressedAt = ?, updatedAt = ? WHERE accountId = ? AND id = ?")
    .run(reason, at, now, contact.accountId, contact.id);
  return true;
}

export async function suppressContact(accountId: string, target: { contactId?: string; email?: string; reason: SuppressionReason; at?: number }): Promise<void> {
  const email = target.contactId || target.email === undefined ? undefined : parseContactInput(emailSchema, target.email);
  const now = Date.now();
  const db = await getOutreachDb();
  const changed = db.transaction(() => {
    const contact = target.contactId ? findContact(db, accountId, target.contactId)
      : email === undefined ? null : findContactByEmail(db, accountId, email) ?? insertContact(db, accountId, { email }, target.reason, now);
    return contact && setSuppression(db, contact, target.reason, target.at ?? now, now) ? contact.id : null;
  }).immediate();
  if (changed) await notifyContactUnmailable(accountId, changed);
}

export async function changeManualSuppression(accountId: string, contactId: string, suppressed: boolean, now = Date.now()) {
  const db = await getOutreachDb();
  const changed = db.transaction(() => {
    const contact = requireContact(db, accountId, contactId);
    if (suppressed) return setSuppression(db, contact, "manual", now, now);
    if (contact.suppressedReason === null) return false;
    if (contact.suppressedReason !== "manual") throw new ContactError("Only manual suppression can be lifted", 409, "suppression_locked");
    db.query("UPDATE contacts SET suppressedReason = NULL, suppressedAt = NULL, updatedAt = ? WHERE accountId = ? AND id = ?")
      .run(now, accountId, contactId);
    return false;
  }).immediate();
  if (changed) await notifyContactUnmailable(accountId, contactId);
  return getContactDetail(accountId, contactId);
}

export async function eraseContact(accountId: string, contactId: string, now = Date.now()): Promise<void> {
  const db = await getOutreachDb();
  db.transaction(() => {
    rememberErasedAddress(db, requireContact(db, accountId, contactId), now);
    const related = `WHERE accountId = ?1 AND (contactId = ?2 OR sendId IN (
      SELECT id FROM sends WHERE accountId = ?1 AND contactId = ?2
    ))`;
    db.query(`DELETE FROM tracking_events ${related}`).run(accountId, contactId);
    db.query(`DELETE FROM tracking_links ${related}`).run(accountId, contactId);
    db.query("DELETE FROM sequence_enrollments WHERE accountId = ? AND contactId = ?").run(accountId, contactId);
    db.query("DELETE FROM list_members WHERE accountId = ? AND contactId = ?").run(accountId, contactId);
    db.query(`INSERT INTO klaviyo_erased_sends (accountId, sendId)
      SELECT accountId, id FROM sends WHERE accountId = ? AND contactId = ? AND source = 'klaviyo'`).run(accountId, contactId);
    db.query("DELETE FROM sends WHERE accountId = ? AND contactId = ? AND source = 'klaviyo'").run(accountId, contactId);
    db.query(`UPDATE sends SET contactId = NULL, recipients = '', subject = '', error = NULL,
      status = CASE WHEN status = 'queued' THEN 'skipped' ELSE status END
      WHERE accountId = ? AND contactId = ?`).run(accountId, contactId);
    db.query("DELETE FROM contacts WHERE accountId = ? AND id = ?").run(accountId, contactId);
  }).immediate();
  await notifyContactUnmailable(accountId, contactId);
}
