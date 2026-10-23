// Account-batching load probe: the r4 paired load protocol (briefs/sender-identities-slice2-regressions-r4/load.ts)
// plus /api/auth/me, /api/me/mailboxes/summary and SSE scoped-summary readers for a 12-mailbox user,
// while the auth writer also flips that user's roles, churns another member and revokes/re-grants a membership.
// Copied by prepare.py to scripts/reviewLoad.ts inside each archived variant. All data is synthetic.
import { Database } from 'bun:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';
const role=process.argv[2] ?? 'main';
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const end=()=>Number(process.env.REVIEW_END);
if (role==='auth') {
  // Same 50 ms session timestamp writer as r4 (busy_timeout=0); every 4th tick a role flip, every 10th tick a
  // member churn, every 20th tick a revoke/re-grant of the reader's membership. One write per tick at most.
  const db=new Database(process.env.REVIEW_MASTER!); db.exec('PRAGMA busy_timeout=0');
  const reader=process.env.REVIEW_READER!, member=process.env.REVIEW_MEMBER!, extra=process.env.REVIEW_EXTRA!.split(',');
  const kinds:Record<string,{attempts:number;busy:number}>={};
  const roles=['viewer','editor','manager'];
  let tick=0, attempts=0, busy=0, memberPresent=false, readerRevoked=false;
  const write=(kind:string,fn:()=>void)=>{
    const k=kinds[kind]??={attempts:0,busy:0}; k.attempts++;
    try { fn(); return true; } catch(e:any) { if (/locked|busy/i.test(String(e))) { k.busy++; return false; } throw e; }
  };
  while(Date.now()<Number(process.env.REVIEW_START)) await pause(10);
  while(Date.now()<end()) {
    tick++;
    if (tick%20===0) write('revoke',()=>{ const id=extra.at(-1)!;
      if(readerRevoked) db.prepare("INSERT OR IGNORE INTO user_accounts(userId,accountId,role) VALUES(?,?,'viewer')").run(reader,id);
      else db.prepare('DELETE FROM user_accounts WHERE userId=? AND accountId=?').run(reader,id);
      readerRevoked=!readerRevoked; });
    else if (tick%10===0) write('member',()=>{ const id=extra[(tick/10)%extra.length];
      if(memberPresent) db.prepare('DELETE FROM user_accounts WHERE userId=? AND accountId=?').run(member,id);
      else db.prepare("INSERT OR IGNORE INTO user_accounts(userId,accountId,role) VALUES(?,?,'editor')").run(member,id);
      memberPresent=!memberPresent; });
    else if (tick%4===0) write('role',()=>{ db.prepare('UPDATE user_accounts SET role=? WHERE userId=? AND accountId=?').run(roles[(tick/4)%3],reader,extra[(tick/4)%(extra.length-1)]); });
    else { attempts++; if(!write('session',()=>{ db.prepare('UPDATE auth_session SET updatedAt=? WHERE id=?').run(new Date().toISOString(),process.env.REVIEW_SESSION!); })) busy++; }
    await pause(50);
  }
  writeFileSync(process.env.REVIEW_RESULT!,JSON.stringify({attempts,busy,kinds})); db.close(); process.exit(0);
}
if(role==='sync') {
  const {runSyncOperation}=await import('../lib/syncOperation');
  const lease=await import('../lib/db/processLeases');
  const {closeAllDbConnections}=await import('../lib/db/connection');
  const {drainImapConnectionPool}=await import('../lib/mail/imap/connectionPool');
  const {activate,deactivate}=await import('../lib/reviewDbProbe');
  const accountId=process.argv[3], owner=lease.newLeaseOwner();
  let completed=0,failed=0,errors:string[]=[];
  while(Date.now()<Number(process.env.REVIEW_START)) await pause(10);
  activate();
  while(Date.now()<end()) {
    const jobId=crypto.randomUUID();
    try {
      await lease.queueWorker(jobId,owner,0,accountId);
      while(Date.now()<end() && !await lease.reserveWorker(jobId,owner,2)) await pause(20);
      if(Date.now()>=end()) break;
      await runSyncOperation({accountId,folderId:`${accountId}:INBOX`,mode:'recent'},'synthetic-load');
      if(Date.now()<end()) completed++;
    } catch(e:any) { if(Date.now()<end()) {failed++; errors.push(String(e));} }
    finally { try {await lease.removeWorker(jobId,owner,true);}catch(e){errors.push(String(e));} }
    await pause(30);
  }
  deactivate();
  writeFileSync(process.env.REVIEW_RESULT!,JSON.stringify({completed,failed,errors}));
  await drainImapConnectionPool(); closeAllDbConnections(); process.exit(0);
}
const out=process.env.REVIEW_OUT!; mkdirSync(out,{recursive:true}); mkdirSync(`${out}/metrics`,{recursive:true});
process.env.REVIEW_METRICS=`${out}/metrics`;
process.env.IMAP_CREDENTIALS_STORAGE='db';
process.env.IMAP_SECRET_KEY='synthetic-review-encryption-key-32-chars';
process.env.BETTER_AUTH_SECRET='noctua-auth-test-secret-0123456789abcdef';
process.env.BETTER_AUTH_URL='http://localhost:3886';
process.env.ACCOUNT_DB_IDLE_MS='0';
process.env.NOCTUA_MAILBOX_WATCHER='1';
process.env.NOCTUA_WATCHER_ACCOUNTS_INTERVAL_MS='1000';
process.env.NOCTUA_WATCHER_INTERVAL_MS='300000';
process.env.NOCTUA_WATCHER_RECONNECT_MIN_MS='150';
const {dbModulePromise}=await import('../lib/testDbHarness'); const api=await dbModulePromise;
const {createAuthenticatedTestSession,getSharedTestAuthHarness}=await import('../lib/testAuthHarness');
const {getDb,getAccountDb,closeAllDbConnections}=await import('../lib/db/connection');
const {saveDraftForAccount}=await import('../lib/drafts');
const {startMailboxWatcher,stopMailboxWatcher}=await import('../lib/mailboxWatcher');
const {subscribeMailboxEvents,publishMailboxEvent}=await import('../lib/mailboxWatcherEvents');
const {drainImapConnectionPool}=await import('../lib/mail/imap/connectionPool');
const {activate,deactivate}=await import('../lib/reviewDbProbe');
const {requireActiveUserSession}=await import('../lib/auth');
const {createUserEventStream}=await import('../lib/userEvents');
const {getUserMailboxSummary}=await import('../lib/mailboxSummary');
const meRoute=await import('../app/api/auth/me/route');
const summaryRoute=await import('../app/api/me/mailboxes/summary/route');
const fixture=Bun.spawn([process.execPath,'scripts/dev-fixture/imap-server.ts','--host','127.0.0.1','--port','0','--control-port','0'],{cwd:process.cwd(),env:process.env,stdout:'pipe',stderr:Bun.file(`${out}/fixture.err`)});
process.once('exit',()=>{try{fixture.kill('SIGKILL')}catch{}});
let fixtureText=''; const reader=fixture.stdout.getReader();
while(!/IMAP fixture: 127\.0\.0\.1:(\d+); control: (\d+)/.test(fixtureText)) { const v=await reader.read(); if(v.done)throw Error('fixture exited'); fixtureText+=new TextDecoder().decode(v.value); }
const ports=fixtureText.match(/IMAP fixture: 127\.0\.0\.1:(\d+); control: (\d+)/)!;
const endpoint={host:'127.0.0.1',port:Number(ports[1]),secure:false,user:'demo@monkeydent.test',password:'demo'};
const control=`http://127.0.0.1:${ports[2]}`;
const accounts=['synthetic-a','synthetic-b'].map(id=>({id,name:'Synthetic load',email:'demo@monkeydent.test',avatar:'S',imap:endpoint,smtp:endpoint}));
const account=accounts[0];
for(const a of accounts) {
  await api.upsertAccount(a);
  await api.saveFoldersForAccount(a.id,['INBOX','Drafts','Sent','Archive','Trash','Junk','Projekte/Website'].map(name=>({id:`${a.id}:${name}`,accountId:a.id,name,count:0,unreadCount:0,specialUse:name==='INBOX'?'\\Inbox':name==='Drafts'?'\\Drafts':undefined})));
}
// Ten extra local mailboxes for the 12-mailbox reader. Rejected IMAP password: the watcher
// suspends them after one failed login, so the r4 sync/watcher load profile stays unchanged.
const badEndpoint={...endpoint,password:'synthetic-rejected'};
const extra=Array.from({length:10},(_,i)=>({id:`synthetic-x${i}`,name:`Synthetic extra ${i%4===3?'shared':i}`,email:`extra${i}@example.test`,avatar:'X',imap:badEndpoint,smtp:badEndpoint}));
for(const a of extra) {
  await api.upsertAccount(a);
  await api.saveFoldersForAccount(a.id,[{id:`${a.id}:INBOX`,accountId:a.id,name:'INBOX',count:0,unreadCount:0,specialUse:'\\Inbox'}]);
  await api.upsertMessages(a.id,`${a.id}:INBOX`,Array.from({length:5},(_,m)=>({id:`${a.id}-m${m}`,accountId:a.id,folderId:`${a.id}:INBOX`,threadId:`<x${m}@example.test>`,messageId:`<x${m}@example.test>`,subject:'Synthetic',from:'sender@example.test',to:a.email,preview:'Synthetic',body:'Synthetic',date:'2026-01-01T00:00:00Z',dateValue:1767225600000+m,unread:m<3})) as any);
}
const auth=await createAuthenticatedTestSession(account.id);
// Reader: own MFA session, 12 memberships with mixed roles; a second plain member churns on the extra mailboxes.
const readerFx=await createAuthenticatedTestSession();
const h=await getSharedTestAuthHarness();
const memberUser=await h.createUser('churn-member@example.test','');
const all12=[...accounts,...extra].map(a=>a.id);
for(const [i,id] of all12.entries()) await h.addMembership(readerFx.user.id,id,['viewer','editor','manager'][i%3]);
for(const id of extra.slice(0,5).map(a=>a.id)) await h.addMembership(memberUser.id,id,'viewer');
const master=await getDb(),shard=await getAccountDb(account.id);
const seed=Array.from({length:11000},(_,i)=>({id:`synthetic-seed-${i}`,accountId:account.id,folderId:`${account.id}:Archive`,threadId:`<seed-${i}@example.test>`,messageId:`<seed-${i}@example.test>`,subject:`Synthetic seed ${i}`,from:'sender@example.test',to:account.email,preview:'Synthetic mail',body:'Synthetic content for indexed mail search',date:'2026-01-01T00:00:00Z',dateValue:1767225600000+i}));
await api.upsertMessages(account.id,`${account.id}:Archive`,seed);
for(const a of accounts) { const {runSyncOperation}=await import('../lib/syncOperation'); await runSyncOperation({accountId:a.id,folderId:`${a.id}:INBOX`,mode:'recent'}); }
let watcherJobs=0; const unsub=subscribeMailboxEvents(e=>{if(e.type==='synced')watcherJobs++;});
startMailboxWatcher(); await pause(1200);
const request=new Request('http://localhost:3886/synthetic',{headers:{cookie:auth.jar.header()}});
const readerRequest=(path:string,signal?:AbortSignal)=>new Request(`http://localhost:3886${path}`,{headers:{cookie:readerFx.jar.header(),origin:'http://localhost:3886'},signal});
let draftId:string|undefined, saves=0,failures=0,errors:string[]=[]; const latencies:number[]=[];
draftId=(await saveDraftForAccount({account,accountId:account.id,clientId:'synthetic-load',payload:{to:'recipient@example.test',subject:'Synthetic load draft',text:'Synthetic draft'},actor:{userId:auth.user.id},authorization:{request}})).draftId ?? undefined;
// Warm both endpoints once (excluded).
await (await meRoute.GET(readerRequest('/api/auth/me'))).text(); await (await summaryRoute.GET(readerRequest('/api/me/mailboxes/summary'))).text();
const start=Date.now()+300, deadline=start+Number(process.env.REVIEW_DURATION ?? 60000);
process.env.REVIEW_START=String(start); process.env.REVIEW_END=String(deadline);
const children=[['auth'],['sync',account.id],['sync',accounts[1].id]].map((args,i)=>Bun.spawn([process.execPath,'scripts/reviewLoad.ts',...args],{cwd:process.cwd(),env:{...process.env,REVIEW_MASTER:master.filename,REVIEW_SESSION:auth.session.id,REVIEW_READER:readerFx.user.id,REVIEW_MEMBER:memberUser.id,REVIEW_EXTRA:extra.map(a=>a.id).join(','),REVIEW_RESULT:`${out}/child-${i}.json`},stdout:Bun.file(`${out}/child-${i}.log`),stderr:Bun.file(`${out}/child-${i}.err`)}));
// SSE: one production user stream for the reader; scoped reads timed through the existing loadSummary seam.
const sse={events:{} as Record<string,number>,scopedMs:[] as number[],errors:0,closed:false};
const sseAbort=new AbortController();
const sseSession=await requireActiveUserSession(readerRequest('/api/me/events',sseAbort.signal));
if(sseSession instanceof Response) throw Error('reader stream denied');
const sseReader=createUserEventStream(readerRequest('/api/me/events',sseAbort.signal),sseSession as any,{loadSummary:async(userId,scope)=>{
  const t=performance.now(); try { return await getUserMailboxSummary(userId,scope); } finally { if(Date.now()>=start&&Date.now()<deadline) sse.scopedMs.push(performance.now()-t); } }}).getReader();
