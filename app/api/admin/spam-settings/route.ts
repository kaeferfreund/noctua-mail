import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../_auth";
import { withAuthResponse } from "@/lib/auth";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { SpamSettingsError } from "@/lib/mail/spam/config";
import { describeSpamConfig, loadSpamAdminSettings, loadSpamConfig, loadSpamTrustCounters, saveSpamAdminSettings } from "@/lib/mail/spam/settings";
import { listSpamRescanMailboxes } from "@/lib/mail/spam/rescan";

/** `rescanMailboxes`: only the admin's own mailboxes offer „Posteingang jetzt prüfen“. */
async function body(userId: string) {
  return NextResponse.json({ ok: true, settings: await loadSpamAdminSettings(), effective: describeSpamConfig(await loadSpamConfig()),
    trust: await loadSpamTrustCounters(), rescanMailboxes: await listSpamRescanMailboxes(userId) });
}

export async function GET(request: Request) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, () => body(session.userId));
}

export async function PUT(request: Request) {
  const origin = requireJsonSameOrigin(request); if (origin) return origin;
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    try {
      await saveSpamAdminSettings(await request.json().catch(() => null), session.userId);
    } catch (error) {
      if (error instanceof SpamSettingsError) return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
      throw error;
    }
    return body(session.userId);
  });
}
