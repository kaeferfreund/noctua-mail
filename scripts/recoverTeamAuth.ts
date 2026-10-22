/** Local operator authority requires filesystem + encryption/auth keys. Stop the app first. */
import { getAuth } from "../lib/betterAuth";
import { getDb,closeAllDbConnections } from "../lib/db/connection";
import { issueRecovery,reconcileLifecycle } from "../lib/userLifecycle";
import { reconcileProvisioning } from "../lib/db/userProvisioning";
import { reconcileSecurityOperations } from "../lib/db/authPolicy";

const args=process.argv.slice(2),userIndex=args.indexOf("--user-id");
if (!args.includes("--application-stopped") || !args.includes("--confirm-personal-handover") || userIndex<0 || !args[userIndex+1] || args.some((value,index)=>!["--application-stopped","--confirm-personal-handover","--user-id"].includes(value)&&index!==userIndex+1)) {
  process.stderr.write("Usage: bun --env-file=.env.local scripts/recoverTeamAuth.ts --application-stopped --confirm-personal-handover --user-id <id>\n");
  process.exitCode=1;
} else {
  try {
    const auth=await getAuth(),db=await getDb();
    await reconcileProvisioning(db,Date.now());
    await reconcileLifecycle(auth,db,Date.now());
    await reconcileSecurityOperations(db,Date.now());
    const result=await issueRecovery(auth,db,"operator",null,args[userIndex+1],{confirmedTarget:true});
    process.stdout.write(`${result.url}\n`);
  } catch {process.stderr.write("Recovery failed; inspect the secret-free lifecycle journal with the application stopped.\n");process.exitCode=1;}
  finally {closeAllDbConnections();}
}
