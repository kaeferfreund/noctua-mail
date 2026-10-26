/**
 * One-time sender-key backfill for rows synced before the sync stored
 * `messages.senderKey` and `messages.sourceSha256` (doc/HTML-MAIL-PRIVACY.md).
 *
 *   bun scripts/backfill-sender-keys.ts --data /path/to/noctua-data [--account <accountId>] [--out report.json]
 *   bun scripts/backfill-sender-keys.ts --data /path/to/noctua-data --write [--batch 500] [--limit <n>]
 *   bun scripts/backfill-sender-keys.ts --data /path/to/noctua-data --resync [--write] [--account <accountId>] [--out report.json]
 *
 * The default is a dry run over read-only connections: per account it prints
 * the rows without a key, how many have a retained source and how many pass
 * the legacy ownership check (lib/db/messages/senderKey.ts). --write stamps
 * both columns on accepted rows in one immediate transaction per batch with
 * the app's shard configuration and write retries, so the app can keep
 * running. Only rows where both columns are NULL are touched (idempotent,
 * resumable). No IMAP and no secrets are needed. It needs an explicit --data
 * (the NOCTUA_DATA_DIR Bun loads from .env.local is never used) and refuses
 * shards older than the app's format instead of migrating them.
 *
 * --resync fetches the rows that are still legacy afterwards from IMAP and
 * re-ingests them like the reader's "resync message" action
 * (lib/mail/senderKeyResync.ts). It needs the service's IMAP_SECRET_KEY and
 * reports UIDs that are gone instead of writing them.
 */
import { writeFileSync } from "node:fs";
import { parseSenderKeyBackfillArgs, SENDER_KEY_BACKFILL_USAGE } from "../lib/db/messages/senderKeyBackfill";

const args = parseSenderKeyBackfillArgs(process.argv.slice(2));
if (args.kind === "help") {
  console.log(SENDER_KEY_BACKFILL_USAGE);
  process.exit(0);
}
if (args.kind === "error") {
  console.error(`${args.message}\n\n${SENDER_KEY_BACKFILL_USAGE}`);
  process.exit(1);
}
// The app's runtime paths read NOCTUA_DATA_DIR; the explicit --data wins over .env.local.
process.env.NOCTUA_DATA_DIR = args.dataDir;

if (args.resync) {
  const { describeSenderKeyResyncAccount, runSenderKeyResync } = await import("../lib/mail/senderKeyResync");
  console.log(`${args.write ? "Resyncing legacy rows from IMAP into" : "Dry run (read-only, IMAP check only):"} ${args.dataDir}`
    + `${args.account ? ` (only ${args.account})` : ""}${args.limit ? `, limit ${args.limit} rows` : ""}`);
  const result = await runSenderKeyResync({ dataDir: args.dataDir, account: args.account, write: args.write, batch: args.batch,
    limit: args.limit, log: line => console.log(line) });
  for (const account of result.accounts) console.log(describeSenderKeyResyncAccount(account, args.write));
  const total = (key: "legacy" | "examined" | "present" | "resynced" | "stampedSenderKey" | "gone" | "uidMismatch") =>
    result.accounts.reduce((sum, account) => sum + account[key], 0);
  console.log(`Summary: ${total("legacy")} legacy rows, ${total("examined")} examined, ${total("present")} on IMAP`
    + `${args.write ? `, ${total("resynced")} resynced (${total("stampedSenderKey")} with sender key)` : " would be resynced"}, `
    + `${total("gone")} gone, ${total("uidMismatch")} UID mismatches, ${result.reportedRows.length} rows reported, `
    + `${(result.ms / 1000).toFixed(1)} s`);
  if (args.out) {
    const accounts = result.accounts.map(({ email: _email, ...account }) => account);
    writeFileSync(args.out, `${JSON.stringify({ ...result, accounts, generatedAt: new Date().toISOString() }, null, 2)}\n`);
    console.log(`Wrote ${args.out}`);
  }
  if (!args.write) console.log("Nothing written to the data dir. Add --write to resync the rows found on IMAP.");
  // The app's DB layer keeps its connections open.
  const { closeAllDbConnections } = await import("../lib/db/connection");
  closeAllDbConnections();
  process.exit(0);
}

const { describeSenderKeyBackfillAccount, runSenderKeyBackfill } = await import("../lib/db/messages/senderKeyBackfill");

console.log(`${args.write ? "Writing sender keys into" : "Dry run (read-only):"} ${args.dataDir}${args.account ? ` (only ${args.account})` : ""}`
  + `${args.limit ? `, limit ${args.limit} rows` : ""}`);
const result = await runSenderKeyBackfill({ dataDir: args.dataDir, account: args.account, write: args.write, batch: args.batch,
  limit: args.limit, log: line => console.log(line) });
for (const account of result.accounts) console.log(describeSenderKeyBackfillAccount(account, args.write));
const total = (key: "legacy" | "examined" | "accepted" | "stamped") => result.accounts.reduce((sum, account) => sum + account[key], 0);
console.log(`Summary: ${total("legacy")} legacy rows, ${total("examined")} examined, ${total("accepted")} `
  + `${args.write ? `accepted, ${total("stamped")} stamped` : "would be stamped"}, ${result.skippedRows.length} skipped by the ownership check, `
  + `${(result.ms / 1000).toFixed(1)} s`);
if (args.out) {
  // Ids and counts only: account addresses stay out of the report file.
  const accounts = result.accounts.map(({ email: _email, ...account }) => account);
  writeFileSync(args.out, `${JSON.stringify({ ...result, accounts, generatedAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(`Wrote ${args.out}`);
}
if (!args.write) console.log("Nothing written to the data dir. Add --write to stamp the accepted rows.");
