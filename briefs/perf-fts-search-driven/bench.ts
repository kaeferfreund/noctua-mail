import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
const root = "/home/monkey/code/noctua-mail/wt-perf-fts-search";
process.env.NOCTUA_DATA_DIR = root + "/.tmp/fts-search/bench-data";
process.env.IMAP_SECRET_KEY = "synthetic-perf-fts-search-key-0123456789";
process.env.IMAP_CREDENTIALS_STORAGE = "db";
const { getDb, getAccountDb, closeAllDbConnections } = await import(root + "/lib/db/connection.ts");
const { migrateAuthSchema, noctuaAuthOptions } = await import(root + "/lib/betterAuth.ts");
const { installAuthControlPlane } = await import(root + "/lib/db/authPolicy.ts");
const { listThreads, listMessages } = await import(root + "/lib/db/messages/query.ts");
const { recomputeThreadsForAccountInternal } = await import(root + "/lib/db/threads.ts");
const master: any = await getDb();
await migrateAuthSchema(noctuaAuthOptions({ database: master, baseURL: "http://localhost:3000", secret: "synthetic-perf-fts-search-secret-0123456789" }));
installAuthControlPlane(master);
master.prepare(`INSERT INTO auth_user(id,name,email,emailVerified,createdAt,updatedAt,role,twoFactorEnabled) VALUES('u0','Synthetic','u0@example.test',1,?,?,'user',1)`).run(new Date().toISOString(), new Date().toISOString());
master.prepare(`INSERT INTO accounts(id,name,email,avatar,ownerUserId,imapHost,imapPort,imapSecure,imapUser,imapPassword,smtpHost,smtpPort,smtpSecure,smtpUser,smtpPassword) VALUES('a0','Synthetic','a0@example.test','','u0','example.invalid',993,1,'a0@example.test','','example.invalid',465,1,'a0@example.test','')`).run();
const db: any = await getAccountDb("a0");
const body = "Synthetic body alpha beta gamma delta. ".repeat(100);
const insert = db.prepare(`INSERT INTO messages(id,accountId,folderId,threadId,messageId,subject,fromAddr,toAddr,preview,date,dateValue,body,htmlBody,unread,flagged,deliveredTo,originalTo) VALUES(?,'a0','a0:INBOX',?,?,?,?,?,'Synthetic preview',?,?,?, ?,?,?,'[]','[]')`);
const ftsAlloc = db.prepare(`INSERT INTO message_fts_identity(accountId,messageId) VALUES('a0',?) RETURNING ftsRowid`);
const ftsIns = db.prepare(`INSERT INTO message_fts_v3(rowid,accountId,messageId,subject,fromAddr,toAddr,ccAddr,bccAddr,body,preview) VALUES(?,'a0',?,?,'sender@example.test','a0@example.test','','',?,'Synthetic preview')`);
const attIns = db.prepare(`INSERT INTO attachments(accountId,id,messageId,filename,contentType,size,inline) VALUES('a0',?,?,?,'application/pdf',2048,0)`);
db.transaction(() => {
  db.prepare(`INSERT INTO folders(id,name,accountId,specialUse) VALUES('a0:INBOX','Inbox','a0','\\Inbox')`).run();
  for (let i = 0; i < 11000; i++) {
    const id = "m" + i;
    const subject = "Synthetic " + (i % 400 === 0 ? "needle" : "normal") + " " + i;
    insert.run(id, "t" + Math.floor(i / 3), "<" + id + "@example.test>", subject, "sender@example.test", "a0@example.test", new Date(1790000000000 + i * 1000).toISOString(), 1790000000000 + i * 1000, body, "<p>" + body + "</p>", i % 3 === 0 ? 1 : 0, i % 17 === 0 ? 1 : 0);
    const r: any = ftsAlloc.get(id);
    ftsIns.run(r.ftsRowid, id, subject, body);
    if (i % 500 === 0) attIns.run("att" + i, id, "invoice-" + i + ".pdf");
  }
})();
await recomputeThreadsForAccountInternal("a0");

let captured: any[] = [];
let capturing = false;
for (const d of [master, db]) {
  const orig = d.prepare.bind(d);
  d.prepare = (sql: string) => {
    const st = orig(sql);
    if (capturing) captured.push({ sql, db: d === db ? "shard" : "master" });
    return new Proxy(st, { get(target, key) { const val = Reflect.get(target, key); if (["get", "all", "run"].includes(String(key))) return (...args: any[]) => { if (capturing) { const row = captured.findLast((x: any) => x.sql === sql && x.args === undefined); if (row) row.args = args; } return val.apply(target, args); }; return typeof val === "function" ? val.bind(target) : val; } });
  };
}
const out: any = { loadStart: loadavg(), timings: [], plans: [], equality: {} };
async function measure(label: string, legacy: boolean, fn: () => any, reps = 7) {
  if (legacy) process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1"; else delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
  try {
    await fn();
    const samples: number[] = [];
    let result: any;
    for (let i = 0; i < reps; i++) {
      const t0 = performance.now();
      result = await fn();
      samples.push(performance.now() - t0);
    }
    const sorted = [...samples].sort((a, b) => a - b);
    out.timings.push({ label, legacy, ms: sorted[Math.floor(reps / 2)], min: sorted[0], max: sorted.at(-1), samples, jsonBytes: Buffer.byteLength(JSON.stringify(result)), load: loadavg() });
    return result;
  } finally { delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH; }
}
async function capture(label: string, legacy: boolean, fn: () => any) {
  if (legacy) process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1"; else delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
  captured = []; capturing = true;
  try { await fn(); } finally { capturing = false; delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH; }
  const seen = new Set<string>();
  for (const q of captured) {
    if (q.args === undefined || q.db !== "shard") continue;
    const key = q.sql.replace(/\?/g, "?").slice(0, 4000);
    if (seen.has(key)) continue;
    seen.add(key);
    try { out.plans.push({ label, legacy, sql: q.sql, args: q.args, plan: db.prepare("EXPLAIN QUERY PLAN " + q.sql).all(...q.args).map((r: any) => r.detail) }); }
    catch (e) { out.plans.push({ label, legacy, sql: q.sql, error: String(e) }); }
  }
}

