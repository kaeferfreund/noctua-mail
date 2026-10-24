// QA-208 bench: cost of German spelling variants. Same 11k synthetic shard
// as briefs/perf-fts-search-driven/bench.ts plus German subject words; the
// pre-change query module (5c5b605, copied next to query.ts as
// zz-bench-query-before.ts) and the new one run interleaved on the same
// connection. Run from the worktree:
//   git show 5c5b605:lib/db/messages/query.ts > lib/db/messages/zz-bench-query-before.ts
//   cp <this file> .tmp/german-bench/bench.ts
//   nice -n 10 bun --tsconfig-override tsconfig.json .tmp/german-bench/bench.ts
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
const root = "/home/monkey/code/noctua-mail/wt-fix-fts-german-folding";
process.env.NOCTUA_DATA_DIR = root + "/.tmp/german-bench/data";
process.env.IMAP_SECRET_KEY = "synthetic-german-bench-key-0123456789";
process.env.IMAP_CREDENTIALS_STORAGE = "db";
const { getDb, getAccountDb, closeAllDbConnections } = await import(root + "/lib/db/connection.ts");
const { migrateAuthSchema, noctuaAuthOptions } = await import(root + "/lib/betterAuth.ts");
const { installAuthControlPlane } = await import(root + "/lib/db/authPolicy.ts");
const after = await import(root + "/lib/db/messages/query.ts");
const before = await import(root + "/lib/db/messages/zz-bench-query-before.ts");
const { recomputeThreadsForAccountInternal } = await import(root + "/lib/db/threads.ts");
const master: any = await getDb();
await migrateAuthSchema(noctuaAuthOptions({ database: master, baseURL: "http://localhost:3000", secret: "synthetic-german-bench-secret-0123456789" }));
installAuthControlPlane(master);
master.prepare(`INSERT INTO auth_user(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES('u0','Synthetic','u0@example.test',1,?,?,'user',1)`).run(new Date().toISOString(), new Date().toISOString());
master.prepare(`INSERT INTO accounts(id,name,email,avatar,ownerUserId,imapHost,imapPort,imapSecure,imapUser,imapPassword,smtpHost,smtpPort,smtpSecure,smtpUser,smtpPassword) VALUES('a0','Synthetic','a0@example.test','','u0','example.invalid',993,1,'a0@example.test','','example.invalid',465,1,'a0@example.test','')`).run();
const db: any = await getAccountDb("a0");
// Every body ends in "Viele Grüße": an unselective German token (fallback path).
const body = "Synthetic body alpha beta gamma delta. ".repeat(100) + "Viele Grüße.";
const insert = db.prepare(`INSERT INTO messages(id,accountId,folderId,threadId,messageId,subject,fromAddr,toAddr,preview,date,dateValue,body,htmlBody,unread,flagged,deliveredTo,originalTo) VALUES(?,'a0','a0:INBOX',?,?,?,?,?,'Synthetic preview',?,?,?, ?,?,?,'[]','[]')`);
const ftsAlloc = db.prepare(`INSERT INTO message_fts_identity(accountId,messageId) VALUES('a0',?) RETURNING ftsRowid`);
const ftsIns = db.prepare(`INSERT INTO message_fts_v3(rowid,accountId,messageId,subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview) VALUES(?,'a0',?,?,'sender@example.test','a0@example.test','','',?,'Synthetic preview')`);
const attIns = db.prepare(`INSERT INTO attachments(accountId,id,messageId,filename,contentType,size,inline) VALUES('a0',?,?,?,'application/pdf',2048,0)`);
const word = (i: number) =>
  i % 400 === 0 ? "needle" : i % 397 === 0 ? "Straße" : i % 401 === 0 ? "Strasse" : i % 409 === 0 ? "Übermaß" : i % 419 === 0 ? "uebermass" : "normal";
db.transaction(() => {
  db.prepare(`INSERT INTO folders(id,name,accountId,specialUse) VALUES('a0:INBOX','Inbox','a0','\\Inbox')`).run();
  for (let i = 0; i < 11000; i++) {
    const id = "m" + i;
    const subject = "Synthetic " + word(i) + " " + i;
    insert.run(id, "t" + Math.floor(i / 3), "<" + id + "@example.test>", subject, "sender@example.test", "a0@example.test", new Date(1790000000000 + i * 1000).toISOString(), 1790000000000 + i * 1000, body, "<p>" + body + "</p>", i % 3 === 0 ? 1 : 0, i % 17 === 0 ? 1 : 0);
    const r: any = ftsAlloc.get(id);
    ftsIns.run(r.ftsRowid, id, subject, body);
    if (i % 500 === 0) attIns.run("att" + i, id, "invoice-" + i + ".pdf");
  }
})();
await recomputeThreadsForAccountInternal("a0");