void (async()=>{ for(;;){ const {value,done}=await sseReader.read(); if(done){sse.closed=true;return;} const text=new TextDecoder().decode(value);
  const type=text.match(/^event: (\S+)/m)?.[1] ?? 'heartbeat'; if(Date.now()>=start&&Date.now()<deadline) sse.events[type]=(sse.events[type]??0)+1; } })();
while(Date.now()<start) await pause(10);
activate(); watcherJobs=0; const startLoad=loadavg();
writeFileSync(`${out}/started.json`,JSON.stringify({start,deadline,load:startLoad,ports:[Number(ports[1]),Number(ports[2])]}));
const injector=setInterval(()=>{void fetch(`${control}/inject`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:'Synthetic load injected',text:'Synthetic watcher load'})}).catch(()=>{});},1000);
// Mailbox state events for all 12 mailboxes, 10 Hz; each user stream debounces 250 ms per mailbox.
let publishIndex=0; const publisher=setInterval(()=>publishMailboxEvent({accountId:all12[publishIndex++%all12.length],type:'state',watcherState:'idling'} as any),100);
async function endpointLoop(path:string,handler:(r:Request)=>Promise<Response>) {
  const ms:number[]=[], statuses:Record<string,number>={}; let errorCount=0;
  while(Date.now()<deadline) {
    const t=performance.now();
    try { const response=await handler(readerRequest(path)); await response.text();
      if(Date.now()<=deadline){ ms.push(performance.now()-t); statuses[response.status]=(statuses[response.status]??0)+1; } }
    catch { if(Date.now()<=deadline) errorCount++; }
    await pause(25);
  }
  return {ms,statuses,errors:errorCount};
}
const draftLoop=(async()=>{
  while(Date.now()<deadline) {
    const t=performance.now();
    try {
      const result=await saveDraftForAccount({account,accountId:account.id,clientId:'synthetic-load',payload:{draftId,to:'recipient@example.test',subject:'Synthetic load draft',text:`Synthetic draft ${saves}`},actor:{userId:auth.user.id},authorization:{request}});
      if(Date.now()<=deadline) {saves++;latencies.push(performance.now()-t);} draftId=result.draftId ?? undefined;
    } catch(e:any) { if(Date.now()<=deadline){failures++;errors.push(String(e));} }
  }
})();
const [me,summary]=await Promise.all([endpointLoop('/api/auth/me',meRoute.GET),endpointLoop('/api/me/mailboxes/summary',summaryRoute.GET),draftLoop]);
clearInterval(injector); clearInterval(publisher); const endLoad=loadavg(); deactivate(); sseAbort.abort();
const result={saves,failures,errors,watcherJobs,startLoad,endLoad,latencies,endpoints:{me,summary,sse},pragmas:{master:master.prepare('PRAGMA busy_timeout').get(),shard:shard.prepare('PRAGMA busy_timeout').get()},duration:deadline-start};
writeFileSync(`${out}/main.json`,JSON.stringify(result));
await stopMailboxWatcher(); unsub();
for(const child of children) {const timeout=setTimeout(()=>child.kill('SIGKILL'),25000);await child.exited;clearTimeout(timeout);}
await drainImapConnectionPool(); fixture.kill('SIGTERM'); await fixture.exited;
closeAllDbConnections(); console.log('REVIEW_LOAD',JSON.stringify({...result,latencies:undefined,endpoints:{me:{n:me.ms.length,statuses:me.statuses},summary:{n:summary.ms.length,statuses:summary.statuses},sse:{events:sse.events,scoped:sse.scopedMs.length}}})); process.exit(0);
