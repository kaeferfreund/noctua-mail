import type { Options as RRuleOptions } from "rrule";
import type { CalendarEvent } from "@/lib/data";
import { buildCalendarRecurrenceOptions } from "./calendarRecurrence";

type FullCalendarRRuleInput = Partial<RRuleOptions>;

export type FullCalendarRecurringFields = {
  rrule: FullCalendarRRuleInput;
  duration?: { milliseconds: number };
  exdate?: Date[];
};

function normalizeRRule(rule: string) {
  const trimmed = rule.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase().startsWith("RRULE:") ? trimmed.slice(6).trim() : trimmed;
}

export function buildFullCalendarRecurringFields(
  event: Pick<CalendarEvent, "startAtMs" | "endAtMs" | "recurrenceRule" | "excludedDates" | "startTimezone">
): FullCalendarRecurringFields | null {
  const normalizedRule = event.recurrenceRule ? normalizeRRule(event.recurrenceRule) : null;
  if (!normalizedRule) return null;

  const { options, timeZone } = buildCalendarRecurrenceOptions(
    normalizedRule,
    event.startAtMs,
    event.startTimezone
  );
  const durationMs =
    typeof event.endAtMs === "number" && event.endAtMs > event.startAtMs
      ? event.endAtMs - event.startAtMs
      : undefined;
  const exdate =
    event.excludedDates?.length
      ? event.excludedDates.map((value) => new Date(value))
      : undefined;

  return {
    rrule: {
      ...options,
      // FullCalendar's rrule adapter applies TZID after the wall-clock
      // DTSTART/UNTIL comparison.
      tzid: timeZone
    },
    duration: durationMs ? { milliseconds: durationMs } : undefined,
    exdate
  };
}
