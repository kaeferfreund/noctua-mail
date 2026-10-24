// Extra perf on a clone of the 11k upsert-seeded shared shard: p50/p95 over
// 21 interleaved paired reps (warm) + cold (connection closed/reopened before
// each sample: SQLite page cache cold, OS cache warm). Review-only.
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { cloneData } from "./clone";
import { openOrSeed, WT } from "./seed";

const dataDir = cloneData("data-bench");
const { info, getAccountDb } = await openOrSeed(dataDir);
const conn: any = await import(WT + "/lib/db/connection.ts");
const { listThreads, listMessages } = await import(WT + "/lib/db/messages/query.ts");
const A = info.aId;
const shardPath = ((await getAccountDb(A)) as any).filename;
console.warn = () => {};

const P = { accountId: A, page: 1, pageSize: 50 };
const cases: Array<[string, () => Promise<any>]> = [
  ["T needle (415 hits)", () => listThreads({ ...P, query: "needle" })],
  ["M needle (415 hits)", () => listMessages({ ...P, query: "needle" })],
  ["T quokka zebra (2 rare tokens)", () => listThreads({ ...P, query: "quokka zebra" })],
  ["T nearcap (1834 hits, under cap)", () => listThreads({ ...P, query: "nearcap" })],
  ["M nearcap (1834 hits, under cap)", () => listMessages({ ...P, query: "nearcap" })],
  ["T nearcap needle (probe/intersection)", () => listThreads({ ...P, query: "nearcap needle" })],
  ["T overcap needle (oversized probe)", () => listThreads({ ...P, query: "overcap needle" })],
  ["T overcap (2750, cap fallback)", () => listThreads({ ...P, query: "overcap" })],
  ["T synthetic (all, fallback)", () => listThreads({ ...P, query: "synthetic" })],
  ["T needle inbox grouped sender", () => listThreads({ ...P, query: "needle", folderId: "inbox", groupBy: "sender" })],
  ["T id fragment xyzzy (fields bogus)", () => listThreads({ ...P, query: "xyzzy", fields: ["bogus"] })],
  ["T grüße (umlaut)", () => listThreads({ ...P, query: "grüße" })],
  // non-search list paths (must be unchanged)
  ["T default list", () => listThreads({ ...P })],
  ["T inbox list", () => listThreads({ ...P, folderId: "inbox" })],
  ["M inbox unread", () => listMessages({ ...P, folderId: "inbox", badges: ["unread"] })],
  ["T from:alice only", () => listThreads({ ...P, query: "from:alice" })]
];
const setMode = (legacy: boolean) => { if (legacy) process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1"; else delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH; };
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)].toFixed(2); };
const out: any = { loadStart: loadavg(), rows: [] };
const REPS = 21, COLD = 7;
for (const [label, fn] of cases) {
  for (const legacy of [true, false]) { setMode(legacy); await fn(); }
  const s: Record<string, number[]> = { legacy: [], driven: [], legacyCold: [], drivenCold: [] };
  let eq = true;
  for (let rep = 0; rep < REPS; rep++) {
    let lj = "", dj = "";
    for (const legacy of rep % 2 ? [false, true] : [true, false]) {
      setMode(legacy);
      const t0 = performance.now();
      const r = await fn();
      s[legacy ? "legacy" : "driven"].push(performance.now() - t0);
      if (legacy) lj = JSON.stringify(r); else dj = JSON.stringify(r);
    }
    if (lj !== dj) eq = false;
  }
  for (let rep = 0; rep < COLD; rep++) {
    for (const legacy of rep % 2 ? [false, true] : [true, false]) {
      conn.closeAccountDbConnection(shardPath);
      await getAccountDb(A);
      setMode(legacy);
      const t0 = performance.now();
      await fn();
      s[legacy ? "legacyCold" : "drivenCold"].push(performance.now() - t0);
    }
  }
  setMode(false);
  const row = {
    label, equal: eq,
    legacyP50: pct(s.legacy, 0.5), legacyP95: pct(s.legacy, 0.95), drivenP50: pct(s.driven, 0.5), drivenP95: pct(s.driven, 0.95),
    deltaP50: +((pct(s.driven, 0.5) / pct(s.legacy, 0.5) - 1) * 100).toFixed(1),
    legacyColdP50: pct(s.legacyCold, 0.5), drivenColdP50: pct(s.drivenCold, 0.5),
    load1: +loadavg()[0].toFixed(1)
  };
  out.rows.push(row);
  console.log(JSON.stringify(row));
}
out.loadEnd = loadavg();
writeFileSync(WT + "/.tmp/review/bench-extra-results.json", JSON.stringify(out, null, 2));
process.exit(0);
