import {afterEach,describe,expect,test,spyOn} from "bun:test";
import {twoFactor} from "better-auth/plugins";
import {betterAuth} from "better-auth";
import {imapSignIn} from "./betterAuthImapSignIn";
import {noctuaAuthOptions} from "./betterAuth";
import {eligibleImapLoginMailbox,imapLoginAvailable,loginSourceBucket,verifyEligibleImap} from "./imapLoginPolicy";
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
  const f=await createTestAuthHarness(options=>{Object.assign(options.rateLimit,{enabled:false});},{imapVerification:async()=>{network++;return "ok" as const;}});
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
  test("anonymous failures cannot lock the real user out; one source is braked after five failures (CF-12)",async()=>{
    const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
    const from=(ip:string)=>new Request(TEST_BASE_URL,{headers:{"x-forwarded-for":ip}});
    const attacker=`synthetic-${crypto.randomUUID()}`;
    let attempts=0;
    const wrong=async()=>{attempts++;return "invalid" as const;};
    for(let index=0;index<5;index++)await expect(verifyEligibleImap(f.master,f.user.id,"wrong",from(attacker),false,wrong)).rejects.toThrow();
    // The attacker's address is braked before the network...
    await expect(verifyEligibleImap(f.master,f.user.id,"wrong",from(attacker),false,wrong)).rejects.toThrow();
    expect(attempts).toBe(5);
    // ...while the real user still signs in from elsewhere, and successes never consume budget.
    let good=0;
    const right=async()=>{good++;return "ok" as const;};
    for(let index=0;index<8;index++)await verifyEligibleImap(f.master,f.user.id,"synthetic-secret",from("synthetic-owner"),false,right);
    expect(good).toBe(8);
  });
  test("the user-wide brake is high, counts only failures and does not cover re-authentication (CF-12)",async()=>{
    const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
    const from=()=>new Request(TEST_BASE_URL,{headers:{"x-forwarded-for":`synthetic-${crypto.randomUUID()}`}});
    let attempts=0;
    for(let index=0;index<50;index++)await expect(verifyEligibleImap(f.master,f.user.id,"wrong",from(),false,async()=>{attempts++;return "invalid" as const;})).rejects.toThrow();
    await expect(verifyEligibleImap(f.master,f.user.id,"synthetic-secret",from(),false,async()=>{attempts++;return "ok" as const;})).rejects.toThrow();
    expect(attempts).toBe(50);
    expect(await verifyEligibleImap(f.master,f.user.id,"synthetic-secret",from(),false,async()=>{attempts++;return "ok" as const;},"reauth")).toBe(true);
    expect(attempts).toBe(51);
  });
  test("IPv6 sources are braked per /64, IPv4-mapped addresses as IPv4 (CF-12)",async()=>{
    expect(loginSourceBucket("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(loginSourceBucket("[2001:DB8:1:2:bbbb::2]")).toBe("2001:db8:1:2::/64");
    expect(loginSourceBucket("::ffff:192.0.2.7")).toBe("192.0.2.7");
    expect(loginSourceBucket("192.0.2.7")).toBe("192.0.2.7");
    const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
    const prefix=`2001:db8:${(Math.random()*0xffff|0).toString(16)}:7`;
    const from=(ip:string)=>new Request(TEST_BASE_URL,{headers:{"x-forwarded-for":ip}});
    let attempts=0;
    const wrong=async()=>{attempts++;return "invalid" as const;};
    for(let index=1;index<=5;index++)await expect(verifyEligibleImap(f.master,f.user.id,"wrong",from(`${prefix}::${index}`),false,wrong)).rejects.toThrow();
    // A fresh address in the same /64 is braked before the network.
    await expect(verifyEligibleImap(f.master,f.user.id,"wrong",from(`${prefix}:1234::99`),false,wrong)).rejects.toThrow();
    expect(attempts).toBe(5);
  });
  test("the user-wide brake never blocks a source that already signed in as this user (CF-12)",async()=>{
    const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
    const from=(ip:string)=>new Request(TEST_BASE_URL,{headers:{"x-forwarded-for":ip}});
    const home=`2001:db8:${(Math.random()*0xffff|0).toString(16)}:1`;
    let good=0;
    const right=async()=>{good++;return "ok" as const;};
    expect(await verifyEligibleImap(f.master,f.user.id,"synthetic-secret",from(`${home}::10`),false,right)).toBe(true);
    // Anonymous failures from many sources fill the user-wide budget...
    for(let index=0;index<50;index++)await expect(verifyEligibleImap(f.master,f.user.id,"wrong",from(`synthetic-${crypto.randomUUID()}`),false,async()=>"invalid" as const)).rejects.toThrow();
    // ...an unknown source is held back (brute-force protection stays)...
    await expect(verifyEligibleImap(f.master,f.user.id,"synthetic-secret",from(`synthetic-${crypto.randomUUID()}`),false,right)).rejects.toThrow();
    expect(good).toBe(1);
    // ...but the real user's network (new address in the same /64) still signs in.
    expect(await verifyEligibleImap(f.master,f.user.id,"synthetic-secret",from(`${home}::20`),false,right)).toBe(true);
    expect(good).toBe(2);
  });
  test("only an accepted IMAP login signs in; a rejected or unjudged one is refused and writes nothing back",async()=>{
    const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
    const from=()=>new Request(TEST_BASE_URL,{headers:{"x-forwarded-for":`synthetic-${crypto.randomUUID()}`}});
    // Both refusals are truthy strings: a boolean test of the result would accept them.
    for(const check of ["invalid","unreachable"] as const)for(const writeBack of [false,true]){
      await expect(verifyEligibleImap(f.master,f.user.id,"new-synthetic-secret",from(),writeBack,async()=>check)).rejects.toMatchObject({code:"invalid_credentials",status:401});
      expect(eligiblePassword(f)).toBe("old-synthetic-secret");
    }
    expect(await verifyEligibleImap(f.master,f.user.id,"new-synthetic-secret",from(),true,async()=>"ok" as const)).toBe(true);
    expect(eligiblePassword(f)).toBe("new-synthetic-secret");
  });
  test("a known user without IMAP login costs the same password hash as an unknown one (DS-18)",async()=>{
    const f=await setup();process.env.NOCTUA_IMAP_LOGIN_HOSTS="imap.example.test";
    const options=noctuaAuthOptions({database:f.database,secret:TEST_SECRET,baseURL:TEST_BASE_URL});
    Object.assign(options.rateLimit!,{enabled:false});
    const hashed:string[]=[];
    const password=options.emailAndPassword!.password!;
    options.emailAndPassword!.password={...password,hash:async(value:string)=>{hashed.push(value);return password.hash!(value);}};
    // Isolate the endpoint: the policy plugin needs the HTTP proof wrapper; production's verifyImap
    // answers false for an ineligible user before any network, which the stub reproduces.
    options.plugins=options.plugins.filter(p=>!["noctua-auth-policy","noctua-imap-sign-in"].includes(p.id)) as typeof options.plugins;
    options.plugins.push(imapSignIn({verifyImap:async()=>false}) as never);
    const auth=betterAuth(options);
    const signIn=(email:string)=>auth.handler(new Request(`${TEST_BASE_URL}/api/ba/sign-in/imap`,{method:"POST",headers:{origin:TEST_BASE_URL,"content-type":"application/json"},body:JSON.stringify({email,password:"synthetic-guess"})}));
    expect((await signIn(f.user.email)).status).toBe(401);
    expect((await signIn(`unknown-${crypto.randomUUID()}@example.test`)).status).toBe(401);
    expect(hashed).toEqual(["synthetic-guess","synthetic-guess"]);
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
  let checks=0;const verify=spyOn(imapAuth,"verifyImapCredentials").mockImplementation(async()=>{checks++;return "ok" as const;});
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
