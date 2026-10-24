import { Database } from 'bun:sqlite';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getDb, getAccountDb, closeAllDbConnections, closeAccountDbConnection } from '../lib/db/connection';
import { initMasterSchema } from '../lib/db/schema';
import { shardWriterGuardsInstalled } from '../lib/db/shardFormat';
import { validateFtsIdentity } from '../lib/db/ftsIdentity';
import { persistAccountRow } from '../lib/db/rowParsers';
import * as baselineQuery from './baseline-query';
import { prepareAccountShardConnection as oldPrepare } from './baseline-shardFormat';
import * as currentQuery from '../lib/db/messages/query';
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const rawHash=(file:string)=>hash(readFileSync(file));
const reports=[];
const cases=[{query:'selective',sql:'selective'},{query:'common',sql:'common'},{query:'"synthetic phrase"',sql:'"synthetic phrase"'},{query:'needle',fields:['subject'],sql:'subject:needle'},{query:'from:sender@example.test',sql:'fromAddr:sender'},{query:'zzznomatch',sql:'zzznomatch'}];
const accounts=['synthetic-a','synthetic-b'];
const master=await getDb();
const appResults=async (query:typeof currentQuery)=>{
 const output=[];
 for(const accountId of accounts)for(const c of cases)for(const page of [1,2]) {
  const params={accountId,page,pageSize:7,query:c.query,fields:c.fields,groupBy:'none'};
  output.push({params,messages:await query.listMessages(params),threads:await query.listThreads(params)});
 }
 return output;
};
for(const kind of ['round7','legacy']) {
 const original=path.resolve(`.tmp/migration/${kind}-original.db`),file=path.resolve(`.tmp/migration/${kind}-copy.db`);
 const sourceHash=rawHash(original);
 const retained=JSON.parse(readFileSync('.tmp/migration/retained-files.json','utf8'));
 const retainedHashes=retained.map((r:any)=>[r.relative,rawHash(path.join(process.env.NOCTUA_DATA_DIR!,r.relative))]);const beforeFileBytes=statSync(file).size;
 let db=new Database(file,{readonly:true});assert.equal(db.query('PRAGMA integrity_check').get().integrity_check,'ok');
 const beforeVersion=db.query('PRAGMA user_version').get().user_version;
 const beforeCounts=db.query('SELECT accountId,COUNT(*) n FROM messages GROUP BY accountId ORDER BY accountId').all();
 const originalCols=db.query('PRAGMA table_info(messages)').all().map((r:any)=>'"'+r.name+'"').join(',');
 const beforeMessageHash=hash(db.query(`SELECT ${originalCols} FROM messages ORDER BY accountId,id`).all());
 const beforeSamples=db.query(`SELECT accountId,id,${kind==='round7'?'senderKey,sourceSha256':'NULL senderKey,NULL sourceSha256'} FROM messages ORDER BY accountId,id`).all();
 const beforeAttachments=db.query('SELECT * FROM attachments ORDER BY messageId,id').all();
 const table=kind==='round7'?'message_fts_v2':'message_fts';
 const sqlResults=(db:any,table:string)=>cases.slice(0,4).map(c=>({query:c.query,rows:db.query(`SELECT m.accountId,m.id AS messageId FROM messages m WHERE ${table==='message_fts'?'m.id':'(m.accountId,m.id)'} IN (SELECT ${table==='message_fts'?'':'accountId,'}messageId FROM ${table} WHERE ${table} MATCH ?) ORDER BY m.accountId,m.id LIMIT 30 OFFSET 7`).all(c.sql)}));
 const beforeSql=sqlResults(db,table);
 const legacyBefore=new Map<string,any>();
 if(kind==='legacy')for(const accountId of accounts)for(const c of cases)for(const page of [1,2]){
  const q=c.sql;
  const where=`m.accountId=? AND m.id IN (SELECT messageId FROM message_fts WHERE message_fts MATCH ?)`;
  legacyBefore.set(JSON.stringify([accountId,c.query,page]),{total:db.query(`SELECT COUNT(*) n FROM messages m WHERE ${where}`).get(accountId,q).n,ids:db.query(`SELECT m.id FROM messages m WHERE ${where} ORDER BY m.dateValue DESC LIMIT 7 OFFSET ?`).all(accountId,q,(page-1)*7).map((r:any)=>r.id)});
 }
 db.close();
 // Step 3 is the actual CLI, raw readonly and marker-free.
 const inventory=Bun.spawnSync([process.execPath,'scripts/checkShardMessageCollisions.ts',file],{env:process.env});
 assert.equal(inventory.exitCode,0);const inventoryReport=JSON.parse(inventory.stdout.toString().trim());console.log('INVENTORY',inventory.stdout.toString().trim());
 const row=Array.isArray(inventoryReport)?inventoryReport[0]:inventoryReport;
 assert.equal(row.ftsOrphanCount,0);
 for(const id of accounts)persistAccountRow(master,{id,name:'Synthetic migration',email:`${id}@example.test`,avatar:'S',dbPath:file,imap:{host:'127.0.0.1',port:3798,secure:false,user:'synthetic',password:''},smtp:{host:'127.0.0.1',port:3798,secure:false,user:'synthetic',password:''}} as any);
 // persistAccountRow does not own storage mapping: set it explicitly in the master.
 for(const id of accounts)master.query('UPDATE accounts SET dbPath=? WHERE id=?').run(file,id);
 let beforeApp:unknown;
 if(kind==='round7') {db=new Database(file);(globalThis as any).__migrationDb=db;beforeApp=await appResults(baselineQuery as any);db.close();}
 // Step 4: whole configured first open, account API; fixture generation excluded.
 const started=performance.now();db=await getAccountDb(accounts[0]);const durationMs=performance.now()-started;
 // Step 5.1 version, schema, exact guards, old views; raw readonly inspection first.
 let ro=new Database(file,{readonly:true});assert.equal(ro.query('PRAGMA user_version').get().user_version,3);assert(shardWriterGuardsInstalled(ro));
 const guards=ro.query("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'noctua_writer_v3_*'").get().n;assert.equal(guards,81);
 assert.equal(ro.query("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'noctua_writer_v2_*'").get().n,0);
 for(const name of ['message_fts','message_fts_v2'])assert.equal(ro.query('SELECT type FROM sqlite_master WHERE name=?').get(name).type,'view');
 for(const index of ['idx_messages_account_folder_messageid','idx_messages_account_msgid_date','idx_messages_account_folder_unread'])assert(ro.query("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(index));
 const schema={messages:ro.query('PRAGMA table_info(messages)').all(),identity:ro.query('PRAGMA table_info(message_fts_identity)').all(),fk:ro.query('PRAGMA foreign_key_list(message_fts_identity)').all()};ro.close();
 // Step 5.2 counts, full bijection and writable FTS integrity command.
 assert.deepEqual(db.query('SELECT accountId,COUNT(*) n FROM messages GROUP BY accountId ORDER BY accountId').all(),beforeCounts);validateFtsIdentity(db);
 // Step 5.3 SQL and application scoped search, totals and page boundaries.
 const afterSql=sqlResults(db,'message_fts_v3');
 if(kind==='round7'){assert.deepEqual(afterSql,beforeSql);assert.deepEqual(await appResults(currentQuery),beforeApp);}else {
  assert.deepEqual(afterSql,beforeSql);
  for(const accountId of accounts)for(const c of cases)for(const page of [1,2]){
   const result=await currentQuery.listMessages({accountId,page,pageSize:7,query:c.query,fields:c.fields,groupBy:'none'});
   const scopedSql=db.query(`SELECT messageId FROM message_fts_v3 WHERE message_fts_v3 MATCH ? AND accountId=? ORDER BY messageId`).all(c.sql,accountId);
   assert.equal(result.total,scopedSql.length,JSON.stringify({accountId,c,page}));assert(result.items.every((item:any)=>item.accountId===accountId));
   const before=legacyBefore.get(JSON.stringify([accountId,c.query,page]));assert.equal(result.total,before.total);assert.deepEqual(result.items.map((r:any)=>r.id),before.ids);
  }
 }
 // Step 5.4 preservation before message-reader hydration; list queries don't hydrate source.
 assert.deepEqual(db.query('SELECT accountId,id,senderKey,sourceSha256 FROM messages ORDER BY accountId,id').all(),beforeSamples);
 assert.equal(hash(db.query(`SELECT ${originalCols} FROM messages ORDER BY accountId,id`).all()),beforeMessageHash);
 const afterAttachments=db.query('SELECT * FROM attachments ORDER BY messageId,id').all();
 if(kind==='round7')assert.deepEqual(afterAttachments,beforeAttachments);else {assert.equal(afterAttachments.length,1);assert.equal(afterAttachments[0].accountId,'synthetic-b');assert.equal(afterAttachments[0].filename,'Synthetic.pdf');}
 assert.deepEqual(db.query('PRAGMA foreign_key_check').all(),[]);
 // Old v2 writer and raw legacy writer cannot mutate migrated messages.
 const old=new Database(file);assert.throws(()=>oldPrepare(old),/format 3 is newer than supported format 2/);old.function('noctua_writer_v2',()=>2);
 assert.throws(()=>old.query("DELETE FROM messages WHERE id='shared-0'").run(),/noctua_writer_v3/);
 for(const oldName of ['message_fts','message_fts_v2'])assert.throws(()=>old.exec(`DELETE FROM ${oldName}`),/view/);old.close();
 const sv=db.query('PRAGMA schema_version').get().schema_version;for(let reopen=0;reopen<2;reopen++){closeAccountDbConnection(file);const reopened=await getAccountDb(accounts[1]);assert.equal(reopened.query('PRAGMA schema_version').get().schema_version,sv);validateFtsIdentity(reopened);}closeAccountDbConnection(file);
 assert.equal(rawHash(original),sourceHash);
 assert.deepEqual(retained.map((r:any)=>[r.relative,rawHash(path.join(process.env.NOCTUA_DATA_DIR!,r.relative))]),retainedHashes);
 for(const r of retained)assert.equal(rawHash(path.join('.tmp/migration/retained-original',r.relative)),rawHash(path.join(process.env.NOCTUA_DATA_DIR!,r.relative))); 
 const report={kind,beforeVersion,afterVersion:3,messages:11000,accounts:2,guards,durationMs,searchComparisons:kind==='round7'?48:24,inventory:row,sourceUnchanged:true,beforeFileBytes,afterFileBytes:statSync(file).size,schema};reports.push(report);console.log('MIGRATION PASS',JSON.stringify({...report,schema:undefined}));
}
// Round-6 fresh and old master checks run in fresh processes with isolated roots.
for(const kind of ['fresh','older']){const result=Bun.spawnSync([process.execPath,'.tmp/master-gate.ts',kind],{env:process.env,stdout:'pipe',stderr:'pipe'});process.stdout.write(result.stdout);if(result.exitCode!==0)throw Error(result.stderr.toString());}
writeFileSync('.tmp/migration-results.json',JSON.stringify(reports,null,2));closeAllDbConnections();
