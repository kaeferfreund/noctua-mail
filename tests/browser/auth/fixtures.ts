import {test as base,expect,type Page} from "@playwright/test";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {totpFromUri} from "../../helpers/totp";

export {expect};
export type Seed={email:string;password:string;totpURI:string;userId:string};
export const test=base.extend<{seed:Seed;authenticator:{setUV:(verified:boolean)=>Promise<void>;id:()=>string;addDevice:()=>Promise<string>;selectDevice:(id:string)=>Promise<void>}}>({
  seed:async({},provide,testInfo)=>{await provide(JSON.parse(readFileSync(process.env.AUTH_BROWSER_SEED_FILE!,"utf8"))[testInfo.title]);},
  page:async({page},provide)=>{
    await page.route("**/auth-harness",route=>route.fulfill({contentType:"text/html",body:"<!doctype html><html lang=en><title>Synthetic auth fixture</title><body><main>Authentication test fixture</main></body></html>"}));
    await page.goto("/auth-harness");
    await provide(page);
  },
  authenticator:async({page},provide)=>{
    const cdp=await page.context().newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    let {authenticatorId}=await cdp.send("WebAuthn.addVirtualAuthenticator",{options:{protocol:"ctap2",transport:"internal",hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
    const devices=new Set([authenticatorId]);
    const selectDevice=async(id:string)=>{
      if(!devices.has(id))throw new Error("Unknown synthetic authenticator");
      for(const device of devices)await cdp.send("WebAuthn.setAutomaticPresenceSimulation",{authenticatorId:device,enabled:device===id});
      authenticatorId=id;
    };
    await provide({id:()=>authenticatorId,selectDevice,addDevice:async()=>{
      const added=await cdp.send("WebAuthn.addVirtualAuthenticator",{options:{protocol:"ctap2",transport:"usb",hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
      devices.add(added.authenticatorId);await selectDevice(added.authenticatorId);return added.authenticatorId;
    },setUV:async(isUserVerified:boolean)=>{
      await cdp.send("WebAuthn.setUserVerified",{authenticatorId,isUserVerified});
      if(!isUserVerified) {
        // Chromium fails locally when a UV-capable device refuses verification. A non-UV device
        // with the same virtual keys lets preferred-UV ceremonies reach the real server callback.
        const {credentials}=await cdp.send("WebAuthn.getCredentials",{authenticatorId});
        await cdp.send("WebAuthn.removeVirtualAuthenticator",{authenticatorId});devices.delete(authenticatorId);
        ({authenticatorId}=await cdp.send("WebAuthn.addVirtualAuthenticator",{options:{protocol:"ctap2",transport:"internal",hasResidentKey:true,hasUserVerification:false,isUserVerified:false,automaticPresenceSimulation:true}}));
        devices.add(authenticatorId);
        for(const credential of credentials)await cdp.send("WebAuthn.addCredential",{authenticatorId,credential});
      }
    }});
    for(const device of devices)await cdp.send("WebAuthn.removeVirtualAuthenticator",{authenticatorId:device});
  }
});
let lastProofAt = 0;
export async function api(page:Page,path:string,body?:unknown,grant?:string) {
  // Exercise the real production proof limit (5/minute/user+IP), including failed proofs.
  if (path === "/api/auth/reauth") {
    const remaining = lastProofAt + 12500 - Date.now();
    if (remaining > 0) await new Promise(resolve=>setTimeout(resolve,remaining));
    lastProofAt=Date.now();
  }
  return page.evaluate(async({path,body,grant})=>{
    const result=await fetch(path,{method:body===undefined?"GET":"POST",headers:{"content-type":"application/json",...(grant?{"x-noctua-reauth":grant}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:result.status,body:await result.json().catch(()=>({}))};
  },{path,body,grant});
}
export async function signIn(page:Page,seed:Seed) {
  const signed=await api(page,"/api/ba/sign-in/email",{email:seed.email,password:seed.password});
  expect(signed.status, signed.body.code).toBe(200);
  expect(signed.body.twoFactorRedirect).toBe(true);
  expect((await api(page,"/api/ba/two-factor/verify-totp",{code:totpFromUri(seed.totpURI)})).status).toBe(200);
  expect((await api(page,"/api/auth/me")).body.mailboxState).toBe("none");
}
export async function grant(page:Page,seed:Seed,purpose="passkey.enroll",uv=false) {
  const proof=await api(page,"/api/auth/reauth",uv?{purpose,proofMode:"passkey",...(["passkey.enroll","passkey.remove","passkey.rename"].includes(purpose)?{}:{currentPassword:seed.password})}:{purpose,currentPassword:seed.password,totpCode:totpFromUri(seed.totpURI)});
  expect(proof.status).toBe(200);
  return proof.body.grant as string;
}
export async function ceremony(page:Page,options:Record<string,unknown>,register:boolean,preferred=false) {
  return page.evaluate(async({options,register,preferred})=>{
    const decode=(text:string)=>Uint8Array.from(atob(text.replace(/-/g,"+").replace(/_/g,"/")),char=>char.charCodeAt(0));
    const encode=(buffer:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
    const publicKey=options as any;
    publicKey.challenge=decode(publicKey.challenge);
    if(register) {
      publicKey.user.id=decode(publicKey.user.id);
      publicKey.excludeCredentials=(publicKey.excludeCredentials??[]).map((entry:any)=>({...entry,id:decode(entry.id)}));
      if(preferred){publicKey.authenticatorSelection={...publicKey.authenticatorSelection,userVerification:"preferred"};publicKey.excludeCredentials=[];}
    } else publicKey.allowCredentials=(publicKey.allowCredentials??[]).map((entry:any)=>({...entry,id:decode(entry.id)}));
    const result=(register?await navigator.credentials.create({publicKey}):await navigator.credentials.get({publicKey})) as PublicKeyCredential;
    const response=result.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse;
    return {id:result.id,rawId:encode(result.rawId),type:result.type,clientExtensionResults:result.getClientExtensionResults(),authenticatorAttachment:result.authenticatorAttachment,
      response:{clientDataJSON:encode(response.clientDataJSON),...(register?{attestationObject:encode(response.attestationObject),transports:response.getTransports()}:
        {authenticatorData:encode(response.authenticatorData),signature:encode(response.signature),userHandle:response.userHandle?encode(response.userHandle):null})}};
  },{options,register,preferred});
}
export async function register(page:Page,seed:Seed) {
  const token=await grant(page,seed);
  const options=await api(page,"/api/ba/passkey/generate-register-options",undefined,token);
  expect(options.status).toBe(200);
  const response=await ceremony(page,options.body,true);
  const result=await api(page,"/api/ba/passkey/verify-registration",{response,name:"Synthetic browser key"},token);
  expect(result.status).toBe(200);
  return {token,response,options:options.body,passkeyId:result.body.id as string};
}
export function invalidate(seed:Seed,mode:"revoke"|"reset") {
  execFileSync("bun",["scripts/authBrowserInvalidate.ts",mode,seed.userId],{env:process.env,stdio:"pipe"});
}

export function finalizerFault(seed:Seed,mode:"registration"|"uv"|"clear") {
  execFileSync("bun",["scripts/authBrowserFault.ts",mode,seed.userId],{env:process.env,stdio:"pipe"});
}
export function faultState(seed:Seed) {
  const result=execFileSync("bun",["scripts/authBrowserFault.ts","inspect",seed.userId],{env:process.env,encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  return JSON.parse(result.trim().split("\n").at(-1)!);
}
