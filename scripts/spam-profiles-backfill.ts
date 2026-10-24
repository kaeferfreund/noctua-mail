/**
 * One-time sender profile backfill for trusted senders (doc/SPAM-DETECTION.md).
 *
 *   bun scripts/spam-profiles-backfill.ts --data /path/to/noctua-data [--account <accountId>] [--out profiles.json]
 *   bun scripts/spam-profiles-backfill.ts --data /path/to/noctua-data --write [--account <accountId>]
 *
 * Builds every account's profiles from its stored rows in one pass per shard
 * (only the first 64 KB of each source: header block and attachment names) and
 * imports the stored "Als Spam" decisions. The default is a dry run: the data
 * dir is opened read-only (mode=ro) and the plan is printed; --out writes
 * the sender histories as JSON for `spam-eval --trust-profiles <file>` (it
 * names senders: keep it outside the data dir and the repository).
 * --write reads over the app's DB layer and replaces each account's
 * `spam_sender_profiles` rows in one transaction (stored "Als Spam" times
 * survive). It needs an explicit --data (the NOCTUA_DATA_DIR Bun loads from
 * .env.local is never used) and refuses shards without the spam schema instead
 * of migrating them outside the deploy runbook.
 */
import { openSpamDataDir } from "../lib/mail/spam/evalData";
import { PROFILE_BACKFILL_USAGE, parseProfileBackfillArgs } from "../lib/mail/spam/profileBackfillArgs";
import { accountSenders, buildProfileFile, householdProfiles, writeProfileFile } from "../lib/mail/spam/profileFile";
import { assertShardsInsideDataDir } from "../lib/mail/spam/evalData";

const args = parseProfileBackfillArgs(process.argv.slice(2));
if (args.kind === "help") {
  console.log(PROFILE_BACKFILL_USAGE);
  process.exit(0);
}
if (args.kind === "error") {
  console.error(`${args.message}\n\n${PROFILE_BACKFILL_USAGE}`);
  process.exit(1);
}
const { dataDir, write, out, account: accountFilter } = args;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const started = performance.now();

if (!write) {
  const data = openSpamDataDir(dataDir);
  try {
    console.log(`Dry run (read-only): ${dataDir}, ${data.accounts.length} accounts`);
    const file = await buildProfileFile(data, (accountId, account, ms) => {
      if (accountFilter && accountId !== accountFilter) return;
      console.log(`${accountId}: ${account.rows} rows (${account.withSource} source heads) → would write ${accountSenders(account).size} profiles `
        + `(${Object.keys(account.userSpam).length} with "Als Spam"), ${seconds(ms)}`);
    });
    const household = householdProfiles(file, data.own.ownAddresses, "built");
    console.log(`Household: ${household.senders} senders, ${household.trusted} trusted now, ${household.rows} rows, ${seconds(performance.now() - started)}`);
    if (out) {
      writeProfileFile(out, file);
      console.log(`Wrote ${out}`);
    }
    console.log("Nothing written to the data dir. Add --write to replace the stored profiles.");
  } finally { data.close(); }
} else {
  // Read-only inspection first: the shards must already carry the spam schema.
  const inspect = openSpamDataDir(dataDir);
  const targets = inspect.accounts.filter((candidate) => !accountFilter || candidate.id === accountFilter);
  const missingSchema = targets.filter((candidate) => !inspect.shard(candidate.id).db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'spam_sender_profiles'").get()).map((candidate) => candidate.id);
  inspect.close();
  console.log(`Writing sender profiles into ${dataDir}: ${targets.length} accounts${accountFilter ? ` (only ${accountFilter})` : ""}`);
  if (!targets.length) throw new Error(accountFilter ? `Account ${accountFilter} not found in ${dataDir}` : `No accounts in ${dataDir}`);
  if (missingSchema.length) {
    throw new Error(`Shards without the spam schema (start the deployed app first, deploy runbook): ${missingSchema.join(", ")}`);
  }
  assertShardsInsideDataDir(targets, dataDir);
  // The app's DB layer reads NOCTUA_DATA_DIR; the explicit --data wins over .env.local.
  process.env.NOCTUA_DATA_DIR = dataDir;
  const { backfillSenderProfiles, getAccounts, getFolders } = await import("../lib/db");
  const { buildOwnIdentitySets } = await import("../lib/mail/spam/allowlist");
  const { buildAccountSenderProfiles } = await import("../lib/mail/spam/profileBuild");
  const { getSourcesDir } = await import("../lib/runtimePaths");
  const accounts = await getAccounts();
  const own = buildOwnIdentitySets(accounts.flatMap((account) => [account.email, ...(account.ownAddresses ?? [])]));
  for (const account of accounts.filter((candidate) => targets.some((target) => target.id === candidate.id))) {
    const accountStarted = performance.now();
    const folders = await getFolders(account.id);
    let rows = 0;
    const written = await backfillSenderProfiles(account.id, async (db) => {
      const built = await buildAccountSenderProfiles({ accountId: account.id, db, folders, ownAddresses: own.ownAddresses, sourcesDir: getSourcesDir() });
      rows = built.rows;
      return built.profiles.values();
    });
    console.log(`${account.id}: ${rows} rows, ${written} profiles written, ${seconds(performance.now() - accountStarted)}`);
  }
  console.log(`Done in ${seconds(performance.now() - started)}`);
}
