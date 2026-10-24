/**
 * Spike A multi-mailbox synthetic IMAP fixture. Reuses the repo's dev-fixture server/store/message
 * builder unchanged; one IMAP listener per mailbox (the fixture server is single-user).
 * Ports 3921-3924 only. Synthetic example.test data only.
 * Contention mode: while /home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/e2e/inject.flag exists, every INJECT_MS one new INBOX
 * message is appended to every mailbox (EXISTS -> watcher/IDLE -> background sync).
 */
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import net from "node:net";
// LATENCY_MS (harness-only): delay every IMAP command completion / greeting / continuation by N ms per socket,
// preserving write order, to approximate one network round trip per command to a remote IMAP server.
const LATENCY_MS = Number(process.env.LATENCY_MS ?? 0);
if (LATENCY_MS > 0) {
  const origWrite = net.Socket.prototype.write;
  const completion = /^(\* OK \[CAPABILITY|[A-Za-z0-9.]+ (OK|NO|BAD) |\+ )/;
  net.Socket.prototype.write = function (this: any, data: any, ...rest: any[]) {
    const delay = typeof data === "string" && completion.test(data) ? LATENCY_MS : 0;
    this.__lat = (this.__lat ?? Promise.resolve()).then(() => delay ? new Promise(r => setTimeout(r, delay)) : undefined)
      .then(() => { if (!this.destroyed) origWrite.call(this, data, ...rest); });
    return true;
  } as any;
}
// SPIKE_UIDV (harness-only): reuse the UIDVALIDITY values the app already cached so a restart needs no resync.
const UIDV: Record<string, Record<string, number>> = process.env.SPIKE_UIDV ? JSON.parse(readFileSync(process.env.SPIKE_UIDV, "utf8")) : {};
const WT = "/home/monkey/code/noctua-mail/wt-perf-switch-2";
const { startImapServer } = await import(`${WT}/scripts/dev-fixture/imap-server.ts`);
const { MailStore } = await import(`${WT}/scripts/dev-fixture/store.ts`);
const { makeMessage } = await import(`${WT}/scripts/dev-fixture/seed.ts`);

type Spec = { key: string; port: number; inbox: number; sent: number; archive: number; extraFolders: number; perExtra: number };
export const MAILBOXES: Spec[] = [
  { key: "small", port: 3921, inbox: 40, sent: 10, archive: 0, extraFolders: 0, perExtra: 0 },
  { key: "medium", port: 3922, inbox: 1800, sent: 200, archive: 0, extraFolders: 0, perExtra: 0 },
  { key: "large", port: 3923, inbox: 9000, sent: 800, archive: 200, extraFolders: 0, perExtra: 0 },
  { key: "folders", port: 3924, inbox: 300, sent: 50, archive: 0, extraFolders: 40, perExtra: 25 },
];
const INJECT_FLAG = "/home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/e2e/inject.flag";
const INJECT_MS = Number(process.env.INJECT_MS ?? 10000);
const senders = ["Mira Beispiel", "Kai Muster", "Lena Probe", "Jonas Test", "Ina Demo", "Paul Platzhalter", "Rita Fiktiv", "Ole Synth"];
const topics = ["Terminanfrage", "Rechnung", "Rückfrage Befund", "Lieferung", "Angebot", "Urlaubsvertretung", "Laborauftrag", "Newsletter"];

function fill(store: InstanceType<typeof MailStore>, key: string, folder: string, count: number, now: number, sentFolder = false) {
  let thread = 0, inThread = 0, threadLen = 1;
  for (let n = 0; n < count; n++) {
    if (inThread >= threadLen) { thread++; inThread = 0; threadLen = 1 + ((thread * 7) % 4); }
    const s = senders[(thread + n) % senders.length];
    const addr = `${s.split(" ")[0].toLowerCase()}@example.test`;
    const root = `${key}-${folder.replace(/\W/g, "_")}-t${thread}`;
    const id = `${root}-m${inThread}`;
    const refs = Array.from({ length: inThread }, (_, i) => `${root}-m${i}`);
    // spread over ~2 years, newest last appended
    const date = new Date(now - (count - n) * Math.max(60_000, Math.floor(63_072_000_000 / Math.max(count, 1))));
    const subject = `${inThread ? "Re: " : ""}${topics[thread % topics.length]} ${key} #${String(thread).padStart(5, "0")}`;
    const source = makeMessage({ id, subject, date, references: refs,
      from: sentFolder ? `"Team ${key}" <${key}@example.test>` : `"${s}" <${addr}>`,
      to: sentFolder ? `"${s}" <${addr}>` : `"Team ${key}" <${key}@example.test>`,
      text: `Synthetische Nachricht ${n} im Ordner ${folder} (${key}).\n\nViele Grüße\n${s}\n\n[Synthetische Demo-Nachricht]`,
      kind: n % 97 === 0 ? "invoice" : undefined });
    const seen = sentFolder || n < count - Math.ceil(count * 0.05) ? ["\\Seen"] : [];
    store.append(folder, source, seen, date);
    inThread++;
  }
}

const servers: Array<{ key: string; port: number; stop(): Promise<void>; store: InstanceType<typeof MailStore> }> = [];
const now = Date.now();
const t0 = performance.now();
for (const spec of MAILBOXES) {
  const store = new MailStore(`spike-${spec.key}`, new Date(now), "/home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/e2e/fixture-uidvalidity.sqlite");
  store.boxes.clear();
  const origCreate = store.create.bind(store);
  store.create = (path: string, special?: string) => { const box = origCreate(path, special); const v = UIDV[spec.key]?.[path]; if (v) box.uidValidity = v; return box; };
  for (const [path, special] of [["INBOX"], ["Sent", "\\Sent"], ["Drafts", "\\Drafts"], ["Trash", "\\Trash"], ["Junk", "\\Junk"], ["Archive", "\\Archive"]] as const) store.create(path, special);
  fill(store, spec.key, "INBOX", spec.inbox, now);
  fill(store, spec.key, "Sent", spec.sent, now, true);
  if (spec.archive) fill(store, spec.key, "Archive", spec.archive, now - 63_072_000_000);
  for (let f = 0; f < spec.extraFolders; f++) {
    const parent = ["Projekte", "Kunden", "Lieferanten", "Intern"][f % 4];
    if (!store.boxes.has(parent)) store.create(parent);
    const path = `${parent}/${parent.slice(0, 1)}${String(f).padStart(2, "0")}`;
    store.create(path);
    fill(store, spec.key, path, spec.perExtra, now);
  }
  const user = `${spec.key}@example.test`;
  const server = await startImapServer({ host: "127.0.0.1", port: spec.port, user, pass: "synthetic-imap", store });
  servers.push({ key: spec.key, port: server.port, stop: server.stop, store });
  const total = [...store.boxes.values()].reduce((a, b) => a + b.messages.length, 0);
  console.log(`fixture ${spec.key}: 127.0.0.1:${server.port} user=${user} folders=${store.boxes.size} messages=${total}`);
}
console.log(`fixture ready in ${Math.round(performance.now() - t0)} ms pid=${process.pid}`);
writeFileSync("/home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/e2e/fixture.ready", String(process.pid));
let injected = 0;
setInterval(() => {
  if (!existsSync(INJECT_FLAG)) return;
  for (const s of servers) {
    s.store.append("INBOX", makeMessage({ id: `${s.key}-inject-${Date.now()}-${injected}`, subject: `Neue Anfrage ${s.key} #i${injected}`,
      from: '"Mira Beispiel" <mira@example.test>', to: `"Team" <${s.key}@example.test>`, text: "Synthetische Live-Nachricht." }), []);
  }
  injected++;
}, INJECT_MS);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, async () => { for (const s of servers) await s.stop(); process.exit(0); });
