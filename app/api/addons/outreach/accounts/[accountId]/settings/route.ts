import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { getOutreachSettings, normalizeOutreachSettingsPatch, OutreachSettingsError, saveOutreachSettings } from "@/lib/addons/outreach/settings";
import { requireOutreachContext, type AccountRouteParams } from "../../../_helpers/outreachContext";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { allowDisabled: true });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => NextResponse.json({ ok: true, settings: await getOutreachSettings(context.accountId) }));
}

/** Activation and defaults are a manager decision: the mailbox starts tracking and bulk sending. */
export async function PUT(request: Request, { params }: AccountRouteParams) {
  const context = await requireOutreachContext(request, params, { minRole: "manager", allowDisabled: true });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const originError = requireJsonSameOrigin(request);
    if (originError) return originError;
    try {
      const patch = normalizeOutreachSettingsPatch(await request.json().catch(() => null));
      return NextResponse.json({ ok: true, settings: await saveOutreachSettings(context.accountId, patch, context.userId) });
    } catch (error) {
      if (error instanceof OutreachSettingsError) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
      throw error;
    }
  });
}
