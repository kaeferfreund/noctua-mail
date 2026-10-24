// Mailbox-switch spike: equivalence-checked raw SQL variants for the listThreads first page (one shard).
// Captures the real statements + args of listThreads, applies textual rewrites, asserts identical rows, times both.
import { writeFileSync } from "node:fs";
import "./sqlcounter";
import { buildFixture } from "./fixture";
const ROOT = process.env.SWITCH_ROOT ?? process.cwd();
const fx = await buildFixture();
const { listThreads } = await import(`${ROOT}/lib/db/messages/query.ts`);
const ids = (process.env.SWITCH_FIXTURE_ONLY ?? "syn-l0").split(",");
const out: any[] = [];
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const id of ids) {
  const db = await fx.getAccountDb(id);
  for (const [view, extra] of Object.entries({ inbox: {}, allMail: { folderId: undefined }, inboxExcl: { excludedFolderIds: [`${id}:Trash`] }, page2: { page: 2 }, search: { query: "subject" } } as Record<string, any>)) {
  const args = { accountId: id, folderId: `${id}:INBOX`, page: 1, pageSize: 300, groupBy: "date", threadDateSource: "latestReceivedDateValue", fields: [], query: null, viewerUserId: fx.user.user.id, ...extra } as any;
  const captured: Array<{ sql: string; args: any[]; method: string }> = [];
  const orig = db.prepare.bind(db);
  db.prepare = (sql: string) => { const st = orig(sql); return new Proxy(st, { get(t, k) { const v = Reflect.get(t, k);
    if (["get", "all"].includes(String(k))) return (...a: any[]) => { captured.push({ sql, args: a, method: String(k) }); return v.apply(t, a); };
    return typeof v === "function" ? v.bind(t) : v; } }); };
  await listThreads(args);
  db.prepare = orig;
  const find = (re: RegExp) => captured.find(c => re.test(c.sql.replace(/\s+/g, " ")))!;
  const variants: Array<{ name: string; base: RegExp; rewrite: (s: string) => string }> = [
    { name: "messages rows: ORDER BY m.dateValue DESC, m.rowid (planner picks thread index)", base: /SELECT m\.id, m\.accountId, m\.folderId/, rewrite: s => s.replace(/ORDER BY m\.dateValue DESC\s*$/, "ORDER BY +m.dateValue DESC, m.rowid ASC") },
    { name: "messages rows: INDEXED BY idx_messages_account_thread_date + explicit tie-break", base: /SELECT m\.id, m\.accountId, m\.folderId/, rewrite: s => s.replace(/FROM messages m\s+WHERE/, "FROM messages m INDEXED BY idx_messages_account_thread_date WHERE").replace(/ORDER BY m\.dateValue DESC\s*$/, "ORDER BY m.dateValue DESC, m.rowid ASC") },
    { name: "baseCount: INDEXED BY idx_messages_account_thread_date", base: /COUNT\(\*\) as count FROM messages m WHERE .* AND m\.threadId IN \(\?/, rewrite: s => s.replace(/FROM messages m\s+WHERE/, "FROM messages m INDEXED BY idx_messages_account_thread_date WHERE") },
    // { name: "selector: subquery via folder index", base: /SELECT t\.\*, t\.latestReceivedDateValue as effectiveThreadDateValue/, rewrite: s => s.replace(/SELECT DISTINCT m\.threadId\s+FROM messages m\s+WHERE/, "SELECT DISTINCT m.threadId FROM messages m INDEXED BY idx_messages_account_folder_date WHERE") },
    // { name: "thread count: subquery via folder index", base: /SELECT COUNT\(\*\) as count FROM threads t WHERE/, rewrite: s => s.replace(/SELECT DISTINCT m\.threadId\s+FROM messages m\s+WHERE/, "SELECT DISTINCT m.threadId FROM messages m INDEXED BY idx_messages_account_folder_date WHERE") },
  ];
  for (const v of variants) {
    const c = find(v.base);
    if (!c) { out.push({ id, view, name: v.name, error: "statement not found" }); console.log(id, view, v.name, "not found"); continue; }
    const alt = v.rewrite(c.sql);
    if (alt === c.sql) { out.push({ id, view, name: v.name, error: "rewrite did not apply" }); console.log(id, view, v.name, "no rewrite"); continue; }
    const run = (sql: string) => { const st = db.prepare(sql); st[c.method](...c.args); const ms: number[] = []; let r: any;
      for (let i = 0; i < 21; i++) { const t = performance.now(); r = st[c.method](...c.args); ms.push(performance.now() - t); } return { ms: med(ms), r }; };
    const a = run(c.sql), b = run(alt);
    const plan = (sql: string) => db.prepare("EXPLAIN QUERY PLAN " + sql).all(...c.args).map((p: any) => p.detail);
    const row = { id, view, name: v.name, baseMs: a.ms, altMs: b.ms, identical: JSON.stringify(a.r) === JSON.stringify(b.r), rows: Array.isArray(a.r) ? a.r.length : 1, basePlan: plan(c.sql), altPlan: plan(alt) };
    out.push(row);
    console.log(id, view.padEnd(9), v.name.slice(0, 60).padEnd(60), `${a.ms.toFixed(2)} -> ${b.ms.toFixed(2)} ms identical=${row.identical} rows=${row.rows}`);
  }
}
}
writeFileSync(process.argv[2] ?? "/tmp/spike-switch-server/sqlvariants.json", JSON.stringify(out, null, 1));
process.exit(0);
