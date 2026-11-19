import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { readBoundedBody } from "@/app/api/_helpers/readAuthJson";
import { getOutreachSettings, normalizeOutreachSettingsPatch, OutreachSettingsError, saveOutreachSettings } from "@/lib/addons/outreach/settings";
import { requireOutreachContext, type AccountRouteParams } from "../../../_helpers/outreachContext";

export const dynamic = "force-dynamic";

const SETTINGS_BODY_LIMIT = 64 * 1024;

/** The JSON body, `null` when it is unreadable or not JSON, `undefined` when it exceeds the limit. */
async function readSettingsJson(request: Request): Promise<unknown> {
  const bytes = await readBoundedBody(request, SETTINGS_BODY_LIMIT).catch(() => new Uint8Array());
  if (!bytes) return undefined;
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
}

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
      const body = await readSettingsJson(request);
      if (body === undefined) return NextResponse.json({ ok: false, message: "Request body too large" }, { status: 413 });
      const patch = normalizeOutreachSettingsPatch(body);
      return NextResponse.json({ ok: true, settings: await saveOutreachSettings(context.accountId, patch, context.userId) });
    } catch (error) {
      if (error instanceof OutreachSettingsError) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
      throw error;
    }
  });
}
