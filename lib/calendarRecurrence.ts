import { Frequency, RRule, type RRuleSet } from "rrule";
import {
  fromCalendarTimeZoneWallDate,
  resolveCalendarTimeZoneId,
  toCalendarTimeZoneWallDate
} from "./calendarTimezones";

/**
 * Work limits for recurrence expansion. rrule always iterates from DTSTART,
 * so the cost of one query grows with the number of periods between DTSTART
 * and the queried date. Rules arrive from untrusted mail, so every expansion
 * is bounded three ways:
 * - the rule window covers at most MAX_RECURRENCE_PERIODS periods after
 *   DTSTART (DAILY: about 27 years, WEEKLY: about 190 years);
 * - a query visits at most MAX_RECURRENCE_OCCURRENCES occurrences;
 * - a query stops after MAX_RECURRENCE_EXPANSION_MS.
 * A query that hits a limit answers "unknown" (null) instead of a wrong date.
 * Sub-hourly frequencies and rules that expand to more than
 * MAX_RECURRENCE_OCCURRENCES_PER_DAY times of day are not expanded at all.
 */
export const MAX_RECURRENCE_PERIODS = 10_000;
export const MAX_RECURRENCE_OCCURRENCES = 10_000;
export const MAX_RECURRENCE_EXPANSION_MS = 250;
export const MAX_RECURRENCE_OCCURRENCES_PER_DAY = 24;

const DAY_MS = 24 * 60 * 60 * 1000;
// rrule stops at year 9999 on its own.
const MAX_RULE_DATE_MS = Date.UTC(9999, 11, 31, 23, 59, 59);
const RECURRENCE_PERIOD_MS: Partial<Record<Frequency, number>> = {
  [Frequency.YEARLY]: 366 * DAY_MS,
  [Frequency.MONTHLY]: 31 * DAY_MS,
  [Frequency.WEEKLY]: 7 * DAY_MS,
  [Frequency.DAILY]: DAY_MS,
  [Frequency.HOURLY]: 60 * 60 * 1000
};

export class UnsupportedRecurrenceRuleError extends Error {
  constructor(reason: string) {
    super(`Unsupported recurrence rule: ${reason}`);
    this.name = "UnsupportedRecurrenceRuleError";
  }
}

function listLength(value: unknown) {
  if (Array.isArray(value)) return Math.max(1, value.length);
  return 1;
}

function assertSupportedRecurrence(parsed: Partial<ReturnType<typeof RRule.parseString>>) {
  const freq = parsed.freq;
  if (freq === undefined || RECURRENCE_PERIOD_MS[freq] === undefined) {
    throw new UnsupportedRecurrenceRuleError("frequency");
  }
  const timesPerDay =
    (freq === Frequency.HOURLY ? 24 : listLength(parsed.byhour)) *
    listLength(parsed.byminute) *
    listLength(parsed.bysecond);
  if (timesPerDay > MAX_RECURRENCE_OCCURRENCES_PER_DAY) {
    throw new UnsupportedRecurrenceRuleError("too many occurrences per day");
  }
}

// rrule checks UNTIL only on dates the rule produces. A rule whose filters
// never match (30 February, a weekday the INTERVAL never lands on) therefore
// walks every period up to year 9999, whatever DTSTART and UNTIL say: seconds
// for DAILY. Such rules are found by running the same rule, shifted by whole
// cycles so the walk starts shortly before year 9999, for one occurrence. A
// rule that produces nothing there is not expanded. Results are cached.
const EMPTINESS_PROBE_YEARS = 28;
const MAX_EMPTINESS_PROBE_CACHE_ENTRIES = 512;
const emptinessProbeCache = new Map<string, boolean>();

function lcm(a: number, b: number) {
  const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
  return (a / gcd(a, b)) * b;
}

function shiftWallDateByMonths(date: Date, months: number) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    )
  );
}

