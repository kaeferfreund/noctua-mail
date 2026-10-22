import {Database} from 'bun:sqlite';import {writeFileSync} from 'node:fs';import {loadavg} from 'node:os';
const db=new Database('/tmp/perf-backlog/data/db/accounts/a0.db');const {configureAccountDb}=await import('/home/monkey/code/noctua-mail/wt-perf-backlog/lib/db/connection.ts');configureAccountDb(db);
const byId=new Map(db.prepare('SELECT rowid,messageId FROM message_fts_v2').all().map((r:any)=>[r.messageId,r.rowid]));
const rows=Array.from({length:200},(_,i)=>({id:'m'+i,rowid:byId.get('m'+i)}));if(rows.some(r=>!r.rowid))throw Error('missing synthetic row');
const out:any={load:loadavg(),timings:[]};
for(const mode of ['key','rowid']){const stmt=db.prepare(mode==='key'?`DELETE FROM message_fts_v2 WHERE accountId=? AND messageId=?`:`DELETE FROM message_fts_v2 WHERE rowid=?`);const times=[];for(let i=0;i<6;i++){db.exec('BEGIN IMMEDIATE');const start=performance.now();for(const r of rows)mode==='key'?stmt.run('a0',r.id):stmt.run(r.rowid);const elapsed=performance.now()-start;const remaining=db.prepare('SELECT count(*) n FROM message_fts_v2').get().n;if(remaining!==10800)throw Error('wrong delete count');db.exec('ROLLBACK');if(i)times.push(elapsed)}times.sort((a,b)=>a-b);out.timings.push({mode,ms:times[2],min:times[0],max:times.at(-1)})}
writeFileSync('/tmp/perf-backlog/fts-existing-results.json',JSON.stringify(out,null,2));db.close();
