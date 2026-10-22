/** Synthetic Stage 1 acceptance against compiled Next. No production state or network mail. */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, cpSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { parseSetCookieHeader } from "better-auth/cookies";

const root=process.cwd(), port=Number(process.env.AUTH_SMOKE_PORT ?? 3799), origin="https://mail.example.org";
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid AUTH_SMOKE_PORT");
mkdirSync(path.join(root,".tmp"),{recursive:true});
const scratch=mkdtempSync(path.join(root,".tmp","auth-smoke-"));
const data=path.join(scratch,"data");
Object.assign(process.env,{NOCTUA_DATA_DIR:data,BETTER_AUTH_URL:origin,PASSKEY_RP_ID:"mail.example.org",
  BETTER_AUTH_SECRET:"synthetic-production-smoke-auth-secret-0123456789",IMAP_SECRET_KEY:"synthetic-production-smoke-independent-imap-key",
  IMAP_CREDENTIALS_STORAGE:"db",NOCTUA_TRUSTED_ORIGINS:"",NOCTUA_IMAP_LOGIN_HOSTS:"",NOCTUA_DESKTOP_MODE:"false",
  BETTER_AUTH_TELEMETRY:"0",BETTER_AUTH_TELEMETRY_ENDPOINT:"",ACCOUNT_DB_IDLE_MS:"0",NODE_ENV:"production"});
