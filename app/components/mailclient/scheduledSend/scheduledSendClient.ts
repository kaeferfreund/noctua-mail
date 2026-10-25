import { buildAccountScheduledSendCancelPath, buildAccountScheduledSendsPath } from "@/lib/accountApiPaths";
import type { ScheduledSendView } from "@/lib/scheduledSendView";

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type ScheduledSendResult<T> = { ok: true; value: T } | { ok: false; status: number; response: Response | null };

async function call<T>(request: () => Promise<Response>, read: (body: any) => T): Promise<ScheduledSendResult<T>> {
  let response: Response;
  try { response = await request(); }
  catch { return { ok: false, status: 0, response: null }; }
  if (!response.ok) return { ok: false, status: response.status, response };
  return { ok: true, value: read(await response.json().catch(() => ({}))) };
}

/** POST …/drafts/scheduled — plan the send of a saved draft at a UTC instant. */
export function scheduleDraftSend(apiFetch: ApiFetch, accountId: string, draftId: string, sendAt: number) {
  return call(() => apiFetch(buildAccountScheduledSendsPath(accountId), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId, sendAt })
  }), body => body.scheduledSend as ScheduledSendView);
}

/** POST …/drafts/scheduled/[id]/cancel — 409 while the schedule is sending. */
export function cancelScheduledDraftSend(apiFetch: ApiFetch, accountId: string, scheduleId: string) {
  return call(() => apiFetch(buildAccountScheduledSendCancelPath(accountId, scheduleId), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
  }), body => String(body.draftId ?? ""));
}

/** Open, sending and failed schedules of the mailbox, or fresh from the server for one draft. */
export function listScheduledDraftSends(apiFetch: ApiFetch, accountId: string, draftId?: string) {
  return call(() => apiFetch(buildAccountScheduledSendsPath(accountId, draftId), { cache: "no-store" }),
    body => (Array.isArray(body.scheduledSends) ? body.scheduledSends : []) as ScheduledSendView[]);
}

export type ScheduleReleaseResult = { ok: true } | { ok: false; reason: "busy" | "failed" };

/**
 * Cancels the draft's schedule. A 404 counts as „already gone“ only when a fresh read of the
 * draft's schedules agrees; a newer schedule of the same draft (another tab or member) is
 * cancelled instead.
 */
export async function cancelDraftSchedule(apiFetch: ApiFetch, accountId: string, schedule: Pick<ScheduledSendView, "id" | "draftId">): Promise<ScheduleReleaseResult> {
  let target = schedule.id;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await cancelScheduledDraftSend(apiFetch, accountId, target);
    if (result.ok) return { ok: true };
    if (result.status === 409) return { ok: false, reason: "busy" };
    if (result.status !== 404) return { ok: false, reason: "failed" };
    const fresh = await listScheduledDraftSends(apiFetch, accountId, schedule.draftId);
    if (!fresh.ok) return { ok: false, reason: "failed" };
    const open = fresh.value.find(row => row.id !== target);
    if (!open) return { ok: true };
    if (open.status === "sending") return { ok: false, reason: "busy" };
    target = open.id;
  }
  return { ok: false, reason: "failed" };
}

/**
 * „Bearbeiten hebt die Planung auf“: reads the draft's schedule from the server (not from a
 * cached list, which misses other tabs and members) and cancels it before compose opens.
 * A failed read lets the draft open: saving and sending still settle the schedule server-side.
 */
export async function releaseDraftScheduleForEdit(apiFetch: ApiFetch, accountId: string, draftId: string): Promise<ScheduleReleaseResult> {
  const fresh = await listScheduledDraftSends(apiFetch, accountId, draftId);
  if (!fresh.ok) return { ok: true };
  const schedule = fresh.value.find(row => row.draftId === draftId);
  if (!schedule) return { ok: true };
  if (schedule.status === "sending") return { ok: false, reason: "busy" };
  return cancelDraftSchedule(apiFetch, accountId, schedule);
}

/** The `code` of a 409 from a send route racing the draft's schedule, or null. */
export async function readScheduledSendConflict(response: Response) {
  const body = (await response.clone().json().catch(() => null)) as { code?: unknown } | null;
  return body?.code === "scheduled_send_busy" || body?.code === "scheduled_send_sent" ? body.code : null;
}
