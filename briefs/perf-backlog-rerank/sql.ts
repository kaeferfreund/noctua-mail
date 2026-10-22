import {writeFileSync} from 'node:fs';
import {loadavg} from 'node:os';
process.env.NOCTUA_DATA_DIR='/tmp/perf-backlog/data';
process.env.IMAP_SECRET_KEY='synthetic-perf-backlog-key-0123456789';
process.env.IMAP_CREDENTIALS_STORAGE='db';
const root='/home/monkey/code/noctua-mail/wt-perf-backlog';
const {getDb,getAccountDb,closeAllDbConnections}=await import(root+'/lib/db/connection.ts');
const {migrateAuthSchema,noctuaAuthOptions}=await import(root+'/lib/betterAuth.ts');
const {installAuthControlPlane}=await import(root+'/lib/db/authPolicy.ts');
const {listAccessibleAccountsForUser,listAccountMembers}=await import(root+'/lib/accountAccess.ts');
const {COLLAB_SUMMARY_SQL,getUserMailboxSummary}=await import(root+'/lib/mailboxSummary.ts');
const {listThreads}=await import(root+'/lib/db/messages/query.ts');
const {getThreadCollabSnapshot}=await import(root+'/lib/threadCollab.ts');
const {listThreadComments,listThreadActivity}=await import(root+'/lib/db/threadCollab.ts');
const {recomputeThreadsForAccountInternal}=await import(root+'/lib/db/threads.ts');
const master=await getDb();
await migrateAuthSchema(noctuaAuthOptions({database:master,baseURL:'http://localhost:3000',secret:'synthetic-perf-backlog-secret-0123456789'}));
installAuthControlPlane(master);
const user=master.prepare(`INSERT INTO auth_user(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES(?,?,?,1,?,?, 'user',1)`);
const acct=master.prepare(`INSERT INTO accounts(id,name,email,avatar,ownerUserId,imapHost,imapPort,imapSecure,imapUser,imapPassword,smtpHost,smtpPort,smtpSecure,smtpUser,smtpPassword) VALUES(?,?,?,'','u0','example.invalid',993,1,?,'','example.invalid',465,1,?,'')`);
master.transaction(()=>{
 for(let i=0;i<2;i++)user.run('u'+i,'Synthetic '+i,'u'+i+'@example.test',new Date().toISOString(),new Date().toISOString());
 for(let i=0;i<12;i++){acct.run('a'+i,'Synthetic '+i,'a'+i+'@example.test','a'+i+'@example.test','a'+i+'@example.test');master.prepare(`INSERT INTO user_accounts(userId,accountId,role) VALUES('u1',?,'editor')`).run('a'+i);master.prepare(`INSERT INTO sender_identities(id,accountId,email,displayName,isDefault,enabled,createdAt,updatedAt) VALUES(?,?,?,'Synthetic',1,1,0,0)`).run('si'+i,'a'+i,'a'+i+'@example.test');}
})();
const shards=[];for(let i=0;i<12;i++)shards.push(await getAccountDb('a'+i));
const db=shards[0];
const body='Synthetic body alpha beta gamma delta. '.repeat(100);
const insert=db.prepare(`INSERT INTO messages(id,accountId,folderId,threadId,messageId,subject,fromAddr,toAddr,preview,date,dateValue,body,htmlBody,unread,flagged,deliveredTo,originalTo) VALUES(?,'a0','a0:INBOX',?,?,?,?,?,'Synthetic preview',?,?,?, ?,?,?,'[]','[]')`);
const fts=db.prepare(`INSERT INTO message_fts_v2(accountId,messageId,subject,fromAddr,toAddr,body,preview) VALUES('a0',?,?,'sender@example.test','a0@example.test',?,'Synthetic preview')`);
db.transaction(()=>{
 db.prepare(`INSERT INTO folders(id,name,accountId,specialUse) VALUES('a0:INBOX','Inbox','a0','\\Inbox')`).run();
 for(let i=0;i<11000;i++){let id='m'+i,subject='Synthetic '+(i%400===0?'needle':'normal')+' '+i;insert.run(id,'t'+Math.floor(i/3),'<'+id+'@example.test>',subject,'sender@example.test','a0@example.test',new Date(1790000000000+i*1000).toISOString(),1790000000000+i*1000,body,'<p>'+body+'</p>',i%3===0?1:0,i%17===0?1:0);fts.run(id,subject,body);}
})();
await recomputeThreadsForAccountInternal('a0');
// Seed all collaboration tables with production DDL + guards intact.
const state=db.prepare(`INSERT INTO thread_collab_state(accountId,threadId,status,assigneeUserId,lastActivityAt,updatedAt,revision) VALUES('a0',?,'open',?,0,0,1)`);
const comment=db.prepare(`INSERT INTO thread_comments(id,accountId,threadId,authorUserId,body,createdAt,updatedAt,revision) VALUES(?,'a0',?,'u0',?,?,?,1)`);
const activity=db.prepare(`INSERT INTO thread_activity(id,accountId,threadId,type,actorUserId,payload,createdAt) VALUES(?,'a0',?,'comment_added','u0','{}',?)`);
db.transaction(()=>{for(let i=0;i<3667;i++)state.run('t'+i,i%3===0?'u0':null);for(let i=0;i<1000;i++){comment.run('c'+i,'t0','Synthetic note '+('N'.repeat(200)),i,i);activity.run('ac'+i,'t0',i)}})();
const out:any={sqlite:db.prepare('select sqlite_version() v').get(),loadStart:loadavg(),schema:{},timings:[],plans:[]};
for(const [label,d] of [['master',master],['shard',db]] as const)out.schema[label]=d.prepare(`SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','index')`).all();
let captured:any[]=[];let enabled=false;
for(const d of [master,...shards]){const orig=d.prepare.bind(d);d.prepare=(sql:string)=>{const st=orig(sql);if(enabled)captured.push({sql});return new Proxy(st,{get(target,key){const val=Reflect.get(target,key);if(['get','all','run'].includes(String(key)))return (...args:any[])=>{if(enabled){const row=captured.findLast(x=>x.sql===sql&&!x.args);if(row)row.args=args;}return val.apply(target,args)};return typeof val==='function'?val.bind(target):val;}})}}
async function measure(label:string,fn:()=>any,reps=7){await fn();let samples=[];let result;for(let i=0;i<reps;i++){captured=[];enabled=true;const start=performance.now();result=await fn();const ms=performance.now()-start;enabled=false;samples.push(ms)}const calls=captured.length;const sorted=[...samples].sort((a,b)=>a-b);out.timings.push({label,ms:sorted[Math.floor(reps/2)],min:sorted[0],max:sorted.at(-1),samples,calls,load:loadavg(),jsonBytes:result===undefined?0:Buffer.byteLength(JSON.stringify(result))});return {result,captured:[...captured]}}
async function plan(label:string,d:any,sql:string,args:any[]=[]){try{out.plans.push({label,sql,args,plan:d.prepare('EXPLAIN QUERY PLAN '+sql).all(...args)})}catch(e){out.plans.push({label,error:String(e),sql,args})}}
await measure('accessible accounts, 12 accounts / 2 users',()=>listAccessibleAccountsForUser('u0'));
await measure('summary, 12 accounts / 2 users',()=>getUserMailboxSummary('u0'));
const list=await measure('real listThreads default all 300',()=>listThreads({accountId:'a0',page:1,pageSize:300}));
for(const q of list.captured)if(q.args)await plan('actual list SQL',q.sql.includes('sender_identities')||q.sql.includes('total_changes')||q.sql.includes('FROM accounts')?master:db,q.sql,q.args);
const search=await measure('real listThreads search needle',()=>listThreads({accountId:'a0',page:1,pageSize:300,query:'needle'}));
for(const q of search.captured)if(q.args&&q.sql.includes('message_fts_v2'))await plan('actual search SQL',db,q.sql,q.args);
await measure('snapshot 1000 comments + 100 activities',()=>getThreadCollabSnapshot('a0','t0'));
await plan('comments ties',db,`SELECT * FROM thread_comments WHERE accountId=? AND threadId=? AND deletedAt IS NULL ORDER BY createdAt,id`,['a0','t0']);
await plan('activity ties',db,`SELECT * FROM thread_activity WHERE accountId=? AND threadId=? ORDER BY createdAt DESC,id DESC LIMIT ?`,['a0','t0',100]);
await plan('collab counts',db,COLLAB_SUMMARY_SQL,['a0','u0']);
const provisioning=`SELECT 1 FROM user_provisioning WHERE userId=? AND state NOT IN ('complete','cancelled')`;
await plan('provisioning initial',master,provisioning,['u0']);
// 20k historical operations, plus a 100-user scaling probe. No maintenance pragmas.
master.transaction(()=>{for(let i=2;i<100;i++)user.run('u'+i,'Synthetic '+i,'u'+i+'@example.test',new Date().toISOString(),new Date().toISOString());const p=master.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt) VALUES(?,?,?,'signup','complete',0,0)`);for(let i=0;i<20000;i++)p.run('p'+i,'old'+i,'old'+i+'@example.test')})();
await measure('accessible accounts, 12 accounts / 100 users / 20k history',()=>listAccessibleAccountsForUser('u0'));
await measure('one provisioning lookup, 20k history',()=>master.prepare(provisioning).get('u0'),21);
master.exec(`CREATE INDEX perf_provisioning_user_state ON user_provisioning(userId,state)`);
await plan('provisioning indexed',master,provisioning,['u0']);
await measure('one provisioning lookup, indexed',()=>master.prepare(provisioning).get('u0'),21);
await measure('accessible accounts with provisioning index',()=>listAccessibleAccountsForUser('u0'));
const read=`SELECT filename FROM attachments WHERE accountId=? AND messageId=?`;
await measure('5000 stable attachment reads reprepare',()=>{for(let i=0;i<5000;i++)db.prepare(read).all('a0','m'+i)},7);
const stable=db.prepare(read);await measure('5000 stable attachment reads reuse',()=>{for(let i=0;i<5000;i++)stable.all('a0','m'+i)},7);
// Raw FTS statement: compare account scan OR with FTS-driven indexed join, same 28 hits.
const scan=`SELECT m.id FROM messages m WHERE m.accountId=? AND ((m.accountId,m.id) IN (SELECT accountId,messageId FROM message_fts_v2 WHERE message_fts_v2 MATCH ?) OR lower(m.messageId) LIKE ? OR lower(m.threadId) LIKE ? OR lower(m.id) LIKE ?) ORDER BY m.dateValue DESC LIMIT 50`;
const driven=`SELECT m.id FROM message_fts_v2 f JOIN messages m ON m.accountId=f.accountId AND m.id=f.messageId WHERE message_fts_v2 MATCH ? AND f.accountId=? ORDER BY m.dateValue DESC LIMIT 50`;
await plan('FTS OR scan',db,scan,['a0','needle*','%needle%','%needle%','%needle%']);await plan('FTS driven',db,driven,['needle*','a0']);
const a=await measure('FTS OR scan raw SQL',()=>db.prepare(scan).all('a0','needle*','%needle%','%needle%','%needle%'));
const b=await measure('FTS driven raw SQL',()=>db.prepare(driven).all('needle*','a0'));
out.ftsSameIds=JSON.stringify(a.result)===JSON.stringify(b.result);
out.loadEnd=loadavg();writeFileSync('/tmp/perf-backlog/sql-results.json',JSON.stringify(out,null,2));closeAllDbConnections();
