import { rows } from "./sql";
import type { Database } from "bun:sqlite";
import { leaseMaxMs, sendOwnerAlive } from "./lease";
import { SCHEDULED_SEND_RETRY_DELAYS_MS } from "@/lib/scheduledSend";
import { newOutreachId } from "../ids";
import type { SendableRecipient } from "../contacts";
import type { Campaign, OutreachAccountSettings, SendStatus, SequenceStep } from "../types";
import { SendStopped, type SendOutcome } from "./send";

export type QueueRow = {
  id: string; accountId: string; kind: "campaign" | "sequence"; campaignId: string | null; sequenceId: string | null;
  sequenceStepId: string | null; contactId: string | null; recipients: string; status: SendStatus; claimOwner: string | null;
  claimedAt: number | null; userId: string | null; attempts: number; trackOpens: number; trackClicks: number;
};

export type Enrollment = {
  id: string; accountId: string; sequenceId: string; contactId: string; nextStepPosition: number; nextSendAt: number; enrolledAt: number;
};

type NextStep = Pick<SequenceStep, "id" | "position" | "delayMinutes" | "subject">;

function nextStep(db: Database, accountId: string, sequenceId: string, contactId: string, position: number) {
  return rows<NextStep>(db, `SELECT p.id, p.position, p.delayMinutes, p.subject FROM sequence_steps p
    WHERE p.accountId = ? AND p.sequenceId = ? AND p.position >= ? AND p.enabled = 1
      AND NOT EXISTS (SELECT 1 FROM sends s WHERE s.accountId = p.accountId AND s.sequenceStepId = p.id
        AND s.contactId = ? AND s.kind = 'sequence' AND NOT (s.status = 'skipped' AND s.error = 'step_changed'))
    ORDER BY p.position LIMIT 1`).get(accountId, sequenceId, position, contactId);
}

/** Time the next step's delay counts from: the last attempt that reached the transport, else the enrollment. */
function sequenceBasis(db: Database, enrollment: Pick<Enrollment, "accountId" | "sequenceId" | "contactId" | "enrolledAt">) {
  const prior = rows<{ at: number }>(db, `SELECT COALESCE(sentAt, claimedAt) AS at FROM sends
    WHERE accountId = ? AND sequenceId = ? AND contactId = ? AND kind = 'sequence'
      AND status IN ('sent','failed') AND COALESCE(sentAt, claimedAt) IS NOT NULL
    ORDER BY at DESC LIMIT 1`).get(enrollment.accountId, enrollment.sequenceId, enrollment.contactId);
  return prior?.at ?? enrollment.enrolledAt;
}

/** The subscription hook is repeatable even after cancellation or completion. */
export function enroll(db: Database, accountId: string, event: { listId: string; contactId: string; at: number }) {
  db.transaction(() => {
    const sequences = rows<{ id: string }>(db, `SELECT id FROM sequences
      WHERE accountId = ? AND triggerListId = ? AND status = 'live'`).all(accountId, event.listId);
    for (const sequence of sequences) {
      const step = nextStep(db, accountId, sequence.id, event.contactId, 0);
      if (step) db.query(`INSERT INTO sequence_enrollments (id, accountId, sequenceId, contactId, nextStepPosition, nextSendAt, enrolledAt)
        VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(sequenceId, contactId) DO NOTHING`).run(newOutreachId("enr"), accountId, sequence.id, event.contactId, step.position, event.at + step.delayMinutes * 60_000, event.at);
    }
  }).immediate();
}

export function cancelContact(db: Database, accountId: string, contactId: string, now: number) {
  db.transaction(() => {
    db.query(`UPDATE sequence_enrollments SET status = 'cancelled', nextStepPosition = NULL, nextSendAt = NULL, finishedAt = ?
      WHERE accountId = ? AND contactId = ? AND status = 'active'`).run(now, accountId, contactId);
    db.query(`UPDATE sends SET status = 'skipped', error = 'recipient_unmailable'
      WHERE accountId = ? AND contactId = ? AND status = 'queued' AND kind IN ('campaign', 'sequence')`).run(accountId, contactId);
  }).immediate();
}