/** DTSTART moved by whole rule cycles to shortly before year 9999, or null. */
function emptinessProbeStart(freq: Frequency, interval: number, dtstart: Date): Date | null {
  const probeFromMs = Date.UTC(9999 - EMPTINESS_PROBE_YEARS, 0, 1);
  if (dtstart.getTime() >= probeFromMs) return dtstart;
  if (freq === Frequency.MONTHLY || freq === Frequency.YEARLY) {
    // Whole years keep month and day; 400 years keep 29 February and weekdays.
    const unitMonths = freq === Frequency.MONTHLY ? interval : interval * 12;
    const cycleMonths = lcm(unitMonths, dtstart.getUTCDate() > 28 ? 4800 : 12);
    const monthsToProbe =
      (9999 - EMPTINESS_PROBE_YEARS - dtstart.getUTCFullYear()) * 12 - dtstart.getUTCMonth();
    const cycles = Math.ceil(monthsToProbe / cycleMonths);
    if (cycles <= 0) return dtstart;
    const shifted = shiftWallDateByMonths(dtstart, cycles * cycleMonths);
    return shifted.getUTCFullYear() <= 9999 ? shifted : null;
  }
  // HOURLY moves by whole days so the time of day and the hour grid stay put.
  const unitMs = interval * (freq === Frequency.HOURLY ? DAY_MS : RECURRENCE_PERIOD_MS[freq]!);
  const cycles = Math.ceil((probeFromMs - dtstart.getTime()) / unitMs);
  const shifted = new Date(dtstart.getTime() + cycles * unitMs);
  return shifted.getTime() <= MAX_RULE_DATE_MS ? shifted : null;
}

function assertRecurrenceProducesOccurrences(
  normalizedRule: string,
  options: Partial<ReturnType<typeof RRule.parseString>>,
  dtstart: Date,
  interval: number
) {
  const key = `${normalizedRule}|${dtstart.getTime()}`;
  let empty = emptinessProbeCache.get(key);
  if (empty === undefined) {
    const probeStart = emptinessProbeStart(options.freq!, interval, dtstart);
    // A cycle too long to fit before year 9999 also means few periods in
    // total, so the plain walk is cheap; nothing to probe.
    empty =
      probeStart !== null &&
      new RRule({ ...options, dtstart: probeStart, until: null, count: 1, tzid: undefined }).all()
        .length === 0;
    if (emptinessProbeCache.size >= MAX_EMPTINESS_PROBE_CACHE_ENTRIES) {
      const oldest = emptinessProbeCache.keys().next();
      if (!oldest.done) emptinessProbeCache.delete(oldest.value);
    }
    emptinessProbeCache.set(key, empty);
  }
  if (empty) throw new UnsupportedRecurrenceRuleError("no occurrences");
}

/**
 * DTSTART moved forward by whole rule cycles so the work window (which counts
 * from DTSTART) covers `nearMs`: a DAILY series that started in 1998 would
 * otherwise end at the window in 2025. Only for rules whose occurrences do not
 * depend on where the walk starts: fixed-length periods (HOURLY, DAILY,
 * WEEKLY), no COUNT (counted from the original DTSTART), and not when UNTIL
 * ends the series before the new start. Moving by a whole number of
 * INTERVALs (HOURLY: whole days, as emptinessProbeStart) keeps every
 * candidate date, time of day and weekday. Applies only when DTSTART lies more
 * than half the window before `nearMs`; the new start is a quarter window
 * before it, so occurrences older than that are no longer listed.
 */
function rebaseDtstartNear(
  options: Partial<ReturnType<typeof RRule.parseString>>,
  interval: number,
  dtstart: Date,
  nearMs: number,
  ruleUntil: Date | undefined
): Date {
  const freq = options.freq;
  if (freq !== Frequency.DAILY && freq !== Frequency.WEEKLY && freq !== Frequency.HOURLY) return dtstart;
  if (typeof options.count === "number") return dtstart;
  const periodMs = interval * RECURRENCE_PERIOD_MS[freq]!;
  if (nearMs - dtstart.getTime() <= (MAX_RECURRENCE_PERIODS / 2) * periodMs) return dtstart;
  const anchorMs = nearMs - (MAX_RECURRENCE_PERIODS / 4) * periodMs;
  if (ruleUntil && ruleUntil.getTime() <= anchorMs) return dtstart;
  const unitMs = interval * (freq === Frequency.HOURLY ? DAY_MS : RECURRENCE_PERIOD_MS[freq]!);
  const cycles = Math.floor((anchorMs - dtstart.getTime()) / unitMs);
  return cycles > 0 ? new Date(dtstart.getTime() + cycles * unitMs) : dtstart;
}

/**
 * Build all rule dates in the same wall-clock space used by rrule's comparisons.
 * `nearMs` (display and reminders: now) moves an old DTSTART of a simple rule
 * close to that instant (rebaseDtstartNear), so the work limits still reach it.
 */
