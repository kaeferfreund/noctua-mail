import { NextResponse } from "next/server";
import { requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { getUserAccountPrefs, mergeUserAccountPrefs } from "@/lib/serverDb";
import { InvalidAccountPreferencesError } from "@/lib/serverDb";
import { accountPrefsPatchSchema } from "@/lib/accountPrefs";
export async function GET(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "viewer" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => NextResponse.json({ ok: true, prefs: await getUserAccountPrefs(context.userId, context.accountId) }));
}
export async function PUT(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "viewer" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const origin = requireJsonSameOrigin(request); if (origin) return origin;
    const patch = accountPrefsPatchSchema.safeParse(await request.json().catch(() => null));
    if (!patch.success) return NextResponse.json({ ok: false, code: "invalid_preferences", message: "Invalid preferences" }, { status: 400 });
    try {
      return NextResponse.json({ ok: true, prefs: await mergeUserAccountPrefs(context.userId, context.accountId, patch.data) });
    } catch (error) {
      if (error instanceof InvalidAccountPreferencesError) return NextResponse.json({ ok: false, code: "invalid_preferences", message: error.message }, { status: 400 });
      throw error;
    }
  });
}
