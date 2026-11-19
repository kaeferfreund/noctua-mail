import { rows } from "./sql";
import type { Database } from "bun:sqlite";
import { newOutreachId } from "../ids";
import { getSendStats, listLinkStats, listSendSummaries } from "../tracking";
import type {
  Campaign, CampaignInput, CampaignReport, CampaignSummary, EmailTemplate, EmailTemplateInput, EmailTemplateSummary,
  Sequence, SequenceInput, SequenceReport, SequenceStep, SequenceSummary
} from "../types";
import { SendingError } from "./input";
import { normalizeTemplate, type Content } from "./render";
import { carrySequenceEnrollments } from "./queue";

export function required<T>(value: T | null | undefined): T {
  if (value == null) throw new SendingError(404, "Eintrag nicht gefunden.");
  return value;
}

export function assertDraft(draft: { status: string }) {
  if (draft.status !== "draft") throw new SendingError(409, "Nur Entwürfe können hier geändert werden.");
}

function normalizedContent(input: Partial<Content>, current?: Content): Required<Content> {
  return {
    subject: normalizeTemplate(input.subject ?? current?.subject ?? ""),
    previewText: normalizeTemplate(input.previewText ?? current?.previewText ?? ""),
    html: normalizeTemplate(input.html ?? current?.html ?? "", true),
    text: normalizeTemplate(input.text ?? current?.text ?? "")
  };
}

function contentArgs(content: Required<Content>) {
  return [content.subject, content.previewText, content.html, content.text] as const;
}

const templateFields = "id, accountId, name, subject, previewText, createdAt, updatedAt, archivedAt";

export function listTemplates(db: Database, accountId: string) {
  return rows<EmailTemplateSummary>(db, `SELECT ${templateFields} FROM templates
    WHERE accountId = ? AND archivedAt IS NULL ORDER BY name, id`).all(accountId);
}

export function getTemplate(db: Database, accountId: string, id: string) {
  return required(rows<EmailTemplate>(db, `SELECT ${templateFields}, html, text FROM templates
    WHERE accountId = ? AND id = ? AND archivedAt IS NULL`).get(accountId, id));
}

