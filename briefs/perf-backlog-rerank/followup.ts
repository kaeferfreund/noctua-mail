import {Database} from 'bun:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadavg} from 'node:os';
process.env.NOCTUA_DATA_DIR='/tmp/perf-backlog/data';
process.env.IMAP_SECRET_KEY='synthetic-perf-backlog-key-0123456789';
const root='/home/monkey/code/noctua-mail/wt-perf-backlog';
const {configureAccountDb,configureDb}=await import(root+'/lib/db/connection.ts');
const {remapThreadCollab}=await import(root+'/lib/db/threadCollab.ts');
const db=new Database('/tmp/perf-backlog/data/db/accounts/a0.db');configureAccountDb(db);
const master=new Database('/tmp/perf-backlog/data/db/main.db');configureDb(master,0);
const base=JSON.parse(readFileSync('/tmp/perf-backlog/sql-results.json','utf8'));
const original=base.plans.find((x:any)=>x.label==='actual list SQL'&&x.sql.includes('flaggedThreads'));
const candidate=`SELECT t.*, t.latestReceivedDateValue as effectiveThreadDateValue FROM threads t WHERE t.accountId=? AND EXISTS (SELECT 1 FROM messages m WHERE m.accountId=t.accountId AND m.threadId=t.threadId AND COALESCE(m.deleted,0)=0) ORDER BY EXISTS (SELECT 1 FROM messages f WHERE f.accountId=t.accountId AND f.threadId=t.threadId AND f.flagged=1 AND COALESCE(f.deleted,0)=0) DESC,t.latestReceivedDateValue DESC LIMIT ? OFFSET ?`;
const out:any={timings:[],plans:[],loadStart:loadavg()};
function bench(label:string,fn:()=>any,n=9){fn();const times=[];let result;for(let i=0;i<n;i++){const s=performance.now();result=fn();times.push(performance.now()-s)}times.sort((a,b)=>a-b);out.timings.push({label,ms:times[Math.floor(n/2)],min:times[0],max:times.at(-1)});return result}
const old=bench('current thread selector',()=>db.prepare(original.sql).all(...original.args));
const changed=bench('EXISTS thread selector',()=>db.prepare(candidate).all('a0',300,0));
out.sameSelectorRows=JSON.stringify(old)===JSON.stringify(changed);
out.plans.push({label:'EXISTS thread selector',plan:db.prepare('EXPLAIN QUERY PLAN '+candidate).all('a0',300,0)});
// Benchmark every captured list SELECT separately to identify residual costs.
for(const q of base.plans.filter((x:any)=>x.label==='actual list SQL'&&x.sql.includes('messages'))){try{bench(q.sql.slice(0,110).replace(/\s+/g,' '),()=>db.prepare(q.sql).all(...q.args),5)}catch{}}
// Heavy collision of timestamps forces the incomplete ORDER BY key to sort.
bench('comments 1000 existing index',()=>db.prepare(`SELECT * FROM thread_comments WHERE accountId='a0' AND threadId='t0' AND deletedAt IS NULL ORDER BY createdAt,id`).all());
db.exec(`CREATE INDEX perf_comments_order ON thread_comments(accountId,threadId,createdAt,id) WHERE deletedAt IS NULL`);
bench('comments 1000 complete index',()=>db.prepare(`SELECT * FROM thread_comments WHERE accountId='a0' AND threadId='t0' AND deletedAt IS NULL ORDER BY createdAt,id`).all());
out.plans.push({label:'comments full order index',plan:db.prepare(`EXPLAIN QUERY PLAN SELECT * FROM thread_comments WHERE accountId='a0' AND threadId='t0' AND deletedAt IS NULL ORDER BY createdAt,id`).all()});
// Real remap with 1000 notes and 1000 activities, rollback restores identical inputs.
db.transaction(()=>{db.prepare(`INSERT INTO thread_collab_state(accountId,threadId,status,lastActivityAt,updatedAt,revision) VALUES('a0','old','open',0,0,1)`).run();db.prepare(`UPDATE thread_comments SET threadId='old' WHERE accountId='a0' AND threadId='t0'`).run();db.prepare(`UPDATE thread_activity SET threadId='old' WHERE accountId='a0' AND threadId='t0'`).run()})();
const pair=[{oldThreadId:'old',newThreadId:'t0',id:'synthetic',dateValue:0}];
const actualPrepare=db.prepare.bind(db);const cachedQuery=db.query.bind(db);
for(const mode of ['prepare','cache']){
 db.prepare=mode==='cache'?cachedQuery:actualPrepare;
 let samples=[],last:any;
 for(let i=0;i<8;i++){db.exec('BEGIN IMMEDIATE');const s=performance.now();const result=remapThreadCollab(db,'a0',pair);const ms=performance.now()-s;last={events:result,comments:db.query(`SELECT count(*) n, min(revision) r FROM thread_comments WHERE accountId='a0' AND threadId='t0'`).get(),activities:db.query(`SELECT count(*) n FROM thread_activity WHERE accountId='a0' AND threadId='t0'`).get()};db.exec('ROLLBACK');if(i)samples.push(ms)}samples.sort((a,b)=>a-b);out.timings.push({label:'real remap 1000 notes + 1000 activities '+mode,ms:samples[3],min:samples[0],max:samples.at(-1),last});
}
db.prepare=actualPrepare;
out.loadEnd=loadavg();writeFileSync('/tmp/perf-backlog/followup-results.json',JSON.stringify(out,null,2));db.close();master.close();
