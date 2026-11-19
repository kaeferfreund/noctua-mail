import { NextResponse } from "next/server";
import { changeManualSuppression } from "@/lib/addons/outreach/contacts/consent";
import { idSchema, parseContactInput, suppressionInput } from "@/lib/addons/outreach/contacts/input";
import { requireOutreachContext, type AccountRouteParams } from "../../../../../_helpers/outreachContext";
import { contactResponse, readContactJson } from "../../_http";

export async function POST(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, "json", async () => {
    const id = parseContactInput(idSchema, (await params).contactId);
    const { suppressed } = parseContactInput(suppressionInput, await readContactJson(request));
    return { contact: await changeManualSuppression(context.accountId, id, suppressed) };
  });
}
