import type { PushDeviceSettings, PushQuietHours } from "./types";

const SETTINGS_KEYS = ["accountIds", "includeSubject", "quietHours", "badge"];
const QUIET_HOURS_KEYS = ["from", "to", "timeZone"];
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_ACCOUNT_IDS = 200;
const MAX_ACCOUNT_ID_LENGTH = 200;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => key in value);
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function parseQuietHours(value: unknown): PushQuietHours | null | undefined {
  if (value === null) return null;
  if (!isPlainObject(value) || !hasExactKeys(value, QUIET_HOURS_KEYS)) return undefined;
  const { from, to, timeZone } = value;
  if (typeof from !== "string" || typeof to !== "string" || !CLOCK_TIME.test(from) || !CLOCK_TIME.test(to) || from === to) return undefined;
  if (!isValidTimeZone(timeZone)) return undefined;
  return { from, to, timeZone };
}

function parseAccountIds(value: unknown): PushDeviceSettings["accountIds"] | undefined {
  if (value === "all") return "all";
  if (!Array.isArray(value) || value.length > MAX_ACCOUNT_IDS) return undefined;
  if (!value.every((id) => typeof id === "string" && id.length > 0 && id.length <= MAX_ACCOUNT_ID_LENGTH)) return undefined;
  return Array.from(new Set(value as string[]));
}

/** Strict parse of a complete settings object; null when anything is missing, extra or malformed. */
export function parsePushDeviceSettings(value: unknown): PushDeviceSettings | null {
  if (!isPlainObject(value) || !hasExactKeys(value, SETTINGS_KEYS)) return null;
  const accountIds = parseAccountIds(value.accountIds);
  const quietHours = parseQuietHours(value.quietHours);
  if (accountIds === undefined || quietHours === undefined) return null;
  if (typeof value.includeSubject !== "boolean" || typeof value.badge !== "boolean") return null;
  return { accountIds, includeSubject: value.includeSubject, quietHours, badge: value.badge };
}

export function pushSettingsIncludeAccount(settings: PushDeviceSettings, accountId: string) {
  return settings.accountIds === "all" || settings.accountIds.includes(accountId);
}

function minutesOf(clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Wall-clock minutes since midnight at `now` in `timeZone`. */
function localMinutes(now: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** `from` is inclusive and `to` exclusive; a window with from > to spans midnight. */
export function isWithinQuietHours(quietHours: PushQuietHours | null, now: number) {
  if (!quietHours) return false;
  const current = localMinutes(now, quietHours.timeZone);
  const from = minutesOf(quietHours.from);
  const to = minutesOf(quietHours.to);
  return from < to ? current >= from && current < to : current >= from || current < to;
}
