import { ftsIdentitySchemaInstalled, normalizeShardSql, SHARD_FTS_TABLE } from "./ftsIdentity";

/** Version 3 gives contentful FTS a stable, account-scoped integer identity. */
export const SHARD_FORMAT_VERSION = 3;
export { SHARD_FTS_TABLE } from "./ftsIdentity";
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
  db.function("noctua_writer_v2", () => 2);
  db.function("noctua_writer_v3", () => 3);
  registeredWriters.add(db);
}

function scopedTables(db: any): string[] {
  return (db.prepare(`SELECT m.name FROM pragma_table_list m
    WHERE m.schema = 'main' AND m.type = 'table' AND EXISTS
      (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'accountId')
    ORDER BY m.name`).all() as Array<{ name: string }>).map(row => row.name);
}

// Audited 26-table boundary plus the identity owner. Discovery below also
// protects future/custom account-scoped ordinary tables; a missing audited
// table must not make a damaged v3 schema look complete.
const requiredTables = [
  "attachments", "calendar_event_conflicts", "calendar_event_suppressions", "calendar_events",
  "calendar_participation_overrides", "calendar_reminders", "category_feedback_events",
  "category_model_state", "draft_tombstones", "folders", "mailbox_state", "mailbox_summary",
  "message_calendar_events", "message_fts_identity", "message_translations", "messages",
  "recipient_aliases", "sent_by", "thread_activity", "thread_collab_state", "thread_comments",
  "thread_signals", "thread_topics", "threads", "topic_learning_signals", "topic_signal_exclusions", "topics"
];
const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
function guards(db: any) {
  return scopedTables(db).flatMap(table => ["INSERT", "UPDATE", "DELETE"].map(operation => ({
    table, operation, name: `noctua_writer_v3_${table}_${operation.toLowerCase()}`
  })));
}
function guardSql({ table, operation, name }: { table: string; operation: string; name: string }) {
  return `CREATE TRIGGER ${quote(name)} BEFORE ${operation} ON ${quote(table)}
    BEGIN
      SELECT CASE WHEN noctua_writer_v3() IS NOT 3
        THEN RAISE(ABORT, 'Unsupported account shard writer') END;
    END;`;
}
export function shardWriterGuardsInstalled(db: any) {
  if (assertSupportedShardFormat(db) !== SHARD_FORMAT_VERSION) return false;
  const objects = new Map((db.prepare("SELECT name, type, sql FROM sqlite_master").all() as
    Array<{ name: string; type: string; sql: string | null }>).map(row => [row.name, row]));
  if (!requiredTables.every(table => objects.get(table)?.type === "table") || !ftsIdentitySchemaInstalled(db)) return false;
  for (const name of ["message_fts", "message_fts_v2"]) {
    const view = objects.get(name);
    if (view?.type !== "view" || normalizeShardSql(view.sql ?? "") !==
      normalizeShardSql(`CREATE VIEW ${name} AS SELECT rowid, * FROM ${SHARD_FTS_TABLE}`)) return false;
  }
  return ![...objects.keys()].some(name => name.startsWith("noctua_writer_v2_"))
    && guards(db).every(guard => {
      const actual = objects.get(guard.name);
      return actual?.type === "trigger" && normalizeShardSql(actual.sql ?? "") === normalizeShardSql(guardSql(guard));
    });
}

export function assertCompleteShardFormat(db: any) {
  if (assertSupportedShardFormat(db) === SHARD_FORMAT_VERSION && !shardWriterGuardsInstalled(db)) {
    throw new Error("Incomplete account shard format 3; explicit atomic repair required");
  }
}

/** Caller owns the immediate migration transaction and final version assignment. */
export function installShardWriterGuards(db: any) {
  const old = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name GLOB 'noctua_writer_v[23]_*'").all() as Array<{ name: string }>;
  for (const { name } of old) db.exec(`DROP TRIGGER ${quote(name)}`);
  for (const guard of guards(db)) db.exec(guardSql(guard));
}
