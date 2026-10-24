// Sanitize spike: differential check + per-pass timings.
// Usage (from the worktree, so tsconfig paths resolve):
//   bun /…/perf-html-sanitize/bench.ts <corpusDir> <capturedInputs.jsonl> <out.json> [runs]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadavg } from "node:os";
import { sanitizeHtmlForDisplay } from "/home/monkey/code/noctua-mail/wt-perf-html-sanitize/lib/html/sanitize.ts";
import { normalizeHtmlStructure } from "/home/monkey/code/noctua-mail/wt-perf-html-sanitize/lib/html/normalize.ts";
import { stripConditionalComments } from "/home/monkey/code/noctua-mail/wt-perf-html-sanitize/lib/html/strip.ts";
import { shouldShowHtmlViewerFrame } from "/home/monkey/code/noctua-mail/wt-perf-html-sanitize/lib/html/document.ts";
import { buildPreviewDocument } from "/home/monkey/code/noctua-mail/wt-perf-html-sanitize/app/components/HtmlMessage.tsx";
import {
  memoCss, pairSharedCss, pairSharedNormalize, pairSkipAllow, pairSkipAllowNoMemo,
  privateCss, sanitizeNoCss, sanitizeNormalized, sanitizeSingle, type Pair
} from "./proto/sanitizeProto.ts";

const [corpusDir, capturedPath, outPath, runsArg] = process.argv.slice(2);
// Branch-only additions: the shipped pair and the frozen 0ac6cfa reference, when present.
const shipped = (await import("/home/monkey/code/noctua-mail/wt-perf-html-sanitize/lib/html/sanitize.ts")) as { sanitizeHtmlForDisplayPair?: (input: string) => Pair };
const reference = await import("/home/monkey/code/noctua-mail/wt-perf-html-sanitize/lib/testFixtures/htmlSanitize/sanitizeReference0ac6cfa.ts").catch(() => null) as null | { sanitizeHtmlForDisplay: (input: string, mode?: "block" | "allow") => string };
const RUNS = Number(runsArg ?? 15);
const WARMUP = 3;
const runtime = typeof Bun !== "undefined" ? `bun ${Bun.version}` : `node ${process.version}`;

// ---------------------------------------------------------------- differential
const today = (input: string): Pair => ({ block: sanitizeHtmlForDisplay(input), allow: sanitizeHtmlForDisplay(input, "allow") });
const variants: Record<string, (input: string) => Pair> = {
  rebuiltSingle: (input) => ({ block: sanitizeSingle(input, "block"), allow: sanitizeSingle(input, "allow") }),
  A_sharedNormalize: pairSharedNormalize,
  B_sharedCss: pairSharedCss,
  C_skipAllow: pairSkipAllow
};
const corpus = readdirSync(corpusDir).filter((f) => f.endsWith(".html")).sort()
  .map((f) => ({ name: f.replace(/\.html$/, ""), html: readFileSync(join(corpusDir, f), "utf8") }));
const captured = [...new Set(readFileSync(capturedPath, "utf8").split("\n").filter(Boolean)
  .map((line) => (JSON.parse(line) as { input: string }).input))];
// Every corpus item is also checked after the client's stripConditionalComments.
const diffInputs = [
  ...corpus.flatMap((c) => [{ name: `corpus:${c.name}`, html: c.html }, { name: `corpus:${c.name}:cleaned`, html: stripConditionalComments(c.html) }]),
  ...captured.map((html, i) => ({ name: `test-payload:${i}`, html })),
  { name: "edge:empty", html: "" }
];
const diff = { inputs: diffInputs.length, mismatches: [] as string[], hasRemoteMismatch: [] as string[], skipAllowTaken: 0, remoteInputs: 0 };
for (const { name, html } of diffInputs) {
  const ref = today(html);
  const refHasRemote = ref.block !== ref.allow;
  if (refHasRemote) diff.remoteInputs++;
  for (const [vName, fn] of Object.entries(variants)) {
    const got = fn(html);
    if (got.block !== ref.block) diff.mismatches.push(`${vName} block ${name}`);
    if (got.allow !== ref.allow) diff.mismatches.push(`${vName} allow ${name}`);
    if ((got.block !== got.allow) !== refHasRemote) diff.hasRemoteMismatch.push(`${vName} ${name}`);
  }
  // Was the allow pass actually skipped by variant C?
  let rewrites = 0;
  if (html) sanitizeNormalized(normalizeHtmlStructure(html), "block", privateCss, () => { rewrites++; });
  if (!rewrites) diff.skipAllowTaken++;
}
console.log(JSON.stringify({ runtime, diff }, null, 1));

