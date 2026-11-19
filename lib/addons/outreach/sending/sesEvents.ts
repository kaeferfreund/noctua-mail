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

export async function applySesEvent(snsMessageId: string, input: unknown, deps = defaults) {
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

  for (const accountId of outreachAccounts(db, false)) {
    const send = rows<{ id: string; contactId: string | null }>(db, `SELECT id, contactId FROM sends
      WHERE accountId = ? AND providerMessageId = ? AND status = 'sent' AND kind IN ('campaign','sequence') LIMIT 1`)
      .get(accountId, event.mail.messageId);
    if (!send) {
      // SES can deliver an event before the send receipt has committed.
      const id = event.mail.tags?.noctua_send_id?.[0];
      if (id && db.query(`SELECT 1 FROM sends WHERE accountId = ? AND id = ? AND status = 'sending'
        AND kind IN ('campaign','sequence')`).get(accountId, id)) throw new Error("SES receipt pending");
      continue;
    }
    if (seen.get(accountId, snsMessageId)) return;
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
}
