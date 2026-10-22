import {expect,test} from "bun:test";
import {POST} from "./route";
import {PATCH,DELETE} from "./[userId]/route";
import {POST as recover} from "./[userId]/recovery/route";
import {POST as signup} from "../../auth/signup/route";
import {POST as reauth} from "../../auth/reauth/route";
import {createAuthenticatedTestSession,totpFromUri} from "@/lib/testAuthHarness";

function request(path:string,cookie:string,body:unknown,method="POST",extra:Record<string,string>={}) {
  return new Request(`http://localhost:3000/api/${path}`,{method,headers:{cookie,origin:"http://localhost:3000","content-type":"application/json","x-forwarded-for":`synthetic-${crypto.randomUUID()}`,...extra},body:JSON.stringify(body)});
}
test("HTTP admin onboarding, target update/recovery/delete and setup signup contract",async()=>{
  const actor=await createAuthenticatedTestSession(undefined,"admin"),address=`onboard-${crypto.randomUUID()}@example.test`;
  const issue=await POST(request("admin/users",actor.jar.header(),{email:address,name:"Synthetic Target",role:"user"}));
  expect(issue.status).toBe(201);const {invite}=await issue.json();expect(invite.email).toBe(address);
  const joined=await signup(request("auth/signup","",{inviteCode:invite.code,email:address,name:"Synthetic Target",password:"synthetic-onboarding-password"}));
  expect(joined.status).toBe(201);expect(joined.headers.get("set-cookie")).toContain("noctua.session_token");
  const body=await joined.json();expect(body).toMatchObject({ok:true,accountId:null,enrollmentRequired:true,loginRequired:false});
  const context={params:Promise.resolve({userId:body.userId})};
  expect((await PATCH(request("admin/users/target",actor.jar.header(),{name:"Synthetic Renamed"},"PATCH"),context)).status).toBe(200);
  expect((await recover(request("admin/users/target/recovery","",{confirmedTarget:true}),context)).status).toBe(401);
  expect((await recover(request("admin/users/target/recovery",actor.jar.header(),{confirmedTarget:true}),context)).status).toBe(403);
  // Decrypting factors is deliberately avoided: createAuthenticatedTestSession exposes
  // no seed. A separate authenticated session with known real enrollment provides the proof.
  const admin=await actor.createUser(`proof-${crypto.randomUUID()}@example.test`,"synthetic-password-123","admin");
  const signed=await actor.signIn(admin.email);const enrollment=await actor.enrollTotp(signed.jar,"synthetic-password-123");
  const live=await actor.auth.api.getSession({headers:signed.jar.headers()});await actor.seedSessionSecurity(live!.session.id,admin.id,"mfa");
  const proof=await reauth(request("auth/reauth",signed.jar.header(),{purpose:"admin.recovery",currentPassword:"synthetic-password-123",totpCode:totpFromUri(enrollment.totpURI)}));
  expect(proof.status).toBe(200);const grant=(await proof.json()).grant;
  const handed=await recover(request("admin/users/target/recovery",signed.jar.header(),{confirmedTarget:true},"POST",{"x-noctua-reauth":grant}),context);
  expect(handed.status).toBe(200);expect(handed.headers.get("cache-control")).toBe("no-store");expect(handed.headers.get("referrer-policy")).toBe("no-referrer");expect(await handed.json()).toMatchObject({ok:true,expiresIn:900});
  expect((await DELETE(request("admin/users/target",signed.jar.header(),{},"DELETE"),context)).status).toBe(200);
});
