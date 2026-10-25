import {afterEach,describe,expect,test,spyOn} from "bun:test";
import {CookieJar,createTestAuthHarness,TEST_BASE_URL,totpFromUri,type TestAuthHarness} from "./testAuthHarness";
import {provisionUser} from "./userProvisioning";
import {compensateProvisioning,reconcileProvisioning,reserveProvisioning} from "./db/userProvisioning";
import {issueOnboardingInvite,issueRecovery,updateUserLifecycle,removeUserLifecycle,reconcileLifecycle,mutateAdminSecurity} from "./userLifecycle";
import {reserveLifecycle,finishLifecycle} from "./db/userLifecycle";
import {readGeneration,readSessionSecurity,reconcileSecurityOperations} from "./db/authPolicy";
import {reauthenticate} from "./authSecurity";
import {createRateLimiter} from "./rateLimit";
import {withResetDelivery,redactAuthUrl} from "./authRecoveryContext";
import {persistAccountRow} from "./db/rowParsers";
import {hashMcpToken,validateMcpTokenRow} from "./mcpAuth";
import {withAuthProof} from "./authPolicyContext";

const password="synthetic-slice5-password",nextPassword="synthetic-slice5-replacement";
const fixtures:TestAuthHarness[]=[];
async function setup(options?:Parameters<typeof createTestAuthHarness>[0]){const f=await createTestAuthHarness(options);fixtures.push(f);return f;}
afterEach(()=>{for(const f of fixtures.splice(0))f.close();});
const email=()=>`synthetic-${crypto.randomUUID()}@example.test`;
function invite(f:TestAuthHarness,changes:Record<string,unknown>={}) {
  const row={code:crypto.randomUUID(),role:"user",email:null,maxUses:1,uses:0,expiresAt:Date.now()+60000,...changes};
  f.master.prepare(`INSERT INTO invite_codes(code,role,email,maxUses,uses,expiresAt,createdAt) VALUES(?,?,?,?,?,?,?)`).run(row.code,row.role,row.email,row.maxUses,row.uses,row.expiresAt,Date.now());
  return row.code;
}
function input(code:string,address=email(),account?:unknown){return {inviteCode:code,email:address,password,name:"Synthetic Person",...(account?{account}:{})};}
function mailbox(address=email()) {return {name:"Synthetic Mailbox",email:address,avatar:"",imap:{host:"imap.example.test",port:993,secure:true,user:address,password:"synthetic-imap-secret"},smtp:{host:"smtp.example.test",port:465,secure:true,user:address,password:"synthetic-smtp-secret"}};}
const verified={imap:async()=>true,smtp:async()=>true};
function request(jar=new CookieJar(),body:unknown={},path="/api/auth/reauth") {return new Request(`${TEST_BASE_URL}${path}`,{method:"POST",headers:jar.headers({origin:TEST_BASE_URL,"content-type":"application/json"}),body:JSON.stringify(body)});}
async function http(f:TestAuthHarness,path:string,body?:unknown,jar=new CookieJar()) {
  const req=body===undefined?new Request(`${TEST_BASE_URL}/api/ba${path}`,{headers:jar.headers()}):request(jar,body,`/api/ba${path}`);
  const response=await f.auth.handler(req);jar.absorb(response.headers);return response;
}
async function enrolled(f:TestAuthHarness,role:"admin"|"user"="admin") {
  const user=await f.createUser(email(),password,role),{jar}=await f.signIn(user.email,password);
  const factor=await f.enrollTotp(jar,password),session=await f.auth.api.getSession({headers:jar.headers()});
  await f.seedSessionSecurity(session!.session.id,user.id,"mfa","password_totp");
  const source=readSessionSecurity(f.master,session!.session.id);
  return {user,jar,factor,source};
}
async function adminProof(f:TestAuthHarness,actor:Awaited<ReturnType<typeof enrolled>>) {
  const req=request(actor.jar);
  const grant=await reauthenticate(f.auth,f.master,actor.source,req,{purpose:"admin.recovery",currentPassword:password,totpCode:totpFromUri(actor.factor.totpURI)},createRateLimiter({max:50}));
  req.headers.set("x-noctua-reauth",grant.grant);return req;
}
async function recovery(f:TestAuthHarness,userId:string) {return issueRecovery(f.auth,f.master,"operator",null,userId,{confirmedTarget:true});}
function token(link:string){return new URL(link).pathname.split("/").at(-1)!;}

