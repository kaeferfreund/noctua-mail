import {getAuth} from '../../../lib/betterAuth';
import {getDb,closeAllDbConnections} from '../../../lib/db/connection';
import {persistAccountRow} from '../../../lib/db/rowParsers';
import {insertUserAccountLinkRow} from '../../../lib/db/users';
import {withAuthProof} from '../../../lib/authPolicyContext';
import {totpFromUri} from '../../helpers/totp';
if (!process.env.QA_SHELL_SEED_FILE || !process.env.NOCTUA_DATA_DIR?.startsWith(`${process.cwd()}/.tmp/qa-shell-`)) throw new Error('Isolated QA shell storage required');
const db=await getDb(), auth=await getAuth();
const seeds=[];
for(const [email,role] of [['alex@example.test','admin'],['jo@example.test','user']] as const){
 const password='synthetic-qa-shell-password';
 const result=await withAuthProof({db,internal:true,creation:{userId:crypto.randomUUID(),email,role},authenticatedAt:Date.now(),method:'migration_fixture',createdSessionIds:[]},()=>auth.api.createUser({body:{email,name:email.startsWith('alex')?'Synthetic Alex':'Synthetic Jo',password,role}}));
 const signed=await auth.api.signInEmail({body:{email,password},returnHeaders:true});
 const {parseSetCookieHeader}=await import('better-auth/cookies');
 const cookies=new Map<string,string>();
 const absorb=(h:Headers)=>parseSetCookieHeader(h.get('set-cookie')??'').forEach((v,k)=>{if(v.value)cookies.set(k,v.value)});
 absorb(signed.headers);
 const headers=()=>new Headers({cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')});
 const seed=await auth.api.enableTwoFactor({headers:headers(),body:{password}});
 if(seed.method!=='totp')throw Error('totp missing');
 const verified=await auth.api.verifyTOTP({headers:headers(),body:{code:totpFromUri(seed.totpURI)},returnHeaders:true});absorb(verified.headers);
 await auth.api.signOut({headers:headers()});
 seeds.push({email,password,totpURI:seed.totpURI,id:result.user.id});
}
const account={id:'qa-shared',email:'demo@monkeydent.test',name:'QA Shared',avatar:'',ownerUserId:seeds[0].id,imap:{host:'127.0.0.1',port:3857,secure:false,user:'demo@monkeydent.test',password:'demo'},smtp:{host:'127.0.0.1',port:3858,secure:false,user:'demo@monkeydent.test',password:'demo'}};
persistAccountRow(db,account);
insertUserAccountLinkRow(db,seeds[0].id,account.id,'manager');
await Bun.write(process.env.QA_SHELL_SEED_FILE,JSON.stringify(seeds));closeAllDbConnections();