const {getDb,getAccountDb,closeAllDbConnections}=await import("../lib/db/connection");
const {encodeSecret,decodeSecret}=await import("../lib/secret");
const {totpFromUri}=await import("../tests/helpers/totp");
let server:ChildProcess|undefined, serverLog="";
const sensitive:string[]=[];
class Jar {
  cookies=new Map<string,string>();
  absorb(headers:Headers) {
    for (const cookie of headers.getSetCookie()) parseSetCookieHeader(cookie).forEach((v,k)=>{
      if (v.value) { this.cookies.set(k,v.value); sensitive.push(v.value,decodeURIComponent(v.value)); }
      else this.cookies.delete(k);
    });
  }
  header(){return [...this.cookies].map(([k,v])=>`${k}=${v}`).join("; ");}
}
async function command(args:string[]) {
  const child=spawn("bun",args,{cwd:root,env:process.env,stdio:["ignore","pipe","pipe"]});
  let out="",err="";child.stdout.on("data",chunk=>out+=chunk);child.stderr.on("data",chunk=>err+=chunk);
  assert.equal(await new Promise(resolve=>child.once("exit",resolve)),0,"offline operator command failed (details withheld)");
  assert.ok(!err.includes("Admin invite code:"));
  return out.trim().split("\n").at(-1)!;
}
async function stop() {
  if(server && server.exitCode===null){server.kill("SIGTERM");await Promise.race([new Promise(resolve=>server!.once("exit",resolve)),delay(5000)]);if(server.exitCode===null){server.kill("SIGKILL");await new Promise(resolve=>server!.once("exit",resolve));}}
  server=undefined;
}
async function start() {
  await new Promise<void>((resolve,reject)=>{const probe=createServer();probe.once("error",reject);probe.listen(port,"localhost",()=>probe.close(()=>resolve()));});
  server=spawn("bun",["--bun","next","start","--port",String(port),"--hostname","localhost"],{cwd:root,env:process.env,stdio:["ignore","pipe","pipe"]});
  server.stdout!.on("data",chunk=>serverLog+=chunk);server.stderr!.on("data",chunk=>serverLog+=chunk);
  for(let n=0;n<120;n++) {
    if(server.exitCode!==null)throw new Error("production server exited; logs withheld");
    try {if((await http("/api/ba/ok")).status===200)return;}catch{/* own startup */}
    await delay(500);
  }
  throw new Error("production readiness timed out");
}
async function http(url:string,body?:unknown,jar?:Jar,extra:Record<string,string>={},method=body===undefined?"GET":"POST") {
  const response=await fetch(`http://localhost:${port}${url}`,{method,redirect:"manual",headers:{host:"mail.example.org",origin,"x-forwarded-host":"mail.example.org","x-forwarded-proto":"https","x-forwarded-port":"443","x-forwarded-for":"192.0.2.40",...(jar?{cookie:jar.header()}:{}),...(body===undefined?{}:{"content-type":"application/json"}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  jar?.absorb(response.headers);
  return {status:response.status,headers:response.headers,body:await response.json().catch(()=>({}))};
}
const password="synthetic-chosen-smoke-password",newPassword="synthetic-recovered-smoke-password";
sensitive.push(password,newPassword,"synthetic-mailbox-secret",process.env.BETTER_AUTH_SECRET!,process.env.IMAP_SECRET_KEY!);
try {
  // Auth probes exit before Next starts, so the merged app lifetime lock is never held by this runner.
  const probe = async (mode:"hash"|"schema") => command(["--eval", `
    import {getAuth,migrateAuthSchema} from "./lib/betterAuth";
    import {closeAllDbConnections} from "./lib/db/connection";
    const auth=await getAuth(),context=await auth.$context;
    await context.checkSchema?.();
    const result=${mode === "hash" ? `await context.password.hash(${JSON.stringify(password)})` : "JSON.stringify(await migrateAuthSchema(auth.options))"};
    closeAllDbConnections();
    console.log(result);
  `]);
  const hash=await probe("hash");sensitive.push(hash);
  let db=await getDb();
  db.exec(`ALTER TABLE users ADD COLUMN name TEXT; ALTER TABLE users ADD COLUMN passwordHash TEXT; ALTER TABLE users ADD COLUMN disabledAt INTEGER;`);
  db.prepare(`INSERT INTO users(id,email,role,createdAt,name,passwordHash) VALUES('smoke-admin','admin@example.test','admin',1234567890000,'Synthetic Admin',?)`).run(hash);
  db.prepare(`INSERT INTO users(id,email,role,createdAt,name,passwordHash) VALUES('smoke-user','person@example.test','user',1234567890000,'Synthetic Person',?)`).run(hash);
  db.prepare(`INSERT INTO accounts(id,name,email,avatar,ownerUserId,imapHost,imapPort,imapSecure,imapUser,imapPassword,smtpHost,smtpPort,smtpSecure,smtpUser,smtpPassword)
    VALUES('smoke-mailbox','Synthetic Shared','shared@example.test','','smoke-admin','imap.example.test',993,1,'shared@example.test',?,'smtp.example.test',465,1,'shared@example.test',?)`).run(encodeSecret("synthetic-mailbox-secret"),encodeSecret("synthetic-mailbox-secret"));
  db.exec(`INSERT INTO user_accounts(userId,accountId,role) VALUES('smoke-admin','smoke-mailbox','manager');
    INSERT INTO mcp_tokens(id,accountId,createdByUserId,label,tokenHash,tokenSuffix,createdAt) VALUES('old-token','smoke-mailbox','smoke-admin','old','old-hash','old',1)`);
  const shard=await getAccountDb("smoke-mailbox");
  shard.exec(`CREATE TABLE synthetic_restore_marker(id TEXT PRIMARY KEY); INSERT INTO synthetic_restore_marker VALUES('stable-shard-id')`);
  closeAllDbConnections();
  const manifest=path.join(scratch,"manifest.json");
  writeFileSync(manifest,JSON.stringify({version:1,users:[{userId:"smoke-admin",legacyUserId:"smoke-admin",email:"admin@example.test",role:"admin",createdAt:1234567890000,passwordProvenance:"user-chosen"},{userId:"smoke-user",legacyUserId:"smoke-user",email:"person@example.test",role:"user",createdAt:1234567890000,passwordProvenance:"user-chosen"}],memberships:[]}),{mode:0o600});
  for(const expected of ["complete","already_complete"]) {
    const out=await command(["scripts/migrateTeamAuth.ts","--application-stopped","--confirm-reviewed-identities","--manifest",manifest]);
    assert.equal(JSON.parse(out).status,expected);assert.ok(!out.includes("@example.test"));
  }
  db=await getDb();assert.equal(db.prepare(`SELECT count(*) n FROM mcp_tokens`).get().n,0);
  console.log("PASS migration CLI twice: stable IDs, chosen hashes, old MCP removed, no secret output");
  await start();
  const ok=await http("/api/ba/ok");assert.equal(ok.status,200);assert.equal(ok.body.ok,true);
  const old=await http("/api/auth/me",undefined,undefined,{cookie:"noctua_session=synthetic-obsolete-cookie"});
  assert.equal(old.status,401);assert.match(old.headers.get("set-cookie")!,/noctua_session=;.*Max-Age=0/);
  for(const raw of ["admin/create-user","change-password","request-password-reset"]){assert.ok([403,404].includes((await http(`/api/ba/${raw}`,{})).status));}
  assert.equal((await http("/api/auth/login",{})).status,404);
  assert.equal((await http("/api/desktop/needs-setup")).status,404);
  assert.equal((await http("/api/ba/sign-in/imap",{email:"admin@example.test",password})).status,401);
  const jar=new Jar();
  assert.equal((await http("/api/ba/sign-in/email",{email:"admin@example.test",password},jar,{origin:"https://foreign.example.test"})).status,403);
  assert.equal((await http("/api/ba/sign-in/email",{email:"admin@example.test",password},jar)).status,200);
  assert.ok(jar.cookies.has("__Secure-noctua.session_token"));
  assert.equal((await http("/api/auth/me",undefined,jar)).body.mailboxState,"enrollment");
  assert.equal((await http("/api/accounts",undefined,jar)).status,403);
  const proof=await http("/api/auth/reauth",{purpose:"totp.enroll",currentPassword:password},jar);assert.equal(proof.status,200);
  const seed=await http("/api/ba/two-factor/enable",{password},jar,{"x-noctua-reauth":proof.body.grant});assert.equal(seed.status,200);sensitive.push(seed.body.totpURI,...seed.body.backupCodes);
  assert.equal((await http("/api/ba/two-factor/verify-totp",{code:totpFromUri(seed.body.totpURI)},jar,{"x-noctua-reauth":proof.body.grant})).status,200);
  assert.equal((await http("/api/auth/me",undefined,jar)).body.mailboxState,"selected");
  assert.equal((await http("/api/accounts",undefined,jar)).status,200);
  console.log("PASS canonical proxy headers: Secure cookies, foreign origin/raw paths/old cookie rejected, enrollment gate and TOTP activation");
  db.prepare(`UPDATE auth_session SET expiresAt=?,updatedAt=? WHERE userId='smoke-admin'`).run(new Date(Date.now()+20*3600000).toISOString(),new Date(Date.now()-4*3600000).toISOString());
  const refresh=await http("/api/auth/me",undefined,jar);assert.equal(refresh.status,200);assert.ok(refresh.headers.getSetCookie().some(cookie=>cookie.includes("__Secure-noctua.session_token=")));
  const minted=await http("/api/accounts/smoke-mailbox/mcp-tokens",{label:"Synthetic Smoke"},jar);assert.equal(minted.status,201);const token=minted.body.token;sensitive.push(token);
  const rpc={jsonrpc:"2.0",id:1,method:"tools/list",params:{}};
  assert.equal((await http("/api/mcp",rpc,undefined,{authorization:`Bearer ${token}`})).status,200);
  const revoke=await http("/api/auth/reauth",{purpose:"sessions.revoke",currentPassword:password,totpCode:totpFromUri(seed.body.totpURI)},jar);assert.equal(revoke.status,200);
  assert.equal((await http("/api/auth/security/sessions/revoke",{all:true},jar,{"x-noctua-reauth":revoke.body.grant})).status,200);
  assert.equal((await http("/api/mcp",rpc,undefined,{authorization:`Bearer ${token}`})).status,401);
  const ban=await http("/api/admin/users/smoke-user",{disabled:true},jar,{},"PATCH");assert.equal(ban.status,200);
  assert.equal(db.prepare(`SELECT banned FROM auth_user WHERE id='smoke-user'`).get().banned,1);
  assert.equal((await http("/api/ba/sign-in/email",{email:"person@example.test",password})).status,401);
  console.log("PASS cookie refresh, live MCP, session revoke invalidates MCP, admin ban enforced");
  await stop();closeAllDbConnections();
  const link=await command(["scripts/recoverTeamAuth.ts","--application-stopped","--confirm-personal-handover","--user-id","smoke-admin"]);sensitive.push(link);
  assert.equal(new URL(link).origin,origin);
  await start();
  const redir=await http(new URL(link).pathname+new URL(link).search);assert.equal(redir.status,302);assert.equal(redir.headers.get("referrer-policy"),"no-referrer");
  const resetToken=new URL(redir.headers.get("location")!,origin).searchParams.get("token");assert.ok(resetToken);sensitive.push(resetToken);
  const reset=await http("/api/ba/reset-password",{token:resetToken,newPassword});assert.equal(reset.status,200);assert.equal(reset.headers.getSetCookie().length,0);
  assert.equal((await http("/api/ba/reset-password",{token:resetToken,newPassword})).status,400);
  assert.equal((await http("/api/auth/me",undefined,jar)).status,401);
  const fresh=new Jar();
  const challenge=await http("/api/ba/sign-in/email",{email:"admin@example.test",password:newPassword},fresh);assert.equal(challenge.status,200);assert.equal(challenge.body.twoFactorRedirect,true);
  assert.equal((await http("/api/auth/me",undefined,fresh)).status,401);
  assert.equal((await http("/api/ba/two-factor/verify-totp",{code:totpFromUri(seed.body.totpURI)},fresh)).status,200);
  assert.equal((await http("/api/auth/me",undefined,fresh)).body.mailboxState,"selected");
  console.log("PASS operator handover, mounted reset redirect/redemption/reuse, no auto-session, MFA preserved");
  await stop();
  assert.deepEqual(JSON.parse(await probe("schema")),{createdTables:[],addedColumns:[],addedIndexes:[]});
  db=await getDb();
  const factor=db.prepare(`SELECT * FROM auth_two_factor WHERE userId='smoke-admin'`).get();
  const identity=db.prepare(`SELECT id,name,createdAt FROM auth_user WHERE id='smoke-admin'`).get();
  const encrypted=db.prepare(`SELECT imapPassword FROM accounts WHERE id='smoke-mailbox'`).get().imapPassword;
  closeAllDbConnections();
  const backup=path.join(scratch,"backup"),restored=path.join(scratch,"restored");
  cpSync(data,backup,{recursive:true});
  writeFileSync(path.join(scratch,"keys.json"),JSON.stringify({auth:process.env.BETTER_AUTH_SECRET,imap:process.env.IMAP_SECRET_KEY}),{mode:0o600});
  cpSync(backup,restored,{recursive:true});
  const keys=JSON.parse(readFileSync(path.join(scratch,"keys.json"),"utf8"));
  Object.assign(process.env,{NOCTUA_DATA_DIR:restored,BETTER_AUTH_SECRET:keys.auth,IMAP_SECRET_KEY:keys.imap});
  db=await getDb();
  // Stored shard paths are absolute: relocate them with the stopped-process restore.
  db.prepare(`UPDATE accounts SET dbPath=? WHERE id='smoke-mailbox'`).run(path.join(restored,"db","accounts","smoke-mailbox.db"));
  assert.deepEqual(db.prepare(`SELECT * FROM auth_two_factor WHERE userId='smoke-admin'`).get(),factor);
  assert.deepEqual(db.prepare(`SELECT id,name,createdAt FROM auth_user WHERE id='smoke-admin'`).get(),identity);
  assert.equal(decodeSecret(encrypted),"synthetic-mailbox-secret");
  assert.equal((await getAccountDb("smoke-mailbox")).prepare(`SELECT id FROM synthetic_restore_marker`).get().id,"stable-shard-id");
  closeAllDbConnections();
  await start();
  // Existing MFA-assured signed cookie and its stable sidecar survive the consistent snapshot.
  assert.equal((await http("/api/auth/me",undefined,fresh)).body.mailboxState,"selected");
  const restoredJar=new Jar();
  const restoredChallenge=await http("/api/ba/sign-in/email",{email:"admin@example.test",password:newPassword},restoredJar);
  assert.equal(restoredChallenge.body.twoFactorRedirect,true);
  assert.equal((await http("/api/ba/two-factor/verify-totp",{code:totpFromUri(seed.body.totpURI)},restoredJar)).status,200);
  assert.equal((await http("/api/auth/me",undefined,restoredJar)).body.mailboxState,"selected");
  console.log("PASS second startup/schema empty; isolated master/auth/shard/key restore preserves IDs, factor bytes, decryptable mailbox secret and signed MFA session");
  await stop();
  for(const secret of sensitive) if(secret)assert.ok(!serverLog.includes(secret),"server logs exposed synthetic capability");
  assert.ok(!serverLog.includes("Admin invite code:"));
  console.log("PASS startup/request logs contain no known synthetic password, hash, TOTP seed, backup code, session/challenge cookie, MCP token or recovery capability");
  console.log("SMOKE PASS: compiled Next 16.2.4, Better Auth/passkey 1.7.12, Bun "+process.versions.bun+", port "+port+", synthetic isolated storage only");
} finally { await stop();closeAllDbConnections();rmSync(scratch,{recursive:true,force:true}); }
