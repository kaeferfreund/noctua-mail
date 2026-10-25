import type { Account } from "@/lib/data";
import { countSpamTrustDecisions, getSpamSettings, saveSpamSettings } from "@/lib/db";
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
const MAILBOX_SCOPE_PREFIX = "account:";

/** Mailbox rows are keyed `account:<id>`, so no account id can address the global row. */
export const mailboxSpamScope = (accountId: string) => `${MAILBOX_SCOPE_PREFIX}${accountId}`;

/** Rows written before the prefix used the bare account id; never "global" or an id that looks prefixed. */
function legacyMailboxScope(accountId: string) {
  return accountId === GLOBAL_SCOPE || accountId.startsWith(MAILBOX_SCOPE_PREFIX) ? undefined : accountId;
}

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
  const legacy = legacyMailboxScope(accountId);
  const stored = await getSpamSettings(mailboxSpamScope(accountId)) ?? (legacy ? await getSpamSettings(legacy) : null);
  return lenient(parseSpamMailboxSettings, stored) ?? {};
}

/** Throws SpamSettingsError on invalid input. Every save is written to the admin log with the previous settings. */
export async function saveSpamAdminSettings(input: unknown, userId: string) {
  const settings = parseSpamAdminSettings(input);
  await saveSpamSettings(GLOBAL_SCOPE, settings, userId, { audit: { actorUserId: userId, targetAccountId: null } });
  return settings;
}

export async function saveMailboxSpamSettings(accountId: string, input: unknown, userId: string) {
  const settings = parseSpamMailboxSettings(input);
  await saveSpamSettings(mailboxSpamScope(accountId), settings, userId,
    { replacesScope: legacyMailboxScope(accountId), audit: { actorUserId: userId, targetAccountId: accountId } });
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

/**
 * Read-only trusted-sender counters per mailbox for the admin view (derived from stored verdicts),
 * for the given mailboxes only: the route passes the admin's own.
 */
export async function loadSpamTrustCounters(accounts: ReadonlyArray<Pick<Account, "id" | "email">>) {
  return Promise.all(accounts.map(async (account) => ({
    accountId: account.id,
    email: account.email,
    ...await countSpamTrustDecisions(account.id).catch(() => ({ trustedSkips: 0, canaryChecks: 0, canaryMismatches: 0 }))
  })));
}
