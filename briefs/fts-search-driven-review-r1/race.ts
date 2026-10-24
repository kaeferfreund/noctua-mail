// F3: commit a production write from ANOTHER PROCESS at chosen points between
// the statements of one listThreads/listMessages search, in both modes, and
// classify the response against the before/after snapshots.
import { cloneData } from "./clone";
import { WT } from "./seed";

const [mode, op, point, fnName, target] = process.argv.slice(2) as [string, string, string, string, string];
const dataDir = cloneData("data-race");
const { openOrSeed } = await import("./seed");
const { info, getAccountDb } = await openOrSeed(dataDir);
const { listThreads, listMessages } = await import(WT + "/lib/db/messages/query.ts");
const shard: any = await getAccountDb(info.aId);
const accountId = op === "insertB" ? info.bId : info.aId;
const A = info.aId;
const params: any = { accountId: A, page: 1, pageSize: 25, query: "needle", folderId: "inbox", groupBy: "sender" };
const fn = fnName === "threads" ? listThreads : listMessages;
const summarize = (r: any) => ({
  ids: r.items.map((m: any) => m.id), total: r.total, hasMore: r.hasMore, baseCount: r.baseCount,
  groupSum: (r.groups ?? []).reduce((s: number, g: any) => s + g.count, 0)
});
if (mode === "legacy") process.env.NOCTUA_DISABLE_FTS_DRIVEN_SEARCH = "1";

const before = summarize(await fn(params));
// Statement markers for the injection points.
const markers: Record<string, RegExp> = {
  afterResolution: fnName === "threads" ? /t\.threadId IN \(SELECT DISTINCT m\.threadId/ : /ORDER BY m\.(flagged DESC, m\.)?dateValue DESC\s+LIMIT/,
  afterSelector: fnName === "threads" ? /SELECT COUNT\(\*\) as count\s+FROM threads t/ : /GROUP BY key/,
  beforeTotals: /^\s*SELECT COUNT\(\*\) as count\s+FROM messages m\s+WHERE/ // getTotalCount / base count
};
const marker = markers[point];
let fired = false;
const writeOp = op === "insertB" ? "insert" : op;
const orig = shard.prepare.bind(shard);
shard.prepare = (sql: string) => {
  if (!fired && marker.test(sql)) {
    fired = true;
    const res = Bun.spawnSync(["bun", "--preload", WT + "/lib/testSetupEnv.ts", WT + "/.tmp/review/write.ts", dataDir, writeOp, accountId, target], { env: process.env, stderr: "pipe", stdout: "pipe" });
    if (res.exitCode !== 0) throw new Error("writer failed: " + res.stderr.toString().slice(-500));
  }
  return orig(sql);
};
const during = summarize(await fn(params));
shard.prepare = orig;
const after = summarize(await fn(params));
const eq = (x: any, y: any) => JSON.stringify(x) === JSON.stringify(y);
const anomalies: string[] = [];
if (!fired) anomalies.push("MARKER_NOT_HIT");
const verdict = eq(during, before) ? "consistent-before" : eq(during, after) ? "consistent-after" : "mixed";
if (verdict === "mixed") {
  for (const k of ["ids", "total", "hasMore", "baseCount", "groupSum"]) {
    const d = (during as any)[k], b = (before as any)[k], a = (after as any)[k];
    if (!eq(d, b) && !eq(d, a)) anomalies.push(`${k}: before=${JSON.stringify(b).slice(0, 80)} during=${JSON.stringify(d).slice(0, 80)} after=${JSON.stringify(a).slice(0, 80)}`);
    else anomalies.push(`${k}=${eq(d, b) ? "before" : "after"}`);
  }
  if (fnName === "messages" && during.groupSum !== during.total) anomalies.push(`groupSum ${during.groupSum} != total ${during.total}`);
}
const dupes = during.ids.length !== new Set(during.ids).size;
console.log(JSON.stringify({ mode, op, point, fn: fnName, target, verdict, dupes, anomalies,
  beforeTotal: before.total, duringTotal: during.total, afterTotal: after.total,
  targetInBefore: before.ids.includes(target), targetInDuring: during.ids.includes(target), targetInAfter: after.ids.includes(target) }));
process.exit(0);