describe("slice 5 provisioning",()=>{
  for(const mode of ["missing","expired","exhausted","wrong-person","non-admin-bootstrap"])test(`${mode} invite has zero IMAP/SMTP calls and zero reservations`,async()=>{
    const f=await setup(),address=email();let calls=0;
    const code=mode==="missing"?"invalid":invite(f,{role:mode==="non-admin-bootstrap"?"user":"admin",...(mode==="expired"?{expiresAt:0}:mode==="exhausted"?{uses:1}:mode==="wrong-person"?{email:email()}:{})});
    await expect(provisionUser(f.auth,f.master,input(code,address,mailbox()),{imap:async()=>{calls++;return true;},smtp:async()=>{calls++;return true;}})).rejects.toMatchObject({status:mode==="exhausted"?409:403,code:mode==="exhausted"?"invite_exhausted":mode==="non-admin-bootstrap"?"bootstrap_invite_required":"invalid_invite"});
    expect(calls).toBe(0);expect(f.master.prepare(`SELECT count(*) n FROM user_provisioning`).get().n).toBe(0);
  });
  test("all signups require a valid invite; app password has an explicit minimum and no mailbox fallback",async()=>{
    const f=await setup();
    const create=spyOn(f.auth.api,"createUser");
    for(const body of [{email:email(),name:"Synthetic",password}, {...input(invite(f,{role:"admin"})),password:"short"},{...input(invite(f,{role:"admin"})),password:undefined,account:mailbox()}])await expect(provisionUser(f.auth,f.master,body,verified)).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();create.mockRestore();
    await expect(f.auth.api.createUser({body:{email:email(),password,name:"Unscoped"}})).rejects.toThrow("provisioning_required");
  });
  test("legacy identity and existing mailbox conflict before reservation/network",async()=>{
    const f=await setup(),user=await f.createUser(email()),box=mailbox(),legacy=email();
    f.master.prepare(`INSERT INTO users(id,email,role,createdAt) VALUES(?,?,'user',?)`).run(crypto.randomUUID(),legacy,Date.now());
    persistAccountRow(f.master,{...box,id:"synthetic-existing"});let calls=0;
    const shared=mailbox(),member=await f.createUser(email());
    persistAccountRow(f.master,{...shared,id:"synthetic-owned-shared",ownerUserId:user.id});await f.addMembership(member.id,"synthetic-owned-shared");
    const verify={imap:async()=>{calls++;return true;},smtp:async()=>{calls++;return true;}};
    for(const [body,code] of [[input(invite(f),user.email,mailbox()),"user_exists"],[input(invite(f),legacy,mailbox()),"user_exists"],[input(invite(f),email(),box),"mailbox_exists"],[input(invite(f),shared.email),"mailbox_exists"]] as const)await expect(provisionUser(f.auth,f.master,body,verify)).rejects.toMatchObject({status:409,code});
    expect(calls).toBe(0);expect(f.master.prepare(`SELECT count(*) n FROM user_provisioning`).get().n).toBe(0);
  });
  test("first-admin and last invite use each have one winner across awaits",async()=>{
    const f=await setup();
    const first=await Promise.allSettled([provisionUser(f.auth,f.master,input(invite(f,{role:"admin"})),verified),provisionUser(f.auth,f.master,input(invite(f,{role:"admin"})),verified)]);
    expect(first.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    const code=invite(f),results=await Promise.allSettled([provisionUser(f.auth,f.master,input(code),verified),provisionUser(f.auth,f.master,input(code),verified)]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect(f.master.prepare(`SELECT uses FROM invite_codes WHERE code=?`).get(code).uses).toBe(1);
    expect(f.master.prepare(`SELECT count(*) n FROM auth_user WHERE role='admin'`).get().n).toBe(1);
  });
  test("reserve rechecks invite and mailbox after network; complete history releases email",async()=>{
    const f=await setup();await f.createUser(email(),password,"admin");
    const code=invite(f),address=email();
    await expect(provisionUser(f.auth,f.master,input(code,address,mailbox()),{imap:async()=>{f.master.prepare(`UPDATE invite_codes SET expiresAt=0 WHERE code=?`).run(code);return true;},smtp:async()=>true})).rejects.toMatchObject({status:403,code:"invalid_invite"});
    expect(f.master.prepare(`SELECT count(*) n FROM user_provisioning`).get().n).toBe(0);
    const complete=await provisionUser(f.auth,f.master,input(invite(f),address),verified);
    f.master.prepare(`DELETE FROM auth_user WHERE id=?`).run(complete.userId);f.master.prepare(`DELETE FROM users WHERE id=?`).run(complete.userId);
    const repeat=await provisionUser(f.auth,f.master,input(invite(f),address),verified);expect(repeat.userId).not.toBe(complete.userId);
    expect(f.master.prepare(`SELECT count(*) n FROM user_provisioning WHERE normalizedEmail=? AND state='complete'`).get(address).n).toBe(2);
  });
  for(const boundary of ["auth_user","credential","auth_created","mailbox","membership","invite_claim","audit","complete"])test(`compensation after ${boundary} fault releases only its reservation`,async()=>{
    const f=await setup();await f.createUser(email(),password,"admin");
    const code=invite(f),body=input(code,email(),mailbox());
    const event=boundary==="auth_user"?"BEFORE INSERT ON auth_user":boundary==="credential"?"BEFORE INSERT ON auth_account":boundary==="auth_created"?"BEFORE UPDATE ON user_provisioning WHEN NEW.state='auth_created'":boundary==="mailbox"?"BEFORE INSERT ON accounts":boundary==="membership"?"BEFORE INSERT ON user_accounts":boundary==="invite_claim"?"BEFORE UPDATE ON invite_codes":boundary==="audit"?"BEFORE INSERT ON admin_audit":"BEFORE UPDATE ON user_provisioning WHEN NEW.state='complete'";
    f.master.exec(`CREATE TRIGGER synthetic_fault ${event} BEGIN SELECT RAISE(ABORT,'synthetic saga boundary'); END`);
    await expect(provisionUser(f.auth,f.master,body,verified)).rejects.toThrow();
    f.master.exec(`DROP TRIGGER synthetic_fault`);
    expect(f.master.prepare(`SELECT 1 FROM auth_user WHERE email=?`).get(body.email)).toBeNull();
    expect(f.master.prepare(`SELECT uses FROM invite_codes WHERE code=?`).get(code).uses).toBe(0);
    expect(f.master.prepare(`SELECT 1 FROM accounts WHERE email=?`).get((body.account as {email:string}).email)).toBeNull();
    expect(f.master.prepare(`SELECT state FROM user_provisioning WHERE normalizedEmail=?`).get(body.email).state).toBe("cancelled");
    await reconcileProvisioning(f.master,Date.now()+1);
  });
  test("failed compensation remains inaccessible; restart cleanup is idempotent at reserved/auth-created steps",async()=>{
    const f=await setup();await f.createUser(email(),password,"admin");
    const body=input(invite(f));
    f.master.exec(`CREATE TRIGGER synthetic_fault BEFORE UPDATE ON user_provisioning WHEN NEW.state='auth_created' BEGIN SELECT RAISE(ABORT,'synthetic mark fault'); END;
      CREATE TRIGGER synthetic_cleanup BEFORE DELETE ON auth_user BEGIN SELECT RAISE(ABORT,'synthetic cleanup fault'); END`);
    await expect(provisionUser(f.auth,f.master,body,verified)).rejects.toThrow();
    const op=f.master.prepare(`SELECT * FROM user_provisioning WHERE normalizedEmail=?`).get(body.email);
    expect(op.state).toBe("cleanup_required");expect(()=>readGeneration(f.master,op.userId)).toThrow();
    expect((await http(f,"/sign-in/email",{email:body.email,password})).ok).toBe(false);
    f.master.exec(`DROP TRIGGER synthetic_fault;DROP TRIGGER synthetic_cleanup`);
    const reserved=await reserveProvisioning(f.master,email(),invite(f));
    await reconcileProvisioning(f.master,Date.now()+1);await compensateProvisioning(f.master,op.id);await compensateProvisioning(f.master,reserved.id);
    expect(f.master.prepare(`SELECT count(*) n FROM user_provisioning WHERE state='cancelled'`).get().n).toBe(2);
    expect(f.master.prepare(`SELECT id FROM auth_user WHERE id=?`).get(op.userId)).toBeNull();
  });
  test("restart at auth-created boundary cancels exact identity and preserves live reservations",async()=>{
    const f=await setup();await f.createUser(email(),password,"admin");
    const address=email(),op=await reserveProvisioning(f.master,address,invite(f));
    await withAuthProof({db:f.master,internal:true,creation:{userId:op.userId,email:address,role:op.role},authenticatedAt:Date.now(),method:"provisioning",createdSessionIds:[]},()=>f.auth.api.createUser({body:{email:address,password,name:"Synthetic Interrupted",role:op.role}}));
    f.master.prepare(`UPDATE user_provisioning SET state='auth_created',createdAt=1 WHERE id=?`).run(op.id);
    const live=await reserveProvisioning(f.master,email(),invite(f));
    await reconcileProvisioning(f.master,2);await reconcileProvisioning(f.master,2);
    expect(f.master.prepare(`SELECT 1 FROM auth_user WHERE id=?`).get(op.userId)).toBeNull();
    expect(f.master.prepare(`SELECT state FROM user_provisioning WHERE id=?`).get(live.id).state).toBe("reserved");
  });
});

describe("slice 5 lifecycle and recovery",()=>{
  test("targeted invite, actor differs from target name, ban/unban/role and audit",async()=>{
    const f=await setup(),actor=await enrolled(f),address=email();
    const issued=await issueOnboardingInvite(f.master,actor.source,{email:address,name:"Synthetic Invitee",role:"user"});
    expect(issued.invite.email).toBe(address);
    const target=await provisionUser(f.auth,f.master,input(issued.invite.code,address),verified);
    await updateUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),target.userId,{name:"Synthetic Renamed",role:"admin",disabled:true});
    expect(f.master.prepare(`SELECT name,role,banned,banExpires FROM auth_user WHERE id=?`).get(target.userId)).toEqual({name:"Synthetic Renamed",role:"admin",banned:1,banExpires:null});
    expect(f.master.prepare(`SELECT name FROM auth_user WHERE id=?`).get(actor.user.id).name).toBe("Synthetic User");
    await updateUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),target.userId,{disabled:false,role:"user"});
    expect(f.master.prepare(`SELECT count(*) n FROM auth_session WHERE userId=?`).get(target.userId).n).toBe(0);
    expect(f.master.prepare(`SELECT count(*) n FROM admin_audit WHERE targetUserId=?`).get(target.userId).n).toBeGreaterThanOrEqual(3);
  });
  test("last admin and self mutation cannot race; global slot precedes security slots",async()=>{
    const f=await setup(),a=await enrolled(f),b=await enrolled(f);
    const results=await Promise.allSettled([updateUserLifecycle(f.auth,f.master,a.source,request(a.jar),b.user.id,{role:"user"}),updateUserLifecycle(f.auth,f.master,b.source,request(b.jar),a.user.id,{disabled:true})]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
    expect(f.master.prepare(`SELECT count(*) n FROM auth_user WHERE role='admin' AND COALESCE(banned,0)=0`).get().n).toBe(1);
    const remaining=f.master.prepare(`SELECT id FROM auth_user WHERE role='admin' AND COALESCE(banned,0)=0`).get().id;
    const op=await reserveLifecycle(f.master,"operator",remaining,"synthetic",{});
    expect(()=>{const target=f.master.prepare(`SELECT role FROM auth_user WHERE id=?`).get(remaining);expect(target.role).toBe("admin");}).not.toThrow();
    const {assertTargetPolicy}=await import("./db/userLifecycle");expect(()=>assertTargetPolicy(f.master,op,{disabled:true})).toThrow("last_admin");
    await finishLifecycle(f.master,op);
    const live=remaining===a.user.id?a:b;
    await expect(removeUserLifecycle(f.auth,f.master,live.source,request(live.jar),remaining,{})).rejects.toThrow("self_admin_mutation_forbidden");
  });
  test("admin API/audit fault retains inaccessible intent until restart reconciliation",async()=>{
    const f=await setup(),actor=await enrolled(f),target=await enrolled(f,"user");
    f.master.exec(`CREATE TRIGGER synthetic_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'synthetic audit fault'); END`);
    await expect(updateUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),target.user.id,{name:"Changed Before Fault"})).rejects.toThrow();
    expect(f.master.prepare(`SELECT slot FROM admin_lifecycle_operations WHERE slot=?`).get(`security:${target.user.id}`)).not.toBeNull();
    expect((await http(f,"/sign-in/email",{email:target.user.email,password})).status).toBe(409);
    f.master.exec(`DROP TRIGGER synthetic_audit`);
    await reconcileLifecycle(f.auth,f.master,Date.now()+1);
    expect(f.master.prepare(`SELECT 1 FROM admin_lifecycle_operations WHERE slot='admin-lifecycle'`).get()).toBeNull();
    expect(()=>readSessionSecurity(f.master,target.source.sessionId)).toThrow();
  });
  test("incomplete provisioned admin cannot satisfy the last-admin rule",async()=>{
    const f=await setup(),actor=await enrolled(f),incomplete=await f.createUser(email(),password,"admin");
    f.master.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt) VALUES(?,?,?,'signup','auth_created',1,1)`).run(crypto.randomUUID(),incomplete.id,incomplete.email);
    const op=await reserveLifecycle(f.master,"operator",actor.user.id,"synthetic",{});
    const {assertTargetPolicy}=await import("./db/userLifecycle");expect(()=>assertTargetPolicy(f.master,op,{role:"user"})).toThrow("last_admin");await finishLifecycle(f.master,op);
  });
  test("admin factor/session cleanup consumes purpose-bound proof and preserves first-onboarding provenance",async()=>{
    const f=await setup(),actor=await enrolled(f),target=await enrolled(f,"user");
    await expect(mutateAdminSecurity(f.master,actor.source,request(actor.jar),target.user.id,{},"sessions-revoke")).rejects.toThrow("reauth_required");
    await expect(mutateAdminSecurity(f.master,actor.source,await adminProof(f,actor),target.user.id,{},"passkey-remove","synthetic-nonexistent-key")).rejects.toThrow("passkey_not_found");
    expect(f.master.prepare(`SELECT 1 FROM admin_lifecycle_operations WHERE slot='admin-lifecycle' OR slot=?`).get(`security:${target.user.id}`)).toBeNull();
    await mutateAdminSecurity(f.master,actor.source,await adminProof(f,actor),target.user.id,{},"sessions-revoke");
    expect(()=>readSessionSecurity(f.master,target.source.sessionId)).toThrow();
    await mutateAdminSecurity(f.master,actor.source,await adminProof(f,actor),target.user.id,{confirmedTarget:true},"mfa-reset");
    expect(f.master.prepare(`SELECT twoFactorEnabled FROM auth_user WHERE id=?`).get(target.user.id).twoFactorEnabled).toBe(0);
    expect(f.master.prepare(`SELECT 1 FROM auth_two_factor WHERE userId=?`).get(target.user.id)).toBeNull();
    expect(f.master.prepare(`SELECT id FROM noctua_auth_migrations WHERE id=?`).get(`mfa-enrolled:${target.user.id}`)).not.toBeNull();
  });
  test("complete user deletion requires owner reassignment, survives shard failure, then permits re-invite",async()=>{
    const f=await setup(),actor=await enrolled(f),address=email();
    const target=await provisionUser(f.auth,f.master,input(invite(f),address,mailbox()),verified);
    // The actor sees none of the target's mailboxes yet: refused before anything is reassigned.
    await expect(removeUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),target.userId,{reassignOwnerTo:actor.user.id})).rejects.toMatchObject({code:"foreign_mailbox_membership",status:409});
    expect(f.master.prepare(`SELECT banned FROM auth_user WHERE id=?`).get(target.userId).banned).toBeFalsy();
    await f.addMembership(actor.user.id,target.accountId!,"viewer");
    await expect(removeUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),target.userId,{})).rejects.toThrow("owner_reassignment_required");
    const incomplete=await f.createUser(email(),password);
    f.master.prepare(`INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt) VALUES(?,?,?,'signup','auth_created',1,1)`).run(crypto.randomUUID(),incomplete.id,incomplete.email);
    await expect(removeUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),target.userId,{reassignOwnerTo:incomplete.id})).rejects.toThrow("invalid_owner");
    let cleanCalls=0;
    await expect(removeUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),target.userId,{reassignOwnerTo:actor.user.id},async()=>{cleanCalls++;throw new Error("synthetic shard failure");})).rejects.toThrow();
    expect(cleanCalls).toBe(1);expect(f.master.prepare(`SELECT banned FROM auth_user WHERE id=?`).get(target.userId).banned).toBe(1);
    await reconcileLifecycle(f.auth,f.master,Date.now()+1,async()=>({status:"not_installed",unassigned:0}));
    await reconcileLifecycle(f.auth,f.master,Date.now()+1);
    expect(f.master.prepare(`SELECT 1 FROM users WHERE id=?`).get(target.userId)).toBeNull();
    const repeat=await provisionUser(f.auth,f.master,input(invite(f),address),verified);expect(repeat.userId).not.toBe(target.userId);
    await recovery(f,repeat.userId);await recovery(f,repeat.userId);
  });
  test("issuance requires admin proof or local operator, target confirmation; no public issuance/SMTP",async()=>{
    const f=await setup(),actor=await enrolled(f),member=await enrolled(f,"user");
    await expect(issueRecovery(f.auth,f.master,member.source,request(member.jar),actor.user.id,{confirmedTarget:true})).rejects.toThrow("admin_required");
    await expect(issueRecovery(f.auth,f.master,actor.source,request(actor.jar),member.user.id,{confirmedTarget:true})).rejects.toThrow("reauth_required");
    await expect(issueRecovery(f.auth,f.master,"operator",null,member.user.id,{confirmedTarget:false})).rejects.toThrow("target_verification_required");
    await expect(f.auth.api.requestPasswordReset({body:{email:member.user.email}})).rejects.toThrow("recovery_authority_required");
    expect((await http(f,"/request-password-reset",{email:member.user.email})).ok).toBe(false);
    const link=await issueRecovery(f.auth,f.master,actor.source,await adminProof(f,actor),member.user.id,{confirmedTarget:true});
    expect(link.expiresIn).toBe(900);expect(new URL(link.url).searchParams.get("callbackURL")).toBe(`${TEST_BASE_URL}/reset-password`);
    const row=f.master.prepare(`SELECT expiresAt FROM auth_verification WHERE identifier=?`).get(`reset-password:${token(link.url)}`);
    expect(new Date(row.expiresAt).getTime()-Date.now()).toBeGreaterThan(890000);
    const audit=JSON.stringify(f.master.prepare(`SELECT * FROM admin_audit WHERE action='user.recovery_issue'`).all());
    expect(audit).not.toContain(token(link.url));expect(audit).toContain("personal_handover");
    const operator=await recovery(f,member.user.id);expect(operator.url).not.toBe(link.url);
    expect(f.master.prepare(`SELECT value FROM auth_verification WHERE identifier=?`).get(`reset-password:${token(link.url)}`)).toBeNull();
  });
  test("anonymous callback exact origin; JSON redemption is single-use, preserves MFA, creates no session",async()=>{
    const f=await setup(),target=await enrolled(f,"user");
    const link=await recovery(f,target.user.id),resetToken=token(link.url);
    const get=await f.auth.handler(new Request(link.url));
    expect(get.status).toBe(302);expect(get.headers.get("location")).toBe(`${TEST_BASE_URL}/reset-password?token=${resetToken}`);
    expect(get.headers.get("cache-control")).toBe("no-store");expect(get.headers.get("referrer-policy")).toBe("no-referrer");
    for(const callback of [`${TEST_BASE_URL}/other`,`${TEST_BASE_URL}/reset-password?next=other`,`https://foreign.example.test/reset-password`]){
      const url=new URL(link.url);url.searchParams.set("callbackURL",callback);expect((await f.auth.handler(new Request(url))).ok).toBe(false);
    }
    expect(redactAuthUrl(link.url)).not.toContain(resetToken);
    const result=await http(f,"/reset-password",{token:resetToken,newPassword:nextPassword});
    expect(result.status).toBe(200);expect(await result.json()).toEqual({status:true});expect(result.headers.get("set-cookie")).toBeNull();
    expect(f.master.prepare(`SELECT count(*) n FROM auth_session WHERE userId=?`).get(target.user.id).n).toBe(0);
    expect(f.master.prepare(`SELECT verified FROM auth_two_factor WHERE userId=?`).get(target.user.id).verified).toBe(1);
    expect((await http(f,"/reset-password",{token:resetToken,newPassword:password})).status).toBe(400);
    const signin=await http(f,"/sign-in/email",{email:target.user.email,password:nextPassword});expect((await signin.json()).twoFactorRedirect).toBe(true);
  });
  test("expiry, unknown fields, query token and parallel redemption cannot reuse the capability",async()=>{
    const f=await setup(),target=await f.createUser(email(),password);
    const expired=await recovery(f,target.id);
    f.master.prepare(`UPDATE auth_verification SET expiresAt=? WHERE identifier=?`).run(new Date(0).toISOString(),`reset-password:${token(expired.url)}`);
    expect((await http(f,"/reset-password",{token:token(expired.url),newPassword:nextPassword})).status).toBe(400);
    const link=await recovery(f,target.id),body={token:token(link.url),newPassword:nextPassword};
    expect((await http(f,"/reset-password",{...body,revokeOtherSessions:false})).status).toBe(400);
    expect((await http(f,`/reset-password?token=${body.token}`,{newPassword:nextPassword})).status).toBe(400);
    const results=await Promise.all([http(f,"/reset-password",body),http(f,"/reset-password",body)]);
    expect(results.filter(r=>r.status===200)).toHaveLength(1);
  });
  test("pre-reset challenge rejected and post-commit callback fault cannot revive an old bearer",async()=>{
    let started!:()=>void,release!:()=>void;
    const callbackStarted=new Promise<void>(resolve=>{started=resolve;}),callbackRelease=new Promise<void>(resolve=>{release=resolve;});
    const f=await setup(options=>{options.emailAndPassword.onPasswordReset=async()=>{started();await callbackRelease;throw new Error("synthetic callback interruption");};}),target=await enrolled(f,"user");
    const loginJar=new CookieJar();await http(f,"/sign-in/email",{email:target.user.email,password},loginJar);
    let link="";await withResetDelivery({userId:target.user.id,deliver:url=>{link=url;}},()=>f.auth.api.requestPasswordReset({body:{email:target.user.email,redirectTo:`${TEST_BASE_URL}/reset-password`}}));
    const generation=readGeneration(f.master,target.user.id);
    const box=mailbox();persistAccountRow(f.master,{...box,id:"synthetic-reset-box",ownerUserId:target.user.id});
    await f.addMembership(target.user.id,"synthetic-reset-box");
    const bearer=`mcp_${"a".repeat(43)}`;
    f.master.prepare(`INSERT INTO mcp_tokens(id,accountId,createdByUserId,label,tokenHash,tokenSuffix,createdAt,securityGeneration) VALUES('synthetic-token','synthetic-reset-box',?,'Synthetic',?,'suffix',?,?)`).run(target.user.id,hashMcpToken(bearer),Date.now(),generation);
    expect(validateMcpTokenRow(f.master,bearer)?.accountId).toBe("synthetic-reset-box");
    const pending=http(f,"/reset-password",{token:token(link),newPassword:nextPassword});
    await callbackStarted;
    expect(validateMcpTokenRow(f.master,bearer)).toBeNull();
    release();const result=await pending;expect(result.status).toBeGreaterThanOrEqual(500);
    expect(readGeneration(f.master,target.user.id)).toBe(generation+1);
    // Token row remains because cleanup threw, but the authoritative bearer predicate rejects it.
    expect(f.master.prepare(`SELECT count(*) n FROM mcp_tokens WHERE id='synthetic-token'`).get().n).toBe(1);
    expect(validateMcpTokenRow(f.master,bearer)).toBeNull();
    expect((await http(f,"/two-factor/verify-totp",{code:totpFromUri(target.factor.totpURI)},loginJar)).status).toBe(403);
    expect(()=>readSessionSecurity(f.master,target.source.sessionId)).toThrow();
    await reconcileSecurityOperations(f.master,Date.now()+1);
    expect(f.master.prepare(`SELECT count(*) n FROM admin_audit WHERE action='user.password_reset' AND targetUserId=?`).get(target.user.id).n).toBe(1);
    const signed=await http(f,"/sign-in/email",{email:target.user.email,password:nextPassword});expect((await signed.json()).twoFactorRedirect).toBe(true);
  });
});

