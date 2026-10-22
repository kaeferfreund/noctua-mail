/** Offline synthetic fixtures for the compiled production HTTP mount. No test routes or flags. */
import {SCENARIOS} from "../tests/browser/auth/scenarios";
import {getAuth} from "../lib/betterAuth";
import {getDb,closeAllDbConnections} from "../lib/db/connection";
import {withAuthProof} from "../lib/authPolicyContext";
import {totpFromUri} from "../tests/helpers/totp";
import {writeFileSync} from "node:fs";

if (!process.env.AUTH_BROWSER_DATA_DIR || process.env.NOCTUA_DATA_DIR !== process.env.AUTH_BROWSER_DATA_DIR) throw new Error("Isolated synthetic storage required");
const password="synthetic-browser-password";
const auth=await getAuth();
const {parseSetCookieHeader}=await import("better-auth/cookies");
const seeds:Record<string,unknown>={};
for(const [index,[scenarioId,scenario]] of Object.entries(SCENARIOS).entries()) {
  const email=`browser-${index}@example.test`,role=scenarioId==="management"?"admin":"user";
  const user=await withAuthProof({db:await getDb(),internal:true,creation:{userId:crypto.randomUUID(),email,role},authenticatedAt:Date.now(),method:"migration_fixture",createdSessionIds:[]},()=>auth.api.createUser({body:{email,name:"Synthetic Browser",password,role}}));
  const signed=await auth.api.signInEmail({body:{email:user.user.email,password},returnHeaders:true});
  const cookies=new Map<string,string>();
  const absorb=(headers:Headers)=>parseSetCookieHeader(headers.get("set-cookie")??"").forEach((value,name)=>{if(value.value)cookies.set(name,value.value);});
  absorb(signed.headers);
  const cookieHeaders=()=>new Headers({cookie:[...cookies].map(([name,value])=>`${name}=${value}`).join("; ")});
  const seed=await auth.api.enableTwoFactor({headers:cookieHeaders(),body:{password}});
  if(seed.method!=="totp")throw new Error("TOTP seed missing");
  const verified=await auth.api.verifyTOTP({headers:cookieHeaders(),body:{code:totpFromUri(seed.totpURI)},returnHeaders:true});
  absorb(verified.headers);
  await auth.api.signOut({headers:cookieHeaders()});
  seeds[scenario]={email:user.user.email,password,totpURI:seed.totpURI,userId:user.user.id};
}
writeFileSync(process.env.AUTH_BROWSER_SEED_FILE!,JSON.stringify(seeds),{mode:0o600});

closeAllDbConnections();
