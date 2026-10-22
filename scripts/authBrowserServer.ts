/** Harness-only custom Next server. There is deliberately no application test route or activation flag. */
import "next/dist/server/node-environment";
import {SCENARIOS} from "../tests/browser/auth/scenarios";
import {createServer} from "node:http";
import next from "next";
import {getAuth} from "../lib/betterAuth";
import {reauthenticate,mutateSecurity} from "../lib/authSecurity";
import {getDb} from "../lib/db/connection";
import {withAuthProof} from "../lib/authPolicyContext";
import {readSessionSecurity} from "../lib/db/authPolicy";
import {totpFromUri} from "../tests/helpers/totp";
import {writeFileSync} from "node:fs";
import {GET as security} from "../app/api/auth/security/route";
import {handleAuthSecurity} from "../app/api/_helpers/authSecurity";
import {GET as me} from "../app/api/auth/me/route";

import {createRateLimiter} from "../lib/rateLimit";
const harnessProofLimiter=createRateLimiter({windowMs:60000,max:100});
const port=Number(process.env.AUTH_BROWSER_PORT??3784);
const base=`http://localhost:${port}`;
const password="synthetic-browser-password";
const auth=await getAuth();
// Real rate limits have HTTP/unit coverage; burst limits would make sequential browser ceremonies timing dependent.
(await auth.$context).rateLimit.enabled=false;
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
const app=next({dev:false,hostname:"localhost",port});
await app.prepare();
const nextHandler=app.getRequestHandler();
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url??"/",base);
    if(!url.pathname.startsWith("/api/ba/")&&!url.pathname.startsWith("/api/auth/"))return nextHandler(req,res);
    const chunks:Buffer[]=[];
    for await(const chunk of req)chunks.push(Buffer.from(chunk));
    const request=new Request(url,{method:req.method,headers:new Headers(Object.entries(req.headers).flatMap(([key,value])=>value===undefined?[]:Array.isArray(value)?value.map(v=>[key,v] as [string,string]):[[key,value] as [string,string]])),
      ...(["GET","HEAD"].includes(req.method??"GET")?{}:{body:Buffer.concat(chunks)})});
    let response:Response;
    if(url.pathname.startsWith("/api/ba/"))response=await auth.handler(request);
    else if(url.pathname==="/api/auth/me")response=await me(request);
    else if(url.pathname==="/api/auth/security")response=await security(request);
    else if(url.pathname==="/api/auth/security/passkeys/remove")response=await handleAuthSecurity(request,"passkey-remove");
    else if(url.pathname==="/api/auth/security/backup-codes")response=await handleAuthSecurity(request,"backup-codes");
    else {
      const db=await getDb();
      const session=await auth.api.getSession({headers:request.headers});
      if(!session)response=Response.json({code:"Unauthorized"},{status:401});
      else {
        const source=readSessionSecurity(db,session.session.id);
        const body:unknown=await request.json();
        if(url.pathname==="/api/auth/reauth")response=Response.json(await reauthenticate(auth,db,source,request,body,harnessProofLimiter));
        else if(url.pathname==="/api/auth/security/password") {
          const changed=await mutateSecurity(auth,db,source,request,body,"password");
          response=Response.json(changed.body,{headers:changed.headers});
        } else response=Response.json({code:"not_found"},{status:404});
      }
    }
    res.statusCode=response.status;
    response.headers.forEach((value,key)=>{if(key!=="set-cookie")res.setHeader(key,value);});
    res.setHeader("set-cookie",response.headers.getSetCookie());
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch(error) {
    const failure=error as {status?:number;code?:string};
    res.statusCode=typeof failure.status==="number"?failure.status:500;
    res.setHeader("content-type","application/json");
    res.end(JSON.stringify({code:failure.code??"harness_request_failed"}));
  }
});
server.listen(port,"localhost");
for(const signal of ["SIGTERM","SIGINT"] as const)process.on(signal,()=>server.close(()=>process.exit(0)));
