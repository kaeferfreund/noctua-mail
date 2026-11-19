import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { getCampaign, saveCampaign, deleteCampaign } from "@/lib/addons/outreach/sending/store";
import { campaignInput, validated } from "@/lib/addons/outreach/sending/input";

export const GET = sendingRoute("read", ({ db, accountId, params }) => ({
  ok: true, campaign: getCampaign(db, accountId, routeId(params, "campaignId"))
}));
export const PATCH = sendingRoute("json", ({ db, accountId, userId, params, body }) => ({
  ok: true, campaign: saveCampaign(db, accountId, userId, validated(campaignInput, body), routeId(params, "campaignId"))
}));
export const DELETE = sendingRoute("delete", ({ db, accountId, params }) => ({
  ok: true, campaign: deleteCampaign(db, accountId, routeId(params, "campaignId"))
}));