export function expandCampaign(db: Database, campaign: Campaign, recipients: SendableRecipient[], now: number) {
  db.transaction(() => {
    const changed = db.query(`UPDATE campaigns SET status = 'sending', startedAt = ?, updatedAt = ?
      WHERE accountId = ? AND id = ? AND status = 'scheduled' AND sendAt <= ?`).run(now, now, campaign.accountId, campaign.id, now);
    if (!changed.changes) return;
    const insert = db.query(`INSERT INTO sends (id, accountId, kind, campaignId, contactId, recipients, subject, status,
      trackOpens, trackClicks, userId, sendAt, queuedAt)
      SELECT ?, c.accountId, 'campaign', c.id, p.id, p.email, c.subject, 'queued', c.trackOpens, c.trackClicks, c.scheduledByUserId, ?, ?
      FROM campaigns c JOIN contacts p ON p.accountId = c.accountId AND p.id = ?
      WHERE c.accountId = ? AND c.id = ? ON CONFLICT DO NOTHING`);
    for (const contact of recipients) insert.run(newOutreachId("snd"), now, now, contact.contactId, campaign.accountId, campaign.id);
  }).immediate();
}

type StepState = Pick<SequenceStep, "id" | "position" | "delayMinutes" | "enabled">;

/**
 * Carry active enrollments across a save of the step list. `before` is the step list before the save.
 * An enrollment waits for the steps at and after its position. After the save it waits at the first of
 * those steps that still exists (in the new order); when none is left it is complete. nextSendAt encodes
 * the preceding attempt's completion time plus the awaited step's delay, so a delay edit of the awaited
 * step shifts it, while a different awaited step or a step enabled again counts from that basis anew.
 */
export function carrySequenceEnrollments(db: Database, accountId: string, sequenceId: string, before: StepState[], now: number) {
  const after = new Map(rows<Omit<StepState, "enabled"> & { enabled: number }>(db, `SELECT id, position, delayMinutes, enabled
    FROM sequence_steps WHERE accountId = ? AND sequenceId = ?`).all(accountId, sequenceId).map(step => [step.id, step]));
  const ordered = [...before].sort((a, b) => a.position - b.position);
  const enrollments = rows<Enrollment>(db, `SELECT * FROM sequence_enrollments
    WHERE accountId = ? AND sequenceId = ? AND status = 'active'`).all(accountId, sequenceId);
  const update = db.query(`UPDATE sequence_enrollments SET status = ?, nextStepPosition = ?, nextSendAt = ?, finishedAt = ?
    WHERE accountId = ? AND id = ? AND status = 'active'`);
  for (const enrollment of enrollments) {
    const ahead = ordered.filter(step => step.position >= enrollment.nextStepPosition);
    if (!ahead.length) continue;
    const kept = ahead.flatMap(step => after.has(step.id) ? [{ before: step, after: after.get(step.id)! }] : []);
    if (!kept.length) {
      update.run("completed", null, null, now, accountId, enrollment.id);
      continue;
    }
    const target = kept.reduce((first, step) => step.after.position < first.after.position ? step : first);
    let due = enrollment.nextSendAt;
    if (target.before !== ahead[0] || (target.after.enabled && !target.before.enabled)) {
      due = sequenceBasis(db, enrollment) + target.after.delayMinutes * 60_000;
    } else if (target.after.enabled && target.before.enabled) {
      due += (target.after.delayMinutes - target.before.delayMinutes) * 60_000;
    }
    if (target.after.position !== enrollment.nextStepPosition || due !== enrollment.nextSendAt) {
      update.run("active", target.after.position, due, null, accountId, enrollment.id);
    }
  }
  // A retry's sendAt is its back-off deadline. The claim also checks the enrollment's due date.
  db.query(`UPDATE sends AS s SET sendAt = e.nextSendAt
    FROM sequence_enrollments e JOIN sequence_steps p ON p.accountId = e.accountId AND p.sequenceId = e.sequenceId
      AND p.position = e.nextStepPosition
    WHERE s.accountId = ? AND s.sequenceId = ? AND s.kind = 'sequence' AND s.status = 'queued' AND s.attempts = 0
      AND e.accountId = s.accountId AND e.sequenceId = s.sequenceId AND e.contactId = s.contactId
      AND e.status = 'active' AND p.id = s.sequenceStepId AND s.sendAt IS NOT e.nextSendAt`).run(accountId, sequenceId);
}

