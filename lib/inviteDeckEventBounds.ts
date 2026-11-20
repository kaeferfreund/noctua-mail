import { RRule, RRuleSet } from "rrule";
import type { CalendarInviteMutationGroup } from "./calendarInviteProcessing";
import { buildCalendarRecurrenceOptions, createBoundedRecurrenceQuery } from "./calendarRecurrence";

export type InviteDeckEventBounds = {
  eventFirstStartAtMs?: number;
  eventLastEndAtMs?: number | null;
};

type RecurrenceTimeline = {
  firstOnOrAfter: (timestampMs: number) => Date | null;
  lastOnOrBefore: (timestampMs: number) => Date | null;
  lastBoundedOccurrence: () => Date | null;
  isBounded: boolean;
};

function asTimestampMs(value?: Date) {
  if (!value) return Number.NaN;
  const timestamp = value.getTime();
  return Number.isFinite(timestamp) && timestamp > 0 ? Math.round(timestamp) : Number.NaN;
}

function normalizeDateList(values?: number[]) {
  if (!Array.isArray(values) || values.length === 0) return [];
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.round(value))
    )
  ).sort((a, b) => a - b);
}

function normalizeRecurrenceRule(rule?: string) {
  const value = rule?.trim();
  if (!value) return null;
  if (value.toUpperCase().startsWith("RRULE:")) {
    const trimmed = value.slice(6).trim();
    return trimmed || null;
  }
  return value;
}

function buildRecurrenceTimeline(params: {
  eventStartAtMs: number;
  recurrenceRule?: string;
  recurrenceDates?: number[];
  excludedDates?: number[];
  startTimezone?: string;
}): RecurrenceTimeline | null {
  const normalizedRule = normalizeRecurrenceRule(params.recurrenceRule);
  if (!normalizedRule) return null;
  const eventStartAtMs = Number(params.eventStartAtMs);
  if (!Number.isFinite(eventStartAtMs) || eventStartAtMs <= 0) return null;

  try {
    const { options, ruleUntil, windowed, toRuleDate, fromRuleDate } = buildCalendarRecurrenceOptions(
      normalizedRule,
      eventStartAtMs,
      params.startTimezone
    );
    const rule = new RRule(options);
    const recurrenceDates = normalizeDateList(params.recurrenceDates);
    const excludedDates = normalizeDateList(params.excludedDates);
    const recurrenceSource = createBoundedRecurrenceQuery(
      recurrenceDates.length === 0 && excludedDates.length === 0
        ? rule
        : (() => {
            const ruleSet = new RRuleSet();
            ruleSet.rrule(rule);
            recurrenceDates.forEach((value) => {
              ruleSet.rdate(toRuleDate(value));
            });
            excludedDates.forEach((value) => {
              ruleSet.exdate(toRuleDate(value));
            });
            return ruleSet;
          })()
    );
    const count = typeof options.count === "number" && options.count > 0 ? options.count : null;
    // Bounded by the rule itself, not by the work window.
    const isBounded = count !== null || ruleUntil instanceof Date;

    return {
      firstOnOrAfter(timestampMs: number) {
        const next = recurrenceSource.after(toRuleDate(timestampMs), true);
        return next ? fromRuleDate(next) : null;
      },
      lastOnOrBefore(timestampMs: number) {
        const previous = recurrenceSource.before(toRuleDate(timestampMs), true);
        return previous ? fromRuleDate(previous) : null;
      },
      lastBoundedOccurrence() {
        if (!isBounded) return null;
        if (windowed) {
          // The work window ends before the rule's UNTIL, or possibly before
          // its COUNT is used up: the series end is only known when the
          // window still held every counted occurrence.
          if (count === null) return null;
          const emitted = createBoundedRecurrenceQuery(rule).count();
          if (emitted === null || emitted < count) return null;
        }
        if (options.until instanceof Date) {
          const previous = recurrenceSource.before(options.until, true);
          return previous ? fromRuleDate(previous) : null;
        }
        const last = recurrenceSource.last();
        return last ? fromRuleDate(last) : null;
      },
      isBounded
    };
  } catch {
    return null;
  }
}

