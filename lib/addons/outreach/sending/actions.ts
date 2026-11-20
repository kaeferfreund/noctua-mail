import { createHash } from "crypto";
import { rows } from "./sql";
import type { Database } from "bun:sqlite";
import { authorizeOutbound, prepareOutboundAssertion, type OutboundAuthorization } from "@/lib/outboundAuthorization";
import { resolveSendIdentity } from "@/lib/sendIdentity";
import { SenderIdentityError } from "@/lib/senderIdentityError";
import { getAccountById } from "@/lib/serverDb";
import { validateScheduledSendAt } from "@/lib/scheduledSend";
import { outreachPublicOrigin } from "../config";
import { listSendableRecipients } from "../contacts";
import { newOutreachId } from "../ids";
import { getOutreachSettings } from "../settings";
import {
  CONTENT_FIELDS, type CampaignScheduleRequest, type CampaignScheduleResponse, type Sequence, type SequenceInput, type SequenceStatus,
  type ContentField, type SequenceStepEdit, type TestSendRequest
} from "../types";
import { contentLimits, SendingError } from "./input";
import { previewUnsubscribeUrl, renderContent, renderPreviewText, sampleContact } from "./render";
import { hasSmtp, isSesConfigured, sendOutreachMail, SendStopped } from "./send";
import { sendOwner } from "./lease";
import {
  assertContent, assertDraft, campaignSummary, getCampaign, getSequence, required, resolveContent, saveSequence, snapshotSequenceTemplates,
  storedStepContent, templateBackedFields
} from "./store";

/** `via`: where the request came from, recorded with a scheduled campaign or a status change (`../via.ts`). */
export type SendingActor = { accountId: string; authorization: OutboundAuthorization; via: string };

function assertLists(db: Database, accountId: string, ids: readonly string[]) {
  const query = db.query("SELECT 1 FROM lists WHERE accountId = ? AND id = ? AND archivedAt IS NULL");
  if (!ids.length || ids.some(id => !query.get(accountId, id))) throw new SendingError(400, "Wähle eine aktive Kontaktliste.");
}

async function resolveOutreachIdentity(accountId: string, identityId: string | null | undefined) {
  try {
    return await resolveSendIdentity({ accountId, identityId: identityId ?? undefined });
  } catch (error) {
    if (!(error instanceof SenderIdentityError)) throw error;
    throw new SendingError(409, "Wähle eine aktive Absenderidentität für dieses Postfach.", "identity_unavailable");
  }
}

async function checkTransportAndSender(actor: SendingActor, identityId: string | null) {
  const { accountId } = actor;
  const [settings, account] = await Promise.all([getOutreachSettings(accountId), getAccountById(accountId)]);
  if (!settings.enabled) throw new SendingError(409, "Newsletter ist für dieses Postfach deaktiviert.", "outreach_disabled");
  if (!outreachPublicOrigin()) throw new SendingError(400, "Es fehlt die öffentliche URL für Abmeldelinks.", "tracking_origin_missing");
  if (!account || (settings.transport === "ses" ? !isSesConfigured() : !hasSmtp(account))) {
    throw new SendingError(400, "Der Versandtransport ist nicht konfiguriert.", "transport_unavailable");
  }
  const identity = await resolveOutreachIdentity(accountId, identityId ?? settings.senderIdentityId);
  const authorized = await authorizeOutbound(actor.authorization, { accountId, minRole: "editor", identity });
  const assertAuthorized = await prepareOutboundAssertion(authorized);
  return { settings, identity, userId: authorized.userId, assertAuthorized };
}

function campaignChanged() {
  return new SendingError(409, "Der Entwurf wurde inzwischen geändert. Prüfe die Kampagne erneut.", "campaign_changed");
}

/** What a confirmation approves: the content as it will be sent (templates resolved), the sender and the audience. */
function campaignContentVersion(content: object, identityId: string, campaign: Pick<import("../types").Campaign,
  "listIds" | "excludedListIds" | "trackOpens" | "trackClicks">) {
  const { listIds, excludedListIds, trackOpens, trackClicks } = campaign;
  return createHash("sha256").update(JSON.stringify([content, identityId, listIds, excludedListIds, trackOpens, trackClicks])).digest("base64url");
}

