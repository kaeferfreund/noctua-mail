import { Database } from 'bun:sqlite';
import { mkdirSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { initAccountSchema } from '../lib/db/schema';
import { configureAccountDb } from '../lib/db/connection';
mkdirSync('.tmp/migration',{recursive:true});
for(const kind of ['round7','legacy']) {
 const file=`.tmp/migration/${kind}-original.db`;rmSync(file,{force:true});const db=new Database(file);
 if(kind==='round7'){configureAccountDb(db);initAccountSchema(db);} else db.exec(readFileSync('lib/testFixtures/sharedShardLegacy.sql','utf8'));
 const insert=db.prepare(`INSERT INTO messages(id,accountId,folderId,threadId,messageId,subject,fromAddr,toAddr,preview,date,dateValue,body) VALUES(?,?,'INBOX',?,?,'Synthetic needle','sender@example.test','team@example.test','common preview','2026-01-01',1,?)`);
 db.transaction(()=>{for(let i=0;i<11000;i++){const account=i%2?'synthetic-a':'synthetic-b';const id=kind==='round7'?`shared-${Math.floor(i/2)}`:`legacy-${i}`;insert.run(id,account,`thread-${Math.floor(i/4)}`,`<rfc-${Math.floor(i/2)}@example.test>`,`${i%10===0?'selective ':''}common synthetic phrase ${i}`);}})();
 if(kind==='round7') {
  db.exec(`UPDATE messages SET senderKey=CASE WHEN dateValue=1 AND accountId='synthetic-a' THEN 'sender@example.test' ELSE NULL END,sourceSha256=CASE WHEN accountId='synthetic-a' THEN '${'a'.repeat(64)}' ELSE NULL END`);
  db.exec(`INSERT INTO message_fts_v2(messageId,accountId,subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview) SELECT id,accountId,subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview FROM messages`);
  db.exec(`INSERT INTO attachments(id,accountId,messageId,filename,contentType,size,inline) VALUES('same-attachment','synthetic-a','shared-0','Synthetic.pdf','application/pdf',1,0),('same-attachment','synthetic-b','shared-0','Synthetic.pdf','application/pdf',1,0)`);
 } else {
  db.exec(`INSERT INTO message_fts(messageId,subject,fromAddr,toAddr,body) SELECT id,subject,fromAddr,toAddr,body FROM messages`);
  db.exec(`INSERT INTO attachments(id,messageId,filename,contentType,size,inline) VALUES('synthetic-attachment','legacy-0','Synthetic.pdf','application/pdf',1,0)`);
 }
 console.log(JSON.stringify({kind,messages:db.query('SELECT COUNT(*) n FROM messages').get(),version:db.query('PRAGMA user_version').get()}));db.close();
 copyFileSync(file,`.tmp/migration/${kind}-copy.db`);
}
