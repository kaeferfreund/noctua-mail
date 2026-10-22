// Reviewer probes for 164a57e. FINDING tests assert the observed defect; passing is not a clean audit.
// Run only through run.sh; synthetic storage, read-only source and no external network.
import { afterEach, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";
import { setTimeout as pause } from "node:timers/promises";
import { createAuthenticatedTestSession } from "../lib/testAuthHarness";
import { createCollabFixture } from "../lib/testThreadCollabHarness";
import * as protocol from "../lib/mail/imapClientOptions";
let clients: Client[]=[];
const timers=new Map<number,{callback:()=>unknown;ms:number}>();let next=1;
let gate:Promise<void>|undefined;
class Client extends EventEmitter {
 closed=false;mailbox:any=false;get usable(){return !this.closed;}
 finish!:()=>void;idleGate=new Promise<void>(r=>{this.finish=r;});
 constructor(){super();clients.push(this);}
 async connect(){} close(){this.closed=true;this.finish();this.emit("close");}async logout(){this.close();}
 async mailboxOpen(){this.mailbox={uidNext:1,uidValidity:1n,exists:0};return this.mailbox;}
 async status(){return {uidNext:2,uidValidity:1n,unseen:0,messages:1};}
 async *fetch(){await gate;yield {uid:1,envelope:{subject:"Synthetic private subject"}};}
 async idle(){await this.idleGate;}
}
mock.module("@/lib/mail/imapStreamRuntime",()=>({...protocol,loadImapFlow:async()=>Client,safeLogoutImapClient:async(c:Client|null)=>c?.logout(),streamTimers:{setInterval(callback:()=>unknown,ms:number){const id=next++;timers.set(id,{callback,ms});return id;},clearInterval(id:number){timers.delete(id);}}}));
const actual=await import("../lib/mail/imap");
let planned=0;
mock.module("@/lib/mail/imap",()=>({...actual,planImapNewSyncFolders:async()=>{planned++;return [];}}));
const {GET}=await import("../app/api/accounts/[accountId]/imap/stream/route");
const {GET:summary}=await import("../app/api/accounts/summary/route");
const {POST:candidates}=await import("../app/api/accounts/[accountId]/sync/new-candidates/route");
let streams:AbortController[]=[];
afterEach(async()=>{for(const c of streams)c.abort();await pause(0);expect(timers.size).toBe(0);expect(clients.every(c=>c.closed)).toBe(true);streams=[];clients=[];gate=undefined;});
async function setup(role="viewer"){
 const f=await createCollabFixture(),u=await createAuthenticatedTestSession(f.accountId);
 await f.api.setUserAccountRole(u.user.id,f.accountId,role,null);
 const route={params:Promise.resolve({accountId:f.accountId})};
 const controller=new AbortController();streams.push(controller);
 const request=()=>new Request("http://localhost:3000/api/stream",{headers:u.jar.headers(),signal:controller.signal});
 return {...f,...u,route,controller,request};
}
for(const role of ["viewer","editor","manager"])test(`A5 ${role} reads watcher SSE, selected-account summary and new-candidates`,async()=>{
 const f=await setup(role);await f.seed(f.message("<watch@example.test>",{unread:true}));
 const response=await GET(f.request(),f.route);expect(response.status).toBe(200);const reader=response.body!.getReader();
 expect(new TextDecoder().decode((await reader.read()).value)).toContain("folder:update");
 expect((await summary(f.request())).status).toBe(200);
 const before=planned;const c=await candidates(new Request("http://localhost:3000/api/candidates",{method:"POST",headers:f.jar.headers({origin:"http://localhost:3000","content-type":"application/json"}),body:"{}"}),f.route);
 expect(c.status).toBe(200);expect(planned).toBe(before+1);
 f.controller.abort();expect((await reader.read()).done).toBe(true);
});
for(const action of ["revoke_membership","ban","expire_session","bump_generation"])test(`A6 ${action} during pending SSE fetch closes stream before private event`,async()=>{
 const f=await setup();const response=await GET(f.request(),f.route);const reader=response.body!.getReader();await reader.read();
 for(let i=0;i<100 && clients[0].listenerCount("exists")===0;i++) await pause(5);
 expect(clients[0].listenerCount("exists")).toBeGreaterThan(0);
 let release!:()=>void;gate=new Promise<void>(r=>{release=r;});clients[0].emit("exists");await pause(10);
 if(action==="revoke_membership")f.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(f.user.id,f.accountId);
 if(action==="ban")f.master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(f.user.id);
 if(action==="expire_session")f.master.prepare("UPDATE auth_session SET expiresAt=? WHERE id=?").run(new Date(Date.now()-1000).toISOString(),f.session.id);
 if(action==="bump_generation")f.master.prepare("UPDATE auth_security_state SET generation=generation+1 WHERE userId=?").run(f.user.id);
 release();const result=await Promise.race([reader.read(),pause(2000).then(()=>{throw Error("stream did not close");})]);
 expect(result.done).toBe(true);await pause(10);expect(clients.every(c=>c.closed)).toBe(true);
});
