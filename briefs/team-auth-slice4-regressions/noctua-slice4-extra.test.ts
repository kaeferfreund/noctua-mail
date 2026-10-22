import {test,expect} from 'bun:test';
import {createTestAuthHarness,CookieJar,totpFromUri,TEST_BASE_URL} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/testAuthHarness';
import {readSessionSecurity,reserveSecurityOperation,finishSecurityOperation} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/db/authPolicy';
import {reauthenticate,mutateSecurity} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/authSecurity';
import {RAW_DISABLED_PATHS} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/authPolicyHandler';
import {consumeReauthGrant,hashProof} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/authPolicy';
import {createRateLimiter} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/rateLimit';
const pw='synthetic-review-password';
const req=(jar:any,body:any={},grant?:string)=>new Request(TEST_BASE_URL+'/api/auth/reauth',{method:'POST',headers:jar.headers({origin:TEST_BASE_URL,'content-type':'application/json',...(grant?{'x-noctua-reauth':grant}:{})}),body:JSON.stringify(body)});
async function http(f:any,jar:any,path:string,body?:any,grant?:string){const r=await f.auth.handler(new Request(TEST_BASE_URL+'/api/ba'+path,{method:body===undefined?'GET':'POST',headers:jar.headers({origin:TEST_BASE_URL,'content-type':'application/json',...(grant?{'x-noctua-reauth':grant}:{})}),...(body===undefined?{}:{body:JSON.stringify(body)})}));jar.absorb(r.headers);return{status:r.status,body:await r.json().catch(()=>({}))};}
async function src(f:any,jar:any){const s=await f.auth.api.getSession({headers:jar.headers()});return readSessionSecurity(f.master,s.session.id);}
async function login(f:any,email:string){const jar=new CookieJar();expect((await http(f,jar,'/sign-in/email',{email,password:pw})).status).toBe(200);return jar;}
async function fixture(){const f=await createTestAuthHarness();const user=await f.createUser('extra-'+crypto.randomUUID()+'@example.test',pw);const jar=await login(f,user.email);const limiter=createRateLimiter({max:100});const g=await reauthenticate(f.auth,f.master,await src(f,jar),req(jar),{purpose:'totp.enroll',currentPassword:pw},limiter);const e=await http(f,jar,'/two-factor/enable',{password:pw},g.grant);expect(e.status).toBe(200);expect((await http(f,jar,'/two-factor/verify-totp',{code:totpFromUri(e.body.totpURI)},g.grant)).status).toBe(200);return{...f,user,jar,totp:e.body.totpURI,codes:e.body.backupCodes,limiter};}
async function proof(f:any,purpose='backup.regenerate'){return reauthenticate(f.auth,f.master,await src(f,f.jar),req(f.jar),{purpose,currentPassword:pw,totpCode:totpFromUri(f.totp)},f.limiter);}

test('extra: grant cross-user, rotation, generation, expiry and purpose fail closed',async()=>{const f=await fixture();try{
 const token=(await proof(f)).grant;const original=await src(f,f.jar);
 for(const mode of ['purpose','user','session','generation','expiry']){
  const op=await reserveSecurityOperation(f.master,f.user.id,'security.test');
  try {let source={...original};let purpose:any='backup.regenerate';
   if(mode==='purpose')purpose='password.change';
   if(mode==='user')source.userId='other-user';
   if(mode==='session')source.sessionId='rotated-away';
   if(mode==='generation'){f.master.prepare('UPDATE auth_security_state SET generation=generation+1 WHERE userId=?').run(f.user.id);op.generation++;}
   if(mode==='expiry')f.master.prepare('UPDATE auth_reauth_grants SET expiresAt=0 WHERE tokenHash=?').run(hashProof(token));
   await expect(consumeReauthGrant(f.master,token,source,purpose,op)).rejects.toThrow();
  }finally{await finishSecurityOperation(f.master,op);if(mode==='generation')f.master.prepare('UPDATE auth_security_state SET generation=? WHERE userId=?').run(original.generation,f.user.id);}
 }
}finally{f.close();}});

