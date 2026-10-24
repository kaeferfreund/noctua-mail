// Fallback modes on copies of the 11k shard: dropped FTS table, corrupt FTS
// page, malformed MATCH (FTS5 keywords), SQLITE_BUSY, concurrent storm.
import { Database } from "bun:sqlite";
import { closeSync, openSync, writeSync } from "node:fs";
import { cloneData } from "./clone";
import { openOrSeed, WT } from "./seed";

const mode = process.argv[2];
const dataDir = cloneData("data-fb-" + mode);
const { info, getAccountDb } = await openOrSeed(dataDir);
const conn: any = await import(WT + "/lib/db/connection.ts");
const { listThreads, listMessages } = await import(WT + "/lib/db/messages/query.ts");
let shard: any = await getAccountDb(info.aId);
const shardPath = (shard as any).filename as string;

const lines: any[] = [];
console.warn = (...a: any[]) => { if (String(a[0]).includes("[fts-search]")) lines.push(a[1]); };

async function outcome(fn: () => Promise<any>) {
  const t0 = performance.now();
  try { const r = await fn(); return { ok: true, ms: performance.now() - t0, json: JSON.stringify(r), total: r.total }; }
  catch (e: any) { return { ok: false, ms: performance.now() - t0, err: `${e?.name}:${e?.code}:${e?.message}` }; }
}
async function both(label: string, fn: () => Promise<any>) {
  process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1";
  lines.length = 0;
  const L = await outcome(fn);
  const legacyLines = lines.length;
  delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
  lines.length = 0;
  const D = await outcome(fn);
  const same = L.ok === D.ok && (L.ok ? L.json === (D as any).json : (L as any).err === (D as any).err);
  console.log(JSON.stringify({ label, same, legacy: L.ok ? `ok total=${L.total}` : (L as any).err, driven: D.ok ? `ok total=${D.total}` : (D as any).err,
    legacyMs: +L.ms.toFixed(1), drivenMs: +D.ms.toFixed(1), legacyLines, drivenLines: lines.length, reasons: lines.map((l) => `${l.reason}/${l.errorCode ?? ""}`) }));
}
const A = info.aId;
const cases: Array<[string, () => Promise<any>]> = [
  ["threads needle", () => listThreads({ accountId: A, page: 1, pageSize: 50, query: "needle" })],
  ["messages needle", () => listMessages({ accountId: A, page: 1, pageSize: 50, query: "needle" })],
  ["messages needle grouped sender", () => listMessages({ accountId: A, page: 1, pageSize: 50, query: "needle", groupBy: "sender" })],
  ["threads two tokens body+subject", () => listThreads({ accountId: A, page: 1, pageSize: 50, query: "needle quokka", fields: ["subject", "body"] })],
  ["threads invoice (attachment+fts)", () => listThreads({ accountId: A, page: 1, pageSize: 50, query: "invoice" })],
  ["messages attachments-only fields", () => listMessages({ accountId: A, page: 1, pageSize: 50, query: "invoice", fields: ["attachments"] })],
  ["messages id fragment", () => listMessages({ accountId: A, page: 1, pageSize: 50, query: "xyzzy", fields: ["bogus"] })],
  ["threads empty scope in:nonexist", () => listThreads({ accountId: A, page: 1, pageSize: 50, query: "needle in:nonexist" })]
];

if (mode === "dropped") {
  shard.exec("DROP TABLE message_fts_v3");
  for (const [l, f] of cases) await both(l, f);
} else if (mode === "malformed") {
  conn.closeAccountDbConnection?.(A);
  conn.closeAllDbConnections?.();
  const raw = new Database(shardPath);
  raw.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  const root = raw.prepare("SELECT rootpage FROM sqlite_master WHERE name='message_fts_v3_data'").get() as any;
  const pageSize = (raw.prepare("PRAGMA page_size").get() as any).page_size;
  raw.close();
  const fd = openSync(shardPath, "r+");
  writeSync(fd, Buffer.alloc(pageSize, 0xff), 0, pageSize, (root.rootpage - 1) * pageSize);
  closeSync(fd);
  shard = await getAccountDb(A);
  for (const [l, f] of cases) await both(l, f);
} else if (mode === "keywords") {
  for (const q of ["NOT", "needle AND", "OR needle", "needle OR quokka"]) {
    await both("threads " + q, () => listThreads({ accountId: A, page: 1, pageSize: 50, query: q }));
    await both("threads thread-scoped " + q, () => listThreads({ accountId: A, page: 1, pageSize: 50, query: q + " thread:th-a-0" }));
  }
} else if (mode === "busy") {
  // A WAL reader cannot be made SQLITE_BUSY from a second connection without
  // exclusive locking (which the open app connection prevents), so inject a
  // real-shaped SQLiteError(SQLITE_BUSY) into the resolution FTS statement.
  const orig = shard.prepare.bind(shard);
  let remaining = 0;
  shard.prepare = (sql: string) => {
    const st = orig(sql);
    if (!sql.includes("MATCH ? AND accountId")) return st;
    return new Proxy(st, { get(t, k) { const v = Reflect.get(t, k); if (k === "all") return (...a: any[]) => { if (remaining > 0) { remaining--; const e: any = new Error("database is locked"); e.name = "SQLiteError"; e.code = "SQLITE_BUSY"; e.errno = 5; throw e; } return v.apply(t, a); }; return typeof v === "function" ? v.bind(t) : v; } });
  };
  for (const [l, f] of cases) {
    // legacy run never prepares the resolution statement; arm for the driven run only
    remaining = 0;
    process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1"; lines.length = 0;
    const L = await outcome(f);
    delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH; lines.length = 0; remaining = 1;
    const D = await outcome(f);
    console.log(JSON.stringify({ label: l + " (BUSY injected)", same: L.ok === D.ok && (L.ok ? L.json === (D as any).json : (L as any).err === (D as any).err),
      legacy: L.ok ? `ok total=${L.total}` : (L as any).err, driven: D.ok ? `ok total=${D.total}` : (D as any).err, drivenLines: lines.length, reasons: lines.map((x) => `${x.reason}/${x.errorCode ?? ""}`) }));
  }
} else if (mode === "storm") {
  const N = 40;
  for (const [label, q] of [["unselective synthetic", "synthetic"], ["cap overcap", "overcap"], ["selective needle", "needle"]]) {
    lines.length = 0;
    const t0 = performance.now();
    const res = await Promise.allSettled(Array.from({ length: N }, (_, i) => (i % 2 ? listThreads : listMessages)({ accountId: A, page: 1, pageSize: 50, query: q })));
    console.log(JSON.stringify({ label, searches: N, ok: res.filter((x) => x.status === "fulfilled").length, fallbackLines: lines.length,
      reasons: [...new Set(lines.map((l) => l.reason))], ms: +(performance.now() - t0).toFixed(0) }));
  }
  shard.exec("DROP TABLE message_fts_v3");
  lines.length = 0;
  const res = await Promise.allSettled(Array.from({ length: N }, (_, i) => (i % 2 ? listThreads : listMessages)({ accountId: A, page: 1, pageSize: 50, query: "needle" })));
  console.log(JSON.stringify({ label: "dropped FTS concurrent", searches: N, ok: res.filter((x) => x.status === "fulfilled").length, fallbackLines: lines.length,
    reasons: [...new Set(lines.map((l) => l.reason))] }));
}
process.exit(0);
