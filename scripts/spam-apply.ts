/**
 * Moves INBOX messages into each account's Junk folder, so they can be
 * reviewed there (doc/SPAM-DETECTION.md). Two selections:
 *
 *   bun scripts/spam-apply.ts --in eval-result.json --data /path/to/noctua-data
 *     [--dry-run] [--label ham] [--decision spam] [--account <accountId>]
 *
 *   bun scripts/spam-apply.ts --server-flagged --data /path/to/copy --dry-run --out flagged.json [--account <accountId>] [--rules <file>]
 *   bun scripts/spam-apply.ts --server-flagged --data /path/to/noctua-data --only flagged.json [--out applied.json] [--account <accountId>]
 *
 * --in: the file written by `scripts/spam-eval.ts --out`. Defaults select
 * label=ham (INBOX at eval time) and decision=spam (marked by the classifier).
 *
 * --server-flagged: INBOX mail the receiving server flagged (`X-Spam-Flag: YES`),
 * minus every conservative exclusion of lib/mail/spam/serverFlagBackfill.ts
 * (household domains, „Kein Spam“ senders and domains, static allow rules,
 * correspondents, flagged/answered/replied mail, collaboration, rows the
 * classifier judged or is about to judge, accounts without a Junk folder).
 * The dry run needs an explicit --data that is not live (no -wal files: use an
 * online `.backup` copy), never connects to IMAP and writes every flagged mail
 * with its decision to --out (mode 600; names senders and subjects, so outside
 * the data dir and the repository). The real run needs --only <reviewed file>:
 * it moves only the items still marked "move" there that the live data still
 * selects; delete entries from the file to keep them in the INBOX. Resumable:
 * moved rows are no longer in the INBOX and are skipped on a rerun.
 *
 * Each message goes through the same code path as "Als Spam" (Junk folder
 * resolution, $NotJunk cleanup on IMAP, move + local relocation, flag cleanup)
 * and gets a spam example (server-flagged: source `server-flag-backfill`,
 * dated at the mail's arrival). Rows that no longer exist or are no longer in
 * the INBOX are skipped. Sequential, one IMAP move at a time.
 *
 * The real run uses the app's DB layer (write retries), so it can run while
 * the service is running; run it from the app directory with the service's
 * environment (IMAP_SECRET_KEY). It refuses shards without the spam schema
 * instead of migrating them outside the deploy runbook.
 */
import { Database } from "bun:sqlite";
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Folder, Message } from "../lib/data";
import { sentToAddressInDb } from "../lib/db/sentRecipients";
import { applySpamItems, parseSpamEvalRecords, selectSpamApplyItems, type SpamEvalDecision, type SpamEvalRecord } from "../lib/mail/spam/apply";
import { assertShardsInsideDataDir, openSpamDataDir } from "../lib/mail/spam/evalData";
import type { SpamExampleSource } from "../lib/mail/spam/examples";
import {
  parseReviewedServerFlagItems,
  planServerFlagApply,
  scanServerFlaggedInbox,
  SERVER_FLAG_BACKFILL_SOURCE,
  serverFlagApplyRecords,
  type ScanDb,
  type ServerFlagAccountScan,
  type ServerFlagHousehold
} from "../lib/mail/spam/serverFlagBackfill";
import { loadStaticRules } from "../lib/mail/spam/staticRules";
import { folderMailboxPath } from "../lib/mailboxPaths";
import { getDefaultAccountDbPath, getMainDbPath } from "../lib/runtimePaths";
import { findJunkFolder, findSentFolder } from "../lib/specialFolders";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

const dryRun = process.argv.includes("--dry-run");
const accountFilter = arg("account") ?? null;
const repoRoot = path.resolve(import.meta.dir, "..");

type Lookup = (item: SpamEvalRecord) => Promise<{ mailboxPath: string | null } | null>;
type Moved = { accountId: string; previousId: string; messageId: string; rfcMessageId: string | null; junkMailbox: string };

/**
 * Lookup and move over the app's DB layer, the steps of POST …/messages/:id/spam
 * ("Als Spam") without a user. NOCTUA_DATA_DIR must be set before the call.
 */