test('extra: raw installed twoFactor and passkey route inventory blocked or guarded',async()=>{const f=await fixture();try{
 const paths=[['/two-factor/disable',{}],['/two-factor/get-totp-uri',{password:pw}],['/two-factor/generate-backup-codes',{password:pw}],['/two-factor/send-otp',{}],['/two-factor/verify-otp',{code:'000000'}],['/passkey/delete-passkey',{id:'missing'}],['/passkey/update-passkey',{id:'missing',name:'synthetic'}],['/passkey/list-user-passkeys',undefined]] as const;
 for(const [path,body] of paths){const r=await http(f,f.jar,path,body);expect(r.status).not.toBe(200);expect(JSON.stringify(r.body)).not.toContain(f.totp);for(const code of f.codes)expect(JSON.stringify(r.body)).not.toContain(code);}
 expect((await http(f,f.jar,'/two-factor/enable',{password:pw})).status).not.toBe(200);
 expect((await http(f,f.jar,'/passkey/generate-register-options')).status).not.toBe(200);
 console.log('disabledPaths:',JSON.stringify(RAW_DISABLED_PATHS));
}finally{f.close();}});

test('extra: pending TOTP challenge invalidated by committed password reset',async()=>{const f=await fixture();try{
 const pending=await login(f,f.user.email);const token=crypto.randomUUID();await(await f.auth.$context).internalAdapter.createVerificationValue({identifier:'reset-password:'+token,value:f.user.id,expiresAt:new Date(Date.now()+60000)});
 await f.auth.api.resetPassword({body:{token,newPassword:'synthetic-reset-password'}});
 expect((await http(f,pending,'/two-factor/verify-totp',{code:totpFromUri(f.totp)})).status).not.toBe(200);expect(await f.auth.api.getSession({headers:pending.headers()})).toBeNull();
}finally{f.close();}});

test('extra: default reauth limiter rejects sixth TOTP or backup proof per user',async()=>{const f=await fixture();try{
 for(let i=0;i<5;i++)await expect(reauthenticate(f.auth,f.master,await src(f,f.jar),req(f.jar),{purpose:'totp.replace',currentPassword:pw,backupCode:'synthetic-invalid-code'})).rejects.toThrow();
 await expect(reauthenticate(f.auth,f.master,await src(f,f.jar),req(f.jar),{purpose:'totp.replace',currentPassword:pw,backupCode:f.codes[1]})).rejects.toMatchObject({status:429,code:'proof_rate_limited'});
}finally{f.close();}});

test('extra: trailing slash TOTP activation cannot omit initial generation revocation',async()=>{const f=await createTestAuthHarness();try{
 const u=await f.createUser('slash-'+crypto.randomUUID()+'@example.test',pw),a=await login(f,u.email),b=await login(f,u.email);const g=await reauthenticate(f.auth,f.master,await src(f,a),req(a),{purpose:'totp.enroll',currentPassword:pw},createRateLimiter({max:100}));const e=await http(f,a,'/two-factor/enable',{password:pw},g.grant);const r=await http(f,a,'/two-factor/verify-totp/',{code:totpFromUri(e.body.totpURI)},g.grant);if(r.status===200){expect(await f.auth.api.getSession({headers:b.headers()})).toBeNull();}else expect(r.status).not.toBe(200);
}finally{f.close();}});

import {createAuthenticatedTestSession} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/testAuthHarness';
import {dbModulePromise} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/testDbHarness';
import {requireActiveUserSession} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/auth';
import {mintMcpToken,validateMcpToken} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/mcpAuth';
import {assertStreamAuthorized,registerAuthStream} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/authStreams';
import {signOutWithPolicy} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/authSecurity';

