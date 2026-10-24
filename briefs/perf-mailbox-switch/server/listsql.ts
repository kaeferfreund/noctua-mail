// Mailbox-switch spike: statement-level cost + query plans of listThreads (default first page) on one shard.
import { writeFileSync } from "node:fs";
import * as counter from "./sqlcounter";
import { buildFixture } from "./fixture";
const ROOT = process.env.SWITCH_ROOT ?? process.cwd();
const fx = await buildFixture();
const { listThreads } = await import(`${ROOT}/lib/db/messages/query.ts`);
const id = (process.env.SWITCH_FIXTURE_ONLY ?? "syn-l0").split(",")[0];
const db = await fx.getAccountDb(id);
const args = { accountId: id, folderId: `${id}:INBOX`, page: 1, pageSize: 300, groupBy: "date", threadDateSource: "latestReceivedDateValue", fields: [], query: null, viewerUserId: fx.user.user.id } as any;
await listThreads(args);
const captured: Array<{ sql: string; args: any[]; ms: number }> = [];
const origPrepare = db.prepare.bind(db);
db.prepare = (sql: string) => { const st = origPrepare(sql); return new Proxy(st, { get(t, k) { const v = Reflect.get(t, k);
  if (["get", "all", "run"].includes(String(k))) return (...a: any[]) => { const t0 = performance.now(); const r = v.apply(t, a); captured.push({ sql, args: a, ms: performance.now() - t0 }); return r; };
  return typeof v === "function" ? v.bind(t) : v; } }); };
const runs: any[] = [];
for (let i = 0; i < 9; i++) { captured.length = 0; const t = performance.now(); const r = await listThreads(args); runs.push({ ms: performance.now() - t, statements: captured.map(c => ({ ms: c.ms, sql: c.sql.replace(/\s+/g, " ").slice(0, 200) })), groups: r.groups, total: r.total, items: r.items.length }); }
db.prepare = origPrepare;
const last = captured.map(c => ({ ...c, plan: (() => { try { return db.prepare("EXPLAIN QUERY PLAN " + c.sql).all(...c.args).map((p: any) => p.detail); } catch (e) { return String(e); } })() }));
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const perStmt = runs[0].statements.map((s: any, j: number) => ({ sql: s.sql, msP50: med(runs.map(r => r.statements[j]?.ms ?? 0)) }));
writeFileSync(process.argv[2] ?? "/tmp/spike-switch-server/listsql.json", JSON.stringify({ id, msP50: med(runs.map(r => r.ms)), groups: runs[0].groups, total: runs[0].total, items: runs[0].items, perStmt, plans: last.map(l => ({ sql: l.sql.replace(/\s+/g, " "), args: l.args.length, plan: l.plan })) }, null, 1));
console.log(id, "listThreads p50", med(runs.map(r => r.ms)).toFixed(2), "groups", JSON.stringify(runs[0].groups), "total", runs[0].total);
for (const s of perStmt) console.log(s.msP50.toFixed(2).padStart(7), s.sql.slice(0, 170));
process.exit(0);
