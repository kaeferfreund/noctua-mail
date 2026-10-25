import {afterEach, describe, expect, test} from "bun:test";
import {CookieJar, createTestAuthHarness, totpFromUri, TEST_BASE_URL, type TestAuthHarness} from "./testAuthHarness";
import {readSessionSecurity, advanceSecurityGeneration, reserveSecurityOperation, finishSecurityOperation,reconcileSecurityOperations} from "./db/authPolicy";
import {reauthenticate, mutateSecurity} from "./authSecurity";
import {createRateLimiter, type RateLimiter} from "./rateLimit";
import {hashProof} from "./authPolicy";

const password = "synthetic-policy-password";
const fixtures:TestAuthHarness[]=[];
const limiters=new WeakMap<object,RateLimiter>();
async function fixture() {
  const f=await createTestAuthHarness(options=>{Object.assign(options.rateLimit,{enabled:false});});
  fixtures.push(f);
  limiters.set(f.auth,createRateLimiter({windowMs:60000,max:50}));
  const user=await f.createUser(`policy-${crypto.randomUUID()}@example.test`,password);
  return {...f,user};
}
afterEach(()=>{for(const f of fixtures.splice(0))f.close();});
function request(jar:CookieJar,body:unknown={},extra:Record<string,string>={}) {
  return new Request(`${TEST_BASE_URL}/api/auth/reauth`,{method:"POST",headers:jar.headers({origin:TEST_BASE_URL,"content-type":"application/json",...extra}),body:JSON.stringify(body)});
}
async function http(f:TestAuthHarness,jar:CookieJar,path:string,body?:unknown,grant?:string) {
  const res=await f.auth.handler(new Request(`${TEST_BASE_URL}/api/ba${path}`,{
    method:body===undefined?"GET":"POST",headers:jar.headers({origin:TEST_BASE_URL,"content-type":"application/json",...(grant?{"x-noctua-reauth":grant}:{})}),
    ...(body===undefined?{}:{body:JSON.stringify(body)})}));
  jar.absorb(res.headers);
  return {status:res.status,body:await res.json().catch(()=>({})),headers:res.headers};
}
async function source(f:TestAuthHarness,jar:CookieJar) {
  const result=await f.auth.api.getSession({headers:jar.headers()});
  if(!result)throw new Error("Missing session");
  return readSessionSecurity(f.master,result.session.id);
}
async function login(f:TestAuthHarness,email:string,jar=new CookieJar()) {
  const result=await http(f,jar,"/sign-in/email",{email,password});
  expect(result.status).toBe(200);
  return jar;
}
async function proof(f:TestAuthHarness,jar:CookieJar,body:unknown) {
  return reauthenticate(f.auth,f.master,await source(f,jar),request(jar),body,limiters.get(f.auth));
}
async function enroll(f:TestAuthHarness,jar:CookieJar) {
  const grant=await proof(f,jar,{purpose:"totp.enroll",currentPassword:password});
  const enabled=await http(f,jar,"/two-factor/enable",{password},grant.grant);
  expect(enabled.status).toBe(200);
  const verified=await http(f,jar,"/two-factor/verify-totp",{code:totpFromUri(enabled.body.totpURI)},grant.grant);
  expect(verified.status).toBe(200);
  return enabled.body as {totpURI:string;backupCodes:string[]};
}
async function enrolled() {
  const f=await fixture();
  const jar=await login(f,f.user.email);
  const factors=await enroll(f,jar);
  return {...f,jar,factors};
}

