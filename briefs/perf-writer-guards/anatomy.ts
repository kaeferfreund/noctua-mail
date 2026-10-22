import {Database} from 'bun:sqlite';import {appendFileSync} from 'node:fs';import {root,guards,measure,load} from './common';
const {initAccountSchema}=await import(root+'/lib/db/schema.ts');const {configureAccountDb}=await import(root+'/lib/db/connection.ts');
const modes=['none','current','builtin','when','det','when_det','native','prepare','deadcase'];
for(let rep=0;rep<9;rep++)for(const mode of rep%2?[...modes].reverse():modes){
 const db=new Database(':memory:');configureAccountDb(db);initAccountSchema(db);guards(db,mode);
 db.query("INSERT INTO messages(accountId,id,threadId,folderId,subject,fromAddr,toAddr,preview,date,dateValue,body) VALUES ('perf','m','t','perf:INBOX','Synthetic','sender@example.test','perf@example.test','','2026-10-22',1,'Synthetic')").run();
 let calls=0; mode!=='native'&&db.function('noctua_writer_v2',mode.includes('det')?{deterministic:true}:{},()=>2);
 const stmt=db.prepare("INSERT INTO messages(accountId,id,threadId,folderId,subject,fromAddr,toAddr,preview,date,dateValue,body) VALUES ('perf','m','t','perf:INBOX',?,'sender@example.test','perf@example.test','','2026-10-22',1,'Synthetic') ON CONFLICT(accountId,id) DO UPDATE SET subject=excluded.subject");
 const result=await measure(db,()=>db.transaction(()=>{for(let i=0;i<50000;i++)stmt.run('Synthetic '+i)})());
 mode!=='native'&&db.function('noctua_writer_v2',mode.includes('det')?{deterministic:true}:{},()=>{calls++;return 2});stmt.run('Synthetic probe');const r={rep,mode,flow:'minimal-upsert-50000',callsPerUpdate:calls,load:load(),...result};appendFileSync('/tmp/perf-guards/anatomy.jsonl',JSON.stringify(r)+'\n');console.log(JSON.stringify(r));db.close();
}
