import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { BURST_WINDOW_MS, type RecentSenderMail, type SpamTrustContext } from "./anomaly";
import type { openSpamDataDir } from "./evalData";
import { buildAccountSenderProfiles } from "./profileBuild";
import { evaluateSenderTrust, mergeSenderProfiles, type SenderProfile } from "./senderProfile";

/**
 * Sender profiles of a whole data dir for the scripts (spam-eval
 * --trust-profiles, spam-profiles-backfill --dry-run --out): built read-only
 * from the shards or read from a JSON file, merged per household on demand.
 */
type InboxMail = RecentSenderMail & { id: string };
export type AccountProfiles = { profiles: SenderProfile[]; inboxMails: Record<string, InboxMail[]>; rows: number; withSource: number };
export type ProfileFile = { version: 1; generatedAt: string; accounts: Record<string, AccountProfiles> };

export async function buildProfileFile(data: ReturnType<typeof openSpamDataDir>, onAccount?: (accountId: string, account: AccountProfiles, ms: number) => void) {
  const file: ProfileFile = { version: 1, generatedAt: new Date().toISOString(), accounts: {} };
  for (const account of data.accounts) {
    const started = performance.now();
    const { db, folders } = data.shard(account.id);
    const built = await buildAccountSenderProfiles({ accountId: account.id, db, folders, ownAddresses: data.own.ownAddresses, sourcesDir: data.sourcesDir });
    const entry: AccountProfiles = { profiles: [...built.profiles.values()], inboxMails: Object.fromEntries(built.inboxMails), rows: built.rows, withSource: built.withSource };
    file.accounts[account.id] = entry;
    onAccount?.(account.id, entry, performance.now() - started);
  }
  return file;
}

export function writeProfileFile(path: string, file: ProfileFile) {
  writeFileSync(path, `${JSON.stringify(file)}\n`, { mode: 0o600 });
}

export type HouseholdProfiles = {
  source: "file" | "built";
  rows: number;
  senders: number;
  trusted: number;
  /** `date`: the mail's own date, the reference time for decay (as at its arrival). */
  context: (accountId: string, messageId: string, date: number) => SpamTrustContext;
};

export function householdProfiles(file: ProfileFile, ownAddresses: ReadonlySet<string>, source: HouseholdProfiles["source"], now = Date.now()): HouseholdProfiles {
  const bySender = new Map<string, SenderProfile[]>();
  for (const account of Object.values(file.accounts)) {
    for (const profile of account.profiles) {
      const list = bySender.get(profile.senderKey);
      if (list) list.push(profile); else bySender.set(profile.senderKey, [profile]);
    }
  }
  const merged = (senderKey: string, at: number) => mergeSenderProfiles(bySender.get(senderKey) ?? [], at);
  let trusted = 0;
  for (const senderKey of bySender.keys()) if (evaluateSenderTrust(merged(senderKey, now), now).trusted) trusted += 1;
  return {
    source,
    rows: Object.values(file.accounts).reduce((sum, account) => sum + account.rows, 0),
    senders: bySender.size,
    trusted,
    context: (accountId, messageId, date) => ({
      ownAddresses,
      loadProfile: async (senderKey, at) => merged(senderKey, at),
      loadRecent: async (senderKey, date) => (file.accounts[accountId]?.inboxMails[senderKey] ?? [])
        .filter((mail) => mail.id !== messageId && Math.abs(mail.date - date) <= BURST_WINDOW_MS),
      canaryKey: messageId,
      now: date
    })
  };
}

/** Reads `path` when it exists, otherwise builds from the data dir (and writes `path` when given). */
export async function loadHouseholdProfiles(data: ReturnType<typeof openSpamDataDir>, path: string | null) {
  if (path && existsSync(path)) {
    const file = JSON.parse(readFileSync(path, "utf8")) as ProfileFile;
    if (file.version !== 1 || !file.accounts) throw new Error(`${path} is not a sender profile file`);
    return householdProfiles(file, data.own.ownAddresses, "file");
  }
  const file = await buildProfileFile(data);
  if (path) writeProfileFile(path, file);
  return householdProfiles(file, data.own.ownAddresses, "built");
}
