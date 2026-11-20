/**
 * One-time clean-up of rows and shard files left behind by mailboxes deleted before the
 * deletion path removed them (security fix 2026-11). An orphan is a mailbox id that still
 * has rows somewhere but no row in the master `accounts` table. A mailbox recreated for the
 * same address gets the same id and would inherit these rows.
 *
 *   bun scripts/purge-orphan-account-rows.ts [--data-dir <dir>] [--apply]
 *
 * Dry run by default: prints, per database, orphan id and table, the number of rows (ids and
 * counts only). `--apply` removes them with the helpers the deletion path uses, in one
 * transaction per database, deletes shard files in `db/accounts/` that no mailbox uses,
 * and scans again. Stop the service and take a backup first (doc/DEPLOYMENT.md).
 */
import { Database } from "bun:sqlite";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { getDataDir, getMainDbPath } from "../lib/runtimePaths";
import { ACCOUNT_KEYED_MASTER_TABLES, deleteAccountKeyedMasterRows } from "../lib/db/accountDeletion";
import { configureAccountDb, configureDb, purgeAccountRowsFromRetainedShard, removeDbFiles } from "../lib/db/connection";
import { resolveAccountDbPathForPersist } from "../lib/db/rowParsers";
import { ACCOUNT_SHARD_RUNTIME_TABLES, ACCOUNT_SHARD_TABLES, SHARD_FTS_TABLE } from "../lib/db/shardFormat";
import { getOutreachDb, getOutreachDbPath } from "../lib/addons/outreach/db";
import { outreachAccountTables, purgeOutreachAccount } from "../lib/addons/outreach/accountPurge";

/** accountId -> table -> rows */
export type OrphanRows = Record<string, Record<string, number>>;

export type ShardScan = {
  path: string;
  /** main: the master DB; referenced: a mailbox's shard; unreferenced: a file in db/accounts/ no mailbox uses. */
  role: "main" | "referenced" | "unreferenced";
  orphans: OrphanRows;
  /** Rows of mailboxes that still exist; an unreferenced file holding them is kept. */
  holdsLiveRows: boolean;
  /** Unreferenced, readable and without rows of an existing mailbox: deleted with --apply. */
  removable: boolean;
  error?: string;
};

export type OrphanScan = {
  dataDir: string;
  liveAccounts: number;
  master: OrphanRows;
  shards: ShardScan[];
  outreach: OrphanRows | null;
  /**
   * Mailboxes whose shard path lies outside the data dir. main.db stores absolute shard
   * paths, so on a copied data dir these point at the original files; --apply refuses.
   */
  shardsOutsideDataDir: string[];
};

const SHARD_TABLES = [...ACCOUNT_SHARD_TABLES, ...ACCOUNT_SHARD_RUNTIME_TABLES];
const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

function tableNames(db: Database) {
  return new Set((db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>)
    .map(row => row.name));
}

function addCount(target: OrphanRows, accountId: string, table: string, count: number) {
  if (!count) return;
  (target[accountId] ??= {})[table] = count;
}

/** Per-table row counts of every account id that is not a live mailbox. */
function countOrphansByTable(db: Database, tables: Iterable<string>, live: Set<string>, holdsLive?: () => void) {
  const orphans: OrphanRows = {};
  for (const table of tables) {
    const rows = db.query(`SELECT accountId, COUNT(*) AS n FROM ${quote(table)} GROUP BY accountId`).all() as
      Array<{ accountId: string; n: number }>;
    for (const row of rows) {
      if (live.has(row.accountId)) holdsLive?.();
      else addCount(orphans, row.accountId, table, row.n);
    }
  }
  return orphans;
}

function fileKey(file: string) {
  try {
    const stat = statSync(file);
    return stat.isFile() ? `${stat.dev}:${stat.ino}` : null;
  } catch {
    return null;
  }
}

function scanMaster(mainPath: string) {
  const db = new Database(mainPath, { readonly: true });
  try {
    const accounts = db.query("SELECT id, dbPath FROM accounts").all() as Array<{ id: string; dbPath: string | null }>;
    const live = new Set(accounts.map(row => row.id));
    const present = tableNames(db);
    const master = countOrphansByTable(db, ACCOUNT_KEYED_MASTER_TABLES.filter(table => present.has(table)), live);
    if (present.has("spam_rescan_items") && present.has("spam_rescan_jobs")) {
      const items = db.query(`SELECT j.accountId, COUNT(*) AS n FROM spam_rescan_items i
        JOIN spam_rescan_jobs j ON j.id = i.jobId GROUP BY j.accountId`).all() as Array<{ accountId: string; n: number }>;
      for (const row of items) if (!live.has(row.accountId)) addCount(master, row.accountId, "spam_rescan_items", row.n);
    }
    return { accounts, live, master };
  } finally {
    db.close();
  }
}

