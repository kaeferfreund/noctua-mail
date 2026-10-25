import { NextResponse } from "next/server";
import { ScheduledSendAlreadySentError, ScheduledSendBusyError } from "@/lib/db";

/** 409 for a manual change racing the draft's schedule; `code` lets compose explain it. */
export function scheduledSendConflictResponse(error: unknown) {
  if (error instanceof ScheduledSendBusyError) {
    return NextResponse.json({ ok: false, code: "scheduled_send_busy", message: "This draft is being sent by its schedule right now." }, { status: 409 });
  }
  if (error instanceof ScheduledSendAlreadySentError) {
    return NextResponse.json({ ok: false, code: "scheduled_send_sent", message: "This draft was already sent by its schedule." }, { status: 409 });
  }
  return null;
}
