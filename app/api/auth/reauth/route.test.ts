import {describe,expect,test} from "bun:test";
import {POST} from "./route";
import {POST as passwordChange} from "../security/password/route";
import {GET as security} from "../security/route";
import {GET as methods} from "../methods/route";
import {createAuthenticatedTestSession} from "@/lib/testAuthHarness";
import {POST as revoke} from "../security/sessions/revoke/route";
import {POST as rename} from "../security/passkeys/rename/route";
import {readSessionSecurity} from "../../../../lib/db/authPolicy";
import {reauthenticate} from "@/lib/authSecurity";
import {createRateLimiter} from "@/lib/rateLimit";
import {totpFromUri,CookieJar} from "@/lib/testAuthHarness";
import {registerAuthStream} from "@/lib/authStreams";
import {getRequestIp} from "@/lib/rateLimit";
function request(cookie:string,body:unknown,origin="http://localhost:3000") {
  return new Request("http://localhost:3000/api/auth/reauth",{method:"POST",headers:{cookie,origin,"content-type":"application/json","x-forwarded-for":`synthetic-${crypto.randomUUID()}`},body:JSON.stringify(body)});
}
describe("Noctua security HTTP wrappers",()=>{
  test("origin and field guards fail locally; failed proof preserves the active session",async()=>{
    const f=await createAuthenticatedTestSession();
    expect((await POST(request(f.jar.header(),{},"https://foreign.example.test"))).status).toBe(403);
    const input={purpose:"password.change",currentPassword:"wrong-synthetic-password",totpCode:"000000"};
    const result=await POST(request(f.jar.header(),input));
    expect(result.status).toBe(403);
    expect((await result.json()).code).toBe("invalid_proof");
    expect(await f.auth.api.getSession({headers:f.jar.headers()})).not.toBeNull();
    const status=await security(new Request("http://localhost:3000/api/auth/security",{headers:f.jar.headers()}));
    expect((await status.json())).toMatchObject({ok:true,hasPassword:true,totpEnrolled:true,mfaStateInconsistent:false,passkeys:[]});
    expect((await passwordChange(request(f.jar.header(),{newPassword:"new-synthetic-password",revokeOtherSessions:false}))).status).toBe(400);
  });
  test("public method availability never includes an allowlist",async()=>{
    const result=await methods().json();
    expect(Object.keys(result.methods).sort()).toEqual(["imap","passkey","password"]);
    expect(typeof result.methods.imap).toBe("boolean");
    expect(JSON.stringify(result)).not.toContain("HOSTS");
    expect(getRequestIp(request("",{}))).toStartWith("synthetic-");
  });
});

async function factor(f:Awaited<ReturnType<typeof createAuthenticatedTestSession>>) {
  return (await f.auth.api.getTOTPURI({headers:f.jar.headers(),body:{password:"synthetic-password-123"}})).totpURI;
}
async function fresh(f:Awaited<ReturnType<typeof createAuthenticatedTestSession>>,purpose:"sessions.revoke"|"passkey.rename") {
  const session=await f.auth.api.getSession({headers:f.jar.headers()});
  return reauthenticate(f.auth,f.master,readSessionSecurity(f.master,session!.session.id),request(f.jar.header(),{}),
    {purpose,currentPassword:"synthetic-password-123",totpCode:totpFromUri(await factor(f))},createRateLimiter({max:50}));
}
function authorized(cookie:string,body:unknown,grant:string) {
  const req=request(cookie,body);req.headers.set("x-noctua-reauth",grant);return req;
}
test("wrong password, TOTP and backup proof are 403 invalid_proof; sixth proof is HTTP 429",async()=>{
  const f=await createAuthenticatedTestSession();
  const wrong=totpFromUri(await factor(f),Date.now()-3600000);
  for(const input of [
    {purpose:"password.change",currentPassword:"synthetic-wrong"},
    {purpose:"password.change",currentPassword:"synthetic-password-123",totpCode:wrong},
    {purpose:"totp.replace",currentPassword:"synthetic-password-123",backupCode:"synthetic-invalid-code"}
  ]) {
    const result=await POST(request(f.jar.header(),input));
    expect(result.status).toBe(403);expect(await result.json()).toEqual({ok:false,code:"invalid_proof"});
    expect(await f.auth.api.getSession({headers:f.jar.headers()})).not.toBeNull();
  }
  for(let i=0;i<2;i++)expect((await POST(request(f.jar.header(),{purpose:"password.change",currentPassword:"synthetic-wrong"}))).status).toBe(403);
  const limited=await POST(request(f.jar.header(),{purpose:"password.change",currentPassword:"synthetic-password-123",totpCode:totpFromUri(await factor(f))}));
  expect(limited.status).toBe(429);expect(limited.headers.get("retry-after")).toBe("60");
  expect(await limited.json()).toEqual({ok:false,code:"proof_rate_limited"});
  expect((await POST(request("",{purpose:"password.change"}))).status).toBe(401);
});