function moveEnrollment(db: Database, enrollment: Enrollment, step: NextStep | null, due: number, now: number) {
  db.query(`UPDATE sequence_enrollments SET status = ?, nextStepPosition = ?, nextSendAt = ?, finishedAt = ?
    WHERE accountId = ? AND id = ? AND status = 'active'`).run(step ? "active" : "completed", step?.position ?? null, step ? due : null, step ? null : now, enrollment.accountId, enrollment.id);
}

export function expandSequences(db: Database, accountId: string, now: number) {
  db.transaction(() => {
    const due = rows<Enrollment & { userId: string | null; trackOpens: number; trackClicks: number }>(db,
      `SELECT e.*, q.statusChangedByUserId AS userId, q.trackOpens, q.trackClicks FROM sequence_enrollments e
       JOIN sequences q ON q.accountId = e.accountId AND q.id = e.sequenceId
       WHERE e.accountId = ? AND e.status = 'active' AND e.nextSendAt <= ? AND q.status = 'live'`).all(accountId, now);
    for (const enrollment of due) {
      // A removed or moved step, or a disabled one whose send is due, may have a pending row. Keep it for
      // reporting but release the enrollment to the current step at its position. A disabled step's row
      // waits until it is due, like a contact waiting for that step; the step can be enabled again meanwhile.
      // nextStep and the insert below take a step_changed row up again when its step comes up later.
      db.query(`UPDATE sends AS s SET status = 'skipped', error = 'step_changed'
        WHERE s.accountId = ? AND s.sequenceId = ? AND s.contactId = ? AND s.kind = 'sequence' AND s.status = 'queued'
          AND NOT EXISTS (SELECT 1 FROM sequence_steps p WHERE p.accountId = s.accountId AND p.sequenceId = s.sequenceId
            AND p.id = s.sequenceStepId AND p.position = ? AND (p.enabled = 1 OR s.sendAt > ?))`)
        .run(accountId, enrollment.sequenceId, enrollment.contactId, enrollment.nextStepPosition, now);
      const pending = db.query(`SELECT 1 FROM sends WHERE accountId = ? AND sequenceId = ? AND contactId = ?
        AND kind = 'sequence' AND status IN ('queued','sending') LIMIT 1`).get(accountId, enrollment.sequenceId, enrollment.contactId);
      if (pending) continue;
      const step = nextStep(db, accountId, enrollment.sequenceId, enrollment.contactId, enrollment.nextStepPosition);
      const dueAt = !step || step.position === enrollment.nextStepPosition ? enrollment.nextSendAt
        : sequenceBasis(db, enrollment) + step.delayMinutes * 60_000;
      moveEnrollment(db, enrollment, step, dueAt, now);
      if (!step || dueAt > now) continue;
      db.query(`INSERT INTO sends (id, accountId, kind, sequenceId, sequenceStepId, contactId, subject, status, trackOpens, trackClicks, userId, sendAt, queuedAt)
        VALUES (?, ?, 'sequence', ?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?)
        ON CONFLICT (sequenceStepId, contactId) WHERE sequenceStepId IS NOT NULL AND kind = 'sequence' DO UPDATE SET
          status = 'queued', error = NULL, attempts = 0, claimOwner = NULL, subject = excluded.subject, trackOpens = excluded.trackOpens,
          trackClicks = excluded.trackClicks, userId = excluded.userId, sendAt = excluded.sendAt, queuedAt = excluded.queuedAt
        WHERE sends.accountId = excluded.accountId AND sends.status = 'skipped' AND sends.error = 'step_changed'`).run(newOutreachId("snd"), accountId, enrollment.sequenceId, step.id, enrollment.contactId, step.subject,
        enrollment.trackOpens, enrollment.trackClicks, enrollment.userId, dueAt, now);
    }
  }).immediate();
}

