import { displayDayNumber } from "./i18n/format";
import type { Message } from "./data";

const DAY_MS = 24 * 60 * 60 * 1000;

export const INVITE_DECK_GROUP_BY = "invite-date";
export const EVENT_GROUP_BY = "event";

export const DATE_GROUP_ORDER = ["Today", "Yesterday", "This Week", "Older"] as const;
export const INVITE_DECK_GROUP_ORDER = ["UPCOMING", "PAST"] as const;

export type InviteDeckEventTiming = {
  eventStartAtMs: number;
  eventEndAtMs?: number;
  startTimezone?: string;
  recurrenceRule?: string;
  recurrenceDates?: number[];
  excludedDates?: number[];
};

export type InviteDeckEventBounds = {
  eventFirstStartAtMs?: number;
  eventLastEndAtMs?: number | null;
};

export function buildWeekGroupKey(timestampMs: number) {
  const dayNumber = displayDayNumber(timestampMs);
  const date = new Date(dayNumber * DAY_MS);
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = dayNumber - jan1.getTime() / DAY_MS;
  const jan1Weekday = jan1.getUTCDay();
  const firstMondayOffset = jan1Weekday === 1 ? 0 : (8 - jan1Weekday) % 7;
  const week =
    dayOfYear < firstMondayOffset
      ? 0
      : Math.floor((dayOfYear - firstMondayOffset) / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function buildTimeGroupKey(timestampMs: number, groupBy: string, nowMs = Date.now()) {
  const todayStart = displayDayNumber(nowMs);
  const targetDay = displayDayNumber(timestampMs);

  if (groupBy === INVITE_DECK_GROUP_BY) {
    return targetDay >= todayStart ? "UPCOMING" : "PAST";
  }

  if (groupBy === "date") {
    const yesterdayStart = todayStart - 1;
    const weekStart = todayStart - 7;
    if (targetDay >= todayStart) return "Today";
    if (targetDay >= yesterdayStart) return "Yesterday";
    if (targetDay >= weekStart) return "This Week";
    return "Older";
  }

  return "All";
}

export function buildMessageGroupKey(
  message: Pick<Message, "dateValue" | "from" | "folderId">,
  groupBy: string,
  dateValueOverride?: number
) {
  const effectiveDateValue =
    typeof dateValueOverride === "number" && Number.isFinite(dateValueOverride)
      ? dateValueOverride
      : message.dateValue;

  if (groupBy === "date" || groupBy === INVITE_DECK_GROUP_BY) {
    return buildTimeGroupKey(effectiveDateValue, groupBy);
  }
  if (groupBy === EVENT_GROUP_BY) {
    return "Other";
  }
  if (groupBy === "week") {
    return buildWeekGroupKey(effectiveDateValue);
  }
  if (groupBy === "year") {
    return String(new Date(displayDayNumber(effectiveDateValue) * DAY_MS).getUTCFullYear());
  }
  if (groupBy === "domain") {
    const emailMatch = message.from.match(/<([^>]+)>/);
    const email = emailMatch ? emailMatch[1] : message.from;
    const domain = email.split("@")[1];
    return domain ? domain.toLowerCase() : "Unknown";
  }
  if (groupBy === "sender") return message.from;
  if (groupBy === "folder") return message.folderId;
  return "All";
}

export function sortGroupsForGroupBy<T extends { key: string }>(groups: T[], groupBy: string): T[] {
  const order =
    groupBy === "date"
      ? DATE_GROUP_ORDER
      : groupBy === INVITE_DECK_GROUP_BY
        ? INVITE_DECK_GROUP_ORDER
        : null;

  if (!order) return groups;

  const orderIndex = new Map<string, number>();
  order.forEach((key, index) => orderIndex.set(key, index));

  return [...groups].sort((left, right) => {
    const leftOrder = orderIndex.get(left.key) ?? Number.POSITIVE_INFINITY;
    const rightOrder = orderIndex.get(right.key) ?? Number.POSITIVE_INFINITY;
    return leftOrder - rightOrder;
  });
}

// The recurrence-backed variant (`buildInviteDeckGroupKeyFromEvent`)
// lives in `inviteDeckGrouping.ts`: it needs `rrule` via
// `reminderRecurrence`, and even a re-export from here was enough for the
// bundler to keep that graph in the main route's first load (verified
// against production builds). Server-side callers import it from there
// directly; this module stays recurrence-free for its client importers.

export function buildInviteDeckGroupKeyFromBounds(
  event: InviteDeckEventBounds,
  nowMs = Date.now()
) {
  const eventFirstStartAtMs = Number(event.eventFirstStartAtMs);
  if (!Number.isFinite(eventFirstStartAtMs) || eventFirstStartAtMs <= 0) {
    return null;
  }
  if (event.eventLastEndAtMs === null || event.eventLastEndAtMs === undefined) {
    return "UPCOMING";
  }
  const eventLastEndAtMs = Number(event.eventLastEndAtMs);
  if (!Number.isFinite(eventLastEndAtMs) || eventLastEndAtMs <= 0) {
    return "UPCOMING";
  }
  return eventLastEndAtMs < nowMs ? "PAST" : "UPCOMING";
}
