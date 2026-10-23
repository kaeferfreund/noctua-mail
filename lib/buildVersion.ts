type EnvMap = Record<string, string | undefined>;

const HASH_PREFIX = "sha256:";
const DISPLAY_HASH_LENGTH = 12;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const ISO_TIMESTAMP_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/;
const TRAILING_TIMEZONE_PATTERN = /\s(?:UTC|GMT(?:[+-]\d{1,2}(?::?\d{2})?)?|[A-Z]{2,6})$/;

const SHORT_COMMIT_LENGTH = 7;
// CI writes `date -u '+%Y-%m-%d %H:%M'`; build stamps without an offset are UTC.
const UNZONED_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
const ZONED_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

const readBuildHash = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.startsWith(HASH_PREFIX) ? trimmed.slice(HASH_PREFIX.length) : trimmed;
};

const normalizeBuildHash = (value?: string) => readBuildHash(value).slice(0, DISPLAY_HASH_LENGTH);

const normalizeBuildTimestamp = (value?: string) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (TIMESTAMP_PATTERN.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(ISO_TIMESTAMP_PREFIX_PATTERN);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return trimmed;
};

const getShortTimeZoneLabel = () => {
  try {
    const part = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(new Date())
      .find((item) => item.type === "timeZoneName");
    return part?.value?.trim() ?? "";
  } catch {
    return "";
  }
};

const appendShortTimeZone = (timestamp: string) => {
  if (!timestamp || TRAILING_TIMEZONE_PATTERN.test(timestamp)) {
    return timestamp;
  }
  const shortTimeZone = getShortTimeZoneLabel();
  return shortTimeZone ? `${timestamp} ${shortTimeZone}` : timestamp;
};

const buildHashValue = (env: EnvMap) => env.NOCTUA_BUILD_HASH ?? env.NEXT_PUBLIC_BUILD_HASH;
const buildTimeValue = (env: EnvMap) => env.NOCTUA_BUILD_TIME ?? env.NEXT_PUBLIC_BUILD_TIME;

/** UTC ISO instant (`2026-10-23T13:16:05Z`), or null when the stamp is not a date-time. */
const parseBuildTime = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  const candidate = UNZONED_TIMESTAMP_PATTERN.test(trimmed)
    ? `${trimmed.replace(" ", "T")}Z`
    : ZONED_TIMESTAMP_PATTERN.test(trimmed) ? trimmed : "";
  const time = candidate ? Date.parse(candidate) : Number.NaN;
  return Number.isNaN(time) ? null : new Date(time).toISOString().replace(/\.000Z$/, "Z");
};

export type BuildIdentity = {
  hash: string;
  shortHash: string;
  builtAt: string | null;
};

/** Commit and build time of the running server; null without a build hash (local dev, tests). */
export const getBuildInfo = (env: EnvMap = process.env): BuildIdentity | null => {
  const hash = readBuildHash(buildHashValue(env));
  if (!hash) return null;
  return {
    hash,
    shortHash: hash.slice(0, SHORT_COMMIT_LENGTH),
    builtAt: parseBuildTime(buildTimeValue(env))
  };
};

export const getBuildVersionLabel = (env: EnvMap = process.env) => {
  const hash = normalizeBuildHash(buildHashValue(env));
  const timestamp = appendShortTimeZone(normalizeBuildTimestamp(buildTimeValue(env)));

  if (hash && timestamp) {
    return `${hash} | ${timestamp}`;
  }
  return hash || timestamp;
};
