export const SHARD_FTS_TABLE = "message_fts_v3";
export const normalizeShardSql = (sql: string) => sql.replace(/IF NOT EXISTS/gi, "").replace(/[\s";]+/g, "").toLowerCase();

export const FTS_COLUMNS = "accountId, messageId, subject, fromAddr, toAddr, ccAddr, bccAddr, body, preview";
const identitySql = `CREATE TABLE message_fts_identity (
  ftsRowid INTEGER PRIMARY KEY AUTOINCREMENT,
  accountId TEXT NOT NULL,
  messageId TEXT NOT NULL,
  UNIQUE(accountId, messageId),
  FOREIGN KEY(accountId, messageId) REFERENCES messages(accountId, id) ON DELETE CASCADE
)`;
const ftsSql = `CREATE VIRTUAL TABLE ${SHARD_FTS_TABLE} USING fts5(
  accountId UNINDEXED, messageId UNINDEXED, subject, fromAddr, toAddr, ccAddr, bccAddr, body, preview)`;

/** Schema-only cold-open probe: no message traversal and no writer lock. */
export function ftsIdentitySchemaInstalled(db: any) {
  const shadows = db.prepare("SELECT name FROM pragma_table_list WHERE schema='main' AND type='shadow' AND name GLOB 'message_fts_v3_*'").all() as { name: string }[];
  if (!["data", "idx", "content", "docsize", "config"].every(suffix => shadows.some(row => row.name === `${SHARD_FTS_TABLE}_${suffix}`))) return false;
  return [["message_fts_identity", identitySql], [SHARD_FTS_TABLE, ftsSql]].every(([name, sql]) => {
    const actual = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(name);
    return actual && normalizeShardSql(actual.sql ?? "") === normalizeShardSql(sql);
  });
}

/** Read-only, including on an unmigrated shard. Never configures a connection. */
export function getFtsOrphanCount(db: any, table = "message_fts_v2"): number {
  if (!["message_fts", "message_fts_v2"].includes(table)) throw new Error("Unsupported historical FTS table");
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.length) return 0;
  const scoped = cols.some(column => column.name === "accountId");
  return Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table} f WHERE NOT EXISTS
    (SELECT 1 FROM messages m WHERE m.id=f.messageId${scoped ? " AND m.accountId=f.accountId" : ""})`).get().n);
}

/** Caller owns the transaction. Reconstruct exclusively from canonical messages. */
export function buildFtsIdentity(db: any) {
  db.exec(identitySql);
  db.exec(ftsSql);
  db.exec(`INSERT INTO message_fts_identity(accountId, messageId)
    SELECT accountId, id FROM messages ORDER BY accountId COLLATE BINARY, id COLLATE BINARY`);
  db.exec(`INSERT INTO ${SHARD_FTS_TABLE}(rowid, ${FTS_COLUMNS})
    SELECT i.ftsRowid, m.accountId, m.id, m.subject, m.fromAddr, m.toAddr,
      COALESCE(m.ccAddr, ''), COALESCE(m.bccAddr, ''), m.body, m.preview
    FROM message_fts_identity i JOIN messages m ON m.accountId=i.accountId AND m.id=i.messageId
    ORDER BY i.ftsRowid`);
  validateFtsIdentity(db);
}

/** Full validation for migration/explicit maintenance; never called on cold open. */
export function validateFtsIdentity(db: any) {
  const count = (table: string) => Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
  const messages = count("messages");
  if (count("message_fts_identity") !== messages || count(SHARD_FTS_TABLE) !== messages ||
    db.prepare(`SELECT 1 FROM messages m LEFT JOIN message_fts_identity i
      ON i.accountId=m.accountId AND i.messageId=m.id WHERE i.ftsRowid IS NULL LIMIT 1`).get() ||
    db.prepare(`SELECT 1 FROM message_fts_identity i LEFT JOIN messages m
      ON m.accountId=i.accountId AND m.id=i.messageId LEFT JOIN ${SHARD_FTS_TABLE} f ON f.rowid=i.ftsRowid
      WHERE m.id IS NULL OR f.rowid IS NULL OR f.accountId IS NOT i.accountId OR f.messageId IS NOT i.messageId LIMIT 1`).get() ||
    db.prepare(`SELECT 1 FROM ${SHARD_FTS_TABLE} f LEFT JOIN message_fts_identity i ON i.ftsRowid=f.rowid
      WHERE i.ftsRowid IS NULL LIMIT 1`).get() ||
    db.prepare(`SELECT 1 FROM message_fts_identity GROUP BY accountId,messageId HAVING COUNT(*)<>1 LIMIT 1`).get()) {
    throw new Error("Account shard FTS identity coverage is inconsistent");
  }
  db.exec(`INSERT INTO ${SHARD_FTS_TABLE}(${SHARD_FTS_TABLE}) VALUES('integrity-check')`);
  if (db.prepare("PRAGMA foreign_key_check").all().length) {
    throw new Error("Account shard migration could not preserve message ownership");
  }
}

export const DELETE_MESSAGE_FTS_SQL = `DELETE FROM ${SHARD_FTS_TABLE} WHERE rowid=(
  SELECT ftsRowid FROM message_fts_identity WHERE accountId=? AND messageId=?)`;

/** Prepared once per batch. A missing identity on an existing message is corruption. */
export function prepareFtsIdentityWriter(db: any) {
  const lookup = db.prepare("SELECT ftsRowid FROM message_fts_identity WHERE accountId=? AND messageId=?");
  const allocate = db.prepare("INSERT INTO message_fts_identity(accountId,messageId) VALUES(?,?) RETURNING ftsRowid");
  const remove = db.prepare(DELETE_MESSAGE_FTS_SQL);
  const insert = db.prepare(`INSERT INTO ${SHARD_FTS_TABLE}(rowid,${FTS_COLUMNS}) VALUES(?,?,?,?,?,?,?,?,?,?)`);
  return {
    remove,
    lookup(accountId: string, messageId: string, existing: boolean): number | undefined {
      const row = lookup.get(accountId, messageId) as { ftsRowid: number } | undefined;
      if (existing && !row) throw new Error("Missing FTS identity for existing message; explicit repair required");
      return row?.ftsRowid;
    },
    insert(accountId: string, messageId: string, rowid: number | undefined, text: string[]) {
      const id = rowid ?? (allocate.get(accountId, messageId) as { ftsRowid: number }).ftsRowid;
      insert.run(id, accountId, messageId, ...text);
    }
  };
}
