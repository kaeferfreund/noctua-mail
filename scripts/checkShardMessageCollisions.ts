/** Usage: bun scripts/checkShardMessageCollisions.ts /absolute/shard.db [...] */
import { Database } from "bun:sqlite";
import { realpathSync } from "node:fs";
import { getFtsOrphanCount } from "../lib/db/ftsIdentity";
import { getShardCollisionReport } from "../lib/db/shardCollisionReport";

const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error("Pass the existing shard file paths to inspect (read-only)");
for (const shardPath of new Set(paths.map(file => realpathSync(file)))) {
  const db = new Database(shardPath, { readonly: true });
  try {
    // Do not import the connection layer: this check must run before migration.
    const version = Number(db.prepare("PRAGMA user_version").get().user_version);
    const ftsOrphanCount = getFtsOrphanCount(db, version >= 2 ? "message_fts_v2" : "message_fts");
    console.info(JSON.stringify({ shardPath, shardVersion: version, ftsOrphanCount, ...getShardCollisionReport(db) }));
  } finally {
    db.close();
  }
}