export async function scheduleCampaign(db: Database, actor: SendingActor, id: string, input: CampaignScheduleRequest,
  listRecipients = listSendableRecipients): Promise<CampaignScheduleResponse> {
  const { accountId } = actor;
  const campaign = getCampaign(db, accountId, id);
  if (input.expectedUpdatedAt !== undefined && (campaign.updatedAt !== input.expectedUpdatedAt || campaign.status !== "draft")) {
    throw campaignChanged();
  }
  assertDraft(campaign);
  const scheduled = input.sendAt === null ? null : validateScheduledSendAt(input.sendAt);
  if (scheduled && !scheduled.ok) throw new SendingError(400, "Ungültiger Versandzeitpunkt.");
  assertLists(db, accountId, [...campaign.listIds, ...campaign.excludedListIds]);
  if (!campaign.listIds.length) throw new SendingError(400, "Wähle mindestens eine Empfängerliste.");
  const { identity, userId, assertAuthorized } = await checkTransportAndSender(actor, campaign.senderIdentityId);
  const recipients = (await listRecipients(accountId, campaign)).length;
  if (!input.dryRun && !recipients) {
    throw new SendingError(409, "Die Kampagne erreicht derzeit niemanden: In den gewählten Listen ist kein Kontakt eingetragen, der den Newsletter erhalten darf.", "no_recipients");
  }
  const preview = input.dryRun ? await campaignSummary(campaign) : null;
  const { next, contentVersion } = db.transaction(() => {
    assertAuthorized();
    const live = getCampaign(db, accountId, id);
    if (JSON.stringify(live) !== JSON.stringify(campaign)) throw campaignChanged();
    assertLists(db, accountId, [...live.listIds, ...live.excludedListIds]);
    const content = resolveContent(db, accountId, live);
    assertContent(content);
    // A referenced template can change without touching the campaign row: the confirmation must
    // approve exactly what the dry run resolved.
    const contentVersion = campaignContentVersion(content, identity.id, live);
    if (input.expectedContentVersion !== undefined && input.expectedContentVersion !== contentVersion) throw campaignChanged();
    if (preview) return { next: live, contentVersion };
    const now = Date.now();
    db.query(`UPDATE campaigns SET status = 'scheduled', scheduledByUserId = ?, scheduledVia = ?, sendAt = ?, updatedAt = ?,
      senderIdentityId = ?, subject = ?, previewText = ?, html = ?, text = ?
      WHERE accountId = ? AND id = ? AND status = 'draft'`).run(userId, actor.via, scheduled?.sendAt ?? now, Math.max(now, live.updatedAt + 1), identity.id, content.subject, content.previewText, content.html, content.text, accountId, id);
    return { next: getCampaign(db, accountId, id), contentVersion };
  }).immediate();
  return { ok: true, campaign: preview ?? await campaignSummary(next), recipients, contentVersion };
}

export async function cancelCampaign(db: Database, actor: SendingActor, id: string) {
  const { accountId } = actor;
  const authorized = await authorizeOutbound(actor.authorization, { accountId, minRole: "editor" });
  const assertAuthorized = await prepareOutboundAssertion(authorized);
  return db.transaction(() => {
    assertAuthorized();
    const campaign = getCampaign(db, accountId, id);
    if (campaign.status !== "scheduled" && campaign.status !== "sending") {
      throw new SendingError(409, "Nur geplante oder laufende Kampagnen können abgebrochen werden.");
    }
    const now = Date.now();
    db.query(`UPDATE campaigns SET status = 'cancelled', finishedAt = ?, updatedAt = ? WHERE accountId = ? AND id = ?`).run(now, now, accountId, id);
    db.query(`UPDATE sends SET status = 'skipped', error = 'cancelled'
      WHERE accountId = ? AND kind = 'campaign' AND campaignId = ? AND status = 'queued'`).run(accountId, id);
    return getCampaign(db, accountId, id);
  }).immediate();
}

