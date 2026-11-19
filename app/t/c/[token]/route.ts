import { trackingClickResponse } from "@/lib/addons/outreach/tracking";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  return trackingClickResponse(request, (await params).token);
}

export const HEAD = GET;
