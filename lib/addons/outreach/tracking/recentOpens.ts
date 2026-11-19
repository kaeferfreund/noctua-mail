import { createHmac, randomBytes } from "node:crypto";
import type { Database } from "bun:sqlite";

export const OPEN_DEDUP_MS = 60_000;
const MAX_RECENT_OPENS = 10_000;
const secret = randomBytes(32);

// With immediate truncation the persisted network cannot distinguish
// different clients on that network. Keep only process-keyed digests.
type RecentOpens = Map<string, { at: number; expires: number }>;
const caches = new WeakMap<Database, RecentOpens>();

export function recentOpenDigest(accountId: string, sendId: string, ip: string, userAgent: string | null, machine: number) {
  return createHmac("sha256", secret).update(JSON.stringify([accountId, sendId, ip, userAgent, machine])).digest("base64url");
}

export function isRecentOpen(db: Database, digest: string, at: number, now: number) {
  const recent = caches.get(db)?.get(digest);
  return Boolean(recent && recent.expires > now && Math.abs(recent.at - at) < OPEN_DEDUP_MS);
}

export function rememberRecentOpen(db: Database, digest: string, at: number, now: number) {
  let cache = caches.get(db);
  if (!cache) {
    cache = new Map();
    caches.set(db, cache);
  }
  cache.delete(digest);
  cache.set(digest, { at, expires: now + OPEN_DEDUP_MS });
  for (const [key, recent] of cache) {
    if (recent.expires > now && cache.size <= MAX_RECENT_OPENS) break;
    cache.delete(key);
  }
}