function sequenceChanged() {
  return new SendingError(409, "Die Sequenz wurde inzwischen geändert. Prüfe sie erneut.", "sequence_changed");
}

/** Inside the write transaction: the sequence (status included) is still the one the caller read. */
function assertSequenceUnchanged(db: Database, read: Sequence) {
  if (JSON.stringify(read) !== JSON.stringify(getSequence(db, read.accountId, read.id))) throw sequenceChanged();
}

/**
 * `expectedUpdatedAt` binds an edit to the version the caller read. A token caller must name it for a sequence that is
 * not a draft. `checkOnly` runs every check that precedes the write and saves nothing (a dry run).
 */
export type SequenceEditOptions = { expectedUpdatedAt?: number; checkOnly?: boolean };

/**
 * The checks that precede an edit of `sequence` as the caller read it: the version first, then, for a sequence that is
 * not a draft, the outbound authorization of going live (`checkTransportAndSender`: editor role, sender identity,
 * transport, an MCP token's `send` scope). A draft is only content and needs no outbound authorization.
 */
async function authorizeSequenceEdit(actor: SendingActor, sequence: Sequence, options: SequenceEditOptions,
  senderIdentityId?: string | null) {
  if (options.expectedUpdatedAt !== undefined && sequence.updatedAt !== options.expectedUpdatedAt) throw sequenceChanged();
  if (sequence.status === "draft") return null;
  const authorized = await checkTransportAndSender(actor, senderIdentityId === undefined ? sequence.senderIdentityId : senderIdentityId);
  if (options.expectedUpdatedAt === undefined && "tokenId" in actor.authorization) {
    throw new SendingError(400, "Für eine Sequenz, die live oder pausiert ist, ist expectedUpdatedAt erforderlich.", "expected_updated_at_required");
  }
  return authorized;
}

/**
 * The one write path of an edit of a sequence. A sequence that is live, or paused and able to resume, sends what is
 * stored: editing it approves the new content like going live does, so the editor becomes the recorded approver (the
 * scheduler sends under that user, `scheduler.ts`) and the templates are snapshotted again.
 */
function writeSequenceEdit(db: Database, actor: SendingActor, sequence: Sequence, input: SequenceInput,
  authorized: Awaited<ReturnType<typeof authorizeSequenceEdit>>) {
  const { accountId, id } = sequence;
  return db.transaction(() => {
    authorized?.assertAuthorized();
    // Also the status: a draft that went live meanwhile would be edited without the approval above.
    assertSequenceUnchanged(db, sequence);
    const saved = saveSequence(db, accountId, input, { id });
    if (!authorized) return saved;
    if (saved.status === "live") snapshotSequenceTemplates(db, saved);
    db.query("UPDATE sequences SET statusChangedByUserId = ?, statusChangedVia = ? WHERE accountId = ? AND id = ?")
      .run(authorized.userId, actor.via, accountId, id);
    return getSequence(db, accountId, id);
  }).immediate();
}

/** Edits a sequence (REST passes the session actor, MCP the token actor). */
export async function editSequence(db: Database, actor: SendingActor, id: string, input: SequenceInput, options: SequenceEditOptions = {}) {
  const sequence = getSequence(db, actor.accountId, id);
  const authorized = await authorizeSequenceEdit(actor, sequence, options, input.senderIdentityId);
  if (options.checkOnly) {
    authorized?.assertAuthorized();
    return sequence;
  }
  return writeSequenceEdit(db, actor, sequence, input, authorized);
}

/**
 * Changes the content of one step and leaves the step list alone, through the write path of `editSequence`.
 * The version and the authorization are checked before anything about the step. `changed`, `saved` and the answered
 * step describe the content as it would be stored (`storedStepContent`, the rule of a save of the step list), also in
 * a dry run; a field equal to the stored value once normalized is no change. `warnings` are the renderer's (an unknown
 * placeholder, for example) for the content as it would be sent, preview text included.
 */
