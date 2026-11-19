import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { scheduleCampaign } from "@/lib/addons/outreach/sending/actions";
import { scheduleInput, validated } from "@/lib/addons/outreach/sending/input";

export const POST = sendingRoute("json", ({ db, params, body, ...actor }) =>
  scheduleCampaign(db, actor, routeId(params, "campaignId"), validated(scheduleInput, body)));
