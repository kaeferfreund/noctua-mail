import { NextResponse } from "next/server";
import { requireAdminSessionOr403, resolveAdminMemberAccount } from "../../../_auth";
import { spamRescanFailure, spamRescanRateLimited } from "../../../_spamRescan";
import { withAuthResponse } from "@/lib/auth";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import type { AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { loadSpamRescanState, previewSpamRescan, SpamRescanBusyError, SpamRescanInputError, startSpamRescan } from "@/lib/mail/spam/rescan";
import { isSpamRescanPeriod } from "@/lib/mail/spam/rescanTypes";

/**
 * „Posteingang jetzt prüfen“ for one mailbox, admins who are members of it only (else 404). GET `?period=30d|12m|all`:
 * the counts before a start plus the latest job and its preview list. POST
 * `{ period, withModel, modelLimit }` starts a scan; it never moves mail.
 */
export async function GET(request: Request, { params }: AccountRouteParams) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const accountId = await resolveAdminMemberAccount(params, session.userId);
    if (!accountId) return spamRescanFailure(404, "account_not_found");
    const period = new URL(request.url).searchParams.get("period") ?? "30d";
    if (!isSpamRescanPeriod(period)) return spamRescanFailure(400, "invalid_period");
    return NextResponse.json({ ok: true, preview: await previewSpamRescan(accountId, period), ...await loadSpamRescanState(accountId) },
      { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(request: Request, { params }: AccountRouteParams) {
  const origin = requireJsonSameOrigin(request); if (origin) return origin;
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const limited = spamRescanRateLimited(request, session.userId); if (limited) return limited;
    const accountId = await resolveAdminMemberAccount(params, session.userId);
    if (!accountId) return spamRescanFailure(404, "account_not_found");
    const body = await request.json().catch(() => null) as { period?: unknown; withModel?: unknown; modelLimit?: unknown } | null;
    if (!isSpamRescanPeriod(body?.period)) return spamRescanFailure(400, "invalid_period");
    if (typeof body.withModel !== "boolean" || (body.withModel && typeof body.modelLimit !== "number")) return spamRescanFailure(400, "invalid_model_limit");
    try {
      const job = await startSpamRescan({ accountId, period: body.period, withModel: body.withModel,
        modelLimit: body.withModel ? body.modelLimit as number : 0, userId: session.userId });
      return NextResponse.json({ ok: true, job }, { status: 202, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof SpamRescanBusyError) return spamRescanFailure(409, "rescan_running");
      if (error instanceof SpamRescanInputError) return spamRescanFailure(error.code === "invalid_model_limit" ? 400 : 409, error.code);
      throw error;
    }
  });
}
