import { writeFileSync } from 'node:fs';
const spans: Record<string, number[]> = {};
const counts: Record<string,number> = {};
let active = false;
export function record(name: string, value = 1) {
  if (!(Number(process.env.REVIEW_START) <= Date.now() && Date.now() < Number(process.env.REVIEW_END))) return;
  (spans[name] ??= []).push(value);
}
export function activate() { active = true; }
export function deactivate() { active = false; process.env.REVIEW_END='0'; }
for (const method of ['warn','error'] as const) {
  const original=console[method].bind(console);
  console[method]=(...args:any[])=>{
    if(args[0]==='[db-write-retry] retry') record('retry.'+args[1]?.operation);
    if(args[0]==='[db-write-retry] exhausted') record('exhausted.'+args[1]?.operation);
    return original(...args);
  };
}
export function attachDbProbe(db: any, kind: string) {
  if (db.__reviewProbe) return;
  db.__reviewProbe = true;
  const exec = db.exec.bind(db), transaction = db.transaction.bind(db), prepare = db.prepare.bind(db), query = db.query.bind(db);
  let manualStart: number | undefined;
  db.exec = (sql: string) => {
    const t = performance.now();
    try {
      const result = exec(sql);
      if (/^BEGIN IMMEDIATE$/i.test(sql)) { manualStart=performance.now(); record(kind+'.acquireMs',manualStart-t); }
      if (/^(COMMIT|ROLLBACK)$/i.test(sql) && manualStart !== undefined) { record(kind+'.holdMs',performance.now()-manualStart); manualStart=undefined; }
      return result;
    } catch (e) { if (/^BEGIN IMMEDIATE$/i.test(sql)) record(kind+'.acquireFailureMs',performance.now()-t); throw e; }
  };
  db.transaction = (fn: (...args:any[])=>any) => {
    let start: number | undefined;
    const tx = transaction((...args:any[]) => { start=performance.now(); return fn(...args); });
    const wrappedTx:any = (...args:any[])=>tx(...args);
    for (const mode of ['immediate','deferred','exclusive']) {
      const method = tx[mode].bind(tx);
      wrappedTx[mode] = (...args:any[]) => {
        const outer = !db.inTransaction, t = performance.now(); start=undefined;
        try { return method(...args); }
        finally { if (outer && mode!=='deferred' && start!==undefined) { record(kind+'.holdMs',performance.now()-start); record(kind+'.acquireMs',start-t); } }
      };
    }
    return wrappedTx;
  };
  const wrapped = (sql: string, orig: any) => {
    const stmt=orig(sql);
    let label = '';
    if (/DELETE FROM (?:message_fts|message_search)/i.test(sql)) label='ftsDeleteMs';
    else if (/INSERT INTO (?:message_fts|message_search)/i.test(sql)) label='ftsInsertMs';
    if (!label) return stmt;
    const run=stmt.run.bind(stmt);
    stmt.run=(...args:any[])=>{ const t=performance.now(); try { return run(...args); } finally { record(kind+'.'+label,performance.now()-t); } };
    return stmt;
  };
  db.prepare = (sql:string)=>wrapped(sql,prepare);
  db.query = (sql:string)=>wrapped(sql,query);
}
const dir=process.env.REVIEW_METRICS;
process.on('exit',()=>{ if(dir) writeFileSync(`${dir}/${process.pid}.json`,JSON.stringify({pid:process.pid,spans,counts})); });
