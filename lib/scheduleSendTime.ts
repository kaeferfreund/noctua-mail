/**
 * Wall-clock math for "Senden planen" in an explicit IANA time zone (the browser's by
 * default). The server only ever sees the resulting UTC epoch; DST gaps never produce
 * a time and an ambiguous fall-back time resolves to its first (summer-time) instant.
 */

export type SchedulePresetKind = "thisMorning" | "tomorrowMorning" | "thisAfternoon" | "tomorrowAfternoon" | "mondayMorning";
export type SchedulePreset = { kind: SchedulePresetKind; sendAt: number };
export type LocalDate = { year: number; month: number; day: number };
export type CustomTimeOption = { value: string; sendAt: number };

export const SCHEDULED_SEND_MIN_AHEAD_MS = 60_000;

const MORNING_HOUR = 8;
const AFTERNOON_HOUR = 13;
export const CUSTOM_TIME_STEP_MINUTES = 15;

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function zonedParts(epoch: number, timeZone: string) {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric",
      day: "numeric", hour: "numeric", minute: "numeric", weekday: "short" });
    partsFormatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(part => [part.type, part.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday)
  };
}

function offsetAt(epoch: number, timeZone: string) {
  const p = zonedParts(epoch, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(epoch / 60_000) * 60_000;
}

/** The UTC instant of a local wall time, or null when that time does not exist (DST gap). */
export function zonedTimeToEpoch(date: LocalDate, hour: number, minute: number, timeZone: string): number | null {
  const wall = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  // Offsets 12 h either side bracket any single transition, giving both candidates of a fold.
  const candidates = [...new Set([wall - offsetAt(wall - 43_200_000, timeZone), wall - offsetAt(wall + 43_200_000, timeZone)])]
    .filter(epoch => {
      const p = zonedParts(epoch, timeZone);
      return p.year === date.year && p.month === date.month && p.day === date.day && p.hour === hour && p.minute === minute;
    });
  return candidates.length ? Math.min(...candidates) : null;
}

export function localDateOf(epoch: number, timeZone: string): LocalDate {
  const { year, month, day } = zonedParts(epoch, timeZone);
  return { year, month, day };
}

export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function formatLocalDate(date: LocalDate) {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function parseLocalDate(value: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return formatLocalDate(addLocalDays(date, 0)) === value ? date : null;
}

/** First wall-time instant ≥ hour:00 of `date` (a DST gap at that hour moves to the next quarter hour). */
function atHour(date: LocalDate, hour: number, timeZone: string) {
  for (let minute = 0; minute < 120; minute += CUSTOM_TIME_STEP_MINUTES) {
    const epoch = zonedTimeToEpoch(date, hour + Math.floor(minute / 60), minute % 60, timeZone);
    if (epoch !== null) return epoch;
  }
  return zonedTimeToEpoch(addLocalDays(date, 1), 0, 0, timeZone) ?? Date.UTC(date.year, date.month - 1, date.day, hour);
}

/**
 * „Heute früh“ 08:00 while still ahead (else „Morgen früh“), „Diesen Nachmittag“ 13:00
 * likewise (else „Morgen Nachmittag“), „Montag morgen“ 08:00 of the next Monday — today
 * when it is Monday before 08:00.
 */
export function computeSchedulePresets(now: number, timeZone: string): SchedulePreset[] {
  const today = localDateOf(now, timeZone);
  const tomorrow = addLocalDays(today, 1);
  const todayMorning = atHour(today, MORNING_HOUR, timeZone);
  const todayAfternoon = atHour(today, AFTERNOON_HOUR, timeZone);
  const weekday = zonedParts(now, timeZone).weekday;
  const daysToMonday = weekday === 1 && todayMorning >= now + SCHEDULED_SEND_MIN_AHEAD_MS ? 0 : ((8 - weekday) % 7) || 7;
  return [
    todayMorning >= now + SCHEDULED_SEND_MIN_AHEAD_MS
      ? { kind: "thisMorning", sendAt: todayMorning }
      : { kind: "tomorrowMorning", sendAt: atHour(tomorrow, MORNING_HOUR, timeZone) },
    todayAfternoon >= now + SCHEDULED_SEND_MIN_AHEAD_MS
      ? { kind: "thisAfternoon", sendAt: todayAfternoon }
      : { kind: "tomorrowAfternoon", sendAt: atHour(tomorrow, AFTERNOON_HOUR, timeZone) },
    { kind: "mondayMorning", sendAt: atHour(addLocalDays(today, daysToMonday), MORNING_HOUR, timeZone) }
  ];
}

/** Existing, future quarter-hour wall times of `date` ("HH:MM"), each with its UTC instant. */
export function customTimeOptions(date: LocalDate, now: number, timeZone: string): CustomTimeOption[] {
  const options: CustomTimeOption[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += CUSTOM_TIME_STEP_MINUTES) {
    const hour = Math.floor(minutes / 60), minute = minutes % 60;
    const sendAt = zonedTimeToEpoch(date, hour, minute, timeZone);
    if (sendAt === null || sendAt < now + SCHEDULED_SEND_MIN_AHEAD_MS) continue;
    options.push({ value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, sendAt });
  }
  return options;
}

export type CustomTimeResult = { ok: true; sendAt: number } | { ok: false; reason: "invalid" | "nonexistent" | "past" | "tooSoon" };

/** Validates the custom date + "HH:MM" pair; only quarter-hour, existing, future wall times pass. */
export function resolveCustomTime(dateValue: string, timeValue: string, now: number, timeZone: string): CustomTimeResult {
  const date = parseLocalDate(dateValue);
  const time = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!date || !time) return { ok: false, reason: "invalid" };
  const hour = Number(time[1]), minute = Number(time[2]);
  if (hour > 23 || minute > 59 || minute % CUSTOM_TIME_STEP_MINUTES) return { ok: false, reason: "invalid" };
  const sendAt = zonedTimeToEpoch(date, hour, minute, timeZone);
  if (sendAt === null) return { ok: false, reason: "nonexistent" };
  if (sendAt <= now) return { ok: false, reason: "past" };
  return sendAt >= now + SCHEDULED_SEND_MIN_AHEAD_MS ? { ok: true, sendAt } : { ok: false, reason: "tooSoon" };
}

/** „25. Okt., 08:00“ (de) / „Oct 25, 08:00“ (en). */
export function formatScheduledSendTime(sendAt: number, locale: string, timeZone?: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    ...(timeZone ? { timeZone } : {}) }).format(new Date(sendAt));
}
