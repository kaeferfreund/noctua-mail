import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { getSequence, deleteSequence } from "@/lib/addons/outreach/sending/store";
import { editSequence } from "@/lib/addons/outreach/sending/actions";
import { sequenceEditInput, validated } from "@/lib/addons/outreach/sending/input";

export const GET = sendingRoute("read", ({ db, accountId, params }) => ({
  ok: true, sequence: getSequence(db, accountId, routeId(params, "sequenceId"))
}));
/** `expectedUpdatedAt` (optional here) is the version the caller loaded: a sequence changed since answers 409 `sequence_changed`. */
export const PATCH = sendingRoute("json", async ({ db, params, body, ...actor }) => {
  const { expectedUpdatedAt, ...input } = validated(sequenceEditInput, body);
  return { ok: true, sequence: await editSequence(db, actor, routeId(params, "sequenceId"), input, { expectedUpdatedAt }) };
});
export const DELETE = sendingRoute("delete", ({ db, accountId, params }) => ({
  ok: true, sequence: deleteSequence(db, accountId, routeId(params, "sequenceId"))
}));
