import { NextResponse } from "next/server";
import { contactFilters, contactInput, parseContactInput } from "@/lib/addons/outreach/contacts/input";
import { searchContacts, upsertContact } from "@/lib/addons/outreach/contacts/records";
import { requireOutreachContext, type AccountRouteParams } from "../../../_helpers/outreachContext";
import { contactResponse, readContactJson } from "./_http";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params);
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, null, async () => {
    const query = new URL(request.url).searchParams;
    const suppressed = query.get("suppressed");
    const filters = parseContactInput(contactFilters, {
      q: query.get("q") ?? undefined,
      listId: query.get("listId") ?? undefined,
      consent: query.get("consent") ?? undefined,
      suppressed: suppressed === null ? undefined : suppressed === "true" ? true : suppressed === "false" ? false : suppressed,
      page: query.has("page") ? Number(query.get("page")) : undefined,
      pageSize: query.has("pageSize") ? Number(query.get("pageSize")) : undefined
    });
    return searchContacts(context.accountId, filters);
  });
}

export async function POST(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, "json", async () => {
    const input = parseContactInput(contactInput, await readContactJson(request));
    return upsertContact(context.accountId, input);
  });
}