for(const boundary of ["preflight-reservation","reservation-finalize"] as const)test(`issuer demotion race at ${boundary} cannot create an identity`,async()=>{
  const f=await setup(),issuer=await enrolled(f),other=await enrolled(f),address=email();
  const issued=await issueOnboardingInvite(f.master,issuer.source,{email:address,name:"Synthetic",role:"admin"});
  const demote=()=>updateUserLifecycle(f.auth,f.master,other.source,request(other.jar),issuer.user.id,{role:"user"});
  let create:ReturnType<typeof spyOn>|undefined;
  if(boundary==="reservation-finalize") {
    const original=f.auth.api.createUser;
    create=spyOn(f.auth.api,"createUser").mockImplementation(Object.assign(async (args:Parameters<typeof original>[0])=>{const result=await original(args);await demote();return result;}, { options: original.options, path: original.path }) as typeof original);
  }
  try {
    await expect(provisionUser(f.auth,f.master,input(issued.invite.code,address,mailbox()),{imap:async()=>{if(boundary==="preflight-reservation")await demote();return true;},smtp:async()=>true})).rejects.toMatchObject({status:403,code:"invalid_invite"});
    expect(f.master.prepare(`SELECT 1 FROM auth_user WHERE email=?`).get(address)).toBeNull();
    expect(f.master.prepare(`SELECT count(*) n FROM user_provisioning WHERE normalizedEmail=? AND state IN ('reserved','auth_created','cleanup_required','complete')`).get(address).n).toBe(0);
    expect(f.master.prepare(`SELECT uses FROM invite_codes WHERE code=?`).get(issued.invite.code).uses).toBe(0);
  } finally {create?.mockRestore();}
});

