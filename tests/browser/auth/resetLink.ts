/** Local synthetic reset fixture, never imported by the app or mounted on HTTP. */
import { getAuth } from "../../../lib/betterAuth";

if (!process.env.AUTH_BROWSER_DATA_DIR || process.env.NOCTUA_DATA_DIR !== process.env.AUTH_BROWSER_DATA_DIR) throw new Error("Isolated harness storage required");
const userId = process.argv[2];
if (!userId) throw new Error("Synthetic user required");
const auth = await getAuth();
const token = crypto.randomUUID();
await (await auth.$context).internalAdapter.createVerificationValue({
  identifier: `reset-password:${token}`, value: userId, expiresAt: new Date(Date.now() + 900000)
});
// Stdout is captured privately by the fixture, never inherited by the reporter.
process.stdout.write(JSON.stringify({ token }));
