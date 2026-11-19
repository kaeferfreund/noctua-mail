import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { getSequence, saveSequence, deleteSequence } from "@/lib/addons/outreach/sending/store";
import { sequenceInput, validated } from "@/lib/addons/outreach/sending/input";

export const GET = sendingRoute("read", ({ db, accountId, params }) => ({
  ok: true, sequence: getSequence(db, accountId, routeId(params, "sequenceId"))
}));
export const PATCH = sendingRoute("json", ({ db, accountId, params, body }) => ({
  ok: true, sequence: saveSequence(db, accountId, validated(sequenceInput, body), { id: routeId(params, "sequenceId") })
}));
export const DELETE = sendingRoute("delete", ({ db, accountId, params }) => ({
  ok: true, sequence: deleteSequence(db, accountId, routeId(params, "sequenceId"))
}));
