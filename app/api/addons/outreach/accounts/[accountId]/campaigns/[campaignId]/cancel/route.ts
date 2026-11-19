import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { cancelCampaign } from "@/lib/addons/outreach/sending/actions";

export const POST = sendingRoute("command", async ({ db, params, ...actor }) => ({
  ok: true, campaign: await cancelCampaign(db, actor, routeId(params, "campaignId"))
}));
