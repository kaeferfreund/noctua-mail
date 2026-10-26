import { Database } from "bun:sqlite";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { withDbWriteRetry } from "../../dbWriteRetry";
import { getDataDir, getDefaultAccountDbPath } from "../../runtimePaths";
import { getExactMessageSourcePath } from "../../storage";
import { configureAccountDb } from "../connection";
import { mapAccountRow } from "../rowParsers";
import { assertSupportedShardFormat, SHARD_FORMAT_VERSION, shardWriterGuardsInstalled } from "../shardFormat";
import { checkLegacySourceOwnership, type LegacySourceSkipReason } from "./senderKey";

/**
 * Stamps `senderKey` and `sourceSha256` on rows ingested before the sync wrote
 * them (scripts/backfill-sender-keys.ts, doc/HTML-MAIL-PRIVACY.md). Only rows
 * where both columns are NULL and whose exact retained source passes
 * `checkLegacySourceOwnership` are written; nothing else in the row changes and
 * no IMAP connection is opened. The dry run uses read-only connections.
 * `--resync` re-fetches the remaining rows from IMAP instead
 * (lib/mail/senderKeyResync.ts).
 */

export const SENDER_KEY_BACKFILL_USAGE = `Usage: bun scripts/backfill-sender-keys.ts --data <data dir> [--account <accountId>] [--write]
       [--resync] [--batch <n>] [--limit <n>] [--out <report.json>]

Fills messages.senderKey and messages.sourceSha256 for rows synced before the
sync stored them, from the retained source under the row's exact id. A source
must match the row's byte size, Message-ID and From mailbox; other rows are
skipped. Default is a dry run (read-only). --write stamps in transactions of
--batch rows (default 500) while the app keeps running; --limit stops after n
examined rows. --out writes counts and the ids of skipped rows (outside the
data dir). Shards older than the app's format are refused, never migrated.

--resync handles the rows the retained source cannot: it fetches each one
read-only from IMAP by folder and UID (the mailbox credentials come from
main.db and need the service's IMAP_SECRET_KEY) and, with --write, re-ingests
it like the reader's "resync message" action. UIDs that are gone or now hold
another message are reported, never written. The dry run checks IMAP only.`;

export type SenderKeyBackfillArgs =
  | { kind: "help" }
  | { kind: "error"; message: string }
  | { kind: "run"; dataDir: string; account: string | null; write: boolean; resync: boolean; batch: number; limit: number | null;
      out: string | null };

const VALUE_OPTIONS = new Set(["--data", "--account", "--batch", "--limit", "--out"]);
const FLAGS = new Set(["--write", "--dry-run", "--resync"]);

function positiveInteger(value: string | undefined) {
  if (value === undefined) return undefined;
  return /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

export function parseSenderKeyBackfillArgs(argv: readonly string[]): SenderKeyBackfillArgs {
  if (argv.includes("--help") || argv.includes("-h")) return { kind: "help" };
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (FLAGS.has(option)) {
      flags.add(option);
    } else if (VALUE_OPTIONS.has(option)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) return { kind: "error", message: `${option} needs a value` };
      values.set(option, value);
      index += 1;
    } else {
      return { kind: "error", message: `Unknown option: ${option}` };
    }
  }
  const write = flags.has("--write");
  if (write && flags.has("--dry-run")) return { kind: "error", message: "--write and --dry-run exclude each other" };
  const data = values.get("--data");
  if (!data) return { kind: "error", message: "Pass --data <data dir> (the environment's NOCTUA_DATA_DIR is never used)" };
  const dataDir = path.resolve(data);
  const batch = positiveInteger(values.get("--batch"));
  const limit = positiveInteger(values.get("--limit"));
  if (batch === null) return { kind: "error", message: "--batch must be a positive integer" };
  if (limit === null) return { kind: "error", message: "--limit must be a positive integer" };
  const out = values.has("--out") ? path.resolve(values.get("--out")!) : null;
  if (out && !path.relative(dataDir, out).startsWith("..")) return { kind: "error", message: "--out must not point into the data dir" };
  return { kind: "run", dataDir, account: values.get("--account") ?? null, write, resync: flags.has("--resync"), batch: batch ?? 500,
    limit: limit ?? null, out };
}

