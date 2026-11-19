import { NextResponse } from "next/server";
import { revokeApiToken } from "@/lib/addons/outreach/contacts/apiTokens";
import { idSchema, parseContactInput } from "@/lib/addons/outreach/contacts/input";
import { requireOutreachContext, type AccountRouteParams } from "../../../../_helpers/outreachContext";
import { contactResponse } from "../../contacts/_http";

export async function DELETE(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return contactResponse(context, request, "bodyless", async () => {
    await revokeApiToken(context.accountId, parseContactInput(idSchema, (await params).tokenId));
    return {};
  });
}
