import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";
import { deleteCalendarReminderById } from "@/lib/db";
import { deleteCalendarEventAndRelatedData } from "@/lib/calendarEventDeletion";
import { readJsonBody } from "@/app/api/_helpers/readJsonBody";

type DeleteLinkedCalendarPayload = {
  accountId?: string;
  reminderIds?: string[];
  eventIds?: string[];
};

function normalizeStringArray(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value): value is string => Boolean(value))
    )
  );
}

export async function POST(request: Request, { params }: AccountRouteParams) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  if (!accountId) {
    return NextResponse.json({ ok: false, message: "Missing accountId" }, { status: 400 });
  }
  const accountContext = await requireAccountContext(request, accountId, {
    minRole: "editor",
    missingAccountMessage: "Missing accountId"
  });
  if (accountContext instanceof NextResponse) return accountContext;
  const body = await readJsonBody<DeleteLinkedCalendarPayload>(request);
  if (!body.ok) return body.response;
  const payload = body.value;
  return withAuthResponse(accountContext, async () => {

    const reminderIds = normalizeStringArray(payload?.reminderIds);
    const eventIds = normalizeStringArray(payload?.eventIds);

    try {
      const reminderResults = await Promise.all(
        reminderIds.map(async (reminderId) => {
          const deleted = await deleteCalendarReminderById(
            accountContext.accountId,
            accountContext.session.userId,
            reminderId
          );
          return deleted ? 1 : 0;
        })
      );
      await Promise.all(
        eventIds.map((eventId) =>
          deleteCalendarEventAndRelatedData({ accountId: accountContext.accountId, eventId })
        )
      );
      return NextResponse.json({
        ok: true,
        deletedReminders: reminderResults.reduce<number>((sum, value) => sum + value, 0),
        deletedEvents: eventIds.length
      });
    } catch (error) {
      console.error("[message/delete/linked-calendar] POST error:", error);
      return NextResponse.json(
        { ok: false, message: "Failed to delete linked calendar items" },
        { status: 500 }
      );
    }
  });
}
