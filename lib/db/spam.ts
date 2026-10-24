import { randomUUID } from "crypto";
import { withDbWriteRetry } from "../dbWriteRetry";
import type { SpamDecision, SpamExample, SpamLabel } from "../mail/spam/types";
import {
  foldSenderMail,
  senderProfileFromRow,
  serializeProfilePatterns,
  type SenderMailFacts,
  type SenderProfile,
  type SenderProfileRow
} from "../mail/spam/senderProfile";
import { getAccountDb, getDb } from "./connection";
import { messageAuthorEmailSql } from "./ownAddressSql";
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
  const db = await getAccountDb(accountId);
  const row = db.prepare(`SELECT ${profileColumns} FROM spam_sender_profiles WHERE accountId = ? AND senderKey = ?`)
    .get(accountId, senderKey) as SenderProfileRow | null;
  return row ? senderProfileFromRow(row) : null;
}

function writeSenderProfile(db: any, accountId: string, profile: SenderProfile, now: number) {
  db.prepare(`INSERT INTO spam_sender_profiles (accountId, senderKey, count, firstSeenAt, lastSeenAt, lastUserSpamAt, patterns, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(accountId, senderKey) DO UPDATE SET count = excluded.count, firstSeenAt = excluded.firstSeenAt, lastSeenAt = excluded.lastSeenAt,
      lastUserSpamAt = excluded.lastUserSpamAt, patterns = excluded.patterns, updatedAt = excluded.updatedAt`)
    .run(accountId, profile.senderKey, profile.count, profile.firstSeenAt, profile.lastSeenAt, profile.lastUserSpamAt,
      serializeProfilePatterns(profile), now);
}

/** Adds one checked mail to the sender's profile (read-modify-write in one immediate transaction). */
export async function recordSenderProfileMail(accountId: string, facts: SenderMailFacts) {
  return withDbWriteRetry("recordSenderProfileMail", async () => {
    const db = await getAccountDb(accountId);
    db.transaction(() => {
      const row = db.prepare(`SELECT ${profileColumns} FROM spam_sender_profiles WHERE accountId = ? AND senderKey = ?`)
        .get(accountId, facts.senderKey) as SenderProfileRow | null;
      writeSenderProfile(db, accountId, foldSenderMail(row ? senderProfileFromRow(row) : null, facts), Date.now());
    }).immediate();
  });
}

/**
 * Backfill: replaces every profile of the account. A user's "Als Spam" time
 * already stored survives when the rebuilt profile has none.
 */
export async function replaceSenderProfiles(accountId: string, profiles: Iterable<SenderProfile>) {
  return withDbWriteRetry("replaceSenderProfiles", async () => {
    const db = await getAccountDb(accountId);
    let written = 0;
    db.transaction(() => {
      const kept = new Map((db.prepare(`SELECT senderKey, lastUserSpamAt FROM spam_sender_profiles WHERE accountId = ? AND lastUserSpamAt IS NOT NULL`)
        .all(accountId) as Array<{ senderKey: string; lastUserSpamAt: number }>).map((row) => [row.senderKey, row.lastUserSpamAt]));
      db.prepare(`DELETE FROM spam_sender_profiles WHERE accountId = ?`).run(accountId);
      const now = Date.now();
      for (const profile of profiles) {
        const userSpamAt = Math.max(profile.lastUserSpamAt ?? 0, kept.get(profile.senderKey) ?? 0) || null;
        kept.delete(profile.senderKey);
        writeSenderProfile(db, accountId, { ...profile, lastUserSpamAt: userSpamAt }, now);
        written += 1;
      }
      for (const [senderKey, lastUserSpamAt] of kept) {
        db.prepare(`INSERT INTO spam_sender_profiles (accountId, senderKey, count, firstSeenAt, lastSeenAt, lastUserSpamAt, patterns, updatedAt)
          VALUES (?, ?, 0, ?, ?, ?, '{}', ?)`).run(accountId, senderKey, lastUserSpamAt, lastUserSpamAt, lastUserSpamAt, now);
      }
    }).immediate();
    return written;
  });
}

/** Backfill: `build` reads the account's rows over the app connection; the result replaces the stored profiles. */
export async function backfillSenderProfiles(accountId: string, build: (db: any) => Promise<Iterable<SenderProfile>>) {
  const profiles = await build(await getAccountDb(accountId));
  return replaceSenderProfiles(accountId, profiles);
}

/** "Als Spam": the sender loses trust in every mailbox (household merge takes the latest time). */
export async function markSenderProfileUserSpam(accountId: string, senderKey: string, at: number) {
  return withDbWriteRetry("markSenderProfileUserSpam", async () => {
    const db = await getAccountDb(accountId);
    db.prepare(`INSERT INTO spam_sender_profiles (accountId, senderKey, count, firstSeenAt, lastSeenAt, lastUserSpamAt, patterns, updatedAt)
      VALUES (?, ?, 0, ?, ?, ?, '{}', ?)
      ON CONFLICT(accountId, senderKey) DO UPDATE SET lastUserSpamAt = MAX(COALESCE(lastUserSpamAt, 0), excluded.lastUserSpamAt), updatedAt = excluded.updatedAt`)
      .run(accountId, senderKey, at, at, at, Date.now());
  });
}

/** Rows a trusted-sender skip decided: their spamReasons start with "trusted:profile". */
const TRUSTED_SKIP_SQL = `spamReasons LIKE '["trusted:profile%'`;
const TRUST_CANARY_SQL = `spamReasons LIKE '["trusted:canary%'`;

/**
 * A row whose author is `senderKey` (spamSenderKey: IDNA and case normalised,
 * without display name), also for legacy rows that only carry fromAddr.
 */
const SENDER_ROW_SQL = `mailbox_address_in(COALESCE(NULLIF(fromEmail, ''), fromAddr), ?) = 1`;
const senderRowParam = (senderKey: string) => JSON.stringify([senderKey]);

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
      RETURNING id`).all(accountId, folderId, since, senderRowParam(senderKey)) as Array<{ id: string }>;
    return rows.map((row) => row.id);
  });
}

/** Other mails of a sender in a folder within `windowMs` of `date` (burst rule): date and To/Cc. */
export async function listSenderMailsAround(accountId: string, folderId: string, senderKey: string, date: number, windowMs: number, excludeId: string) {
  const db = await getAccountDb(accountId);
  return db.prepare(`SELECT id, dateValue, toAddr, ccAddr FROM messages
    WHERE accountId = ? AND folderId = ? AND dateValue BETWEEN ? AND ? AND id != ? AND COALESCE(deleted, 0) = 0
      AND ${messageAuthorEmailSql()} = ? LIMIT 50`)
    .all(accountId, folderId, date - windowMs, date + windowMs, excludeId, senderKey) as Array<{ id: string; dateValue: number; toAddr: string | null; ccAddr: string | null }>;
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