export function buildCalendarRecurrenceOptions(
  recurrenceRule: string,
  startAtMs: number,
  startTimezone?: string,
  { nearMs }: { nearMs?: number } = {}
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

  assertSupportedRecurrence(parsed);
  const ruleStart = toRuleDate(startAtMs);
  const interval =
    typeof parsed.interval === "number" && Number.isFinite(parsed.interval) && parsed.interval > 0
      ? parsed.interval
      : 1;
  assertRecurrenceProducesOccurrences(normalizedRule, parsed, ruleStart, interval);
  // The rule's own end, before the work window is applied. Callers that report
  // a series end must use this, not the clamped `options.until`.
  const ruleUntil = until instanceof Date ? until : undefined;
  const dtstart = typeof nearMs === "number" && Number.isFinite(nearMs)
    ? rebaseDtstartNear(parsed, interval, ruleStart, toRuleDate(nearMs).getTime(), ruleUntil)
    : ruleStart;
  const windowEndMs =
    dtstart.getTime() + MAX_RECURRENCE_PERIODS * interval * RECURRENCE_PERIOD_MS[parsed.freq!]!;
  const windowed =
    Number.isFinite(windowEndMs) &&
    windowEndMs < MAX_RULE_DATE_MS &&
    (!ruleUntil || ruleUntil.getTime() > windowEndMs);
  const boundedUntil = windowed ? new Date(windowEndMs) : until;

  return {
    options: { ...parsed, dtstart, until: boundedUntil, tzid: undefined },
    ruleUntil,
    /** True when the work window cut the rule short of its own end. */
    windowed,
    timeZone,
    toRuleDate,
    fromRuleDate
  };
}

type RecurrenceSource = Pick<RRule | RRuleSet, "all">;

export type BoundedRecurrenceQuery = {
  /** First occurrence after (or at, with `inc`) `date`; null if none or unknown. */
  after(date: Date, inc?: boolean): Date | null;
  /** Last occurrence before (or at, with `inc`) `date`; null if none or unknown. */
  before(date: Date, inc?: boolean): Date | null;
  /** Occurrences in [start, end), at most `limit`; null if the work limit was hit. */
  between(start: Date, end: Date, limit: number): Date[] | null;
  /** Last occurrence of a finite rule; null if none or unknown. */
  last(): Date | null;
  /** Number of occurrences of a finite rule; null if unknown. */
  count(): number | null;
};

/**
 * Wraps an rrule source so every query walks the occurrences once, within
 * MAX_RECURRENCE_OCCURRENCES and MAX_RECURRENCE_EXPANSION_MS. `visit` returns
 * false to stop; the result says whether the walk ended on its own terms.
 */
function walkOccurrences(source: RecurrenceSource, visit: (date: Date) => boolean): "done" | "limit" {
  const startedAt = performance.now();
  let visited = 0;
  let outcome: "done" | "limit" = "done";
  source.all((date) => {
    visited += 1;
    if (
      visited > MAX_RECURRENCE_OCCURRENCES ||
      ((visited & 0x3ff) === 0 && performance.now() - startedAt > MAX_RECURRENCE_EXPANSION_MS)
    ) {
      outcome = "limit";
      return false;
    }
    return visit(date);
  });
  return outcome;
}

export function createBoundedRecurrenceQuery(source: RecurrenceSource): BoundedRecurrenceQuery {
  return {
    after(date, inc = false) {
      const target = date.getTime();
      let found: Date | null = null;
      walkOccurrences(source, (occurrence) => {
        const atMs = occurrence.getTime();
        if (inc ? atMs >= target : atMs > target) {
          found = occurrence;
          return false;
        }
        return true;
      });
      return found;
    },
    before(date, inc = false) {
      const target = date.getTime();
      let latest: Date | null = null;
      const outcome = walkOccurrences(source, (occurrence) => {
        const atMs = occurrence.getTime();
        if (inc ? atMs > target : atMs >= target) return false;
        latest = occurrence;
        return true;
      });
      return outcome === "done" ? latest : null;
    },
    between(start, end, limit) {
      const startMs = start.getTime();
      const endMs = end.getTime();
      const occurrences: Date[] = [];
      const outcome = walkOccurrences(source, (occurrence) => {
        const atMs = occurrence.getTime();
        if (atMs >= endMs) return false;
        if (atMs >= startMs) occurrences.push(occurrence);
        return occurrences.length < limit;
      });
      return outcome === "done" ? occurrences : null;
    },
    last() {
      let latest: Date | null = null;
      const outcome = walkOccurrences(source, (occurrence) => {
        latest = occurrence;
        return true;
      });
      return outcome === "done" ? latest : null;
    },
    count() {
      let total = 0;
      const outcome = walkOccurrences(source, () => {
        total += 1;
        return true;
      });
      return outcome === "done" ? total : null;
    }
  };
}
