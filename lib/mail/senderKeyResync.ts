import type { Database } from "bun:sqlite";
import { inspectSenderKeyLegacyRows, type SenderKeyLegacyCounts } from "@/lib/db";
import { drainImapConnectionPool, inspectStoredMailboxCopies, type StoredMailboxCopyState } from "@/lib/mail/imap";
import { resyncImapMessageIntoDb } from "@/lib/mail/resyncMessage";
import { assertImapSecretKeyConfigured } from "@/lib/secret";
import { getAccountById, getMessageById } from "@/lib/serverDb";

/**
 * `scripts/backfill-sender-keys.ts --resync`: the legacy rows (senderKey and
 * sourceSha256 NULL) the retained-source backfill could not stamp are fetched
 * again from IMAP by folder and UID. The dry run only reads: EXAMINE plus
 * envelope/header FETCH per folder, no shard writes. --write re-ingests every
 * row whose UID still holds the stored Message-ID through
 * `resyncImapMessageIntoDb`, the reader's "resync message" action, so the row
 * ends up like a fresh sync: new source file, sourceSha256, and the senderKey
 * when the From header names one mailbox (NULL otherwise, which the digest
 * then marks as final). Rows without an IMAP location, in a mailbox the server
 * refuses, whose UID is gone or now holds another message are reported and
 * left unchanged. Sequential, one IMAP connection, app write retries:
 * safe while the app and its mailbox watcher run.
 */

export type SenderKeyResyncOutcome =
  | "no-imap-location"
  | "mailbox-unavailable"
  | "gone"
  | "uid-mismatch"
  | "changed"
  | "no-sender-key";

export type SenderKeyResyncAccount = SenderKeyLegacyCounts & {
  examined: number;
  noImapLocation: number;
  mailboxUnavailable: number;
  gone: number;
  uidMismatch: number;
  /** UID still holds the row's message: resynced with --write. */
  present: number;
  /** Of those, the From header yields no sender key: only sourceSha256 is set. */
  presentWithoutSenderKey: number;
  /** Rows a concurrent sync changed or removed between selection and resync. */
  changed: number;
  resynced: number;
  /** Resynced rows that now carry senderKey (the rest: sourceSha256 only). */
  stampedSenderKey: number;
};

export type SenderKeyResyncResult = {
  dataDir: string;
  write: boolean;
  resync: true;
  accounts: SenderKeyResyncAccount[];
  /** Every row not resynced with a sender key, with the reason. */
  reportedRows: Array<{ accountId: string; id: string; outcome: SenderKeyResyncOutcome; mailboxPath: string | null; imapUid: number | null }>;
  ms: number;
};

type CandidateRow = { id: string; messageId: string | null; mailboxPath: string | null; imapUid: number | null };

/** UIDs per IMAP FETCH of the read-only check. */
const FETCH_BATCH = 50;

/** IMAP NO responses (unknown or inaccessible mailbox) concern only that folder. */
function isMailboxRefusal(error: unknown) {
  return (error as { responseStatus?: string } | null)?.responseStatus === "NO";
}

