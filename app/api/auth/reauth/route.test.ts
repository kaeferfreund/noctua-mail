import {describe,expect,test} from "bun:test";
import {POST} from "./route";
import {POST as passwordChange} from "../security/password/route";
import {GET as security} from "../security/route";
import {GET as methods} from "../methods/route";
import {createAuthenticatedTestSession} from "@/lib/testAuthHarness";
import {getRequestIp} from "@/lib/rateLimit";
function request(cookie:string,body:unknown,origin="http://localhost:3000") {
  return new Request("http://localhost:3000/api/auth/reauth",{method:"POST",headers:{cookie,origin,"content-type":"application/json","x-forwarded-for":`synthetic-${crypto.randomUUID()}`},body:JSON.stringify(body)});
}
describe("Noctua security HTTP wrappers",()=>{
  test("origin and field guards fail locally; failed proof preserves the active session",async()=>{
    const f=await createAuthenticatedTestSession();
    expect((await POST(request(f.jar.header(),{},"https://foreign.example.test"))).status).toBe(403);
    const input={purpose:"password.change",currentPassword:"wrong-synthetic-password",totpCode:"000000"};
    const result=await POST(request(f.jar.header(),input));
    expect(result.status).toBe(403);
    expect((await result.json()).code).toBe("invalid_credentials");
    expect(await f.auth.api.getSession({headers:f.jar.headers()})).not.toBeNull();
    const status=await security(new Request("http://localhost:3000/api/auth/security",{headers:f.jar.headers()}));
    expect((await status.json())).toMatchObject({ok:true,hasPassword:true,totpEnrolled:true,mfaStateInconsistent:false,passkeys:[]});
    expect((await passwordChange(request(f.jar.header(),{newPassword:"new-synthetic-password",revokeOtherSessions:false}))).status).toBe(400);
  });
  test("public method availability never includes an allowlist",async()=>{
    const result=await methods().json();
    expect(Object.keys(result.methods).sort()).toEqual(["imap","passkey","password"]);
    expect(typeof result.methods.imap).toBe("boolean");
    expect(JSON.stringify(result)).not.toContain("HOSTS");
    expect(getRequestIp(request("",{}))).toStartWith("synthetic-");
  });
});
