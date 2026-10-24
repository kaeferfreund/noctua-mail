// Opens a shard file through the app's configured account API (whatever source tree this copy lives in).
import { Database } from 'bun:sqlite';
import { statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { getDb, getAccountDb, closeAllDbConnections } from '../lib/db/connection';
import { validateFtsIdentity } from '../lib/db/ftsIdentity';
import { shardWriterGuardsInstalled } from '../lib/db/shardFormat';
import { persistAccountRow } from '../lib/db/rowParsers';
const file=path.resolve(process.argv[2]);const accounts=['synthetic-a','synthetic-b'];
const inspect=()=>{const ro=new Database(file,{readonly:true});const r={user_version:ro.query('PRAGMA user_version').get().user_version,schema_version:ro.query('PRAGMA schema_version').get().schema_version,
 sqlite_master_sha256:createHash('sha256').update(JSON.stringify(ro.query('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all())).digest('hex'),
 v3_guards:ro.query("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name GLOB 'noctua_writer_v3_*'").get().n,
 counts:ro.query('SELECT accountId,COUNT(*) n FROM messages GROUP BY accountId ORDER BY accountId').all(),integrity:ro.query('PRAGMA integrity_check').get().integrity_check};ro.close();return r;};
const before=inspect();
const master=await getDb();
for(const id of accounts){persistAccountRow(master,{id,name:'Synthetic migration',email:`${id}@example.test`,avatar:'S',dbPath:file,imap:{host:'127.0.0.1',port:3798,secure:false,user:'synthetic',password:''},smtp:{host:'127.0.0.1',port:3798,secure:false,user:'synthetic',password:''}} as any);master.query('UPDATE accounts SET dbPath=? WHERE id=?').run(file,id);}
const t0=performance.now();const db=await getAccountDb(accounts[0]);const openMs=performance.now()-t0;
validateFtsIdentity(db);const guardsOk=shardWriterGuardsInstalled(db);
const search=db.query("SELECT accountId,COUNT(*) n FROM message_fts_v3 WHERE message_fts_v3 MATCH 'selective' GROUP BY accountId ORDER BY accountId").all();
closeAllDbConnections();
const after=inspect();
console.log('OPEN',JSON.stringify({file:path.basename(file),before,after,openMs:Math.round(openMs*10)/10,guardsInstalled:guardsOk,ftsValidated:true,selectiveHits:search,migrated:before.user_version!==after.user_version||before.sqlite_master_sha256!==after.sqlite_master_sha256,bytes:statSync(file).size}));
