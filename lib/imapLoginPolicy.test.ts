import {afterEach,describe,expect,test,spyOn} from "bun:test";
import {twoFactor} from "better-auth/plugins";
import {betterAuth} from "better-auth";
import {imapSignIn} from "./betterAuthImapSignIn";
import {noctuaAuthOptions} from "./betterAuth";
import {eligibleImapLoginMailbox,imapLoginAvailable,verifyEligibleImap} from "./imapLoginPolicy";
import {CookieJar,createTestAuthHarness,TEST_BASE_URL,TEST_SECRET,totpFromUri,type TestAuthHarness} from "./testAuthHarness";
import {persistAccountRow,mapAccountRow} from "./db/rowParsers";
import * as imapAuth from "./mail/imapAuth";
import {reauthenticate,mutateSecurity,hasAppPassword} from "./authSecurity";
import {readSessionSecurity} from "./db/authPolicy";
import {createRateLimiter} from "./rateLimit";
import type {Account} from "./data";

const fixtures:TestAuthHarness[]=[];
const previous=process.env.NOCTUA_IMAP_LOGIN_HOSTS;
afterEach(()=>{for(const f of fixtures.splice(0))f.close();if(previous===undefined)delete process.env.NOCTUA_IMAP_LOGIN_HOSTS;else process.env.NOCTUA_IMAP_LOGIN_HOSTS=previous;});
async function setup() {
  let network=0;
  const f=await createTestAuthHarness(options=>{Object.assign(options.rateLimit,{enabled:false});},{imapVerification:async()=>{network++;return true;}});
  fixtures.push(f);
  const user=await f.createUser(`imap-${crypto.randomUUID()}@example.test`);
  const account={id:crypto.randomUUID(),name:"Synthetic IMAP",avatar:"",email:user.email,ownerUserId:user.id,
    imap:{host:"imap.example.test",port:993,secure:true,user:user.email,password:"old-synthetic-secret"},
    smtp:{host:"smtp.example.test",port:465,secure:true,user:user.email,password:"old-synthetic-secret"}} as Account;
  persistAccountRow(f.master,account);
  await f.addMembership(user.id,account.id);
  const signed=await f.signIn(user.email);
  const factor=await f.enrollTotp(signed.jar,"synthetic-password-123");
  return {...f,user,account,factor,network:()=>network};
}
async function login(f:TestAuthHarness,email:string,jar=new CookieJar(),password="new-synthetic-secret") {
  const response=await f.auth.handler(new Request(`${TEST_BASE_URL}/api/ba/sign-in/imap`,{method:"POST",headers:jar.headers({origin:TEST_BASE_URL,"content-type":"application/json","x-forwarded-for":`synthetic-${crypto.randomUUID()}`}),body:JSON.stringify({email,password})}));
  jar.absorb(response.headers);
  return {response,jar,body:await response.json().catch(()=>({}))};
}
describe("strict IMAP first-factor gate",()=>{
  test("unset/empty allowlist is OFF before network, session, or write-back, including proof",async()=>{
    const f=await setup();
    for(const value of [undefined,""," , "]) {
      if(value===undefined)delete process.env.NOCTUA_IMAP_LOGIN_HOSTS;else process.env.NOCTUA_IMAP_LOGIN_HOSTS=value;
      expect(imapLoginAvailable()).toBe(false);
      const before=f.master.prepare(`SELECT COUNT(*) n FROM auth_session`).get().n;
      expect((await login(f,f.user.email)).response.status).toBe(401);
      await expect(verifyEligibleImap(f.master,f.user.id,"synthetic",new Request(TEST_BASE_URL),false,async()=>{throw new Error("network must not run");})).rejects.toThrow();
      expect(f.network()).toBe(0);
      expect(f.master.prepare(`SELECT COUNT(*) n FROM auth_session`).get().n).toBe(before);
    }
    expect(eligiblePassword(f)).toBe("old-synthetic-secret");
  });
  test("exact allowlist enables only the owned, TLS, singly linked personal address",async()=>{
    const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
    expect(eligibleImapLoginMailbox(f.master,f.user.id).id).toBe(f.account.id);
    for(const patch of [
      {ownerUserId:undefined}, {email:"shared@example.test"},
      {imap:{...f.account.imap,user:"other@example.test"}},
      {imap:{...f.account.imap,secure:false}},
      {imap:{...f.account.imap,host:"sub.imap.example.test"}}
    ]) {
      persistAccountRow(f.master,{...f.account,...patch});
      expect((await login(f,f.user.email)).response.status).toBe(401);
    }
    persistAccountRow(f.master,f.account);
    const viewer=await f.createUser(`viewer-${crypto.randomUUID()}@example.test`);
    await f.addMembership(viewer.id,f.account.id,"viewer");
    expect((await login(f,f.user.email)).response.status).toBe(401);
    expect(f.network()).toBe(0);
  });
  test("unknown/empty users and multiple eligible mailboxes never reach network",async()=>{
    const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
    expect((await login(f,"unknown@example.test")).response.status).toBe(401);
    const duplicate={...f.account,id:crypto.randomUUID()};
    persistAccountRow(f.master,duplicate);
    expect((await login(f,f.user.email)).response.status).toBe(401);
    f.master.prepare(`DELETE FROM accounts WHERE id=?`).run(duplicate.id);
    const noMailbox=await f.createUser(`no-mailbox-${crypto.randomUUID()}@example.test`);
    expect((await login(f,noMailbox.email)).response.status).toBe(401);
    expect(f.network()).toBe(0);
    f.master.prepare(`DELETE FROM auth_user WHERE id=?`).run(f.user.id);
    expect((await login(f,f.user.email)).response.status).toBe(401);
    expect(f.network()).toBe(0);
  });
  test("bridge removes every provisional bearer and binds TOTP after write-back's new generation",async()=>{
    const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
    const {response,body,jar}=await login(f,f.user.email);
    expect(response.status).toBe(200);
    expect(body.twoFactorRedirect).toBe(true);
    expect(body.token).toBeUndefined();
    expect(jar.get("noctua.session_token")).toBeUndefined();
    expect(f.master.prepare(`SELECT COUNT(*) n FROM auth_session WHERE userId=?`).get(f.user.id).n).toBe(0);
    expect(f.network()).toBe(1); // The shared credential service owns the single verification.
    expect(eligiblePassword(f)).toBe("new-synthetic-secret");
    const challenge=f.master.prepare(`SELECT generation FROM auth_pending_challenges WHERE userId=?`).get(f.user.id);
    expect(challenge.generation).toBe(f.master.prepare(`SELECT generation FROM auth_security_state WHERE userId=?`).get(f.user.id).generation);
    const verify=await f.auth.handler(new Request(`${TEST_BASE_URL}/api/ba/two-factor/verify-totp`,{method:"POST",headers:jar.headers({origin:TEST_BASE_URL,"content-type":"application/json"}),body:JSON.stringify({code:totpFromUri(f.factor.totpURI)})}));
    jar.absorb(verify.headers);
    expect(verify.status).toBe(200);
    const session=await f.auth.api.getSession({headers:jar.headers()});
    expect(f.master.prepare(`SELECT assurance FROM auth_session_security WHERE sessionId=?`).get(session!.session.id).assurance).toBe("mfa");
    const second=await login(f,f.user.email,new CookieJar());
    const backup=await f.auth.handler(new Request(`${TEST_BASE_URL}/api/ba/two-factor/verify-backup-code`,{method:"POST",headers:second.jar.headers({origin:TEST_BASE_URL,"content-type":"application/json"}),body:JSON.stringify({code:f.factor.backupCodes[0]})}));
    expect(backup.status).toBe(200);
  });
  test("the personal-identity limiter runs before the sixth network attempt",async()=>{
    const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
    let attempts=0;
    for(let index=0;index<5;index++)await verifyEligibleImap(f.master,f.user.id,"synthetic-secret",
      new Request(TEST_BASE_URL,{headers:{"x-forwarded-for":`synthetic-${crypto.randomUUID()}`}}),false,async()=>{attempts++;return true;});
    await expect(verifyEligibleImap(f.master,f.user.id,"synthetic-secret",new Request(TEST_BASE_URL),false,async()=>{attempts++;return true;})).rejects.toThrow();
    expect(attempts).toBe(5);
  });
  test("version-coupled hook count/matcher and negative control without the bridge",async()=>{
    const plugin=twoFactor();
    expect(plugin.hooks.after).toHaveLength(1);
    expect(plugin.hooks.after[0].matcher({path:"/sign-in/email"} as never)).toBe(true);
    expect(plugin.hooks.after[0].matcher({path:"/sign-in/imap"} as never)).toBe(false);
    const f=await setup();
    const options=noctuaAuthOptions({database:f.database,secret:TEST_SECRET,baseURL:TEST_BASE_URL});
    // Deliberate negative control: the stock twoFactor matcher does NOT apply to custom login paths.
    options.plugins=options.plugins.filter(p=>!["noctua-auth-policy","noctua-imap-sign-in"].includes(p.id)) as typeof options.plugins;
    options.plugins.push(imapSignIn({verifyImap:async()=>true}) as never);
    const unbridged=betterAuth(options);
    const response=await unbridged.handler(new Request(`${TEST_BASE_URL}/api/ba/sign-in/imap`,{method:"POST",headers:{origin:TEST_BASE_URL,"content-type":"application/json"},body:JSON.stringify({email:f.user.email,password:"synthetic"})}));
    const result=await response.json();
    expect(result.token).toBeString();
    expect(f.master.prepare(`SELECT id FROM auth_session WHERE token=?`).get(result.token)).not.toBeNull();
  });
});
function eligiblePassword(f:Awaited<ReturnType<typeof setup>>) {
  // Row parser decrypts the same encrypted credential storage the service uses.
  return eligibleAccount(f).imap.password;
}
function eligibleAccount(f:Awaited<ReturnType<typeof setup>>) {
  return mapAccountRow(f.master.prepare(`SELECT * FROM accounts WHERE id=?`).get(f.account.id));
}