describe("HTTP assurance and purpose-bound factors",()=>{
  test("reconciliation repairs flag-only activation into fresh-proof restricted setup",async()=>{
    const f=await fixture(),jar=await login(f,f.user.email);
    const grant=await proof(f,jar,{purpose:"totp.enroll",currentPassword:password});
    const seed=await http(f,jar,"/two-factor/enable",{password},grant.grant);
    f.master.exec("CREATE TRIGGER fail_verified BEFORE UPDATE OF verified ON auth_two_factor WHEN NEW.verified=1 BEGIN SELECT RAISE(ABORT,'synthetic verified fault'); END");
    expect((await http(f,jar,"/two-factor/verify-totp",{code:totpFromUri(seed.body.totpURI)},grant.grant)).status).not.toBe(200);
    expect(f.master.prepare('SELECT twoFactorEnabled FROM auth_user WHERE id=?').get(f.user.id).twoFactorEnabled).toBe(1);
    f.master.exec('DROP TRIGGER fail_verified');
    await reconcileSecurityOperations(f.master,Date.now()+1);
    const next=new CookieJar();
    const signed=await http(f,next,"/sign-in/email",{email:f.user.email,password});
    expect(signed.body.twoFactorRedirect).not.toBe(true);
    expect((await source(f,next)).assurance).toBe("setup");
    expect((await http(f,next,"/two-factor/enable",{password},grant.grant)).status).not.toBe(200);
    await enroll(f,next);
    expect((await source(f,next)).assurance).toBe("mfa");
  });

  test("two sessions before enrollment: only the proving rotated session is promoted",async()=>{
    const f=await fixture();
    const a=await login(f,f.user.email),b=await login(f,f.user.email);
    const oldA=(await source(f,a)).sessionId;
    expect((await source(f,b)).assurance).toBe("setup");
    await enroll(f,a);
    expect((await source(f,a)).assurance).toBe("mfa");
    expect((await source(f,a)).sessionId).not.toBe(oldA);
    expect(await f.auth.api.getSession({headers:b.headers()})).toBeNull();
    expect(f.master.prepare(`SELECT COUNT(*) n FROM auth_session WHERE userId=?`).get(f.user.id).n).toBe(1);
  });
  test("stolen passwordless setup session cannot export a seed or generate backup codes",async()=>{
    const f=await fixture();
    f.master.prepare(`DELETE FROM auth_account WHERE userId=?`).run(f.user.id);
    const session=await (await f.auth.$context).internalAdapter.createSession(f.user.id);
    // Real cookie issuance via the original password fixture first is tested above; retain a signed cookie here.
    expect(session).not.toBeNull();
    const g=await fixture();
    const jar=await login(g,g.user.email);
    g.master.prepare(`DELETE FROM auth_account WHERE userId=?`).run(g.user.id);
    // Rebind setup to its current generation as an IMAP-only migration fixture would.
    const current=await g.auth.api.getSession({headers:jar.headers()});
    await g.seedSessionSecurity(current!.session.id,g.user.id,"setup","imap");
    for(const path of ["/two-factor/enable","/two-factor/get-totp-uri","/two-factor/generate-backup-codes","/two-factor/disable"]) {
      expect((await http(g,jar,path,{})).status).not.toBe(200);
    }
    expect(g.master.prepare(`SELECT * FROM auth_two_factor WHERE userId=?`).get(g.user.id)).toBeNull();
    await expect(proof(g,jar,{purpose:"totp.enroll"})).rejects.toThrow();
  });
  test("fault in verified-record write never authorizes the flag-only session",async()=>{
    const f=await fixture(),jar=await login(f,f.user.email);
    const grant=await proof(f,jar,{purpose:"totp.enroll",currentPassword:password});
    const enabled=await http(f,jar,"/two-factor/enable",{password},grant.grant);
    f.master.exec(`CREATE TRIGGER fail_verified BEFORE UPDATE OF verified ON auth_two_factor WHEN NEW.verified=1 BEGIN SELECT RAISE(ABORT,'synthetic fault'); END`);
    expect((await http(f,jar,"/two-factor/verify-totp",{code:totpFromUri(enabled.body.totpURI)},grant.grant)).status).not.toBe(200);
    expect(f.master.prepare(`SELECT COUNT(*) n FROM auth_session_security WHERE userId=? AND assurance='mfa'`).get(f.user.id).n).toBe(0);
    expect(f.master.prepare(`SELECT state FROM admin_lifecycle_operations WHERE slot=?`).get(`security:${f.user.id}`)).not.toBeNull();
  });
  test("missing/generation-stale login registry rejects even a valid TOTP",async()=>{
    const f=await enrolled();
    for(const mode of ["missing","generation"]) {
      const jar=await login(f,f.user.email);
      if(mode==="missing")f.master.prepare(`DELETE FROM auth_pending_challenges WHERE userId=?`).run(f.user.id);
      else {
        const op=await reserveSecurityOperation(f.master,f.user.id,"security.test.revoke");
        f.master.transaction(()=>advanceSecurityGeneration(f.master,f.user.id)).immediate();
        await finishSecurityOperation(f.master,op);
      }
      const response=await http(f,jar,"/two-factor/verify-totp",{code:totpFromUri(f.factors.totpURI)});
      expect(response.status).not.toBe(200);
      expect(await f.auth.api.getSession({headers:jar.headers()})).toBeNull();
    }
  });
  test("raw mutation paths cannot bypass wrappers or opt out of revocation",async()=>{
    const f=await enrolled();
    for(const path of ["/change-password","/update-user","/two-factor/disable","/two-factor/generate-backup-codes","/admin/create-user","/admin/set-user-password"]) {
      const response=await http(f,f.jar,path,{currentPassword:password,newPassword:"new-synthetic-password",revokeOtherSessions:false});
      expect(response.status).not.toBe(200);
    }
    expect((await http(f,f.jar,"/two-factor/verify-totp",{code:totpFromUri(f.factors.totpURI),trustDevice:true})).status).not.toBe(200);
  });
  test("grants bind purpose/session/generation and failed mutations spend them",async()=>{
    const f=await enrolled();
    const grant=await proof(f,f.jar,{purpose:"backup.regenerate",currentPassword:password,totpCode:totpFromUri(f.factors.totpURI)});
    await expect(mutateSecurity(f.auth,f.master,await source(f,f.jar),request(f.jar,{}, {"x-noctua-reauth":grant.grant}),{currentPassword:password,newPassword:"changed-synthetic-password"},"password")).rejects.toThrow();
    expect(f.master.prepare(`SELECT 1 FROM auth_reauth_grants WHERE tokenHash=?`).get(hashProof(grant.grant))).not.toBeNull();
  });
  test("password rotation on a session authenticated days ago preserves its authentication time and revokes other sessions",async()=>{
    const f=await enrolled();
    const b=await login(f,f.user.email);
    expect((await http(f,b,"/two-factor/verify-totp",{code:totpFromUri(f.factors.totpURI)})).status).toBe(200);
    const original=await source(f,f.jar);
    const oldTime=Date.now()-4*86400_000;
    f.master.prepare(`UPDATE auth_session_security SET authenticatedAt=? WHERE sessionId=?`).run(oldTime,original.sessionId);
    f.master.prepare(`UPDATE auth_session SET createdAt=? WHERE id=?`).run(new Date(oldTime).toISOString(),original.sessionId);
    const grant=await proof(f,f.jar,{purpose:"password.change",currentPassword:password,totpCode:totpFromUri(f.factors.totpURI)});
    const changed=await mutateSecurity(f.auth,f.master,await source(f,f.jar),request(f.jar,{}, {"x-noctua-reauth":grant.grant}),{currentPassword:password,newPassword:"changed-synthetic-password"},"password");
    f.jar.absorb(changed.headers);
    const current=await source(f,f.jar);
    expect(current.authenticatedAt).toBe(oldTime);
    expect(current.assurance).toBe("mfa");
    expect(await f.auth.api.getSession({headers:b.headers()})).toBeNull();
    expect(f.master.prepare(`SELECT * FROM auth_session_security WHERE sessionId=?`).get(original.sessionId)).toBeNull();
  });
  test("two simultaneous backup-code proofs produce one grant and consume once",async()=>{
    const f=await enrolled();
    const input={purpose:"totp.replace",currentPassword:password,backupCode:f.factors.backupCodes[1]};
    const results=await Promise.allSettled([proof(f,f.jar,input),proof(f,f.jar,input)]);
    expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
    await expect(proof(f,f.jar,input)).rejects.toThrow();
  });
  test("pinned library backup-code CAS itself admits only one concurrent consumer",async()=>{
    const f=await enrolled();
    const consume=()=>f.auth.api.verifyBackupCode({headers:f.jar.headers(),body:{code:f.factors.backupCodes[3],disableSession:true}});
    const results=await Promise.allSettled([consume(),consume()]);
    expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
    await expect(consume()).rejects.toThrow();
  });
  test("interrupted replacement stays restricted and reconciliation requires a new password proof",async()=>{
    const f=await enrolled();
    const grant=await proof(f,f.jar,{purpose:"totp.replace",currentPassword:password,backupCode:f.factors.backupCodes[1]});
    const replacement=await mutateSecurity(f.auth,f.master,await source(f,f.jar),request(f.jar,{}, {"x-noctua-reauth":grant.grant}),{currentPassword:password},"totp-replace");
    f.jar.absorb(replacement.headers);
    expect((await source(f,f.jar)).assurance).toBe("setup");
    expect(f.master.prepare(`SELECT twoFactorEnabled FROM auth_user WHERE id=?`).get(f.user.id).twoFactorEnabled).toBe(0);
    await expect(proof(f,f.jar,{purpose:"totp.enroll",currentPassword:"wrong-synthetic-password"})).rejects.toThrow();
    await reconcileSecurityOperations(f.master,Date.now()+1);
    expect(await f.auth.api.getSession({headers:f.jar.headers()})).toBeNull();
    const next=await login(f,f.user.email);
    expect((await source(f,next)).assurance).toBe("setup");
    expect((await http(f,next,"/two-factor/enable",{password},replacement.body.grant as string)).status).not.toBe(200);
    await enroll(f,next);
    expect((await source(f,next)).assurance).toBe("mfa");
  });
  test("each activation write/finalizer fault reconciles and permits fresh enrollment",async()=>{
    for(const boundary of ["flag","session","verified","finalizer"]) {
      const f=await fixture(),jar=await login(f,f.user.email);
      const grant=await proof(f,jar,{purpose:"totp.enroll",currentPassword:password});
      const enabled=await http(f,jar,"/two-factor/enable",{password},grant.grant);
      const event=boundary==="flag"?"BEFORE UPDATE OF twoFactorEnabled ON auth_user WHEN NEW.twoFactorEnabled=1":
        boundary==="session"?"BEFORE INSERT ON auth_session":
        boundary==="verified"?"BEFORE UPDATE OF verified ON auth_two_factor WHEN NEW.verified=1":
        "BEFORE INSERT ON auth_session_security WHEN NEW.assurance='mfa'";
      f.master.exec(`CREATE TRIGGER synthetic_activation_fault ${event} BEGIN SELECT RAISE(ABORT,'synthetic activation fault'); END`);
      expect((await http(f,jar,"/two-factor/verify-totp",{code:totpFromUri(enabled.body.totpURI)},grant.grant)).status).not.toBe(200);
      expect(f.master.prepare(`SELECT COUNT(*) n FROM auth_session_security WHERE userId=? AND assurance='mfa'`).get(f.user.id).n).toBe(0);
      expect(f.master.prepare(`SELECT 1 FROM admin_lifecycle_operations WHERE slot=?`).get(`security:${f.user.id}`)).not.toBeNull();
      await expect(proof(f,jar,{purpose:"totp.enroll",currentPassword:password})).rejects.toThrow();
      f.master.exec("DROP TRIGGER synthetic_activation_fault");
      await reconcileSecurityOperations(f.master,Date.now()+1);
      expect(await f.auth.api.getSession({headers:jar.headers()})).toBeNull();
      const next=await login(f,f.user.email);
      if(boundary === "finalizer") {
        // Both factor writes committed: reconciliation must preserve the healthy factor.
        expect(f.master.prepare(`SELECT verified FROM auth_two_factor WHERE userId=?`).get(f.user.id).verified).toBe(1);
        expect((await http(f,next,"/two-factor/verify-totp",{code:totpFromUri(enabled.body.totpURI)})).status).toBe(200);
        const fresh=await proof(f,next,{purpose:"totp.replace",currentPassword:password,totpCode:totpFromUri(enabled.body.totpURI)});
        const replaced=await mutateSecurity(f.auth,f.master,await source(f,next),request(next,{}, {"x-noctua-reauth":fresh.grant}),{currentPassword:password},"totp-replace");
        next.absorb(replaced.headers);
      } else expect((await source(f,next)).assurance).toBe("setup");
      await enroll(f,next);
      expect((await source(f,next)).assurance).toBe("mfa");
    }
  });
  test("backup regeneration binds session, expires and is consumed once; revokes old codes",async()=>{
    const f=await enrolled();
    const a=await source(f,f.jar),other=await login(f,f.user.email);
    await http(f,other,"/two-factor/verify-totp",{code:totpFromUri(f.factors.totpURI)});
    const input={purpose:"backup.regenerate",currentPassword:password,totpCode:totpFromUri(f.factors.totpURI)};
    const bound=await proof(f,f.jar,input);
    await expect(mutateSecurity(f.auth,f.master,await source(f,other),request(other,{}, {"x-noctua-reauth":bound.grant}),{currentPassword:password},"backup-codes")).rejects.toThrow();
    f.master.prepare(`UPDATE auth_reauth_grants SET expiresAt=0 WHERE tokenHash=?`).run(hashProof(bound.grant));
    await expect(mutateSecurity(f.auth,f.master,a,request(f.jar,{}, {"x-noctua-reauth":bound.grant}),{currentPassword:password},"backup-codes")).rejects.toThrow();
    const fresh=await proof(f,f.jar,input);
    const result=await mutateSecurity(f.auth,f.master,a,request(f.jar,{}, {"x-noctua-reauth":fresh.grant}),{currentPassword:password},"backup-codes");
    expect(result.body.backupCodes).toHaveLength(10);
    expect((await source(f,f.jar)).authenticatedAt).toBe(a.authenticatedAt);
    expect(await f.auth.api.getSession({headers:other.headers()})).toBeNull();
    await expect(mutateSecurity(f.auth,f.master,await source(f,f.jar),request(f.jar,{}, {"x-noctua-reauth":fresh.grant}),{currentPassword:password},"backup-codes")).rejects.toThrow();
    const next=await login(f,f.user.email);
    expect((await http(f,next,"/two-factor/verify-backup-code",{code:f.factors.backupCodes[2]})).status).not.toBe(200);
  });
  test("lost phone: backup login, new backup proof, replacement, real new TOTP and next login",async()=>{
    const f=await enrolled();
    const oldSession=await source(f,f.jar);
    const jar=await login(f,f.user.email);
    expect((await http(f,jar,"/two-factor/verify-backup-code",{code:f.factors.backupCodes[0]})).status).toBe(200);
    expect((await source(f,jar)).assurance).toBe("mfa");
    await expect(proof(f,jar,{purpose:"totp.replace",currentPassword:password,backupCode:f.factors.backupCodes[0]})).rejects.toThrow();
    const grant=await proof(f,jar,{purpose:"totp.replace",currentPassword:password,backupCode:f.factors.backupCodes[1]});
    const replacement=await mutateSecurity(f.auth,f.master,await source(f,jar),request(jar,{}, {"x-noctua-reauth":grant.grant}),{currentPassword:password},"totp-replace");
    jar.absorb(replacement.headers);
    expect((await source(f,jar)).assurance).toBe("setup");
    expect(f.master.prepare(`SELECT * FROM auth_session WHERE id=?`).get(oldSession.sessionId)).toBeNull();
    const continuation=replacement.body.grant as string;
    const enabled=await http(f,jar,"/two-factor/enable",{password},continuation);
    expect(enabled.status).toBe(200);
    expect(enabled.body.totpURI).not.toBe(f.factors.totpURI);
    expect((await http(f,jar,"/two-factor/verify-totp",{code:totpFromUri(enabled.body.totpURI)},continuation)).status).toBe(200);
    expect((await source(f,jar)).assurance).toBe("mfa");
    const next=await login(f,f.user.email);
    expect((await http(f,next,"/two-factor/verify-totp",{code:totpFromUri(f.factors.totpURI)})).status).not.toBe(200);
    expect((await http(f,next,"/two-factor/verify-totp",{code:totpFromUri(enabled.body.totpURI)})).status).toBe(200);
    expect((await source(f,next)).assurance).toBe("mfa");
    const oldCode=await login(f,f.user.email);
    expect((await http(f,oldCode,"/two-factor/verify-backup-code",{code:f.factors.backupCodes[2]})).status).not.toBe(200);
  });
});


