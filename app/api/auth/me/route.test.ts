import {describe,test,expect} from "bun:test";
import {randomUUID} from "crypto";
import {GET} from "./route";
import {POST as logout} from "../logout/route";
import {POST as switchAccount} from "../switch-account/route";
import {POST as signup} from "../signup/route";
import {POST as login} from "../login/route";
import {createAuthenticatedTestSession,getSharedTestAuthHarness} from "@/lib/testAuthHarness";
import {dbModulePromise} from "@/lib/testDbHarness";
import {withDbWriteRetry} from "@/lib/dbWriteRetry";
import type {Account} from "@/lib/data";

const {upsertAccount}=await dbModulePromise;
function req(cookie:string,method="GET", body?:unknown, extra:Record<string,string>={}) {
 return new Request("http://localhost:3000/api/auth/me", {method,headers:{cookie,origin:"http://localhost:3000",...(body===undefined?{}:{"content-type":"application/json"}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function account(name:string,email=`mail-${randomUUID()}@example.test`) {
 const id=randomUUID();
 await upsertAccount({id,name,email,avatar:"",imap:{host:"imap.example.test",port:993,secure:true,user:email,password:"synthetic-imap"},smtp:{host:"smtp.example.test",port:465,secure:true,user:email,password:"synthetic-smtp"}} as Account);
 return id;
}

describe("me state and persisted selection contract",()=>{
 test("restricted setup returns minimal identity and no mailboxes",async()=>{
  const h=await getSharedTestAuthHarness(); const user=await h.createUser(`setup-${randomUUID()}@example.test`);
  const f=await h.signIn(user.email); await h.seedSessionSecurity(f.session!.session.id,user.id,"setup");
  await h.addMembership(user.id,await account("Hidden"));
  const response=await GET(req(f.jar.header())); const body=await response.json();
  expect(response.status).toBe(200);
  expect(body).toEqual({ok:true,user:{id:user.id,email:user.email,name:"Synthetic User"},accountId:null,accounts:[],exp:expect.any(Number),ttlSeconds:86400,mailboxState:"enrollment",security:{enrollmentRequired:true,reauthRequired:true,code:"mfa_enrollment_required",hasPassword:true,imapLoginAvailable:false}});
  expect(JSON.stringify(body)).not.toContain("sessionToken");
 });
 test("zero memberships returns none",async()=>{
  const f=await createAuthenticatedTestSession();
  const body=await (await GET(req(f.jar.header()))).json();
  expect(body).toMatchObject({ok:true,mailboxState:"none",accountId:null,accounts:[],security:{enrollmentRequired:false,reauthRequired:false}});
 });
 test("null/revoked defaults sort by name, normalized email and id and persist",async()=>{
  const f=await createAuthenticatedTestSession();
  const later=await account("Zulu"); const first=await account("Alpha","a@example.test"); const next=await account("Alpha","b@example.test");
  for(const id of [later,next,first])await f.addMembership(f.user.id,id);
  const body=await (await GET(req(f.jar.header()))).json();
  expect(body.mailboxState).toBe("selected"); expect(body.accountId).toBe(first);
  expect(body.accounts.map((a:Account)=>a.id)).toEqual([first,next,later]);
  expect(body.accounts[0].imap.password).toBe("");
  expect(JSON.stringify(body)).not.toContain("synthetic-imap");
  expect((await f.auth.api.getSession({headers:f.jar.headers()}))!.session.activeAccountId).toBe(first);
  await withDbWriteRetry("test.revoke",()=>f.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(f.user.id,first));
  expect((await (await GET(req(f.jar.header()))).json()).accountId).toBe(next);
  expect((await f.auth.api.getSession({headers:f.jar.headers()}))!.session.activeAccountId).toBe(next);
 });
 test("revocation during persistence retries once, then reports unselected with remaining memberships",async()=>{
  const f=await createAuthenticatedTestSession();
  for(const name of ["A","B","C"])await f.addMembership(f.user.id,await account(name));
  // Actual SQLite interleaving at the write boundary; never mock the shared DB/auth module.
  const trigger=`selection_race_${randomUUID().replaceAll("-","")}`;
  await withDbWriteRetry("test.race",()=>f.master.exec(`CREATE TRIGGER ${trigger} AFTER UPDATE OF activeAccountId ON auth_session WHEN NEW.id='${f.session.id}' AND NEW.activeAccountId IS NOT NULL BEGIN DELETE FROM user_accounts WHERE userId=NEW.userId AND accountId=NEW.activeAccountId; END`));
  try {
   const body=await (await GET(req(f.jar.header()))).json();
   expect(body.mailboxState).toBe("unselected");expect(body.accountId).toBeNull();expect(body.accounts).toHaveLength(1);
   expect((await f.auth.api.getSession({headers:f.jar.headers()}))!.session.activeAccountId).toBeNull();
  } finally {await withDbWriteRetry("test.raceCleanup",()=>f.master.exec(`DROP TRIGGER ${trigger}`));}
 });
 test("one revoked write retries and persists the next surviving mailbox",async()=>{
  const f=await createAuthenticatedTestSession(); const a=await account("A"); const b=await account("B");
  await f.addMembership(f.user.id,a);await f.addMembership(f.user.id,b);
  const trigger=`selection_race_${randomUUID().replaceAll("-","")}`;
  await withDbWriteRetry("test.race",()=>f.master.exec(`CREATE TRIGGER ${trigger} AFTER UPDATE OF activeAccountId ON auth_session WHEN NEW.id='${f.session.id}' AND NEW.activeAccountId='${a}' BEGIN DELETE FROM user_accounts WHERE userId=NEW.userId AND accountId=NEW.activeAccountId; END`));
  try {expect((await (await GET(req(f.jar.header()))).json()).accountId).toBe(b);}
  finally {await withDbWriteRetry("test.raceCleanup",()=>f.master.exec(`DROP TRIGGER ${trigger}`));}
 });
 test("refresh cookies are forwarded and absolute expiry is bounded",async()=>{
  const f=await createAuthenticatedTestSession();
  const authenticatedAt=Date.now()-7200_000;
  await f.seedSessionSecurity(f.session.id,f.user.id,"mfa","password_totp",authenticatedAt);
  await withDbWriteRetry("test.refresh",()=>f.master.prepare("UPDATE auth_session SET updatedAt=?,expiresAt=? WHERE id=?").run(new Date(Date.now()-7200_000).toISOString(),new Date(Date.now()+79200_000).toISOString(),f.session.id));
  const response=await GET(req(f.jar.header()));
  expect(response.headers.getSetCookie().length).toBeGreaterThan(0);f.jar.absorb(response.headers);
  expect((await response.json()).exp).toBe(Math.floor((authenticatedAt+86400_000)/1000));
  expect((await GET(req(f.jar.header()))).status).toBe(200);
 });
 test("expired library session forwards deletion cookies",async()=>{
  const f=await createAuthenticatedTestSession();
  await withDbWriteRetry("test.expire",()=>f.master.prepare("UPDATE auth_session SET expiresAt=? WHERE id=?").run(new Date(Date.now()-1000).toISOString(),f.session.id));
  const response=await GET(req(f.jar.header()));expect(response.status).toBe(401);
  expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");
 });
});

describe("shell mutation contracts",()=>{
 test("switch is JSON same-origin, checks membership, persists selection",async()=>{
  const f=await createAuthenticatedTestSession();const id=await account("Chosen");await f.addMembership(f.user.id,id);
  const response=await switchAccount(req(f.jar.header(),"POST",{accountId:id}));
  expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,accountId:id});
  expect((await f.auth.api.getSession({headers:f.jar.headers()}))!.session.activeAccountId).toBe(id);
  const forbidden=await account("Foreign");
  expect((await switchAccount(req(f.jar.header(),"POST",{accountId:forbidden}))).status).toBe(403);
  expect((await switchAccount(req(f.jar.header(),"POST",{accountId:id},{origin:"https://foreign.example.test"}))).status).toBe(403);
 });
 test("bodyless logout deletes cookie, DB session, sidecar, grants and source challenges; next me rejects",async()=>{
  const f=await createAuthenticatedTestSession();const saved=f.jar.header();
  const context = await f.auth.$context;
  const control = await context.internalAdapter.createSession(f.user.id);
  const controlId = control.id;
  await f.seedSessionSecurity(controlId,f.user.id,"mfa","password_totp");
  await withDbWriteRetry("test.proof",()=>f.master.transaction(()=>{
   for (const sessionId of [f.session.id,controlId]) {
    f.master.prepare("INSERT INTO auth_pending_challenges(identifier,userId,generation,authenticatedAt,kind,sourceSessionId,expiresAt) SELECT ?,userId,generation,?,'passkey_reauth',?,? FROM auth_security_state WHERE userId=?").run(randomUUID(),Date.now(),sessionId,Date.now()+60_000,f.user.id);
    f.master.prepare("INSERT INTO auth_reauth_grants(tokenHash,userId,sessionId,purpose,generation,expiresAt) SELECT ?,userId,?,'test',generation,? FROM auth_security_state WHERE userId=?").run(randomUUID(),sessionId,Date.now()+60_000,f.user.id);
   }
  }).immediate());
  const pendingLogin=randomUUID();
  await withDbWriteRetry("test.pendingLogin",()=>f.master.prepare(`INSERT INTO auth_pending_challenges(identifier,userId,generation,authenticatedAt,kind,expiresAt)
   SELECT ?,userId,generation,?,'two_factor',? FROM auth_security_state WHERE userId=?`).run(pendingLogin,Date.now(),Date.now()+60000,f.user.id));
  const epoch=f.master.prepare(`SELECT generation FROM auth_login_epoch WHERE id=1`).get().generation;
  const response=await logout(req(saved,"POST"));expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true});
  expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");f.jar.absorb(response.headers);
  expect(f.jar.names()).not.toContain("noctua.session_token");
  expect(f.master.prepare("SELECT id FROM auth_session WHERE id=?").get(f.session.id)).toBeNull();
  expect(f.master.prepare("SELECT sessionId FROM auth_session_security WHERE sessionId=?").get(f.session.id)).toBeNull();
  expect(f.master.prepare("SELECT identifier FROM auth_pending_challenges WHERE sourceSessionId=?").get(f.session.id)).toBeNull();
  expect(f.master.prepare("SELECT tokenHash FROM auth_reauth_grants WHERE sessionId=?").get(f.session.id)).toBeNull();
  expect(f.master.prepare(`SELECT 1 FROM auth_pending_challenges WHERE identifier=?`).get(pendingLogin)).toBeNull();
  expect(f.master.prepare(`SELECT generation FROM auth_login_epoch WHERE id=1`).get().generation).toBeGreaterThan(epoch);
  for (const [table,column] of [["auth_session","id"],["auth_session_security","sessionId"],["auth_pending_challenges","sourceSessionId"],["auth_reauth_grants","sessionId"]]) {
   expect(f.master.prepare(`SELECT 1 FROM ${table} WHERE ${column}=?`).get(controlId)).not.toBeNull();
  }
  expect((await GET(req(saved))).status).toBe(401);expect((await GET(req(f.jar.header()))).status).toBe(401);
  expect((await logout(req("","POST"))).status).toBe(200);
 });
 test("logout rejects foreign/null origins and unexpected bodies; valid Referer works",async()=>{
  for(const origin of ["https://foreign.example.test","null"])expect((await logout(req("","POST",undefined,{origin}))).status).toBe(403);
  expect((await logout(req("","POST",{}))).status).toBe(400);
  expect((await logout(new Request("http://localhost:3000/api/auth/logout",{method:"POST"}))).status).toBe(403);
  expect((await logout(new Request("http://localhost:3000/api/auth/logout",{method:"POST",headers:{referer:"http://localhost:3000/inbox"}}))).status).toBe(200);
 });
 test("signup enforces request hygiene and legacy login stays 410",async()=>{
  const request=req("","POST");expect((await signup(request)).status).toBe(400);expect((await login(request)).status).toBe(410);
 });
});
