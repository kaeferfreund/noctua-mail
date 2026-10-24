type EnvMap = Record<string, string | undefined>;

const HASH_PREFIX = "sha256:";
const DISPLAY_HASH_LENGTH = 12;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const ISO_TIMESTAMP_PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/;
const TRAILING_TIMEZONE_PATTERN = /\s(?:UTC|GMT(?:[+-]\d{1,2}(?::?\d{2})?)?|[A-Z]{2,6})$/;

const SHORT_COMMIT_LENGTH = 7;
// CI writes `date -u '+%Y-%m-%d %H:%M'`; build stamps without an offset are UTC.
// Groups: year, month, day, hour, minute, optional second.
const UNZONED_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
const ZONED_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

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

// A blank variable (`NOCTUA_BUILD_HASH=` in an EnvironmentFile) counts as unset.
const firstSet = (...values: (string | undefined)[]) => values.find(value => value?.trim());
const buildHashValue = (env: EnvMap) => firstSet(env.NOCTUA_BUILD_HASH, env.NEXT_PUBLIC_BUILD_HASH);
const buildTimeValue = (env: EnvMap) => firstSet(env.NOCTUA_BUILD_TIME, env.NEXT_PUBLIC_BUILD_TIME);

/** True when the matched calendar fields exist (Date.parse rolls 2026-02-30 over to March). */
const isCalendarDateTime = (fields: RegExpMatchArray) => {
  const [year, month, day, hour, minute, second] = fields.slice(1, 7).map(field => Number(field ?? 0));
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day && hour < 24 && minute < 60 && second < 60;
};

/** UTC ISO instant (`2026-10-23T13:16:05Z`), or null when the stamp is not a date-time. */
const parseBuildTime = (value?: string) => {
  const trimmed = value?.trim() ?? "";
  const unzoned = trimmed.match(UNZONED_TIMESTAMP_PATTERN);
  const fields = unzoned ?? trimmed.match(ZONED_TIMESTAMP_PATTERN);
  const candidate = unzoned ? `${trimmed.replace(" ", "T")}Z` : trimmed;
  const time = fields && isCalendarDateTime(fields) ? Date.parse(candidate) : Number.NaN;
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

/** Label the client compares with /api/version to detect a new deployment. */
export const getBuildVersionLabel = (env: EnvMap = process.env) => {
  const hash = normalizeBuildHash(buildHashValue(env));
  const timestamp = appendShortTimeZone(normalizeBuildTimestamp(buildTimeValue(env)));

  if (hash && timestamp) {
    return `${hash} | ${timestamp}`;
  }
  return hash || timestamp;
};

/** Contents of public/build-version.json, written by build-scripts/generateBuildVersion.ts. */
export type BuildVersionPayload = {
  ok: true;
  buildVersionLabel: string;
  /** Full commit hash; absent in files from older builds and in the tracked placeholder. */
  hash?: string;
  builtAt?: string | null;
};

/** The build identity to record in the build artifact, from the build-time environment. */
export const createBuildVersionPayload = (env: EnvMap = process.env): BuildVersionPayload => {
  const info = getBuildInfo(env);
  return { ok: true, buildVersionLabel: getBuildVersionLabel(env), ...(info ? { hash: info.hash, builtAt: info.builtAt } : {}) };
};

export type RunningBuild = {
  /** Comparison key for the client's new-build check. */
  label: string;
  /** What BuildInfo displays; null without a known commit. */
  info: BuildIdentity | null;
};

/**
 * The build artifact is the source of the running build's identity: it is
 * written next to the compiled app, so the label, the display and the
 * /api/version answer always describe the code that is running, also in
 * Docker images whose build arguments are not set at runtime. The runtime
 * environment is used only when the artifact carries no identity (next dev,
 * builds from before the artifact recorded the commit).
 */
export const resolveRunningBuild = (file: Partial<BuildVersionPayload> | null, env: EnvMap = process.env): RunningBuild => {
  const hash = readBuildHash(typeof file?.hash === "string" ? file.hash : "");
  if (hash) {
    return {
      label: typeof file?.buildVersionLabel === "string" && file.buildVersionLabel ? file.buildVersionLabel : normalizeBuildHash(hash),
      info: { hash, shortHash: hash.slice(0, SHORT_COMMIT_LENGTH), builtAt: parseBuildTime(file?.builtAt ?? undefined) }
    };
  }
  const fileLabel = typeof file?.buildVersionLabel === "string" ? file.buildVersionLabel.trim() : "";
  return { label: fileLabel || getBuildVersionLabel(env), info: getBuildInfo(env) };
};