export function saveTemplate(db: Database, accountId: string, input: Partial<EmailTemplateInput>, options: {
  id?: string; externalId?: string; userId?: string; now?: number;
} = {}) {
  const now = options.now ?? Date.now();
  return db.transaction(() => {
    const current = options.id ? getTemplate(db, accountId, options.id) : null;
    const name = input.name ?? current?.name;
    if (!name) throw new SendingError(400, "Ein Name ist erforderlich.");
    const content = normalizedContent(input, current ?? undefined);
    const id = current?.id ?? newOutreachId("tpl");
    if (current) {
      db.query(`UPDATE templates SET name = ?, subject = ?, previewText = ?, html = ?, text = ?,
        updatedAt = ?, updatedByUserId = ? WHERE accountId = ? AND id = ?`).run(name, ...contentArgs(content), now, options.userId ?? null, accountId, id);
    } else {
      db.query(`INSERT INTO templates (id, accountId, name, subject, previewText, html, text, externalId, createdAt, updatedAt, updatedByUserId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, accountId, name, ...contentArgs(content), options.externalId ?? null, now, now, options.userId ?? null);
    }
    return getTemplate(db, accountId, id);
  }).immediate();
}

export function archiveTemplate(db: Database, accountId: string, id: string, userId: string) {
  const now = Date.now();
  const result = db.query(`UPDATE templates SET archivedAt = ?, updatedAt = ?, updatedByUserId = ?
    WHERE accountId = ? AND id = ? AND archivedAt IS NULL`).run(now, now, userId, accountId, id);
  if (!result.changes) required(null);
}

export function assertContent(content: Content) {
  if (!content.subject.trim() || !(content.html.trim() || content.text.trim())) {
    throw new SendingError(400, "Betreff und Nachricht sind erforderlich.");
  }
}

export function snapshotSequenceTemplates(db: Database, sequence: Sequence) {
  const steps = sequence.steps.filter(step => step.enabled);
  if (!steps.length) throw new SendingError(400, "Aktiviere mindestens einen Schritt.");
  const update = db.query(`UPDATE sequence_steps SET subject = ?, previewText = ?, html = ?, text = ?
    WHERE accountId = ? AND sequenceId = ? AND id = ?`);
  for (const step of steps) {
    const content = resolveContent(db, sequence.accountId, step);
    assertContent(content);
    update.run(...contentArgs(content), sequence.accountId, sequence.id, step.id);
  }
}

export function resolveContent(db: Database, accountId: string, item: Required<Content> & { templateId: string | null }): Required<Content> {
  if (!item.templateId || ((item.html.trim() || item.text.trim()) && item.subject.trim())) {
    return normalizedContent(item);
  }
  // Archived templates stay usable by existing references. Archiving hides them from selection.
  const template = rows<EmailTemplate>(db, "SELECT * FROM templates WHERE accountId = ? AND id = ?")
    .get(accountId, item.templateId);
  if (!template) return normalizedContent(item);
  const hasOwnBody = item.html.trim() || item.text.trim();
  return {
    subject: item.subject.trim() ? item.subject : template.subject,
    previewText: item.previewText.trim() ? item.previewText : template.previewText,
    html: hasOwnBody ? item.html : template.html,
    text: hasOwnBody ? item.text : template.text
  };
}

type CampaignRow = Omit<Campaign, "listIds" | "excludedListIds" | "trackOpens" | "trackClicks"> & {
  listIds: string; excludedListIds: string; trackOpens: number; trackClicks: number; scheduledByUserId: string | null;
};

function campaignFromRow(row: CampaignRow): Campaign {
  const { scheduledByUserId: _scheduler, ...campaign } = row;
  void _scheduler;
  return { ...campaign, listIds: JSON.parse(row.listIds), excludedListIds: JSON.parse(row.excludedListIds),
    trackOpens: row.trackOpens === 1, trackClicks: row.trackClicks === 1 };
}

const campaignFields = `id, accountId, name, subject, previewText, senderIdentityId, templateId, html, text,
  listIds, excludedListIds, status, trackOpens, trackClicks, sendAt, startedAt, finishedAt, createdAt, updatedAt, scheduledByUserId`;
export function campaignRow(db: Database, accountId: string, id: string) {
  return rows<CampaignRow>(db, `SELECT ${campaignFields} FROM campaigns WHERE accountId = ? AND id = ?`).get(accountId, id);
}

export function getCampaign(db: Database, accountId: string, id: string) {
  return campaignFromRow(required(campaignRow(db, accountId, id)));
}

export async function campaignSummary({ html: _html, text: _text, ...campaign }: Campaign): Promise<CampaignSummary> {
  void _html; void _text;
  return { ...campaign, stats: await getSendStats(campaign.accountId, { campaignId: campaign.id }) };
}

export async function listCampaigns(db: Database, accountId: string) {
  const items = rows<CampaignRow>(db, `SELECT ${campaignFields} FROM campaigns WHERE accountId = ?
    ORDER BY createdAt DESC, id`).all(accountId);
  return Promise.all(items.map(row => campaignSummary(campaignFromRow(row))));
}

export function saveCampaign(db: Database, accountId: string, userId: string, input: CampaignInput, id?: string) {
  return db.transaction(() => {
    const current = id ? getCampaign(db, accountId, id) : undefined;
    const now = Math.max(Date.now(), (current?.updatedAt ?? -1) + 1);
    if (current) assertDraft(current);
    const nextId = current?.id ?? newOutreachId("cmp");
    const templateId = input.templateId === undefined ? current?.templateId ?? null : input.templateId;
    if (templateId && templateId !== current?.templateId) getTemplate(db, accountId, templateId);
    const args = [
      input.name ?? current?.name ?? "Neue Kampagne", ...contentArgs(normalizedContent(input, current)),
      input.senderIdentityId === undefined ? current?.senderIdentityId ?? null : input.senderIdentityId, templateId,
      JSON.stringify(input.listIds ?? current?.listIds ?? []), JSON.stringify(input.excludedListIds ?? current?.excludedListIds ?? []),
      +(input.trackOpens ?? current?.trackOpens ?? true), +(input.trackClicks ?? current?.trackClicks ?? true), now
    ] as const;
    if (current) {
      db.query(`UPDATE campaigns SET name = ?, subject = ?, previewText = ?, html = ?, text = ?, senderIdentityId = ?, templateId = ?,
        listIds = ?, excludedListIds = ?, trackOpens = ?, trackClicks = ?, updatedAt = ? WHERE accountId = ? AND id = ?`).run(...args, accountId, nextId);
    } else {
      db.query(`INSERT INTO campaigns (name, subject, previewText, html, text, senderIdentityId, templateId,
        listIds, excludedListIds, trackOpens, trackClicks, updatedAt, accountId, id, createdAt, createdByUserId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...args, accountId, nextId, now, userId);
    }
    return getCampaign(db, accountId, nextId);
  }).immediate();
}

export function deleteCampaign(db: Database, accountId: string, id: string) {
  return db.transaction(() => {
    const campaign = getCampaign(db, accountId, id);
    assertDraft(campaign);
    db.query("DELETE FROM campaigns WHERE accountId = ? AND id = ?").run(accountId, id);
    return campaign;
  }).immediate();
}

export async function campaignReport(db: Database, accountId: string, id: string, cursor?: string): Promise<CampaignReport> {
  const filter = { campaignId: id };
  const [campaign, links, page] = await Promise.all([
    campaignSummary(getCampaign(db, accountId, id)),
    listLinkStats(accountId, filter),
    listSendSummaries(accountId, filter, { limit: 50, cursor })
  ]);
  return { ok: true, campaign, stats: campaign.stats, links, recipients: page.items, nextCursor: page.nextCursor };
}

type SequenceRow = Omit<Sequence, "steps" | "trackOpens" | "trackClicks"> & {
  trackOpens: number; trackClicks: number; statusChangedByUserId: string | null;
};
type StepRow = Omit<SequenceStep, "enabled"> & { enabled: number };

const sequenceFields = "id, accountId, name, triggerListId, senderIdentityId, status, trackOpens, trackClicks, createdAt, updatedAt, statusChangedByUserId";
const stepFields = "id, position, delayMinutes, name, subject, previewText, templateId, html, text, enabled";
export function sequenceRow(db: Database, accountId: string, id: string) {
  return rows<SequenceRow>(db, `SELECT ${sequenceFields} FROM sequences WHERE accountId = ? AND id = ?`).get(accountId, id);
}

export function sequenceStep(db: Database, accountId: string, sequenceId: string, stepId: string | null) {
  return rows<StepRow>(db, `SELECT ${stepFields} FROM sequence_steps WHERE accountId = ? AND sequenceId = ? AND id = ?`)
    .get(accountId, sequenceId, stepId);
}

function sequenceFromRow(db: Database, row: SequenceRow): Sequence {
  const { statusChangedByUserId: _actor, ...sequence } = row;
  void _actor;
  const steps = rows<StepRow>(db, `SELECT ${stepFields} FROM sequence_steps
    WHERE accountId = ? AND sequenceId = ? ORDER BY position`).all(row.accountId, row.id);
  return { ...sequence, trackOpens: row.trackOpens === 1, trackClicks: row.trackClicks === 1,
    steps: steps.map(step => ({ ...step, enabled: step.enabled === 1 })) };
}

export function getSequence(db: Database, accountId: string, id: string) {
  return sequenceFromRow(db, required(sequenceRow(db, accountId, id)));
}

function enrollmentCounts(db: Database, accountId: string, id: string) {
  const counts = { active: 0, completed: 0, cancelled: 0 };
  for (const row of rows<{ status: keyof typeof counts; count: number }>(db, `SELECT status, COUNT(*) AS count
    FROM sequence_enrollments WHERE accountId = ? AND sequenceId = ? GROUP BY status`).all(accountId, id)) counts[row.status] = row.count;
  return counts;
}

async function sequenceSummary(db: Database, { steps, ...sequence }: Sequence): Promise<SequenceSummary> {
  return { ...sequence, stepCount: steps.length, activeEnrollments: enrollmentCounts(db, sequence.accountId, sequence.id).active,
    stats: await getSendStats(sequence.accountId, { sequenceId: sequence.id }) };
}

export async function listSequences(db: Database, accountId: string) {
  const items = rows<SequenceRow>(db, `SELECT ${sequenceFields} FROM sequences WHERE accountId = ?
    ORDER BY createdAt DESC, id`).all(accountId);
  return Promise.all(items.map(row => sequenceSummary(db, sequenceFromRow(db, row))));
}

export function saveSequence(db: Database, accountId: string, input: SequenceInput, options: { id?: string; newId?: string } = {}) {
  return db.transaction(() => {
    const current = options.id ? getSequence(db, accountId, options.id) : undefined;
    const id = current?.id ?? options.newId ?? newOutreachId("seq");
    const now = Date.now();
    const next = {
      name: input.name ?? current?.name ?? "Neue Sequenz",
      triggerListId: input.triggerListId === undefined ? current?.triggerListId ?? null : input.triggerListId,
      senderIdentityId: input.senderIdentityId === undefined ? current?.senderIdentityId ?? null : input.senderIdentityId,
      trackOpens: input.trackOpens ?? current?.trackOpens ?? true,
      trackClicks: input.trackClicks ?? current?.trackClicks ?? true
    };
    if (current && current.status !== "draft" && next.triggerListId !== current.triggerListId) {
      throw new SendingError(409, "Die Auslöserliste kann nur im Entwurf geändert werden.");
    }

    const args = [next.name, next.triggerListId, next.senderIdentityId, +next.trackOpens, +next.trackClicks, now, accountId, id] as const;
    if (current) {
      db.query(`UPDATE sequences SET name = ?, triggerListId = ?, senderIdentityId = ?, trackOpens = ?, trackClicks = ?, updatedAt = ?
        WHERE accountId = ? AND id = ?`).run(...args);
    } else {
      db.query(`INSERT INTO sequences (name, triggerListId, senderIdentityId, trackOpens, trackClicks, updatedAt, accountId, id, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...args, now);
    }
    if (input.steps) {
      const originals = new Map(current?.steps.map(step => [step.id, step]));
      const seen = new Set<string>();
      db.query("DELETE FROM sequence_steps WHERE accountId = ? AND sequenceId = ?").run(accountId, id);
      for (const [position, step] of input.steps.entries()) {
        const previous = step.id ? originals.get(step.id) : undefined;
        if (step.id && (!previous || seen.has(step.id))) throw new SendingError(400, "Ungültige Schritt-ID.");
        if (step.id) seen.add(step.id);
        const templateId = step.templateId === undefined ? previous?.templateId ?? null : step.templateId;
        if (templateId && templateId !== previous?.templateId) getTemplate(db, accountId, templateId);
        const enabled = step.enabled ?? previous?.enabled ?? true;
        const authored = normalizedContent(step, previous);
        const content = current?.status !== "draft" && current
          ? resolveContent(db, accountId, { ...authored, templateId })
          : authored;
        if (current && current.status !== "draft" && enabled) assertContent(content);
        const stepId = previous?.id ?? newOutreachId("stp");
        const delayMinutes = step.delayMinutes ?? previous?.delayMinutes ?? 0;
        db.query(`INSERT INTO sequence_steps (id, accountId, sequenceId, position, name, delayMinutes, enabled, templateId, subject, previewText, html, text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(stepId, accountId, id, position, step.name ?? previous?.name ?? "",
          delayMinutes, +enabled, templateId, ...contentArgs(content));
      }
      if (current) carrySequenceEnrollments(db, accountId, id, current.steps, now);
    }
    return getSequence(db, accountId, id);
  }).immediate();
}

export function deleteSequence(db: Database, accountId: string, id: string) {
  return db.transaction(() => {
    const sequence = getSequence(db, accountId, id);
    assertDraft(sequence);
    db.query("DELETE FROM sequence_steps WHERE accountId = ? AND sequenceId = ?").run(accountId, id);
    db.query("DELETE FROM sequences WHERE accountId = ? AND id = ?").run(accountId, id);
    return sequence;
  }).immediate();
}

export async function sequenceReport(db: Database, accountId: string, id: string): Promise<SequenceReport> {
  const sequence = getSequence(db, accountId, id);
  const [summary, steps] = await Promise.all([sequenceSummary(db, sequence), Promise.all(sequence.steps.map(async step => ({
    stepId: step.id, position: step.position, name: step.name,
    stats: await getSendStats(accountId, { sequenceId: id, sequenceStepId: step.id })
  })))]);
  return { ok: true, sequence: summary, steps, enrollments: enrollmentCounts(db, accountId, id) };
}
