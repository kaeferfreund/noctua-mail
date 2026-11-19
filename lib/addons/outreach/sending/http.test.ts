import { expect, test } from "bun:test";
import { TEST_BASE_URL, createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { identityTestAccount } from "@/lib/testFixtures/senderIdentities";
import { GET as listCampaigns, POST as createCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/route";
import { PATCH as editCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/[campaignId]/route";
import { POST as scheduleCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/[campaignId]/schedule/route";
import { POST as cancelCampaign } from "@/app/api/addons/outreach/accounts/[accountId]/campaigns/[campaignId]/cancel/route";
import { POST as createSequence } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/route";
import { POST as setSequenceStatus } from "@/app/api/addons/outreach/accounts/[accountId]/sequences/[sequenceId]/status/route";
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
    expect(await dryRun.json()).toMatchObject({ ok: true, campaign: { status: "draft", sendAt: null }, recipients: 0 });
    expect((await editCampaign(request(editor, route, "PATCH", { subject: "Betreff" }), campaignAt)).status).toBe(200);
    const scheduled = await scheduleCampaign(request(editor, `${route}/schedule`, "POST", { sendAt: null }), campaignAt);
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
