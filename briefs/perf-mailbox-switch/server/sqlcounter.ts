// Driver-level SQLite instrumentation (account-batching spike), extended for the mailbox-switch spike with
// per-statement wall time (ms: prepare/query compile + execution, BEGIN/COMMIT of db.transaction not included).
// Patches bun:sqlite Database.prototype before any app module opens a handle, so it is
// implementation-agnostic: the same file measures the legacy tree and the batched tree.
//
// Definitions (per measured call):
//   compiles  = db.prepare() calls + db.query() cache misses + db.run()/db.exec() calls
//   cached    = db.query() cache hits (statement reused from Bun's per-handle cache)
//   execs     = statement executions (get/all/run/values/iterate) + db.run()/db.exec() calls
//   txs       = outer db.transaction() invocations (BEGIN/COMMIT are native, not counted as execs)
// Each counter is also split per handle: master | auth | shard | other.
import { Database } from "bun:sqlite";

type Handle = "master" | "auth" | "shard" | "other";
type Bucket = { compiles: number; cached: number; execs: number; txs: number; ms: number };
const zero = (): Bucket => ({ compiles: 0, cached: 0, execs: 0, txs: 0, ms: 0 });
export const state = {
  enabled: false,
  suspended: 0,
  total: zero(),
  byHandle: {} as Record<Handle, Bucket>,
  /** normalized SQL -> {compiles, execs, handle} for the call map */
  statements: new Map<string, { handle: Handle; compiles: number; cached: number; execs: number; ms: number }>()
};
const labels = new WeakMap<object, Handle>();
const sqlOf = new WeakMap<object, string>();
const wrapped = new WeakSet<object>();
const seen = new WeakSet<object>();
let triggers: Array<{ pattern: RegExp; handle?: Handle; fn: () => void; fired: boolean }> = [];

export function labelHandle(db: object, label: Handle) { labels.set(db, label); }
let mainPath = "";
/** Handles on the main file that were not labelled (scratch writers) count as "other"; every other file is a shard. */
export function setMainPath(path: string) { mainPath = path; }
const label = (db: object): Handle => labels.get(db) ?? (String((db as any).filename) === mainPath ? "other" : "shard");
export function normalize(sql: string) { return sql.replace(/\s+/g, " ").trim().slice(0, 160); }

export function reset() {
  state.total = zero();
  state.byHandle = { master: zero(), auth: zero(), shard: zero(), other: zero() };
  state.statements = new Map();
  triggers = [];
}
reset();
const active = () => state.enabled && state.suspended === 0;
function bump(db: object, key: keyof Bucket, sql?: string) {
  if (!active()) return;
  const h = label(db);
  state.total[key]++; state.byHandle[h][key]++;
  if (sql !== undefined && key !== "txs") {
    const k = h + " | " + normalize(sql);
    const row = state.statements.get(k) ?? { handle: h, compiles: 0, cached: 0, execs: 0, ms: 0 };
    row[key as "compiles" | "cached" | "execs"]++;
    state.statements.set(k, row);
  }
}
function addMs(db: object, sql: string, ms: number) {
  if (!active()) return;
  const h = label(db);
  state.total.ms += ms; state.byHandle[h].ms += ms;
  const row = state.statements.get(h + " | " + normalize(sql));
  if (row) row.ms += ms;
}
/** Run fn once, after the first matching statement execution inside the measured window. */
export function afterFirst(pattern: RegExp, fn: () => void, handle?: Handle) { triggers.push({ pattern, handle, fn, fired: false }); }
/** Untracked side effects (fixture writes inside a trigger). */
export function untracked<T>(fn: () => T): T { state.suspended++; try { return fn(); } finally { state.suspended--; } }
function fireTriggers(db: object, sql: string) {
  if (!active()) return;
  for (const t of triggers) if (!t.fired && t.pattern.test(sql) && (!t.handle || t.handle === label(db))) { t.fired = true; untracked(t.fn); }
}

function wrapStatement(db: object, stmt: any, sql: string) {
  if (wrapped.has(stmt)) return stmt;
  wrapped.add(stmt); sqlOf.set(stmt, sql);
  for (const method of ["get", "all", "run", "values", "iterate"]) {
    const original = stmt[method];
    if (typeof original !== "function") continue;
    stmt[method] = function (...args: unknown[]) {
      bump(db, "execs", sql);
      const t0 = performance.now();
      const result = original.apply(stmt, args);
      addMs(db, sql, performance.now() - t0);
      fireTriggers(db, sql);
      return result;
    };
  }
  return stmt;
}

const proto = Database.prototype as any;
const prepare = proto.prepare, query = proto.query, run = proto.run, exec = proto.exec, transaction = proto.transaction;
proto.prepare = function (sql: string, ...rest: unknown[]) {
  bump(this, "compiles", sql);
  const t0 = performance.now();
  const stmt = prepare.call(this, sql, ...rest);
  addMs(this, sql, performance.now() - t0);
  return wrapStatement(this, stmt, sql);
};
proto.query = function (sql: string, ...rest: unknown[]) {
  const t0 = performance.now();
  const stmt = query.call(this, sql, ...rest);
  const dt = performance.now() - t0;
  if (seen.has(stmt)) bump(this, "cached", sql); else { seen.add(stmt); bump(this, "compiles", sql); }
  addMs(this, sql, dt);
  return wrapStatement(this, stmt, sql);
};
for (const [name, original] of [["run", run], ["exec", exec]] as const) {
  proto[name] = function (sql: string, ...rest: unknown[]) {
    bump(this, "compiles", sql); bump(this, "execs", sql);
    const t0 = performance.now();
    const result = original.call(this, sql, ...rest);
    addMs(this, sql, performance.now() - t0);
    fireTriggers(this, sql);
    return result;
  };
}
proto.transaction = function (fn: (...args: any[]) => any) {
  const db = this;
  const tx = transaction.call(this, fn);
  const outer: any = (...args: unknown[]) => { if (!db.inTransaction) bump(db, "txs"); return tx(...args); };
  for (const mode of ["deferred", "immediate", "exclusive"]) outer[mode] = (...args: unknown[]) => { if (!db.inTransaction) bump(db, "txs"); return tx[mode](...args); };
  return outer;
};

export function snapshot() {
  return {
    total: { ...state.total },
    byHandle: Object.fromEntries(Object.entries(state.byHandle).filter(([, b]) => b.compiles + b.cached + b.execs + b.txs > 0)),
    statements: [...state.statements.entries()].map(([key, v]) => ({ sql: key.slice(key.indexOf("|") + 2), ...v }))
      .sort((a, b) => b.execs - a.execs || a.sql.localeCompare(b.sql))
  };
}