// ---------------------------------------------------------------- timings
type Stat = { median: number; p25: number; p75: number; min: number; max: number; runs: number };
function time(fn: () => unknown): Stat {
  for (let i = 0; i < WARMUP; i++) fn();
  const t: number[] = [];
  for (let i = 0; i < RUNS; i++) { const s = performance.now(); fn(); t.push(performance.now() - s); }
  t.sort((a, b) => a - b);
  const q = (p: number) => t[Math.min(t.length - 1, Math.floor(p * (t.length - 1) + 0.5))];
  const r = (x: number) => Math.round(x * 1000) / 1000;
  return { median: r(q(0.5)), p25: r(q(0.25)), p75: r(q(0.75)), min: r(t[0]), max: r(t.at(-1)!), runs: RUNS };
}

const results: Record<string, unknown>[] = [];
for (const { name, html } of corpus) {
  const cleaned = stripConditionalComments(html);
  const normalized = normalizeHtmlStructure(cleaned);
  const blocked = sanitizeHtmlForDisplay(cleaned);
  // CSS work per pass: how many style attributes / style blocks reach privateCss.
  const styleAttrs: string[] = [];
  const styleBlocks: string[] = [];
  sanitizeNormalized(normalized, "block", (s, inline) => { (inline ? styleAttrs : styleBlocks).push(s); return s; });
  const uniqueCss = new Set(styleAttrs).size;
  let rewrites = 0;
  sanitizeNormalized(normalized, "block", privateCss, () => { rewrites++; });
  const load = loadavg()[0];
  const passes: Record<string, Stat> = {
    stripConditionalComments: time(() => stripConditionalComments(html)),
    shouldShowHtmlViewerFrame: time(() => shouldShowHtmlViewerFrame(cleaned)),
    normalizeHtmlStructure: time(() => normalizeHtmlStructure(cleaned)),
    sanitizeHtmlCore_block_noCss: time(() => sanitizeNoCss(normalized, "block")),
    privateCss_all_calls_one_pass: time(() => { for (const s of styleAttrs) privateCss(s, true); for (const s of styleBlocks) privateCss(s); }),
    sanitizeHtmlForDisplay_block: time(() => sanitizeHtmlForDisplay(cleaned)),
    sanitizeHtmlForDisplay_allow: time(() => sanitizeHtmlForDisplay(cleaned, "allow")),
    today_pair: time(() => { sanitizeHtmlForDisplay(cleaned); sanitizeHtmlForDisplay(cleaned, "allow"); }),
    A_sharedNormalize_pair: time(() => pairSharedNormalize(cleaned)),
    B_sharedCss_pair: time(() => pairSharedCss(cleaned)),
    C_skipAllow_pair: time(() => pairSkipAllow(cleaned)),
    D_skipAllowNoMemo_pair: time(() => pairSkipAllowNoMemo(cleaned)),
    ...(shipped.sanitizeHtmlForDisplayPair ? { shipped_pair: time(() => shipped.sanitizeHtmlForDisplayPair!(cleaned)) } : {}),
    ...(reference ? { reference0ac6cfa_pair: time(() => { reference.sanitizeHtmlForDisplay(cleaned); reference.sanitizeHtmlForDisplay(cleaned, "allow"); }) } : {}),
    buildPreviewDocument: time(() => buildPreviewDocument({ html, safeHtml: blocked, darkMode: false, fontScale: 1, zoom: 1, showViewerFrame: false, hostViewportHeight: 900, remoteContent: "block", token: "bench" }))
  };
  const row = { name, bytes: html.length, styleAttrs: styleAttrs.length, uniqueStyleAttrs: uniqueCss, styleBlocks: styleBlocks.length, remoteRewrites: rewrites, loadAtStart: load, loadAtEnd: loadavg()[0], passes };
  results.push(row);
  console.log(name, html.length, Object.fromEntries(Object.entries(passes).map(([k, v]) => [k, v.median])));
}
// keep memoCss referenced for bundlers
void memoCss;
writeFileSync(outPath, JSON.stringify({ runtime, runs: RUNS, warmup: WARMUP, at: new Date().toISOString(), diff, results }, null, 2));
