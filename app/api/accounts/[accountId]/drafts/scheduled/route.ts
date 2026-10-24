import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { DraftSendError } from "@/lib/drafts";
import { authorizeOutbound, OutboundAuthorizationError } from "@/lib/outboundAuthorization";
import { SenderIdentityError } from "@/lib/senderIdentities";
import { createRateLimiter } from "@/lib/rateLimit";
import { createScheduledSend, listScheduledSends, ScheduledSendBusyError } from "@/lib/db";
import { assertSchedulableDraft, presentScheduledSend, SCHEDULED_SEND_MIN_ROLE, validateScheduledSendAt } from "@/lib/scheduledSend";
import { getAccountIdFromParams, requireAccountContext, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { errorResponse, okResponse } from "@/app/api/_helpers/response";

const SCHEDULE_WINDOW_SECONDS = 60;
/** Per user: planning is cheap to repeat by hand, but each row becomes an SMTP send later. */
const scheduleAttempts = createRateLimiter({ windowMs: SCHEDULE_WINDOW_SECONDS * 1000, max: 30 });

/** GET /api/accounts/[accountId]/drafts/scheduled — open and failed schedules of the mailbox. */
export async function GET(request: Request, { params }: AccountRouteParams) {
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountId, { minRole: SCHEDULED_SEND_MIN_ROLE });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () =>
    okResponse({ scheduledSends: (await listScheduledSends(accountContext.accountId)).map(presentScheduledSend) }));
}

/**
 * POST /api/accounts/[accountId]/drafts/scheduled `{ draftId, sendAt }` — plan the send of a
 * saved draft (`sendAt`: UTC epoch ms, future, at most one year ahead). Same role, origin and
 * live sender-identity checks as POST …/drafts/[draftId]/send; replaces an open schedule.
 */
export async function POST(request: Request, { params }: AccountRouteParams) {
  const accountId = await getAccountIdFromParams(params);
  const accountContext = await requireAccountContext(request, accountId, { minRole: SCHEDULED_SEND_MIN_ROLE });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const originError = requireJsonSameOrigin(request);
    if (originError) return originError;
    if (scheduleAttempts.isLimited(accountContext.userId)) {
      const limited = errorResponse("Too many scheduled sends", 429);
      limited.headers.set("retry-after", String(SCHEDULE_WINDOW_SECONDS));
      return limited;
    }
    const body = (await request.json().catch(() => null)) as { draftId?: unknown; sendAt?: unknown } | null;
    const draftId = typeof body?.draftId === "string" ? body.draftId.trim() : "";
    if (!draftId || draftId.length > 256) return errorResponse("Missing draftId", 400);
    const sendAt = validateScheduledSendAt(body?.sendAt);
    if (!sendAt.ok) {
      return NextResponse.json({ ok: false, code: `send_at_${sendAt.reason}`, message: sendAt.reason === "past"
        ? "The send time must be in the future." : sendAt.reason === "too_far"
          ? "The send time must be within one year." : "Invalid send time." }, { status: 400 });
    }
    const resolvedAccountId = accountContext.accountId;
    try {
      const { identity } = await assertSchedulableDraft(resolvedAccountId, draftId);
      const actor = await authorizeOutbound({ request }, { accountId: resolvedAccountId, minRole: SCHEDULED_SEND_MIN_ROLE, identity });
      const row = await createScheduledSend({ accountId: resolvedAccountId, userId: accountContext.userId, draftId, sendAt: sendAt.sendAt,
        assertCurrent: actor.assertCurrent });
      console.info("[scheduled-send] scheduled", { scheduleId: row.id, accountId: resolvedAccountId, userId: row.userId, sendAt: row.sendAt });
      return NextResponse.json({ ok: true, scheduledSend: presentScheduledSend(row) }, { status: 201 });
    } catch (error) {
      if (error instanceof OutboundAuthorizationError) return error.response;
      if (error instanceof SenderIdentityError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
      if (error instanceof DraftSendError) return errorResponse(error.message, error.status);
      if (error instanceof ScheduledSendBusyError) return errorResponse("This draft is being sent by its schedule right now.", 409);
      throw error;
    }
  });
}
