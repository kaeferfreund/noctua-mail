import { NextResponse } from "next/server";
import { createApiToken, listApiTokens } from "@/lib/addons/outreach/contacts/apiTokens";
import { parseContactInput, tokenInput } from "@/lib/addons/outreach/contacts/input";
import { requireOutreachContext, type AccountRouteParams } from "../../../_helpers/outreachContext";
import { contactResponse, readContactJson } from "../contacts/_http";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, null, async () => ({ tokens: await listApiTokens(context.accountId) }));
}

export async function POST(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, "json", async () => {
    const input = parseContactInput(tokenInput, await readContactJson(request));
    return createApiToken(context.accountId, context.userId, input);
  });
}
