import {afterEach,expect,test} from "bun:test";
import {CookieJar,createTestAuthHarness,TEST_BASE_URL,totpFromUri,type TestAuthHarness} from "./testAuthHarness";
import {persistAccountRow} from "./db/rowParsers";
import {readSessionSecurity,reserveSecurityOperation,finishSecurityOperation} from "./db/authPolicy";
import {reauthenticate} from "./authSecurity";
import {createRateLimiter} from "./rateLimit";
import {mutateAdminSecurity} from "./userLifecycle";
import type {Account} from "./data";

// SD47: a sign-in that is still verifying its first factor must not delay an admin's session revocation.
const fixtures:TestAuthHarness[]=[];
const previousHosts=process.env.NOCTUA_IMAP_LOGIN_HOSTS;
afterEach(()=>{
  for(const f of fixtures.splice(0))f.close();
  if(previousHosts===undefined)delete process.env.NOCTUA_IMAP_LOGIN_HOSTS;else process.env.NOCTUA_IMAP_LOGIN_HOSTS=previousHosts;
});
const password="synthetic-password-123";
const email=()=>`synthetic-${crypto.randomUUID()}@example.test`;

async function setup() {
  let release:()=>void=()=>{};
  let started:()=>void=()=>{};
  const verifying=new Promise<void>(resolve=>{started=resolve;});
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const f=await createTestAuthHarness(undefined,{imapVerification:async()=>{started();await gate;return "ok" as const;}});
  fixtures.push(f);
  const admin=await f.createUser(email(),password,"admin"),signed=await f.signIn(admin.email,password);
  const factor=await f.enrollTotp(signed.jar,password),session=await f.auth.api.getSession({headers:signed.jar.headers()});
  await f.seedSessionSecurity(session!.session.id,admin.id,"mfa","password_totp");
  const actor={jar:signed.jar,factor,source:readSessionSecurity(f.master,session!.session.id)};
  const target=await f.createUser(email());
  const account={id:crypto.randomUUID(),name:"Synthetic IMAP",avatar:"",email:target.email,ownerUserId:target.id,
    imap:{host:"imap.example.test",port:993,secure:true,user:target.email,password:"old-synthetic-secret"},
    smtp:{host:"smtp.example.test",port:465,secure:true,user:target.email,password:"old-synthetic-secret"}} as Account;
  persistAccountRow(f.master,account);
  await f.addMembership(target.id,account.id);
  const targetJar=(await f.signIn(target.email)).jar;
  await f.enrollTotp(targetJar,password);
  return {f,actor,target,targetJar,verifying,release};
}
async function adminProof(f:TestAuthHarness,actor:Awaited<ReturnType<typeof setup>>["actor"]) {
  const request=new Request(`${TEST_BASE_URL}/api/auth/reauth`,{method:"POST",headers:actor.jar.headers({origin:TEST_BASE_URL,"content-type":"application/json"}),body:"{}"});
  const grant=await reauthenticate(f.auth,f.master,actor.source,request,{purpose:"admin.recovery",currentPassword:password,totpCode:totpFromUri(actor.factor.totpURI)},createRateLimiter({max:50}));
  request.headers.set("x-noctua-reauth",grant.grant);
  return request;
}

test("admin session revocation proceeds while a sign-in is still verifying, and that sign-in cannot finish",async()=>{
  const {f,actor,target,verifying,release}=await setup();
  process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
  const jar=new CookieJar();
  const login=f.auth.handler(new Request(`${TEST_BASE_URL}/api/ba/sign-in/imap`,{method:"POST",
    headers:jar.headers({origin:TEST_BASE_URL,"content-type":"application/json","x-forwarded-for":"synthetic-source"}),
    body:JSON.stringify({email:target.email,password:"new-synthetic-secret"})}));
  await verifying;
  expect(f.master.prepare(`SELECT action FROM admin_lifecycle_operations WHERE slot=?`).get(`security:${target.id}`)?.action).toBe("security.login");
  const generation=f.master.prepare(`SELECT generation FROM auth_security_state WHERE userId=?`).get(target.id).generation;
  await expect(mutateAdminSecurity(f.master,actor.source,await adminProof(f,actor),target.id,{},"sessions-revoke")).resolves.toEqual({ok:true});
  expect(f.master.prepare(`SELECT generation FROM auth_security_state WHERE userId=?`).get(target.id).generation).toBeGreaterThan(generation);
  release();
  const response=await login;
  expect(response.ok).toBe(false);
  expect(f.master.prepare(`SELECT count(*) n FROM auth_pending_challenges WHERE userId=?`).get(target.id).n).toBe(0);
  expect(f.master.prepare(`SELECT count(*) n FROM auth_session s JOIN auth_session_security p ON p.sessionId=s.id WHERE s.userId=?`).get(target.id).n).toBe(0);
  expect(f.master.prepare(`SELECT count(*) n FROM admin_lifecycle_operations WHERE slot IS NOT NULL`).get().n).toBe(0);
});

test("other pending security operations still hold the target slot",async()=>{
  const {f,actor,target,release}=await setup();
  release();
  const busy=await reserveSecurityOperation(f.master,target.id,"security.reauth");
  await expect(mutateAdminSecurity(f.master,actor.source,await adminProof(f,actor),target.id,{},"sessions-revoke")).rejects.toThrow("security_operation_pending");
  await finishSecurityOperation(f.master,busy);
});
