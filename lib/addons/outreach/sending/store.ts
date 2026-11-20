import { rows } from "./sql";
import type { Database } from "bun:sqlite";
import { newOutreachId } from "../ids";
import { getSendStats, listLinkStats, listSendSummaries } from "../tracking";
import {
  CONTENT_FIELDS, type Campaign, type CampaignInput, type CampaignReport, type CampaignSummary, type ContentField, type EmailTemplate,
  type EmailTemplateInput, type EmailTemplateSummary, type Sequence, type SequenceInput, type SequenceReport, type SequenceStep,
  type SequenceSummary
} from "../types";
import { contentLimits, SendingError } from "./input";
import { isEmptyRendering, normalizeTemplate, previewUnsubscribeUrl, sampleContact, type Content } from "./render";
import { carrySequenceEnrollments, refreshQueuedSubjects, renderForContact } from "./queue";

export function required<T>(value: T | null | undefined): T {
  if (value == null) throw new SendingError(404, "Eintrag nicht gefunden.");
  return value;
}

export function assertDraft(draft: { status: string }) {
  if (draft.status !== "draft") throw new SendingError(409, "Nur Entwürfe können hier geändert werden.");
}

/** Content as stored: placeholders normalized, each field within `contentLimits` (normalizing can lengthen a value). */
function normalizedContent(input: Partial<Content>, current?: Content): Required<Content> {
  const content = {
    subject: normalizeTemplate(input.subject ?? current?.subject ?? ""),
    previewText: normalizeTemplate(input.previewText ?? current?.previewText ?? ""),
    html: normalizeTemplate(input.html ?? current?.html ?? "", true),
    text: normalizeTemplate(input.text ?? current?.text ?? "")
  };
  for (const field of CONTENT_FIELDS) {
    if (content[field].length > contentLimits[field]) {
      throw new SendingError(400, `${field} ist mit ausgeschriebenen Platzhaltern länger als ${contentLimits[field]} Zeichen.`, "content_too_long");
    }
  }
  return content;
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
      if (CONTENT_FIELDS.some(field => content[field] !== current[field])) touchTemplateSequences(db, accountId, id, now);
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

/** `label` names the item in the refusal (a sequence step). */
export function assertContent(content: Content, label?: string) {
  if (!content.subject.trim() || !(content.html.trim() || content.text.trim())) {
    throw new SendingError(400, `${label ? `${label}: ` : ""}Betreff und Nachricht sind erforderlich.`);
  }
}

/** „Schritt 2 „Tipps““ in a refusal. */
function stepLabel(step: { position: number; name: string }) {
  return `Schritt ${step.position + 1}${step.name ? ` „${step.name}“` : ""}`;
}

/**
 * The content a sequence step stores, from its authored fields (`input` over `previous`): normalized and, for an enabled
 * step of a sequence that sends (`sends`: not a draft), resolved from its template and checked like going live: a
 * subject and a body, also once the placeholders are filled in for the sample contact. A disabled step keeps its own
 * fields and takes the template's content as it is when the step is enabled. The one rule for a save of the step list,
 * going live and the answer of a step edit.
 */
export function storedStepContent(db: Database, accountId: string, sends: boolean,
  step: { position: number; name: string; templateId: string | null; enabled: boolean }, input: Partial<Content>, previous?: Content) {
  const authored = normalizedContent(input, previous);
  if (!sends || !step.enabled) return authored;
  const content = resolveContent(db, accountId, { ...authored, templateId: step.templateId });
  const label = stepLabel(step);
  assertContent(content, label);
  const sample = renderForContact(db, accountId, content, { contact: sampleContact, unsubscribeUrl: previewUnsubscribeUrl(), now: Date.now() });
  if (isEmptyRendering(sample)) {
    throw new SendingError(400, `${label}: Betreff oder Nachricht ist leer, sobald die Platzhalter eingesetzt sind. Prüfe die Platzhalter.`, "content_empty");
  }
  return content;
}

/** A live sequence keeps at least one enabled step. */
export function assertEnabledStep(sequence: Pick<Sequence, "steps">) {
  if (!sequence.steps.some(step => step.enabled)) throw new SendingError(400, "Aktiviere mindestens einen Schritt.");
}

/** Going live and an edit without a step list: every enabled step stored as `storedStepContent` resolves and checks it. */
export function snapshotSequenceTemplates(db: Database, sequence: Sequence) {
  assertEnabledStep(sequence);
  const steps = sequence.steps.filter(step => step.enabled);
  const update = db.query(`UPDATE sequence_steps SET subject = ?, previewText = ?, html = ?, text = ?
    WHERE accountId = ? AND sequenceId = ? AND id = ?`);
  for (const step of steps) {
    update.run(...contentArgs(storedStepContent(db, sequence.accountId, true, step, step)), sequence.accountId, sequence.id, step.id);
  }
}

/** The fields an item (a campaign or a step) takes from its template when its content is resolved (`resolveContent`). */
export function templateBackedFields(item: Required<Content> & { templateId: string | null }): ContentField[] {
  const hasOwnBody = Boolean(item.html.trim() || item.text.trim());
  if (!item.templateId || (hasOwnBody && item.subject.trim())) return [];
  return CONTENT_FIELDS.filter(field => field === "html" || field === "text" ? !hasOwnBody : !item[field].trim());
}

export function resolveContent(db: Database, accountId: string, item: Required<Content> & { templateId: string | null }): Required<Content> {
  const fields = templateBackedFields(item);
  // Archived templates stay usable by existing references. Archiving hides them from selection.
  const template = fields.length ? rows<EmailTemplate>(db, "SELECT * FROM templates WHERE accountId = ? AND id = ?")
    .get(accountId, item.templateId) : null;
  if (!template) return normalizedContent(item);
  const content = { subject: item.subject, previewText: item.previewText, html: item.html, text: item.text };
  for (const field of fields) content[field] = template[field];
  return content;
}

/**
 * A content edit of a template can change what a sequence with a step that references the template would store or
 * approve: a step's empty field is filled from the template, and an edit pending against the version read can empty a
 * field the step has today. So the version (`updatedAt`) of every sequence of the mailbox with a step that references
 * the template rises in the same transaction, whatever the step's own content, and a go-live or edit with the version
 * read before answers `sequence_changed`.
 */
function touchTemplateSequences(db: Database, accountId: string, templateId: string, now: number) {
  db.query(`UPDATE sequences SET updatedAt = MAX(?1, updatedAt + 1) WHERE accountId = ?2
    AND id IN (SELECT sequenceId FROM sequence_steps WHERE accountId = ?2 AND templateId = ?3)`).run(now, accountId, templateId);
}

type CampaignRow = Omit<Campaign, "listIds" | "excludedListIds" | "trackOpens" | "trackClicks"> & {
  listIds: string; excludedListIds: string; trackOpens: number; trackClicks: number;
};

function campaignFromRow(row: CampaignRow): Campaign {
  return { ...row, listIds: JSON.parse(row.listIds), excludedListIds: JSON.parse(row.excludedListIds),
    trackOpens: row.trackOpens === 1, trackClicks: row.trackClicks === 1 };
}

const campaignFields = `id, accountId, name, subject, previewText, senderIdentityId, templateId, html, text,
  listIds, excludedListIds, status, trackOpens, trackClicks, sendAt, startedAt, finishedAt, createdAt, updatedAt, scheduledByUserId, scheduledVia`;
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
  trackOpens: number; trackClicks: number;
};
type StepRow = Omit<SequenceStep, "enabled"> & { enabled: number };

