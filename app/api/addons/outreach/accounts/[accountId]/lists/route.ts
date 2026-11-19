import { NextResponse } from "next/server";
import { listInput, parseContactInput } from "@/lib/addons/outreach/contacts/input";
import { createContactList, listContactLists } from "@/lib/addons/outreach/contacts/records";
import { requireOutreachContext, type AccountRouteParams } from "../../../_helpers/outreachContext";
import { contactResponse, readContactJson } from "../contacts/_http";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params);
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, null, async () => ({ lists: await listContactLists(context.accountId) }));
}

export async function POST(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, "json", async () => {
    const input = parseContactInput(listInput, await readContactJson(request));
    return { list: await createContactList(context.accountId, input) };
  });
}