export function claimSend(db: Database, accountId: string, owner: string, now: number) {
  return db.transaction(() => {
    const settings = rows<{ sendRatePerMinute: number }>(db, `SELECT sendRatePerMinute FROM account_settings
      WHERE accountId = ? AND enabled = 1`).get(accountId);
    if (!settings) return null;
    const recent = rows<{ count: number }>(db, `SELECT count(*) AS count FROM sends
      WHERE accountId = ? AND kind IN ('campaign','sequence') AND claimedAt > ?`).get(accountId, now - 60_000);
    if ((recent?.count ?? 0) >= settings.sendRatePerMinute) return null;
    // The subquery is bound to the parameter, not to the outer row, so it runs once per claim.
    return rows<QueueRow>(db, `UPDATE sends SET status = 'sending', claimOwner = ?1, claimedAt = ?2, attempts = attempts + 1
      WHERE accountId = ?3 AND id = (SELECT s.id FROM sends s WHERE s.accountId = ?3 AND s.status = 'queued'
        AND s.sendAt <= ?2 AND (
          (s.kind = 'campaign' AND EXISTS (SELECT 1 FROM campaigns c WHERE c.accountId = s.accountId AND c.id = s.campaignId AND c.status = 'sending'))
          OR (s.kind = 'sequence' AND EXISTS (SELECT 1 FROM sequences q WHERE q.accountId = s.accountId AND q.id = s.sequenceId AND q.status = 'live')
            AND NOT EXISTS (SELECT 1 FROM sequence_enrollments e WHERE e.accountId = s.accountId AND e.sequenceId = s.sequenceId
              AND e.contactId = s.contactId AND e.status = 'active' AND e.nextSendAt > ?2))
        ) ORDER BY s.sendAt, s.queuedAt, s.id LIMIT 1) AND status = 'queued' RETURNING *`).get(owner, now, accountId);
  }).immediate();
}

export function assertClaim(db: Database, row: QueueRow, settings: OutreachAccountSettings, now: number) {
  const saved = rows<QueueRow>(db, "SELECT * FROM sends WHERE accountId = ? AND id = ?").get(row.accountId, row.id);
  if (saved?.status !== "sending" || saved.claimOwner !== row.claimOwner || saved.claimedAt == null
      || now - saved.claimedAt >= leaseMaxMs) throw new SendStopped("interrupted");
  const live = rows<{ enabled: number; updatedAt: number }>(db, "SELECT enabled, updatedAt FROM account_settings WHERE accountId = ?")
    .get(row.accountId);
  if (!live?.enabled) throw new SendStopped("cancelled");
  if (live.updatedAt !== settings.updatedAt) throw new SendStopped("configuration_changed");

  if (row.kind === "campaign") {
    if (!db.query("SELECT 1 FROM campaigns WHERE accountId = ? AND id = ? AND status = 'sending'").get(row.accountId, row.campaignId)) {
      throw new SendStopped("cancelled");
    }
    const eligible = db.query(`SELECT 1 FROM campaigns c WHERE c.accountId = ? AND c.id = ?
      AND EXISTS (SELECT 1 FROM list_members m JOIN lists l ON l.accountId = m.accountId AND l.id = m.listId
        WHERE m.accountId = c.accountId AND m.contactId = ? AND m.status = 'subscribed'
          AND l.archivedAt IS NULL AND m.listId IN (SELECT value FROM json_each(c.listIds)))
      AND NOT EXISTS (SELECT 1 FROM list_members m
        WHERE m.accountId = c.accountId AND m.contactId = ? AND m.status = 'subscribed'
          AND m.listId IN (SELECT value FROM json_each(c.excludedListIds)))`)
      .get(row.accountId, row.campaignId, row.contactId, row.contactId);
    if (!eligible) throw new SendStopped("recipient_unmailable");
  } else {
    const sequence = rows<{ status: string; triggerListId: string | null }>(db,
      "SELECT status, triggerListId FROM sequences WHERE accountId = ? AND id = ?").get(row.accountId, row.sequenceId);
    if (sequence?.status === "paused") throw new SendStopped("paused");
    const enrollment = rows<{ nextSendAt: number }>(db, `SELECT e.nextSendAt FROM sequence_enrollments e JOIN sequence_steps p
        ON p.accountId = e.accountId AND p.sequenceId = e.sequenceId AND p.position = e.nextStepPosition
        WHERE e.accountId = ? AND e.sequenceId = ? AND e.contactId = ? AND e.status = 'active' AND p.id = ? AND p.enabled = 1`)
      .get(row.accountId, row.sequenceId, row.contactId, row.sequenceStepId);
    if (sequence?.status !== "live" || !enrollment) throw new SendStopped("cancelled");
    if (enrollment.nextSendAt > now) throw new SendStopped("rescheduled");
    if (!db.query(`SELECT 1 FROM list_members m JOIN lists l ON l.accountId = m.accountId AND l.id = m.listId
        WHERE m.accountId = ? AND m.listId = ? AND m.contactId = ? AND m.status = 'subscribed' AND l.archivedAt IS NULL`)
      .get(row.accountId, sequence.triggerListId, row.contactId)) throw new SendStopped("recipient_unmailable");
  }
  if (!db.query(`SELECT 1 FROM contacts WHERE accountId = ? AND id = ? AND emailConsent = 'subscribed' AND suppressedReason IS NULL`)
    .get(row.accountId, row.contactId)) throw new SendStopped("recipient_unmailable");
}

