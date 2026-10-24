// Mailbox-switch spike, server side: in-process profile of every route a mailbox switch calls.
//
//   cd <worktree> && TMPDIR=<data dir>/tmp nice -n 10 bun --tsconfig-override tsconfig.json <harness>/switch.ts [out.json]
//
// Env: SWITCH_ROOT (default cwd), SWITCH_ROUNDS (default 15 rounds x 12 mailboxes), SWITCH_COLD_ROUNDS (default 6).
// Critical path = what the client awaits in series (useAccountController.switchAccount -> loadInitialData, then
// useMessageData): POST /api/auth/switch-account -> GET /api/auth/me -> GET folders -> GET threads page 1.
// Side requests (fired by hooks on activeAccountId, in parallel / on idle) are measured separately.
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import * as counter from "./sqlcounter";
import { MAILBOXES, buildFixture } from "./fixture";

const ROOT = process.env.SWITCH_ROOT ?? process.cwd();
const ROUNDS = Number(process.env.SWITCH_ROUNDS ?? 15);
const COLD_ROUNDS = Number(process.env.SWITCH_COLD_ROUNDS ?? 6);
const OUT = process.argv[2] ?? `${import.meta.dir}/switch-results.json`;
const loadStart = loadavg();

const fx = await buildFixture();
const { getAuthDb } = await import(`${ROOT}/lib/db/connection.ts`);
const { getMainDbPath } = await import(`${ROOT}/lib/runtimePaths.ts`);
counter.labelHandle(fx.master, "master");
counter.labelHandle(await getAuthDb(), "auth");
counter.setMainPath(getMainDbPath());

const R = {
  switch: await import(`${ROOT}/app/api/auth/switch-account/route.ts`),
  me: await import(`${ROOT}/app/api/auth/me/route.ts`),
  folders: await import(`${ROOT}/app/api/accounts/[accountId]/folders/route.ts`),
  threads: await import(`${ROOT}/app/api/accounts/[accountId]/threads/route.ts`),
  topics: await import(`${ROOT}/app/api/accounts/[accountId]/topics/route.ts`),
  topicStats: await import(`${ROOT}/app/api/accounts/[accountId]/topics/stats/route.ts`),
  aliases: await import(`${ROOT}/app/api/accounts/[accountId]/recipient-aliases/route.ts`),
  calendar: await import(`${ROOT}/app/api/accounts/[accountId]/calendar/events/route.ts`),
  summary: await import(`${ROOT}/app/api/me/mailboxes/summary/route.ts`)
};
const ORIGIN = "http://localhost:3000";
type Jar = { header(): string };
const req = (path: string, jar: Jar, init: RequestInit = {}) => new Request(`${ORIGIN}${path}`, { ...init,
  headers: { cookie: jar.header(), origin: ORIGIN, ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers as any) } });
const params = (accountId: string) => ({ params: Promise.resolve({ accountId }) });

type StepId = "switch" | "me" | "folders" | "threads" | "topics" | "topicStats" | "aliases" | "calendar";
const CRITICAL: StepId[] = ["switch", "me", "folders", "threads"];
const SIDE: StepId[] = ["topics", "topicStats", "aliases", "calendar"];
function call(step: StepId, accountId: string, jar: Jar): Promise<Response> {
  const enc = encodeURIComponent(accountId);
  switch (step) {
    case "switch": return R.switch.POST(req("/api/auth/switch-account", jar, { method: "POST", body: JSON.stringify({ accountId }) }));
    case "me": return R.me.GET(req("/api/auth/me", jar));
    case "folders": return R.folders.GET(req(`/api/accounts/${enc}/folders`, jar), params(accountId));
    case "threads": {
      const q = new URLSearchParams({ page: "1", pageSize: "300", groupBy: "date", threadDateSource: "latestReceivedDateValue", folderId: `${accountId}:INBOX` });
      return R.threads.GET(req(`/api/accounts/${enc}/threads?${q}`, jar), params(accountId));
    }
    case "topics": return R.topics.GET(req(`/api/accounts/${enc}/topics`, jar), params(accountId));
    case "topicStats": return R.topicStats.GET(req(`/api/accounts/${enc}/topics/stats`, jar), params(accountId));
    case "aliases": return R.aliases.GET(req(`/api/accounts/${enc}/recipient-aliases`, jar), params(accountId));
    case "calendar": {
      const now = Date.now();
      return R.calendar.GET(req(`/api/accounts/${enc}/calendar/events?startMs=${now}&endMs=${now + 7 * 864e5}`, jar), params(accountId));
    }
  }
}
type Sample = { step: StepId; mode: string; accountId: string; cls: string; ms: number; sqlMs: number; status: number; bytes: number;
  execs: number; compiles: number; cached: number; txs: number; byHandle: Record<string, any>; shardOpened: boolean; writes: string[] };
