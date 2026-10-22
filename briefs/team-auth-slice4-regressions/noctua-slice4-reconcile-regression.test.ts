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

import {reconcileSecurityOperations} from '/home/monkey/code/noctua-mail/wt-review-auth/lib/db/authPolicy';
test('regression: startup reconciliation restores a flag-only failed activation to restricted setup',async()=>{
 const f=await createTestAuthHarness();try{
  const u=await f.createUser('activation-fault-'+crypto.randomUUID()+'@example.test',pw),jar=await login(f,u.email);
  const g=await reauthenticate(f.auth,f.master,await src(f,jar),req(jar),{purpose:'totp.enroll',currentPassword:pw},createRateLimiter({max:100}));
  const seed=await http(f,jar,'/two-factor/enable',{password:pw},g.grant);
  f.master.exec("CREATE TRIGGER fail_verified BEFORE UPDATE OF verified ON auth_two_factor WHEN NEW.verified=1 BEGIN SELECT RAISE(ABORT,'synthetic verified fault'); END");
  expect((await http(f,jar,'/two-factor/verify-totp',{code:totpFromUri(seed.body.totpURI)},g.grant)).status).not.toBe(200);
  expect(f.master.prepare('SELECT twoFactorEnabled FROM auth_user WHERE id=?').get(u.id).twoFactorEnabled).toBe(1);
  expect(f.master.prepare('SELECT verified FROM auth_two_factor WHERE userId=?').get(u.id).verified).toBe(0);
  f.master.exec('DROP TRIGGER fail_verified');
  await reconcileSecurityOperations(f.master,Date.now()+1);
  const fresh=new CookieJar();const response=await http(f,fresh,'/sign-in/email',{email:u.email,password:pw});
  const verify=await http(f,fresh,'/two-factor/verify-totp',{code:totpFromUri(seed.body.totpURI)});
  console.log('post-reconciliation:',JSON.stringify({loginStatus:response.status,login:response.body,totpStatus:verify.status,totpError:verify.body,hasSession:!!await f.auth.api.getSession({headers:fresh.headers()})}));
  // Design 4.1 requires inconsistent partial activation to become restricted setup after reconciliation.
  expect(response.body.twoFactorRedirect).not.toBe(true);
  expect((await src(f,fresh)).assurance).toBe('setup');
 }finally{f.close();}
});
