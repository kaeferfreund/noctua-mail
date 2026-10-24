/**
 * Spam detection configuration (doc/SPAM-DETECTION.md). Environment values are
 * defaults; the admin setting (master table `spam_settings`, scope "global")
 * overrides enabled/model/threshold. Per-mailbox settings add an own on/off
 * switch (default on), auto-move and an optional threshold override.
 */
export const DEFAULT_SPAM_PROVIDER = "anthropic";
export const DEFAULT_SPAM_MODEL = "claude-haiku-5-5";
export const DEFAULT_SPAM_THRESHOLD = 0.85;

export type SpamAdminSettings = { enabled?: boolean; model?: string; threshold?: number };
export type SpamMailboxSettings = { enabled?: boolean; autoMove?: boolean; threshold?: number };

export type SpamConfig = {
  enabled: boolean;
  provider: string;
  model: string;
  threshold: number;
  apiKey: string | null;
};

type SpamEnv = Record<string, string | undefined>;

function envThreshold(value: string | undefined) {
  const parsed = Number(value);
  return value && isValidThreshold(parsed) ? parsed : undefined;
}

export function isValidThreshold(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.5 && value <= 1;
}

export function resolveSpamConfig(admin: SpamAdminSettings | null, env: SpamEnv = process.env): SpamConfig {
  const envEnabled = env.NOCTUA_SPAM_ENABLED?.trim();
  return {
    enabled: admin?.enabled ?? (envEnabled === "1" || envEnabled === "true"),
    provider: env.NOCTUA_SPAM_PROVIDER?.trim() || DEFAULT_SPAM_PROVIDER,
    model: admin?.model?.trim() || env.NOCTUA_SPAM_MODEL?.trim() || DEFAULT_SPAM_MODEL,
    threshold: admin?.threshold ?? envThreshold(env.NOCTUA_SPAM_THRESHOLD) ?? DEFAULT_SPAM_THRESHOLD,
    apiKey: env.ANTHROPIC_API_KEY?.trim() || null
  };
}

/** The global switch must be on; a mailbox is on unless switched off explicitly. */
export function isSpamDetectionOn(config: Pick<SpamConfig, "enabled">, mailbox: SpamMailboxSettings | null) {
  return config.enabled && mailbox?.enabled !== false;
}

export function resolveMailboxThreshold(config: SpamConfig, mailbox: SpamMailboxSettings | null) {
  return mailbox?.threshold ?? config.threshold;
}

export class SpamSettingsError extends Error {}

/** Validates an admin PUT body. Unknown keys are rejected, absent keys stay unset. */
export function parseSpamAdminSettings(input: unknown): SpamAdminSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new SpamSettingsError("Invalid settings");
  const { enabled, model, threshold, ...rest } = input as Record<string, unknown>;
  if (Object.keys(rest).length) throw new SpamSettingsError("Unknown setting");
  const next: SpamAdminSettings = {};
  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") throw new SpamSettingsError("Invalid enabled flag");
    next.enabled = enabled;
  }
  if (model !== undefined && model !== null && model !== "") {
    if (typeof model !== "string" || !/^[A-Za-z0-9._:\/-]{1,100}$/.test(model.trim())) throw new SpamSettingsError("Invalid model");
    next.model = model.trim();
  }
  if (threshold !== undefined && threshold !== null) {
    if (!isValidThreshold(threshold)) throw new SpamSettingsError("Invalid threshold");
    next.threshold = threshold;
  }
  return next;
}

export function parseSpamMailboxSettings(input: unknown): SpamMailboxSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new SpamSettingsError("Invalid settings");
  const { enabled, autoMove, threshold, ...rest } = input as Record<string, unknown>;
  if (Object.keys(rest).length) throw new SpamSettingsError("Unknown setting");
  const next: SpamMailboxSettings = {};
  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") throw new SpamSettingsError("Invalid enabled flag");
    next.enabled = enabled;
  }
  if (autoMove !== undefined) {
    if (typeof autoMove !== "boolean") throw new SpamSettingsError("Invalid autoMove flag");
    next.autoMove = autoMove;
  }
  if (threshold !== undefined && threshold !== null) {
    if (!isValidThreshold(threshold)) throw new SpamSettingsError("Invalid threshold");
    next.threshold = threshold;
  }
  return next;
}