for(const boundary of ["before-reservation","before-finalize"] as const)test(`late mailbox collision ${boundary} returns 409 and compensates exact identity`,async()=>{
  const f=await setup();await f.createUser(email(),password,"admin");
  const box=mailbox(),address=email(),body=input(invite(f),address,box);
  const collide=()=>persistAccountRow(f.master,{...box,id:"synthetic-collision-owner"});
  let create:ReturnType<typeof spyOn>|undefined;
  if(boundary==="before-finalize") {
    const original=f.auth.api.createUser;
    create=spyOn(f.auth.api,"createUser").mockImplementation(Object.assign(async (args:Parameters<typeof original>[0])=>{const result=await original(args);collide();return result;}, { options: original.options, path: original.path }) as typeof original);
  }
  try {
    await expect(provisionUser(f.auth,f.master,body,{imap:async()=>{if(boundary==="before-reservation")collide();return true;},smtp:async()=>true})).rejects.toMatchObject({status:409,code:"mailbox_exists"});
    expect(f.master.prepare(`SELECT 1 FROM auth_user WHERE email=?`).get(address)).toBeNull();
    expect(f.master.prepare(`SELECT id FROM accounts WHERE email=?`).get(box.email).id).toBe("synthetic-collision-owner");
    expect(f.master.prepare(`SELECT uses FROM invite_codes WHERE code=?`).get(body.inviteCode).uses).toBe(0);
    expect(f.master.prepare(`SELECT count(*) n FROM user_provisioning WHERE normalizedEmail=? AND state<>'cancelled'`).get(address).n).toBe(0);
  }finally{create?.mockRestore();}
});

