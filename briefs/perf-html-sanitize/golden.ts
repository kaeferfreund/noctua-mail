// sha256 of today's sanitizeHtmlForDisplay output (0ac6cfa) per input and mode.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { sanitizeHtmlForDisplay } from "/home/monkey/code/noctua-mail/wt-spike-html-sanitize/lib/html/sanitize.ts";
const [corpusDir, captured, out] = process.argv.slice(2);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const inputs: [string, string][] = readdirSync(corpusDir).filter((f) => f.endsWith(".html")).sort().map((f) => [f, readFileSync(join(corpusDir, f), "utf8")]);
[...new Set(readFileSync(captured, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).input as string))].forEach((s, i) => inputs.push([`payload-${i}`, s]));
writeFileSync(out, JSON.stringify({ commit: "0ac6cfa", entries: inputs.map(([name, s]) => ({ name, input: sha(s), block: sha(sanitizeHtmlForDisplay(s)), allow: sha(sanitizeHtmlForDisplay(s, "allow")) })) }, null, 1));
console.log(inputs.length, "entries");
