import { NextResponse } from "next/server";
import { changeContactSubscription } from "@/lib/addons/outreach/contacts/consent";
import { idSchema, parseContactInput, subscriptionInput } from "@/lib/addons/outreach/contacts/input";
import { requireOutreachContext, type AccountRouteParams } from "../../../../../_helpers/outreachContext";
import { contactResponse, readContactJson } from "../../_http";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, "json", async () => {
    const id = parseContactInput(idSchema, (await params).contactId);
    const change = parseContactInput(subscriptionInput, await readContactJson(request));
    return { contact: await changeContactSubscription(context.accountId, id, change) };
  });
}
