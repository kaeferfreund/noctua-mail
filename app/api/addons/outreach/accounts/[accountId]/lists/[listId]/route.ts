import { NextResponse } from "next/server";
import { idSchema, listInput, parseContactInput } from "@/lib/addons/outreach/contacts/input";
import { archiveContactList, updateContactList } from "@/lib/addons/outreach/contacts/records";
import { requireOutreachContext, type AccountRouteParams } from "../../../../_helpers/outreachContext";
import { contactResponse, readContactJson } from "../../contacts/_http";

export async function PATCH(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, "json", async () => {
    const id = parseContactInput(idSchema, (await params).listId);
    const patch = parseContactInput(listInput.partial(), await readContactJson(request));
    return { list: await updateContactList(context.accountId, id, patch) };
  });
}

export async function DELETE(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, "bodyless", async () => ({
    list: await archiveContactList(context.accountId, parseContactInput(idSchema, (await params).listId))
  }));
}
