import { NextResponse } from "next/server";
import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { listAccessibleAccountsForUser } from "@/lib/accountAccess";
import { outreachAddonEnabled, outreachPublicOrigin } from "@/lib/addons/outreach/config";
import { listOutreachSettings } from "@/lib/addons/outreach/settings";
import { isSesConfigured } from "@/lib/addons/outreach/sending";
import type { OutreachStatusResponse } from "@/lib/addons/outreach/types";

export const dynamic = "force-dynamic";

/** The client asks once whether the addon exists; with the flag off it never opens the addon database. */
export async function GET(request: Request) {
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    if (!outreachAddonEnabled()) {
      return NextResponse.json({ ok: true, available: false, accounts: [], sesConfigured: false, trackingConfigured: false } satisfies OutreachStatusResponse);
    }
    const accountIds = (await listAccessibleAccountsForUser(session.userId)).map(entry => entry.account.id);
    const accounts = (await listOutreachSettings(accountIds)).map(({ accountId, enabled, trackMailDefault }) => ({ accountId, enabled, trackMailDefault }));
    return NextResponse.json({ ok: true, available: true, accounts, sesConfigured: isSesConfigured(), trackingConfigured: outreachPublicOrigin() !== null } satisfies OutreachStatusResponse);
  });
}
