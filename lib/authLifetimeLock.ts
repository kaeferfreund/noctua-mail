/** Linux/server datastore lifetime exclusion. Never unlink the file: flock locks its inode. */
import { closeSync, ftruncateSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, writeSync } from "node:fs";
import path from "node:path";
import { getMainDbPath } from "./runtimePaths";

export class AuthLifetimeLockError extends Error {
  readonly code="auth_lifetime_lock";
}

type Owner = {pid:number;startedAt:string;acquiredAt:number;mode:"application"|"operator"};
export type AuthLifetimeLock = {path:string;mode:Owner["mode"];overridden:boolean;release:()=>void};
type HeldLock = AuthLifetimeLock;
const registryKey=Symbol.for("noctua.authLifetimeLocks");
const shared=globalThis as typeof globalThis & {[registryKey]?:Map<string,HeldLock>};
const locks=shared[registryKey]??=new Map<string,HeldLock>();

function processStamp(pid:number) {
  // /proc start ticks plus boot ID distinguish PID reuse and previous boots.
  const stat=readFileSync(`/proc/${pid}/stat`,"utf8");
  return `${readFileSync("/proc/sys/kernel/random/boot_id","utf8").trim()}:${stat.slice(stat.lastIndexOf(")")+2).split(" ")[19]}`;
}
function lockPath() {
  const database=getMainDbPath();mkdirSync(path.dirname(database),{recursive:true});
  let canonical:string;
  try {canonical=realpathSync(database);}
  catch(error) {
    if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;
    canonical=path.join(realpathSync(path.dirname(database)),path.basename(database));
  }
  return `${canonical}.auth.lock`;
}
export async function acquireAuthLifetimeLock(mode:Owner["mode"],options:{overrideStale?:boolean}={}) {
  const file=lockPath();
  if (locks.has(file)) throw new AuthLifetimeLockError("Auth datastore is already held in this process; stop the service before recovery.");
  const {dlopen,FFIType}=await import("bun:ffi" /* webpackIgnore: true */);
  const libc=dlopen("libc.so.6",{flock:{args:[FFIType.i32,FFIType.i32],returns:FFIType.i32}});
  let fd:number;
  try {fd=openSync(file,"a+",0o600);} catch(error) {libc.close();throw error;}
  if (libc.symbols.flock(fd,2|4)!==0) {closeSync(fd);libc.close();throw new AuthLifetimeLockError("Auth datastore lifetime lock is held by an application or operator; stop the service before recovery.");}
  try {
    const previous=readFileSync(fd,"utf8").trim();let overridden=false;
    if (previous) {
      let stale=false;
      try {
        const owner=JSON.parse(previous) as Owner;
        if (Number.isSafeInteger(owner.pid) && owner.pid>0 && Number.isFinite(owner.acquiredAt) && owner.acquiredAt<=Date.now() && typeof owner.startedAt==="string") {
          try { stale=processStamp(owner.pid)!==owner.startedAt; }
          catch(error) {stale=(error as NodeJS.ErrnoException).code==="ENOENT";}
        }
      } catch { /* Invalid owner metadata needs deliberate operator override. */ }
      if (!stale) {
        if (mode!=="operator" || !options.overrideStale) throw new AuthLifetimeLockError("Ambiguous stale auth lock metadata; verify the service is stopped and use --override-stale-lock (audited).");
        overridden=true;
      }
    }
    const owner:Owner={pid:process.pid,startedAt:processStamp(process.pid),acquiredAt:Date.now(),mode};
    ftruncateSync(fd,0);writeSync(fd,JSON.stringify(owner),0,"utf8");fsyncSync(fd);
    let released=false;
    const lock:HeldLock={path:file,mode,overridden,release:()=>{
      if(released)return;released=true;
      try {ftruncateSync(fd,0);fsyncSync(fd);} finally {closeSync(fd);libc.close();locks.delete(file);process.removeListener("exit",lock.release);}
    }};
    locks.set(file,lock);process.once("exit",lock.release);return lock;
  } catch(error) {closeSync(fd);libc.close();throw error;}
}

/** Module graphs share one process-owned lock, while operators must pass their exact handle. */
export async function ensureAuthLifetimeLock(operatorLock?:AuthLifetimeLock) {
  const held=locks.get(lockPath());
  if (held) {
    if (held.mode==="application" && !operatorLock || held===operatorLock && held.mode==="operator") return held;
    throw new AuthLifetimeLockError("Auth initialization refused while the operator lifetime lock is held.");
  }
  if (operatorLock) throw new AuthLifetimeLockError("Operator lifetime lock is no longer held.");
  return acquireAuthLifetimeLock("application");
}
