import { NextResponse } from "next/server";
import { adminAccountNotFound, requireAdminSessionOr403, resolveAdminMemberAccount } from "../../../_auth";
import { withAuthResponse } from "@/lib/auth";
import type { AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { SpamSettingsError } from "@/lib/mail/spam/config";
import { loadMailboxSpamSettings, loadSpamConfig, saveMailboxSpamSettings } from "@/lib/mail/spam/settings";

/** Per-mailbox spam settings (on/off, auto-move to Junk, threshold override). Admin only, own mailboxes only. */

async function body(accountId: string) {
  const config = await loadSpamConfig();
  return NextResponse.json({ ok: true, settings: await loadMailboxSpamSettings(accountId), globalThreshold: config.threshold, enabled: config.enabled });
}

export async function GET(request: Request, { params }: AccountRouteParams) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accountId = await resolveAdminMemberAccount(params, session.userId);
    if (!accountId) return adminAccountNotFound();
    return body(accountId);
  });
}

export async function PUT(request: Request, { params }: AccountRouteParams) {
  const origin = requireJsonSameOrigin(request); if (origin) return origin;
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accountId = await resolveAdminMemberAccount(params, session.userId);
    if (!accountId) return adminAccountNotFound();
    try {
      await saveMailboxSpamSettings(accountId, await request.json().catch(() => null), session.userId);
    } catch (error) {
      if (error instanceof SpamSettingsError) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
      throw error;
    }
    return body(accountId);
  });
}
