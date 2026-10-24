import { randomUUID } from "crypto";
import { withDbWriteRetry } from "../dbWriteRetry";
import type { SpamDecision, SpamExample, SpamLabel } from "../mail/spam/types";
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
 * Unchecked rows of a folder newer than `sinceDateValue`, newest first. Every
 * checked row has `spamCheckedAt`, so after the first sweep this only returns
 * mail that arrived since (served by idx_messages_account_folder_date).
 */
export async function listUncheckedSpamMessageIds(accountId: string, folderId: string, sinceDateValue: number, limit: number) {
  const db = await getAccountDb(accountId);
  const rows = db.prepare(`SELECT id FROM messages
    WHERE accountId = ? AND folderId = ? AND dateValue >= ? AND spamCheckedAt IS NULL AND COALESCE(deleted, 0) = 0
    ORDER BY dateValue DESC LIMIT ?`).all(accountId, folderId, sinceDateValue, limit) as Array<{ id: string }>;
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
