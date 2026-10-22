import {writeFileSync} from 'node:fs';import {loadavg} from 'node:os';
process.env.NOCTUA_DATA_DIR='/tmp/perf-backlog/data';process.env.IMAP_SECRET_KEY='synthetic-perf-backlog-key-0123456789';
const root='/home/monkey/code/noctua-mail/wt-perf-backlog';
const {getAccountDb,closeAllDbConnections}=await import(root+'/lib/db/connection.ts');
const {recomputeThreadsForAccount,recomputeThreadsForAccountInternal}=await import(root+'/lib/db/threads.ts');
const db=await getAccountDb('a0');db.prepare(`UPDATE messages SET fromEmail='sender@example.test' WHERE accountId='a0'`).run();
const out:any={load:loadavg(),timings:[]};
for(const [label,fn] of [['public recompute one thread (all authors already canonical)',()=>recomputeThreadsForAccount('a0',['t0'])],['internal recompute one thread',()=>recomputeThreadsForAccountInternal('a0',['t0'])]] as const){await fn();let samples=[];for(let i=0;i<9;i++){const start=performance.now();await fn();samples.push(performance.now()-start)}samples.sort((a,b)=>a-b);out.timings.push({label,ms:samples[4],min:samples[0],max:samples.at(-1)})}writeFileSync('/tmp/perf-backlog/recompute-results.json',JSON.stringify(out,null,2));closeAllDbConnections();
