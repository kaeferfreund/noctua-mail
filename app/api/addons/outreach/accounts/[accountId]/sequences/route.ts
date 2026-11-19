import { sendingRoute } from "@/lib/addons/outreach/sending/http";
import { listSequences, saveSequence } from "@/lib/addons/outreach/sending/store";
import { sequenceInput, validated } from "@/lib/addons/outreach/sending/input";

export const GET = sendingRoute("read", async ({ db, accountId }) => ({ ok: true, sequences: await listSequences(db, accountId) }));
export const POST = sendingRoute("json", ({ db, accountId, body }) => ({
  ok: true, sequence: saveSequence(db, accountId, validated(sequenceInput, body))
}));
