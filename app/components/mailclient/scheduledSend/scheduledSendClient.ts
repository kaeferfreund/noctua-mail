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

/** Cancels only the requested id: an old undo toast must never cancel a replacement schedule. */
export async function cancelDraftSchedule(apiFetch: ApiFetch, accountId: string, schedule: Pick<ScheduledSendView, "id" | "draftId">): Promise<ScheduleReleaseResult> {
  const result = await cancelScheduledDraftSend(apiFetch, accountId, schedule.id);
  if (result.ok || result.status === 404) return { ok: true };
  return { ok: false, reason: result.status === 409 ? "busy" : "failed" };
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

const refusalKeys = {
  scheduled_send_invite: "inviteUnsupported",
  scheduled_send_draft_deleted: "notInDrafts",
  scheduled_send_draft_missing: "draftMissing",
  scheduled_send_draft_invalid: "draftInvalid",
  scheduled_send_busy: "busy",
  send_at_past: "errors.past",
  send_at_too_soon: "errors.tooSoon",
  send_at_too_far: "tooFar",
  send_at_invalid: "errors.invalid",
  identity_unavailable: "identityUnavailable",
  identity_not_found: "identityUnavailable",
  draft_identity_changed: "identityUnavailable"
} as const;

/** Catalogue key only: scheduling never surfaces raw (English or upstream) server text. */
export async function readScheduledSendRefusal(response: Response) {
  const body = (await response.clone().json().catch(() => null)) as { code?: unknown } | null;
  const key = typeof body?.code === "string" ? refusalKeys[body.code as keyof typeof refusalKeys] : undefined;
  if (key) return key;
  if (response.status === 404) return "draftMissing";
  if (response.status === 403 || response.status === 401) return "permissionDenied";
  if (response.status === 429) return "rateLimited";
  return "failed";
}

/** The `code` of a 409 from a send route racing the draft's schedule, or null. */
export async function readScheduledSendConflict(response: Response) {
  const body = (await response.clone().json().catch(() => null)) as { code?: unknown } | null;
  return body?.code === "scheduled_send_busy" || body?.code === "scheduled_send_sent" ? body.code : null;
}
