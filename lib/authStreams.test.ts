import {test,expect} from "bun:test";
import {createAuthenticatedTestSession} from "./testAuthHarness";
import {requireActiveUserSession} from "./auth";
import {assertStreamAuthorized} from "./authStreams";
import {createStreamEventSender} from "@/app/api/accounts/[accountId]/imap/stream/streamEventSender";

// Execute the stream route's real sender against the real checker/DB, with only its transport replaced.
test("generation commit between stream check and enqueue prevents sensitive delivery",async()=>{
  const f=await createAuthenticatedTestSession();
  const identity=await requireActiveUserSession(new Request("http://localhost:3000",{headers:f.jar.headers()}));
  if(identity instanceof Response)throw new Error("Missing fixture");
  let delivered=0,closed=0;
  const send=createStreamEventSender({identity,accountId:"synthetic",role:"viewer",controller:{enqueue:()=>{delivered++;}},
    isStopped:()=>false,close:()=>{closed++;}});
  await send("message",{subject:"Synthetic envelope"});
  expect(delivered).toBe(1);
  // `send` suspends before its check: the revocation commits after the stream opened and before this event is enqueued.
  const pending=send("message",{subject:"Synthetic envelope"});
  f.master.transaction(()=>f.master.prepare("UPDATE auth_security_state SET generation=generation+1 WHERE userId=?").run(f.user.id)).immediate();
  await pending;
  expect(delivered).toBe(1);
  expect(closed).toBe(1);
  await expect(assertStreamAuthorized(identity)).rejects.toThrow("revoked");
});

test("a used session authenticated days ago keeps stream access until its sliding expiry passes",async()=>{
  const f=await createAuthenticatedTestSession();
  const authenticatedAt=Date.now()-4*86400_000;
  await f.seedSessionSecurity(f.session.id,f.user.id,"mfa","password_totp",authenticatedAt);
  const identity=await requireActiveUserSession(new Request("http://localhost:3000",{headers:f.jar.headers()}));
  if(identity instanceof Response)throw new Error(`Session authenticated four days ago was denied: ${identity.status}`);
  expect(identity.authenticatedAt).toBe(authenticatedAt);
  let delivered=0;
  await assertStreamAuthorized(identity,()=>{delivered++;});
  expect(delivered).toBe(1);
  f.master.prepare("UPDATE auth_session SET expiresAt=? WHERE id=?").run(new Date(Date.now()-1000).toISOString(),f.session.id);
  await expect(assertStreamAuthorized(identity,()=>{delivered++;})).rejects.toThrow("revoked");
  expect(delivered).toBe(1);
});
