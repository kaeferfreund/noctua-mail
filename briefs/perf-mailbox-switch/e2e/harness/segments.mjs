// Critical-path segment medians per group: server (request) vs client (gap) time on the chain
// click → switch-account → /auth/me → folders → threads → first rows.
import { readFileSync } from "node:fs";
const med = a => { a = a.filter(v => v != null && !Number.isNaN(v)); if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = v => v == null ? "–" : Math.round(v);
console.log("| series | group | n | A click→switch done | B gap→me | C /auth/me | D gap me→folders | E folders | F gap folders→threads | G threads (server+dl) | H threads→first rows | first rows | highlight | old-acct threads bytes |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const file of process.argv.slice(2)) {
  const res = JSON.parse(readFileSync(file, "utf8"));
  const groups = {};
  for (const r of res.runs) (groups[`${r.mode} ${r.from}→${r.to}`] ??= []).push(r);
  for (const [k, rs] of Object.entries(groups)) {
    if (k.startsWith("warm-first")) continue;
    const seg = rs.map(r => {
      const p = re => r.requests.find(x => re.test(x.url) && !x.oldAccount);
      const sw = p(/switch-account/), me = p(/\/api\/auth\/me$/), fo = p(/\/folders$/), th = p(/\/threads/);
      const swEnd = sw.endMs ?? (sw.startMs + (sw.stallMs ?? 0) + sw.ttfbMs);
      const oldTh = r.requests.find(x => /\/threads/.test(x.url) && x.oldAccount);
      return { A: swEnd, B: me.startMs - swEnd, C: me.endMs - me.startMs, D: fo.startMs - me.endMs, E: fo.endMs - fo.startMs, F: th.startMs - fo.endMs, G: th.endMs - th.startMs, H: r.marks.firstRows - th.endMs, rows: r.marks.firstRows, hl: r.marks.highlight, ob: oldTh?.bytes };
    });
    const m = key => f(med(seg.map(s => s[key])));
    console.log(`| ${res.series} | ${k} | ${rs.length} | ${m("A")} | ${m("B")} | ${m("C")} | ${m("D")} | ${m("E")} | ${m("F")} | ${m("G")} | ${m("H")} | **${m("rows")}** | ${m("hl")} | ${m("ob")} |`);
  }
}
