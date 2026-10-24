import { readFileSync } from "node:fs";
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const xml = readFileSync(process.argv[2], "utf8");
for (const name of [`special <tag> & "double" 'single' [x] (y) $z ^a* +b? {c} |d \\e`, `special failing <b> & "q" 'a'`])
  console.log(JSON.stringify(name), "matches self-closing pass marker:", new RegExp(`<testcase name="${escapeRegExp(escapeXml(name))}"[^>]*/>`).test(xml));
