import {writeFileSync} from 'node:fs';import {loadavg} from 'node:os';
process.env.NOCTUA_DATA_DIR='/tmp/perf-backlog/data';process.env.IMAP_SECRET_KEY='synthetic-perf-backlog-key-0123456789';
const root='/home/monkey/code/noctua-mail/wt-perf-backlog';
const {getDb,getAccountDb,closeAllDbConnections}=await import(root+'/lib/db/connection.ts');
const {getUserMailboxSummary}=await import(root+'/lib/mailboxSummary.ts');
const {listAccessibleAccountsForUser}=await import(root+'/lib/accountAccess.ts');
const {recomputeThreadsForAccountInternal}=await import(root+'/lib/db/threads.ts');
const master=await getDb();master.exec(`DROP INDEX perf_provisioning_user_state; DELETE FROM user_provisioning; DELETE FROM auth_user WHERE id NOT IN ('u0','u1')`);
const shards=[];
for(let i=0;i<12;i++){const d=await getAccountDb('a'+i);shards.push(d);if(i){d.prepare(`INSERT INTO folders(id,name,accountId,specialUse) VALUES(?,'Inbox',?,'\\Inbox')`).run('a'+i+':INBOX','a'+i);d.prepare(`INSERT INTO messages(id,accountId,folderId,threadId,messageId,subject,fromAddr,toAddr,preview,date,dateValue,body,deliveredTo,originalTo) VALUES('one',?,?,'one','<one@example.test>','Synthetic','sender@example.test','recipient@example.test','preview','2026-10-22',1790000000000,'Synthetic','[]','[]')`).run('a'+i,'a'+i+':INBOX');await recomputeThreadsForAccountInternal('a'+i)}await getAccountDb('a'+i);await getAccountDb('a'+i)}
let count=0,queries=0,enabled=false;
for(const d of [master,...shards]){for(const key of ['prepare','query']){const orig=d[key].bind(d);d[key]=(...args:any[])=>{if(enabled){if(key==='prepare')count++;else queries++}return orig(...args)}}}
const out:any={timings:[],load:loadavg()};
async function bench(label:string,fn:()=>any){await fn();let times=[];let result;for(let i=0;i<9;i++){count=queries=0;enabled=true;let start=performance.now();result=await fn();times.push(performance.now()-start);enabled=false}times.sort((a,b)=>a-b);out.timings.push({label,ms:times[4],min:times[0],max:times.at(-1),prepares:count,cachedQueries:queries});return result}
await bench('accessible 12 populated / 2 users',()=>listAccessibleAccountsForUser('u0'));
await bench('summary 12 populated / 2 users',()=>getUserMailboxSummary('u0'));
await bench('summary event scope one account but loads all access metadata',()=>getUserMailboxSummary('u0',['a0']));
writeFileSync('/tmp/perf-backlog/summary-results.json',JSON.stringify(out,null,2));closeAllDbConnections();
