import { expect, test } from "bun:test";
import { TEST_BASE_URL, createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { GET as listCampaigns, POST as createCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/route";
import { PATCH as editCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/[campaignId]/route";
import { POST as scheduleCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/[campaignId]/schedule/route";
import { POST as cancelCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/[campaignId]/cancel/route";
import { POST as createSequence } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/route";
import { PATCH as editSequence } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/[sequenceId]/route";
import { POST as setSequenceStatus } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/[sequenceId]/status/route";
import { scheduleCampaign as scheduleAction } from "./actions";
import { saveCampaign } from "./store";
import { getOutreachDb } from "../db";
import { saveOutreachSettings } from "../settings";

test("REST enforces flag, editor permissions, same-origin JSON and campaign/sequence state transitions", async () => {
  const previousFlag = process.env.NOCTUA_ADDON_OUTREACH;
  const accountId = crypto.randomUUID();
  const at = { params: Promise.resolve({ accountId }) };
  const path = `/api/addons/outreach/accounts/${accountId}`;
  try {
    delete process.env.NOCTUA_ADDON_OUTREACH;
    expect((await listCampaigns(new Request(`${TEST_BASE_URL}${path}/campaigns`), at)).status).toBe(404);
    process.env.NOCTUA_ADDON_OUTREACH = "1";
    const core = await dbModulePromise;
    await core.upsertAccount(identityTestAccount(accountId));
    const editor = await createAuthenticatedTestSession();
    const viewer = await createAuthenticatedTestSession();
    await editor.addMembership(editor.user.id, accountId, "editor");
    await viewer.addMembership(viewer.user.id, accountId, "viewer");
    const request = (who: typeof editor, route: string, method = "GET", body?: unknown, origin = TEST_BASE_URL) =>
      new Request(`${TEST_BASE_URL}${path}/${route}`, {
        method, headers: who.jar.headers({ origin, ...(body === undefined ? {} : { "content-type": "application/json" }) }),
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    expect((await listCampaigns(request(viewer, "campaigns"), at)).status).toBe(409);
    await saveOutreachSettings(accountId, { enabled: true, transport: "mailbox-smtp" }, editor.user.id);
    const db = await getOutreachDb();
    db.query("INSERT INTO lists (accountId, id, name, createdAt, updatedAt) VALUES (?, ?, 'Newsletter', 0, 0)").run(accountId, accountId);

    const input = { name: "Newsletter", subject: "Betreff", html: "<p>Hallo</p>", listIds: [accountId] };
    expect((await listCampaigns(request(viewer, "campaigns"), at)).status).toBe(200);
    expect((await createCampaign(request(viewer, "campaigns", "POST", input), at)).status).toBe(403);
    expect((await createCampaign(request(editor, "campaigns", "POST", input, "https://other.example.test"), at)).status).toBe(403);
    const created = await createCampaign(request(editor, "campaigns", "POST", input), at);
    expect(created.status).toBe(200);
    const { campaign } = await created.json();
    const route = `campaigns/${campaign.id}`;
    const campaignAt = { params: Promise.resolve({ accountId, campaignId: campaign.id }) };
    expect((await scheduleCampaign(request(viewer, `${route}/schedule`, "POST", { sendAt: null }), campaignAt)).status).toBe(403);
    // A dry run answers the count after the same checks and leaves the draft a draft.
    expect((await scheduleCampaign(request(viewer, `${route}/schedule`, "POST", { sendAt: null, dryRun: true }), campaignAt)).status).toBe(403);
    const dryRun = await scheduleCampaign(request(editor, `${route}/schedule`, "POST", { sendAt: null, dryRun: true }), campaignAt);
    const preview = await dryRun.json();
    expect(preview).toMatchObject({ ok: true, campaign: { status: "draft", sendAt: null }, recipients: 0 });
    expect(typeof preview.campaign.updatedAt).toBe("number");
    db.query("UPDATE campaigns SET updatedAt = ?, subject = 'Geändert' WHERE accountId = ? AND id = ?")
      .run(preview.campaign.updatedAt + 1, accountId, campaign.id);
    const stale = await scheduleCampaign(request(editor, `${route}/schedule`, "POST",
      { sendAt: null, expectedUpdatedAt: preview.campaign.updatedAt }), campaignAt);
    expect({ status: stale.status, ...await stale.json() }).toMatchObject({ status: 409, code: "campaign_changed" });
    expect((await editCampaign(request(editor, route, "PATCH", { subject: "Betreff" }), campaignAt)).status).toBe(200);
    const raced = saveCampaign(db, accountId, editor.user.id, input);
    await expect(scheduleAction(db, { accountId, authorization: {
      request: request(editor, `campaigns/${raced.id}/schedule`, "POST", { sendAt: null, dryRun: true })
    } }, raced.id, { sendAt: null, dryRun: true }, async () => {
      saveCampaign(db, accountId, editor.user.id, { subject: "Parallel geändert" }, raced.id);
      return [];
    })).rejects.toMatchObject({ code: "campaign_changed" });
    const refreshed = await scheduleCampaign(request(editor, `${route}/schedule`, "POST", { sendAt: null, dryRun: true }), campaignAt);
    const { campaign: refreshedCampaign } = await refreshed.json();
    const scheduled = await scheduleCampaign(request(editor, `${route}/schedule`, "POST",
      { sendAt: null, expectedUpdatedAt: refreshedCampaign.updatedAt }), campaignAt);
    expect(await scheduled.json()).toMatchObject({ ok: true, campaign: { status: "scheduled" }, recipients: 0 });
    expect((await editCampaign(request(editor, route, "PATCH", { subject: "Neu" }), campaignAt)).status).toBe(409);
    expect((await cancelCampaign(request(editor, `${route}/cancel`, "POST"), campaignAt)).status).toBe(200);
    expect((await cancelCampaign(request(editor, `${route}/cancel`, "POST"), campaignAt)).status).toBe(409);

    const sequenceResponse = await createSequence(request(editor, "sequences", "POST", {
      triggerListId: accountId, steps: [{ subject: "Schritt", text: "Hallo" }]
    }), at);
    const { sequence } = await sequenceResponse.json();
    const sequenceAt = { params: Promise.resolve({ accountId, sequenceId: sequence.id }) };
    const statusPath = `sequences/${sequence.id}/status`;
    expect((await setSequenceStatus(request(editor, statusPath, "POST", { status: "paused" }), sequenceAt)).status).toBe(409);
    expect((await setSequenceStatus(request(editor, statusPath, "POST", { status: "live" }), sequenceAt)).status).toBe(200);
    expect((await setSequenceStatus(request(viewer, statusPath, "POST", { status: "paused" }), sequenceAt)).status).toBe(403);
  } finally {
    if (previousFlag === undefined) delete process.env.NOCTUA_ADDON_OUTREACH;
    else process.env.NOCTUA_ADDON_OUTREACH = previousFlag;
  }
});

test("REST rejects an unknown sender identity on a live or paused sequence", async () => {
  const previousFlag = process.env.NOCTUA_ADDON_OUTREACH;
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  try {
    const accountId = crypto.randomUUID();
    await (await dbModulePromise).upsertAccount(identityTestAccount(accountId));
    const editor = await createAuthenticatedTestSession();
    await editor.addMembership(editor.user.id, accountId, "editor");
    await saveOutreachSettings(accountId, { enabled: true }, editor.user.id);
    const db = await getOutreachDb();
    db.query(`INSERT INTO sequences (accountId, id, name, status, createdAt, updatedAt)
      VALUES (?, 'sequence', 'Sequence', 'live', 0, 0)`).run(accountId);
    const params = { params: Promise.resolve({ accountId, sequenceId: "sequence" }) };
    for (const status of ["live", "paused"]) {
      db.query("UPDATE sequences SET status = ? WHERE accountId = ? AND id = 'sequence'").run(status, accountId);
      const response = await editSequence(new Request(`${TEST_BASE_URL}/api/addons/outreach/accounts/${accountId}/sequences/sequence`, {
        method: "PATCH", headers: editor.jar.headers({ origin: TEST_BASE_URL, "content-type": "application/json" }),
        body: JSON.stringify({ senderIdentityId: "missing" })
      }), params);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "identity_unavailable" });
      expect(db.query("SELECT senderIdentityId FROM sequences WHERE accountId = ? AND id = 'sequence'").get(accountId))
        .toEqual({ senderIdentityId: null });
    }
  } finally {
    if (previousFlag === undefined) delete process.env.NOCTUA_ADDON_OUTREACH;
    else process.env.NOCTUA_ADDON_OUTREACH = previousFlag;
  }
});