async function liveFixture(){const db=await dbModulePromise;const id='extra-'+crypto.randomUUID();await db.upsertAccount({id,name:'Synthetic Review',avatar:'',email:'mailbox@example.test',imap:{host:'imap.example.test',user:'mailbox@example.test',password:'synthetic',port:993,secure:true},smtp:{host:'smtp.example.test',user:'mailbox@example.test',password:'synthetic',port:465,secure:true}});const f=await createAuthenticatedTestSession(id);const context=await requireActiveUserSession(new Request(TEST_BASE_URL,{headers:f.jar.headers()}));if(context instanceof Response)throw new Error('missing fixture');const token=await mintMcpToken(context,id,'Synthetic',3600);const factor=await f.auth.api.getTOTPURI({headers:f.jar.headers(),body:{password:'synthetic-password-123'}});return{...f,id,context,token,totp:factor.totpURI};}

test('extra: password change, backup regeneration and ban revoke live stream and MCP',async()=>{
 for(const action of ['password','backup-codes','passkey-remove','ban'] as const){const f=await liveFixture();let closed=0;const stream=registerAuthStream({...f.context,accountId:f.id},()=>{closed++;});try{
  expect(await validateMcpToken(f.token.token)).not.toBeNull();await assertStreamAuthorized({...f.context,accountId:f.id});
  if(action==='ban')f.master.prepare('UPDATE auth_user SET banned=1 WHERE id=?').run(f.user.id);
  else{const purpose=action==='password'?'password.change':action==='backup-codes'?'backup.regenerate':'passkey.remove';
   const g=await reauthenticate(f.auth,f.master,readSessionSecurity(f.master,f.context.sessionId),req(f.jar),{purpose,currentPassword:'synthetic-password-123',totpCode:totpFromUri(f.totp)},createRateLimiter({max:100}));
   let body:any={currentPassword:'synthetic-password-123',...(action==='password'?{newPassword:'synthetic-changed-password'}:{})};
   if(action==='passkey-remove'){const ctx=await f.auth.$context;const key=await ctx.adapter.create({model:'passkey',data:{name:'Synthetic unused key',publicKey:'synthetic',userId:f.user.id,credentialID:'synthetic-'+crypto.randomUUID(),counter:0,deviceType:'singleDevice',backedUp:false,createdAt:new Date()}});body={passkeyId:key.id};}
   await mutateSecurity(f.auth,f.master,readSessionSecurity(f.master,f.context.sessionId),req(f.jar,{},g.grant),body,action);
   expect(closed).toBe(1);
  }
  expect(await validateMcpToken(f.token.token)).toBeNull();await expect(assertStreamAuthorized({...f.context,accountId:f.id})).rejects.toThrow();
 }finally{stream.close();}}
});

test('extra: logout closes its stream but keeps independent MCP bearer as design 4.7 specifies',async()=>{const f=await liveFixture();let closed=0;const stream=registerAuthStream({...f.context,accountId:f.id},()=>{closed++;});try{await signOutWithPolicy(f.auth,f.master,req(f.jar),f.context);expect(closed).toBe(1);expect(await f.auth.api.getSession({headers:f.jar.headers()})).toBeNull();await expect(assertStreamAuthorized({...f.context,accountId:f.id})).rejects.toThrow();expect(await validateMcpToken(f.token.token)).not.toBeNull();}finally{stream.close();}});

test('extra: generation transaction rollback preserves and commit immediately denies MCP and stream snapshots',async()=>{const f=await liveFixture();const identity={...f.context,accountId:f.id};try{f.master.transaction(()=>{f.master.prepare('UPDATE auth_security_state SET generation=generation+1 WHERE userId=?').run(f.user.id);throw new Error('synthetic rollback');}).immediate();}catch{}expect(await validateMcpToken(f.token.token)).not.toBeNull();await assertStreamAuthorized(identity);f.master.transaction(()=>f.master.prepare('UPDATE auth_security_state SET generation=generation+1 WHERE userId=?').run(f.user.id)).immediate();expect(await validateMcpToken(f.token.token)).toBeNull();await expect(assertStreamAuthorized(identity)).rejects.toThrow();});

