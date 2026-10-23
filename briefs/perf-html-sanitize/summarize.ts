import { readFileSync, writeFileSync } from "node:fs";
const lines: string[] = [];
for (const f of ["results-bun.json", "results-node.json"]) {
  const r = JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8"));
  lines.push(`\n### ${r.runtime} — median of ${r.runs} warm runs (${r.warmup} warmup), ms\n`);
  lines.push("| item | KB | style attrs (uniq) | remote rewrites | stripCC | normalize | sanitize-html core (1 pass) | privateCss (1 pass) | block | allow | **today pair** | A shared-normalize | B +css memo | **C +skip allow** | saving today→C | buildPreviewDocument | open today | open with C | load start→end |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const x of r.results) {
    const p = (k: string) => x.passes[k].median as number;
    const open = 2 * p("stripConditionalComments") + p("shouldShowHtmlViewerFrame") + p("buildPreviewDocument");
    const f2 = (n: number) => n.toFixed(2);
    lines.push(`| ${x.name} | ${(x.bytes / 1024).toFixed(0)} | ${x.styleAttrs} (${x.uniqueStyleAttrs}) | ${x.remoteRewrites} | ${f2(p("stripConditionalComments"))} | ${f2(p("normalizeHtmlStructure"))} | ${f2(p("sanitizeHtmlCore_block_noCss"))} | ${f2(p("privateCss_all_calls_one_pass"))} | ${f2(p("sanitizeHtmlForDisplay_block"))} | ${f2(p("sanitizeHtmlForDisplay_allow"))} | **${f2(p("today_pair"))}** | ${f2(p("A_sharedNormalize_pair"))} | ${f2(p("B_sharedCss_pair"))} | **${f2(p("C_skipAllow_pair"))}** | ${f2(p("today_pair") - p("C_skipAllow_pair"))} (${Math.round(100 * (1 - p("C_skipAllow_pair") / p("today_pair")))} %) | ${f2(p("buildPreviewDocument"))} | ${f2(open + p("today_pair"))} | ${f2(open + p("C_skipAllow_pair"))} | ${x.loadAtStart.toFixed(1)}→${x.loadAtEnd.toFixed(1)} |`);
  }
  lines.push(`\nDifferential (${r.runtime}): ${r.diff.inputs} inputs, mismatches ${r.diff.mismatches.length}, hasRemoteContent mismatches ${r.diff.hasRemoteMismatch.length}, allow pass skipped for ${r.diff.skipAllowTaken}, inputs with remote content ${r.diff.remoteInputs}.`);
}
writeFileSync(new URL("summary.md", import.meta.url), lines.join("\n") + "\n");
console.log(lines.join("\n"));
