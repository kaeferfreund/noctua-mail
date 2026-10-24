// Pooled median/p90 per variant over several series JSONs: node pool.mjs label=a.json,b.json label2=c.json,...
import { readFileSync } from "node:fs";
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)] : null; };
const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
for (const arg of process.argv.slice(2)) {
  const [label, files] = arg.split("="); const g = {};
  for (const f of files.split(",")) for (const r of JSON.parse(readFileSync(f, "utf8")).runs) {
    if (r.mode.startsWith("warm-first") || r.timedOut) continue;
    const k = `${r.mode}:${r.from}->${r.to}`; (g[k] ??= { first: [], settled: [], lt: [] });
    g[k].first.push(r.marks.firstRows); g[k].settled.push(r.settledMs); g[k].lt.push(r.longTasks.totalMs);
  }
  for (const [k, v] of Object.entries(g)) console.log(label.padEnd(8), k.padEnd(22), "n", String(v.first.length).padStart(2), "first", med(v.first).toFixed(0), "/", q(v.first, 90).toFixed(0), " settled", med(v.settled).toFixed(0), "/", q(v.settled, 90).toFixed(0), " longtask", med(v.lt).toFixed(0));
}
