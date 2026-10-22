import {afterEach,expect,test} from "bun:test";
import {mkdirSync,mkdtempSync,readFileSync,rmSync,symlinkSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {tmpdir} from "node:os";
import path from "node:path";
import {acquireAuthLifetimeLock} from "./authLifetimeLock";

const dirs:string[]=[];
afterEach(()=>{for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
function dataDir(){const dir=mkdtempSync(path.join(tmpdir(),"auth-lock-test-"));dirs.push(dir);return dir;}
function child(data:string,code:string) {
  return spawnSync(process.execPath,["--no-env-file","-e",code],{cwd:process.cwd(),env:{NODE_ENV:"test",PATH:process.env.PATH!,TMPDIR:process.env.TMPDIR!,NOCTUA_DATA_DIR:data,BETTER_AUTH_URL:"http://localhost:3785",BETTER_AUTH_SECRET:"synthetic-lock-secret-0123456789abcdef",IMAP_CREDENTIALS_STORAGE:"db",BETTER_AUTH_TELEMETRY:"0"},encoding:"utf8",timeout:10000});
}
async function lockFor(data:string,mode:"application"|"operator",overrideStale=false) {
  const previous=process.env.NOCTUA_DATA_DIR;
  try{process.env.NOCTUA_DATA_DIR=data;return await acquireAuthLifetimeLock(mode,{overrideStale});}
  finally{if(previous===undefined)delete process.env.NOCTUA_DATA_DIR;else process.env.NOCTUA_DATA_DIR=previous;}
}

test("application auth initialization refuses operator lifetime lock before touching the DB",async()=>{
  const data=dataDir(),lock=await lockFor(data,"operator");
  try {
    const result=child(data,`import {getAuth} from './lib/betterAuth';try{await getAuth();process.exitCode=2;}catch(error){console.error(error.message);process.exitCode=1;}`);
    expect(result.status).toBe(1);expect(result.stderr).toContain("lifetime lock is held");
    expect(()=>readFileSync(path.join(data,"db/main.db"))).toThrow();
  }finally{lock.release();}
});

for(const exit of ["normal","crash"] as const)test(`lifetime lock releases on ${exit} exit; stale PID/start timestamp cannot block restart`,async()=>{
  const data=dataDir();
  const result=child(data,`import {acquireAuthLifetimeLock} from './lib/authLifetimeLock';await acquireAuthLifetimeLock('application');${exit==="normal"?"":"process.kill(process.pid,'SIGKILL');"}`);
  if(exit==="normal")expect(result.status,result.stderr).toBe(0);else expect(result.signal).toBe("SIGKILL");
  const lock=await lockFor(data,"application");expect(lock.overridden).toBe(false);lock.release();
  expect(readFileSync(lock.path,"utf8")).toBe("");
});

test("ambiguous stale metadata needs explicit operator override; override never bypasses live OS lock",async()=>{
  const data=dataDir(),first=await lockFor(data,"application");first.release();
  writeFileSync(first.path,"synthetic-incomplete-owner");
  await expect(lockFor(data,"application")).rejects.toThrow("--override-stale-lock");
  await expect(lockFor(data,"operator")).rejects.toThrow("--override-stale-lock");
  const operator=await lockFor(data,"operator",true);
  try {
    expect(operator.overridden).toBe(true);
    const result=child(data,`import {acquireAuthLifetimeLock} from './lib/authLifetimeLock';try{await acquireAuthLifetimeLock('operator',{overrideStale:true});process.exitCode=2;}catch(error){console.error(error.message);process.exitCode=1;}`);
    expect(result.status).toBe(1);expect(result.stderr).toContain("lifetime lock is held");
  }finally{operator.release();}
});


test("database symlink aliases share one lifetime lock",async()=>{
  const data=dataDir(),alias=dataDir(),first=await lockFor(data,"application");first.release();
  writeFileSync(path.join(data,"db/main.db"),"");mkdirSync(path.join(alias,"db"));
  symlinkSync(path.join(data,"db/main.db"),path.join(alias,"db/main.db"));
  const operator=await lockFor(data,"operator");
  try {
    const result=child(alias,`import {getAuth} from './lib/betterAuth';try{await getAuth();process.exitCode=2;}catch(error){console.error(error.message);process.exitCode=1;}`);
    expect(result.status).toBe(1);expect(result.stderr).toContain("lifetime lock is held");
  }finally{operator.release();}
});