for(const onboarding of [true,false])test(`IMAP-only first-password enrollment succeeds in ${onboarding?"restricted onboarding":"enrolled MFA"}`,async()=>{
  const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
  f.master.prepare("DELETE FROM auth_account WHERE userId=? AND providerId='credential'").run(f.user.id);
  if(onboarding) {
    f.master.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt) VALUES(?,?,?,'migration','complete',1,1)`).run(crypto.randomUUID(),f.user.id,f.user.email);
    f.master.prepare("DELETE FROM auth_two_factor WHERE userId=?").run(f.user.id);
    f.master.prepare("UPDATE auth_user SET twoFactorEnabled=0 WHERE id=?").run(f.user.id);
  }
  const signed=await login(f,f.user.email);
  expect(signed.response.status).toBe(200);
  if(!onboarding) {
    const response=await f.auth.handler(new Request(`${TEST_BASE_URL}/api/ba/two-factor/verify-totp`,{method:"POST",headers:signed.jar.headers({origin:TEST_BASE_URL,"content-type":"application/json"}),body:JSON.stringify({code:totpFromUri(f.factor.totpURI)})}));
    signed.jar.absorb(response.headers);expect(response.status).toBe(200);
  }
  const session=await f.auth.api.getSession({headers:signed.jar.headers()});
  const source=readSessionSecurity(f.master,session!.session.id);
  let checks=0;const verify=spyOn(imapAuth,"verifyImapCredentials").mockImplementation(async()=>{checks++;return true;});
  try {
    const request=new Request(`${TEST_BASE_URL}/api/auth/reauth`,{method:"POST",headers:signed.jar.headers({origin:TEST_BASE_URL,"content-type":"application/json","x-forwarded-for":`synthetic-${crypto.randomUUID()}`}),body:"{}"});
    const proof=await reauthenticate(f.auth,f.master,source,request,{purpose:"password.set",currentPassword:"new-synthetic-secret",...(!onboarding?{totpCode:totpFromUri(f.factor.totpURI)}:{})},createRateLimiter({max:50}));
    expect(checks).toBe(1);
    request.headers.set("x-noctua-reauth",proof.grant);
    const changed=await mutateSecurity(f.auth,f.master,source,request,{newPassword:"synthetic-first-app-password"},"password");
    signed.jar.absorb(changed.headers);
    expect(changed.body.ok).toBe(true);expect(hasAppPassword(f.master,f.user.id)).toBe(true);
    expect(readSessionSecurity(f.master,source.sessionId).assurance).toBe(onboarding?"setup":"mfa");
    const passwordLogin=await f.auth.handler(new Request(`${TEST_BASE_URL}/api/ba/sign-in/email`,{method:"POST",headers:{origin:TEST_BASE_URL,"content-type":"application/json"},body:JSON.stringify({email:f.user.email,password:"synthetic-first-app-password"})}));
    expect(passwordLogin.status).toBe(200);
    expect((await passwordLogin.json()).twoFactorRedirect===true).toBe(!onboarding);
  } finally {verify.mockRestore();}
});