export type SenderKeyLegacyCounts = {
  accountId: string;
  email: string;
  /** Null when the shard can be processed; otherwise why --write refuses to run. */
  refused: string | null;
  /** The account has no shard file yet (never synced): nothing to backfill. */
  missingShard: boolean;
  rows: number;
  /** Rows with senderKey NULL. */
  nullKey: number;
  /** Of those, rows the fixed writer already gave a digest (handled on open, not here). */
  withDigest: number;
  /** Rows with senderKey and sourceSha256 NULL: the backfill candidates. */
  legacy: number;
  legacyHasSource: number;
};

export type SenderKeyBackfillAccount = SenderKeyLegacyCounts & {
  examined: number;
  sourcePresent: number;
  withoutSource: number;
  accepted: number;
  skipped: Record<LegacySourceSkipReason, number>;
  /** Rows written; lower than `accepted` when a concurrent resync updated a row first. */
  stamped: number;
};

export type SenderKeyBackfillResult = {
  dataDir: string;
  write: boolean;
  accounts: SenderKeyBackfillAccount[];
  skippedRows: Array<{ accountId: string; id: string; reason: LegacySourceSkipReason }>;
  ms: number;
};

type CandidateRow = { id: string; messageId: string | null; fromAddr: string; sizeBytes: number | null };

/** Parallel source reads per batch; each source is dropped after its check. */
const READ_CONCURRENCY = 8;