for(const boundary of ["reserve","mint","audit","complete","release"] as const)test(`recovery issuance ${boundary} fault returns no capability; restart twice is idempotent`,async()=>{
  const f=await setup(),target=await enrolled(f,"user"),older=await recovery(f,target.user.id);
  const event=boundary==="reserve"?"BEFORE INSERT ON user_provisioning WHEN NEW.kind='recovery'":boundary==="mint"?"BEFORE INSERT ON auth_verification WHEN NEW.identifier LIKE 'reset-password:%'":boundary==="audit"?"BEFORE INSERT ON admin_audit WHEN NEW.action='user.recovery_issue'":boundary==="complete"?"BEFORE UPDATE ON user_provisioning WHEN NEW.kind='recovery' AND NEW.state='complete'":"BEFORE UPDATE ON admin_lifecycle_operations WHEN OLD.slot='admin-lifecycle' AND NEW.slot IS NULL";
  f.master.exec(`CREATE TRIGGER synthetic_recovery_fault ${event} BEGIN SELECT RAISE(ABORT,'synthetic recovery fault'); END`);
  await expect(recovery(f,target.user.id)).rejects.toThrow();
  f.master.exec(`DROP TRIGGER synthetic_recovery_fault`);
  await reconcileLifecycle(f.auth,f.master,Date.now()+1);
  const snapshot=JSON.stringify({journal:f.master.prepare(`SELECT * FROM user_provisioning`).all(),audit:f.master.prepare(`SELECT * FROM admin_audit`).all()});
  await reconcileLifecycle(f.auth,f.master,Date.now()+1);
  expect(JSON.stringify({journal:f.master.prepare(`SELECT * FROM user_provisioning`).all(),audit:f.master.prepare(`SELECT * FROM admin_audit`).all()})).toBe(snapshot);
  expect(f.master.prepare(`SELECT count(*) n FROM auth_verification WHERE identifier LIKE 'reset-password:%' AND value=?`).get(target.user.id).n).toBe(0);
  expect(f.master.prepare(`SELECT count(*) n FROM admin_lifecycle_operations WHERE slot IS NOT NULL`).get().n).toBe(0);
  expect((await http(f,"/reset-password",{token:token(older.url),newPassword:nextPassword})).status).toBe(400);
  expect((await recovery(f,target.user.id)).ok).toBe(true);
});