function advanceSequence(db: Database, row: QueueRow, basis: number) {
  const enrollment = rows<Enrollment>(db, `SELECT * FROM sequence_enrollments
    WHERE accountId = ? AND sequenceId = ? AND contactId = ? AND status = 'active'`).get(row.accountId, row.sequenceId, row.contactId);
  if (!enrollment) return;
  const current = rows<{ position: number }>(db, `SELECT position FROM sequence_steps
    WHERE accountId = ? AND sequenceId = ? AND id = ?`).get(row.accountId, enrollment.sequenceId, row.sequenceStepId);
  // A replacement at the enrollment's position gets its own step and therefore its own send.
  if (current?.position !== enrollment.nextStepPosition) return;
  const step = nextStep(db, row.accountId, enrollment.sequenceId, enrollment.contactId, enrollment.nextStepPosition + 1);
  moveEnrollment(db, enrollment, step, basis + (step?.delayMinutes ?? 0) * 60_000, basis);
}

export function settleSend(db: Database, row: QueueRow, outcome: SendOutcome, now: number) {
  db.transaction(() => {
    const { accountId, id, claimOwner, attempts } = row;
    if (outcome.status === "deferred" || outcome.status === "retry") {
      const delay = outcome.status === "deferred" ? 0 : SCHEDULED_SEND_RETRY_DELAYS_MS[attempts - 1];
      if (delay !== undefined) {
        // Cancellation may have landed after this attempt's transport check.
        const parentOpen = row.kind === "campaign"
          ? db.query("SELECT 1 FROM campaigns WHERE accountId = ? AND id = ? AND status = 'sending'").get(accountId, row.campaignId)
          : db.query(`SELECT 1 FROM sequence_enrollments WHERE accountId = ? AND sequenceId = ? AND contactId = ? AND status = 'active'`)
            .get(accountId, row.sequenceId, row.contactId);
        if (parentOpen) {
          db.query(`UPDATE sends AS s SET status = 'queued', error = ?1, claimOwner = NULL,
            sendAt = CASE WHEN ?3 = 0 THEN max(?2, coalesce((SELECT e.nextSendAt FROM sequence_enrollments e
              JOIN sequence_steps p ON p.accountId = e.accountId AND p.sequenceId = e.sequenceId AND p.position = e.nextStepPosition
              WHERE e.accountId = s.accountId AND e.sequenceId = s.sequenceId AND e.contactId = s.contactId
                AND e.status = 'active' AND p.id = s.sequenceStepId), ?2)) ELSE ?2 END, attempts = ?3
            WHERE accountId = ?4 AND id = ?5 AND claimOwner = ?6 AND status = 'sending'`)
            .run(outcome.reason, now + delay, attempts - Number(outcome.status === "deferred"), accountId, id, claimOwner);
          return;
        }
        outcome = { status: "skipped", reason: "cancelled" };
      } else {
        outcome = { status: "failed", reason: outcome.reason };
      }
    }

    const contact = outcome.status === "sent" && rows<{ id: string }>(db, `SELECT c.id FROM sends s JOIN contacts c
      ON c.accountId = s.accountId AND c.id = s.contactId WHERE s.accountId = ? AND s.id = ?`).get(accountId, id);
    const result = outcome.status === "sent"
      ? db.query(`UPDATE sends SET status = 'sent', error = NULL, claimOwner = NULL, messageId = ?, providerMessageId = ?, contactId = ?, subject = ?, recipients = ?, sentAt = ?
          WHERE accountId = ? AND id = ? AND claimOwner = ? AND status = 'sending'`).run(
          outcome.messageId, outcome.providerMessageId, contact ? contact.id : null, contact ? outcome.subject : "", contact ? outcome.recipients : "",
          outcome.sentAt, accountId, id, claimOwner)
      : db.query(`UPDATE sends SET status = ?, error = ?, claimOwner = NULL WHERE accountId = ? AND id = ? AND claimOwner = ? AND status = 'sending'`).run(outcome.status, outcome.reason, accountId, id, claimOwner);
    if (result.changes && row.kind === "sequence") {
      if (outcome.status === "skipped" && outcome.reason === "recipient_unmailable") {
        db.query(`UPDATE sequence_enrollments SET status = 'cancelled', nextStepPosition = NULL, nextSendAt = NULL, finishedAt = ?
          WHERE accountId = ? AND sequenceId = ? AND contactId = ? AND status = 'active'`)
          .run(now, accountId, row.sequenceId, row.contactId);
      } else {
        advanceSequence(db, row, outcome.status === "sent" ? outcome.sentAt : now);
      }
    }
  }).immediate();
}