test("session DTO and revoke-one/all/current enforce ownership, proof, cleanup and cookies",async()=>{
  const f=await createAuthenticatedTestSession(),other=await createAuthenticatedTestSession();
  const pending=await f.auth.api.signInEmail({body:{email:f.user.email,password:"synthetic-password-123"},returnHeaders:true});
  const jar=new CookieJar().absorb(pending.headers);
  const verified=await f.auth.api.verifyTOTP({headers:jar.headers(),body:{code:totpFromUri(await factor(f))},returnHeaders:true});jar.absorb(verified.headers);
  const b=await f.auth.api.getSession({headers:jar.headers()});
  await f.seedSessionSecurity(b!.session.id,f.user.id,"mfa","password_totp");
  const dto=await (await security(new Request("http://localhost:3000/api/auth/security",{headers:f.jar.headers()}))).json();
  expect(dto.sessions).toHaveLength(2);
  expect(dto.sessions.find((s:{id:string})=>s.id===f.session.id).current).toBe(true);
  expect(dto.sessions.find((s:{id:string})=>s.id===b!.session.id).current).toBe(false);
  for(const item of dto.sessions)expect(Object.keys(item).sort().every(key=>["id","current","createdAt","updatedAt","userAgent","ip"].includes(key))).toBe(true);
  expect(JSON.stringify(dto)).not.toContain(f.session.token);expect(JSON.stringify(dto)).not.toContain(b!.session.token);
  expect((await revoke(request(f.jar.header(),{sessionId:b!.session.id}))).status).toBe(403);
  const foreignProof=await fresh(f,"sessions.revoke");
  expect((await revoke(authorized(f.jar.header(),{sessionId:other.session.id},foreignProof.grant))).status).toBe(404);
  const bProof=await reauthenticate(f.auth,f.master,readSessionSecurity(f.master,b!.session.id),request(jar.header(),{}),{purpose:"passkey.enroll",currentPassword:"synthetic-password-123",totpCode:totpFromUri(await factor(f))},createRateLimiter({max:50}));
  const opts=await f.auth.handler(new Request("http://localhost:3000/api/ba/passkey/generate-register-options",{headers:jar.headers({"x-noctua-reauth":bProof.grant})}));expect(opts.status).toBe(200);
  let closed=0;
  const stream=registerAuthStream(readSessionSecurity(f.master,b!.session.id),()=>{closed++;});
  try {
    const g=await fresh(f,"sessions.revoke");
    expect((await revoke(authorized(f.jar.header(),{sessionId:b!.session.id},g.grant))).status).toBe(200);
    expect(closed).toBe(1);expect(await f.auth.api.getSession({headers:jar.headers()})).toBeNull();
    expect(f.master.prepare("SELECT 1 FROM auth_reauth_grants WHERE sessionId=?").get(b!.session.id)).toBeNull();
    expect(f.master.prepare("SELECT 1 FROM auth_pending_challenges WHERE sourceSessionId=?").get(b!.session.id)).toBeNull();
    expect(await f.auth.api.getSession({headers:f.jar.headers()})).not.toBeNull();
    const extra=await f.auth.api.signInEmail({body:{email:f.user.email,password:"synthetic-password-123"},returnHeaders:true});
    const extraJar=new CookieJar().absorb(extra.headers);
    const extraVerified=await f.auth.api.verifyTOTP({headers:extraJar.headers(),body:{code:totpFromUri(await factor(f))},returnHeaders:true});extraJar.absorb(extraVerified.headers);
    const extraSession=await f.auth.api.getSession({headers:extraJar.headers()});
    await f.seedSessionSecurity(extraSession!.session.id,f.user.id,"mfa","password_totp");
    const all=await fresh(f,"sessions.revoke");
    expect((await revoke(authorized(f.jar.header(),{all:true},all.grant))).status).toBe(200);
    expect(await f.auth.api.getSession({headers:extraJar.headers()})).toBeNull();
    expect(await f.auth.api.getSession({headers:f.jar.headers()})).not.toBeNull();
    const current=await fresh(f,"sessions.revoke");
    const result=await revoke(authorized(f.jar.header(),{sessionId:f.session.id},current.grant));
    expect(result.status).toBe(200);expect(result.headers.getSetCookie().some(c=>c.includes("Max-Age=0"))).toBe(true);
    expect(await f.auth.api.getSession({headers:f.jar.headers()})).toBeNull();
    expect(await other.auth.api.getSession({headers:other.jar.headers()})).not.toBeNull();
  } finally {stream.close();}
});

test("passkey rename checks its own purpose, ownership, strict name and disabled raw path",async()=>{
  const f=await createAuthenticatedTestSession(),other=await createAuthenticatedTestSession();
  const context=await f.auth.$context;
  const make=(userId:string)=>context.adapter.create({model:"passkey",data:{userId,name:"Synthetic key",credentialID:crypto.randomUUID(),publicKey:"synthetic",counter:0,deviceType:"singleDevice",backedUp:false,createdAt:new Date()}});
  const own=await make(f.user.id),foreign=await make(other.user.id);
  expect((await rename(request(f.jar.header(),{passkeyId:own.id,name:"New synthetic name"}))).status).toBe(403);
  const bad=await fresh(f,"passkey.rename");
  expect((await rename(authorized(f.jar.header(),{passkeyId:foreign.id,name:"New synthetic name"},bad.grant))).status).toBe(404);
  const good=await fresh(f,"passkey.rename");
  expect((await rename(authorized(f.jar.header(),{passkeyId:own.id,name:"  New synthetic name  "},good.grant))).status).toBe(200);
  expect(f.master.prepare("SELECT name FROM auth_passkey WHERE id=?").get(own.id).name).toBe("New synthetic name");
  expect((await rename(authorized(f.jar.header(),{passkeyId:own.id,name:"Again"},good.grant))).status).toBe(403);
  expect((await rename(request(f.jar.header(),{passkeyId:own.id,name:""}))).status).toBe(400);
  const raw=await f.auth.handler(new Request("http://localhost:3000/api/ba/passkey/update-passkey",{method:"POST",headers:f.jar.headers({origin:"http://localhost:3000","content-type":"application/json"}),body:JSON.stringify({id:own.id,name:"Raw"})}));expect(raw.status).not.toBe(200);
});
