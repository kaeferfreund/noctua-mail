// V2: threads route timing (warm + cold shard) + phase anatomy, default first page.
//   SWITCH_ROOT=<checkout> SWITCH_FIXTURE_ONLY=syn-m0,syn-l0 [SWITCH_TOPICS=1] bun v2bench.ts out.json
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import * as counter from "./sqlcounter";
import { buildFixture, MAILBOXES } from "./fixture";
const ROOT = process.env.SWITCH_ROOT ?? process.cwd();
const ITER = Number(process.env.V2_ITER ?? 40);
const COLD = Number(process.env.V2_COLD ?? 15);
const fx = await buildFixture();
const { getMainDbPath } = await import(`${ROOT}/lib/runtimePaths.ts`);
const { getAuthDb } = await import(`${ROOT}/lib/db/connection.ts`);
counter.labelHandle(fx.master, "master"); counter.labelHandle(await getAuthDb(), "auth"); counter.setMainPath(getMainDbPath());
const threads = await import(`${ROOT}/app/api/accounts/[accountId]/threads/route.ts`);
const sw = await import(`${ROOT}/app/api/auth/switch-account/route.ts`);
const { listThreads } = await import(`${ROOT}/lib/db/messages/query.ts`);
const { enrichMessagesWithThreadTopics } = await import(`${ROOT}/app/api/_helpers/enrichMessagesWithThreadTopics.ts`);
const { getOwnAddresses } = await import(`${ROOT}/lib/ownAddresses.ts`);
const { getAccountById } = await import(`${ROOT}/lib/serverDb.ts`);
const ORIGIN = "http://localhost:3000";
const rq = (path: string) => new Request(`${ORIGIN}${path}`, { headers: { cookie: fx.user.jar.header(), origin: ORIGIN } });
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const out: any = { root: ROOT, topics: process.env.SWITCH_TOPICS === "1", loadStart: loadavg(), rows: [] as any[] };
async function time(label: string, fn: () => Promise<any> | any, n = ITER, before?: () => Promise<void> | void) {
  if (!before) await fn();
  const ms: number[] = [], sql: number[] = [], execs: number[] = [];
  const stmts = new Map<string, { ms: number; execs: number }>();
  for (let i = 0; i < n; i++) {
    if (before) await before();
    counter.reset(); counter.state.enabled = true;
    const t = performance.now(); await fn(); ms.push(performance.now() - t);
    counter.state.enabled = false; const snap = counter.snapshot();
    sql.push(snap.total.ms); execs.push(snap.total.execs);
    for (const s of snap.statements) { const k = `${s.handle} | ${s.sql}`; const r = stmts.get(k) ?? stmts.set(k, { ms: 0, execs: 0 }).get(k)!; r.ms += s.ms; r.execs += s.execs; }
  }
  const top = [...stmts.entries()].map(([sql, v]) => ({ sql, msPerCall: v.ms / n, execsPerCall: v.execs / n })).sort((a, b) => b.msPerCall - a.msPerCall).slice(0, 12);
  const row = { label, n, p50: q(ms, 0.5), p90: q(ms, 0.9), sqlP50: q(sql, 0.5), execs: q(execs, 0.5), top };
  console.log(label.padEnd(56), `p50 ${row.p50.toFixed(2)} p90 ${row.p90.toFixed(2)} sql ${row.sqlP50.toFixed(2)} execs ${row.execs}`);
  out.rows.push(row);
  return row;
}
for (const mb of MAILBOXES) {
  const id = mb.id;
  await sw.POST(new Request(`${ORIGIN}/api/auth/switch-account`, { method: "POST", body: JSON.stringify({ accountId: id }), headers: { cookie: fx.user.jar.header(), origin: ORIGIN, "content-type": "application/json" } }));
  const account = await getAccountById(id);
  const folderId = `${id}:INBOX`;
  const path = `/api/accounts/${id}/threads?page=1&pageSize=300&groupBy=date&threadDateSource=latestReceivedDateValue&folderId=${encodeURIComponent(folderId)}`;
  const route = async () => (await threads.GET(rq(path), { params: Promise.resolve({ accountId: id }) })).text();
  await time(`${id} route warm`, route);
  const shardPath = (await fx.getAccountDb(id)).filename as string;
  await time(`${id} route cold-shard`, route, COLD, () => { fx.closeAccountDbConnection(shardPath); });
  await fx.getAccountDb(id);
  const base = { accountId: id, folderId, page: 1, pageSize: 300, groupBy: "date", threadDateSource: "latestReceivedDateValue", fields: [], query: null, viewerUserId: fx.user.user.id };
  await time(`${id}   listThreads`, () => listThreads(base as any));
  const data = await listThreads(base as any);
  await time(`${id}   enrich topics+suggestions`, async () => { const items = data.items.map((m: any) => ({ ...m }));
    await enrichMessagesWithThreadTopics(items, { accountId: id, accountEmail: getOwnAddresses(account!), includeSuggestions: true }); });
}
out.loadEnd = loadavg();
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log("load", out.loadStart, out.loadEnd);
process.exit(0);
