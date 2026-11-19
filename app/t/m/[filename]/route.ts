import { outreachImageResponse } from "@/lib/addons/outreach/media/public";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  return outreachImageResponse(request, (await params).filename);
}

export const HEAD = GET;
