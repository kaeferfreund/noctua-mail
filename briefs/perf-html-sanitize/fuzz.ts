// Randomized differential: today's sanitizeHtmlForDisplay (both modes) vs the
// prototype pair variants. Usage: bun fuzz.ts <cases> <seed> <out.json>
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sanitizeHtmlForDisplay } from "/home/monkey/code/noctua-mail/wt-spike-html-sanitize/lib/html/sanitize.ts";
import { stripConditionalComments } from "/home/monkey/code/noctua-mail/wt-spike-html-sanitize/lib/html/strip.ts";
import { pairSharedCss, pairSharedNormalize, pairSkipAllow } from "./proto/sanitizeProto.ts";

const [casesArg, seedArg, outPath] = process.argv.slice(2);
let seed = Number(seedArg ?? 7);
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];

const urls = [
  "https://t.example.test/p.gif", "http://x.example.test/a.png", "//cdn.example.test/x.png", "cid:logo", "CID:Logo",
  "data:image/png;base64,iVBORw0KGgo=", "data:text/html,<script>alert(1)</script>", "javascript:alert(1)", " javascript:alert(1)",
  "jav&#x09;ascript:alert(1)", "/api/accounts/a/messages/m/attachments/x", "/api/accounts/a/messages/m/attachments/x?y=1",
  "/api/accounts/a/messages/m/../../evil", "blob:https://x/y", "", " ", "relative.png", "\\\\evil.example.test\\a.png",
  "data:image/svg+xml,<svg onload=alert(1)>", "https://a.example.test/a.png#frag", "HTTPS://A.EXAMPLE.TEST/Q"
];
const srcsets = () => Array.from({ length: 1 + Math.floor(rand() * 3) }, () => `${pick(urls)} ${pick(["1x", "2x", "100w", ""])}`).join(pick([", ", ",", " ,"]));
const css = [
  "color:red", "background:url(https://t.example.test/b.png)", "background:url('cid:x')", "background-image:url(\"data:image/png;base64,AA\")",
  "behavior:url(#default#VML)", "width:expression(alert(1))", "b\\61 ckground:url(//x)", "font:12px/1 Arial", "background:image-set('x' 1x)",
  "content:'\\'", "padding:0!important", "/* c */ color:blue", "mso-line-height-rule:exactly", "x:url(/api/accounts/a/messages/m/attachments/x)",
  "@import url(//x);", "}</style><img src=x onerror=alert(1)>", "color:red;;", "list-style:url(https://x)"
];
const cssText = () => Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pick(css)).join(";");
const sheet = () => pick([
  `p{${cssText()}}`, `@import url(https://x/y.css); p{color:red}`, `@media (max-width:600px){.a{${cssText()}}}`,
  `@font-face{font-family:x;src:url(https://f/x.woff)}`, `@charset "utf-8"; a{color:red}`, `.a{${cssText()}}</style><script>alert(1)</script><style>`,
  `@-webkit-keyframes k{from{${cssText()}}}`, `@page{margin:1cm}`, `<!-- p{color:red} -->`
]);
const attr = (): string => pick([
  () => ` src="${pick(urls)}"`, () => ` srcset="${srcsets()}"`, () => ` style="${cssText().replace(/"/g, "&quot;")}"`,
  () => ` style='${cssText().replace(/'/g, "&#39;")}'`, () => ` data-remote-src="${pick(urls)}"`, () => ` data-remote-srcset="${srcsets()}"`,
  () => ` href="${pick(urls)}"`, () => ` onerror="alert(1)"`, () => ` http-equiv="refresh"`, () => ` name="referrer" content="unsafe-url"`,
  () => ` referrerpolicy="unsafe-url"`, () => ` class="a b"`, () => ` width="1" height="1"`, () => ` background="${pick(urls)}"`,
  () => ` SRC=${pick(urls).replace(/\s/g, "")}`, () => ` xmlns="http://www.w3.org/1999/xhtml"`
])();
const tags = ["img", "img", "img", "source", "picture", "a", "p", "div", "span", "table", "td", "tr", "noscript", "template", "svg", "math", "style",
  "script", "iframe", "object", "meta", "title", "textarea", "select", "option", "font", "center", "body", "head", "html", "base", "link", "form", "image", "video"];
function node(depth: number): string {
  const r = rand();
  if (depth > 4 || r < 0.15) return pick(["text", "&lt;b&gt;", "<!-- c -->", "<!--[if mso]><img src=https://o/x.png><![endif]-->", "<!--[if !mso]><!--><img src='https://o/y.png'><!--<![endif]-->", "<![CDATA[x]]>", "</td>", "<tr>", "<td>", "&amp;"]);
  const tag = pick(tags);
  const attrs = Array.from({ length: Math.floor(rand() * 4) }, attr).join("");
  if (tag === "style") return `<style>${sheet()}</style>`;
  if (tag === "img" || tag === "source" || tag === "meta" || tag === "base" || tag === "link") return `<${tag}${attrs}${rand() < 0.2 ? "/" : ""}>`;
  const kids = Array.from({ length: Math.floor(rand() * 4) }, () => node(depth + 1)).join("");
  return `<${tag}${attrs}>${kids}${rand() < 0.85 ? `</${tag}>` : ""}`;
}
const doc = () => (rand() < 0.3 ? "<!doctype html><html><head>" + (rand() < 0.5 ? `<style>${sheet()}</style>` : "") + "</head><body>" : "") +
  Array.from({ length: 1 + Math.floor(rand() * 6) }, () => node(0)).join("");

const N = Number(casesArg ?? 3000);
const res = { cases: N, seed: Number(seedArg ?? 7), mismatches: [] as { variant: string; input: string }[], remoteCases: 0, identicalButRewritten: 0, hash: "" };
const h = createHash("sha256");
for (let i = 0; i < N; i++) {
  const raw = doc();
  for (const input of [raw, stripConditionalComments(raw)]) {
    const block = sanitizeHtmlForDisplay(input), allow = sanitizeHtmlForDisplay(input, "allow");
    h.update(block).update("\0").update(allow).update("\0");
    if (block !== allow) res.remoteCases++;
    for (const [name, fn] of [["A", pairSharedNormalize], ["B", pairSharedCss], ["C", pairSkipAllow]] as const) {
      const got = fn(input);
      if (got.block !== block || got.allow !== allow) res.mismatches.push({ variant: name, input });
    }
  }
}
res.hash = h.digest("hex");
writeFileSync(outPath, JSON.stringify(res, null, 2));
console.log(JSON.stringify({ ...res, mismatches: res.mismatches.length }));
