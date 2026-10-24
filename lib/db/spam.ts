import { randomUUID } from "crypto";
import { withDbWriteRetry } from "../dbWriteRetry";
import type { SpamDecision, SpamExample, SpamLabel } from "../mail/spam/types";
import type { AccountProfileBuild } from "../mail/spam/profileBuild";
import {
  addProfileJunk,
  emptySenderProfile,
  foldSenderMail,
  hasProfileMail,
  PROFILE_MAIL_IDS,
  profileMailKey,
  senderProfileFromRow,
  serializeProfilePatterns,
  type SenderMailFacts,
  type SenderProfile,
  type SenderProfileRow
} from "../mail/spam/senderProfile";
import { getAccountDb, getDb } from "./connection";
import { sentToAddressInDb } from "./sentRecipients";

const EXAMPLES_PER_ACCOUNT = 2000;
const DOMAIN_CANDIDATES = 20;
const RECENT_CANDIDATES = 200;

export type StoredSpamVerdict = Pick<SpamDecision, "verdict" | "confidence" | "reasons">;

/** `automatic` writes only rows that are still unchecked, so a user's correction always wins. */
export async function saveSpamVerdict(accountId: string, messageId: string, verdict: StoredSpamVerdict,
  options: { automatic?: boolean; checkedAt?: number } = {}) {
  return withDbWriteRetry("saveSpamVerdict", async () => {
    const db = await getAccountDb(accountId);
    return db.prepare(`UPDATE messages SET spamVerdict = ?, spamConfidence = ?, spamReasons = ?, spamCheckedAt = ?
      WHERE accountId = ? AND id = ?${options.automatic ? " AND spamCheckedAt IS NULL" : ""}`)
      .run(verdict.verdict, verdict.confidence, JSON.stringify(verdict.reasons), options.checkedAt ?? Date.now(), accountId, messageId)
      .changes > 0;
  });
}

/**
 * Unchecked rows of a folder newer than `sinceDateValue`, oldest first. Every
 * checked row has `spamCheckedAt`, so after the first sweep this only returns
 * mail that arrived since (served by idx_messages_account_folder_date).
 */
export async function listUncheckedSpamMessageIds(accountId: string, folderId: string, sinceDateValue: number, limit: number) {
  const db = await getAccountDb(accountId);
  const rows = db.prepare(`SELECT id FROM messages
    WHERE accountId = ? AND folderId = ? AND dateValue >= ? AND spamCheckedAt IS NULL AND COALESCE(deleted, 0) = 0
    ORDER BY dateValue ASC LIMIT ?`).all(accountId, folderId, sinceDateValue, limit) as Array<{ id: string }>;
  return rows.map((row) => row.id);
}

export type NewSpamExample = SpamExample & { messageId: string | null; source: string; decidedByUserId: string | null };