export function recoverInterrupted(db: Database, accountId: string, now: number, ownerAlive = sendOwnerAlive) {
  db.transaction(() => {
    const claims = rows<QueueRow>(db, `SELECT * FROM sends WHERE accountId = ? AND status = 'sending'
      AND kind IN ('campaign','sequence','test')`).all(accountId);
    for (const row of claims) {
      if (row.claimOwner && row.claimedAt != null && now - row.claimedAt < leaseMaxMs && ownerAlive(row.claimOwner)) continue;
      db.query(`UPDATE sends SET status = 'failed', error = 'interrupted', claimOwner = NULL WHERE accountId = ? AND id = ?`).run(accountId, row.id);
      if (row.kind === "sequence") advanceSequence(db, row, now);
    }
  }).immediate();
}

export function finishCampaigns(db: Database, accountId: string, now: number) {
  db.query(`UPDATE campaigns AS c SET status = CASE WHEN EXISTS (SELECT 1 FROM sends s WHERE s.accountId = c.accountId AND s.campaignId = c.id
      AND s.kind = 'campaign' AND s.status = 'failed') AND NOT EXISTS (SELECT 1 FROM sends s WHERE s.accountId = c.accountId AND s.campaignId = c.id
      AND s.kind = 'campaign' AND s.status <> 'failed') THEN 'failed' ELSE 'sent' END, finishedAt = ?, updatedAt = ?
    WHERE c.accountId = ? AND c.status = 'sending' AND NOT EXISTS (SELECT 1 FROM sends s WHERE s.accountId = c.accountId AND s.campaignId = c.id
      AND s.kind = 'campaign' AND s.status IN ('queued','sending'))`).run(now, now, accountId);
}
