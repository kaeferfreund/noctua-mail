// Differential harness: FTS-driven vs legacy (kill switch) over randomized
// queries on the 11k shared shard. Review-only, untracked.
import { writeFileSync } from "node:fs";
import { openOrSeed, rng, VOCAB, WT } from "./seed";

const dataDir = WT + "/.tmp/review/data-diff";
const { info, getAccountDb } = await openOrSeed(dataDir);
const { listThreads, listMessages } = await import(WT + "/lib/db/messages/query.ts");
const shard: any = await getAccountDb(info.aId);

const seedArg = Number(process.argv[2] ?? 4242);
const COUNT_A = Number(process.argv[3] ?? 240);
const COUNT_B = Number(process.argv[4] ?? 60);
const r = rng(seedArg);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const chance = (p: number) => r() < p;

// Observe resolution path + fallback logs (driven runs only).
let sqlLog: string[] = [];
const origPrepare = shard.prepare.bind(shard);
shard.prepare = (sql: string) => {
  sqlLog.push(sql);
  return origPrepare(sql);
};
let warns: unknown[][] = [];
const origWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (String(args[0]).includes("[fts-search]")) warns.push(args);
  else origWarn(...args);
};

function textPart(accountFlavour: "a" | "b"): string {
  const parts: string[] = [];
  const n = pick([0, 1, 1, 1, 2, 2, 3]);
  for (let k = 0; k < n; k++) {
    const kind = r();
    let w: string;
    if (kind < 0.18) w = pick(VOCAB.common);
    else if (kind < 0.36) w = pick(VOCAB.mid);
    else if (kind < 0.5) w = pick(VOCAB.rare);
    else if (kind < 0.6) w = pick(VOCAB.umlaut);
    else if (kind < 0.66) w = pick(VOCAB.dashed);
    else if (kind < 0.72) w = pick(VOCAB.capBand);
    else if (kind < 0.78) { const base = pick([...VOCAB.mid, ...VOCAB.rare, ...VOCAB.umlaut]); w = base.slice(0, 3 + Math.floor(r() * 3)); }
    else if (kind < 0.82) w = pick(["GRÜSSE", "grüsse", "KÖLN", "über", "ÜBER", "größe", "Zoë", "ångström", "juergen@example", "alice@example.test"]);
    else if (kind < 0.86) w = pick(["xyzzy", "m12", "m1234", "th-a-77", "mail.example", ".a.xyzzy@mail", "m4"]);
    else if (kind < 0.9) w = pick(["invoice-2026", "photo_", "_1", "contract", "übersicht_", "quokka-notes", "%", "plan.pdf"]);
    else if (kind < 0.93) w = pick(["!!!", "--", "\"", "'", "@", "#"]);
    else if (kind < 0.96) w = pick(["nonexistentzz", "qqqqq"]);
    else w = pick(["has:attachment", "subject:needle", "AND", "or", "NOT", "near", "banana"]);
    if (accountFlavour === "b" && chance(0.3)) w = pick(["banana", "needle", "m12", "synthetic"]);
    parts.push(w);
  }
  let text = parts.join(" ");
  if (parts.length >= 2 && chance(0.15)) text = `"${text}"`;
  if (chance(0.05)) text = "  " + text + "  ";
  const ops: string[] = [];
  if (chance(0.1)) ops.push("from:" + pick(["alice", "juergen@example.test", "lic", "\"Jürgen Groß\"", "me", "nobody"]));
  if (chance(0.07)) ops.push("to:" + pick(["team", "bob@example.test", "carol"]));
  if (chance(0.07)) ops.push("with:" + pick(["zoe", "billing", "me"]));
  if (chance(0.06)) ops.push("in:" + pick(["archive", "sent", "inbox", "nonexist"]));
  if (chance(0.04)) ops.push("thread:" + pick(info.threadsA.slice(0, 200)));
  if (chance(0.03)) ops.push(pick(["topic:none", "invite:abc123", "event:zzz"]));
  const all = [...ops, text].filter(Boolean);
  // shuffle
  for (let k = all.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [all[k], all[j]] = [all[j], all[k]]; }
  return all.join(" ");
}

function params(accountId: string, flavour: "a" | "b") {
  const p: Record<string, unknown> = { accountId, query: textPart(flavour) };
  if (chance(0.35)) p.folderId = pick(["inbox", "archive", "sent", "trash"]);
  if (chance(0.3)) {
    const badges = ["flagged", "unread", "attachments", "unanswered", "todo", "done", "attention", "newsletter", "focused",
      "assigned-to-me", "unassigned", "open", "closed", "in-progress", "waiting", "transactional"];
    p.badges = Array.from(new Set([pick(badges), ...(chance(0.3) ? [pick(badges)] : [])]));
    p.viewerUserId = chance(0.8) ? "u-viewer" : null;
  }
  if (chance(0.25)) {
    const fields = ["sender", "participants", "subject", "body", "attachments", "preview", "to", "cc", "bcc", "from", "bogus"];
    p.fields = Array.from(new Set([pick(fields), ...(chance(0.5) ? [pick(fields)] : [])]));
  }
  p.groupBy = pick(["date", "date", "date", "week", "year", "sender", "domain", "folder", "none", "invite-date", "event"]);
  if (chance(0.2)) p.threadDateSource = pick(["latestDateValue", "latestReceivedDateValue"]);
  if (chance(0.1)) p.attachmentsOnly = true;
  if (chance(0.15)) p.excludedFolderIds = ["trash"];
  if (chance(0.06)) p.from = [pick(["alice@example.test", "news@lists.example.test"])];
  if (chance(0.05)) p.recipients = [pick(["team@example.test", "bob@example.test"])];
  if (chance(0.05)) p.participants = [pick(["zoe@example.test", "carol@partner.example.test"])];
  if (chance(0.15)) p.sortBy = "size";
  p.pageSize = pick([10, 25, 50, 100]);
  return p;
}

