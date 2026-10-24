// Aggregates Spike A raw results into markdown tables. Usage: node analyze.mjs <results-dir> > analysis.md
import { readFileSync, readdirSync } from "node:fs";
const dir = process.argv[2] ?? "/tmp/spike-switch-e2e/results";
const files = readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("prime") && !f.startsWith("trace"));
const q = (a, p) => { a = a.filter(v => v != null && !Number.isNaN(v)); if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p / 100 * s.length) - 1))]; };
const med = a => { a = a.filter(v => v != null); if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f0 = v => v == null ? "–" : Math.round(v).toString();
const tmpl = u => u.replace(/\{acct:[a-z]+\}/g, "{acct}").replace(/\?.*$/, "");
const out = [];
const P = s => out.push(s);

for (const file of files.sort()) {
  const res = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
  P(`\n## Series \`${res.series}\` (${res.mode}${res.secondTab ? ", second tab" : ""})\n`);
  P(`- started ${res.startedAt}; uptime before: \`${res.uptimeBefore}\`; after: \`${res.uptimeAfter}\``);
  const groups = {};
  for (const r of res.runs) (groups[`${r.mode} ${r.from}→${r.to}`] ??= []).push(r);
  P(`\n| group | n | highlight p50/p90 | folders p50/p90 | first rows p50/p90 | settled p50/p90 | reqs p50 | long tasks p50 (count / ms) | timeouts |`);
  P(`|---|---|---|---|---|---|---|---|---|`);
  for (const [k, rs] of Object.entries(groups)) {
    const m = key => rs.map(r => r.marks[key]);
    P(`| ${k} | ${rs.length} | ${f0(q(m("highlight"), 50))} / ${f0(q(m("highlight"), 90))} | ${f0(q(m("folders"), 50))} / ${f0(q(m("folders"), 90))} | **${f0(q(m("firstRows"), 50))}** / ${f0(q(m("firstRows"), 90))} | **${f0(q(rs.map(r => r.settledMs), 50))}** / ${f0(q(rs.map(r => r.settledMs), 90))} | ${f0(med(rs.map(r => r.requests.length)))} | ${f0(med(rs.map(r => r.longTasks.count)))} / ${f0(med(rs.map(r => r.longTasks.totalMs)))} | ${rs.filter(r => r.timedOut).length} |`);
  }
  // Per-request table per group (template-level), only for warm/cold groups.
  for (const [k, rs] of Object.entries(groups)) {
    if (k.startsWith("warm-first")) continue;
    const byT = {};
    for (const r of rs) {
      const seen = {};
      for (const x of r.requests) {
        const t = `${x.method} ${tmpl(x.url)}${x.oldAccount ? " [OLD acct]" : ""}`;
        const e = (byT[t] ??= { n: [], start: [], ttfb: [], dur: [], stall: [], bytes: [], status: new Set(), stream: x.stream });
        seen[t] = (seen[t] ?? 0) + 1;
        e.start.push(x.startMs); e.ttfb.push(x.ttfbMs); e.dur.push(x.durMs); e.stall.push(x.stallMs); e.bytes.push(x.bytes); if (x.status != null) e.status.add(x.status);
      }
      for (const t of Object.keys(byT)) byT[t].n.push(seen[t] ?? 0);
    }
    P(`\n### Requests per switch — ${k} (n=${rs.length}; medians; offsets from click in ms)\n`);
    P(`| request | per switch | start | stall/queue | TTFB | total | bytes | status |`);
    P(`|---|---|---|---|---|---|---|---|`);
    for (const [t, e] of Object.entries(byT).sort((a, b) => med(a[1].start) - med(b[1].start))) {
      P(`| \`${t}\`${e.stream ? " (SSE)" : ""} | ${med(e.n)} | ${f0(med(e.start))} | ${f0(med(e.stall))} | ${f0(med(e.ttfb))} | ${e.stream ? "stream" : f0(med(e.dur))} | ${f0(med(e.bytes))} | ${[...e.status].join(",")} |`);
    }
    // exact duplicates
    const dups = {};
    for (const r of rs) {
      const c = {};
      for (const x of r.requests) if (!x.stream) { const key = `${x.method} ${x.urlKey ?? x.url}`; c[key] = (c[key] ?? 0) + 1; }
      for (const [key, n] of Object.entries(c)) if (n > 1) (dups[key] ??= []).push(n);
    }
    if (Object.keys(dups).length) {
      P(`\nExact-URL duplicates within one switch (runs affected / median count):`);
      for (const [key, ns] of Object.entries(dups)) P(`- \`${key.slice(0, 160)}\` — ${ns.length}/${rs.length} runs, ×${med(ns)}`);
    }
    // critical path segments
    const seg = name => rs.map(r => {
      const pick = (re, i = 0) => r.requests.filter(x => re.test(x.url) && !x.oldAccount)[i];
      return { r, sw: pick(/switch-account/), me: pick(/\/api\/auth\/me$/), fo: pick(/\/folders$/), th: pick(/\/threads/), co: pick(/\/consistency$/), st: r.requests.find(x => /imap\/stream/.test(x.url) && !x.oldAccount) };
    });
    const cp = seg();
    const s = (f) => f0(med(cp.map(f)));
    P(`\nCritical path (medians, ms from click): switch-account ${s(c => c.sw?.startMs)}→${s(c => c.sw?.endMs)} · /auth/me ${s(c => c.me?.startMs)}→${s(c => c.me?.endMs)} · folders ${s(c => c.fo?.startMs)}→${s(c => c.fo?.endMs)} · threads ${s(c => c.th?.startMs)}→${s(c => c.th?.endMs)} (consistency ${s(c => c.co?.startMs)}→${s(c => c.co?.endMs)}) · first rows ${s(c => c.r.marks.firstRows)} · imap/stream open ${s(c => c.st?.startMs)} · settled ${s(c => c.r.settledMs)}`);
    const old = rs.map(r => r.requests.filter(x => x.oldAccount));
    P(`Old-account requests after click: median ${med(old.map(o => o.length))} per switch; templates: ${[...new Set(old.flat().map(x => `${x.method} ${tmpl(x.url)}`))].join(", ") || "none"}; median old bytes ${f0(med(old.map(o => o.reduce((a, b) => a + (b.bytes ?? 0), 0))))}`);
    P(`Stream (re)opens per switch: /api/me/events ${med(rs.map(r => r.requests.filter(x => /\/api\/me\/events/.test(x.url)).length))}, imap/stream ${med(rs.map(r => r.requests.filter(x => /imap\/stream/.test(x.url)).length))}; non-200 statuses: ${JSON.stringify(rs.flatMap(r => r.requests.filter(x => x.status && x.status !== 200).map(x => `${x.status} ${tmpl(x.url)}`)))}`);
    P(`Long tasks: median count ${f0(med(rs.map(r => r.longTasks.count)))}, median total ${f0(med(rs.map(r => r.longTasks.totalMs)))} ms, median max ${f0(med(rs.map(r => r.longTasks.maxMs)))} ms; long-task ms before first rows: ${f0(med(rs.map(r => r.longTasks.list.filter(l => l.start < (r.marks.firstRows ?? 0)).reduce((a, b) => a + Math.min(b.dur, (r.marks.firstRows ?? 0) - b.start), 0))))}; DOM mutation records ${f0(med(rs.map(r => r.mutations.records)))} in ${f0(med(rs.map(r => r.mutations.frames16ms)))} frames`);
  }
  if (res.secondTab && typeof res.secondTab === "object") P(`\nSecond tab requests during series: ${JSON.stringify(res.secondTab)}`);
}
console.log(out.join("\n"));
