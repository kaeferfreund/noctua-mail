import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../../../_auth";
import { withAuthResponse } from "@/lib/auth";
import { getAccountById } from "@/lib/serverDb";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { SpamSettingsError } from "@/lib/mail/spam/config";
import { loadMailboxSpamSettings, loadSpamConfig, saveMailboxSpamSettings } from "@/lib/mail/spam/settings";

/** Per-mailbox spam settings (auto-move to Junk, threshold override). Admin only. */
async function resolveAccount(params: AccountRouteParams["params"]) {
  const accountId = await getAccountIdFromParams(params);
  return accountId && await getAccountById(accountId) ? accountId : null;
}

async function body(accountId: string) {
  const config = await loadSpamConfig();
  return NextResponse.json({ ok: true, settings: await loadMailboxSpamSettings(accountId), globalThreshold: config.threshold, enabled: config.enabled });
}

export async function GET(request: Request, { params }: AccountRouteParams) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accountId = await resolveAccount(params);
    if (!accountId) return NextResponse.json({ ok: false, message: "Account not found" }, { status: 404 });
    return body(accountId);
  });
}

export async function PUT(request: Request, { params }: AccountRouteParams) {
  const origin = requireJsonSameOrigin(request); if (origin) return origin;
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accountId = await resolveAccount(params);
    if (!accountId) return NextResponse.json({ ok: false, message: "Account not found" }, { status: 404 });
    try {
      await saveMailboxSpamSettings(accountId, await request.json().catch(() => null), session.userId);
    } catch (error) {
      if (error instanceof SpamSettingsError) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
      throw error;
    }
    return body(accountId);
  });
}