const samples: Sample[] = [];
const hashes: Record<string, string> = {}; // response-body hashes (warm-up pass) for base/variant equivalence
const histo = new Map<string, Map<string, { handle: string; execs: number; compiles: number; ms: number; n: number }>>();
const isWrite = (sql: string) => /^\s*(insert|update|delete|replace|create|alter|drop)\b/i.test(sql);
async function measure(step: StepId, accountId: string, jar: Jar, mode: string, record = true) {
  counter.reset(); counter.state.enabled = true;
  const t = performance.now();
  const response = await call(step, accountId, jar);
  const text = await response.text();
  const ms = performance.now() - t;
  counter.state.enabled = false;
  const snap = counter.snapshot();
  if (response.status >= 400) throw new Error(`${step} ${accountId} -> ${response.status} ${text.slice(0, 200)}`);
  if (!record) { if (step !== "switch" && step !== "me") hashes[`${step}/${accountId}`] = new Bun.CryptoHasher("sha256").update(text).digest("hex"); return; }
  const cls = MAILBOXES.find(m => m.id === accountId)!.cls;
  samples.push({ step, mode, accountId, cls, ms, sqlMs: snap.total.ms, status: response.status, bytes: text.length,
    execs: snap.total.execs, compiles: snap.total.compiles, cached: snap.total.cached, txs: snap.total.txs, byHandle: snap.byHandle,
    shardOpened: snap.statements.some(s => s.handle === "shard" && /journal_mode/i.test(s.sql)),
    writes: snap.statements.filter(s => isWrite(s.sql) && s.execs > 0).map(s => `${s.handle} | ${s.sql.slice(0, 90)}`) });
  const key = `${mode}/${step}`;
  const m = histo.get(key) ?? histo.set(key, new Map()).get(key)!;
  for (const s of snap.statements) {
    const k = `${s.handle} | ${s.sql}`;
    const row = m.get(k) ?? m.set(k, { handle: s.handle, execs: 0, compiles: 0, ms: 0, n: 0 }).get(k)!;
    row.execs += s.execs; row.compiles += s.compiles; row.ms += s.ms; row.n++;
  }
}
async function doSwitch(accountId: string, mode: string, record = true, side = true) {
  for (const step of CRITICAL) await measure(step, accountId, fx.user.jar, mode, record);
  if (side) for (const step of SIDE) await measure(step, accountId, fx.user.jar, mode, record);
}
const shardPath = async (id: string) => (await fx.getAccountDb(id)).filename as string;

// 1. First switch in a fresh process (modules imported, shards settled by the fixture, but no request has run yet).
await doSwitch("syn-m1", "process-first");
// Warm-up: every route once per mailbox (excluded).
for (const mb of MAILBOXES) await doSwitch(mb.id, "warmup", false);
// 2. Warm series: a deterministic rotation, so consecutive switches always target a different shard.
const order = MAILBOXES.map(m => m.id);
for (let r = 0; r < ROUNDS; r++) for (let i = 0; i < order.length; i++) await doSwitch(order[(i * 5 + r) % order.length], "warm");
// 3. Cold shard: the target shard was idle-closed (closeAccountDbConnection, as the 5 min idle timer does) before the switch.
for (let r = 0; r < COLD_ROUNDS; r++) for (let i = 0; i < order.length; i++) {
  const id = order[(i * 5 + r) % order.length];
  fx.closeAccountDbConnection(await shardPath(id));
  await doSwitch(id, "cold-shard");
}
// 4. Cold-shard breakdown: getAccountDb alone after a close (open + PRAGMAs + schema init + runtime ensures + probes).
const { getAccountDb } = await import(`${ROOT}/lib/db/connection.ts`);
const openCost: any[] = [];
for (let r = 0; r < 5; r++) for (const mb of MAILBOXES) {
  fx.closeAccountDbConnection(await shardPath(mb.id));
  counter.reset(); counter.state.enabled = true;
  const t = performance.now(); await getAccountDb(mb.id); const cold = performance.now() - t;
  counter.state.enabled = false; const coldSnap = counter.snapshot();
  counter.reset(); counter.state.enabled = true;
  const t2 = performance.now(); await getAccountDb(mb.id); const warm = performance.now() - t2;
  counter.state.enabled = false; const warmSnap = counter.snapshot();
  openCost.push({ accountId: mb.id, cls: mb.cls, coldMs: cold, coldSqlMs: coldSnap.total.ms, coldExecs: coldSnap.total.execs, coldCompiles: coldSnap.total.compiles,
    warmMs: warm, warmSqlMs: warmSnap.total.ms, warmExecs: warmSnap.total.execs, warmCompiles: warmSnap.total.compiles,
    coldStatements: r === 0 ? coldSnap.statements : undefined, warmStatements: r === 0 ? warmSnap.statements : undefined });
}
// 5. Summary route (user-wide; reloaded via onMailboxesChanged, not per switch) for reference.
for (let r = 0; r < 30; r++) {
  counter.reset(); counter.state.enabled = true;
  const t = performance.now(); const res = await R.summary.GET(req("/api/me/mailboxes/summary", fx.user.jar)); await res.text();
  const ms = performance.now() - t; counter.state.enabled = false; const s = counter.snapshot();
  samples.push({ step: "summary" as any, mode: "warm", accountId: "-", cls: "-", ms, sqlMs: s.total.ms, status: res.status, bytes: 0, execs: s.total.execs,
    compiles: s.total.compiles, cached: s.total.cached, txs: s.total.txs, byHandle: s.byHandle, shardOpened: false, writes: [] });
}