type Outcome = { ok: true; json: string } | { ok: false; err: string };
async function outcome(fn: () => Promise<unknown>): Promise<Outcome> {
  try { return { ok: true, json: JSON.stringify(await fn()) }; }
  catch (e: any) { return { ok: false, err: `${e?.name}:${e?.code}:${e?.message}` }; }
}

const results: any[] = [];
const mismatches: any[] = [];
const pathCounts: Record<string, number> = {};
let multiLog = 0;
let leakLog = 0;
let crossAccount = 0;

async function runCase(p: Record<string, unknown>, cap: string | null) {
  const pages = chance(0.35) ? [1, 2] : [pick([1, 1, 2, 3])];
  for (const page of pages) {
    for (const fnName of ["listThreads", "listMessages"] as const) {
      const call = () => (fnName === "listThreads" ? listThreads : listMessages)({ ...p, page } as any);
      if (cap) process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES = cap; else delete process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES;
      process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1";
      warns = [];
      const legacy = await outcome(call);
      const legacyWarns = warns.length;
      delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
      sqlLog = []; warns = [];
      const driven = await outcome(call);
      delete process.env.NOCTUA_FTS_DRIVEN_MAX_CANDIDATES;
      const resolved = sqlLog.some((s) => s.includes("MATCH ? AND accountId") || /SELECT id FROM messages\s+WHERE accountId = \?\s+AND \(lower\(messageId\)/.test(s) || s.includes("SELECT messageId FROM attachments WHERE accountId = ?"));
      const idsUsed = sqlLog.some((s) => /m\.id IN \(\?/.test(s) || s.includes("AND (0 = 1)"));
      const probe = sqlLog.some((s) => /SELECT m\.id FROM messages m\s+WHERE m\.accountId = \? AND m\.id IN \(/.test(s));
      const reason = warns.map((w: any) => w[1]?.reason).join(",");
      const path = !resolved ? "none" : idsUsed ? (probe ? "ids+probe" : "ids") : `legacy:${reason || "?"}`;
      pathCounts[path] = (pathCounts[path] ?? 0) + 1;
      if (warns.length > 1) multiLog++;
      if (legacyWarns !== 0) multiLog++;
      const q = String(p.query ?? "").toLowerCase();
      const tokens = q.split(/\s+/).map((t) => t.replace(/[^\p{L}\p{N}]/gu, "")).filter((t) => t.length >= 3);
      for (const w of warns) {
        const s = JSON.stringify(w).toLowerCase();
        if (tokens.some((t) => s.includes(t)) || s.includes(String(p.accountId).toLowerCase())) leakLog++;
      }
      if (driven.ok) {
        const parsed = JSON.parse(driven.json);
        if ((parsed.items ?? []).some((m: any) => m.accountId && m.accountId !== p.accountId)) crossAccount++;
      }
      const same = legacy.ok === driven.ok && (legacy.ok ? legacy.json === (driven as any).json : (legacy as any).err === (driven as any).err);
      const rec = { fn: fnName, page, cap, path, same, legacyOk: legacy.ok, params: p };
      results.push(rec);
      if (!same) {
        let detail: any = {};
        if (legacy.ok && driven.ok) {
          const L = JSON.parse(legacy.json), D = JSON.parse((driven as any).json);
          detail = {
            total: [L.total, D.total], hasMore: [L.hasMore, D.hasMore], baseCount: [L.baseCount, D.baseCount],
            itemIdsL: (L.items ?? []).map((m: any) => m.id).slice(0, 12), itemIdsD: (D.items ?? []).map((m: any) => m.id).slice(0, 12),
            sameIdSet: JSON.stringify((L.items ?? []).map((m: any) => m.id).sort()) === JSON.stringify((D.items ?? []).map((m: any) => m.id).sort()),
            groupsEqual: JSON.stringify(L.groups) === JSON.stringify(D.groups),
            groupsSameSet: JSON.stringify([...(L.groups ?? [])].sort((a: any, b: any) => String(a.key).localeCompare(String(b.key)))) === JSON.stringify([...(D.groups ?? [])].sort((a: any, b: any) => String(a.key).localeCompare(String(b.key))))
          };
        } else detail = { legacy: legacy.ok ? "ok" : (legacy as any).err, driven: driven.ok ? "ok" : (driven as any).err };
        mismatches.push({ ...rec, detail });
      }
    }
  }
}

const t0 = performance.now();
for (let i = 0; i < COUNT_A; i++) {
  const cap = chance(0.25) ? pick(["40", "300", "1000"]) : null;
  await runCase(params(info.aId, "a"), cap);
}
for (let i = 0; i < COUNT_B; i++) {
  const cap = chance(0.25) ? pick(["40", "300"]) : null;
  await runCase(params(info.bId, "b"), cap);
}
const summary = {
  seed: seedArg,
  queries: COUNT_A + COUNT_B,
  calls: results.length,
  mismatches: mismatches.length,
  legacyErrors: results.filter((x) => !x.legacyOk).length,
  pathCounts,
  multiLog,
  leakLog,
  crossAccount,
  seconds: ((performance.now() - t0) / 1000).toFixed(1)
};
writeFileSync(WT + `/.tmp/review/diff-${seedArg}.json`, JSON.stringify({ summary, mismatches, results }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const m of mismatches.slice(0, 15)) console.log(JSON.stringify(m));
process.exit(0);
