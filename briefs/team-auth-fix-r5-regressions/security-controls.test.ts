import {afterEach,expect,test} from 'bun:test';
import {Database} from 'bun:sqlite';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {CookieJar,createTestAuthHarness,createAuthenticatedTestSession,TEST_BASE_URL,totpFromUri,type TestAuthHarness} from './lib/testAuthHarness';
import {provisionUser} from './lib/userProvisioning';
import {issueOnboardingInvite,issueRecovery,updateUserLifecycle,removeUserLifecycle,reconcileLifecycle,mutateAdminSecurity} from './lib/userLifecycle';
import {reserveLifecycle,takeLifecycleUserSlot,finishLifecycle} from './lib/db/userLifecycle';
import {readGeneration,readSessionSecurity,reserveSecurityOperation,finishSecurityOperation} from './lib/db/authPolicy';
import {reauthenticate} from './lib/authSecurity';
import {createRateLimiter} from './lib/rateLimit';
import {persistAccountRow} from './lib/db/rowParsers';
import {hashMcpToken,validateMcpTokenRow} from './lib/mcpAuth';
import {RAW_DISABLED_PATHS} from './lib/authPolicyHandler';
import {requireActiveUserSession} from './lib/auth';
import {createNoctuaAuth} from './lib/betterAuth';
import {POST as signup} from './app/api/auth/signup/route';
import {POST as adminInvite} from './app/api/admin/users/route';
import {POST as adminRecovery} from './app/api/admin/users/[userId]/recovery/route';
import {POST as publicBA} from './app/api/ba/[...all]/route';
const fixtures:TestAuthHarness[]=[];
const password='synthetic-security-password';
const email=()=>`security-${crypto.randomUUID()}@example.test`;
async function setup(options?:Parameters<typeof createTestAuthHarness>[0],settings?:{libraryRateLimits?:boolean}){const f=await createTestAuthHarness(options,{},settings);fixtures.push(f);return f;}
afterEach(()=>{for(const f of fixtures.splice(0))f.close();});
function req(jar=new CookieJar(),body:unknown={},path='/api/auth/reauth',extra:Record<string,string>={}){return new Request(TEST_BASE_URL+path,{method:'POST',headers:jar.headers({origin:TEST_BASE_URL,'content-type':'application/json',...extra}),body:JSON.stringify(body)});}
async function http(f:TestAuthHarness,path:string,body?:unknown,jar=new CookieJar(),extra:Record<string,string>={}){return f.auth.handler(body===undefined?new Request(TEST_BASE_URL+'/api/ba'+path,{headers:jar.headers(extra)}):req(jar,body,'/api/ba'+path,extra));}
async function enrolled(f:TestAuthHarness,role:'admin'|'user'='admin'){const user=await f.createUser(email(),password,role),{jar}=await f.signIn(user.email,password),factor=await f.enrollTotp(jar,password),session=await f.auth.api.getSession({headers:jar.headers()});await f.seedSessionSecurity(session!.session.id,user.id,'mfa','password_totp');return {user,jar,factor,source:readSessionSecurity(f.master,session!.session.id)};}
function invite(f:TestAuthHarness,role='admin'){const code=crypto.randomUUID();f.master.prepare("INSERT INTO invite_codes(code,role,maxUses,uses,expiresAt,createdAt) VALUES(?,?,1,0,?,?)").run(code,role,Date.now()+60000,Date.now());return code;}
function body(code:string,address=email(),account?:unknown){return {inviteCode:code,email:address,password,name:'Synthetic Review',...(account?{account}:{})};}
function box(address=email()){return {name:'Synthetic Box',email:address,avatar:'',imap:{host:'imap.example.test',port:993,secure:true,user:address,password:'synthetic-imap'},smtp:{host:'smtp.example.test',port:465,secure:true,user:address,password:'synthetic-smtp'}};}
const verified={imap:async()=>true,smtp:async()=>true};
async function proof(f:TestAuthHarness,a:Awaited<ReturnType<typeof enrolled>>,purpose='admin.recovery'){const request=req(a.jar),grant=await reauthenticate(f.auth,f.master,a.source,request,{purpose,currentPassword:password,totpCode:totpFromUri(a.factor.totpURI)},createRateLimiter({max:100}));request.headers.set('x-noctua-reauth',grant.grant);return request;}

