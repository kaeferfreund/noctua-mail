/** Run offline after backup; never echo manifest contents, addresses, hashes or adapter errors. */
import { readFile } from "node:fs/promises";
import { getAuth } from "../lib/betterAuth";
import { getDb, getAuthDb, closeAllDbConnections } from "../lib/db/connection";
import { acquireAuthLifetimeLock, AuthLifetimeLockError, type AuthLifetimeLock } from "../lib/authLifetimeLock";
import { recordAdminAuditRow } from "../lib/db/adminAudit";
import { migrateTeamAuth } from "../lib/teamAuthMigration";

function readOperatorArgs() {
  const args = process.argv.slice(2);
  const overrideStale = args.at(-1) === "--override-stale-lock";
  if (overrideStale) args.pop();
  if (args.length !== 4 || args[0] !== "--application-stopped" || args[1] !== "--confirm-reviewed-identities" || args[2] !== "--manifest" || !args[3]) {
    throw new Error("operator_preconditions_required");
  }
  return { manifestPath: args[3], overrideStale };
}

let lock: AuthLifetimeLock | undefined;
try {
  const { manifestPath, overrideStale } = readOperatorArgs();
  lock = await acquireAuthLifetimeLock("operator", { overrideStale });
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const db = await getDb();
  if (lock.overridden) recordAdminAuditRow(db, { actorUserId: "operator", action: "operator.lock_override", payload: { reason: "ambiguous_stale_metadata" } });
  const auth = await getAuth({ operatorLock: lock });
  process.stdout.write(`${JSON.stringify(await migrateTeamAuth(auth, await getAuthDb(), manifest))}\n`);
} catch (error) {
  process.stderr.write(`Migration refused or rolled back: ${error instanceof AuthLifetimeLockError ? error.message : "with the app stopped, confirm reviewed personal identities, duplicate/shared addresses, chosen-password provenance and backup."}\n`);
  process.stderr.write("Usage: bun --env-file=.env.local scripts/migrateTeamAuth.ts --application-stopped --confirm-reviewed-identities --manifest <reviewed.json> [--override-stale-lock]\n");
  process.exitCode = 1;
} finally {
  try { closeAllDbConnections(); } finally { lock?.release(); }
}
