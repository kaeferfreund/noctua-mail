import { expect, test } from "bun:test";
import { TEST_BASE_URL, createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { POST as scheduleCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/[campaignId]/schedule/route";
import { POST as setSequenceStatus } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/[sequenceId]/status/route";
import { getOutreachDb } from "../db";
import { saveOutreachSettings } from "../settings";
import { getCampaign, getSequence, saveCampaign, saveSequence, saveTemplate } from "./store";

/** Approval binding: a confirmation approves what the human reviewed, never a collaborator's later edit (synthetic data only). */

async function withFlag<T>(run: () => Promise<T>) {
  const previous = process.env.NOCTUA_ADDON_OUTREACH;
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  try { return await run(); } finally {
    if (previous === undefined) delete process.env.NOCTUA_ADDON_OUTREACH;
    else process.env.NOCTUA_ADDON_OUTREACH = previous;
  }
}

async function mailbox() {
  const accountId = crypto.randomUUID();
  await (await dbModulePromise).upsertAccount(identityTestAccount(accountId));
  const editor = await createAuthenticatedTestSession(accountId);
  await saveOutreachSettings(accountId, { enabled: true, transport: "mailbox-smtp" }, editor.user.id);
  const db = await getOutreachDb();
  const listId = `${accountId}-list`;
  db.query("INSERT INTO lists (accountId, id, name, createdAt, updatedAt) VALUES (?, ?, 'Newsletter', 0, 0)").run(accountId, listId);
  db.query(`INSERT INTO contacts (accountId, id, email, emailLower, emailConsent, consentAt, createdAt, updatedAt)
    VALUES (?, ?, 'reader@example.test', 'reader@example.test', 'subscribed', 1, 0, 0)`).run(accountId, `${accountId}-reader`);
  db.query("INSERT INTO list_members (accountId, listId, contactId, status, subscribedAt) VALUES (?, ?, ?, 'subscribed', 1)")
    .run(accountId, listId, `${accountId}-reader`);
  const base = `${TEST_BASE_URL}/api/addons/outreach/accounts/${accountId}`;
  const request = (route: string, body: unknown) => new Request(`${base}/${route}`, {
    method: "POST", headers: editor.jar.headers({ origin: TEST_BASE_URL, "content-type": "application/json" }), body: JSON.stringify(body)
  });
  return { accountId, editor, db, listId, request };
}

test("a campaign confirmation is refused when a referenced template changed after the dry run", () => withFlag(async () => {
  const { accountId, editor, db, listId, request } = await mailbox();
  const template = saveTemplate(db, accountId, { name: "Vorlage", subject: "Betreff", html: "<p>Geprüft</p>" }, { now: 1_000 });
  // A template reference without own body, as the flow import writes it: the content resolves when scheduling.
  const campaign = saveCampaign(db, accountId, editor.user.id, { name: "Rundbrief", templateId: template.id, listIds: [listId] });
  const at = { params: Promise.resolve({ accountId, campaignId: campaign.id }) };
  const schedule = async (body: Record<string, unknown>) => scheduleCampaign(request(`campaigns/${campaign.id}/schedule`, { sendAt: null, ...body }), at);

  // The dry run is bound to the version on screen.
  const stale = await schedule({ dryRun: true, expectedUpdatedAt: campaign.updatedAt - 1 });
  expect([stale.status, (await stale.json()).code]).toEqual([409, "campaign_changed"]);
  const preview = await (await schedule({ dryRun: true, expectedUpdatedAt: campaign.updatedAt })).json();
  expect(preview.contentVersion).toEqual(expect.any(String));

  saveTemplate(db, accountId, { html: "<p>Nachträglich geändert</p>" }, { id: template.id, now: 2_000 });
  const refused = await schedule({ expectedUpdatedAt: preview.campaign.updatedAt, expectedContentVersion: preview.contentVersion });
  expect([refused.status, (await refused.json()).code]).toEqual([409, "campaign_changed"]);
  expect(getCampaign(db, accountId, campaign.id).status).toBe("draft");

  const reviewed = await (await schedule({ dryRun: true, expectedUpdatedAt: campaign.updatedAt })).json();
  expect(reviewed.contentVersion).not.toBe(preview.contentVersion);
  const confirmed = await schedule({ expectedUpdatedAt: reviewed.campaign.updatedAt, expectedContentVersion: reviewed.contentVersion });
  expect(confirmed.status).toBe(200);
  expect(getCampaign(db, accountId, campaign.id)).toMatchObject({ status: "scheduled", html: "<p>Nachträglich geändert</p>" });
}));

test("going live is refused when the sequence changed after the version the caller reviewed", () => withFlag(async () => {
  const { accountId, db, listId, request } = await mailbox();
  const sequence = saveSequence(db, accountId, { name: "Willkommen", triggerListId: listId, steps: [{ subject: "Schritt", text: "Geprüft" }] });
  const at = { params: Promise.resolve({ accountId, sequenceId: sequence.id }) };
  const reviewedAt = sequence.updatedAt;
  db.query("UPDATE sequences SET updatedAt = ? WHERE accountId = ? AND id = ?").run(reviewedAt + 1, accountId, sequence.id);
  const refused = await setSequenceStatus(request(`sequences/${sequence.id}/status`, { status: "live", expectedUpdatedAt: reviewedAt }), at);
  expect([refused.status, (await refused.json()).code]).toEqual([409, "sequence_changed"]);
  expect(getSequence(db, accountId, sequence.id).status).toBe("draft");
  const live = await setSequenceStatus(request(`sequences/${sequence.id}/status`, { status: "live", expectedUpdatedAt: reviewedAt + 1 }), at);
  expect(live.status).toBe(200);
  expect(getSequence(db, accountId, sequence.id).status).toBe("live");
}));
