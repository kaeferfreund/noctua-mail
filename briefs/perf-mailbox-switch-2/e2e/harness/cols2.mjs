// Like cols.mjs, restricted to [WIN_FROM, WIN_TO] ms after the click marker; self + inclusive.
import { readFileSync } from "node:fs";
const files = process.argv.slice(2); const agg = {}; const self = {}; const [W0, W1] = (process.env.WIN ?? "0,2000").split(",").map(Number);
for (const f of files) {
  const p = JSON.parse(readFileSync(f, "utf8")); const nodes = new Map(p.nodes.map(n => [n.id, n])); const parent = new Map();
  for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  let ts = p.startTime, mark = null; for (let k = 0; k < p.samples.length; k++) { ts += p.timeDeltas[k]; if (nodes.get(p.samples[k])?.callFrame.functionName === "spikeClickMarker") mark = ts; }
  ts = p.startTime;
  for (let k = 0; k < p.samples.length; k++) {
    ts += p.timeDeltas[k]; const rel = (ts - mark) / 1000; if (rel < W0 || rel > W1) continue;
    const dt = (p.timeDeltas[k + 1] ?? 0) / 1000 / files.length; let n = nodes.get(p.samples[k]); if (!n || n.callFrame.functionName === "(idle)") continue;
    const cf0 = n.callFrame; const k0 = `${cf0.functionName}|${cf0.url.split("/").pop()}|${cf0.lineNumber}|${cf0.columnNumber}`; self[k0] = (self[k0] ?? 0) + dt;
    const seen = new Set();
    while (n) { const cf = n.callFrame; const key = `${cf.functionName}|${cf.url.split("/").pop()}|${cf.lineNumber}|${cf.columnNumber}`; if (!seen.has(key)) { seen.add(key); agg[key] = (agg[key] ?? 0) + dt; } const q = parent.get(n.id); n = q ? nodes.get(q) : null; }
  }
}
const D = process.env.CHUNKS; const N = Number(process.env.TOP ?? 40); const SKIP = process.env.SKIP ? new RegExp(process.env.SKIP) : null;
const show = (o) => { for (const [k, v] of Object.entries(o).sort((a, b) => b[1] - a[1]).filter(([k]) => !SKIP || !SKIP.test(k)).slice(0, N)) { const [fn, file, line, col] = k.split("|"); let ex = ""; if (D && file.endsWith(".js")) { try { const t = readFileSync(`${D}/${file}`, "utf8").split("\n")[Number(line)] ?? ""; ex = t.slice(Number(col), Number(col) + 100).replace(/\s+/g, " "); } catch {} } console.log(v.toFixed(1).padStart(7), fn || "(anon)", file + ":" + line + ":" + col, "|", ex); } };
console.log("== inclusive"); show(agg); if (!process.env.NOSELF) { console.log("== self"); show(self); }
