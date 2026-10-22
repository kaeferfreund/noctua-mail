import {mkdtempSync,rmSync} from "node:fs";
import {createServer} from "node:net";
import path from "node:path";
import {setTimeout as delay} from "node:timers/promises";
import {tmpdir} from "node:os";
import {spawn,type ChildProcess} from "node:child_process";

const root=process.cwd();
const scratch=mkdtempSync(path.join(tmpdir(),"noctua-auth-browser-"));
const env={...process.env,NOCTUA_DATA_DIR:path.join(scratch,"data"),BETTER_AUTH_SECRET:"synthetic-browser-secret-0123456789abcdef",
  IMAP_SECRET_KEY:Buffer.alloc(32,7).toString("base64"),IMAP_CREDENTIALS_STORAGE:"db",BETTER_AUTH_URL:"http://localhost:3784",
  PASSKEY_RP_ID:"localhost",NOCTUA_TRUSTED_ORIGINS:"",BETTER_AUTH_TELEMETRY_ENDPOINT:"",BETTER_AUTH_TELEMETRY:"0",NOCTUA_IMAP_LOGIN_HOSTS:"",NOCTUA_DESKTOP_MODE:"false",
  AUTH_BROWSER_OUTPUT_DIR:path.join(scratch,"results"),AUTH_BROWSER_SEED_FILE:path.join(scratch,"seed.json"),AUTH_BROWSER_DATA_DIR:path.join(scratch,"data")};
async function run(args:string[]) {
  const child=spawn("bun",args,{cwd:root,env,stdio:"inherit"});
  const code=await new Promise<number>((resolve,reject)=>{child.on("error",reject);child.on("exit",code=>resolve(code??1));});
  if(code!==0)throw new Error(`Command failed (${code}): bun ${args.join(" ")}`);
}
async function requireFreePort() {
  await new Promise<void>((resolve,reject)=>{
    const probe=createServer();
    probe.once("error",()=>reject(new Error("Port 3784 is occupied; refusing to reuse a server")));
    probe.listen(3784,"localhost",()=>probe.close(()=>resolve()));
  });
}
let server:ChildProcess|undefined;
try {
  await requireFreePort();
  if(process.env.AUTH_BROWSER_USE_BUILD!=="1")await run(["run","build"]);
  server=spawn("bun",["scripts/authBrowserServer.ts"],{cwd:root,env,stdio:"inherit"});
  let ready=false;
  for(let attempt=0;attempt<120;attempt++) {
    if(server.exitCode!==null)throw new Error("Browser harness server exited during startup");
    try {if((await fetch("http://localhost:3784/api/ba/ok")).ok){ready=true;break;}}catch{/* wait for own server */}
    await delay(500);
  }
  if(!ready)throw new Error("Browser harness readiness timed out");
  await run(["x","playwright","test","--config=playwright.auth.config.ts"]);
} finally {
  if(server&&server.exitCode===null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise<void>(resolve=>server!.once("exit",()=>resolve())),delay(5000)]);
    if(server.exitCode===null)server.kill("SIGKILL");
  }
  rmSync(scratch,{recursive:true,force:true});
}
