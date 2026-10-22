import { assertSupportedShardFormat, installShardWriterGuards, shardWriterGuardsInstalled } from "./shardFormat";

/**
 * Shard identities include accountId. Row ids remain stable for API URLs and
 * account-scoped source/attachment files; RFC Message-ID stays in messageId.
 * Never join or mutate message/thread dependents by the local id alone.
 */
export const ACCOUNT_KEY_TABLE_SQL = {
  messages: `CREATE TABLE IF NOT EXISTS messages (
      id TEXT NOT NULL,
      accountId TEXT NOT NULL,
      folderId TEXT NOT NULL,
      threadId TEXT NOT NULL,
      parentId TEXT,
      messageId TEXT,
      inReplyTo TEXT,
      "references" TEXT,
      xForwardedMessageId TEXT,
      xComposeFormat TEXT,
      quotedHtmlEdited INTEGER DEFAULT 0,
      subject TEXT NOT NULL,
      fromAddr TEXT NOT NULL,
      fromEmail TEXT,
      replyToAddr TEXT,
      toAddr TEXT NOT NULL,
      ccAddr TEXT,
      bccAddr TEXT,
      mailboxPath TEXT,
      imapUid INTEGER,
      pendingMoveSourceFolderId TEXT,
      pendingMoveSourceMailboxPath TEXT,
      pendingMoveSourceUid INTEGER,
      pendingMoveStartedAt INTEGER,
      preview TEXT NOT NULL,
      date TEXT NOT NULL,
      dateValue INTEGER NOT NULL,
      body TEXT NOT NULL,
      htmlBody TEXT,
      priority TEXT,
      hasSource INTEGER DEFAULT 0,
      unread INTEGER DEFAULT 0,
      flags TEXT,
      seen INTEGER DEFAULT 0,
      answered INTEGER DEFAULT 0,
      flagged INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      draft INTEGER DEFAULT 0,
      recent INTEGER DEFAULT 0,
      category TEXT,
      categoryScore REAL,
      categorySignals TEXT,
      categoryManualState TEXT,
      listId TEXT,
      sizeBytes INTEGER,
      listUnsubscribe TEXT,
      deliveredTo TEXT,
      originalTo TEXT,
      senderIdentityId TEXT,
      PRIMARY KEY (accountId, id)
    );`,
  attachments: `CREATE TABLE IF NOT EXISTS attachments (
      id TEXT NOT NULL,
      accountId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      filename TEXT NOT NULL,
      contentType TEXT NOT NULL,
      size INTEGER NOT NULL,
      inline INTEGER NOT NULL,
      cid TEXT,
      url TEXT,
      PRIMARY KEY (accountId, messageId, id),
      FOREIGN KEY(accountId, messageId) REFERENCES messages(accountId, id) ON DELETE CASCADE
    );`,
  message_translations: `CREATE TABLE IF NOT EXISTS message_translations (
      accountId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      targetLang TEXT NOT NULL,
      format TEXT NOT NULL,
      marker TEXT,
      translatedText TEXT NOT NULL,
      detectedSourceLang TEXT,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (accountId, messageId, targetLang, format),
      FOREIGN KEY(accountId, messageId) REFERENCES messages(accountId, id) ON DELETE CASCADE
    );`,
  message_calendar_events: `CREATE TABLE IF NOT EXISTS message_calendar_events (
      accountId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      eventUid TEXT NOT NULL,
      eventUidKey TEXT,
      eventFirstStartAtMs INTEGER,
      eventLastEndAtMs INTEGER,
      inviteActionType TEXT,
      processedAtMs INTEGER,
      processedByUserId TEXT,
      processedAutomatically INTEGER,
      unprocessedReason TEXT,
      snapshotJson TEXT,
      snapshotVersion INTEGER,
      PRIMARY KEY (accountId, messageId, eventUid),
      FOREIGN KEY(accountId, messageId) REFERENCES messages(accountId, id) ON DELETE CASCADE
    );`,
  threads: `CREATE TABLE IF NOT EXISTS threads (
      threadId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      rootMessageId TEXT,
      latestMessageId TEXT,
      latestDateValue INTEGER,
      latestReceivedDateValue INTEGER,
      messageCount INTEGER,
      unreadCount INTEGER,
      PRIMARY KEY (accountId, threadId)
    );`,
  thread_topics: `CREATE TABLE IF NOT EXISTS thread_topics (
      threadId TEXT NOT NULL,
      topicId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      assignedAt INTEGER NOT NULL,
      PRIMARY KEY (accountId, threadId, topicId)
    );`
} as const;

