import {test,expect} from "bun:test";
import {readFileSync} from "node:fs";
import {createAuthenticatedTestSession} from "./testAuthHarness";
import {requireActiveUserSession} from "./auth";
import {assertStreamAuthorized} from "./authStreams";

// Execute the route's real closure against the real checker/DB, with only its transport replaced.
test("generation commit between stream check and enqueue prevents sensitive delivery",async()=>{
  const f=await createAuthenticatedTestSession();
  const identity=await requireActiveUserSession(new Request("http://localhost:3000",{headers:f.jar.headers()}));
  if(identity instanceof Response)throw new Error("Missing fixture");
  const route=readFileSync(new URL("../app/api/accounts/[accountId]/imap/stream/route.ts",import.meta.url),"utf8");
  const begin=route.indexOf("        const send = async"),end=route.indexOf("\n\n        type Session",begin);
  expect(begin).toBeGreaterThan(0);expect(end).toBeGreaterThan(begin);
  const wrapper="function sendFactory(assertStreamAuthorized,identity,stopped,controller,encoder,getImapHttpError,mailboxFailureDto,accountId,accountContext,authStream){"+route.slice(begin,end)+";return send;}";
  const compiled=new Bun.Transpiler({loader:"ts",target:"bun"}).transformSync(wrapper);
  const createSend=new Function(compiled+"\nreturn sendFactory;")();
  let delivered=0;
  const send=createSend(assertStreamAuthorized,identity,false,{enqueue:()=>{delivered++;}},new TextEncoder(),()=>null,()=>null,"synthetic",{role:"viewer"},{close:()=>{}});
  const pending=send("message",{subject:"Synthetic envelope"});
  await Promise.resolve();
  f.master.transaction(()=>f.master.prepare("UPDATE auth_security_state SET generation=generation+1 WHERE userId=?").run(f.user.id)).immediate();
  const before=delivered;
  await pending;
  expect(delivered).toBe(before);
  await expect(assertStreamAuthorized(identity)).rejects.toThrow("revoked");
});