const out: any = { loadStart: loadavg(), timings: [] };
const q = (query: string) => ({ accountId: "a0", page: 1, pageSize: 300, query });
const cases: Array<[string, "threads" | "messages", string, boolean?]> = [
  ["needle (control, no site)", "threads", "needle"],
  ["strasse (2 spellings)", "threads", "strasse"],
  ["Straße (2 spellings)", "threads", "Straße"],
  ["uebermass (4 spellings)", "threads", "uebermass"],
  ["Größenänderung (8 spellings, 0 hits)", "threads", "Größenänderung"],
  ["Fußgängerübergänge (4 corner spellings, 0 hits)", "threads", "Fußgängerübergänge"],
  ["strasse needle (two tokens)", "threads", "strasse needle"],
  ["grüße (11k hits, fallback)", "threads", "grüße"],
  ["listMessages strasse", "messages", "strasse"],
  ["legacy clause strasse (kill switch)", "threads", "strasse", true]
];
const silence = console.warn;
console.warn = () => {};
for (const [label, kind, query, legacy] of cases) {
  const run = (mod: any) => (kind === "threads" ? mod.listThreads(q(query)) : mod.listMessages(q(query)));
  if (legacy) process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1";
  const runs: Record<string, { samples: number[]; total?: number }> = { before: { samples: [] }, after: { samples: [] } };
  await run(before); await run(after);
  for (let rep = 0; rep < 9; rep++) {
    for (const name of rep % 2 === 0 ? ["before", "after"] : ["after", "before"]) {
      const t0 = performance.now();
      const result = await run(name === "before" ? before : after);
      runs[name].samples.push(performance.now() - t0);
      runs[name].total = result.total;
    }
  }
  delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
  const median = (s: number[]) => [...s].sort((a, b) => a - b)[Math.floor(s.length / 2)];
  out.timings.push({
    label,
    beforeMs: median(runs.before.samples), afterMs: median(runs.after.samples),
    beforeTotal: runs.before.total, afterTotal: runs.after.total,
    before: runs.before.samples, after: runs.after.samples, load: loadavg()
  });
}
console.warn = silence;

// Raw resolution MATCH, default 6 columns, 1/2/4/8 spellings of one token,
// in the per-pair shape `(col:s* OR ...)` and the column-filter shape
// `{cols} : (s* OR ...)` the new code emits for tokens with variants.
const cols = ["fromAddr", "toAddr", "ccAddr", "bccAddr", "subject", "body"];
const perPair = (spellings: string[]) => "(" + spellings.flatMap((s) => cols.map((c) => `${c}:${s}*`)).join(" OR ") + ")";
const columnFilter = (spellings: string[]) => `{${cols.join(" ")}} : (${spellings.map((s) => `${s}*`).join(" OR ")})`;
const raw = [
  ["1 spelling", ["strasse"]],
  ["2 spellings", ["strasse", "straße"]],
  ["4 spellings", ["uebermass", "übermass", "uebermaß", "übermaß"]],
  ["8 spellings", ["größenänderung", "groeßenänderung", "grössenänderung", "groessenänderung", "größenaenderung", "groeßenaenderung", "grössenaenderung", "groessenaenderung"]]
] as const;
const stmt = db.prepare(`SELECT messageId FROM message_fts_v3 WHERE message_fts_v3 MATCH ? AND accountId = ? LIMIT 2001`);
for (const [label, spellings] of raw) {
  for (const [shape, build] of [["per-pair", perPair], ["column filter", columnFilter]] as const) {
    const match = build([...spellings]);
    stmt.all(match, "a0");
    const samples: number[] = [];
    let rows = 0;
    for (let i = 0; i < 15; i++) { const t0 = performance.now(); rows = stmt.all(match, "a0").length; samples.push(performance.now() - t0); }
    samples.sort((a, b) => a - b);
    out.timings.push({ label: `raw MATCH ${label}, ${shape}`, ms: samples[7], min: samples[0], max: samples.at(-1), rows });
  }
}
out.loadEnd = loadavg();
out.sqlite = db.prepare("select sqlite_version() v").get();
writeFileSync(root + "/.tmp/german-bench/bench-results.json", JSON.stringify(out, null, 2));
closeAllDbConnections();
console.log(JSON.stringify(out.timings.map(({ before, after, ...rest }: any) => rest), null, 2));
