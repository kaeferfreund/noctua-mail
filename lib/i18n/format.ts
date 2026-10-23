import { formattingLocales, timeZone, type UiLocale } from "./config";

// Locale AND display zone are part of every cache key. Options are sorted so
// equivalent option objects reuse a formatter regardless of property order.
const dates = new Map<string, Intl.DateTimeFormat>();
const numbers = new Map<string, Intl.NumberFormat>();
const relatives = new Map<string, Intl.RelativeTimeFormat>();
const lists = new Map<string, Intl.ListFormat>();
function key(locale: UiLocale, zone: string, options: object) {
  return JSON.stringify([locale, zone, Object.entries(options).sort(([a], [b]) => a.localeCompare(b))]);
}
function cached<T>(cache: Map<string, T>, id: string, create: () => T): T {
  const existing = cache.get(id);
  if (existing) return existing;
  const formatter = create();
  cache.set(id, formatter);
  return formatter;
}
export function formatDate(value: Date | number, locale: UiLocale, options: Intl.DateTimeFormatOptions = {}, zone = timeZone) {
  const resolved = { day: "2-digit", month: "2-digit", year: "numeric", ...options, timeZone: zone } satisfies Intl.DateTimeFormatOptions;
  return cached(dates, key(locale, zone, resolved), () => new Intl.DateTimeFormat(formattingLocales[locale], resolved)).format(value);
}
export function formatTime(value: Date | number, locale: UiLocale, options: Intl.DateTimeFormatOptions = {}, zone = timeZone) {
  const resolved = { hour: "2-digit", minute: "2-digit", ...options, hourCycle: "h23", timeZone: zone } satisfies Intl.DateTimeFormatOptions;
  return cached(dates, key(locale, zone, resolved), () => new Intl.DateTimeFormat(formattingLocales[locale], resolved)).format(value);
}
export function formatNumber(value: number, locale: UiLocale, options: Intl.NumberFormatOptions = {}, zone = timeZone) {
  return cached(numbers, key(locale, zone, options), () => new Intl.NumberFormat(formattingLocales[locale], options)).format(value);
}
export function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, locale: UiLocale, options: Intl.RelativeTimeFormatOptions = {}, zone = timeZone) {
  return cached(relatives, key(locale, zone, options), () => new Intl.RelativeTimeFormat(formattingLocales[locale], options)).format(value, unit);
}
export function formatList(value: Iterable<string>, locale: UiLocale, options: Intl.ListFormatOptions = {}, zone = timeZone) {
  return cached(lists, key(locale, zone, options), () => new Intl.ListFormat(formattingLocales[locale], options)).format(value);
}

/** Calendar-day ordinal in the explicit display zone; subtraction stays correct across DST. */
export function displayDayNumber(value: Date | number, zone = timeZone) {
  const parts = cached(dates, `display-day:${zone}`, () => new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: zone
  })).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000;
}