const cases: Array<[string, () => any]> = [
  ["listThreads search needle 300", () => listThreads({ accountId: "a0", page: 1, pageSize: 300, query: "needle" })],
  ["listThreads search needle+gamma 300", () => listThreads({ accountId: "a0", page: 1, pageSize: 300, query: "needle gamma" })],
  ["listThreads search invoice (attachment) 300", () => listThreads({ accountId: "a0", page: 1, pageSize: 300, query: "invoice" })],
  ["listThreads search synthetic (unselective fallback) 300", () => listThreads({ accountId: "a0", page: 1, pageSize: 300, query: "synthetic" })],
  ["listThreads from: only 300", () => listThreads({ accountId: "a0", page: 1, pageSize: 300, query: "from:sender" })],
  ["listMessages search needle 300", () => listMessages({ accountId: "a0", page: 1, pageSize: 300, query: "needle" })],
  ["listThreads default 300", () => listThreads({ accountId: "a0", page: 1, pageSize: 300 })]
];
for (const [label, fn] of cases) {
  // Interleaved paired reps: legacy always warming caches for driven would
  // bias the medians, so alternate modes per repetition.
  const runs: Record<string, { samples: number[]; result: any }> = { legacy: { samples: [], result: undefined }, driven: { samples: [], result: undefined } };
  for (const legacyMode of [true, false]) {
    if (legacyMode) process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1"; else delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
    await fn();
  }
  delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
  for (let rep = 0; rep < 9; rep++) {
    for (const legacyMode of rep % 2 === 0 ? [true, false] : [false, true]) {
      if (legacyMode) process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1"; else delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
      const t0 = performance.now();
      const result = await fn();
      const bucket = legacyMode ? runs.legacy : runs.driven;
      bucket.samples.push(performance.now() - t0);
      bucket.result = result;
    }
  }
  delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
  for (const legacyMode of [true, false]) {
    const bucket = legacyMode ? runs.legacy : runs.driven;
    const sorted = [...bucket.samples].sort((a, b) => a - b);
    out.timings.push({ label, legacy: legacyMode, ms: sorted[Math.floor(sorted.length / 2)], min: sorted[0], max: sorted.at(-1), samples: bucket.samples, jsonBytes: Buffer.byteLength(JSON.stringify(bucket.result)), load: loadavg() });
  }
  out.equality[label] = JSON.stringify(runs.legacy.result) === JSON.stringify(runs.driven.result);
}
await capture("listThreads needle", true, () => listThreads({ accountId: "a0", page: 1, pageSize: 300, query: "needle" }));
await capture("listThreads needle", false, () => listThreads({ accountId: "a0", page: 1, pageSize: 300, query: "needle" }));
await capture("listMessages needle", true, () => listMessages({ accountId: "a0", page: 1, pageSize: 300, query: "needle" }));
await capture("listMessages needle", false, () => listMessages({ accountId: "a0", page: 1, pageSize: 300, query: "needle" }));
await capture("listThreads from: only", true, () => listThreads({ accountId: "a0", page: 1, pageSize: 300, query: "from:sender" }));
await capture("listThreads from: only", false, () => listThreads({ accountId: "a0", page: 1, pageSize: 300, query: "from:sender" }));

// Raw comparisons from the rerank harness, unchanged shapes.
const scan = `SELECT m.id FROM messages m WHERE m.accountId=? AND ((m.accountId,m.id) IN (SELECT accountId,messageId FROM message_fts_v3 WHERE message_fts_v3 MATCH ?) OR lower(m.messageId) LIKE ? OR lower(m.threadId) LIKE ? OR lower(m.id) LIKE ?) ORDER BY m.dateValue DESC LIMIT 50`;
const driven = `SELECT m.id FROM message_fts_v3 f JOIN messages m ON m.accountId=f.accountId AND m.id=f.messageId WHERE message_fts_v3 MATCH ? AND f.accountId=? ORDER BY m.dateValue DESC LIMIT 50`;
async function rawMeasure(label: string, fn: () => any) {
  fn();
  const samples: number[] = [];
  let result: any;
  for (let i = 0; i < 7; i++) { const t0 = performance.now(); result = fn(); samples.push(performance.now() - t0); }
  samples.sort((a, b) => a - b);
  out.timings.push({ label, ms: samples[3], min: samples[0], max: samples.at(-1) });
  return result;
}
const a = await rawMeasure("raw FTS OR-scan", () => db.prepare(scan).all("a0", "needle*", "%needle%", "%needle%", "%needle%"));
const b = await rawMeasure("raw FTS driven", () => db.prepare(driven).all("needle*", "a0"));
out.rawSameIds = JSON.stringify(a) === JSON.stringify(b);
out.loadEnd = loadavg();
out.sqlite = db.prepare("select sqlite_version() v").get();
writeFileSync(root + "/.tmp/fts-search/bench-results.json", JSON.stringify(out, null, 2));
closeAllDbConnections();
console.log(JSON.stringify({ timings: out.timings, equality: out.equality, rawSameIds: out.rawSameIds }, null, 2));
