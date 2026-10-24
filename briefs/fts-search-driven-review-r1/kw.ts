import { openOrSeed, WT } from "./seed";
const { info } = await openOrSeed(WT + "/.tmp/review/data-diff");
const { listMessages } = await import(WT + "/lib/db/messages/query.ts");
const ow = console.warn; const lines: any[] = [];
console.warn = (...a: any[]) => { lines.push(a); };
for (const q of ["NOT", "AND", "OR", "NEAR", "needle OR", "OR needle", "near", "not", "AND needle", "plover walrus AND"]) {
  for (const legacy of [true, false]) {
    if (legacy) process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1"; else delete process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH;
    lines.length = 0;
    let res: string;
    try { const r = await listMessages({ accountId: info.aId, page: 1, pageSize: 5, query: q }); res = "ok total=" + r.total; }
    catch (e: any) { res = `ERR ${e.name}:${e.code}:${e.message}`; }
    console.log(JSON.stringify(q), legacy ? "legacy" : "driven", res, lines.length ? JSON.stringify(lines.map(l => l[1])) : "");
  }
}
process.exit(0);
