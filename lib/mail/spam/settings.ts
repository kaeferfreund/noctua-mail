import { countSpamTrustDecisions, getAccounts, getSpamSettings, saveSpamSettings } from "@/lib/db";
import {
  parseSpamAdminSettings,
  parseSpamMailboxSettings,
  resolveSpamConfig,
  type SpamAdminSettings,
  type SpamConfig,
  type SpamMailboxSettings
} from "./config";
import { spamModelUnavailableReason } from "./provider";

const GLOBAL_SCOPE = "global";

function lenient<T>(parse: (input: unknown) => T, stored: unknown): T | null {
  if (!stored) return null;
  try { return parse(stored); } catch { return null; }
}

export async function loadSpamAdminSettings(): Promise<SpamAdminSettings> {
  return lenient(parseSpamAdminSettings, await getSpamSettings(GLOBAL_SCOPE)) ?? {};
}

export async function loadSpamConfig(): Promise<SpamConfig> {
  return resolveSpamConfig(await loadSpamAdminSettings());
}

export async function loadMailboxSpamSettings(accountId: string): Promise<SpamMailboxSettings> {
  return lenient(parseSpamMailboxSettings, await getSpamSettings(accountId)) ?? {};
}

/** Throws SpamSettingsError on invalid input. */
export async function saveSpamAdminSettings(input: unknown, userId: string) {
  const settings = parseSpamAdminSettings(input);
  await saveSpamSettings(GLOBAL_SCOPE, settings, userId);
  return settings;
}

export async function saveMailboxSpamSettings(accountId: string, input: unknown, userId: string) {
  const settings = parseSpamMailboxSettings(input);
  await saveSpamSettings(accountId, settings, userId);
  return settings;
}

/** What the admin UI shows; never includes the key itself. */
export function describeSpamConfig(config: SpamConfig) {
  return {
    enabled: config.enabled,
    provider: config.provider,
    model: config.model,
    threshold: config.threshold,
    modelUnavailable: spamModelUnavailableReason(config)
  };
}

/** Read-only trusted-sender counters per mailbox for the admin view (derived from stored verdicts). */
export async function loadSpamTrustCounters() {
  const accounts = await getAccounts();
  return Promise.all(accounts.map(async (account) => ({
    accountId: account.id,
    email: account.email,
    ...await countSpamTrustDecisions(account.id).catch(() => ({ trustedSkips: 0, canaryChecks: 0, canaryMismatches: 0 }))
  })));
}
