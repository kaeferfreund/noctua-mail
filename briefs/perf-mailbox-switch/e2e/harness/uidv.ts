// Read-only: per-folder UIDVALIDITY currently cached by the app, so a restarted fixture can reuse it (no resync).
import { Database } from "bun:sqlite";
const dir = "/home/monkey/code/noctua-mail/data/noctua-data-spike-switch-e2e/db/accounts";
const out: Record<string, Record<string, number>> = {};
for (const key of ["small", "medium", "large", "folders"]) {
  const db = new Database(`${dir}/spike-${key}.db`, { readonly: true });
  const tables = db.query("select name from sqlite_master where type='table'").all().map((r: any) => r.name as string);
  for (const t of tables) {
    const cols = db.query(`pragma table_info("${t}")`).all().map((c: any) => c.name as string);
    const uc = cols.find(c => /uid_?validity/i.test(c)); if (!uc) continue;
    const fc = cols.find(c => /folderid|mailbox|path/i.test(c));
    console.log(key, t, uc, fc);
    if (fc) for (const r of db.query(`select "${fc}" as f, "${uc}" as u from "${t}"`).all() as any[]) if (r.u) (out[key] ??= {})[String(r.f).replace(`spike-${key}:`, "")] = Number(r.u);
  }
  db.close();
}
console.log(JSON.stringify(out));
await Bun.write("/tmp/spike-switch-e2e/uidv.json", JSON.stringify(out));
