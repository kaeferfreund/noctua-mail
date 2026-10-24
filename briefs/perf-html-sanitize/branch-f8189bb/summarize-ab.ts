import { readFileSync } from "node:fs";
const load = (n: string) => JSON.parse(readFileSync(new URL(`results-${n}.json`, import.meta.url), "utf8"));
const [b1, a1, a2, b2] = ["base1", "after1", "after2", "base2"].map(load);
const med = (r: any, item: string, k: string) => r.results.find((x: any) => x.name === item).passes[k]?.median as number;
const f = (n: number) => n.toFixed(2);
const order = ["gmail-5k", "outlook-5k", "outlook-54k", "legacy-table-54k", "newsletter-120k", "newsletter-unique-120k", "outlook-300k", "newsletter-300k"];
console.log("| Item | KB | Before: pair at e70c30b (run 1 / 2) | After: shipped pair (run 1 / 2) | Saving (mean) | Same process: frozen 0ac6cfa pair → shipped pair | Open before → after |");
console.log("|---|---:|---:|---:|---:|---:|---|");
for (const item of order) {
  const x = b1.results.find((r: any) => r.name === item);
  const before = [med(b1, item, "today_pair"), med(b2, item, "today_pair")];
  const after = [med(a1, item, "shipped_pair"), med(a2, item, "shipped_pair")];
  const mb = (before[0] + before[1]) / 2, ma = (after[0] + after[1]) / 2;
  const ref = [med(a1, item, "reference0ac6cfa_pair"), med(a2, item, "reference0ac6cfa_pair")];
  const mr = (ref[0] + ref[1]) / 2;
  const openExtra = (r: any) => 2 * med(r, item, "stripConditionalComments") + med(r, item, "shouldShowHtmlViewerFrame") + med(r, item, "buildPreviewDocument");
  const ob = mb + (openExtra(b1) + openExtra(b2)) / 2, oa = ma + (openExtra(a1) + openExtra(a2)) / 2;
  console.log(`| ${item} | ${(x.bytes / 1024).toFixed(0)} | ${f(before[0])} / ${f(before[1])} | ${f(after[0])} / ${f(after[1])} | **${f(mb - ma)} ms (${Math.round(100 * (1 - ma / mb))} %)** | ${f(mr)} → ${f(ma)} (${Math.round(100 * (1 - ma / mr))} %) | ${f(ob)} → ${f(oa)} |`);
}
console.log("\nSingle-mode sanitizeHtmlForDisplay(block) (route/calendar path), mean of runs: before → after");
for (const item of order) {
  const sb = (med(b1, item, "sanitizeHtmlForDisplay_block") + med(b2, item, "sanitizeHtmlForDisplay_block")) / 2;
  const sa = (med(a1, item, "sanitizeHtmlForDisplay_block") + med(a2, item, "sanitizeHtmlForDisplay_block")) / 2;
  console.log(`| ${item} | ${f(sb)} → ${f(sa)} |`);
}
for (const [n, r] of [["base1", b1], ["after1", a1], ["after2", a2], ["base2", b2]] as const)
  console.log(n, r.at, "diff:", r.diff.inputs, "inputs", r.diff.mismatches.length, "mismatches", r.diff.skipAllowTaken, "skips", "load", r.results[0].loadAtStart.toFixed(1), "→", r.results.at(-1).loadAtEnd.toFixed(1));