async function appMove(source: SpamExampleSource, options: { datedAtArrival?: boolean; onMoved?: (moved: Moved) => void } = {}) {
  const { getAccountById, getMessageById } = await import("../lib/serverDb");
  const { moveMessageToJunk } = await import("../app/api/_helpers/message/junkMove");
  const { recordSpamDecision } = await import("../lib/mail/spam/examples");
  const current = new Map<string, Message>();
  const lookup: Lookup = async (item) => {
    const message = await getMessageById(item.accountId, item.id);
    if (!message || message.deleted || message.id !== item.id) return null;
    current.set(`${item.accountId}\u0000${item.id}`, message);
    return { mailboxPath: message.mailboxPath ?? null };
  };
  const move = async (item: SpamEvalRecord) => {
    const message = current.get(`${item.accountId}\u0000${item.id}`)!;
    if (typeof message.imapUid !== "number" || !message.mailboxPath) throw new Error("message is missing IMAP metadata");
    const account = await getAccountById(item.accountId);
    if (!account) throw new Error("account not found");
    const moved = await moveMessageToJunk({ account, accountId: item.accountId, message: { ...message, imapUid: message.imapUid, mailboxPath: message.mailboxPath } });
    await recordSpamDecision({ accountId: item.accountId, message, label: "spam", source, userId: null,
      createdAt: options.datedAtArrival && Number.isFinite(message.dateValue) ? message.dateValue : undefined });
    options.onMoved?.({ accountId: item.accountId, previousId: moved.previousMessageId, messageId: moved.messageId,
      rfcMessageId: message.messageId ?? null, junkMailbox: moved.junkMailbox });
    return moved.junkMailbox;
  };
  return { lookup, move };
}

function hasSpamSchema(db: { prepare: (sql: string) => { get: () => unknown } }) {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'spam_examples'").get();
}

async function applyEvalFile() {
  const inPath = arg("in");
  if (!inPath || !existsSync(inPath)) throw new Error("Pass --in <file written by spam-eval --out> or --server-flagged");
  if (arg("data")) process.env.NOCTUA_DATA_DIR = path.resolve(arg("data")!);
  if (!process.env.NOCTUA_DATA_DIR?.trim()) throw new Error("Pass --data <data dir> or set NOCTUA_DATA_DIR");
  const label = arg("label") ?? "ham";
  const decision = arg("decision") ?? "spam";
  if (label !== "ham" && label !== "spam") throw new Error("--label must be ham or spam");
  if (!["spam", "ham", "unsure"].includes(decision)) throw new Error("--decision must be spam, ham or unsure");

  const records = parseSpamEvalRecords(JSON.parse(readFileSync(inPath, "utf8")));
  const items = selectSpamApplyItems(records, { label, decision: decision as SpamEvalDecision, accountId: accountFilter });
  const accountIds = [...new Set(items.map((item) => item.accountId))];

  // Read-only inspection: shard paths, Junk folders, spam schema and (dry run) current rows.
  const main = new Database(getMainDbPath(), { readonly: true });
  const accountRows = main.prepare("SELECT id, email, dbPath FROM accounts").all() as Array<{ id: string; email: string; dbPath: string | null }>;
  main.close();
  const readOnly = new Map<string, Database>();
  const junkByAccount = new Map<string, string>();
  const missingSchema: string[] = [];
  for (const accountId of accountIds) {
    const account = accountRows.find((row) => row.id === accountId);
    const file = account?.dbPath && existsSync(account.dbPath) ? account.dbPath : getDefaultAccountDbPath(accountId);
    if (!account || !existsSync(file)) continue;
    const db = new Database(file, { readonly: true });
    readOnly.set(accountId, db);
    const folders = db.prepare("SELECT * FROM folders WHERE accountId = ?").all(accountId) as Folder[];
    const junk = findJunkFolder(folders, accountId);
    junkByAccount.set(accountId, junk ? folderMailboxPath(junk, accountId) : "Junk (fallback, no Junk folder found)");
    if (!hasSpamSchema(db)) missingSchema.push(accountId);
  }

  console.log(`Spam apply${dryRun ? " (dry run, read-only)" : ""}: ${items.length} of ${records.length} items match label=${label} decision=${decision}${accountFilter ? ` account=${accountFilter}` : ""}`);
  for (const accountId of accountIds) {
    const email = accountRows.find((row) => row.id === accountId)?.email ?? "unknown account";
    console.log(`  ${accountId} (${email}): ${items.filter((item) => item.accountId === accountId).length} items → ${junkByAccount.get(accountId) ?? "shard not found"}`);
  }

  let lookup: Lookup;
  let move: (item: SpamEvalRecord) => Promise<string>;
  if (dryRun) {
    lookup = async (item) => {
      const row = readOnly.get(item.accountId)?.prepare("SELECT mailboxPath FROM messages WHERE accountId = ? AND id = ? AND COALESCE(deleted, 0) = 0")
        .get(item.accountId, item.id) as { mailboxPath: string | null } | null | undefined;
      return row ?? null;
    };
    move = async () => { throw new Error("dry run"); };
  } else {
    if (missingSchema.length) {
      throw new Error(`Spam schema (spam_examples) missing on ${missingSchema.join(", ")}: deploy and start the spam build first (doc/SPAM-DETECTION.md, Deploy)`);
    }
    for (const db of readOnly.values()) db.close();
    readOnly.clear();
    ({ lookup, move } = await appMove("mark-spam"));
  }

  const counts = await applySpamItems(items, { dryRun, lookup, move });
  for (const db of readOnly.values()) db.close();
  console.log(`Summary: ${dryRun ? `${counts["would-move"]} would move` : `${counts.moved} moved`}, ${counts["not-in-inbox"]} no longer in INBOX, ${counts.missing} not found, ${counts.error} errors`);
  return counts.error ? 1 : 0;
}

