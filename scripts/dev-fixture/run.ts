import { options } from "./cli";
import { startImapServer } from "./imap-server";
import { startSmtpSink } from "./smtp-sink";
const args = options();
const imap = await startImapServer({ host: args.host, port: Number(args.port ?? 3789), controlPort: Number(args["control-port"]), user: args.user, pass: args.pass, seed: args.seed, date: args.date ? new Date(args.date) : undefined });
let smtp: Awaited<ReturnType<typeof startSmtpSink>>;
try {
  smtp = await startSmtpSink({ host: args.host, port: Number(args["smtp-port"]), user: args.user, pass: args.pass, out: args.out, deliver: source => { imap.store.append("INBOX", source); } });
} catch (error) { await imap.stop(); throw error; }
console.log(`MonkeyDent synthetic fixture ready (seed=${args.seed}).\nSign up with email/user: ${args.user}\nPassword: ${args.pass}\nIMAP: ${args.host}:${imap.port}, security None\nSMTP: ${args.host}:${smtp.port}, security None\nControl: http://${args.host}:${imap.controlPort} (POST /inject, POST /reset, GET /status)\nTeam: Alex Beispiel and Toni Muster. All correspondence is synthetic.`);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, async () => { await smtp.stop(); await imap.stop(); process.exit(0); });
