import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { getMessageTracking } from "@/lib/addons/outreach/tracking";
import { requireOutreachContext, type AccountRouteParams } from "../../../_helpers/outreachContext";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "viewer" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const query = new URL(request.url).searchParams;
    const messageId = query.get("messageId")?.trim();
    const sendId = query.get("sendId")?.trim();
    if (Boolean(messageId) === Boolean(sendId)) {
      return NextResponse.json({ ok: false, message: "Provide either messageId or sendId." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, tracking: await getMessageTracking(context.accountId, { messageId, sendId }) });
  });
}
