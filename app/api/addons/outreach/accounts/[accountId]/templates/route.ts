import { sendingRoute } from "@/lib/addons/outreach/sending/http";
import { listTemplates, saveTemplate } from "@/lib/addons/outreach/sending/store";
import { templateInput, validated } from "@/lib/addons/outreach/sending/input";

export const GET = sendingRoute("read", ({ db, accountId }) => ({ ok: true, templates: listTemplates(db, accountId) }));
export const POST = sendingRoute("json", ({ db, accountId, body, userId }) => ({
  ok: true, template: saveTemplate(db, accountId, validated(templateInput, body), { userId })
}));
