import type { Database } from "bun:sqlite";
import type { Message } from "@/lib/data";
import { inspectSenderKeyLegacyRows, type SenderKeyLegacyCounts } from "@/lib/db";
import {
  drainImapConnectionPool,
  ImapUidValidityChangedError,
  inspectStoredMailboxCopies,
  isImapFallbackMessageId,
  type StoredMailboxCopyState
} from "@/lib/mail/imap";
import { buildFolderId } from "@/lib/mail/imap/_shared";
import { resyncImapMessageGuarded, resyncMessageDeps, type ResyncMessageDeps } from "@/lib/mail/resyncMessage";
import { assertImapSecretKeyConfigured } from "@/lib/secret";
import { getAccountById, getMessageById } from "@/lib/serverDb";

/**
 * `scripts/backfill-sender-keys.ts --resync`: the legacy rows (senderKey and
 * sourceSha256 NULL) the retained-source backfill could not stamp are fetched
 * again from IMAP by folder and UID. The dry run only reads: EXAMINE plus
 * envelope/header FETCH per folder, no shard writes. --write re-ingests every
 * row whose UID still holds the stored Message-ID through the reader's
 * "resync message" path (`resyncImapMessageGuarded`, mailbox opened with
 * EXAMINE), so the row ends up like a fresh sync: new source file,
 * sourceSha256, and the senderKey when the From header names one mailbox
 * (NULL otherwise, which the digest then marks as final).
 *
 * A UID only identifies a message under the UIDVALIDITY it was synced with:
 * folders without a stored `mailbox_state.uidValidity`, or whose server value
 * differs (at the check or at the fetch), are skipped as a whole. Rows without
 * a real Message-ID (the `imap-msg-<uid>` fallback) cannot be told apart from
 * another message on a reused UID and are only reported. The fetched message
 * must carry the row's Message-ID again, and the upsert re-checks inside its
 * write transaction that the row is still the same legacy row. Rows without an
 * IMAP location, in a mailbox the server refuses, whose UID is gone or now
 * holds another message are reported and left unchanged. Sequential, one IMAP
 * connection, app write retries: safe while the app and its mailbox watcher run.
 */

export type SenderKeyResyncOutcome =
  | "no-imap-location"
  | "no-message-id"
  | "uidvalidity-changed"
  | "mailbox-unavailable"
  | "gone"
  | "uid-mismatch"
  | "changed"
  | "no-sender-key";

