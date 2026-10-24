import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { BURST_WINDOW_MS, type RecentSenderMail, type SpamTrustContext } from "./anomaly";
import type { openSpamDataDir } from "./evalData";
import { buildAccountSenderProfiles, foldSenderMails, type SenderMailRecord } from "./profileBuild";
import { evaluateSenderTrust, mergeSenderProfiles, type SenderProfile } from "./senderProfile";

/**
 * Sender histories of a whole data dir for the scripts (spam-eval
 * --trust-profiles, spam-profiles-backfill --out): built read-only from the
 * shards or read from a JSON file. A mail is judged with the household profile
 * of the mails that arrived before it, never with itself or later mail, so the
 * "first seen" rules of the anomaly gate fire as they would have on arrival.
 */
type InboxMail = RecentSenderMail & { id: string };
export type AccountProfiles = {
  /** Counted mails per sender, sorted by arrival. */
  mails: Record<string, SenderMailRecord[]>;
  junkMails: Record<string, number>;
  /** Latest stored "Als Spam" per sender. */
  userSpam: Record<string, number>;
  inboxMails: Record<string, InboxMail[]>;
  rows: number;
  withSource: number;
};
export type ProfileFile = { version: 2; generatedAt: string; accounts: Record<string, AccountProfiles> };

type SpamDataDir = Pick<ReturnType<typeof openSpamDataDir>, "accounts" | "shard" | "own" | "sourcesDir">;

/** Builds the histories of every account, or only of `accountId` (other shards are never opened). */
export async function buildProfileFile(data: SpamDataDir, onAccount?: (accountId: string, account: AccountProfiles, ms: number) => void,
  accountId: string | null = null) {
  const file: ProfileFile = { version: 2, generatedAt: new Date().toISOString(), accounts: {} };
  const accounts = data.accounts.filter((account) => accountId === null || account.id === accountId);
  if (accountId !== null && !accounts.length) throw new Error(`Account ${accountId} not found`);
  for (const account of accounts) {
    const started = performance.now();
    const { db, folders } = data.shard(account.id);
    const built = await buildAccountSenderProfiles({ accountId: account.id, db, folders, ownAddresses: data.own.ownAddresses, sourcesDir: data.sourcesDir });
    const entry: AccountProfiles = {
      mails: Object.fromEntries(built.mails), junkMails: Object.fromEntries(built.junkMails), userSpam: Object.fromEntries(built.userSpam),
      inboxMails: Object.fromEntries(built.inboxMails), rows: built.rows, withSource: built.withSource
    };
    file.accounts[account.id] = entry;
    onAccount?.(account.id, entry, performance.now() - started);
  }
  return file;
}

/** Senders of an account: those with counted mail and those only known from an "Als Spam". */
export const accountSenders = (account: AccountProfiles) => new Set([...Object.keys(account.mails), ...Object.keys(account.userSpam)]);

export function writeProfileFile(path: string, file: ProfileFile) {
  writeFileSync(path, `${JSON.stringify(file)}\n`, { mode: 0o600 });
}

/** Snapshot interval for prefix profiles: a lookup folds at most this many mails. */
const CHECKPOINT_EVERY = 32;

/** Profile of one sender in one mailbox from the mails that arrived before `cutoff`. */
function senderHistory(senderKey: string, mails: SenderMailRecord[], junkCount: number, lastUserSpamAt: number | null) {
  const checkpoints: SenderProfile[] = [];
  let running: SenderProfile | null = null;
  mails.forEach((mail, index) => {
    running = foldSenderMails(senderKey, [mail], junkCount, lastUserSpamAt, running);
    if ((index + 1) % CHECKPOINT_EVERY === 0) checkpoints.push(structuredClone(running));
  });
  return (cutoff: number): SenderProfile | null => {
    let count = 0;
    for (let high = mails.length; count < high;) {
      const middle = (count + high) >> 1;
      if (mails[middle].date < cutoff) count = middle + 1; else high = middle;
    }
    if (count === 0 && lastUserSpamAt === null) return null;
    const checkpoint = Math.floor(count / CHECKPOINT_EVERY);
    const start = checkpoint > 0 ? structuredClone(checkpoints[checkpoint - 1]) : null;
    return foldSenderMails(senderKey, mails.slice(checkpoint * CHECKPOINT_EVERY, count), junkCount, lastUserSpamAt, start);
  };
}

export type HouseholdProfiles = {
  source: "file" | "built";
  rows: number;
  senders: number;
  /** Trusted with the whole history as of now. */
  trusted: number;
  /** `date`: the mail's arrival (spamArrivalTime), the reference time for decay and the history cutoff. */
  context: (accountId: string, messageId: string, date: number) => SpamTrustContext;
};

export function householdProfiles(file: ProfileFile, ownAddresses: ReadonlySet<string>, source: HouseholdProfiles["source"], now = Date.now()): HouseholdProfiles {
  const bySender = new Map<string, Array<(cutoff: number) => SenderProfile | null>>();
  const arrivals = new Map<string, number>();
  for (const [accountId, account] of Object.entries(file.accounts)) {
    for (const senderKey of accountSenders(account)) {
      const mails = account.mails[senderKey] ?? [];
      for (const mail of mails) arrivals.set(`${accountId}\n${mail.id}`, mail.date);
      const history = senderHistory(senderKey, mails, account.junkMails[senderKey] ?? 0, account.userSpam[senderKey] ?? null);
      const list = bySender.get(senderKey);
      if (list) list.push(history); else bySender.set(senderKey, [history]);
    }
  }
  const merged = (senderKey: string, cutoff: number, at: number) => mergeSenderProfiles(
    (bySender.get(senderKey) ?? []).map((history) => history(cutoff)).filter((profile): profile is SenderProfile => profile !== null), at);
  let trusted = 0;
  for (const senderKey of bySender.keys()) if (evaluateSenderTrust(merged(senderKey, Infinity, now), now).trusted) trusted += 1;
  return {
    source,
    rows: Object.values(file.accounts).reduce((sum, account) => sum + account.rows, 0),
    senders: bySender.size,
    trusted,
    context: (accountId, messageId, date) => {
      // The judged mail and everything that arrived with or after it stay out of its profile.
      const cutoff = Math.min(date, arrivals.get(`${accountId}\n${messageId}`) ?? date);
      return {
        ownAddresses,
        loadProfile: async (senderKey, at) => merged(senderKey, cutoff, at),
        loadRecent: async (senderKey, around) => (file.accounts[accountId]?.inboxMails[senderKey] ?? [])
          .filter((mail) => mail.id !== messageId && Math.abs(mail.date - around) <= BURST_WINDOW_MS),
        canaryKey: messageId,
        now: date
      };
    }
  };
}

/** Reads `path` when it exists, otherwise builds from the data dir (and writes `path` when given). */
export async function loadHouseholdProfiles(data: ReturnType<typeof openSpamDataDir>, path: string | null) {
  if (path && existsSync(path)) {
    const file = JSON.parse(readFileSync(path, "utf8")) as ProfileFile;
    if (file.version !== 2 || !file.accounts) throw new Error(`${path} is not a sender profile file of this version (rebuild it: delete it or pass a new path)`);
    return householdProfiles(file, data.own.ownAddresses, "file");
  }
  const file = await buildProfileFile(data);
  if (path) writeProfileFile(path, file);
  return householdProfiles(file, data.own.ownAddresses, "built");
}
