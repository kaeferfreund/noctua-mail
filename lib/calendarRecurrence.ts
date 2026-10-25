import { RRule } from "rrule";
import {
  fromCalendarTimeZoneWallDate,
  resolveCalendarTimeZoneId,
  toCalendarTimeZoneWallDate
} from "./calendarTimezones";

/** Build all rule dates in the same wall-clock space used by rrule's comparisons. */
export function buildCalendarRecurrenceOptions(
  recurrenceRule: string,
  startAtMs: number,
  startTimezone?: string
) {
  const normalizedRule = recurrenceRule.trim().replace(/^RRULE:\s*/i, "");
  const parsed = RRule.parseString(normalizedRule);
  const untilToken = normalizedRule.match(/(?:^|;)UNTIL=([^;\s]+)/i)?.[1];
  const dateUntil = Boolean(untilToken && /^\d{8}$/.test(untilToken));
  // DATE values are stored as UTC midnight date markers, including when an
  // importer retained a TZID. They must not shift to a different local date.
  const timeZone = dateUntil
    ? undefined
    : resolveCalendarTimeZoneId(startTimezone) ??
      resolveCalendarTimeZoneId(parsed.tzid ?? undefined);
  const toRuleDate = (value: number) => {
    const date = new Date(value);
    return timeZone ? toCalendarTimeZoneWallDate(date, timeZone) : date;
  };
  const fromRuleDate = (date: Date) =>
    timeZone ? fromCalendarTimeZoneWallDate(date, timeZone) : date;

  let until = parsed.until;
  if (until instanceof Date) {
    if (dateUntil) {
      until = new Date(until);
      until.setUTCHours(23, 59, 59, 999);
    } else if (untilToken?.endsWith("Z")) {
      // UNTIL is inclusive. Convert its instant using the offset at UNTIL,
      // not DTSTART's offset (which may be on the other side of DST).
      until = toRuleDate(until.getTime());
    }
  }

  return {
    options: { ...parsed, dtstart: toRuleDate(startAtMs), until, tzid: undefined },
    timeZone,
    toRuleDate,
    fromRuleDate
  };
}