export type SenderKeyResyncAccount = SenderKeyLegacyCounts & {
  examined: number;
  noImapLocation: number;
  /** Stored Message-ID is the UID fallback: never resynced. */
  noMessageId: number;
  /** In a folder without stored UIDVALIDITY or whose UIDVALIDITY changed. */
  uidValidityChanged: number;
  mailboxUnavailable: number;
  gone: number;
  uidMismatch: number;
  /** UID still holds the row's message: resynced with --write. */
  present: number;
  /** Of those, the From header yields no sender key: only sourceSha256 is set. */
  presentWithoutSenderKey: number;
  /** Rows a concurrent sync changed or removed before the resync's write transaction. */
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

/** IMAP seams, replaceable in tests. */
export type SenderKeyResyncDeps = {
  inspectStoredMailboxCopies: typeof inspectStoredMailboxCopies;
  resyncMessage: ResyncMessageDeps;
};
const defaultDeps: SenderKeyResyncDeps = { inspectStoredMailboxCopies, resyncMessage: resyncMessageDeps };

/** The selected row is unchanged and still legacy; evaluated inside the resync's write transaction. */
const STILL_LEGACY_SQL = `SELECT 1 FROM messages WHERE accountId = ? AND id = ? AND senderKey IS NULL
  AND sourceSha256 IS NULL AND messageId IS ? AND mailboxPath IS ? AND imapUid IS ?`;

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
  deps?: SenderKeyResyncDeps;
}): Promise<SenderKeyResyncResult> {
  const started = performance.now();
  const log = options.log ?? (() => {});
  const deps = options.deps ?? defaultDeps;
  const batchSize = options.batch ?? 500;
  // Decrypting the stored IMAP password needs the service's key.
  assertImapSecretKeyConfigured();
  const inspection = inspectSenderKeyLegacyRows(options);
  const { dataDir } = inspection;
  const accounts: SenderKeyResyncAccount[] = inspection.accounts.map(counts => ({
    ...counts, examined: 0, noImapLocation: 0, noMessageId: 0, uidValidityChanged: 0, mailboxUnavailable: 0, gone: 0, uidMismatch: 0, present: 0,
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
      const storedUidValidity = db.prepare(`SELECT uidValidity FROM mailbox_state WHERE accountId = ? AND folderId = ?`);
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
          if (isImapFallbackMessageId(row.messageId)) {
            stats.noMessageId += 1;
            report(row, "no-message-id");
            continue;
          }
          byMailbox.set(mailboxPath, [...(byMailbox.get(mailboxPath) ?? []), row as CandidateRow & { imapUid: number }]);
        }
        for (const [mailboxPath, mailboxRows] of [...byMailbox].sort(([a], [b]) => a.localeCompare(b))) {
          mailboxRows.sort((a, b) => a.imapUid - b.imapUid || a.id.localeCompare(b.id));
          const skipChangedUidValidity = (rows: CandidateRow[], reason: string) => {
            log(`${stats.accountId}: ${reason}, ${rows.length} rows left unchanged`);
            stats.uidValidityChanged += rows.length;
            for (const row of rows) report(row, "uidvalidity-changed");
          };
          const uidValidity = (storedUidValidity.get(stats.accountId, buildFolderId(stats.accountId, mailboxPath)) as
            { uidValidity: string | null } | null)?.uidValidity ?? null;
          if (uidValidity === null) {
            skipChangedUidValidity(mailboxRows, "no stored UIDVALIDITY for a mailbox");
            continue;
          }
          let states: Map<string, StoredMailboxCopyState>;
          try {
            states = await deps.inspectStoredMailboxCopies(account, mailboxPath, mailboxRows, { uidValidity, batch: FETCH_BATCH });
          } catch (error) {
            if (error instanceof ImapUidValidityChangedError) {
              skipChangedUidValidity(mailboxRows, "UIDVALIDITY of a mailbox changed");
              continue;
            }
            if (!isMailboxRefusal(error)) throw error;
            log(`${stats.accountId}: mailbox refused by the server, ${mailboxRows.length} rows left unchanged (${(error as Error).message})`);
            stats.mailboxUnavailable += mailboxRows.length;
            for (const row of mailboxRows) report(row, "mailbox-unavailable");
            continue;
          }
          // Set once a fetch sees another UIDVALIDITY: no later UID of the folder is trusted.
          let renumbered = false;
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
            if (renumbered) {
              stats.uidValidityChanged += 1;
              report(row, "uidvalidity-changed");
              continue;
            }
            // A concurrent sync may have refreshed, moved or removed the row
            // meanwhile: the write re-checks it under the shard's write lock.
            // The live row must still be the candidate (same folder, UID and Message-ID):
            // a moved or renumbered row is never resynced under the candidate's UID, so
            // the guarded resync never has to rewrite the stored UID before its checks.
            const existing = await getMessageById(stats.accountId, row.id) as (Message & { mailboxPath?: string | null }) | null;
            const unchanged = existing?.id === row.id && existing.imapUid === row.imapUid
              && existing.mailboxPath?.trim() === mailboxPath && existing.messageId === row.messageId;
            const result = unchanged
              ? await resyncImapMessageGuarded(account, existing, row.imapUid, {
                readOnly: true,
                uidValidity,
                messageId: row.messageId!,
                stillCurrent: shard => Boolean(shard.prepare(STILL_LEGACY_SQL)
                  .get(stats.accountId, row.id, row.messageId, row.mailboxPath, row.imapUid))
              }, undefined, deps.resyncMessage)
              : { outcome: "changed" as const };
            if (result.outcome !== "resynced") {
              // "gone" and "message-id-mismatch": the UID vanished or was reused after the check.
              if (result.outcome === "uidvalidity-changed") {
                log(`${stats.accountId}: UIDVALIDITY of a mailbox changed during the resync, its remaining rows are left unchanged`);
                renumbered = true;
                stats.uidValidityChanged += 1;
              } else if (result.outcome === "gone") { stats.gone += 1; stats.present -= 1; }
              else if (result.outcome === "message-id-mismatch") { stats.uidMismatch += 1; stats.present -= 1; }
              else stats.changed += 1;
              report(row, result.outcome === "message-id-mismatch" ? "uid-mismatch" : result.outcome);
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
    + `${stats.noMessageId} without Message-ID, ${stats.uidValidityChanged} in a mailbox with unknown or changed UIDVALIDITY, `
    + `${stats.mailboxUnavailable} in a refused mailbox, ${stats.gone} gone from IMAP, ${stats.uidMismatch} UID holds another message; `
    + `${stats.present} on IMAP (${stats.presentWithoutSenderKey} without sender key)`
    + (write ? `; ${stats.resynced} resynced, ${stats.stampedSenderKey} with sender key, ${stats.changed} changed meanwhile` : " would be resynced");
}