for(const action of ["ban","unban","role","delete","disable-audit"] as const)test(`lifecycle ${action} API/audit failure keeps target inaccessible until restart`,async()=>{
  const f=await setup(),actor=await enrolled(f),target=await enrolled(f,"user");
  if(action==="unban")f.master.prepare(`UPDATE auth_user SET banned=1 WHERE id=?`).run(target.user.id);
  const event=action==="delete"?"BEFORE DELETE ON auth_user":action==="role"?"BEFORE UPDATE OF role ON auth_user":action==="disable-audit"?"BEFORE INSERT ON admin_audit WHEN NEW.action='user.disable'":"BEFORE UPDATE OF banned ON auth_user";
  f.master.exec(`CREATE TRIGGER synthetic_lifecycle_fault ${event} BEGIN SELECT RAISE(ABORT,'synthetic lifecycle fault'); END`);
  const run=action==="delete"?removeUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),target.user.id,{},async()=>({status:"not_installed",unassigned:0})):updateUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),target.user.id,action==="role"?{role:"admin"}:{disabled:action!=="unban"});
  await expect(run).rejects.toThrow();
  expect(f.master.prepare(`SELECT 1 FROM admin_lifecycle_operations WHERE slot=?`).get(`security:${target.user.id}`)).not.toBeNull();
  expect((await http(f,"/sign-in/email",{email:target.user.email,password})).status).toBe(["unban","delete","disable-audit"].includes(action)?401:409);
  if(action==="disable-audit")expect(f.master.prepare(`SELECT banned FROM auth_user WHERE id=?`).get(target.user.id).banned).toBe(1);
  f.master.exec(`DROP TRIGGER synthetic_lifecycle_fault`);
  await reconcileLifecycle(f.auth,f.master,Date.now()+1,async()=>({status:"not_installed",unassigned:0}));
  await reconcileLifecycle(f.auth,f.master,Date.now()+1);
  expect(()=>readSessionSecurity(f.master,target.source.sessionId)).toThrow();
  expect(f.master.prepare(`SELECT count(*) n FROM admin_lifecycle_operations WHERE slot IS NOT NULL`).get().n).toBe(0);
});

