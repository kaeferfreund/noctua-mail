import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { requireAccountContextFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { applyMailboxPatch } from "@/app/api/_helpers/mailboxPatch";
import { readJsonBody } from "@/app/api/_helpers/readJsonBody";
export async function PUT(request: Request, { params }: AccountRouteParams) {
  const context = await requireAccountContextFromParams(request, params, { minRole: "manager" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const origin = requireJsonSameOrigin(request); if (origin) return origin;
    const json = await readJsonBody<any>(request);
    if (!json.ok) return json.response;
    const payload = json.value;
    if (!payload || typeof payload !== "object" || (payload.settings !== undefined && (!payload.settings || typeof payload.settings !== "object" || Array.isArray(payload.settings)))) return NextResponse.json({ ok: false, message: "Invalid settings" }, { status: 400 });
    return applyMailboxPatch(context, { settings: payload.settings ?? {}, teamDefaults: payload.teamDefaults === true });
  });
}
