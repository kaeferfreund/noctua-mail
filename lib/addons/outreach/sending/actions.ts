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
import type { CampaignScheduleRequest, CampaignScheduleResponse, SequenceInput, SequenceStatus, TestSendRequest } from "../types";
import { SendingError } from "./input";
import { renderContent, sampleContact } from "./render";
import { hasSmtp, isSesConfigured, sendOutreachMail, SendStopped } from "./send";
import { sendOwner } from "./lease";
import { assertContent, assertDraft, campaignSummary, getCampaign, getSequence, required, resolveContent, saveSequence, snapshotSequenceTemplates } from "./store";

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

function assertUnchanged<T>(start: T, current: T) {
  if (JSON.stringify(start) !== JSON.stringify(current)) throw new SendingError(409, "Der Eintrag wurde inzwischen geändert.");
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

/**
 * A draft is only content. A sequence that is live, or paused and able to resume, sends what is stored: editing it
 * approves the new content like going live does, so the editor needs the same outbound authorization, becomes the
 * recorded approver (the scheduler sends under that user, `scheduler.ts`) and the templates are snapshotted again.
 */
export async function editSequence(db: Database, actor: SendingActor, id: string, input: SequenceInput) {
  const { accountId } = actor;
  const sequence = getSequence(db, accountId, id);
  if (sequence.status === "draft") {
    return db.transaction(() => {
      // Went live meanwhile: the edit would bypass the approval below.
      if (getSequence(db, accountId, id).status !== "draft") throw new SendingError(409, "Die Sequenz wurde inzwischen geändert. Prüfe sie erneut.", "sequence_changed");
      return saveSequence(db, accountId, input, { id });
    }).immediate();
  }
  const identityId = input.senderIdentityId === undefined ? sequence.senderIdentityId : input.senderIdentityId;
  const authorized = await checkTransportAndSender(actor, identityId);
  return db.transaction(() => {
    authorized.assertAuthorized();
    assertUnchanged(sequence, getSequence(db, accountId, id));
    const saved = saveSequence(db, accountId, input, { id });
    if (saved.status === "live") snapshotSequenceTemplates(db, saved);
    db.query(`UPDATE sequences SET statusChangedByUserId = ?, statusChangedVia = ? WHERE accountId = ? AND id = ?`)
      .run(authorized.userId, actor.via, accountId, id);
    return getSequence(db, accountId, id);
  }).immediate();
}

export async function setSequenceStatus(db: Database, actor: SendingActor, id: string, status: Exclude<SequenceStatus, "draft">,
  expectedUpdatedAt?: number) {
  const { accountId } = actor;
  const sequence = getSequence(db, accountId, id);
  // Going live approves the steps the caller reviewed, not a later edit by a collaborator.
  if (expectedUpdatedAt !== undefined && sequence.updatedAt !== expectedUpdatedAt) {
    throw new SendingError(409, "Die Sequenz wurde inzwischen geändert. Prüfe sie erneut.", "sequence_changed");
  }
  const authorized = status === "live" ? await checkTransportAndSender(actor, sequence.senderIdentityId)
    : await (async () => {
      const authorized = await authorizeOutbound(actor.authorization, { accountId, minRole: "editor" });
      return { userId: authorized.userId, assertAuthorized: await prepareOutboundAssertion(authorized) };
    })();
  return db.transaction(() => {
    authorized.assertAuthorized();
    assertUnchanged(sequence, getSequence(db, accountId, id));
    if (status === sequence.status) return sequence;
    if (status === "paused" && sequence.status === "draft") throw new SendingError(409, "Entwürfe können nicht pausiert werden.");
    if (status === "live") {
      assertLists(db, accountId, sequence.triggerListId ? [sequence.triggerListId] : []);
      snapshotSequenceTemplates(db, sequence);
    }
    db.query(`UPDATE sequences SET status = ?, statusChangedByUserId = ?, statusChangedVia = ?, updatedAt = ?
      WHERE accountId = ? AND id = ?`).run(status, authorized.userId, actor.via, Date.now(), accountId, id);
    return getSequence(db, accountId, id);
  }).immediate();
}

export function renderContact(db: Database, accountId: string, contactId: string | undefined, email = sampleContact.email) {
  if (!contactId) return { ...sampleContact, email };
  return required(rows<typeof sampleContact>(db, `SELECT firstName, lastName, email FROM contacts
    WHERE accountId = ? AND id = ?`).get(accountId, contactId));
}

export async function renderExample(db: Database, accountId: string, input: { subject: string; html: string; text?: string; contactId?: string }) {
  const contact = renderContact(db, accountId, input.contactId);
  const settings = await getOutreachSettings(accountId);
  return renderContent({ ...input, text: input.text ?? "" }, { contact, organizationName: settings.organizationName,
    organizationAddress: settings.organizationAddress, unsubscribeUrl: `${outreachPublicOrigin() ?? "https://example.test"}/t/u/preview`, now: Date.now() });
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
