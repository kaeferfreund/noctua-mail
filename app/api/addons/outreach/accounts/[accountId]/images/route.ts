import { NextResponse } from "next/server";
import { readBoundedBody } from "@/app/api/_helpers/readAuthJson";
import { requireBinarySameOrigin } from "@/app/api/_helpers/requestOrigin";
import { getOutreachDb } from "@/lib/addons/outreach/db";
import { listOutreachImages, OutreachImageError, prepareImage, saveOutreachImage } from "@/lib/addons/outreach/media";
import { OUTREACH_IMAGE_MAX_BYTES, type OutreachImageListResponse } from "@/lib/addons/outreach/types";
import { withAuthResponse } from "@/lib/auth";
import { requireOutreachContext, type AccountRouteParams } from "../../../_helpers/outreachContext";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "viewer" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => NextResponse.json({
    ok: true, images: listOutreachImages(await getOutreachDb(), context.accountId)
  } satisfies OutreachImageListResponse));
}

export async function POST(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "editor" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const originError = requireBinarySameOrigin(request);
    if (originError) return originError;
    try {
      const bytes = await readBoundedBody(request, OUTREACH_IMAGE_MAX_BYTES).catch(() => {
        throw new OutreachImageError(400, "Die Dateidaten konnten nicht gelesen werden.");
      });
      if (!bytes) throw new OutreachImageError(413, "Das Bild darf höchstens 5 MiB groß sein.");
      const filename = new URL(request.url).searchParams.get("filename") ?? "";
      const image = prepareImage(bytes, filename);
      return NextResponse.json(await saveOutreachImage(await getOutreachDb(), context.accountId, image, context.userId));
    } catch (error) {
      if (error instanceof OutreachImageError) {
        return NextResponse.json({ ok: false, message: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status });
      }
      console.warn("[outreach] Image upload failed");
      return NextResponse.json({ ok: false, message: "Das Bild konnte nicht gespeichert werden." }, { status: 500 });
    }
  });
}
