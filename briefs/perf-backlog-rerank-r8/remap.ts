import {Database} from 'bun:sqlite';
import {writeFileSync} from 'node:fs';
import {loadavg} from 'node:os';
process.env.NOCTUA_DATA_DIR='/tmp/perf-rerank2/data';
process.env.IMAP_SECRET_KEY='synthetic-perf-backlog-key-0123456789';
const root='/home/monkey/code/noctua-mail/wt-perf-rerank2';
const {configureAccountDb}=await import(root+'/lib/db/connection.ts');
const {remapThreadCollab}=await import(root+'/lib/db/threadCollab.ts');
const db=new Database('/tmp/perf-rerank2/data/db/accounts/a0.db');configureAccountDb(db);
const out:any={timings:[],load:loadavg()};
// move t0 collab rows to 'old' once (committed), mirroring prior followup setup
const exists=db.prepare(`SELECT count(*) n FROM thread_collab_state WHERE accountId='a0' AND threadId='old'`).get() as any;
if(!exists.n){db.transaction(()=>{db.prepare(`INSERT INTO thread_collab_state(accountId,threadId,status,lastActivityAt,updatedAt,revision) VALUES('a0','old','open',0,0,1)`).run();db.prepare(`UPDATE thread_comments SET threadId='old' WHERE accountId='a0' AND threadId='t0'`).run();db.prepare(`UPDATE thread_activity SET threadId='old' WHERE accountId='a0' AND threadId='t0'`).run()})();}
const pair=[{oldThreadId:'old',newThreadId:'t0',id:'synthetic',dateValue:0}];
let samples=[],last:any;
for(let i=0;i<8;i++){db.exec('BEGIN IMMEDIATE');const s=performance.now();const result=remapThreadCollab(db,'a0',pair);const ms=performance.now()-s;last={events:result,comments:db.query(`SELECT count(*) n, min(revision) r FROM thread_comments WHERE accountId='a0' AND threadId='t0'`).get(),activities:db.query(`SELECT count(*) n FROM thread_activity WHERE accountId='a0' AND threadId='t0'`).get()};db.exec('ROLLBACK');if(i)samples.push(ms)}
samples.sort((a,b)=>a-b);out.timings.push({label:'real remap 1000 notes + 1000 activities (production code)',ms:samples[3],min:samples[0],max:samples.at(-1),last});
// residual listThreads statement breakdown: rerun captured plans from sql-results
writeFileSync('/tmp/perf-rerank2/remap-results.json',JSON.stringify(out,null,2));db.close();
console.log(JSON.stringify(out.timings));