const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const stats = (xs: number[]) => ({ n: xs.length, p50: q(xs, 0.5), p90: q(xs, 0.9), p99: q(xs, 0.99), max: Math.max(...xs), mean: xs.reduce((a, b) => a + b, 0) / xs.length });
const table: any[] = [];
for (const mode of ["process-first", "warm", "cold-shard"]) for (const step of [...CRITICAL, ...SIDE, "summary"]) for (const cls of ["all", "small", "medium", "large", "folders"]) {
  const xs = samples.filter(s => s.mode === mode && s.step === step && (cls === "all" || s.cls === cls));
  if (!xs.length) continue;
  table.push({ mode, step, cls, ms: stats(xs.map(s => s.ms)), sqlMs: stats(xs.map(s => s.sqlMs)), execs: stats(xs.map(s => s.execs)),
    compiles: stats(xs.map(s => s.compiles)), bytes: stats(xs.map(s => s.bytes)), shardOpened: xs.filter(s => s.shardOpened).length,
    writes: [...new Set(xs.flatMap(s => s.writes))] });
}
// Critical-path sum per switch (4 steps in series).
const perSwitch: Record<string, number[]> = {};
for (const mode of ["warm", "cold-shard"]) {
  const xs = samples.filter(s => s.mode === mode && CRITICAL.includes(s.step));
  const sums: number[] = []; for (let i = 0; i + 3 < xs.length; i += 4) sums.push(xs[i].ms + xs[i + 1].ms + xs[i + 2].ms + xs[i + 3].ms);
  perSwitch[mode] = sums;
}
const histograms: Record<string, any[]> = {};
for (const [key, m] of histo) histograms[key] = [...m.entries()].map(([sql, v]) => ({ sql, ...v, execsPerCall: v.execs / Math.max(1, samples.filter(s => `${s.mode}/${s.step}` === key).length),
  msPerCall: v.ms / Math.max(1, samples.filter(s => `${s.mode}/${s.step}` === key).length) })).sort((a, b) => b.ms - a.ms);
const out = { root: ROOT, rounds: ROUNDS, coldRounds: COLD_ROUNDS, seedMs: fx.seedMs, loadStart, loadEnd: loadavg(), bun: Bun.version,
  hashes, table, perSwitch: Object.fromEntries(Object.entries(perSwitch).map(([k, v]) => [k, stats(v)])), openCost, histograms, samples };
writeFileSync(OUT, JSON.stringify(out, null, 1));
for (const row of table.filter(r => r.cls === "all")) console.log(row.mode.padEnd(14), row.step.padEnd(11), `p50 ${row.ms.p50.toFixed(2)} p90 ${row.ms.p90.toFixed(2)} p99 ${row.ms.p99.toFixed(2)} ms | sql ${row.sqlMs.p50.toFixed(2)} | execs ${row.execs.p50} compiles ${row.compiles.p50} | opened ${row.shardOpened}/${row.ms.n} | writes ${row.writes.length}`);
console.log("per-switch critical path", JSON.stringify(out.perSwitch));
console.log("load", loadStart, out.loadEnd);
process.exit(0);