export async function editSequenceStep(db: Database, actor: SendingActor, id: string, stepId: string, edit: SequenceStepEdit,
  options: { expectedUpdatedAt?: number; dryRun?: boolean }) {
  const { accountId } = actor;
  const sequence = getSequence(db, accountId, id);
  const authorized = await authorizeSequenceEdit(actor, sequence, options);
  const step = required(sequence.steps.find(item => item.id === stepId));
  const next = Object.fromEntries(CONTENT_FIELDS.map(field => [field, edit[field] ?? step[field]])) as Record<ContentField, string>;
  const replacements = (edit.replacements ?? []).map(({ field, find, replace, replaceAll }, index) => {
    const occurrences = next[field].split(find).length - 1;
    if (!occurrences) {
      const hint = templateBackedFields({ ...next, templateId: step.templateId }).includes(field)
        ? " Das Feld ist im Schritt leer, der Inhalt kommt aus der Vorlage." : "";
      throw new SendingError(409, `Ersetzung ${index + 1}: Der gesuchte Text steht nicht in ${field}.${hint}`, "replacement_not_found");
    }
    if (occurrences > 1 && !replaceAll) {
      throw new SendingError(409, `Ersetzung ${index + 1}: Der gesuchte Text steht ${occurrences}-mal in ${field}. Erweitere ihn oder setze replaceAll.`, "replacement_ambiguous");
    }
    // Checked before the text is built: a short request can ask for a very long result.
    if (next[field].length + occurrences * (replace.length - find.length) > contentLimits[field]) {
      throw new SendingError(400, `Ersetzung ${index + 1}: ${field} wäre danach länger als ${contentLimits[field]} Zeichen.`, "replacement_too_long");
    }
    next[field] = next[field].replaceAll(find, () => replace);
    return { field, occurrences };
  });
  const name = edit.name ?? step.name;
  const stored = { name, ...storedStepContent(db, accountId, sequence.status !== "draft", { ...step, name }, next) };
  const changed = (["name", ...CONTENT_FIELDS] as const).filter(field => stored[field] !== step[field]);
  const { warnings } = await renderExample(db, accountId, resolveContent(db, accountId, { ...stored, templateId: step.templateId }));
  const saved = !options.dryRun && changed.length > 0;
  if (!saved) {
    authorized?.assertAuthorized();
    return { sequence, step: { ...step, ...stored }, changed, replacements, warnings, saved };
  }
  const input = { steps: sequence.steps.map(item => item.id === stepId ? { id: stepId, ...stored } : { id: item.id }) };
  const result = writeSequenceEdit(db, actor, sequence, input, authorized);
  return { sequence: result, step: required(result.steps.find(item => item.id === stepId)), changed, replacements, warnings, saved };
}

export async function setSequenceStatus(db: Database, actor: SendingActor, id: string, status: Exclude<SequenceStatus, "draft">,
  expectedUpdatedAt?: number) {
  const { accountId } = actor;
  const sequence = getSequence(db, accountId, id);
  // Going live approves the steps the caller reviewed, not a later edit by a collaborator.
  if (expectedUpdatedAt !== undefined && sequence.updatedAt !== expectedUpdatedAt) throw sequenceChanged();
  const authorized = status === "live" ? await checkTransportAndSender(actor, sequence.senderIdentityId)
    : await (async () => {
      const authorized = await authorizeOutbound(actor.authorization, { accountId, minRole: "editor" });
      return { userId: authorized.userId, assertAuthorized: await prepareOutboundAssertion(authorized) };
    })();
  return db.transaction(() => {
    authorized.assertAuthorized();
    assertSequenceUnchanged(db, sequence);
    if (status === sequence.status) return sequence;
    if (status === "paused" && sequence.status === "draft") throw new SendingError(409, "Entwürfe können nicht pausiert werden.");
    if (status === "live") {
      assertLists(db, accountId, sequence.triggerListId ? [sequence.triggerListId] : []);
      snapshotSequenceTemplates(db, sequence);
    }
    db.query(`UPDATE sequences SET status = ?, statusChangedByUserId = ?, statusChangedVia = ?, updatedAt = ?
      WHERE accountId = ? AND id = ?`).run(status, authorized.userId, actor.via, Math.max(Date.now(), sequence.updatedAt + 1), accountId, id);
    return getSequence(db, accountId, id);
  }).immediate();
}

