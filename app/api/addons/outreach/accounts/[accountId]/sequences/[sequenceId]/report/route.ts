import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { sequenceReport } from "@/lib/addons/outreach/sending/store";

export const GET = sendingRoute("read", ({ db, accountId, params }) =>
  sequenceReport(db, accountId, routeId(params, "sequenceId")));
