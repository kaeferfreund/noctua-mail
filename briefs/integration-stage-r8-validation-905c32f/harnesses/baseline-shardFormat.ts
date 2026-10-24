/** Version 2 makes the composite account keys incompatible with legacy writers. */
export const SHARD_FORMAT_VERSION = 2;
export const SHARD_FTS_TABLE = "message_fts_v2";
const registeredWriters = new WeakSet<object>();

export function assertSupportedShardFormat(db: any) {
  const version = Number(db.prepare("PRAGMA user_version").get().user_version);
  if (version > SHARD_FORMAT_VERSION) {
    throw new Error(`Account shard format ${version} is newer than supported format ${SHARD_FORMAT_VERSION}`);
  }
  return version;
}

/** Call before configuration or schema/data writes, including on cleanup handles. */
export function prepareAccountShardConnection(db: any) {
  assertSupportedShardFormat(db);
  if (registeredWriters.has(db)) return;
  // Persistent triggers cannot reference TEMP tables in SQLite. A connection-local
  // function gives the same fail-closed preparation error on an old connection.
  db.function("noctua_writer_v2", () => SHARD_FORMAT_VERSION);
  registeredWriters.add(db);
}

function scopedTables(db: any): string[] {
  return (db.prepare(`SELECT m.name FROM pragma_table_list m
    WHERE m.schema = 'main' AND m.type = 'table' AND EXISTS
      (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'accountId')
    ORDER BY m.name`).all() as Array<{ name: string }>).map(row => row.name);
}

function guards(db: any) {
  return scopedTables(db).flatMap(table => ["INSERT", "UPDATE", "DELETE"].map(operation => ({
    table, operation, name: `noctua_writer_v2_${table}_${operation.toLowerCase()}`
  })));
}

export function shardWriterGuardsInstalled(db: any) {
  if (assertSupportedShardFormat(db) !== SHARD_FORMAT_VERSION) return false;
  const objects = new Map((db.prepare("SELECT name, type FROM sqlite_master").all() as
    Array<{ name: string; type: string }>).map(row => [row.name, row.type]));
  return objects.get("message_fts") === "view" && objects.get(SHARD_FTS_TABLE) === "table"
    && guards(db).every(guard => objects.get(guard.name) === "trigger");
}

/** Must run in the same immediate transaction as the key/FTS rebuild. */
export function installShardWriterGuards(db: any) {
  const fts = db.prepare("SELECT type FROM sqlite_master WHERE name = 'message_fts'").get();
  if (fts?.type === "table") {
    // SQLite prohibits triggers on both virtual tables AND their shadow tables.
    // Reserve the legacy name as a read-only view; old CREATE IF NOT EXISTS is
    // harmless, and old INSERT/UPDATE/DELETE fail during statement preparation.
    db.exec(`ALTER TABLE message_fts RENAME TO ${SHARD_FTS_TABLE};
      CREATE VIEW message_fts AS SELECT rowid, * FROM ${SHARD_FTS_TABLE};`);
  }
  for (const { table, operation, name } of guards(db)) {
    const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
    db.exec(`CREATE TRIGGER IF NOT EXISTS ${quote(name)} BEFORE ${operation} ON ${quote(table)}
      BEGIN
        SELECT CASE WHEN noctua_writer_v2() IS NOT ${SHARD_FORMAT_VERSION}
          THEN RAISE(ABORT, 'Unsupported account shard writer') END;
      END;`);
  }
  db.exec(`PRAGMA user_version = ${SHARD_FORMAT_VERSION}`);
}
