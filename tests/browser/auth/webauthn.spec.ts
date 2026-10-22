import {SCENARIOS} from "./scenarios";
import {test,expect,api,ceremony,signIn,grant,register,invalidate} from "./fixtures";

// Real CTAP/WebAuthn ceremonies; no verification callback is faked. Secret screens are never recorded.
test(SCENARIOS.registration,async({page,seed,authenticator})=>{
  await authenticator.setUV(true);
  await signIn(page,seed);
  const enrolled=await register(page,seed);
  expect((await api(page,"/api/ba/passkey/verify-registration",{response:enrolled.response},enrolled.token)).status).not.toBe(200);
  await api(page,"/api/ba/sign-out",{});
  const options=await api(page,"/api/ba/passkey/generate-authenticate-options");
  const assertion=await ceremony(page,options.body,false);
  expect((await api(page,"/api/ba/passkey/verify-authentication",{response:assertion})).status).toBe(200);
  const me=await api(page,"/api/auth/me");
  expect(me.body.security.reauthRequired).toBe(false);
  const oldCookies=await page.context().cookies();
  const uvIntent=await grant(page,seed,"passkey.enroll",true);
  const uvOptions=await api(page,"/api/ba/passkey/generate-authenticate-options",undefined,uvIntent);
  const uvResponse=await ceremony(page,uvOptions.body,false);
  const verified=await api(page,"/api/ba/passkey/verify-authentication",{response:uvResponse},uvIntent);
  expect(verified.status).toBe(200);
  expect(verified.body.purpose).toBe("passkey.enroll");
  const newCookies=await page.context().cookies();
  expect(newCookies.find(cookie=>cookie.name==="noctua.session_token")?.value).not.toBe(oldCookies.find(cookie=>cookie.name==="noctua.session_token")?.value);
  await page.context().clearCookies();
  await page.context().addCookies(oldCookies);
  expect((await api(page,"/api/ba/passkey/generate-register-options",undefined,verified.body.grant)).status).not.toBe(200);
  await page.context().clearCookies();
  await page.context().addCookies(newCookies);
  expect((await api(page,"/api/ba/passkey/generate-register-options",undefined,verified.body.grant)).status).toBe(200);
});

test(SCENARIOS.uv,async({page,seed,authenticator})=>{
  await signIn(page,seed);
  await authenticator.setUV(true);
  const enrolled=await register(page,seed);
  const token=await grant(page,seed);
  const options=await api(page,"/api/ba/passkey/generate-register-options",undefined,token);
  await authenticator.setUV(false);
  // Production hints require UV; preferred here permits an actual non-UV attestation to reach the callback.
  const badRegistration=await ceremony(page,options.body,true,true);
  expect((await api(page,"/api/ba/passkey/verify-registration",{response:badRegistration},token)).body.code).toBe("passkey_uv_required");
  invalidate(seed,"revoke");
  await page.context().clearCookies();
  const assertionOptions=await api(page,"/api/ba/passkey/generate-authenticate-options");
  const badAssertion=await ceremony(page,{...assertionOptions.body,allowCredentials:[{id:enrolled.response.id,type:"public-key"}]},false);
  expect((await api(page,"/api/ba/passkey/verify-authentication",{response:badAssertion})).body.code).toBe("passkey_uv_required");
  expect((await api(page,"/api/auth/me")).status).toBe(401);
});

test(SCENARIOS.mismatch,async({page,seed,authenticator})=>{
  await authenticator.setUV(true);
  await signIn(page,seed);
  const token=await grant(page,seed);
  const options=await api(page,"/api/ba/passkey/generate-register-options",undefined,token);
  const response=await ceremony(page,options.body,true);
  // ClientData is signed; changing its origin must be rejected before registration persistence.
  const data=JSON.parse(Buffer.from(response.response.clientDataJSON,"base64url").toString());
  response.response.clientDataJSON=Buffer.from(JSON.stringify({...data,origin:"https://foreign.example.test"})).toString("base64url");
  expect((await api(page,"/api/ba/passkey/verify-registration",{response},token)).status).not.toBe(200);
  // A new login after the failed ceremony needs local reconciliation (also exercises interrupted operation quarantine).
  invalidate(seed,"revoke");
  await page.context().clearCookies();
  await signIn(page,seed);
  const secondToken=await grant(page,seed);
  const fresh=await api(page,"/api/ba/passkey/generate-register-options",undefined,secondToken);
  await expect(ceremony(page,{...fresh.body,rp:{...fresh.body.rp,id:"foreign.example.test"}},true)).rejects.toThrow();
  const good=await ceremony(page,fresh.body,true);
  expect((await api(page,"/api/ba/passkey/verify-registration",{response:good},token)).status).not.toBe(200);
});

for(const mode of ["reset","revoke"] as const)test(SCENARIOS[mode],async({page,seed,authenticator})=>{
  await authenticator.setUV(true);
  await signIn(page,seed);
  await register(page,seed);
  await api(page,"/api/ba/sign-out",{});
  const options=await api(page,"/api/ba/passkey/generate-authenticate-options");
  const assertion=await ceremony(page,options.body,false);
  invalidate(seed,mode);
  expect((await api(page,"/api/ba/passkey/verify-authentication",{response:assertion})).status).not.toBe(200);
  expect((await api(page,"/api/auth/me")).status).toBe(401);
});
