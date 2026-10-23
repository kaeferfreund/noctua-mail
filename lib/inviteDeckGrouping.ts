import type { InviteDeckEventTiming } from "./messageGrouping";
import { resolveCurrentOrNextOccurrence } from "./reminderRecurrence";

// Recurrence-backed invite-deck grouping, used server-side by the message
// query layer. It lives apart from `messageGrouping.ts` so the grouping
// constants/helpers the client imports on the main route do not drag
// `rrule` (via `reminderRecurrence`) into first load; `messageGrouping`
// re-exports this for its existing importers.
export function buildInviteDeckGroupKeyFromEvent(
  event: InviteDeckEventTiming,
  nowMs = Date.now()
) {
  return resolveCurrentOrNextOccurrence(event, nowMs) ? "UPCOMING" : "PAST";
}
