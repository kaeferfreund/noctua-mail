import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthResponse } from "@/lib/auth";
import { listTrackingEvents, trackingEventFilters } from "@/lib/addons/outreach/tracking";
import { requireOutreachContext, type AccountRouteParams } from "../../../../_helpers/outreachContext";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  ...trackingEventFilters,
  includeMachine: z.enum(["true", "false", "1", "0"]).transform(value => value === "true" || value === "1").optional(),
  limit: z.coerce.number().pipe(trackingEventFilters.limit.unwrap()).optional(),
  before: z.coerce.number().pipe(trackingEventFilters.before.unwrap()).optional()
});

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "viewer" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const filter = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!filter.success) return NextResponse.json({ ok: false, message: "Invalid tracking event filter." }, { status: 400 });
    return NextResponse.json(await listTrackingEvents(context.accountId, filter.data));
  });
}
