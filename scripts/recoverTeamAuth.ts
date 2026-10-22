/** Local operator authority requires filesystem + encryption/auth keys. Stop the app first. */
import { getAuth } from "../lib/betterAuth";
import { getDb,closeAllDbConnections } from "../lib/db/connection";
import { issueRecovery,reconcileLifecycle } from "../lib/userLifecycle";
import { reconcileProvisioning } from "../lib/db/userProvisioning";
import { reconcileSecurityOperations } from "../lib/db/authPolicy";

const args=process.argv.slice(2),userIndex=args.indexOf("--user-id");
const bootstrap=args.length===3 && ["--application-stopped","--confirm-personal-handover","--bootstrap-invite"].every(flag=>args.includes(flag));
if (!bootstrap && (!args.includes("--application-stopped") || !args.includes("--confirm-personal-handover") || userIndex<0 || !args[userIndex+1] || args.some((value,index)=>!["--application-stopped","--confirm-personal-handover","--user-id"].includes(value)&&index!==userIndex+1))) {
  process.stderr.write("Usage: bun --env-file=.env.local scripts/recoverTeamAuth.ts --application-stopped --confirm-personal-handover (--user-id <id> | --bootstrap-invite)\n");
  process.exitCode=1;
} else {
  try {
    const auth=await getAuth(),db=await getDb();
    await reconcileProvisioning(db,Date.now());
    await reconcileLifecycle(auth,db,Date.now());
    await reconcileSecurityOperations(db,Date.now());
    if (bootstrap) {
      if (db.prepare("SELECT 1 FROM users LIMIT 1").get()) throw new Error("Bootstrap closed");
      const invite=db.prepare("SELECT code FROM invite_codes WHERE role='admin' AND email IS NULL AND (expiresAt IS NULL OR expiresAt>?) AND (maxUses IS NULL OR uses<maxUses) ORDER BY createdAt LIMIT 1").get(Date.now());
      if (!invite) throw new Error("Bootstrap unavailable");
      process.stdout.write(`${invite.code}\n`);
    } else {
      const result=await issueRecovery(auth,db,"operator",null,args[userIndex+1],{confirmedTarget:true});
      process.stdout.write(`${result.url}\n`);
    }
  } catch {process.stderr.write("Recovery failed; inspect the secret-free lifecycle journal with the application stopped.\n");process.exitCode=1;}
  finally {closeAllDbConnections();}
}
