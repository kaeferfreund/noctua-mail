import type { InviteDeckEventTiming } from "./messageGrouping";
import { resolveCurrentOrNextOccurrence } from "./reminderRecurrence";

// Recurrence-backed invite-deck grouping, used server-side by the message
// query layer. It lives apart from `messageGrouping.ts` so the grouping
// constants/helpers the client imports on the main route do not drag
// `rrule` (via `reminderRecurrence`) into first load. Server-side
// importers reference this module directly (a re-export through
// `messageGrouping` still kept the rrule chunk in first load).
export function buildInviteDeckGroupKeyFromEvent(
  event: InviteDeckEventTiming,
  nowMs = Date.now()
) {
  return resolveCurrentOrNextOccurrence(event, nowMs) ? "UPCOMING" : "PAST";
}
