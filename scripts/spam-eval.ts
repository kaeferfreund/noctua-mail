/**
 * Spam classifier evaluation on a data dir, strictly read-only (doc/SPAM-DETECTION.md).
 *
 *   bun scripts/spam-eval.ts --data /path/to/noctua-data [--sample eval-sample.json]
 *     [--rules static-rules.json] [--limit 200 [--stratified]] [--concurrency 4] [--threshold 0.85]
 *     [--out eval-result.json] [--trust-profiles [profiles.json]]
 *
 * --limit N takes a seeded random sample of N items, so spam and ham keep their
 * share of the full sample; with --stratified it takes N/2 spam and N/2 ham.
 *
 * Labels: messages in Junk/Spam folders are spam, INBOX messages are ham. With
 * --sample the labeled items come from that file; without it all Junk/Spam
 * messages and a seeded random 1,000 INBOX messages are used. With
 * ANTHROPIC_API_KEY set the model is called (costs money); without it only the
 * allowlist and static rules run and the rest is reported as undecided. Output
 * names messages by subject and sender only, plus the model's token usage, the
 * prompt-cache hit rate and a cost estimate (prices: SPAM_MODEL_PRICES in config). --out writes every evaluated item
 * with its decision as JSON (input for scripts/spam-apply.ts).
 *
 * --trust-profiles builds the household sender profiles from the data dir (one
 * read-only pass per shard) and applies trusted senders with the anomaly gate
 * before the model, as the server does. With a file argument the profiles are
 * read from that file when it exists, otherwise built and written there (the
 * output of scripts/spam-profiles-backfill.ts --dry-run --out works as well).
 * Trust is judged as of each mail's arrival (Received stamp, else dateValue;
 * 180-day decay) with the household history of the mails that arrived before
 * it, as the server would have seen it then.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { simpleParser } from "mailparser";
import { sentToAddressInDb } from "../lib/db/sentRecipients";
import type { SpamAllowlistContext } from "../lib/mail/spam/allowlist";
import type { SpamTrustContext } from "../lib/mail/spam/anomaly";
import { classifySpam, shouldMarkAsSpam } from "../lib/mail/spam/classifySpam";
import { isValidThreshold, resolveSpamConfig, SPAM_MODEL_PRICES } from "../lib/mail/spam/config";
import { openSpamDataDir, seededShuffle, selectEvalItems } from "../lib/mail/spam/evalData";
import { buildSpamInput, buildSpamInputFromMessage } from "../lib/mail/spam/input";
import { loadHouseholdProfiles, type HouseholdProfiles } from "../lib/mail/spam/profileFile";
import { getSpamLanguageModel, getSpamProviderOptions } from "../lib/mail/spam/provider";
import { spamArrivalTime } from "../lib/mail/spam/senderProfile";
import { loadStaticRules, serverFlaggedSpam, staticRulesPath } from "../lib/mail/spam/staticRules";
import type { SpamEvalRecord } from "../lib/mail/spam/apply";
import type { SpamDecision, SpamInput } from "../lib/mail/spam/types";
import { addSpamUsage, EMPTY_SPAM_USAGE, estimateSpamCostUsd, spamCacheHitRate } from "../lib/mail/spam/usage";
import { findInboxFolder, findSentFolder, isSpamFolder } from "../lib/specialFolders";

type Item = { accountId: string; id: string; label: "spam" | "ham"; serverSpamFlag?: boolean };
type Outcome = { item: Item; subject: string; sender: string; fromEmail: string | null; mailboxPath: string | null; decision: SpamDecision | null; marked: boolean; serverFlag: boolean; error?: string };

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}
/** Value of an option whose argument is optional (`--trust-profiles [file]`). */
function optionalArg(name: string) {
  const value = arg(name);
  return value && !value.startsWith("--") ? value : undefined;
}

const dataDir = path.resolve(arg("data") ?? process.env.NOCTUA_DATA_DIR ?? "");
if (!arg("data") && !process.env.NOCTUA_DATA_DIR) throw new Error("Pass --data <data dir> (read-only)");
const samplePath = arg("sample");
const outPath = arg("out") ? path.resolve(arg("out")!) : undefined;
if (outPath && !path.relative(dataDir, outPath).startsWith("..")) throw new Error("--out must not point into the data dir");
const rulesPath = arg("rules") ?? staticRulesPath();
const limit = Number(arg("limit") ?? 0);
const stratified = process.argv.includes("--stratified");
const concurrency = Math.max(1, Number(arg("concurrency") ?? 4));
const config = resolveSpamConfig(null);
const threshold = isValidThreshold(Number(arg("threshold"))) ? Number(arg("threshold")) : config.threshold;
const model = getSpamLanguageModel(config);
const trustProfiles = process.argv.includes("--trust-profiles");
const trustFile = optionalArg("trust-profiles");
if (trustFile && !path.relative(dataDir, path.resolve(trustFile)).startsWith("..")) throw new Error("--trust-profiles <file> must not point into the data dir");

// mode=ro (evalData.ts): reads a live data dir's WAL, never writes or checkpoints it.
const data = openSpamDataDir(dataDir);
const { accounts, own } = data;
const shard = (accountId: string) => data.shard(accountId);

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
  return [...spam, ...seededShuffle(inbox, 42).slice(0, 1000)];
}

const items: Item[] = samplePath && existsSync(samplePath)
  ? (JSON.parse(readFileSync(samplePath, "utf8")) as { items: Item[] }).items
  : sampleFromDb();
