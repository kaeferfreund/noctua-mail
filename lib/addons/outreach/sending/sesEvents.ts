import { rows } from "./sql";
import { z } from "zod";
import { getOutreachDb } from "../db";
import { suppressContact } from "../contacts";
import { recordTrackingEvent } from "../tracking";
import type { SuppressionReason, TrackingEventType } from "../types";
import { outreachAccounts } from "./accounts";

const payload = z.object({
  eventType: z.string().optional(),
  notificationType: z.string().optional(),
  mail: z.object({ messageId: z.string().min(1).max(512), tags: z.record(z.string(), z.array(z.string())).optional() }),
  bounce: z.object({ bounceType: z.string(), timestamp: z.string().optional() }).optional(),
  complaint: z.object({ timestamp: z.string().optional() }).optional(),
  delivery: z.object({ timestamp: z.string().optional() }).optional()
});

const defaults = { db: getOutreachDb, suppress: suppressContact, record: recordTrackingEvent, now: Date.now };

const marker = "json_extract(CASE WHEN json_valid(detail) THEN detail END, '$.snsMessageId')";
const providerEvents = "type IN ('bounce','complaint','delivered')";
const unmatchedRetryMs = 7 * 24 * 60 * 60_000;

export async function applySesEvent(snsMessageId: string, input: unknown, deps = defaults, publishedAt?: number) {
  const parsed = payload.safeParse(input);
  if (!parsed.success) return;
  const event = parsed.data;
  let type: TrackingEventType;
  let reason: SuppressionReason | undefined;
  let when: string | undefined;
  switch (event.eventType ?? event.notificationType) {
    case "Bounce":
      if (!event.bounce) return;
      type = "bounce";
      when = event.bounce.timestamp;
      if (event.bounce.bounceType === "Permanent") reason = "hard_bounce";
      break;
    case "Complaint":
      if (!event.complaint) return;
      type = "complaint";
      reason = "complaint";
      when = event.complaint.timestamp;
      break;
    case "Delivery":
      if (!event.delivery) return;
      type = "delivered";
      when = event.delivery.timestamp;
      break;
    default:
      return;
  }
  const db = await deps.db();
  // The existing event detail column is the durable SNS replay marker. The
  // unique index also covers simultaneous delivery to two server processes.
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_outreach_sns_event ON tracking_events (accountId, ${marker})
    WHERE ${providerEvents} AND ${marker} IS NOT NULL`);
  const seen = db.query(`SELECT 1 FROM tracking_events WHERE accountId = ? AND ${providerEvents} AND ${marker} = ?`);
  const at = Date.parse(when ?? "");
  const mailAt = Number.isFinite(at) ? at : deps.now();

  // A stored provider id identifies a sent row. The send-id tag alone identifies only a row whose
  // outcome stayed open (still `sending`, or failed as uncertain/interrupted after SES may have accepted it).
  const lookup = rows<{ id: string; contactId: string | null; kind: string; status: string; error: string | null;
    providerMessageId: string | null }>(db, `SELECT id, contactId, kind, status, error, providerMessageId FROM sends
    WHERE accountId = ?1 AND kind IN ('campaign','sequence','test')
      AND ((status = 'sent' AND providerMessageId = ?2) OR id = ?3)
    ORDER BY status = 'sent' AND providerMessageId = ?2 DESC LIMIT 1`);
  const storeProviderId = db.query(`UPDATE sends SET providerMessageId = ? WHERE accountId = ? AND id = ?
    AND status = 'failed' AND providerMessageId IS NULL`);
  const tag = event.mail.tags?.noctua_send_id?.[0] ?? null;
  let pending = false;
  for (const accountId of outreachAccounts(db, false)) {
    const send = lookup.get(accountId, event.mail.messageId, tag);
    if (!send) continue;
    const byProviderId = send.status === "sent" && send.providerMessageId === event.mail.messageId;
    const uncertain = send.status === "failed" && (send.error === "send_uncertain" || send.error === "interrupted")
      && (send.providerMessageId === null || send.providerMessageId === event.mail.messageId);
    // A pending tag is not proof that this provider id belongs to the send: retry until the outcome is stored.
    if (send.status === "sending") pending = true;
    if (!byProviderId && !uncertain) continue;
    if (send.kind === "test") return;
    if (seen.get(accountId, snsMessageId)) return;
    if (uncertain) storeProviderId.run(event.mail.messageId, accountId, send.id);
    // Suppression is idempotent and precedes the replay marker so a failure
    // remains retryable. Never trust an address supplied by the SNS payload.
    if (reason && send.contactId) await deps.suppress(accountId, { contactId: send.contactId, reason, at: mailAt });
    try {
      await deps.record({ accountId, sendId: send.id, contactId: send.contactId, type, at: mailAt, detail: { snsMessageId } });
    } catch (error) {
      if (!seen.get(accountId, snsMessageId)) throw error;
    }
    return;
  }
  // Without a pending row the event belongs to another sender on the topic (or to a closed row): acknowledge it.
  if (!pending) return;
  if (deps.now() - (publishedAt ?? mailAt) < unmatchedRetryMs) throw new Error("SES receipt not found");
  console.warn("[outreach] expired unmatched SES event");
}