/** The latest decision per sender and subject wins; old examples are pruned per account. */
export async function saveSpamExample(accountId: string, example: NewSpamExample) {
  return withDbWriteRetry("saveSpamExample", async () => {
    const db = await getAccountDb(accountId);
    db.transaction(() => {
      db.prepare(`DELETE FROM spam_examples WHERE accountId = ? AND senderEmail IS ? AND subject = ?`)
        .run(accountId, example.senderEmail, example.subject);
      db.prepare(`INSERT INTO spam_examples
        (id, accountId, messageId, senderEmail, senderDomain, subject, snippet, label, source, decidedByUserId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(randomUUID(), accountId, example.messageId, example.senderEmail, example.senderDomain, example.subject,
          example.snippet, example.label, example.source, example.decidedByUserId, example.createdAt);
      db.prepare(`DELETE FROM spam_examples WHERE accountId = ? AND id IN (
        SELECT id FROM spam_examples WHERE accountId = ? ORDER BY createdAt DESC LIMIT -1 OFFSET ?)`)
        .run(accountId, accountId, EXAMPLES_PER_ACCOUNT);
    }).immediate();
  });
}

type ExampleRow = { id: string; senderEmail: string | null; senderDomain: string | null; subject: string; snippet: string; label: string; createdAt: number };
const exampleColumns = "id, senderEmail, senderDomain, subject, snippet, label, createdAt";

/** Candidate pool for ranking: same sender, same root domain, and the most recent decisions. */
export async function listSpamExampleCandidates(accountId: string, target: { senderEmail: string | null; senderDomain: string | null }): Promise<SpamExample[]> {
  const db = await getAccountDb(accountId);
  const rows = new Map<string, ExampleRow>();
  const add = (list: ExampleRow[]) => list.forEach((row) => rows.set(row.id, row));
  if (target.senderEmail) {
    add(db.prepare(`SELECT ${exampleColumns} FROM spam_examples WHERE accountId = ? AND senderEmail = ? ORDER BY createdAt DESC LIMIT ?`)
      .all(accountId, target.senderEmail, DOMAIN_CANDIDATES) as ExampleRow[]);
  }
  if (target.senderDomain) {
    add(db.prepare(`SELECT ${exampleColumns} FROM spam_examples WHERE accountId = ? AND senderDomain = ? ORDER BY createdAt DESC LIMIT ?`)
      .all(accountId, target.senderDomain, DOMAIN_CANDIDATES) as ExampleRow[]);
  }
  add(db.prepare(`SELECT ${exampleColumns} FROM spam_examples WHERE accountId = ? ORDER BY createdAt DESC LIMIT ?`)
    .all(accountId, RECENT_CANDIDATES) as ExampleRow[]);
  return [...rows.values()].filter((row) => row.label === "spam" || row.label === "ham").map((row) => ({
    senderEmail: row.senderEmail, senderDomain: row.senderDomain, subject: row.subject, snippet: row.snippet,
    label: row.label as SpamLabel, createdAt: row.createdAt
  }));
}

export async function getLatestSpamDecision(accountId: string, senderEmail: string): Promise<SpamLabel | null> {
  const db = await getAccountDb(accountId);
  const row = db.prepare(`SELECT label FROM spam_examples WHERE accountId = ? AND senderEmail = ? ORDER BY createdAt DESC LIMIT 1`)
    .get(accountId, senderEmail) as { label?: string } | undefined;
  return row?.label === "spam" || row?.label === "ham" ? row.label : null;
}

/** Whether the mailbox has written to `email` (exact To/Cc/Bcc entry of a Sent-folder message). */
export async function hasSentToAddress(accountId: string, sentFolderId: string, email: string) {
  return sentToAddressInDb(await getAccountDb(accountId), accountId, sentFolderId, email);
}

const profileColumns = "senderKey, count, firstSeenAt, lastSeenAt, lastUserSpamAt, patterns";

export async function getSenderProfile(accountId: string, senderKey: string): Promise<SenderProfile | null> {
  return readSenderProfile(await getAccountDb(accountId), accountId, senderKey);
}

function writeSenderProfile(db: any, accountId: string, profile: SenderProfile, now: number) {
  db.prepare(`INSERT INTO spam_sender_profiles (accountId, senderKey, count, firstSeenAt, lastSeenAt, lastUserSpamAt, patterns, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(accountId, senderKey) DO UPDATE SET count = excluded.count, firstSeenAt = excluded.firstSeenAt, lastSeenAt = excluded.lastSeenAt,
      lastUserSpamAt = excluded.lastUserSpamAt, patterns = excluded.patterns, updatedAt = excluded.updatedAt`)
    .run(accountId, profile.senderKey, profile.count, profile.firstSeenAt, profile.lastSeenAt, profile.lastUserSpamAt,
      serializeProfilePatterns(profile), now);
}

function readSenderProfile(db: any, accountId: string, senderKey: string) {
  const row = db.prepare(`SELECT ${profileColumns} FROM spam_sender_profiles WHERE accountId = ? AND senderKey = ?`)
    .get(accountId, senderKey) as SenderProfileRow | null;
  return row ? senderProfileFromRow(row) : null;
}

/**
 * Adds one checked mail to the sender's profile, once per message: a mail
 * checked again after a revocation or folded by a backfill catch-up is not
 * counted twice (read-modify-write in one immediate transaction).
 */
export async function recordSenderProfileMail(accountId: string, facts: SenderMailFacts, messageId: string) {
  return withDbWriteRetry("recordSenderProfileMail", async () => {
    const db = await getAccountDb(accountId);
    return db.transaction(() => {
      const profile = readSenderProfile(db, accountId, facts.senderKey);
      if (profile && hasProfileMail(profile, messageId)) return false;
      writeSenderProfile(db, accountId, foldSenderMail(profile, { ...facts, id: messageId }), Date.now());
      return true;
    }).immediate() as boolean;
  });
}

/**
 * A mail of a known sender went to Junk without a user decision (auto-move):
 * it counts into the junk share once. Unknown senders get no profile for it.
 */
export async function recordSenderProfileJunk(accountId: string, senderKey: string, messageId: string) {
  return withDbWriteRetry("recordSenderProfileJunk", async () => {
    const db = await getAccountDb(accountId);
    return db.transaction(() => {
      const profile = readSenderProfile(db, accountId, senderKey);
      if (!profile || !addProfileJunk(profile, messageId)) return false;
      writeSenderProfile(db, accountId, profile, Date.now());
      return true;
    }).immediate() as boolean;
  });
}

type StoredJunkKeys = Map<string, Set<string>>;

function readStoredJunkKeys(db: any, accountId: string): StoredJunkKeys {
  const rows = db.prepare(`SELECT ${profileColumns} FROM spam_sender_profiles WHERE accountId = ?`).all(accountId) as SenderProfileRow[];
  return new Map(rows.map((row) => [row.senderKey, new Set(senderProfileFromRow(row).junkMailIds)]));
}

/**
 * Writes a backfill: every profile of the account is replaced. A user's "Als
 * Spam" time already stored survives when the rebuilt profile has none. With
 * `junk`, mails counted as junk live while the backfill was building (stored
 * now, not before the build, and not in a Junk folder the build read) are
 * kept on top of the rebuilt junk count.
 */
function writeBackfill(db: any, accountId: string, profiles: Iterable<SenderProfile>,
  junk?: { before: StoredJunkKeys; builtIds: ReadonlyMap<string, readonly string[]> }) {
  const stored = new Map((db.prepare(`SELECT ${profileColumns} FROM spam_sender_profiles WHERE accountId = ?`).all(accountId) as SenderProfileRow[])
    .map((row) => [row.senderKey, senderProfileFromRow(row)]));
  const liveJunk = (senderKey: string) => {
    if (!junk) return [];
    const before = junk.before.get(senderKey);
    const built = new Set((junk.builtIds.get(senderKey) ?? []).map(profileMailKey));
    return (stored.get(senderKey)?.junkMailIds ?? []).filter((key) => !before?.has(key) && !built.has(key));
  };
  db.prepare(`DELETE FROM spam_sender_profiles WHERE accountId = ?`).run(accountId);
  const now = Date.now();
  let written = 0;
  for (const profile of profiles) {
    const extra = liveJunk(profile.senderKey);
    const userSpamAt = Math.max(profile.lastUserSpamAt ?? 0, stored.get(profile.senderKey)?.lastUserSpamAt ?? 0) || null;
    stored.delete(profile.senderKey);
    writeSenderProfile(db, accountId, { ...profile, lastUserSpamAt: userSpamAt, junkCount: profile.junkCount + extra.length,
      junkMailIds: [...profile.junkMailIds, ...extra].slice(-PROFILE_MAIL_IDS) }, now);
    written += 1;
  }
  for (const previous of stored.values()) {
    if (previous.lastUserSpamAt === null) continue;
    const kept = emptySenderProfile(previous.senderKey, previous.lastUserSpamAt);
    writeSenderProfile(db, accountId, { ...kept, lastUserSpamAt: previous.lastUserSpamAt, junkCount: previous.junkCount, junkMailIds: previous.junkMailIds }, now);
  }
  return written;
}

/** Backfill: replaces every profile of the account (see writeBackfill). */
export async function replaceSenderProfiles(accountId: string, profiles: Iterable<SenderProfile>) {
  return withDbWriteRetry("replaceSenderProfiles", async () => {
    const db = await getAccountDb(accountId);
    return db.transaction(() => writeBackfill(db, accountId, profiles)).immediate() as number;
  });
}

/** Catch-up passes before the backfill writes even though mail is still arriving. */
const BACKFILL_CATCH_UP_ROUNDS = 5;

/**
 * Backfill over the app connection: `build` reads the account's rows (with
 * `previous` only the rows stored since). Mail that arrives while it builds
 * is read in a catch-up pass before the write, so nothing learned live in the
 * meantime is lost; the write itself merges live junk counts and "Als Spam"
 * times (writeBackfill). Mails folded here and checked later are not counted
 * again (recordSenderProfileMail).
 */
export async function backfillSenderProfiles(accountId: string,
  build: (db: any, previous: AccountProfileBuild | null) => Promise<AccountProfileBuild>) {
  const db = await getAccountDb(accountId);
  const before = readStoredJunkKeys(db, accountId);
  let built = await build(db, null);
  for (let round = 1; ; round += 1) {
    const current = built;
    const written = await withDbWriteRetry("backfillSenderProfiles", async () => db.transaction(() => {
      const last = (db.prepare("SELECT COALESCE(MAX(rowid), 0) AS last FROM messages").get() as { last: number }).last;
      if (last !== current.lastRowid && round < BACKFILL_CATCH_UP_ROUNDS) return null;
      return writeBackfill(db, accountId, current.profiles.values(), { before, builtIds: current.junkIds });
    }).immediate() as number | null);
    if (written !== null) return { written, build: current };
    built = await build(db, current);
  }
}

/**
 * "Als Spam": the sender loses trust in every mailbox (household merge takes
 * the latest time). With `messageId` the mail also counts into the junk share
 * once.
 */
export async function markSenderProfileUserSpam(accountId: string, senderKey: string, at: number, messageId?: string) {
  return withDbWriteRetry("markSenderProfileUserSpam", async () => {
    const db = await getAccountDb(accountId);
    db.transaction(() => {
      const profile = readSenderProfile(db, accountId, senderKey) ?? emptySenderProfile(senderKey, at);
      profile.lastUserSpamAt = Math.max(profile.lastUserSpamAt ?? 0, at);
      if (messageId !== undefined) addProfileJunk(profile, messageId);
      writeSenderProfile(db, accountId, profile, Date.now());
    }).immediate();
  });
}

/** Rows a trusted-sender skip decided: their spamReasons start with "trusted:profile". */
const TRUSTED_SKIP_SQL = `spamReasons LIKE '["trusted:profile%'`;
const TRUST_CANARY_SQL = `spamReasons LIKE '["trusted:canary%'`;

/**
 * A row whose author is `senderKey` (spamSenderKey: IDNA and case normalised,
 * without display name), also for legacy rows that only carry fromAddr.
 */
const SENDER_ROW_SQL = `instr(lower(COALESCE(NULLIF(fromEmail, ''), fromAddr)), ?) > 0
  AND mailbox_address_in(COALESCE(NULLIF(fromEmail, ''), fromAddr), ?) = 1`;
// The ASCII local part is a cheap prefilter, so the exact check runs only on candidate rows.
const senderRowParams = (senderKey: string) => [senderKey.slice(0, senderKey.lastIndexOf("@") + 1), JSON.stringify([senderKey])];

/**
 * Revocation: the sender's INBOX rows skipped as trusted since `since` (check
 * time, not the sender's Date header) become unchecked again; returns their
 * ids for re-queueing.
 */
export async function resetTrustedSpamChecks(accountId: string, folderId: string, senderKey: string, since: number) {
  return withDbWriteRetry("resetTrustedSpamChecks", async () => {
    const db = await getAccountDb(accountId);
    const rows = db.prepare(`UPDATE messages SET spamVerdict = NULL, spamConfidence = NULL, spamReasons = NULL, spamCheckedAt = NULL
      WHERE accountId = ? AND folderId = ? AND spamCheckedAt >= ? AND ${TRUSTED_SKIP_SQL} AND ${SENDER_ROW_SQL}
      RETURNING id`).all(accountId, folderId, since, ...senderRowParams(senderKey)) as Array<{ id: string }>;
    return rows.map((row) => row.id);
  });
}

export type SenderMailNear = {
  id: string; dateValue: number; toAddr: string | null; ccAddr: string | null; hasSource: number | null; spamCheckedAt: number | null;
};

/**
 * Other mails of a sender in a folder for the burst rule: the `limit` rows
 * stored closest to `messageId` (rowid follows ingestion; the sender's Date
 * header can be anything). The caller derives each one's arrival.
 */
export async function listSenderMailsNear(accountId: string, folderId: string, senderKey: string, messageId: string, limit: number) {
  const db = await getAccountDb(accountId);
  const anchor = db.prepare(`SELECT rowid AS position FROM messages WHERE accountId = ? AND id = ?`).get(accountId, messageId) as { position: number } | null;
  return db.prepare(`SELECT id, dateValue, toAddr, ccAddr, hasSource, spamCheckedAt FROM messages
    WHERE accountId = ? AND folderId = ? AND id != ? AND COALESCE(deleted, 0) = 0 AND ${SENDER_ROW_SQL}
    ORDER BY abs(rowid - ?) LIMIT ?`)
    .all(accountId, folderId, messageId, ...senderRowParams(senderKey), anchor?.position ?? Number.MAX_SAFE_INTEGER, limit) as SenderMailNear[];
}

export type SpamTrustCounters = { trustedSkips: number; canaryChecks: number; canaryMismatches: number };

/** Read-only counters for the admin view, derived from the stored verdicts. */
export async function countSpamTrustDecisions(accountId: string): Promise<SpamTrustCounters> {
  const db = await getAccountDb(accountId);
  const row = db.prepare(`SELECT
      COALESCE(SUM(CASE WHEN ${TRUSTED_SKIP_SQL} THEN 1 ELSE 0 END), 0) AS trustedSkips,
      COALESCE(SUM(CASE WHEN ${TRUST_CANARY_SQL} THEN 1 ELSE 0 END), 0) AS canaryChecks,
      COALESCE(SUM(CASE WHEN ${TRUST_CANARY_SQL} AND spamVerdict != 'ham' THEN 1 ELSE 0 END), 0) AS canaryMismatches
    FROM messages WHERE accountId = ? AND spamVerdict IS NOT NULL`).get(accountId) as SpamTrustCounters;
  return { trustedSkips: row.trustedSkips, canaryChecks: row.canaryChecks, canaryMismatches: row.canaryMismatches };
}

export async function getSpamSettings(scope: string): Promise<unknown> {
  const db = await getDb();
  const row = db.prepare(`SELECT settings FROM spam_settings WHERE scope = ?`).get(scope) as { settings?: string } | undefined;
  if (!row?.settings) return null;
  try { return JSON.parse(row.settings); } catch { return null; }
}

export async function saveSpamSettings(scope: string, settings: object, userId: string) {
  return withDbWriteRetry("saveSpamSettings", async () => {
    const db = await getDb();
    db.prepare(`INSERT INTO spam_settings (scope, settings, updatedAt, updatedByUserId) VALUES (?, ?, ?, ?)
      ON CONFLICT(scope) DO UPDATE SET settings = excluded.settings, updatedAt = excluded.updatedAt, updatedByUserId = excluded.updatedByUserId`)
      .run(scope, JSON.stringify(settings), Date.now(), userId);
  });
}