/** Output files name senders and subjects: never inside the data dir or the repository (its untracked .tmp scratch dir aside). */
function outputPath(name: string, dataDir: string) {
  const value = arg(name);
  if (!value) return null;
  const file = path.resolve(value);
  const inside = (root: string) => !path.relative(root, file).startsWith("..") && !path.isAbsolute(path.relative(root, file));
  if (inside(dataDir)) throw new Error(`--${name} must not point into the data dir`);
  if (inside(repoRoot) && !inside(path.join(repoRoot, ".tmp"))) throw new Error(`--${name} must not point into the repository`);
  return file;
}

function writePrivateJson(file: string, value: unknown) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
}

/**
 * A copied data dir is fine; a live one (non-empty -wal next to a database)
 * would be misread by the immutable read-only open. Every shard must be inside
 * the copy: main.db keeps the original's absolute shard paths.
 */
function assertNotLive(files: string[]) {
  const absent = files.filter((file) => !existsSync(file));
  if (absent.length) throw new Error(`Databases missing in the data dir: ${absent.map((file) => path.basename(file)).join(", ")}`);
  const live = files.filter((file) => existsSync(`${file}-wal`) && statSync(`${file}-wal`).size > 0);
  if (live.length) {
    throw new Error(`Refusing the dry run on a live data dir (${live.map((file) => path.basename(file)).join(", ")} have -wal files): `
      + "run it on an online .backup copy (doc/SPAM-DETECTION.md)");
  }
}

function printScans(scans: Array<ServerFlagAccountScan & { email: string }>) {
  const total: Record<string, number> = {};
  for (const scan of scans) {
    const counts = Object.entries(scan.counts).sort((a, b) => b[1] - a[1]).map(([key, value]) => `${key} ${value}`).join(", ");
    console.log(`  ${scan.accountId} (${scan.email}): INBOX ${scan.inboxRows} rows, ${scan.withSource} sources read, ${scan.flagged} server-flagged`
      + ` → ${scan.junkMailbox ?? "no Junk folder"}${counts ? `; ${counts}` : ""}`);
    for (const [key, value] of Object.entries(scan.counts)) total[key] = (total[key] ?? 0) + value;
  }
  console.log(`Total: ${Object.entries(total).sort((a, b) => b[1] - a[1]).map(([key, value]) => `${key} ${value}`).join(", ") || "no server-flagged INBOX mail"}`);
}

