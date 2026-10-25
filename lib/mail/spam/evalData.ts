import { Database, constants } from "bun:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Folder } from "@/lib/data";
import { buildOwnIdentitySets } from "./allowlist";

/**
 * Strictly read-only access to a Noctua data dir for the spam scripts
 * (spam-eval, spam-profiles-backfill --dry-run): every database is opened with
 * `mode=ro`. Unlike `immutable=1` it reads the WAL, so pages the live service
 * has not checkpointed yet are seen and a concurrent write cannot make the
 * file look malformed; it never writes the database or checkpoints the WAL.
 */
export function openReadOnly(file: string) {
  const flags = (constants as Record<string, number>).SQLITE_OPEN_READONLY | (constants as Record<string, number>).SQLITE_OPEN_URI;
  return new Database(`file:${encodeURI(file)}?mode=ro`, flags);
}

/** Deterministic PRNG for the eval samples (mulberry32). */
export function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded Fisher–Yates shuffle (a new array). */
export function seededShuffle<T>(items: readonly T[], seed: number) {
  const next = seededRandom(seed);
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

/**
 * The items of an eval run. `limit` > 0 takes a seeded random sample of that
 * size, so spam and ham keep their share of the full sample (which lists spam
 * first); `stratified` takes half spam and half ham instead.
 */
export function selectEvalItems<T extends { label: "spam" | "ham" }>(items: readonly T[], limit: number, stratified: boolean, seed = 42) {
  if (limit <= 0) return [...items];
  const shuffled = seededShuffle(items, seed);
  if (!stratified) return shuffled.slice(0, limit);
  const byLabel = (label: T["label"], count: number) => shuffled.filter((item) => item.label === label).slice(0, count);
  return [...byLabel("spam", Math.ceil(limit / 2)), ...byLabel("ham", Math.floor(limit / 2))];
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
