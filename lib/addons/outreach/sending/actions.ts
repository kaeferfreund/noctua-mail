import { rows } from "./sql";
import type { Database } from "bun:sqlite";
import { authorizeOutbound, prepareOutboundAssertion, type OutboundAuthorization } from "@/lib/outboundAuthorization";
import { resolveSendIdentity } from "@/lib/sendIdentity";
import { getAccountById } from "@/lib/serverDb";
import { validateScheduledSendAt } from "@/lib/scheduledSend";
import { outreachPublicOrigin } from "../config";
import { listSendableRecipients } from "../contacts";
import { newOutreachId } from "../ids";
import { getOutreachSettings } from "../settings";
import type { CampaignScheduleRequest, CampaignScheduleResponse, SequenceStatus, TestSendRequest } from "../types";
import { SendingError } from "./input";
import { renderContent, sampleContact } from "./render";
import { hasSmtp, isSesConfigured, sendOutreachMail, SendStopped } from "./send";
import { sendOwner } from "./lease";
import { assertContent, assertDraft, campaignSummary, getCampaign, getSequence, required, resolveContent, snapshotSequenceTemplates } from "./store";

export type SendingActor = { accountId: string; authorization: OutboundAuthorization };

function assertLists(db: Database, accountId: string, ids: readonly string[]) {
  const query = db.query("SELECT 1 FROM lists WHERE accountId = ? AND id = ? AND archivedAt IS NULL");
  if (!ids.length || ids.some(id => !query.get(accountId, id))) throw new SendingError(400, "Wähle eine aktive Kontaktliste.");
}

async function checkTransportAndSender(actor: SendingActor, identityId: string | null) {
  const { accountId } = actor;
  const [settings, account] = await Promise.all([getOutreachSettings(accountId), getAccountById(accountId)]);
  if (!settings.enabled) throw new SendingError(409, "Newsletter ist für dieses Postfach deaktiviert.", "outreach_disabled");
  if (!outreachPublicOrigin()) throw new SendingError(400, "Es fehlt die öffentliche URL für Abmeldelinks.", "tracking_origin_missing");
  if (!account || (settings.transport === "ses" ? !isSesConfigured() : !hasSmtp(account))) {
    throw new SendingError(400, "Der Versandtransport ist nicht konfiguriert.", "transport_unavailable");
  }
  const identity = await resolveSendIdentity({ accountId, identityId: identityId ?? settings.senderIdentityId ?? undefined });
  const authorized = await authorizeOutbound(actor.authorization, { accountId, minRole: "editor", identity });
  const assertAuthorized = await prepareOutboundAssertion(authorized);
  return { settings, identity, userId: authorized.userId, assertAuthorized };
}

function assertUnchanged<T>(start: T, current: T) {
  if (JSON.stringify(start) !== JSON.stringify(current)) throw new SendingError(409, "Der Eintrag wurde inzwischen geändert.");
}

export async function scheduleCampaign(db: Database, actor: SendingActor, id: string, input: CampaignScheduleRequest): Promise<CampaignScheduleResponse> {
  const { accountId } = actor;
  const campaign = getCampaign(db, accountId, id);
  assertDraft(campaign);
  const scheduled = input.sendAt === null ? null : validateScheduledSendAt(input.sendAt);
  if (scheduled && !scheduled.ok) throw new SendingError(400, "Ungültiger Versandzeitpunkt.");
  assertLists(db, accountId, [...campaign.listIds, ...campaign.excludedListIds]);
  if (!campaign.listIds.length) throw new SendingError(400, "Wähle mindestens eine Empfängerliste.");
  const { identity, userId, assertAuthorized } = await checkTransportAndSender(actor, campaign.senderIdentityId);
  const recipients = (await listSendableRecipients(accountId, campaign)).length;
  if (input.dryRun) {
    // The same checks as a real scheduling, so the confirmation shows what would happen.
    assertContent(resolveContent(db, accountId, campaign));
    return { ok: true, campaign: await campaignSummary(campaign), recipients };
  }
  const next = db.transaction(() => {
    assertAuthorized();
    const live = getCampaign(db, accountId, id);
    assertUnchanged(campaign, live);
    assertLists(db, accountId, [...live.listIds, ...live.excludedListIds]);
    const content = resolveContent(db, accountId, live);
    assertContent(content);
    const now = Date.now();
    db.query(`UPDATE campaigns SET status = 'scheduled', scheduledByUserId = ?, sendAt = ?, updatedAt = ?,
      senderIdentityId = ?, subject = ?, previewText = ?, html = ?, text = ?
      WHERE accountId = ? AND id = ? AND status = 'draft'`).run(userId, scheduled?.sendAt ?? now, now, identity.id, content.subject, content.previewText, content.html, content.text, accountId, id);
    return getCampaign(db, accountId, id);
  }).immediate();
  return { ok: true, campaign: await campaignSummary(next), recipients };
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

export async function setSequenceStatus(db: Database, actor: SendingActor, id: string, status: Exclude<SequenceStatus, "draft">) {
  const { accountId } = actor;
  const sequence = getSequence(db, accountId, id);
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
    db.query(`UPDATE sequences SET status = ?, statusChangedByUserId = ?, updatedAt = ?
      WHERE accountId = ? AND id = ?`).run(status, authorized.userId, Date.now(), accountId, id);
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
