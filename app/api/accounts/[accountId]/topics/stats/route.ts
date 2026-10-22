import { getOwnAddresses } from "@/lib/ownAddresses";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { getTopicStats } from "@/lib/topics";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const accountId = await getAccountIdFromParams(params);
  const context = await requireAccountContext(request, accountId, { minRole: "viewer" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {

    const stats = await getTopicStats(accountId, {
      accountEmail: getOwnAddresses(context.account)
    });
    return NextResponse.json({ ok: true, stats });
  });
}
