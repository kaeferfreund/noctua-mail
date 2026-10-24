// One-off: golden hashes from the frozen 0ac6cfa reference, cross-checked with the spike's golden.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { sanitizeHtmlForDisplay } from "../lib/html/__fixtures__/sanitizeReference0ac6cfa";
import { sanitizeDifferentialInputs } from "../lib/html/__fixtures__/sanitizeDifferentialInputs";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const spike = JSON.parse(readFileSync("../briefs/perf-html-sanitize/golden-0ac6cfa.json", "utf8")).entries as { name: string; input: string; block: string; allow: string }[];
const entries = sanitizeDifferentialInputs().map(({ name, html }) => {
  const block = sanitizeHtmlForDisplay(html), allow = sanitizeHtmlForDisplay(html, "allow");
  return { name, input: sha(html), block: sha(block), allow: sha(allow), remoteContentBanner: block !== allow };
});
let checked = 0;
for (const s of spike) {
  const name = s.name.endsWith(".html") ? `corpus:${s.name.slice(0, -5)}` : s.name.replace("payload-", "payload:");
  const e = entries.find((x) => x.name === name);
  if (!e || e.input !== s.input || e.block !== s.block || e.allow !== s.allow) throw new Error(`spike golden mismatch ${s.name}`);
  checked++;
}
writeFileSync("lib/html/__fixtures__/sanitizeGolden0ac6cfa.json", JSON.stringify({
  commit: "0ac6cfa",
  note: "SHA-256 of sanitizeHtmlForDisplay(input, 'block'|'allow') at 0ac6cfa. remoteContentBanner = block !== allow (the reader's 'remote content blocked' banner). The 63 raw-corpus and payload entries were computed in a 0ac6cfa checkout (briefs/perf-html-sanitize/golden-0ac6cfa.json); the ':cleaned' corpus entries and edge:empty come from __fixtures__/sanitizeReference0ac6cfa.ts with the unchanged 0ac6cfa dependencies.",
  entries
}, null, 1) + "\n");
console.log(entries.length, "entries;", checked, "cross-checked against the spike golden;", entries.filter((e) => e.remoteContentBanner).length, "with banner");
