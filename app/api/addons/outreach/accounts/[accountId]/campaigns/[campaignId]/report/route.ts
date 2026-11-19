import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { campaignReport } from "@/lib/addons/outreach/sending/store";

export const GET = sendingRoute("read", ({ db, accountId, params, query }) =>
  campaignReport(db, accountId, routeId(params, "campaignId"), query.get("cursor") ?? undefined));
