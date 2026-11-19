import { trackingOpenResponse } from "@/lib/addons/outreach/tracking";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  return trackingOpenResponse(request, (await params).filename);
}

export const HEAD = GET;
