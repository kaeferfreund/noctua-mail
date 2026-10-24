import { Database, constants } from "bun:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Folder } from "@/lib/data";
import { buildOwnIdentitySets } from "./allowlist";

/**
 * Strictly read-only access to a Noctua data dir for the spam scripts
 * (spam-eval, spam-profiles-backfill --dry-run): every database is opened with
 * `immutable=1`, so a live data dir's locks and -wal/-shm files are never touched.
 */
export function openReadOnly(file: string) {
  const flags = (constants as Record<string, number>).SQLITE_OPEN_READONLY | (constants as Record<string, number>).SQLITE_OPEN_URI;
  return new Database(`file:${encodeURI(file)}?immutable=1`, flags);
}

export type SpamDataAccount = { id: string; email: string; dbPath: string | null };

export function openSpamDataDir(dataDir: string) {
  const main = openReadOnly(path.join(dataDir, "db", "main.db"));
  const accounts = main.prepare("SELECT id, email, dbPath FROM accounts").all() as SpamDataAccount[];
  const identities = main.prepare("SELECT email FROM sender_identities").all() as Array<{ email: string }>;
  main.close();
  const own = buildOwnIdentitySets([...accounts.map((account) => account.email), ...identities.map((identity) => identity.email)]);
  const shards = new Map<string, { db: Database; folders: Folder[] }>();
  return {
    accounts,
    own,
    sourcesDir: path.join(dataDir, "sources"),
    shard(accountId: string) {
      let entry = shards.get(accountId);
      if (!entry) {
        // The shard inside the given dir wins: a copied data dir keeps the original's absolute dbPath.
        const local = path.join(dataDir, "db", "accounts", `${accountId}.db`);
        const dbPath = accounts.find((candidate) => candidate.id === accountId)?.dbPath;
        const file = existsSync(local) || !dbPath || !existsSync(dbPath) ? local : dbPath;
        const db = openReadOnly(file);
        const folders = db.prepare("SELECT * FROM folders WHERE accountId = ?").all(accountId) as Folder[];
        entry = { db, folders };
        shards.set(accountId, entry);
      }
      return entry;
    },
    close() {
      for (const { db } of shards.values()) db.close();
      shards.clear();
    }
  };
}

/**
 * Every shard of the accounts to write must live inside the given data dir.
 * main.db stores absolute shard paths, so a copied data dir would otherwise
 * route writes into the original shards (verify-r2 R2).
 */
export function assertShardsInsideDataDir(accounts: { id: string; dbPath?: string | null }[], dataDir: string) {
  const path = require("node:path") as typeof import("node:path");
  const root = path.resolve(dataDir) + path.sep;
  const outside = accounts.filter((account) => {
    if (!account.dbPath) return false;
    const resolved = path.resolve(dataDir, account.dbPath);
    return !resolved.startsWith(root);
  });
  if (outside.length) {
    throw new Error(`Refusing to write: shard paths outside ${dataDir}: ${outside.map((account) => `${account.id} → ${account.dbPath}`).join(", ")}`);
  }
}