export function renderContact(db: Database, accountId: string, contactId: string | undefined, email = sampleContact.email) {
  if (!contactId) return { ...sampleContact, email };
  return required(rows<typeof sampleContact>(db, `SELECT firstName, lastName, email FROM contacts
    WHERE accountId = ? AND id = ?`).get(accountId, contactId));
}

/** `warnings` cover the preview text too when it is given (rendered like the send path does). */
export async function renderExample(db: Database, accountId: string,
  input: { subject: string; html: string; text?: string; previewText?: string; contactId?: string }) {
  const contact = renderContact(db, accountId, input.contactId);
  const settings = await getOutreachSettings(accountId);
  const options = { contact, organizationName: settings.organizationName, organizationAddress: settings.organizationAddress,
    unsubscribeUrl: previewUnsubscribeUrl(), now: Date.now() };
  const rendered = renderContent({ ...input, text: input.text ?? "" }, options);
  if (!input.previewText) return rendered;
  return { ...rendered, warnings: [...new Set([...rendered.warnings, ...renderPreviewText(input.previewText, options).warnings])] };
}

export async function testCampaign(db: Database, actor: SendingActor, id: string, input: TestSendRequest) {
  const { accountId } = actor;
  const campaign = getCampaign(db, accountId, id);
  const content = resolveContent(db, accountId, campaign);
  assertContent(content);
  const sample = renderContact(db, accountId, input.contactId, input.to);
  const { settings, identity, userId, assertAuthorized } = await checkTransportAndSender(actor, campaign.senderIdentityId);
  const sendId = newOutreachId("snd");
  const owner = sendOwner();
  const now = Date.now();
  assertAuthorized();
  db.query(`INSERT INTO sends (id, accountId, kind, recipients, subject, status, claimOwner, claimedAt, attempts, userId,
    trackOpens, trackClicks, queuedAt) VALUES (?, ?, 'test', ?, ?, 'sending', ?, ?, 1, ?, 0, 0, ?)`).run(sendId, accountId, input.to, content.subject, owner, now, userId, now);
  const outcome = await sendOutreachMail({
    settings, content, sendId, recipient: { sample, testAddress: input.to }, identityId: identity.id,
    authorization: actor.authorization, trackOpens: false, trackClicks: false,
    assertClaim() {
      if (!db.query(`SELECT 1 FROM sends s JOIN account_settings a ON a.accountId = s.accountId
        WHERE s.accountId = ? AND s.id = ? AND s.status = 'sending' AND s.claimOwner = ?
          AND a.enabled = 1 AND a.updatedAt = ?`).get(accountId, sendId, owner, settings.updatedAt)) throw new SendStopped("interrupted");
    }
  });
  if (outcome.status === "sent") {
    db.query(`UPDATE sends SET status = 'sent', claimOwner = NULL, messageId = ?, providerMessageId = ?, subject = ?, sentAt = ?
      WHERE accountId = ? AND id = ? AND claimOwner = ? AND status = 'sending'`).run(outcome.messageId, outcome.providerMessageId, outcome.subject, outcome.sentAt, accountId, sendId, owner);
    return { ok: true } as const;
  }
  db.query(`UPDATE sends SET status = 'failed', claimOwner = NULL, error = ?
    WHERE accountId = ? AND id = ? AND claimOwner = ? AND status = 'sending'`).run(outcome.reason, accountId, sendId, owner);
  throw new SendingError(outcome.reason === "permission_revoked" ? 403 : 502, "Testmail konnte nicht gesendet werden.", outcome.reason);
}
