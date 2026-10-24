/**
 * Moves INBOX messages the spam eval marked as spam into each account's Junk
 * folder, so they can be reviewed there (doc/SPAM-DETECTION.md).
 *
 *   bun scripts/spam-apply.ts --in eval-result.json --data /path/to/noctua-data
 *     [--dry-run] [--label ham] [--decision spam] [--account <accountId>]
 *
 * Input is the file written by `scripts/spam-eval.ts --out`. Defaults select
 * label=ham (INBOX at eval time) and decision=spam (marked by the classifier).
 * Each message goes through the same code path as "Als Spam" (Junk folder
 * resolution, $NotJunk cleanup on IMAP, move + local relocation, flag cleanup)
 * and gets the same spam example. Rows that no longer exist or are no longer
 * in the INBOX are skipped. Sequential, one IMAP move at a time.
 *
 * --dry-run only opens the databases read-only and prints what would move.
 * The real run uses the app's DB layer (write retries), so it can run while
 * the service is running; run it from the app directory so Bun loads
 * .env.local. It refuses shards without the spam schema instead of migrating
 * them outside the deploy runbook.
 */
import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Folder, Message } from "../lib/data";
import { applySpamItems, parseSpamEvalRecords, selectSpamApplyItems, type SpamEvalDecision, type SpamEvalRecord } from "../lib/mail/spam/apply";
import { folderMailboxPath } from "../lib/mailboxPaths";
import { getDefaultAccountDbPath, getMainDbPath } from "../lib/runtimePaths";
import { findJunkFolder } from "../lib/specialFolders";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

const inPath = arg("in");
if (!inPath || !existsSync(inPath)) throw new Error("Pass --in <file written by spam-eval --out>");
if (arg("data")) process.env.NOCTUA_DATA_DIR = path.resolve(arg("data")!);
if (!process.env.NOCTUA_DATA_DIR?.trim()) throw new Error("Pass --data <data dir> or set NOCTUA_DATA_DIR");
const dryRun = process.argv.includes("--dry-run");
const label = arg("label") ?? "ham";
const decision = arg("decision") ?? "spam";
if (label !== "ham" && label !== "spam") throw new Error("--label must be ham or spam");
if (!["spam", "ham", "unsure"].includes(decision)) throw new Error("--decision must be spam, ham or unsure");
const accountFilter = arg("account") ?? null;

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
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'spam_examples'").get()) missingSchema.push(accountId);
}

console.log(`Spam apply${dryRun ? " (dry run, read-only)" : ""}: ${items.length} of ${records.length} items match label=${label} decision=${decision}${accountFilter ? ` account=${accountFilter}` : ""}`);
for (const accountId of accountIds) {
  const email = accountRows.find((row) => row.id === accountId)?.email ?? "unknown account";
  console.log(`  ${accountId} (${email}): ${items.filter((item) => item.accountId === accountId).length} items → ${junkByAccount.get(accountId) ?? "shard not found"}`);
}

let lookup: (item: SpamEvalRecord) => Promise<{ mailboxPath: string | null } | null>;
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
  const { getAccountById, getMessageById } = await import("../lib/serverDb");
  const { moveMessageToJunk } = await import("../app/api/_helpers/message/junkMove");
  const { recordSpamDecision } = await import("../lib/mail/spam/examples");
  const current = new Map<string, Message>();
  lookup = async (item) => {
    const message = await getMessageById(item.accountId, item.id);
    if (!message || message.deleted || message.id !== item.id) return null;
    current.set(`${item.accountId}\u0000${item.id}`, message);
    return { mailboxPath: message.mailboxPath ?? null };
  };
  move = async (item) => {
    const message = current.get(`${item.accountId}\u0000${item.id}`)!;
    if (typeof message.imapUid !== "number" || !message.mailboxPath) throw new Error("message is missing IMAP metadata");
    const account = await getAccountById(item.accountId);
    if (!account) throw new Error("account not found");
    // Same steps as POST …/messages/:id/spam ("Als Spam"), without a user.
    const moved = await moveMessageToJunk({ account, accountId: item.accountId, message: { ...message, imapUid: message.imapUid, mailboxPath: message.mailboxPath } });
    await recordSpamDecision({ accountId: item.accountId, message, label: "spam", source: "mark-spam", userId: null });
    return moved.junkMailbox;
  };
}

const counts = await applySpamItems(items, { dryRun, lookup, move });
for (const db of readOnly.values()) db.close();
console.log(`Summary: ${dryRun ? `${counts["would-move"]} would move` : `${counts.moved} moved`}, ${counts["not-in-inbox"]} no longer in INBOX, ${counts.missing} not found, ${counts.error} errors`);
// Pooled IMAP connections would keep the process alive.
process.exit(counts.error ? 1 : 0);
