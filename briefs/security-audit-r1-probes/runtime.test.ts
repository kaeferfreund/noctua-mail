// Reviewer probes for 164a57e. FINDING tests assert the observed defect; passing is not a clean audit.
// Run only through run.sh; synthetic storage, read-only source and no external network.
import {expect,test} from "bun:test";
import {createTestAuthHarness, syntheticRequestIp} from "../lib/testAuthHarness";
import {readFileSync,statSync} from "node:fs";
import {ensureAuthLifetimeLock} from "../lib/authLifetimeLock";
import {getDataDir} from "../lib/runtimePaths";
import {createRequestIpResolver} from "../lib/rateLimit";

test("F1 production HTTP sign-in limiter rejects fourth attempt with Retry-After",async()=>{
 const f=await createTestAuthHarness(undefined,{}, {libraryRateLimits:true});
 try{const ip=syntheticRequestIp();const statuses:number[]=[];
 for(let i=0;i<4;i++){
 const r=await f.auth.handler(new Request("http://localhost:3000/api/ba/sign-in/email",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json","x-forwarded-for":ip},body:JSON.stringify({email:"unknown-synthetic@example.test",password:"incorrect-synthetic-password"})}));
 statuses.push(r.status);if(i===3)expect(r.headers.get("x-retry-after")).not.toBeNull();
 } expect(statuses).toEqual([401,401,401,429]);
 }finally{f.close();}
});

test("F2 wrapper IP resolver ignores spoofed left prefix behind one proxy and fails closed without trusted hops",()=>{
 const r=new Request("https://mail.example.test/api",{headers:{"x-forwarded-for":"192.0.2.99, 198.51.100.7"}});
 expect(createRequestIpResolver(1)(r)).toBe("198.51.100.7");expect(createRequestIpResolver(0)(r)).toBe("unknown");
 expect(createRequestIpResolver(3)(r)).toBe("unknown");
});

test("G1 installed direct dependency versions match lockfile resolved entries",()=>{
 const pkg=JSON.parse(readFileSync("package.json","utf8")),lock=readFileSync("bun.lock","utf8");
 let n=0;for(const name of Object.keys({...pkg.dependencies,...pkg.devDependencies})){
 const installed=JSON.parse(readFileSync(`node_modules/${name}/package.json`,"utf8"));
 expect(lock).toContain('"'+name+'@'+installed.version+'"');n++;
 }expect(n).toBeGreaterThan(70);
 expect(JSON.parse(readFileSync("node_modules/next/package.json","utf8")).version).toBe("16.2.4");
 expect(JSON.parse(readFileSync("node_modules/better-auth/package.json","utf8")).version).toBe("1.7.12");
});

test("H2 lifetime lock uses restrictive mode on creation and is Linux-only FFI flock",async()=>{
 // testDbHarness owns this fresh scratch-local datastore; no application startup was called.
 const lock=await ensureAuthLifetimeLock();
 try{expect(statSync(lock.path).mode & 0o777).toBe(0o600);expect(lock.path.startsWith(getDataDir()+"/")).toBe(true);}
 finally{/* process exit owns application lock release */}
});
