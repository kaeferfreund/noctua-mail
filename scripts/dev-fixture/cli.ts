import { parseArgs } from "node:util";
export function options() {
  const { values } = parseArgs({ args: process.argv.slice(2), options: {
    host: { type: "string", default: "127.0.0.1" }, port: { type: "string" },
    "control-port": { type: "string", default: "3788" }, "smtp-port": { type: "string", default: "3787" },
    user: { type: "string", default: "demo@monkeydent.test" }, pass: { type: "string", default: "demo" },
    seed: { type: "string", default: "monkeydent" }, date: { type: "string" }, out: { type: "string" },
    "imap-control": { type: "string" }
  }, strict: true });
  return values;
}