test("last admin self-demotion and self-disable reject through lifecycle service",async()=>{
  const f=await setup(),actor=await enrolled(f);
  for(const body of [{role:"user"},{disabled:true}])await expect(updateUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),actor.user.id,body)).rejects.toMatchObject({status:403,code:"self_admin_mutation_forbidden"});
  expect(f.master.prepare(`SELECT role,banned FROM auth_user WHERE id=?`).get(actor.user.id)).toEqual({role:"admin",banned:0});
});


test("provenance adoption revokes historical targeted invites and preserves deliberate generic/operator issuance",async()=>{
  const {Database}=await import("bun:sqlite"),{ensureInviteIssuerSchema}=await import("./db/schema");
  const db=new Database(":memory:");
  try {
    db.exec(`CREATE TABLE invite_codes(code TEXT PRIMARY KEY,email TEXT); INSERT INTO invite_codes VALUES('synthetic-targeted','synthetic@example.test'),('synthetic-generic',NULL)`);
    db.exec(`CREATE TRIGGER synthetic_adoption_fault BEFORE UPDATE ON invite_codes BEGIN SELECT RAISE(ABORT,'synthetic adoption fault'); END`);
    expect(()=>ensureInviteIssuerSchema(db)).toThrow("synthetic adoption fault");
    expect((db.prepare(`PRAGMA table_info(invite_codes)`).all() as {name:string}[]).some(column=>column.name==="provenance")).toBe(false);
    db.exec(`DROP TRIGGER synthetic_adoption_fault`);
    ensureInviteIssuerSchema(db);
    expect(db.prepare(`SELECT revokedAt FROM invite_codes WHERE code='synthetic-targeted'`).get().revokedAt).not.toBeNull();
    expect(db.prepare(`SELECT provenance,issuedByUserId,revokedAt FROM invite_codes WHERE code='synthetic-generic'`).get()).toEqual({provenance:"operator",issuedByUserId:null,revokedAt:null});
    db.exec(`INSERT INTO invite_codes(code,email,provenance) VALUES('synthetic-new-operator','new@example.test','operator')`);
    ensureInviteIssuerSchema(db);
    expect(db.prepare(`SELECT revokedAt FROM invite_codes WHERE code='synthetic-new-operator'`).get().revokedAt).toBeNull();
  }finally{db.close();}
});

test("user deletion drops the deleted user's push devices and keeps everyone else's",async()=>{
  const f=await setup(),actor=await enrolled(f),target=await enrolled(f,"user");
  const device=f.master.prepare(`INSERT INTO push_subscriptions(id,userId,endpoint,p256dh,auth,settings) VALUES(?,?,?,'synthetic-key','synthetic-auth','{}')`);
  device.run("synthetic-target-device",target.user.id,"https://fcm.googleapis.com/fcm/send/synthetic-target");
  device.run("synthetic-actor-device",actor.user.id,"https://fcm.googleapis.com/fcm/send/synthetic-actor");
  await removeUserLifecycle(f.auth,f.master,actor.source,request(actor.jar),target.user.id,{});
  expect(f.master.prepare(`SELECT id FROM push_subscriptions ORDER BY id`).all()).toEqual([{id:"synthetic-actor-device"}]);
});