describe("setup recovery and production limits",()=>{
  test("enable password typo releases the slot and correct fresh proof retries immediately",async()=>{
    const f=await fixture(),jar=await login(f,f.user.email);
    const g=await proof(f,jar,{purpose:"totp.enroll",currentPassword:password});
    const rejected=await http(f,jar,"/two-factor/enable",{password:"synthetic-typo"},g.grant);
    expect(rejected.body.code).toBe("INVALID_PASSWORD");
    expect(f.master.prepare("SELECT 1 FROM admin_lifecycle_operations WHERE slot=?").get(`security:${f.user.id}`)).toBeNull();
    expect(f.master.prepare("SELECT 1 FROM auth_two_factor WHERE userId=?").get(f.user.id)).toBeNull();
    await enroll(f,jar);
    expect((await source(f,jar)).assurance).toBe("mfa");
  });
  for(const expired of [false,true])test(`fresh proof abandons ${expired?"expired":"live"} seed but wrong proof cannot`,async()=>{
    const f=await fixture(),jar=await login(f,f.user.email);
    const g=await proof(f,jar,{purpose:"totp.enroll",currentPassword:password});
    const old=await http(f,jar,"/two-factor/enable",{password},g.grant);
    if(expired)f.master.prepare("UPDATE auth_reauth_grants SET expiresAt=0 WHERE userId=?").run(f.user.id);
    await expect(proof(f,jar,{purpose:"totp.enroll",currentPassword:"synthetic-wrong"})).rejects.toThrow();
    expect(f.master.prepare("SELECT state FROM admin_lifecycle_operations WHERE slot=?").get(`security:${f.user.id}`).state).toBe("totp_seed_issued");
    const fresh=await proof(f,jar,{purpose:"totp.enroll",currentPassword:password});
    expect(f.master.prepare("SELECT 1 FROM auth_two_factor WHERE userId=?").get(f.user.id)).toBeNull();
    expect((await http(f,jar,"/two-factor/verify-totp",{code:totpFromUri(old.body.totpURI)},g.grant)).status).not.toBe(200);
    const seed=await http(f,jar,"/two-factor/enable",{password},fresh.grant);
    expect(seed.status).toBe(200);
    expect((await http(f,jar,"/two-factor/verify-totp",{code:totpFromUri(seed.body.totpURI)},fresh.grant)).status).toBe(200);
  });
  test("expired and locked login challenges cannot create sessions",async()=>{
    const f=await enrolled();
    const expired=await login(f,f.user.email);
    f.master.prepare("UPDATE auth_pending_challenges SET expiresAt=0 WHERE userId=?").run(f.user.id);
    expect((await http(f,expired,"/two-factor/verify-totp",{code:totpFromUri(f.factors.totpURI)})).body.code).toBe("invalid_challenge");
    expect(await f.auth.api.getSession({headers:expired.headers()})).toBeNull();
    const locked=await login(f,f.user.email);
    f.master.prepare("UPDATE auth_two_factor SET lockedUntil=? WHERE userId=?").run(new Date(Date.now()+900000).toISOString(),f.user.id);
    const rejected=await http(f,locked,"/two-factor/verify-totp",{code:totpFromUri(f.factors.totpURI)});
    expect(rejected.status).toBe(429);expect(rejected.body.code).toBe("ACCOUNT_TEMPORARILY_LOCKED");
    expect(await f.auth.api.getSession({headers:locked.headers()})).toBeNull();
  });
  test("production library two-factor limits reject the fourth HTTP attempt",async()=>{
    const f=await createTestAuthHarness(undefined,{}, {libraryRateLimits:true});fixtures.push(f);
    const ip=`synthetic-${crypto.randomUUID()}`;
    for(let i=0;i<4;i++) {
      const res=await f.auth.handler(new Request(`${TEST_BASE_URL}/api/ba/two-factor/verify-totp`,{method:"POST",headers:{origin:TEST_BASE_URL,"content-type":"application/json","x-forwarded-for":ip},body:JSON.stringify({code:"000000"})}));
      expect(res.status).toBe(i===3?429:403);
    }
  });
});

test("a concurrent activation rejection cannot cancel the request holding the seed slot",async()=>{
  const f=await fixture(),jar=await login(f,f.user.email);
  const g=await proof(f,jar,{purpose:"totp.enroll",currentPassword:password});
  const enabled=await http(f,jar,"/two-factor/enable",{password},g.grant);
  const results=await Promise.all([0,1].map(()=>http(f,jar,"/two-factor/verify-totp",{code:totpFromUri(enabled.body.totpURI)},g.grant)));
  expect(results.filter(result=>result.status===200)).toHaveLength(1);
  expect((await source(f,jar)).assurance).toBe("mfa");
  expect(f.master.prepare("SELECT 1 FROM admin_lifecycle_operations WHERE slot=?").get(`security:${f.user.id}`)).toBeNull();
});
