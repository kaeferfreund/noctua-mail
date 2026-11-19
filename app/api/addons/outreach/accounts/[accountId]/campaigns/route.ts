import { sendingRoute } from "@/lib/addons/outreach/sending/http";
import { listCampaigns, saveCampaign } from "@/lib/addons/outreach/sending/store";
import { campaignInput, validated } from "@/lib/addons/outreach/sending/input";

export const GET = sendingRoute("read", async ({ db, accountId }) => ({ ok: true, campaigns: await listCampaigns(db, accountId) }));
export const POST = sendingRoute("json", ({ db, accountId, userId, body }) => ({
  ok: true, campaign: saveCampaign(db, accountId, userId, validated(campaignInput, body))
}));
