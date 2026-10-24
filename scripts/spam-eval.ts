/**
 * Spam classifier evaluation on a data dir, strictly read-only (doc/SPAM-DETECTION.md).
 *
 *   bun scripts/spam-eval.ts --data /path/to/noctua-data [--sample eval-sample.json]
 *     [--rules static-rules.json] [--limit 200 [--stratified]] [--concurrency 4] [--threshold 0.85]
 *
 * --limit N takes the first N items (the sample lists spam first); with
 * --stratified it takes N/2 spam and N/2 ham instead.
 *
 * Labels: messages in Junk/Spam folders are spam, INBOX messages are ham. With
 * --sample the labeled items come from that file; without it all Junk/Spam
 * messages and a seeded random 1,000 INBOX messages are used. With
 * ANTHROPIC_API_KEY set the model is called (costs money); without it only the
 * allowlist and static rules run and the rest is reported as undecided. Output
 * names messages by subject and sender only.
 */
import { Database, constants } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { simpleParser } from "mailparser";
import type { Folder } from "../lib/data";
import { sentToAddressInDb } from "../lib/db/sentRecipients";
import { buildOwnIdentitySets, type SpamAllowlistContext } from "../lib/mail/spam/allowlist";
import { classifySpam, shouldMarkAsSpam } from "../lib/mail/spam/classifySpam";
import { isValidThreshold, resolveSpamConfig } from "../lib/mail/spam/config";
import { buildSpamInput, buildSpamInputFromMessage } from "../lib/mail/spam/input";
import { getSpamLanguageModel, getSpamProviderOptions } from "../lib/mail/spam/provider";
import { loadStaticRules, serverFlaggedSpam, staticRulesPath } from "../lib/mail/spam/staticRules";
import type { SpamDecision, SpamInput } from "../lib/mail/spam/types";
import { findInboxFolder, findSentFolder, isSpamFolder } from "../lib/specialFolders";

type Item = { accountId: string; id: string; label: "spam" | "ham"; serverSpamFlag?: boolean };
type Outcome = { item: Item; subject: string; sender: string; decision: SpamDecision | null; marked: boolean; serverFlag: boolean; error?: string };

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

const dataDir = path.resolve(arg("data") ?? process.env.NOCTUA_DATA_DIR ?? "");
if (!arg("data") && !process.env.NOCTUA_DATA_DIR) throw new Error("Pass --data <data dir> (read-only)");
const samplePath = arg("sample");
const rulesPath = arg("rules") ?? staticRulesPath();
const limit = Number(arg("limit") ?? 0);
const stratified = process.argv.includes("--stratified");
const concurrency = Math.max(1, Number(arg("concurrency") ?? 4));
const config = resolveSpamConfig(null);
const threshold = isValidThreshold(Number(arg("threshold"))) ? Number(arg("threshold")) : config.threshold;
const model = getSpamLanguageModel(config);

// immutable=1: never take locks or touch the -wal/-shm files of a live data dir.
function openReadOnly(file: string) {
  const flags = (constants as Record<string, number>).SQLITE_OPEN_READONLY | (constants as Record<string, number>).SQLITE_OPEN_URI;
  return new Database(`file:${encodeURI(file)}?immutable=1`, flags);
}

const main = openReadOnly(path.join(dataDir, "db", "main.db"));
const accounts = main.prepare("SELECT id, email, dbPath FROM accounts").all() as Array<{ id: string; email: string; dbPath: string | null }>;
const identities = main.prepare("SELECT email FROM sender_identities").all() as Array<{ email: string }>;
main.close();
const own = buildOwnIdentitySets([...accounts.map((account) => account.email), ...identities.map((identity) => identity.email)]);

const shards = new Map<string, { db: Database; folders: Folder[] }>();
function shard(accountId: string) {
  let entry = shards.get(accountId);
  if (!entry) {
    const account = accounts.find((candidate) => candidate.id === accountId);
    const file = account?.dbPath && existsSync(account.dbPath) ? account.dbPath : path.join(dataDir, "db", "accounts", `${accountId}.db`);
    const db = openReadOnly(file);
    const folders = db.prepare("SELECT * FROM folders WHERE accountId = ?").all(accountId) as Folder[];
    entry = { db, folders };
    shards.set(accountId, entry);
  }
  return entry;
}

/** Deterministic PRNG for the fallback sample (mulberry32). */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleFromDb(): Item[] {
  const spam: Item[] = [];
  const inbox: Item[] = [];
  // Synthetic fixture mailboxes (.test addresses) are not real mail.
  for (const account of accounts.filter((candidate) => !/\.test$/i.test(candidate.email))) {
    const { db, folders } = shard(account.id);
    const spamFolders = folders.filter((folder) => isSpamFolder(folder.id, folders)).map((folder) => folder.id);
    const inboxId = findInboxFolder(folders, account.id)?.id;
    for (const row of db.prepare("SELECT id, folderId FROM messages WHERE accountId = ? AND COALESCE(deleted, 0) = 0").all(account.id) as Array<{ id: string; folderId: string }>) {
      if (spamFolders.includes(row.folderId)) spam.push({ accountId: account.id, id: row.id, label: "spam" });
      else if (row.folderId === inboxId) inbox.push({ accountId: account.id, id: row.id, label: "ham" });
    }
  }
  const next = random(42);
  for (let index = inbox.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [inbox[index], inbox[swap]] = [inbox[swap], inbox[index]];
  }
  return [...spam, ...inbox.slice(0, 1000)];
}

const items: Item[] = samplePath && existsSync(samplePath)
  ? (JSON.parse(readFileSync(samplePath, "utf8")) as { items: Item[] }).items
  : sampleFromDb();
