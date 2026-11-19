import { sendingRoute } from "@/lib/addons/outreach/sending/http";
import { renderExample } from "@/lib/addons/outreach/sending/actions";
import { renderInput, validated } from "@/lib/addons/outreach/sending/input";

export const POST = sendingRoute("preview", ({ db, accountId, body }) =>
  renderExample(db, accountId, validated(renderInput, body)));
