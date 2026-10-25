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

export function listScheduledDraftSends(apiFetch: ApiFetch, accountId: string) {
  return call(() => apiFetch(buildAccountScheduledSendsPath(accountId), { cache: "no-store" }),
    body => (Array.isArray(body.scheduledSends) ? body.scheduledSends : []) as ScheduledSendView[]);
}
