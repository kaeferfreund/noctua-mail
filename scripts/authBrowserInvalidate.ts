/** Local harness control. Never mounted on HTTP. Only isolated synthetic storage is supplied by the runner. */
import {getDb} from "../lib/db/connection";
import {advanceSecurityGeneration} from "../lib/db/authPolicy";
const [mode,userId]=process.argv.slice(2);
const base=`http://localhost:${Number(process.env.AUTH_BROWSER_PORT??3784)}`;
if(!process.env.AUTH_BROWSER_DATA_DIR||process.env.NOCTUA_DATA_DIR!==process.env.AUTH_BROWSER_DATA_DIR||process.env.BETTER_AUTH_URL!==base)throw new Error("Isolated harness storage required");
const db=await getDb();
if(mode==="reset") {
  // Seed only a synthetic capability, then exercise the running application's real handler.
  // A helper process must never initialize a second auth instance or reconcile the live app.
  const token=crypto.randomUUID(),now=new Date().toISOString();
  db.prepare(`INSERT INTO auth_verification(id,identifier,value,expiresAt,createdAt,updatedAt) VALUES(?,?,?,?,?,?)`)
    .run(crypto.randomUUID(),`reset-password:${token}`,userId,new Date(Date.now()+60000).toISOString(),now,now);
  const response=await fetch(`${base}/api/ba/reset-password`,{method:"POST",headers:{origin:base,"content-type":"application/json"},
    body:JSON.stringify({token,newPassword:"synthetic-browser-password"}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error("Synthetic browser reset failed");
} else if(mode==="revoke") {
  // Fault injection intentionally abandons only this fixture user's failed ceremony.
  // No startup reconciliation and no other user's live operation is touched.
  db.transaction(()=>{
    advanceSecurityGeneration(db,userId);
    db.prepare(`UPDATE admin_lifecycle_operations SET slot=NULL,state='cancelled',updatedAt=? WHERE slot=? AND action LIKE 'security.%'`).run(Date.now(),`security:${userId}`);
  }).immediate();
} else throw new Error("Unknown control");
