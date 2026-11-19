import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { setSequenceStatus } from "@/lib/addons/outreach/sending/actions";
import { statusInput, validated } from "@/lib/addons/outreach/sending/input";

export const POST = sendingRoute("json", async ({ db, params, body, ...actor }) => ({
  ok: true, sequence: await setSequenceStatus(db, actor, routeId(params, "sequenceId"), validated(statusInput, body).status)
}));
