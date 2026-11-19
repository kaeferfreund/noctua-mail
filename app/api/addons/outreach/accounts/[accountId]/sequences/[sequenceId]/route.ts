import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { getSequence, deleteSequence } from "@/lib/addons/outreach/sending/store";
import { editSequence } from "@/lib/addons/outreach/sending/actions";
import { sequenceInput, validated } from "@/lib/addons/outreach/sending/input";

export const GET = sendingRoute("read", ({ db, accountId, params }) => ({
  ok: true, sequence: getSequence(db, accountId, routeId(params, "sequenceId"))
}));
export const PATCH = sendingRoute("json", async ({ db, accountId, params, body }) => ({
  ok: true, sequence: await editSequence(db, accountId, routeId(params, "sequenceId"), validated(sequenceInput, body))
}));
export const DELETE = sendingRoute("delete", ({ db, accountId, params }) => ({
  ok: true, sequence: deleteSequence(db, accountId, routeId(params, "sequenceId"))
}));
