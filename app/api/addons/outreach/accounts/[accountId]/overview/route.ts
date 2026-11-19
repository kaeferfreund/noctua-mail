import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { getOutreachOverview } from "@/lib/addons/outreach/tracking";
import { requireOutreachContext, type AccountRouteParams } from "../../../_helpers/outreachContext";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "viewer" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => NextResponse.json(await getOutreachOverview(context.accountId)));
}
