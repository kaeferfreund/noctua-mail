import {expect,test} from "bun:test";
import {POST} from "./route";
import {PATCH,DELETE} from "./[userId]/route";
import {POST as recover} from "./[userId]/recovery/route";
import {POST as signup} from "../../auth/signup/route";
import {POST as reauth} from "../../auth/reauth/route";
import {createAuthenticatedTestSession,syntheticRequestIp,totpFromUri} from "@/lib/testAuthHarness";

function request(path:string,cookie:string,body:unknown,method="POST",extra:Record<string,string>={}) {
  return new Request(`http://localhost:3000/api/${path}`,{method,headers:{cookie,origin:"http://localhost:3000","content-type":"application/json","x-forwarded-for":syntheticRequestIp(),...extra},body:JSON.stringify(body)});
}
test("HTTP admin onboarding, target update/recovery/delete and setup signup contract",async()=>{
  const actor=await createAuthenticatedTestSession(undefined,"admin"),address=`onboard-${crypto.randomUUID()}@example.test`;
  const issue=await POST(request("admin/users",actor.jar.header(),{email:address,name:"Synthetic Target",role:"user"}));
  expect(issue.status).toBe(201);const {invite}=await issue.json();expect(invite.email).toBe(address);
  const joined=await signup(request("auth/signup","",{inviteCode:invite.code,email:address,name:"Synthetic Target",password:"synthetic-onboarding-password"}));
  expect(joined.status).toBe(201);
  const body=await joined.json();expect(body).toMatchObject({ok:true,accountId:null,security:{enrollmentRequired:true}});
  // Signup commits before automatic login. The HTTP sign-in burst limiter may
  // require an explicit login under randomized reruns; both are public responses.
  expect(typeof body.loginRequired).toBe("boolean");
  if (body.loginRequired) expect(joined.headers.get("set-cookie")).toBeNull();
  else expect(joined.headers.get("set-cookie")).toContain("noctua.session_token");
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

test("GET user accounts use each target's owner/viewer/editor/manager role",async()=>{
  const {GET}=await import("./route"),{persistAccountRow}=await import("@/lib/db/rowParsers");
  const actor=await createAuthenticatedTestSession(undefined,"admin");
  const box={id:`roles-${crypto.randomUUID()}`,email:`roles-${crypto.randomUUID()}@example.test`,name:"Synthetic Roles",avatar:"",ownerUserId:actor.user.id,imap:{host:"imap.example.test",port:993,secure:true,user:"roles@example.test",password:"synthetic-secret"},smtp:{host:"smtp.example.test",port:465,secure:true,user:"roles@example.test",password:"synthetic-secret"}};
  persistAccountRow(actor.master,box);
  const expected=[{id:actor.user.id,role:"manager",isOwner:true}];
  for(const role of ["viewer","editor","manager"]) {
    const target=await actor.createUser(`role-${crypto.randomUUID()}@example.test`);
    await actor.addMembership(target.id,box.id,role);expected.push({id:target.id,role,isOwner:false});
  }
  const response=await GET(new Request("http://localhost:3000/api/admin/users",{headers:actor.jar.headers()}));
  expect(response.status).toBe(200);const {users}=await response.json();
  for(const target of expected)expect(users.find((u:{id:string})=>u.id===target.id).accounts).toEqual([{id:box.id,name:box.name,email:box.email,role:target.role,isOwner:target.isOwner}]);
});

test("generic HTTP invite issuance uses shared actor audit and redemption",async()=>{
  const {POST:issue}=await import("../invites/route"),actor=await createAuthenticatedTestSession(undefined,"admin");
  const before=actor.master.prepare(`SELECT count(*) n FROM admin_audit`).get().n;
  const response=await issue(request("admin/invites",actor.jar.header(),{}));expect(response.status).toBe(201);
  const {invite}=await response.json();expect(invite).toMatchObject({email:null,role:"user",maxUses:1,issuedByUserId:actor.user.id,provenance:"admin"});
  expect(actor.master.prepare(`SELECT count(*) n FROM admin_audit`).get().n).toBe(before+1);
  const audit=actor.master.prepare(`SELECT actorUserId,payload FROM admin_audit ORDER BY rowid DESC LIMIT 1`).get();expect(audit.actorUserId).toBe(actor.user.id);expect(audit.payload).not.toContain(invite.code);
  const joined=await signup(request("auth/signup","",{inviteCode:invite.code,email:`generic-${crypto.randomUUID()}@example.test`,name:"Synthetic",password:"synthetic-generic-password"}));
  expect(joined.status).toBe(201);expect(await joined.json()).toMatchObject({accountId:null,security:{enrollmentRequired:true}});
});

for(const action of ["update","delete","invite","generic-invite"] as const)test(`HTTP ${action} has actor attempt budget and Retry-After`,async()=>{
  const actor=await createAuthenticatedTestSession(undefined,"admin"),context={params:Promise.resolve({userId:`missing-${crypto.randomUUID()}`})};
  const generic=(await import("../invites/route")).POST;
  const run=()=>action==="update"?PATCH(request("admin/users/target",actor.jar.header(),{name:""},"PATCH"),context):action==="delete"?DELETE(request("admin/users/target",actor.jar.header(),{},"DELETE"),context):action==="invite"?POST(request("admin/users",actor.jar.header(),{})):generic(request("admin/invites",actor.jar.header(),{unexpected:true}));
  for(let i=0;i<10;i++)expect((await run()).status).toBe(action==="delete"?404:400);
  const limited=await run();expect(limited.status).toBe(429);expect(limited.headers.get("retry-after")).toBe("60");expect(await limited.json()).toEqual({ok:false,code:"admin_rate_limited"});
});

test("HTTP destructive mutation IP budget spans actors",async()=>{
  const actors=await Promise.all([createAuthenticatedTestSession(undefined,"admin"),createAuthenticatedTestSession(undefined,"admin"),createAuthenticatedTestSession(undefined,"admin"),createAuthenticatedTestSession(undefined,"admin")]);
  const ip=`synthetic-ip-${crypto.randomUUID()}`,context={params:Promise.resolve({userId:"synthetic-missing-ip-target"})};
  for(const actor of actors.slice(0,3))for(let i=0;i<10;i++)expect((await PATCH(request("admin/users/target",actor.jar.header(),{name:""},"PATCH",{"x-forwarded-for":ip}),context)).status).toBe(400);
  const response=await PATCH(request("admin/users/target",actors[3].jar.header(),{name:""},"PATCH",{"x-forwarded-for":ip}),context);
  expect(response.status).toBe(429);expect(response.headers.get("retry-after")).toBe("60");
});

test("HTTP desktop tag cannot bypass invite validation",async()=>{
  const actor=await createAuthenticatedTestSession(undefined,"admin");
  const address=`desktop-${crypto.randomUUID()}@example.test`;
  const response=await signup(request("auth/signup","",{inviteCode:"synthetic-missing-invite",email:address,name:"Synthetic Desktop",password:"synthetic-desktop-password",account:{name:"Synthetic",email:address,imap:{host:"imap.example.test",port:993,secure:true,user:address,password:"synthetic-imap"},smtp:{host:"smtp.example.test",port:465,secure:true,user:address,password:"synthetic-smtp"}}},"POST",{"x-noctua-client":"desktop"}));
  expect(response.status).toBe(403);expect(await response.json()).toEqual({ok:false,code:"invalid_invite"});
  expect(actor.master.prepare(`SELECT 1 FROM user_provisioning WHERE normalizedEmail=?`).get(address)).toBeNull();
});

for(const signin of ["success","response-failure","throw"] as const)test(`HTTP mailbox signup keeps accountId null through enrollment with ${signin} sign-in`,async()=>{
  const {spyOn}=await import("bun:test"),imap=await import("@/lib/mail/imapAuth"),smtp=await import("@/lib/mail/smtp");
  const actor=await createAuthenticatedTestSession(undefined,"admin"),address=`mail-signup-${crypto.randomUUID()}@example.test`;
  const issued=await POST(request("admin/users",actor.jar.header(),{email:address,name:"Synthetic Mail",role:"user"}));expect(issued.status).toBe(201);const {invite}=await issued.json();
  const imapSpy=spyOn(imap,"verifyImapCredentials").mockResolvedValue(true),smtpSpy=spyOn(smtp,"verifySmtpCredentials").mockResolvedValue(true);
  const handler=signin==="success"?undefined:spyOn(actor.auth,"handler");
  if(signin==="response-failure")handler!.mockResolvedValue(new Response(null,{status:503}));
  if(signin==="throw")handler!.mockRejectedValue(new Error("synthetic post-commit sign-in failure"));
  try {
    const response=await signup(request("auth/signup","",{inviteCode:invite.code,email:address,name:"Synthetic",password:"synthetic-mailbox-password",account:{name:"Synthetic",email:address,imap:{host:"imap.example.test",port:993,secure:true,user:address,password:"synthetic-imap"},smtp:{host:"smtp.example.test",port:465,secure:true,user:address,password:"synthetic-smtp"}}}));
    expect(response.status).toBe(201);const body=await response.json();expect(body).toMatchObject({ok:true,accountId:null,security:{enrollmentRequired:true},loginRequired:signin!=="success"});expect(body.enrollmentRequired).toBeUndefined();
    expect(actor.master.prepare(`SELECT ownerUserId FROM accounts WHERE email=?`).get(address).ownerUserId).toBe(body.userId);
    expect(actor.master.prepare(`SELECT state FROM user_provisioning WHERE userId=?`).get(body.userId).state).toBe("complete");
  }finally{imapSpy.mockRestore();smtpSpy.mockRestore();handler?.mockRestore();}
});

test("HTTP self-demotion and self-disable preserve last admin authority",async()=>{
  const actor=await createAuthenticatedTestSession(undefined,"admin"),context={params:Promise.resolve({userId:actor.user.id})};
  for(const body of [{role:"user"},{disabled:true}]) {
    const response=await PATCH(request("admin/users/self",actor.jar.header(),body,"PATCH"),context);
    expect(response.status).toBe(403);expect(await response.json()).toEqual({ok:false,code:"self_admin_mutation_forbidden"});
  }
});

test("HTTP mutation budgets span actions and independent Next module graphs",async()=>{
  const actor=await createAuthenticatedTestSession(undefined,"admin"),context={params:Promise.resolve({userId:"synthetic-absent"})};
  const graphSpecifier="../_users.ts?independent-rate-limit-graph",other=await import(graphSpecifier),generic=(await import("../invites/route")).POST;
  for(let i=0;i<5;i++)expect((await PATCH(request("admin/users/target",actor.jar.header(),{name:""},"PATCH"),context)).status).toBe(400);
  for(let i=0;i<5;i++)expect((await other.handleAdminUser(request("admin/invites",actor.jar.header(),{unexpected:true}),"generic-invite")).status).toBe(400);
  const response=await generic(request("admin/invites",actor.jar.header(),{}));expect(response.status).toBe(429);expect(response.headers.get("retry-after")).toBe("60");
});
