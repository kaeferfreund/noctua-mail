import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../../../../_auth";
import { resolveSpamRescanAccount, spamRescanFailure, spamRescanRateLimited } from "../../../../_spamRescan";
import { withAuthResponse } from "@/lib/auth";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import type { AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { SpamRescanBusyError, SpamRescanInputError, startSpamRescanMove } from "@/lib/mail/spam/rescan";

/**
 * `{ jobId, ids }`: moves the reviewed selection of a finished scan to Junk in
 * the background (admin only), with the steps of „Als Spam“.
 */
export async function POST(request: Request, { params }: AccountRouteParams) {
  const origin = requireJsonSameOrigin(request); if (origin) return origin;
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const limited = spamRescanRateLimited(request, session.userId); if (limited) return limited;
    const accountId = await resolveSpamRescanAccount(params, session.userId);
    if (!accountId) return spamRescanFailure(404, "account_not_found");
    const body = await request.json().catch(() => null) as { jobId?: unknown; ids?: unknown } | null;
    if (typeof body?.jobId !== "string") return spamRescanFailure(400, "invalid_selection");
    try {
      const selected = await startSpamRescanMove({ accountId, jobId: body.jobId, ids: body.ids, userId: session.userId });
      if (selected === null) return spamRescanFailure(404, "rescan_not_found");
      return NextResponse.json({ ok: true, selected }, { status: 202, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof SpamRescanBusyError) return spamRescanFailure(409, "rescan_running");
      if (error instanceof SpamRescanInputError) return spamRescanFailure(error.code === "invalid_selection" ? 400 : 409, error.code);
      throw error;
    }
  });
}