const correspondentCheck = (sentShards: Array<{ db: ScanDb; accountId: string; sentFolderId: string }>) => {
  const cache = new Map<string, boolean>();
  return (email: string) => {
    let known = cache.get(email);
    if (known === undefined) {
      known = sentShards.some((shard) => sentToAddressInDb(shard.db, shard.accountId, shard.sentFolderId, email));
      cache.set(email, known);
    }
    return known;
  };
};

async function applyServerFlagged() {
  const data = arg("data");
  if (!data) throw new Error("Pass --data <data dir> (the environment's NOCTUA_DATA_DIR is never used)");
  const dataDir = path.resolve(data);
  const out = outputPath("out", dataDir);
  const rulesPath = path.resolve(arg("rules") ?? path.join(dataDir, "spam-static-rules.json"));
  const staticRules = await loadStaticRules(rulesPath);
  const started = performance.now();
  const seconds = () => `${((performance.now() - started) / 1000).toFixed(1)} s`;

  if (dryRun) {
    if (arg("only")) throw new Error("--only belongs to the real run");
    const accountsFile = path.join(dataDir, "db", "accounts");
    const inspect = openSpamDataDir(dataDir);
    try {
      assertNotLive([path.join(dataDir, "db", "main.db"), ...inspect.accounts.map((account) => path.join(accountsFile, `${account.id}.db`))]);
      const sentShards = inspect.accounts.flatMap((account) => {
        const { db, folders } = inspect.shard(account.id);
        const sent = findSentFolder(folders, account.id);
        return sent ? [{ db, accountId: account.id, sentFolderId: sent.id }] : [];
      });
      const household: ServerFlagHousehold = { ...inspect.own, isCorrespondent: correspondentCheck(sentShards), staticRules };
      const targets = inspect.accounts.filter((account) => !accountFilter || account.id === accountFilter);
      if (!targets.length) throw new Error(accountFilter ? `Account ${accountFilter} not found in ${dataDir}` : `No accounts in ${dataDir}`);
      console.log(`Server-flagged INBOX mail (dry run, read-only, no IMAP): ${dataDir}, ${targets.length} accounts, rules ${existsSync(rulesPath) ? rulesPath : "none"}`);
      const scans: Array<ServerFlagAccountScan & { email: string }> = [];
      for (const account of targets) {
        const { db, folders } = inspect.shard(account.id);
        scans.push({ ...await scanServerFlaggedInbox({ accountId: account.id, db, folders, sourcesDir: inspect.sourcesDir, household }), email: account.email });
      }
      printScans(scans);
      const items = scans.flatMap((scan) => scan.items);
      const domainHistory = items.filter((item) => item.decision === "move" && item.domainUnflagged > 0).length;
      console.log(`Review first: ${domainHistory} "move" items whose root domain also sent unflagged INBOX mail (domainUnflagged > 0)`);
      if (out) {
        writePrivateJson(out, {
          generatedAt: new Date().toISOString(), mode: "dry-run", dataDir,
          accounts: scans.map(({ items: _items, ...scan }) => scan),
          items
        });
        console.log(`Wrote ${items.length} items (${items.filter((item) => item.decision === "move").length} to move) to ${out}`);
      } else {
        for (const item of items.filter((candidate) => candidate.decision === "move")) console.log(`  ${item.subject || "(kein Betreff)"} — ${item.fromEmail ?? "?"}`);
      }
      console.log(`Nothing was moved (${seconds()}). Review the list, then run with --only <file> instead of --dry-run.`);
    } finally { inspect.close(); }
    return 0;
  }

  const onlyPath = arg("only");
  if (!onlyPath || !existsSync(onlyPath)) throw new Error("The real run needs --only <reviewed file written by --server-flagged --dry-run --out>");
  const reviewed = parseReviewedServerFlagItems(JSON.parse(readFileSync(onlyPath, "utf8")))
    .filter((item) => !accountFilter || item.accountId === accountFilter);
  const accountIds = [...new Set(reviewed.map((item) => item.accountId))];

  // Read-only inspection first: shards must carry the spam schema and live inside the data dir.
  const inspect = openSpamDataDir(dataDir);
  const missing = accountIds.filter((accountId) => !inspect.accounts.some((account) => account.id === accountId));
  const targets = inspect.accounts.filter((account) => accountIds.includes(account.id));
  const missingSchema = targets.filter((account) => !hasSpamSchema(inspect.shard(account.id).db)).map((account) => account.id);
  inspect.close();
  if (missing.length) throw new Error(`Accounts of --only not in ${dataDir}: ${missing.join(", ")}`);
  if (missingSchema.length) {
    throw new Error(`Spam schema (spam_examples) missing on ${missingSchema.join(", ")}: deploy and start the spam build first (doc/SPAM-DETECTION.md, Deploy)`);
  }
  assertShardsInsideDataDir(targets, dataDir);
  // The app's DB layer reads NOCTUA_DATA_DIR; the explicit --data wins over the environment.
  process.env.NOCTUA_DATA_DIR = dataDir;
  const { getAccounts, getFolders } = await import("../lib/db");
  const { getAccountDb } = await import("../lib/db/connection");
  const { buildOwnIdentitySets } = await import("../lib/mail/spam/allowlist");
  const { getSourcesDir } = await import("../lib/runtimePaths");
  const accounts = await getAccounts();
  const shards = new Map<string, { db: ScanDb; folders: Folder[] }>();
  for (const account of accounts) shards.set(account.id, { db: await getAccountDb(account.id), folders: await getFolders(account.id) });
  const sentShards = accounts.flatMap((account) => {
    const shard = shards.get(account.id)!;
    const sent = findSentFolder(shard.folders, account.id);
    return sent ? [{ db: shard.db, accountId: account.id, sentFolderId: sent.id }] : [];
  });
  const household: ServerFlagHousehold = {
    ...buildOwnIdentitySets(accounts.flatMap((account) => [account.email, ...(account.ownAddresses ?? [])])),
    isCorrespondent: correspondentCheck(sentShards),
    staticRules
  };
  console.log(`Server-flagged INBOX mail → Junk: ${dataDir}, ${reviewed.length} reviewed items in ${onlyPath}, rules ${existsSync(rulesPath) ? rulesPath : "none"}`);
  const scans: Array<ServerFlagAccountScan & { email: string }> = [];
  for (const account of accounts.filter((candidate) => accountIds.includes(candidate.id))) {
    const { db, folders } = shards.get(account.id)!;
    scans.push({ ...await scanServerFlaggedInbox({ accountId: account.id, db, folders, sourcesDir: getSourcesDir(), household }), email: account.email });
  }
  printScans(scans);
  const plan = planServerFlagApply(reviewed, scans.flatMap((scan) => scan.items));
  console.log(`Plan: ${plan.move.length} to move, ${plan.gone.length} no longer in the INBOX (moved already, deleted or changed), ${plan.nowExcluded.length} excluded now`);
  for (const item of plan.nowExcluded) console.log(`  kept: ${item.subject || "(kein Betreff)"} — ${item.fromEmail ?? "?"} — ${item.reasons.join(", ")}`);

  const moved: Moved[] = [];
  const { lookup, move } = await appMove(SERVER_FLAG_BACKFILL_SOURCE, { datedAtArrival: true, onMoved: (entry) => moved.push(entry) });
  const counts = await applySpamItems(serverFlagApplyRecords(plan.move), { dryRun: false, lookup, move });
  if (out) {
    writePrivateJson(out, {
      generatedAt: new Date().toISOString(), mode: "apply", dataDir, source: SERVER_FLAG_BACKFILL_SOURCE, counts, moved,
      gone: plan.gone, nowExcluded: plan.nowExcluded.map(({ accountId, id, messageId, reasons }) => ({ accountId, id, messageId, reasons }))
    });
    console.log(`Wrote the apply log to ${out}`);
  }
  console.log(`Summary: ${counts.moved} moved, ${counts["not-in-inbox"]} no longer in INBOX, ${counts.missing} not found, ${counts.error} errors, `
    + `${plan.gone.length} reviewed items gone, ${plan.nowExcluded.length} excluded now (${seconds()})`);
  return counts.error ? 1 : 0;
}

const code = process.argv.includes("--server-flagged") ? await applyServerFlagged() : await applyEvalFile();
// Pooled IMAP connections would keep the process alive.
process.exit(code);