function scanShard(file: string, role: ShardScan["role"], live: Set<string>): ShardScan {
  const result: ShardScan = { path: file, role, orphans: {}, holdsLiveRows: false, removable: false };
  let db: Database | null = null;
  try {
    db = new Database(file, { readonly: true });
    const present = tableNames(db);
    result.orphans = countOrphansByTable(db, SHARD_TABLES.filter(table => present.has(table)), live,
      () => { result.holdsLiveRows = true; });
    if (present.has(SHARD_FTS_TABLE) && present.has("message_fts_identity")) {
      // The same rows purgeAccountRowsFromRetainedShard removes.
      const fts = db.query(`SELECT COUNT(*) AS n FROM ${SHARD_FTS_TABLE}
        WHERE rowid IN (SELECT ftsRowid FROM message_fts_identity WHERE accountId = ?)`);
      for (const accountId of Object.keys(result.orphans)) {
        addCount(result.orphans, accountId, SHARD_FTS_TABLE, (fts.get(accountId) as { n: number }).n);
      }
    }
    result.removable = role === "unreferenced" && !result.holdsLiveRows;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.orphans = {};
  } finally {
    db?.close();
  }
  return result;
}

function scanOutreach(live: Set<string>) {
  const file = getOutreachDbPath();
  if (!existsSync(file)) return null;
  const db = new Database(file, { readonly: true });
  try {
    return countOrphansByTable(db, outreachAccountTables(db), live);
  } finally {
    db.close();
  }
}

/** Read-only scan of the data directory the app uses (NOCTUA_DATA_DIR). */
export function scanOrphanAccountRows(): OrphanScan {
  const mainPath = getMainDbPath();
  if (!existsSync(mainPath)) throw new Error(`Master database not found: ${mainPath}`);
  const { accounts, live, master } = scanMaster(mainPath);

  // Every file a mailbox (or the master DB as shard) uses, then every *.db in db/accounts/,
  // each physical file once (device and inode, as areEquivalentDbPaths compares).
  const files = new Map<string, { path: string; role: ShardScan["role"] }>();
  const add = (file: string, role: ShardScan["role"]) => {
    const key = fileKey(file);
    if (key && !files.has(key)) files.set(key, { path: file, role });
  };
  add(mainPath, "main");
  const dataDir = path.resolve(getDataDir());
  const shardsOutsideDataDir: string[] = [];
  for (const account of accounts) {
    const file = path.resolve(dataDir, resolveAccountDbPathForPersist(account.id, account.dbPath));
    if (!file.startsWith(dataDir + path.sep)) {
      // Never read or write it: on a copy it is the original (possibly live) shard.
      shardsOutsideDataDir.push(account.id);
      continue;
    }
    add(file, "referenced");
  }
  const accountsDir = path.join(getDataDir(), "db", "accounts");
  if (existsSync(accountsDir)) {
    for (const name of readdirSync(accountsDir).filter(entry => entry.endsWith(".db")).sort()) {
      add(path.join(accountsDir, name), "unreferenced");
    }
  }
  const shards = [...files.values()].map(file => scanShard(file.path, file.role, live));
  return { dataDir: getDataDir(), liveAccounts: live.size, master, shards, outreach: scanOutreach(live), shardsOutsideDataDir };
}

const hasRows = (rows: OrphanRows | null) => Boolean(rows && Object.keys(rows).length);

/** Nothing left to remove (unreadable or kept files are only reported). */
export function isOrphanScanClean(scan: OrphanScan) {
  return !hasRows(scan.master) && !hasRows(scan.outreach)
    && scan.shards.every(shard => !hasRows(shard.orphans) && !shard.removable);
}

