/** Run offline after backup; never echo manifest contents, addresses, hashes or adapter errors. */
import { readFile } from "node:fs/promises";
import { getAuth } from "../lib/betterAuth";
import { getAuthDb, closeAllDbConnections } from "../lib/db/connection";
import { migrateTeamAuth } from "../lib/teamAuthMigration";

function assertOperatorPreconditions() {
  // fix round 5 wires the shared operator lock (lib operator-lock module) here
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--application-stopped" || args[1] !== "--confirm-reviewed-identities" || args[2] !== "--manifest" || !args[3]) {
    throw new Error("operator_preconditions_required");
  }
  return args[3];
}

try {
  const manifestPath = assertOperatorPreconditions();
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const auth = await getAuth();
  process.stdout.write(`${JSON.stringify(await migrateTeamAuth(auth, await getAuthDb(), manifest))}\n`);
} catch {
  process.stderr.write("Migration refused or rolled back. With the app stopped, confirm reviewed personal identities, duplicate/shared addresses, chosen-password provenance and backup.\n");
  process.stderr.write("Usage: bun --env-file=.env.local scripts/migrateTeamAuth.ts --application-stopped --confirm-reviewed-identities --manifest <reviewed.json>\n");
  process.exitCode = 1;
} finally { closeAllDbConnections(); }