const byLabel = (label: Item["label"], count: number) => items.filter((item) => item.label === label).slice(0, count);
const selected = limit <= 0 ? items
  : stratified ? [...byLabel("spam", Math.ceil(limit / 2)), ...byLabel("ham", Math.floor(limit / 2))]
  : items.slice(0, limit);
const rules = await loadStaticRules(rulesPath);

async function loadInput(item: Item): Promise<{ input: SpamInput; row: Record<string, unknown> } | null> {
  const { db } = shard(item.accountId);
  const row = db.prepare("SELECT * FROM messages WHERE accountId = ? AND id = ?").get(item.accountId, item.id) as Record<string, any> | null;
  if (!row) return null;
  const source = path.join(dataDir, "sources", encodeURIComponent(item.accountId), `${encodeURIComponent(item.id)}.eml`);
  if (existsSync(source)) {
    try { return { input: buildSpamInput(await simpleParser(readFileSync(source))), row }; } catch { /* fall back to the row */ }
  }
  return { input: buildSpamInputFromMessage({ from: row.fromAddr, to: row.toAddr, subject: row.subject, body: row.body, listId: row.listId, listUnsubscribe: row.listUnsubscribe }), row };
}

async function evaluate(item: Item): Promise<Outcome | null> {
  const loaded = await loadInput(item);
  if (!loaded) return null;
  const { input } = loaded;
  const { db, folders } = shard(item.accountId);
  const sent = findSentFolder(folders, item.accountId);
  const allowlist: SpamAllowlistContext = {
    ...own,
    isCorrespondent: async (email) => (sent ? sentToAddressInDb(db, item.accountId, sent.id, email) : false),
    // The dev data has no recorded user decisions yet.
    latestDecision: async () => null
  };
  const base = { item, subject: input.subject, sender: input.fromEmail ?? input.from, serverFlag: item.serverSpamFlag ?? serverFlaggedSpam(input) };
  try {
    const decision = await classifySpam({ input, allowlist, staticRules: rules, getExamples: async () => [], model, providerOptions: getSpamProviderOptions(config) });
    return { ...base, decision, marked: shouldMarkAsSpam(decision, threshold) };
  } catch (error) {
    return { ...base, decision: null, marked: false, error: String(error) };
  }
}

const outcomes: Outcome[] = [];
let cursor = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < selected.length) {
    const outcome = await evaluate(selected[cursor++]);
    if (outcome) outcomes.push(outcome);
  }
}));
for (const { db } of shards.values()) db.close();

const of = (label: "spam" | "ham") => outcomes.filter((outcome) => outcome.item.label === label);
const spam = of("spam");
const ham = of("ham");
const truePositives = spam.filter((outcome) => outcome.marked).length;
const falsePositives = ham.filter((outcome) => outcome.marked && !outcome.serverFlag);
const flaggedHamMarked = ham.filter((outcome) => outcome.marked && outcome.serverFlag);
const pct = (value: number) => (Number.isFinite(value) ? `${(value * 100).toFixed(1)} %` : "n/a");
const bySource = (list: Outcome[]) => {
  const counts: Record<string, number> = {};
  for (const outcome of list) {
    const key = outcome.error ? "error" : outcome.decision ? `${outcome.decision.source}:${outcome.decision.verdict}` : "undecided";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
};
const line = (outcome: Outcome) => `  - ${outcome.subject || "(kein Betreff)"} — ${outcome.sender}`;

console.log(`Spam eval — ${model ? `model ${config.provider}/${config.model}` : "static rules only (no ANTHROPIC_API_KEY)"}, threshold ${threshold}`);
console.log(`Sample: ${samplePath && existsSync(samplePath) ? samplePath : "from the data dir (seed 42)"}; rules: ${existsSync(rulesPath) ? rulesPath : "none"}`);
console.log(`Evaluated: ${spam.length} spam, ${ham.length} ham (${ham.filter((outcome) => outcome.serverFlag).length} ham with server spam flag), ${selected.length - outcomes.length} not found`);
console.log(`Decision sources (spam): ${JSON.stringify(bySource(spam))}`);
console.log(`Decision sources (ham):  ${JSON.stringify(bySource(ham))}`);
const markedHam = falsePositives.length + flaggedHamMarked.length;
console.log(`Marked: ${truePositives} of ${spam.length} spam (recall ${pct(truePositives / spam.length)}), ${markedHam} of ${ham.length} ham`);
console.log(`Precision: ${pct(truePositives / (truePositives + falsePositives.length))} (server-flagged ham excluded), ${pct(truePositives / (truePositives + markedHam))} (all ham)`);
console.log(`False positives (ham marked as spam, no server flag): ${falsePositives.length}`);
falsePositives.forEach((outcome) => console.log(line(outcome)));
console.log(`Server-flagged ham marked as spam (reported separately): ${flaggedHamMarked.length}`);
flaggedHamMarked.forEach((outcome) => console.log(line(outcome)));
const allowlistedSpam = spam.filter((outcome) => outcome.decision?.source === "allowlist" || outcome.decision?.source === "static-allow");
console.log(`Spam passed by allowlist/allow rules: ${allowlistedSpam.length}`);
allowlistedSpam.slice(0, 30).forEach((outcome) => console.log(`${line(outcome)} [${outcome.decision?.source}: ${outcome.decision?.reasons.join("; ")}]`));
const errors = outcomes.filter((outcome) => outcome.error);
if (errors.length) console.log(`Errors: ${errors.length} (first: ${errors[0].error})`);
