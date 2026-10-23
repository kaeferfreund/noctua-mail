import { RRule } from "rrule";
import {
  parseCalendarDate,
  type CalendarEventPreview
} from "./calendar";
import {
  isValidCalendarTimeZone,
  resolveCalendarTimeZoneId,
  toCalendarTimeZoneWallDate
} from "./calendarTimezones";
import type { AccountDateFormat } from "./data";
import { formatAccountIntl } from "./dateFormatting";

// Human-readable recurrence summary for a calendar event. This is the only
// part of the calendar formatting surface that needs `rrule` (for
// `toText()` / parsed options), so it lives apart from `lib/calendar.ts`:
// client call sites load it with a dynamic import when an event actually
// repeats, keeping `rrule` out of the main route's first load.

function parseRRuleFields(rule: string) {
  const out: Record<string, string> = {};
  rule
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .forEach((segment) => {
      const eq = segment.indexOf("=");
      if (eq < 0) return;
      const key = segment.slice(0, eq).trim().toUpperCase();
      const value = segment.slice(eq + 1).trim();
      if (!key || !value) return;
      out[key] = value;
    });
  return out;
}

function formatRecurrenceBoundaryDate(
  event: CalendarEventPreview,
  value: Date,
  dateFormat?: AccountDateFormat
) {
  return formatAccountIntl(value, dateFormat, {
    dateStyle: "medium",
    ...(event.allDay
      ? { timeZone: "UTC" }
      : (() => {
          const resolved = resolveCalendarTimeZoneId(event.startTimezone);
          return resolved ? { timeZone: resolved } : {};
        })())
  });
}

function formatTimeZoneLabel(timeZone: string, referenceDate: Date) {
  const resolved = resolveCalendarTimeZoneId(timeZone) ?? timeZone;
  const city = resolved.includes("/") ? resolved.split("/").pop()?.replace(/_/g, " ") ?? resolved : resolved;
  if (!isValidCalendarTimeZone(resolved)) return city;
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: resolved,
      timeZoneName: "short"
    }).formatToParts(referenceDate);
    const zoneName = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    if (!zoneName) return city;
    if (zoneName.startsWith("GMT") || zoneName.startsWith("UTC")) {
      return city ? `${zoneName} - ${city}` : zoneName;
    }
    return zoneName;
  } catch {
    return city;
  }
}

function capitalizeFirstLetter(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseRecurrenceRule(event: CalendarEventPreview): RRule | null {
  const recurrenceRule = event.recurrenceRule?.trim();
  if (!recurrenceRule) return null;
  try {
    const normalizedRule = recurrenceRule.toUpperCase().startsWith("RRULE:")
      ? recurrenceRule.slice(6).trim()
      : recurrenceRule;
    const parsed = RRule.fromString(normalizedRule);
    if (!event.start) return parsed;
    const parsedTzid =
      typeof parsed.origOptions.tzid === "string" ? parsed.origOptions.tzid : undefined;
    const ruleTimeZone =
      resolveCalendarTimeZoneId(event.startTimezone) ?? resolveCalendarTimeZoneId(parsedTzid);
    return new RRule({
      ...parsed.origOptions,
      dtstart: ruleTimeZone ? toCalendarTimeZoneWallDate(event.start, ruleTimeZone) : event.start,
      tzid: ruleTimeZone ?? parsed.origOptions.tzid
    });
  } catch {
    return null;
  }
}

function buildRecurrenceFallbackLabel(recurrenceRule: string) {
  const fields = parseRRuleFields(recurrenceRule);
  const freq = (fields.FREQ ?? "").toUpperCase();
  const interval = Math.max(1, Number(fields.INTERVAL ?? 1) || 1);
  if (freq === "DAILY") return interval === 1 ? "Daily" : `Every ${interval} days`;
  if (freq === "WEEKLY") return interval === 1 ? "Weekly" : `Every ${interval} weeks`;
  if (freq === "MONTHLY") return interval === 1 ? "Monthly" : `Every ${interval} months`;
  if (freq === "YEARLY") return interval === 1 ? "Yearly" : `Every ${interval} years`;
  return "Repeats";
}

export function buildCalendarRecurrenceSummary(
  event: CalendarEventPreview,
  dateFormat?: AccountDateFormat
): string | null {
  const recurrenceRule = event.recurrenceRule?.trim();
  if (!recurrenceRule) return null;
  const parsedRule = parseRecurrenceRule(event);
  const fallbackFields = parseRRuleFields(recurrenceRule);
  const rawBase = (() => {
    if (!parsedRule) return buildRecurrenceFallbackLabel(recurrenceRule);
    const asText = parsedRule.toText().trim();
    return asText ? capitalizeFirstLetter(asText) : buildRecurrenceFallbackLabel(recurrenceRule);
  })();
  // rrule.js's toText() always emits dates in English (e.g. "until May 6,
  // 2026"). Strip that segment out of the base text and re-emit it from our
  // account-format-aware formatter so locale settings apply.
  const untilTextMatch = rawBase.match(/^(.*?)(?:,\s*)?\s+until\s+.+$/i);
  const base = untilTextMatch?.[1]?.trim().replace(/[,\s]+$/g, "") || rawBase;

  const details: string[] = [];
  if (event.start) {
    details.push(`starting ${formatRecurrenceBoundaryDate(event, event.start, dateFormat)}`);
  }

  const untilDate = parsedRule?.options.until;
  if (untilDate instanceof Date) {
    details.push(`until ${formatRecurrenceBoundaryDate(event, untilDate, dateFormat)}`);
  } else {
    const untilRaw = (fallbackFields.UNTIL ?? "").trim();
    if (untilRaw) {
      const fallbackUntilDate = parseCalendarDate(untilRaw, event.startTimezone).date;
      if (fallbackUntilDate) {
        details.push(`until ${formatRecurrenceBoundaryDate(event, fallbackUntilDate, dateFormat)}`);
      }
    }
  }

  const count =
    typeof parsedRule?.options.count === "number" && parsedRule.options.count > 0
      ? parsedRule.options.count
      : Number(fallbackFields.COUNT ?? 0);
  if (Number.isFinite(count) && count > 0 && !(untilDate instanceof Date)) {
    details.push(`for ${count} ${count === 1 ? "occurrence" : "occurrences"}`);
  }

  if ((event.recurrenceDates?.length ?? 0) > 0) {
    details.push(
      `including ${event.recurrenceDates!.length} extra date${event.recurrenceDates!.length === 1 ? "" : "s"}`
    );
  }
  if ((event.excludedDates?.length ?? 0) > 0) {
    details.push(
      `excluding ${event.excludedDates!.length} date${event.excludedDates!.length === 1 ? "" : "s"}`
    );
  }

  const timeZoneSuffix =
    !event.allDay && event.startTimezone && event.start
      ? ` (${formatTimeZoneLabel(event.startTimezone, event.start)})`
      : "";

  if (details.length === 0) {
    return `${base}${timeZoneSuffix}`;
  }
  const detailsText = details.join(", ");
  if (base.toLowerCase().endsWith(detailsText.toLowerCase())) {
    return `${base}${timeZoneSuffix}`;
  }
  return `${base}, ${detailsText}${timeZoneSuffix}`;
}