type TableName = keyof typeof ACCOUNT_KEY_TABLE_SQL;
type TableColumn = { name: string; pk: number };
const primaryKeys: Record<TableName, string[]> = {
  messages: ["accountId", "id"],
  attachments: ["accountId", "messageId", "id"],
  message_translations: ["accountId", "messageId", "targetLang", "format"],
  message_calendar_events: ["accountId", "messageId", "eventUid"],
  threads: ["accountId", "threadId"],
  thread_topics: ["accountId", "threadId", "topicId"]
};
const tableNames = Object.keys(primaryKeys) as TableName[];
function columns(db: any, table: string): TableColumn[] {
  return db.prepare(`PRAGMA table_info("${table}")`).all() as TableColumn[];
}
function hasAccountMessageForeignKey(db: any, table: TableName) {
  const keys = db.prepare(`PRAGMA foreign_key_list("${table}")`).all() as
    Array<{ id: number; table: string; from: string; to: string; on_delete: string }>;
  return keys.some(key => key.table === "messages" && key.from === "accountId" && key.to === "accountId"
    && key.on_delete === "CASCADE" && keys.some(other => other.id === key.id
      && other.from === "messageId" && other.to === "id"));
}
function needsRebuild(db: any, table: TableName) {
  const actual = columns(db, table).filter(column => column.pk).sort((a, b) => a.pk - b.pk).map(column => column.name);
  return actual.join(",") !== primaryKeys[table].join(",") ||
    (["attachments", "message_translations", "message_calendar_events"].includes(table)
      && !hasAccountMessageForeignKey(db, table));
}

/**
 * SQLite's table-rebuild procedure requires foreign_keys OFF outside a
 * transaction, otherwise dropping the old parent cascades into its children.
 * All copies, swaps, index restoration and FTS rebuild happen under one writer
 * lock, with foreign_key_check before commit. An error rolls the whole change
 * back and restores the connection's original foreign-key setting.
 */
export function ensureAccountKeySchema(db: any) {
  assertSupportedShardFormat(db);
  const ftsNeedsRebuild = () => !columns(db, "message_fts").some(column => column.name === "accountId");
  if (!tableNames.some(table => needsRebuild(db, table)) && !ftsNeedsRebuild() && shardWriterGuardsInstalled(db)) return;
  const foreignKeys = Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys);
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    if (Number(db.prepare("PRAGMA foreign_keys").get().foreign_keys) !== 0) {
      throw new Error("Account shard key migration must run outside a transaction");
    }
    db.transaction(() => {
      // Re-read after taking the writer lock: another process may have migrated.
      assertSupportedShardFormat(db);
      const tables = tableNames.filter(table => needsRebuild(db, table));
      const rebuildFts = tables.includes("messages") || ftsNeedsRebuild();
      for (const table of tables) {
        const indexes = db.prepare(`SELECT sql FROM sqlite_master
          WHERE type IN ('index', 'trigger') AND tbl_name = ? AND sql IS NOT NULL`).all(table) as Array<{ sql: string }>;
        const newTable = `${table}_account_key`;
        db.exec(ACCOUNT_KEY_TABLE_SQL[table].replace(`IF NOT EXISTS ${table}`, `IF NOT EXISTS ${newTable}`));
        const originalColumns = columns(db, table);
        const names = originalColumns.map(column => `"${column.name}"`);
        let select = names.map(name => `old.${name}`).join(", ");
        let from = `"${table}" old`;
        if (!originalColumns.some(column => column.name === "accountId")) {
          // Legacy child ownership is unambiguous: messages.id was globally unique.
          names.push('"accountId"');
          select += ", m.accountId";
          from += " JOIN messages m ON m.id = old.messageId";
        }
        db.exec(`INSERT INTO "${newTable}" (${names.join(", ")}) SELECT ${select} FROM ${from}`);
        const originalCount = db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count;
        const copiedCount = db.prepare(`SELECT COUNT(*) AS count FROM "${newTable}"`).get().count;
        if (originalCount !== copiedCount) throw new Error("Account shard migration could not preserve dependent rows");
        db.exec(`DROP TABLE "${table}"`);
        db.exec(`ALTER TABLE "${newTable}" RENAME TO "${table}"`);
        for (const index of indexes) db.exec(index.sql);
      }
      if (rebuildFts) {
        db.exec(`DROP TABLE message_fts;
          CREATE VIRTUAL TABLE message_fts USING fts5(accountId UNINDEXED, messageId UNINDEXED,
            subject, fromAddr, toAddr, ccAddr, bccAddr, body, preview);
          INSERT INTO message_fts (accountId, messageId, subject, fromAddr, toAddr, ccAddr, bccAddr, body, preview)
          SELECT accountId, id, subject, fromAddr, toAddr, COALESCE(ccAddr, ''), COALESCE(bccAddr, ''), body, preview
          FROM messages;`);
      }
      if (db.prepare("PRAGMA foreign_key_check").all().length) {
        throw new Error("Account shard migration could not preserve message ownership");
      }
      installShardWriterGuards(db);
    }).immediate();
  } finally {
    db.exec(`PRAGMA foreign_keys = ${foreignKeys}`);
  }
}
