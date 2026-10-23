import { initAccountSchema } from "../db/schema";

/** Synthetic historical schema, never used on a user shard. */
export function createV2FtsShard(db: any) {
  initAccountSchema(db);
  const guards = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'noctua_writer_v3_%'").all() as Array<{ name: string; sql: string }>;
  db.transaction(() => {
    for (const { name } of guards) db.exec(`DROP TRIGGER "${name}"`);
    db.exec(`DROP VIEW message_fts; DROP VIEW message_fts_v2;
      DROP TABLE message_fts_identity;
      ALTER TABLE message_fts_v3 RENAME TO message_fts_v2;
      CREATE VIEW message_fts AS SELECT rowid,* FROM message_fts_v2;`);
    for (const guard of guards.filter(guard => !guard.name.includes("message_fts_identity"))) {
      db.exec(guard.sql.replaceAll("noctua_writer_v3", "noctua_writer_v2").replace("IS NOT 3", "IS NOT 2"));
    }
    db.exec(`PRAGMA user_version=2;
      INSERT INTO messages(id,accountId,folderId,threadId,messageId,subject,fromAddr,toAddr,preview,date,dateValue,body,senderKey,sourceSha256)
      VALUES ('same','b','INBOX','same-thread','<same@example.test>','Synthetic B','b@example.test','team@example.test','preview','2026-01-01',2,'beta café',NULL,NULL),
        ('same','a','INBOX','same-thread','<same@example.test>','Synthetic A','a@example.test','team@example.test','preview','2026-01-01',1,'alpha café','a@example.test','synthetic-digest');
      INSERT INTO attachments(accountId,messageId,id,filename,contentType,size,inline)
      VALUES('a','same','same-att','synthetic.pdf','application/pdf',10,0),('b','same','same-att','synthetic.pdf','application/pdf',10,0);
      INSERT INTO message_fts_v2(rowid,accountId,messageId,subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview)
      SELECT rowid+500000,accountId,id,subject,fromAddr,toAddr,'','',body,preview FROM messages;`);
  }).immediate();
}

export function shardSnapshot(db: any) {
  const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY name").all();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
  return { version: db.prepare("PRAGMA user_version").get(), schema,
    rows: tables.map(({ name }) => [name, db.prepare(`SELECT * FROM "${name}"`).all()]) };
}