for(const change of ['demoted','banned'] as const)test(`F1 observation: ${change} issuer invite still provisions another admin`,async()=>{
 const f=await setup(),issuer=await enrolled(f),other=await enrolled(f),address=email();
 const {invite:i}=await issueOnboardingInvite(f.master,issuer.source,{email:address,name:'Synthetic Invitee',role:'admin'});
 await updateUserLifecycle(f.auth,f.master,other.source,req(other.jar),issuer.user.id,change==='demoted'?{role:'user'}:{disabled:true});
 let calls=0;const accepted=await provisionUser(f.auth,f.master,body(i.code,address,box()),{imap:async()=>{calls++;return true},smtp:async()=>{calls++;return true}});
 expect(calls).toBe(2);expect(f.master.prepare('SELECT role FROM auth_user WHERE id=?').get(accepted.userId).role).toBe('admin');
});
for(const state of ['reserved','auth_created','cleanup_required'])test(`bootstrap stale ${state} journal prevents network and reservation`,async()=>{
 const f=await setup();f.master.prepare("INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt) VALUES('stale-op','stale-user','stale@example.test','signup',?,1,1)").run(state);
 let calls=0;await expect(provisionUser(f.auth,f.master,body(invite(f),'new@example.test',box()),{imap:async()=>{calls++;return true},smtp:async()=>{calls++;return true}})).rejects.toThrow('bootstrap_pending');expect(calls).toBe(0);expect(f.master.prepare('SELECT count(*) n FROM user_provisioning').get().n).toBe(1);
});
test('desktop tag has no invitation exemption',async()=>{const f=await setup(),before=process.env.NOCTUA_DESKTOP_MODE;try{process.env.NOCTUA_DESKTOP_MODE='true';await expect(provisionUser(f.auth,f.master,body('missing'),verified)).rejects.toThrow('invalid_invite');}finally{process.env.NOCTUA_DESKTOP_MODE=before;}});
test('incomplete identity rejects an already-issued session and login',async()=>{
 const a=await createAuthenticatedTestSession(undefined,'user');a.master.prepare("INSERT INTO user_provisioning(id,userId,normalizedEmail,kind,state,createdAt,updatedAt) VALUES(?,?,?,'signup','auth_created',1,1)").run(crypto.randomUUID(),a.user.id,a.user.email);
 expect(()=>readSessionSecurity(a.master,a.session.id)).toThrow('Unauthorized');
 for(const allowRestricted of [false,true]){const result=await requireActiveUserSession(new Request(TEST_BASE_URL+'/api/auth/me',{headers:a.jar.headers()}),{allowRestricted});expect((result as Response).status).toBe(401);}
 expect((await a.auth.handler(req(new CookieJar(),{email:a.user.email,password:'synthetic-password-123'},'/api/ba/sign-in/email'))).status).toBe(401);
});
for(const x of ['demote','ban','delete'])for(const y of ['demote','ban','delete'])test(`last-admin contention ${x}/${y}`,async()=>{
 const f=await setup(),a=await enrolled(f),b=await enrolled(f);
 const change=(actor:typeof a,target:typeof a,action:string)=>action==='delete'?removeUserLifecycle(f.auth,f.master,actor.source,req(actor.jar),target.user.id,{}):updateUserLifecycle(f.auth,f.master,actor.source,req(actor.jar),target.user.id,action==='ban'?{disabled:true}:{role:'user'});
 const results=await Promise.allSettled([change(a,b,x),change(b,a,y)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(f.master.prepare("SELECT count(*) n FROM auth_user WHERE role='admin' AND COALESCE(banned,0)=0").get().n).toBe(1);
 expect(results.filter(r=>r.status==='rejected').map((r:any)=>r.reason.status)).toEqual([409]);
});
test('global-before-security enforced by SQL trigger; user contention releases global slot',async()=>{
 const f=await setup(),a=await enrolled(f),b=await enrolled(f,'user');
 f.master.exec("CREATE TRIGGER check_lock_order BEFORE INSERT ON admin_lifecycle_operations WHEN NEW.action='lifecycle.security' AND NOT EXISTS(SELECT 1 FROM admin_lifecycle_operations WHERE slot='admin-lifecycle') BEGIN SELECT RAISE(ABORT,'inverted lock order'); END");
 const busy=await reserveSecurityOperation(f.master,b.user.id,'security.synthetic');await expect(updateUserLifecycle(f.auth,f.master,a.source,req(a.jar),b.user.id,{name:'Synthetic'})).rejects.toThrow('security_operation_pending');expect(f.master.prepare("SELECT 1 FROM admin_lifecycle_operations WHERE slot='admin-lifecycle'").get()).toBeNull();await finishSecurityOperation(f.master,busy);
 await issueRecovery(f.auth,f.master,a.source,await proof(f,a),b.user.id,{confirmedTarget:true});expect(f.master.prepare("SELECT 1 FROM admin_lifecycle_operations WHERE slot IS NOT NULL").get()).toBeNull();
});
test('ban trigger invalidates live session, MCP and pending challenge before library failure',async()=>{
 const f=await setup(),a=await enrolled(f),b=await enrolled(f,'user'),mail=box();persistAccountRow(f.master,{...mail,id:'synthetic-ban-box',ownerUserId:b.user.id});await f.addMembership(b.user.id,'synthetic-ban-box');
 const bearer='mcp_'+'b'.repeat(43);f.master.prepare("INSERT INTO mcp_tokens(id,accountId,createdByUserId,label,tokenHash,tokenSuffix,createdAt,securityGeneration) VALUES('ban-token','synthetic-ban-box',?,'Synthetic',?,'suffix',?,?)").run(b.user.id,hashMcpToken(bearer),Date.now(),readGeneration(f.master,b.user.id));expect(validateMcpTokenRow(f.master,bearer)).not.toBeNull();
 await http(f,'/sign-in/email',{email:b.user.email,password});expect(f.master.prepare('SELECT count(*) n FROM auth_pending_challenges WHERE userId=?').get(b.user.id).n).toBeGreaterThan(0);
 f.master.exec("CREATE TRIGGER fail_session_delete BEFORE DELETE ON auth_session BEGIN SELECT RAISE(ABORT,'synthetic session cleanup failure'); END");
 await expect(updateUserLifecycle(f.auth,f.master,a.source,req(a.jar),b.user.id,{disabled:true})).rejects.toThrow();
 expect(f.master.prepare('SELECT banned FROM auth_user WHERE id=?').get(b.user.id).banned).toBe(1);expect(()=>readSessionSecurity(f.master,b.source.sessionId)).toThrow();expect(validateMcpTokenRow(f.master,bearer)).toBeNull();expect(f.master.prepare('SELECT count(*) n FROM auth_pending_challenges WHERE userId=?').get(b.user.id).n).toBe(0);
});
test('all raw mutating admin routes blocked with valid admin cookie',async()=>{const f=await setup(),a=await enrolled(f);for(const path of RAW_DISABLED_PATHS.filter(p=>p.startsWith('/admin/'))){const r=await http(f,path,{userId:a.user.id,role:'user',email:email(),password},a.jar);expect(r.status).toBe(404);}expect(f.master.prepare('SELECT role FROM auth_user WHERE id=?').get(a.user.id).role).toBe('admin');});
test('recovery wrong-purpose proof and explicit target confirmation fail',async()=>{const f=await setup(),a=await enrolled(f),b=await enrolled(f,'user');await expect(issueRecovery(f.auth,f.master,a.source,await proof(f,a,'password.change'),b.user.id,{confirmedTarget:true})).rejects.toThrow('invalid_proof');await expect(issueRecovery(f.auth,f.master,a.source,await proof(f,a),b.user.id,{})).rejects.toThrow('target_verification_required');expect(f.master.prepare("SELECT count(*) n FROM auth_verification WHERE identifier LIKE 'reset-password:%'").get().n).toBe(0);});
test('reset rejects callback changes to scheme, port, subdomain, path and credentials',async()=>{const f=await setup(),b=await enrolled(f,'user'),link=await issueRecovery(f.auth,f.master,'operator',null,b.user.id,{confirmedTarget:true});for(const callback of ['https://localhost:3000/reset-password','http://localhost:3786/reset-password','http://sub.localhost:3000/reset-password','http://localhost:3000/reset-password/','http://u@localhost:3000/reset-password']){const url=new URL(link.url);url.searchParams.set('callbackURL',callback);const r=await f.auth.handler(new Request(url));expect(r.status).toBe(400);expect(r.headers.get('location')).toBeNull();}});
test('reset JSON origin, content type, anonymous invalid token and burst limit',async()=>{
 const f=await setup(undefined,{libraryRateLimits:true});
 for(const extra of [{origin:'https://foreign.example.test'},{origin:'null'},{'content-type':'text/plain'}]){const r=await http(f,'/reset-password',{token:'invalid',newPassword:password},new CookieJar(),extra);expect([400,403]).toContain(r.status);expect(r.headers.get('cache-control')).toBe('no-store');expect(r.headers.get('referrer-policy')).toBe('no-referrer');}
 const statuses=[];for(let i=0;i<6;i++)statuses.push((await http(f,'/reset-password',{token:'invalid',newPassword:password},new CookieJar(),{'x-forwarded-for':'192.0.2.201'})).status);expect(statuses.slice(0,5)).toEqual([400,400,400,400,400]);expect(statuses[5]).toBe(429);
});
test('signup/admin wrappers same-origin JSON, permission distinction, signup limit and recovery limit',async()=>{
 for(const route of [signup,adminInvite]){expect((await route(req(new CookieJar(),{},'/api/auth/signup',{origin:'https://foreign.example.test'}))).status).toBe(403);expect((await route(req(new CookieJar(),{},'/api/auth/signup',{'content-type':'text/plain'}))).status).toBe(400);}
 const a=await createAuthenticatedTestSession(undefined,'admin'),u=await createAuthenticatedTestSession(undefined,'user'),context={params:Promise.resolve({userId:u.user.id})};
 expect((await adminRecovery(req(new CookieJar(),{confirmedTarget:true}),context)).status).toBe(401);expect((await adminRecovery(req(u.jar,{confirmedTarget:true}),context)).status).toBe(403);
 const signupStatuses=[];for(let i=0;i<4;i++)signupStatuses.push((await signup(req(new CookieJar(),body('invalid'),'/api/auth/signup',{'x-forwarded-for':'192.0.2.202'}))).status);expect(signupStatuses).toEqual([403,403,403,429]);
 const statuses=[];for(let i=0;i<4;i++)statuses.push((await adminRecovery(req(a.jar,{confirmedTarget:true}),context)).status);expect(statuses).toEqual([403,403,403,429]);
 const unknown=await http(await setup(),'/reset-password',{token:'invalid',newPassword:password});expect(JSON.stringify(await unknown.json())).not.toContain('@');
});
test('external BA mount remains 503',async()=>{const r=await publicBA();expect(r.status).toBe(503);expect(await r.json()).toEqual({code:'auth_integration_pending'});});
test('normal lifecycle/recovery audits have one actor-bound secret-free row each',async()=>{
 const f=await setup(),a=await enrolled(f),b=await enrolled(f,'user');
 await updateUserLifecycle(f.auth,f.master,a.source,req(a.jar),b.user.id,{name:'Synthetic Updated'});
 expect(f.master.prepare("SELECT count(*) n FROM admin_audit WHERE action='user.update' AND actorUserId=? AND targetUserId=?").get(a.user.id,b.user.id).n).toBe(1);
 const recovered=await issueRecovery(f.auth,f.master,'operator',null,b.user.id,{confirmedTarget:true});const rows=f.master.prepare("SELECT * FROM admin_audit WHERE action='user.recovery_issue' AND targetUserId=?").all(b.user.id);expect(rows).toHaveLength(1);expect(rows[0].actorUserId).toBe('operator');const all=JSON.stringify(f.master.prepare('SELECT * FROM admin_audit').all());for(const secret of [new URL(recovered.url).pathname.split('/').at(-1)!,password,a.factor.totpURI])expect(all).not.toContain(secret);
});
test('audit finalization fault records committed update and a separate idempotent reconciliation',async()=>{
 const f=await setup(),a=await enrolled(f),b=await enrolled(f,'user');
 f.master.exec("CREATE TRIGGER fail_finish BEFORE UPDATE ON admin_lifecycle_operations WHEN OLD.slot='admin-lifecycle' AND NEW.slot IS NULL BEGIN SELECT RAISE(ABORT,'synthetic finish failure'); END");
 await expect(updateUserLifecycle(f.auth,f.master,a.source,req(a.jar),b.user.id,{name:'Synthetic Single Mutation'})).rejects.toThrow('synthetic finish failure');
 expect(f.master.prepare('SELECT name FROM auth_user WHERE id=?').get(b.user.id).name).toBe('Synthetic Single Mutation');expect(f.master.prepare("SELECT count(*) n FROM admin_audit WHERE action='user.update' AND targetUserId=?").get(b.user.id).n).toBe(1);
 f.master.exec('DROP TRIGGER fail_finish');await reconcileLifecycle(f.auth,f.master,Date.now()+1);expect(f.master.prepare("SELECT count(*) n FROM admin_audit WHERE action='user.update' AND targetUserId=?").get(b.user.id).n).toBe(2);await reconcileLifecycle(f.auth,f.master,Date.now()+1);expect(f.master.prepare("SELECT count(*) n FROM admin_audit WHERE action='user.update' AND targetUserId=?").get(b.user.id).n).toBe(2);
});
test('F2 observation: operator script issues recovery while app and its security intent are live',async()=>{
 const f=await setup(),b=await enrolled(f,'user'),data=mkdtempSync(tmpdir()+'/operator-live-');mkdirSync(data+'/db');const dbPath=data+'/db/main.db';f.master.exec(`VACUUM INTO '${dbPath}'`);const liveDb=new Database(dbPath);liveDb.exec('PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL');
 const auth=createNoctuaAuth({database:liveDb,policyDatabase:async()=>liveDb,baseURL:'http://localhost:3786',secret:'noctua-auth-test-secret-0123456789abcdef'});
 const op=await reserveSecurityOperation(liveDb,b.user.id,'security.synthetic-live');
 const server=Bun.serve({hostname:'127.0.0.1',port:3786,fetch:request=>auth.handler(request)});
 try{
  expect((await fetch('http://127.0.0.1:3786/api/ba/ok')).status).toBe(200);
  const child=Bun.spawn([process.execPath,'--no-env-file','scripts/recoverTeamAuth.ts','--application-stopped','--confirm-personal-handover','--user-id',b.user.id],{cwd:'/app',env:{PATH:'/tool:/usr/bin',HOME:process.env.HOME!,TMPDIR:process.env.TMPDIR!,XDG_CACHE_HOME:process.env.XDG_CACHE_HOME!,BUN_RUNTIME_TRANSPILER_CACHE_PATH:'0',JSC_useJIT:'false',JSC_useGigacage:'false',JSC_useWebAssembly:'false',NOCTUA_DATA_DIR:data,BETTER_AUTH_URL:'http://localhost:3786',BETTER_AUTH_SECRET:'noctua-auth-test-secret-0123456789abcdef',IMAP_SECRET_KEY:'test-imap-secret-key-32-chars-minimum__',IMAP_CREDENTIALS_STORAGE:'db',PASSKEY_RP_ID:'localhost',BETTER_AUTH_TELEMETRY:'0'},stdout:'pipe',stderr:'pipe'});
  const [out,err,exit]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  expect(exit,err).toBe(0);expect(out).toContain('http://localhost:3786/api/ba/reset-password/');expect(liveDb.prepare('SELECT slot,state FROM admin_lifecycle_operations WHERE id=?').get(op.id)).toEqual({slot:null,state:'cancelled'});expect(liveDb.prepare("SELECT count(*) n FROM admin_audit WHERE action='user.recovery_issue' AND actorUserId='operator'").get().n).toBe(1);expect((await fetch('http://127.0.0.1:3786/api/ba/ok')).status).toBe(200);
 }finally{await server.stop(true);liveDb.close();}
});

test('each successful slice5 mutation emits exactly one audit with correct actor',async()=>{
 const f=await setup(),a=await enrolled(f),b=await enrolled(f,'user');
 async function once(action:string,actor:string,run:()=>Promise<unknown>){const before=f.master.prepare('SELECT id FROM admin_audit').all().map((r:any)=>r.id);await run();const rows=f.master.prepare('SELECT * FROM admin_audit').all().filter((r:any)=>!before.includes(r.id));expect(rows).toHaveLength(1);expect(rows[0].action).toBe(action);expect(rows[0].actorUserId).toBe(actor);return rows[0];}
 const address=email();let code='';await once('user.create',a.user.id,async()=>{code=(await issueOnboardingInvite(f.master,a.source,{email:address,name:'Synthetic Target',role:'user'})).invite.code;});
 let created:any;
 // Signup actor is its new user; discover it after the mutation, then check the single row.
 const before=f.master.prepare('SELECT count(*) n FROM admin_audit').get().n;created=await provisionUser(f.auth,f.master,body(code,address),verified);expect(f.master.prepare('SELECT count(*) n FROM admin_audit').get().n).toBe(before+1);expect(f.master.prepare("SELECT actorUserId FROM admin_audit WHERE action='user.create' AND targetUserId=?").get(created.userId).actorUserId).toBe(created.userId);
 await once('user.update',a.user.id,()=>updateUserLifecycle(f.auth,f.master,a.source,req(a.jar),b.user.id,{name:'Synthetic Name'}));
 await once('user.disable',a.user.id,()=>updateUserLifecycle(f.auth,f.master,a.source,req(a.jar),b.user.id,{disabled:true}));
 await once('user.enable',a.user.id,()=>updateUserLifecycle(f.auth,f.master,a.source,req(a.jar),b.user.id,{disabled:false}));
 await once('user.sessions_revoke',a.user.id,async()=>mutateAdminSecurity(f.master,a.source,await proof(f,a),b.user.id,{},'sessions-revoke'));
 f.master.prepare("INSERT INTO auth_passkey(id,userId,publicKey,credentialID,counter,deviceType,backedUp) VALUES('synthetic-audit-key',?,'synthetic-public','synthetic-credential',0,'singleDevice',0)").run(b.user.id);
 await once('user.passkey_remove',a.user.id,async()=>mutateAdminSecurity(f.master,a.source,await proof(f,a),b.user.id,{},'passkey-remove','synthetic-audit-key'));
 await once('user.mfa_reset',a.user.id,async()=>mutateAdminSecurity(f.master,a.source,await proof(f,a),b.user.id,{confirmedTarget:true},'mfa-reset'));
 let issued:any;await once('user.recovery_issue',a.user.id,async()=>{issued=await issueRecovery(f.auth,f.master,a.source,await proof(f,a),b.user.id,{confirmedTarget:true});});
 await once('user.password_reset',b.user.id,async()=>{const r=await http(f,'/reset-password',{token:new URL(issued.url).pathname.split('/').at(-1),newPassword:'synthetic-replaced-password'});expect(r.status).toBe(200);});
 await once('user.recovery_issue','operator',()=>issueRecovery(f.auth,f.master,'operator',null,b.user.id,{confirmedTarget:true}));
 await once('user.delete',a.user.id,()=>removeUserLifecycle(f.auth,f.master,a.source,req(a.jar),b.user.id,{}));
 const all=JSON.stringify(f.master.prepare('SELECT * FROM admin_audit').all());for(const value of [code,new URL(issued.url).pathname.split('/').at(-1)!,password,a.factor.totpURI,'synthetic-replaced-password'])expect(all).not.toContain(value);
});
test('reset path aliases cannot bypass strict request contract',async()=>{const f=await setup(),b=await enrolled(f,'user');for(const path of ['/reset-password/','//reset-password','/reset-password%2f']){const link=await issueRecovery(f.auth,f.master,'operator',null,b.user.id,{confirmedTarget:true}),token=new URL(link.url).pathname.split('/').at(-1)!;const r=await http(f,path,{token,newPassword:password,extra:'should reject'});expect([400,403,404]).toContain(r.status);expect(f.master.prepare('SELECT 1 FROM auth_verification WHERE identifier=?').get('reset-password:'+token)).not.toBeNull();}});
test('recovery fresh-factor proof cannot be replaced by password alone or backup code',async()=>{const f=await setup(),a=await enrolled(f);for(const fields of [{currentPassword:password},{currentPassword:password,backupCode:a.factor.backupCodes[0]}])await expect(reauthenticate(f.auth,f.master,a.source,req(a.jar),{purpose:'admin.recovery',...fields},createRateLimiter({max:100}))).rejects.toThrow();expect(f.master.prepare("SELECT count(*) n FROM auth_reauth_grants WHERE purpose='admin.recovery'").get().n).toBe(0);});
test('recovery grant is consumed once and reset preserves entire factor records',async()=>{
 const f=await setup(),a=await enrolled(f),b=await enrolled(f,'user'),r=await proof(f,a);
 f.master.prepare("INSERT INTO auth_passkey(id,userId,publicKey,credentialID,counter,deviceType,backedUp) VALUES('synthetic-preserved-key',?,'synthetic-public','synthetic-credential',0,'singleDevice',0)").run(b.user.id);
 const before=JSON.stringify({totp:f.master.prepare('SELECT * FROM auth_two_factor WHERE userId=?').all(b.user.id),keys:f.master.prepare('SELECT * FROM auth_passkey WHERE userId=?').all(b.user.id)});
 const issued=await issueRecovery(f.auth,f.master,a.source,r,b.user.id,{confirmedTarget:true});await expect(issueRecovery(f.auth,f.master,a.source,r,b.user.id,{confirmedTarget:true})).rejects.toThrow();
 const response=await http(f,'/reset-password',{token:new URL(issued.url).pathname.split('/').at(-1),newPassword:'synthetic-preserved-factor-password'});expect(response.status).toBe(200);expect(response.headers.get('set-cookie')).toBeNull();expect(JSON.stringify({totp:f.master.prepare('SELECT * FROM auth_two_factor WHERE userId=?').all(b.user.id),keys:f.master.prepare('SELECT * FROM auth_passkey WHERE userId=?').all(b.user.id)})).toBe(before);
});
test('configured Next log exclusions and URL redaction exclude synthetic capability',async()=>{
 const config=(await import('./next.config')).default,{redactAuthUrl}=await import('./lib/authRecoveryContext');const token='synthetic-reset-capability';
 for(const url of [`http://localhost:3000/api/ba/reset-password/${token}?callbackURL=http%3A%2F%2Flocalhost%3A3000%2Freset-password`,`http://localhost:3000/reset-password?token=${token}`]){expect(config.logging!.incomingRequests!.ignore.some((rule:RegExp)=>rule.test(url))).toBe(true);expect(redactAuthUrl(url)).not.toContain(token);}
 expect(await config.headers!()).toContainEqual({source:'/reset-password',headers:[{key:'Cache-Control',value:'no-store'},{key:'Referrer-Policy',value:'no-referrer'}]});
});
