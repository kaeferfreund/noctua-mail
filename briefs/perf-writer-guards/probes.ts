import {Database} from 'bun:sqlite';import {writeFileSync,rmSync,readFileSync} from 'node:fs';import {root,guards,load} from './common';
const {initAccountSchema}=await import(root+'/lib/db/schema.ts');const {configureAccountDb}=await import(root+'/lib/db/connection.ts');const {prepareAccountShardConnection}=await import(root+'/lib/db/shardFormat.ts');
function snapshot(d:any){return JSON.stringify(d.query("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name").all().map((r:any)=>[r.name,d.query('SELECT * FROM "'+r.name.replaceAll('"','""')+'"').all()]),(_,v)=>typeof v==='bigint'?String(v):v)}
const records=[];for(const mode of ['current','builtin','when','det','when_det','native','prepare','deadcase']){
 const path='/tmp/perf-guards/probe-'+mode+'.db';rmSync(path,{force:true});let d=new Database(path);configureAccountDb(d);initAccountSchema(d);
 const triggers=d.query("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'noctua_writer_v2_%'").all();
 const definitions=d.query("SELECT sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'noctua_writer_v2_%'").all();d.transaction(()=>{for(const t of triggers)d.exec(`DROP TRIGGER "${t.name}"`);})();
 d.exec("INSERT INTO mailbox_summary(accountId,lastSyncAt) VALUES ('synthetic',1)");
 const old=new Database(path);const stale=['INSERT INTO mailbox_summary(accountId,lastSyncAt) VALUES (\'stale\',1)','UPDATE mailbox_summary SET lastSyncAt=2','DELETE FROM mailbox_summary'].map(s=>old.prepare(s));
 d.transaction(()=>{for(const t of definitions)d.exec(t.sql);})();guards(d,mode);
 const fresh=new Database(path);const before=snapshot(d);const tables=d.query("SELECT DISTINCT tbl_name name FROM sqlite_master WHERE type='trigger' AND name LIKE 'noctua_writer_v2_%'").all();
 let prepFail=0,unexpected=[];for(const {name}of tables)for(const sql of [`INSERT INTO "${name}" DEFAULT VALUES`,`UPDATE "${name}" SET accountId=accountId`,`DELETE FROM "${name}"`]){try{fresh.prepare(sql);unexpected.push(sql)}catch(e){if(String(e).includes('no such function: noctua_writer_v2'))prepFail++;else unexpected.push(String(e))}}
 let staleFail=[];for(const s of stale){try{s.run();staleFail.push('MUTATED')}catch(e){staleFail.push(String(e))}}
 const sqls=["INSERT INTO mailbox_summary(accountId,lastSyncAt) VALUES('synthetic',3) ON CONFLICT(accountId) DO UPDATE SET lastSyncAt=excluded.lastSyncAt","INSERT OR REPLACE INTO mailbox_summary(accountId,lastSyncAt) VALUES('synthetic',4)","REPLACE INTO mailbox_summary(accountId,lastSyncAt) VALUES('synthetic',5)","INSERT OR IGNORE INTO mailbox_summary(accountId,lastSyncAt) VALUES('synthetic',6)","UPDATE OR REPLACE mailbox_summary SET lastSyncAt=7","DELETE FROM mailbox_summary WHERE 0",...['INSERT INTO message_fts(messageId,body) VALUES (\'synthetic\',\'body\')','UPDATE message_fts SET body=\'body\'','DELETE FROM message_fts']];
 let variantErrors=sqls.map(sql=>{try{fresh.prepare(sql);return {sql,error:'PREPARED'}}catch(e){return {sql,error:String(e)}}});
 const unchanged=before===snapshot(d);
 d.function('noctua_writer_v2',()=>1);let wrongMarker;try{d.query("UPDATE mailbox_summary SET lastSyncAt=9").run();wrongMarker='ACCEPTED'}catch(e){wrongMarker=String(e)}
 d.function('noctua_writer_v2',()=>2);let ftsV2;try{fresh.prepare("INSERT INTO message_fts_v2(messageId,body) VALUES('synthetic','direct')");ftsV2='PREPARED (same limitation as current)'}catch(e){ftsV2=String(e)}
 d.exec('PRAGMA user_version=3');const snap3=snapshot(d);let newer;try{prepareAccountShardConnection(d);newer='ACCEPTED'}catch(e){newer=String(e)}
 records.push({mode,load:load(),prepFail,total:tables.length*3,unexpected,staleFail,variantErrors,unchanged,wrongMarker,ftsV2,newer,newerUnchanged:snap3===snapshot(d)});fresh.close();old.close();d.close();
}
writeFileSync('/tmp/perf-guards/probes.json',JSON.stringify(records,null,2));console.log(JSON.stringify(records,null,2));