export async function runSenderKeyResync(options: {
  dataDir: string;
  account?: string | null;
  write: boolean;
  batch?: number;
  limit?: number | null;
  log?: (line: string) => void;
}): Promise<SenderKeyResyncResult> {
  const started = performance.now();
  const log = options.log ?? (() => {});
  const batchSize = options.batch ?? 500;
  // Decrypting the stored IMAP password needs the service's key.
  assertImapSecretKeyConfigured();
  const inspection = inspectSenderKeyLegacyRows(options);
  const { dataDir } = inspection;
  const accounts: SenderKeyResyncAccount[] = inspection.accounts.map(counts => ({
    ...counts, examined: 0, noImapLocation: 0, mailboxUnavailable: 0, gone: 0, uidMismatch: 0, present: 0,
    presentWithoutSenderKey: 0, changed: 0, resynced: 0, stampedSenderKey: 0
  }));
  const reportedRows: SenderKeyResyncResult["reportedRows"] = [];
  const writers = new Map<string, Database>();
  try {
    if (options.write) {
      inspection.assertWritable();
      inspection.close();
    }
    let remaining = options.limit ?? Number.POSITIVE_INFINITY;
    for (const stats of accounts) {
      const file = inspection.file(stats.accountId);
      if (!file || remaining <= 0 || stats.legacy === 0) continue;
      let db = options.write ? writers.get(file) : inspection.reader(file);
      if (!db) {
        db = inspection.writer(file);
        writers.set(file, db);
      }
      // The write path goes through the app's DB layer like the reader's resync.
      const account = options.write ? await getAccountById(stats.accountId) : inspection.account(stats.accountId);
      if (!account) throw new Error(`Account ${stats.accountId} disappeared from main.db`);
      const select = db.prepare(`SELECT id, messageId, mailboxPath, imapUid FROM messages
        WHERE accountId = ? AND senderKey IS NULL AND sourceSha256 IS NULL AND id > ? ORDER BY id LIMIT ?`);
      const stillLegacy = db.prepare(`SELECT 1 FROM messages WHERE accountId = ? AND id = ? AND senderKey IS NULL
        AND sourceSha256 IS NULL AND messageId IS ? AND mailboxPath IS ? AND imapUid IS ?`);
      const stored = db.prepare(`SELECT senderKey, sourceSha256 FROM messages WHERE accountId = ? AND id = ?`);
      const report = (row: CandidateRow, outcome: SenderKeyResyncOutcome) =>
        reportedRows.push({ accountId: stats.accountId, id: row.id, outcome, mailboxPath: row.mailboxPath, imapUid: row.imapUid });

      let after = "";
      for (let batchNumber = 1; remaining > 0; batchNumber += 1) {
        const batchStarted = performance.now();
        const rows = select.all(stats.accountId, after, Math.min(batchSize, remaining)) as CandidateRow[];
        if (!rows.length) break;
        after = rows[rows.length - 1].id;
        remaining -= rows.length;
        stats.examined += rows.length;

        // One folder at a time, UIDs ascending.
        const byMailbox = new Map<string, Array<CandidateRow & { imapUid: number }>>();
        for (const row of rows) {
          const mailboxPath = row.mailboxPath?.trim();
          if (!mailboxPath || typeof row.imapUid !== "number" || !Number.isInteger(row.imapUid) || row.imapUid <= 0) {
            stats.noImapLocation += 1;
            report(row, "no-imap-location");
            continue;
          }
          byMailbox.set(mailboxPath, [...(byMailbox.get(mailboxPath) ?? []), row as CandidateRow & { imapUid: number }]);
        }
        for (const [mailboxPath, mailboxRows] of [...byMailbox].sort(([a], [b]) => a.localeCompare(b))) {
          mailboxRows.sort((a, b) => a.imapUid - b.imapUid || a.id.localeCompare(b.id));
          let states: Map<string, StoredMailboxCopyState>;
          try {
            states = await inspectStoredMailboxCopies(account, mailboxPath, mailboxRows, { batch: FETCH_BATCH });
          } catch (error) {
            if (!isMailboxRefusal(error)) throw error;
            log(`${stats.accountId}: mailbox refused by the server, ${mailboxRows.length} rows left unchanged (${(error as Error).message})`);
            stats.mailboxUnavailable += mailboxRows.length;
            for (const row of mailboxRows) report(row, "mailbox-unavailable");
            continue;
          }
          for (const row of mailboxRows) {
            const state = states.get(row.id)!;
            if (state.state !== "present") {
              if (state.state === "gone") stats.gone += 1;
              else stats.uidMismatch += 1;
              report(row, state.state === "gone" ? "gone" : "uid-mismatch");
              continue;
            }
            stats.present += 1;
            if (!state.senderKey) stats.presentWithoutSenderKey += 1;
            if (!options.write) {
              if (!state.senderKey) report(row, "no-sender-key");
              continue;
            }
            // A concurrent sync may have refreshed, moved or removed the row meanwhile.
            const existing = stillLegacy.get(stats.accountId, row.id, row.messageId, row.mailboxPath, row.imapUid)
              ? await getMessageById(stats.accountId, row.id)
              : null;
            const refreshed = existing?.id === row.id ? await resyncImapMessageIntoDb(account, existing, row.imapUid) : null;
            if (!refreshed) {
              stats.changed += 1;
              report(row, "changed");
              continue;
            }
            stats.resynced += 1;
            const columns = stored.get(stats.accountId, row.id) as { senderKey: string | null; sourceSha256: string | null } | null;
            if (columns?.senderKey) stats.stampedSenderKey += 1;
            else report(row, "no-sender-key");
          }
        }
        log(`${stats.accountId} batch ${batchNumber}: ${rows.length} examined, ${stats.present} on IMAP so far, `
          + `${options.write ? `${stats.resynced} resynced` : "dry run"} (${stats.examined}/${stats.legacy}), `
          + `${((performance.now() - batchStarted) / 1000).toFixed(1)} s`);
      }
    }
    return { dataDir, write: options.write, resync: true, accounts, reportedRows, ms: performance.now() - started };
  } finally {
    for (const writer of writers.values()) writer.close();
    inspection.close();
    // Close the script's own IMAP connection cleanly.
    await drainImapConnectionPool();
  }
}

export function describeSenderKeyResyncAccount(stats: SenderKeyResyncAccount, write: boolean) {
  const label = `${stats.accountId} (${stats.email})`;
  if (stats.refused) return `${label}: refused — ${stats.refused}`;
  if (stats.missingShard) return `${label}: no shard file, nothing to resync`;
  return `${label}: ${stats.legacy} legacy rows, ${stats.examined} examined; ${stats.noImapLocation} without IMAP location, `
    + `${stats.mailboxUnavailable} in a refused mailbox, ${stats.gone} gone from IMAP, ${stats.uidMismatch} UID holds another message; `
    + `${stats.present} on IMAP (${stats.presentWithoutSenderKey} without sender key)`
    + (write ? `; ${stats.resynced} resynced, ${stats.stampedSenderKey} with sender key, ${stats.changed} changed meanwhile` : " would be resynced");
}
