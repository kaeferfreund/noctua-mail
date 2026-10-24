import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { cancelScheduledSend, ScheduledSendBusyError } from "@/lib/db";
import { SCHEDULED_SEND_MIN_ROLE } from "@/lib/scheduledSend";
import { getAccountIdFromParams, requireAccountContext, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireMutationSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { errorResponse, okResponse } from "@/app/api/_helpers/response";

type Params = AccountRouteParams & { params: Promise<{ accountId?: string; scheduleId?: string }> };

/** POST /api/accounts/[accountId]/drafts/scheduled/[scheduleId]/cancel — the draft stays a normal draft. */
export async function POST(request: Request, { params }: Params) {
  const accountId = await getAccountIdFromParams(params);
  const { scheduleId: rawScheduleId } = await params;
  const scheduleId = typeof rawScheduleId === "string" ? rawScheduleId.trim() : "";
  if (!accountId || !scheduleId) return errorResponse("Missing accountId or scheduleId", 400);
  const accountContext = await requireAccountContext(request, accountId, { minRole: SCHEDULED_SEND_MIN_ROLE });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const originError = await requireMutationSameOrigin(request);
    if (originError) return originError;
    try {
      const row = await cancelScheduledSend(accountContext.accountId, scheduleId);
      if (!row) return errorResponse("Scheduled send not found", 404);
      console.info("[scheduled-send] cancelled", { scheduleId, accountId: row.accountId, userId: accountContext.userId });
      return okResponse({ draftId: row.draftId });
    } catch (error) {
      if (error instanceof ScheduledSendBusyError) return errorResponse("This draft is being sent by its schedule right now.", 409);
      throw error;
    }
  });
}