const sequenceFields = "id, accountId, name, triggerListId, senderIdentityId, status, trackOpens, trackClicks, createdAt, updatedAt, statusChangedByUserId, statusChangedVia";
const stepFields = "id, position, delayMinutes, name, subject, previewText, templateId, html, text, enabled";
export function sequenceRow(db: Database, accountId: string, id: string) {
  return rows<SequenceRow>(db, `SELECT ${sequenceFields} FROM sequences WHERE accountId = ? AND id = ?`).get(accountId, id);
}

export function sequenceStep(db: Database, accountId: string, sequenceId: string, stepId: string | null) {
  return rows<StepRow>(db, `SELECT ${stepFields} FROM sequence_steps WHERE accountId = ? AND sequenceId = ? AND id = ?`)
    .get(accountId, sequenceId, stepId);
}

function sequenceFromRow(db: Database, row: SequenceRow): Sequence {
  const steps = rows<StepRow>(db, `SELECT ${stepFields} FROM sequence_steps
    WHERE accountId = ? AND sequenceId = ? ORDER BY position`).all(row.accountId, row.id);
  return { ...row, trackOpens: row.trackOpens === 1, trackClicks: row.trackClicks === 1,
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

    // `updatedAt` is the version a caller's `expectedUpdatedAt` names: two saves in one millisecond still differ.
    const updatedAt = Math.max(now, (current?.updatedAt ?? 0) + 1);
    const args = [next.name, next.triggerListId, next.senderIdentityId, +next.trackOpens, +next.trackClicks, updatedAt, accountId, id] as const;
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
      const retitled: Array<{ id: string; subject: string }> = [];
      db.query("DELETE FROM sequence_steps WHERE accountId = ? AND sequenceId = ?").run(accountId, id);
      for (const [position, step] of input.steps.entries()) {
        const previous = step.id ? originals.get(step.id) : undefined;
        if (step.id && (!previous || seen.has(step.id))) throw new SendingError(400, "Ungültige Schritt-ID.");
        if (step.id) seen.add(step.id);
        const templateId = step.templateId === undefined ? previous?.templateId ?? null : step.templateId;
        if (templateId && templateId !== previous?.templateId) getTemplate(db, accountId, templateId);
        const enabled = step.enabled ?? previous?.enabled ?? true;
        const name = step.name ?? previous?.name ?? "";
        const content = storedStepContent(db, accountId, current !== undefined && current.status !== "draft",
          { position, name, templateId, enabled }, step, previous);
        const stepId = previous?.id ?? newOutreachId("stp");
        if (previous && previous.subject !== content.subject) retitled.push({ id: stepId, subject: content.subject });
        const delayMinutes = step.delayMinutes ?? previous?.delayMinutes ?? 0;
        db.query(`INSERT INTO sequence_steps (id, accountId, sequenceId, position, name, delayMinutes, enabled, templateId, subject, previewText, html, text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(stepId, accountId, id, position, name,
          delayMinutes, +enabled, templateId, ...contentArgs(content));
      }
      if (current) {
        carrySequenceEnrollments(db, accountId, id, current.steps, now);
        refreshQueuedSubjects(db, accountId, id, retitled, now);
      }
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
