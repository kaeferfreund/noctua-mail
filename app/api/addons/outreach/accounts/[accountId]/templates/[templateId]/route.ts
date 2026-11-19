import { routeId, sendingRoute } from "@/lib/addons/outreach/sending/http";
import { archiveTemplate, getTemplate, saveTemplate } from "@/lib/addons/outreach/sending/store";
import { templateInput, validated } from "@/lib/addons/outreach/sending/input";

export const GET = sendingRoute("read", ({ db, accountId, params }) => ({
  ok: true, template: getTemplate(db, accountId, routeId(params, "templateId"))
}));
export const PATCH = sendingRoute("json", ({ db, accountId, params, body, userId }) => ({
  ok: true, template: saveTemplate(db, accountId, validated(templateInput.partial(), body), { id: routeId(params, "templateId"), userId })
}));
export const DELETE = sendingRoute("delete", ({ db, accountId, params, userId }) => {
  archiveTemplate(db, accountId, routeId(params, "templateId"), userId);
  return { ok: true };
});
