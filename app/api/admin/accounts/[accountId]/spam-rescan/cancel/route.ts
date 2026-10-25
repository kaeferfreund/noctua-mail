import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../../../../_auth";
import { resolveSpamRescanAccount, spamRescanFailure, spamRescanRateLimited } from "../../../../_spamRescan";
import { withAuthResponse } from "@/lib/auth";
import { requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";
import type { AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { cancelSpamRescan } from "@/lib/mail/spam/rescan";

/** Stops the mailbox's running scan or move after the current batch or message (admin only). */
export async function POST(request: Request, { params }: AccountRouteParams) {
  const origin = await requireBodylessSameOrigin(request); if (origin) return origin;
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const limited = spamRescanRateLimited(request, session.userId); if (limited) return limited;
    const accountId = await resolveSpamRescanAccount(params);
    if (!accountId) return spamRescanFailure(404, "account_not_found");
    if (!await cancelSpamRescan(accountId)) return spamRescanFailure(409, "rescan_not_running");
    return NextResponse.json({ ok: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
  });
}