const selected = selectEvalItems(items, limit, stratified);
const rules = await loadStaticRules(rulesPath);
let usage = EMPTY_SPAM_USAGE;
let household: HouseholdProfiles | null = null;
if (trustProfiles) {
  const started = performance.now();
  household = await loadHouseholdProfiles(data, trustFile ? path.resolve(trustFile) : null);
  console.log(`Trust profiles: ${household.senders} senders (${household.trusted} trusted) from ${household.rows} rows, `
    + `${household.source === "file" ? `read from ${trustFile}` : "built from the data dir"} in ${((performance.now() - started) / 1000).toFixed(1)} s`);
}

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
  const { input, row } = loaded;
  const { db, folders } = shard(item.accountId);
  const trust: SpamTrustContext | null = household ? household.context(item.accountId, item.id, spamArrivalTime(input, Number(row.dateValue) || Date.now())) : null;
  const sent = findSentFolder(folders, item.accountId);
  const allowlist: SpamAllowlistContext = {
    ...own,
    isCorrespondent: async (email) => (sent ? sentToAddressInDb(db, item.accountId, sent.id, email) : false),
    // The dev data has no recorded user decisions yet.
    latestDecision: async () => null
  };
  const base = {
    item, subject: input.subject, sender: input.fromEmail ?? input.from, fromEmail: input.fromEmail ?? null,
    mailboxPath: typeof row.mailboxPath === "string" ? row.mailboxPath : null, serverFlag: item.serverSpamFlag ?? serverFlaggedSpam(input)
  };
  try {
    const decision = await classifySpam({ input, allowlist, staticRules: rules, getExamples: async () => [], model, trust,
      providerOptions: getSpamProviderOptions(config), onUsage: (call) => { usage = addSpamUsage(usage, call); } });
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
data.close();

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
if (household) {
  const trusted = (kind: string) => outcomes.filter((outcome) => outcome.decision?.trust?.kind === kind);
  const canaries = trusted("canary");
  const mismatches = canaries.filter((outcome) => outcome.decision?.trust?.kind === "canary" && outcome.decision.trust.mismatch);
  const anomalous = trusted("anomaly");
  console.log(`Trusted senders: ${trusted("skip").length} skipped as trusted:profile (no model call), ${canaries.length} canary checks, `
    + `${mismatches.length} canary mismatches, ${anomalous.length} trusted with anomalies (model, threshold 0.9)`);
  mismatches.forEach((outcome) => console.log(`${line(outcome)} [canary: ${outcome.decision?.verdict} ${outcome.decision?.confidence}]`));
  const reasons: Record<string, number> = {};
  for (const outcome of anomalous) {
    for (const anomaly of outcome.decision?.trust?.kind === "anomaly" ? outcome.decision.trust.anomalies : []) {
      const key = anomaly.replace(/\d+(?:\.\d+)?/g, "n").replace(/(Domain|Link|Anhang) \S+/g, "$1 …").replace(/\([^)]*\)$/, "").trim();
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
  }
  console.log(`Anomalies by rule: ${JSON.stringify(Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1] - a[1])))}`);
  const markedTrusted = anomalous.filter((outcome) => outcome.marked);
  console.log(`Trusted with anomalies marked as spam: ${markedTrusted.length}`);
  markedTrusted.forEach((outcome) => console.log(`${line(outcome)} [${outcome.decision?.trust?.kind === "anomaly" ? outcome.decision.trust.anomalies.join("; ") : ""}]`));
}
const errors = outcomes.filter((outcome) => outcome.error);
if (errors.length) console.log(`Errors: ${errors.length} (first: ${errors[0].error})`);
if (usage.calls) {
  console.log(`Model usage: ${usage.calls} calls, input ${usage.inputTokens} tokens (uncached ${usage.noCacheTokens}, `
    + `cache read ${usage.cacheReadTokens}, cache write ${usage.cacheWriteTokens}), output ${usage.outputTokens} tokens`);
  console.log(`Cache hit rate: ${pct(spamCacheHitRate(usage))} of input tokens read from cache; ${usage.cacheHits} of ${usage.calls} calls read the cache`);
  const price = SPAM_MODEL_PRICES[config.model];
  console.log(price
    ? `Estimated cost: $${estimateSpamCostUsd(usage, price).toFixed(4)} (${config.model} list prices, cache writes at the 1 h TTL)`
    : `Estimated cost: no price for ${config.model} in SPAM_MODEL_PRICES`);
}

if (outPath) {
  // Same mapping as the stored verdict: "spam" only when marked, a spam verdict below the threshold is "unsure".
  const records: SpamEvalRecord[] = outcomes.map((outcome) => ({
    accountId: outcome.item.accountId,
    id: outcome.item.id,
    label: outcome.item.label,
    decision: outcome.marked ? "spam" : outcome.decision?.verdict === "ham" ? "ham" : "unsure",
    source: outcome.error ? "error" : outcome.decision?.source ?? "undecided",
    confidence: outcome.decision?.confidence ?? null,
    subject: outcome.subject,
    fromEmail: outcome.fromEmail,
    mailboxPath: outcome.mailboxPath,
    serverSpamFlag: outcome.serverFlag
  }));
  writeFileSync(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), threshold, items: records }, null, 2)}\n`);
  console.log(`Wrote ${records.length} items to ${outPath}`);
}