export function deriveInviteDeckEventBounds(
  group: CalendarInviteMutationGroup
): InviteDeckEventBounds {
  const baseStartAtMs = asTimestampMs(group.baseEvent?.start);
  const baseEndAtMs = asTimestampMs(group.baseEvent?.end);
  const baseDurationMs =
    Number.isFinite(baseStartAtMs) &&
    Number.isFinite(baseEndAtMs) &&
    baseEndAtMs > baseStartAtMs
      ? baseEndAtMs - baseStartAtMs
      : 0;
  const instanceOccurrences = Array.from(
    new Map(
      group.instanceOccurrences
        .filter((occurrence) => Number.isFinite(occurrence.startAtMs) && occurrence.startAtMs > 0)
        .map((occurrence) => [
          occurrence.startAtMs,
          Number.isFinite(occurrence.endAtMs) && (occurrence.endAtMs ?? 0) > occurrence.startAtMs
            ? occurrence.endAtMs
            : undefined
        ])
    ).entries()
  ).map(([startAtMs, endAtMs]) => ({ startAtMs, endAtMs }));

  if (!Number.isFinite(baseStartAtMs)) {
    if (instanceOccurrences.length === 0) {
      return {};
    }
    const starts = instanceOccurrences.map((occurrence) => occurrence.startAtMs);
    const ends = instanceOccurrences.map((occurrence) =>
      occurrence.endAtMs && occurrence.endAtMs > occurrence.startAtMs
        ? occurrence.endAtMs
        : occurrence.startAtMs
    );
    return {
      eventFirstStartAtMs: Math.min(...starts),
      eventLastEndAtMs: Math.max(...ends)
    };
  }

  const recurrenceDates = normalizeDateList([
    ...(group.baseEvent?.recurrenceDates?.map((value) => value.getTime()) ?? []),
    ...group.addedRecurrenceDates
  ]);
  const excludedDates = normalizeDateList([
    ...(group.baseEvent?.excludedDates?.map((value) => value.getTime()) ?? []),
    ...group.addedExcludedDates
  ]);
  const recurrenceRule = group.baseEvent?.recurrenceRule?.trim() || undefined;
  const explicitEndByStart = new Map<number, number>();
  instanceOccurrences.forEach((occurrence) => {
    if (
      Number.isFinite(occurrence.endAtMs) &&
      (occurrence.endAtMs ?? 0) > occurrence.startAtMs
    ) {
      explicitEndByStart.set(occurrence.startAtMs, occurrence.endAtMs!);
    }
  });
  const resolveOccurrenceEndAtMs = (startAtMs: number) =>
    explicitEndByStart.get(startAtMs) ??
    (baseDurationMs > 0 ? startAtMs + baseDurationMs : startAtMs);

  const timeline = buildRecurrenceTimeline({
    eventStartAtMs: baseStartAtMs,
    recurrenceRule,
    recurrenceDates,
    excludedDates,
    startTimezone: group.baseEvent?.startTimezone
  });

  if (timeline?.isBounded) {
    const firstOccurrence = timeline.firstOnOrAfter(baseStartAtMs - 1);
    if (!firstOccurrence) {
      return {};
    }
    const lastOccurrence = timeline.lastBoundedOccurrence();
    if (!lastOccurrence) {
      return {};
    }
    return {
      eventFirstStartAtMs: firstOccurrence.getTime(),
      eventLastEndAtMs: resolveOccurrenceEndAtMs(lastOccurrence.getTime())
    };
  }

  if (timeline) {
    const firstOccurrence = timeline.firstOnOrAfter(baseStartAtMs - 1);
    if (!firstOccurrence) {
      return {};
    }
    return {
      eventFirstStartAtMs: firstOccurrence.getTime(),
      eventLastEndAtMs: null
    };
  }

  const starts = normalizeDateList([baseStartAtMs, ...recurrenceDates]).filter(
    (value) => !excludedDates.includes(value)
  );
  if (starts.length === 0) {
    return {};
  }
  return {
    eventFirstStartAtMs: starts[0],
    eventLastEndAtMs: resolveOccurrenceEndAtMs(starts[starts.length - 1])
  };
}
