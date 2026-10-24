/**
 * One-time sender profile backfill for trusted senders (doc/SPAM-DETECTION.md).
 *
 *   bun scripts/spam-profiles-backfill.ts --data /path/to/noctua-data --dry-run [--out profiles.json]
 *   bun scripts/spam-profiles-backfill.ts [--data /path/to/noctua-data] [--account <accountId>]
 *
 * Builds every account's profiles from its stored rows in one pass per shard
 * (only the first 64 KB of each source: header block and attachment names).
 * --dry-run opens the data dir read-only (immutable=1) and prints counts and
 * timings; --out writes the profiles as JSON for `spam-eval --trust-profiles <file>`
 * (it names senders: keep it outside the data dir and the repository).
 * The real run reads over the app's DB layer and replaces each account's
 * `spam_sender_profiles` rows in one transaction (stored "Als Spam" times
 * survive). Run it from the app directory after the deploy of this build.
 */
import path from "node:path";
import { openSpamDataDir } from "../lib/mail/spam/evalData";
import { buildProfileFile, householdProfiles, writeProfileFile } from "../lib/mail/spam/profileFile";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

const dryRun = process.argv.includes("--dry-run");
if (arg("data")) process.env.NOCTUA_DATA_DIR = path.resolve(arg("data")!);
const dataDir = process.env.NOCTUA_DATA_DIR?.trim();
if (!dataDir) throw new Error("Pass --data <data dir> or set NOCTUA_DATA_DIR");
const outPath = arg("out") ? path.resolve(arg("out")!) : undefined;
if (outPath && !dryRun) throw new Error("--out is only available with --dry-run");
if (outPath && !path.relative(dataDir, outPath).startsWith("..")) throw new Error("--out must not point into the data dir");
const accountFilter = arg("account") ?? null;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const started = performance.now();

if (dryRun) {
  const data = openSpamDataDir(dataDir);
  try {
    const file = await buildProfileFile(data, (accountId, account, ms) => {
      if (accountFilter && accountId !== accountFilter) return;
      console.log(`${accountId}: ${account.rows} rows (${account.withSource} source heads), ${account.profiles.length} senders, ${seconds(ms)}`);
    });
    const household = householdProfiles(file, data.own.ownAddresses, "built");
    console.log(`Household: ${household.senders} senders, ${household.trusted} trusted, ${household.rows} rows, ${seconds(performance.now() - started)} (read-only)`);
    if (outPath) {
      writeProfileFile(outPath, file);
      console.log(`Wrote ${outPath}`);
    }
  } finally { data.close(); }
} else {
  const { backfillSenderProfiles, getAccounts, getFolders } = await import("../lib/db");
  const { buildOwnIdentitySets } = await import("../lib/mail/spam/allowlist");
  const { buildAccountSenderProfiles } = await import("../lib/mail/spam/profileBuild");
  const { getSourcesDir } = await import("../lib/runtimePaths");
  const accounts = await getAccounts();
  const own = buildOwnIdentitySets(accounts.flatMap((account) => [account.email, ...(account.ownAddresses ?? [])]));
  for (const account of accounts.filter((candidate) => !accountFilter || candidate.id === accountFilter)) {
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