test('extra: HTTP twoFactor production limiter rejects fourth raw verification attempt',async()=>{const f=await createTestAuthHarness(options=>Object.assign(options.rateLimit,{enabled:true}));try{const jar=new CookieJar();for(let i=0;i<4;i++){const r=await http(f,jar,'/two-factor/verify-totp',{code:'000000'});if(i===3)expect(r.status).toBe(429);}}finally{f.close();}});

test('extra: lost-device replacement rejects the old TOTP and old backups on next login',async()=>{const f=await fixture();try{const g=await reauthenticate(f.auth,f.master,await src(f,f.jar),req(f.jar),{purpose:'totp.replace',currentPassword:pw,backupCode:f.codes[1]},f.limiter);const r=await mutateSecurity(f.auth,f.master,await src(f,f.jar),req(f.jar,{},g.grant),{currentPassword:pw},'totp-replace');f.jar.absorb(r.headers);const seed=await http(f,f.jar,'/two-factor/enable',{password:pw},r.body.grant as string);expect(seed.status).toBe(200);expect((await http(f,f.jar,'/two-factor/verify-totp',{code:totpFromUri(seed.body.totpURI)},r.body.grant as string)).status).toBe(200);const next=await login(f,f.user.email);expect(totpFromUri(f.totp)).not.toBe(totpFromUri(seed.body.totpURI));expect((await http(f,next,'/two-factor/verify-totp',{code:totpFromUri(f.totp)})).status).not.toBe(200);expect((await http(f,next,'/two-factor/verify-totp',{code:totpFromUri(seed.body.totpURI)})).status).toBe(200);const bad=await login(f,f.user.email);expect((await http(f,bad,'/two-factor/verify-backup-code',{code:f.codes[2]})).status).not.toBe(200);}finally{f.close();}});

import {persistAccountRow,mapAccountRow} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/db/rowParsers';

test('extra: truly empty users and failed IMAP credential check perform no write-back',async()=>{const old=process.env.NOCTUA_IMAP_LOGIN_HOSTS;process.env.NOCTUA_IMAP_LOGIN_HOSTS='imap.example.test';let network=0;const f=await createTestAuthHarness(undefined,{imapVerification:async()=>{network++;return false;}});try{
 expect(f.master.prepare('SELECT count(*) n FROM users').get().n).toBe(0);expect((await http(f,new CookieJar(),'/sign-in/imap',{email:'unknown@example.test',password:'synthetic'})).status).toBe(401);expect(network).toBe(0);
 const u=await f.createUser('imap-failure-'+crypto.randomUUID()+'@example.test',pw);const account={id:crypto.randomUUID(),name:'Synthetic IMAP',avatar:'',email:u.email,ownerUserId:u.id,imap:{host:'imap.example.test',user:u.email,password:'synthetic-old',port:993,secure:true},smtp:{host:'smtp.example.test',user:u.email,password:'synthetic-old',port:465,secure:true}};persistAccountRow(f.master,account);await f.addMembership(u.id,account.id);const r=await http(f,new CookieJar(),'/sign-in/imap',{email:u.email,password:'synthetic-wrong'});expect(r.status).toBe(401);expect(network).toBe(1);expect(mapAccountRow(f.master.prepare('SELECT * FROM accounts WHERE id=?').get(account.id)).imap.password).toBe('synthetic-old');expect(f.master.prepare('SELECT count(*) n FROM auth_session').get().n).toBe(0);expect(JSON.stringify(r.body)).not.toContain('synthetic-wrong');
 }finally{f.close();if(old===undefined)delete process.env.NOCTUA_IMAP_LOGIN_HOSTS;else process.env.NOCTUA_IMAP_LOGIN_HOSTS=old;}});
