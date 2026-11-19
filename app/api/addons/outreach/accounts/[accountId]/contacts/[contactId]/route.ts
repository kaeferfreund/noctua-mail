import { NextResponse } from "next/server";
import { eraseContact } from "@/lib/addons/outreach/contacts/consent";
import { contactInput, idSchema, parseContactInput } from "@/lib/addons/outreach/contacts/input";
import { getContactDetail, patchContact } from "@/lib/addons/outreach/contacts/records";
import { requireOutreachContext, type AccountRouteParams } from "../../../../_helpers/outreachContext";
import { contactResponse, readContactJson } from "../_http";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params);
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, null, async () => ({
    contact: await getContactDetail(context.accountId, parseContactInput(idSchema, (await params).contactId))
  }));
}

export async function PATCH(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, "json", async () => {
    const id = parseContactInput(idSchema, (await params).contactId);
    const patch = parseContactInput(contactInput.partial(), await readContactJson(request));
    return { contact: await patchContact(context.accountId, id, patch) };
  });
}

export async function DELETE(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, "bodyless", async () => {
    await eraseContact(context.accountId, parseContactInput(idSchema, (await params).contactId));
    return {};
  });
}
