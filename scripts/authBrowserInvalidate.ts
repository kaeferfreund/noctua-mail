/** Local harness control. Never mounted on HTTP. Only isolated synthetic storage is supplied by the runner. */
import {getAuth} from "../lib/betterAuth";
import {getDb} from "../lib/db/connection";
import {advanceSecurityGeneration,reserveSecurityOperation,finishSecurityOperation} from "../lib/db/authPolicy";
const [mode,userId]=process.argv.slice(2);
if(!process.env.AUTH_BROWSER_DATA_DIR||process.env.NOCTUA_DATA_DIR!==process.env.AUTH_BROWSER_DATA_DIR)throw new Error("Isolated harness storage required");
const auth=await getAuth();
const db=await getDb();
if(mode==="reset") {
  const token=crypto.randomUUID();
  await (await auth.$context).internalAdapter.createVerificationValue({identifier:`reset-password:${token}`,value:userId,expiresAt:new Date(Date.now()+60000)});
  await auth.api.resetPassword({body:{token,newPassword:"synthetic-browser-password"}});
} else if(mode==="revoke") {
  const op=await reserveSecurityOperation(db,userId,"security.revoke");
  db.transaction(()=>advanceSecurityGeneration(db,userId)).immediate();
  await finishSecurityOperation(db,op);
} else throw new Error("Unknown control");
