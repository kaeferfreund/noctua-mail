import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { testCampaign } from "@/lib/addons/outreach/sending/actions";
import { testInput, validated } from "@/lib/addons/outreach/sending/input";

export const POST = sendingRoute("json", ({ db, params, body, ...actor }) =>
  testCampaign(db, actor, routeId(params, "campaignId"), validated(testInput, body)));
