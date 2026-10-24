// Re-aggregates saved CPU-profile traces by script chunk (self time, click..+1500 ms).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const dir = "/tmp/spike-switch-e2e/tmp"; const res = {};
for (const f of readdirSync(dir).filter(f => f.startsWith("prof-"))) {
  const ev = JSON.parse(readFileSync(`${dir}/${f}`, "utf8")).traceEvents;
  const mark = ev.find(e => e.name === "spike-click"); const nodes = new Map(); const samples = []; let t = null;
  const prof = ev.find(x => x.name === "Profile" && x.pid === mark.pid);
  for (const e of ev.filter(e => e.name === "ProfileChunk" && e.pid === mark.pid).sort((x, y) => x.ts - y.ts)) {
    const d = e.args.data, cp = d.cpuProfile ?? {}; for (const n of cp.nodes ?? []) nodes.set(n.id, n);
    (cp.samples ?? []).forEach((s, k) => { t = (t ?? prof.args.data.startTime) + d.timeDeltas[k]; samples.push([t, s]); });
  }
  const key = f.replace(/-\d\.json$/, ""); const agg = (res[key] ??= {});
  for (let k = 1; k < samples.length; k++) {
    const [ts, id] = samples[k]; if (ts < mark.ts || ts > mark.ts + 1500000) continue;
    const n = nodes.get(id)?.callFrame ?? {}; if (["(idle)", "(program)"].includes(n.functionName)) continue;
    const c = n.url ? n.url.split("/").pop() : (n.functionName.startsWith("(") ? n.functionName : `native ${n.functionName}`);
    agg[c] = (agg[c] ?? 0) + (ts - samples[k - 1][0]) / 1000 / 2;
  }
}
const label = { "0bomfrlk_0g89.js": "app MailClient/message list", "0rqvshlk9e35x.js": "react-dom", "1y5fvokl9hn96.js": "Intl/i18n formatting", "013iha29f-oio.js": "Radix Themes + marked", "1mx1wqpmp9sa6.js": "Radix UI primitives", "1_9_o3iok6nqq.js": "Radix popper/tooltip", "3kmzblaysritu.js": "message actions/sender icon", "43nigtyu141-5.js": "Radix collection/menus", "242x7dx0zu3hf.js": "react" };
for (const [k, agg] of Object.entries(res)) { console.log(k); for (const [c, v] of Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${v.toFixed(0).padStart(5)} ms  ${c} ${label[c] ? "(" + label[c] + ")" : ""}`); }
writeFileSync("/tmp/spike-switch-e2e/results/cpu-profile-by-chunk.json", JSON.stringify({ labels: label, perSwitchMs: res }, null, 1));