function shardFile(dataDir: string, account: { id: string; dbPath: string | null }) {
  const file = account.dbPath?.trim() ? path.resolve(account.dbPath) : getDefaultAccountDbPath(account.id);
  const relative = path.relative(dataDir, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing: shard of ${account.id} lies outside ${dataDir}: ${file}`);
  }
  return file;
}

function schemaProblem(db: Database) {
  const version = assertSupportedShardFormat(db);
  if (version < SHARD_FORMAT_VERSION) {
    return `shard format ${version} is older than ${SHARD_FORMAT_VERSION} (start the deployed app once; this tool does not migrate)`;
  }
  if (!shardWriterGuardsInstalled(db)) return `incomplete shard format ${SHARD_FORMAT_VERSION}`;
  const columns = new Set((db.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string }>).map(column => column.name));
  if (!columns.has("senderKey") || !columns.has("sourceSha256")) return "messages.senderKey/sourceSha256 missing";
  return null;
}

async function readExactSource(accountId: string, id: string) {
  try {
    // Same decoding as getMessageSource, which the reader and the lazy backfill use.
    return await fs.readFile(getExactMessageSourcePath(accountId, id), "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Busy timeout of the read-only connections (the dry run reads while the app writes). */
const READER_BUSY_TIMEOUT_MS = 15_000;

/**
 * Read-only inspection of every target shard before anything is written:
 * main.db's accounts, shard location and format, and the legacy counts.
 * `close()` releases the read-only connections; `writer()` opens a shard with
 * the app's configuration (busy timeout, writer guards); `account()` maps the
 * main.db row read before (IMAP credentials decrypted with IMAP_SECRET_KEY).
 */
export function inspectSenderKeyLegacyRows(options: { dataDir: string; account?: string | null }) {
  const dataDir = path.resolve(options.dataDir);
  // Source paths and default shard paths come from the app's runtime paths.
  if (getDataDir() !== dataDir) throw new Error(`NOCTUA_DATA_DIR (${getDataDir()}) must equal --data (${dataDir})`);
  const mainFile = path.join(dataDir, "db", "main.db");
  if (!existsSync(mainFile)) throw new Error(`No main.db in ${dataDir}`);

  const main = new Database(mainFile, { readonly: true });
  main.exec(`PRAGMA busy_timeout = ${READER_BUSY_TIMEOUT_MS}`);
  const allAccounts = main.prepare("SELECT * FROM accounts ORDER BY id").all() as
    Array<{ id: string; email: string; dbPath: string | null } & Record<string, unknown>>;
  main.close();
  const targets = allAccounts.filter(account => !options.account || account.id === options.account);
  if (!targets.length) throw new Error(options.account ? `Account ${options.account} not found in ${dataDir}` : `No accounts in ${dataDir}`);

  const readers = new Map<string, Database>();
  const files = new Map<string, string>();
  const accounts: SenderKeyLegacyCounts[] = [];
  const close = () => {
    for (const reader of readers.values()) reader.close();
    readers.clear();
  };
  try {
    for (const account of targets) {
      const file = shardFile(dataDir, account);
      const counts: SenderKeyLegacyCounts = {
        accountId: account.id, email: account.email, refused: null, missingShard: false, rows: 0, nullKey: 0, withDigest: 0, legacy: 0,
        legacyHasSource: 0
      };
      accounts.push(counts);
      if (!existsSync(file)) {
        counts.missingShard = true;
        continue;
      }
      let reader = readers.get(file);
      if (!reader) {
        reader = new Database(file, { readonly: true });
        // The app may hold the write lock during a checkpoint; wait like its own connections.
        reader.exec(`PRAGMA busy_timeout = ${READER_BUSY_TIMEOUT_MS}`);
        readers.set(file, reader);
      }
      counts.refused = schemaProblem(reader);
      if (counts.refused) continue;
      files.set(account.id, file);
      Object.assign(counts, reader.prepare(`SELECT COUNT(*) AS rows,
          COALESCE(SUM(senderKey IS NULL), 0) AS nullKey,
          COALESCE(SUM(senderKey IS NULL AND sourceSha256 IS NOT NULL), 0) AS withDigest,
          COALESCE(SUM(senderKey IS NULL AND sourceSha256 IS NULL), 0) AS legacy,
          COALESCE(SUM(senderKey IS NULL AND sourceSha256 IS NULL AND hasSource = 1), 0) AS legacyHasSource
        FROM messages WHERE accountId = ?`).get(account.id) as Omit<SenderKeyLegacyCounts, "accountId" | "email" | "refused" | "missingShard">);
    }
  } catch (error) {
    close();
    throw error;
  }
  return {
    dataDir,
    accounts,
    /** The shard of a processable account, if any. */
    file: (accountId: string) => files.get(accountId),
    reader: (file: string) => readers.get(file),
    account: (accountId: string) => mapAccountRow(targets.find(account => account.id === accountId)),
    /** Throws before the first write when any target shard was refused. */
    assertWritable() {
      const refused = accounts.filter(counts => counts.refused);
      if (refused.length) throw new Error(`Refusing to write: ${refused.map(counts => `${counts.accountId}: ${counts.refused}`).join("; ")}`);
    },
    writer(file: string) {
      const db = new Database(file);
      configureAccountDb(db);
      return db;
    },
    close
  };
}

export async function runSenderKeyBackfill(options: {
  dataDir: string;
  account?: string | null;
  write: boolean;
  batch?: number;
  limit?: number | null;
  log?: (line: string) => void;
}): Promise<SenderKeyBackfillResult> {
  const started = performance.now();
  const log = options.log ?? (() => {});
  const batchSize = options.batch ?? 500;
  const inspection = inspectSenderKeyLegacyRows(options);
  const { dataDir } = inspection;
  try {
    const accounts: SenderKeyBackfillAccount[] = inspection.accounts.map(counts => ({
      ...counts, examined: 0, sourcePresent: 0, withoutSource: 0, accepted: 0,
      skipped: { size: 0, "message-id": 0, "no-sender-key": 0, sender: 0 }, stamped: 0
    }));
    if (options.write) {
      inspection.assertWritable();
      inspection.close();
    }

    const writers = new Map<string, Database>();
    const skippedRows: SenderKeyBackfillResult["skippedRows"] = [];
    let remaining = options.limit ?? Number.POSITIVE_INFINITY;
    try {
      for (const stats of accounts) {
        const file = inspection.file(stats.accountId);
        if (!file || remaining <= 0) continue;
        let db = options.write ? writers.get(file) : inspection.reader(file);
        if (!db) {
          db = inspection.writer(file);
          writers.set(file, db);
        }
        const select = db.prepare(`SELECT id, messageId, fromAddr, sizeBytes FROM messages
          WHERE accountId = ? AND senderKey IS NULL AND sourceSha256 IS NULL AND id > ? ORDER BY id LIMIT ?`);
        // Every predicate the check relied on must still hold when the row is written.
        const update = options.write ? db.prepare(`UPDATE messages SET senderKey = ?, sourceSha256 = ?
          WHERE accountId = ? AND id = ? AND senderKey IS NULL AND sourceSha256 IS NULL
            AND messageId IS ? AND fromAddr = ? AND sizeBytes IS ?`) : null;
        let after = "";
        for (let batchNumber = 1; remaining > 0; batchNumber += 1) {
          const batchStarted = performance.now();
          const rows = select.all(stats.accountId, after, Math.min(batchSize, remaining)) as CandidateRow[];
          if (!rows.length) break;
          after = rows[rows.length - 1].id;
          remaining -= rows.length;
          stats.examined += rows.length;
          const accepted: Array<{ row: CandidateRow; senderKey: string; sourceSha256: string }> = [];
          for (let start = 0; start < rows.length; start += READ_CONCURRENCY) {
            const chunk = rows.slice(start, start + READ_CONCURRENCY);
            const sources = await Promise.all(chunk.map(row => readExactSource(stats.accountId, row.id)));
            chunk.forEach((row, index) => {
              const source = sources[index];
              if (source === null) {
                stats.withoutSource += 1;
                return;
              }
              stats.sourcePresent += 1;
              const result = checkLegacySourceOwnership(row, source);
              if ("skip" in result) {
                stats.skipped[result.skip] += 1;
                skippedRows.push({ accountId: stats.accountId, id: row.id, reason: result.skip });
                return;
              }
              accepted.push({ row, ...result });
            });
          }
          stats.accepted += accepted.length;
          if (update && accepted.length) {
            const written = await withDbWriteRetry("backfillSenderKeys", () => db.transaction(() => {
              let changes = 0;
              for (const { row, senderKey, sourceSha256 } of accepted) {
                changes += update.run(senderKey, sourceSha256, stats.accountId, row.id, row.messageId, row.fromAddr, row.sizeBytes).changes;
              }
              return changes;
            }).immediate());
            stats.stamped += written;
          }
          if (options.write) {
            log(`${stats.accountId} batch ${batchNumber}: ${rows.length} examined, ${accepted.length} accepted, `
              + `${stats.stamped} stamped so far (${stats.examined}/${stats.legacy}), ${((performance.now() - batchStarted) / 1000).toFixed(1)} s`);
          }
        }
      }
    } finally {
      for (const writer of writers.values()) writer.close();
    }
    return { dataDir, write: options.write, accounts, skippedRows, ms: performance.now() - started };
  } finally {
    inspection.close();
  }
}

export function describeSenderKeyBackfillAccount(stats: SenderKeyBackfillAccount, write: boolean) {
  const label = `${stats.accountId} (${stats.email})`;
  if (stats.refused) return `${label}: refused — ${stats.refused}`;
  if (stats.missingShard) return `${label}: no shard file, nothing to backfill`;
  const skipped = Object.entries(stats.skipped).filter(([, count]) => count > 0).map(([reason, count]) => `${reason} ${count}`);
  return `${label}: ${stats.rows} rows, ${stats.nullKey} without sender key (${stats.legacy} legacy, ${stats.withDigest} with digest); `
    + `legacy: ${stats.legacyHasSource} hasSource, ${stats.examined} examined, ${stats.sourcePresent} source present, ${stats.withoutSource} without source; `
    + `ownership check: ${stats.accepted} ${write ? "accepted" : "would be stamped"}, `
    + `${stats.sourcePresent - stats.accepted} skipped${skipped.length ? ` (${skipped.join(", ")})` : ""}`
    + (write ? `; ${stats.stamped} stamped` : "");
}
