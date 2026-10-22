import {mkdirSync,rmSync,appendFileSync} from 'node:fs';
import {root,guards,measure,load} from './common';
const {startImapServer}=await import(root+'/scripts/dev-fixture/imap-server.ts');
const {MailStore}=await import(root+'/scripts/dev-fixture/store.ts');
const {upsertAccount}=await import(root+'/lib/db/accounts.ts');
const {getAccountDb,closeAllDbConnections}=await import(root+'/lib/db/connection.ts');
const {runSyncOperation}=await import(root+'/lib/syncOperation.ts');
const {drainImapConnectionPool}=await import(root+'/lib/mail/imap/index.ts');
const {bulkUpdateMessageFlags}=await import(root+'/lib/db/messages/flags.ts');
const {updateMessagesFolderPrefix}=await import(root+'/lib/db/messages/move.ts');
const {deleteMessagesByIds}=await import(root+'/lib/db/messages/delete.ts');
const {recomputeThreadsForAccount}=await import(root+'/lib/db/threads.ts');
const {saveDraftForAccount}=await import(root+'/lib/drafts.ts');
const {saveFoldersForAccount}=await import(root+'/lib/db/folders.ts');
const repeats=Number(process.argv[2]??5);const modes=(process.argv[3]??'none,current').split(',');
for(let rep=0;rep<repeats;rep++)for(const mode of rep%2?[...modes].reverse():modes){
 const dir=`/tmp/perf-guards/data/flow-${mode}-${rep}`;rmSync(dir,{recursive:true,force:true});mkdirSync(dir,{recursive:true});process.env.NOCTUA_DATA_DIR=dir;
 const store=new MailStore('perf',new Date('2026-10-22T09:00:00Z'),dir+'/fixture.sqlite');for(const b of store.boxes.values()){b.messages=[];b.uidNext=1}
 const server=await startImapServer({port:0,controlPort:0,store});
 const account={id:'perf@example.test',email:'perf@example.test',name:'Synthetic perf',avatar:'',imap:{host:'127.0.0.1',port:server.port,secure:false,user:'demo@monkeydent.test',password:'demo'},smtp:{host:'127.0.0.1',port:1,secure:false,user:'demo@monkeydent.test',password:'demo'}};
 const log=(flow:string,m:any)=>{let record={rep,mode,flow,load:load(),...m,result:m.result?.count??m.result};appendFileSync('/tmp/perf-guards/flows.jsonl',JSON.stringify(record)+'\n');console.log('MEASURE',JSON.stringify(record));};
 try{
 await upsertAccount(account);const db=await getAccountDb(account.id);guards(db,mode);
 const inject=async(start:number,n:number)=>{for(let i=start;i<start+n;i++){let source=`From: Sender <sender@example.test>\r\nTo: perf@example.test\r\nMessage-ID: <perf-${i}@example.test>\r\nSubject: Synthetic thread ${Math.floor(i/5)}\r\nDate: Thu, 22 Oct 2026 09:00:00 +0000\r\n${i%5?`In-Reply-To: <perf-${i-i%5}@example.test>\r\nReferences: <perf-${i-i%5}@example.test>\r\n`:''}Content-Type: text/plain; charset=utf-8\r\n\r\nSynthetic project update ${i}. Please review the document.\r\n`;let r=await fetch(`http://127.0.0.1:${server.controlPort}/inject`,{method:'POST',body:JSON.stringify({source})});if(!r.ok)throw Error(await r.text());}}
 await inject(0,5000);
 log('initial-sync',await measure(db,()=>runSyncOperation({accountId:account.id,folderId:account.id+':INBOX',fullSync:true,mode:'full'})));
 if(db.query('SELECT COUNT(*) n FROM messages').get().n!==5000)throw Error('wrong initial count');
 await inject(5000,100);
 log('incremental-sync',await measure(db,()=>runSyncOperation({accountId:account.id,folderId:account.id+':INBOX',mode:'new'})));
 if(db.query('SELECT COUNT(*) n FROM messages').get().n!==5100)throw Error('wrong increment count');
 const ids=db.query('SELECT id FROM messages ORDER BY id').all().map((r:any)=>r.id);
 log('bulk-flags',await measure(db,()=>bulkUpdateMessageFlags(account.id,ids.map((id:string)=>({id,flags:['\\Seen','\\Flagged']})))));
 log('bulk-move',await measure(db,()=>updateMessagesFolderPrefix(account.id,'INBOX','Archive')));
 log('thread-recompute',await measure(db,()=>recomputeThreadsForAccount(account.id)));
 await saveFoldersForAccount(account.id,[{id:account.id+':Drafts',accountId:account.id,name:'Drafts',path:'Drafts',delimiter:'/',specialUse:'\\Drafts'}]);
 let draft:any=await saveDraftForAccount({account,accountId:account.id,clientId:'perf-draft',payload:{to:'recipient@example.test',subject:'Synthetic draft',text:'Before'}});
 log('draft-autosave-10',await measure(db,async()=>{for(let k=0;k<10;k++)draft=await saveDraftForAccount({account,accountId:account.id,clientId:'perf-draft',payload:{draftId:draft.draftId,to:'recipient@example.test',subject:'Synthetic draft',text:'Synthetic edit '+k}})}));
 log('bulk-delete',await measure(db,()=>deleteMessagesByIds(account.id,ids)));
 }finally{await drainImapConnectionPool();closeAllDbConnections();await server.stop()}
}