async function inTransaction(db: Database, run: () => Promise<void>) {
  db.exec("BEGIN IMMEDIATE");
  try {
    await run();
    db.exec("COMMIT");
  } catch (error) {
    if (db.inTransaction) db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Removes what `scan` found: master rows, shard rows (shared shards and kept files),
 * outreach rows, and unreferenced shard files. One transaction per database; a failing
 * database is reported and the others still run. Returns the failures.
 */
export async function applyOrphanPurge(scan: OrphanScan) {
  if (scan.shardsOutsideDataDir.length) {
    throw new Error(`Refusing to apply: shard paths outside ${scan.dataDir} for ${scan.shardsOutsideDataDir.join(", ")}`);
  }
  const failures: Array<{ target: string; error: unknown }> = [];
  const attempt = async (target: string, run: () => Promise<void>) => {
    try { await run(); } catch (error) { failures.push({ target, error }); }
  };

  const masterIds = Object.keys(scan.master);
  if (masterIds.length) {
    await attempt(getMainDbPath(), async () => {
      const db = new Database(getMainDbPath());
      try {
        configureDb(db);
        await inTransaction(db, async () => {
          for (const accountId of masterIds) {
            if (db.query("SELECT 1 FROM accounts WHERE id = ?").get(accountId)) {
              throw new Error(`Mailbox ${accountId} exists again; scan again before --apply`);
            }
            deleteAccountKeyedMasterRows(db, accountId);
          }
        });
      } finally {
        db.close();
      }
    });
  }

  for (const shard of scan.shards) {
    if (shard.removable) {
      await attempt(shard.path, () => removeDbFiles(shard.path));
      continue;
    }
    const ids = Object.keys(shard.orphans);
    if (!ids.length) continue;
    await attempt(shard.path, async () => {
      const db = new Database(shard.path);
      try {
        configureAccountDb(db);
        await inTransaction(db, async () => {
          for (const accountId of ids) await purgeAccountRowsFromRetainedShard(db, accountId);
        });
      } finally {
        db.close();
      }
    });
  }

  const outreachIds = Object.keys(scan.outreach ?? {});
  if (outreachIds.length) {
    await attempt(getOutreachDbPath(), async () => {
      const db = await getOutreachDb();
      await inTransaction(db, async () => {
        for (const accountId of outreachIds) await purgeOutreachAccount(accountId);
      });
    });
  }
  return failures;
}

function display(file: string, dataDir: string) {
  const relative = path.relative(dataDir, file);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? relative : file;
}

function formatRows(rows: OrphanRows) {
  return Object.keys(rows).sort().map(accountId => `  ${accountId}: ${Object.entries(rows[accountId])
    .sort(([left], [right]) => left.localeCompare(right)).map(([table, n]) => `${table}=${n}`).join(" ")}`);
}

/** The dry-run report: ids, tables and counts only. */
export function formatOrphanScan(scan: OrphanScan) {
  const lines = [`data dir: ${scan.dataDir} (${scan.liveAccounts} mailboxes)`];
  if (scan.shardsOutsideDataDir.length) {
    lines.push(`shard paths outside the data dir (copied data dir?), not scanned, --apply refused: ${scan.shardsOutsideDataDir.join(", ")}`);
  }
  if (hasRows(scan.master)) lines.push("master db/main.db:", ...formatRows(scan.master));
  for (const shard of scan.shards) {
    const name = display(shard.path, scan.dataDir);
    if (shard.error) lines.push(`shard ${name} (${shard.role}): not readable, skipped: ${shard.error}`);
    else if (shard.removable) lines.push(`orphan shard file ${name}: deleted with --apply`, ...formatRows(shard.orphans));
    else if (shard.role === "unreferenced") {
      lines.push(`unreferenced shard file ${name}: kept, holds rows of an existing mailbox`, ...formatRows(shard.orphans));
    } else if (hasRows(shard.orphans)) lines.push(`shard ${name} (${shard.role}):`, ...formatRows(shard.orphans));
  }
  if (hasRows(scan.outreach)) lines.push("outreach db/addons/outreach.db:", ...formatRows(scan.outreach!));
  if (isOrphanScanClean(scan)) lines.push("nothing to remove");
  return lines.join("\n");
}

function parseArgs(argv: string[]) {
  let dataDir: string | null = null;
  let apply = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--apply") apply = true;
    else if (arg === "--data-dir" && argv[index + 1]) dataDir = argv[++index];
    else if (arg.startsWith("--data-dir=")) dataDir = arg.slice("--data-dir=".length);
    else throw new Error(`Unknown argument: ${arg}\nUsage: bun scripts/purge-orphan-account-rows.ts [--data-dir <dir>] [--apply]`);
  }
  return { dataDir, apply };
}

async function main() {
  const { dataDir, apply } = parseArgs(process.argv.slice(2));
  if (dataDir) process.env.NOCTUA_DATA_DIR = path.resolve(dataDir);
  console.info("Stop the Noctua service and back up the data directory before --apply.");
  // Even a read-only open of a WAL database can leave -wal/-shm files owned by the caller;
  // owned by root, the service could no longer write its databases after the restart.
  const mainPath = getMainDbPath();
  const uid = process.getuid?.();
  if (uid !== undefined && existsSync(mainPath) && statSync(mainPath).uid !== uid) {
    console.error(`Run this as the owner of ${mainPath} (the service user), not as uid ${uid}.`);
    return 1;
  }
  const scan = scanOrphanAccountRows();
  console.info(formatOrphanScan(scan));
  if (!apply) {
    if (!isOrphanScanClean(scan)) console.info("dry run: nothing changed; rerun with --apply to remove");
    return 0;
  }
  if (isOrphanScanClean(scan)) return 0;
  const failures = await applyOrphanPurge(scan);
  for (const failure of failures) {
    console.error(`failed: ${display(failure.target, scan.dataDir)}: ${failure.error instanceof Error ? failure.error.message : String(failure.error)}`);
  }
  const after = scanOrphanAccountRows();
  console.info("after --apply:");
  console.info(formatOrphanScan(after));
  return failures.length || !isOrphanScanClean(after) ? 1 : 0;
}

if (import.meta.main) {
  main().then(code => process.exit(code), (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
