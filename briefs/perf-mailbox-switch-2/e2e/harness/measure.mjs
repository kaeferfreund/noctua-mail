// Spike A: end-to-end mailbox-switch measurement against the standalone build.
// No app code changes: milestones via MutationObserver + DOM predicates, network via Playwright/CDP events,
// long tasks via PerformanceObserver. Usage:
//   node measure.mjs --series <name> --mode cold|warm --pairs small:large,large:small --reps 10 [--second-tab] [--out dir]
import { chromium, ensureSession, BASE, redact } from "./common.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({ options: {
  series: { type: "string", default: "adhoc" }, mode: { type: "string", default: "warm" },
  pairs: { type: "string", default: "small:large" }, reps: { type: "string", default: "10" },
  "second-tab": { type: "boolean", default: false }, out: { type: "string", default: "/home/monkey/code/noctua-mail/wt-perf-switch-2/.tmp/e2e/results" },
  "settle-ms": { type: "string", default: "500" }, "timeout-ms": { type: "string", default: "30000" },
} });
const REPS = Number(args.reps), SETTLE = Number(args["settle-ms"]), TIMEOUT = Number(args["timeout-ms"]);
const NAMES = { small: "Kleine Praxis", medium: "Mittlere Praxis", large: "Grosse Praxis", folders: "Viele Ordner" };
const ID = k => `spike-${k}`;
const STREAM = /\/api\/me\/events|\/imap\/stream/;
mkdirSync(args.out, { recursive: true });

const INIT = () => {
  // Runs before any app script. Observation only.
  const w = window;
  w.__spike = { mut: [], lt: [], marks: {}, watch: null };
  try {
    new PerformanceObserver(list => { for (const e of list.getEntries()) w.__spike.lt.push({ start: e.startTime, dur: e.duration }); })
      .observe({ type: "longtask", buffered: true });
  } catch {}
  const check = () => {
    const s = w.__spike, wt = s.watch; if (!wt) return;
    const now = performance.now();
    const set = (k, ok) => { if (ok && s.marks[k] === undefined) s.marks[k] = now; };
    const cur = document.querySelector('[data-sidebar="menu-button"][aria-current="true"]');
    set("highlight", !!cur && (cur.textContent ?? "").includes(wt.name));
    set("oldRowsGone", !document.querySelector(`[data-folder-id^="${wt.from}:"]`) || ![...document.querySelectorAll("[data-message-id]")].some(r => (r.textContent ?? "").includes(` ${wt.fromKey} #`)));
    set("folders", !!document.querySelector(`[data-folder-id^="${wt.id}:"]`));
    set("folderTreeComplete", document.querySelectorAll(`[data-folder-id^="${wt.id}:"]`).length >= wt.minFolders);
    const rows = document.querySelectorAll("[data-message-id]");
    let match = 0; for (const r of rows) { if ((r.textContent ?? "").includes(` ${wt.key} #`)) { match++; if (match >= 1) break; } }
    set("firstRows", match >= 1);
    const hdr = [...document.querySelectorAll("h1,h2,[data-slot='shell-header'] *")].some(e => e.childElementCount === 0 && (e.textContent ?? "") === wt.name);
    set("header", hdr);
  };
  const mo = new MutationObserver(records => {
    const s = w.__spike; if (!s.watch) return;
    s.mut.push({ t: performance.now(), n: records.length });
    check();
  });
  const start = () => mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  w.__spikeArm = (watch) => { w.__spike.mut = []; w.__spike.marks = {}; w.__spike.watch = watch; };
  w.__spikeCheck = check;
};

function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function pct(a, p) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)]; }

function attachNet(page, net) {
  page.on("request", req => {
    const e = { id: net.seq++, url: req.url(), method: req.method(), wall: Date.now(), req, done: false, failed: false };
    net.map.set(req, e); net.list.push(e);
  });
  const fin = async (req, failed) => {
    const e = net.map.get(req); if (!e) return;
    e.done = true; e.failed = failed; e.endWall = Date.now();
  };
  page.on("requestfinished", req => fin(req, false));
  // Chrome emits no loadingFinished for fetches whose body the app never reads (e.g. switch-account);
  // count those as done when the response headers arrived (body is tiny, server already ended it).
  page.on("response", resp => { const e = net.map.get(resp.request()); if (e) e.respWall = Date.now(); });
  page.on("requestfailed", req => fin(req, true));
}

async function describe(e, clickEpoch) {
  const t = e.req.timing();
  const resp = await e.req.response().catch(() => null);
  let bytes = null, serverTiming = null, status = resp?.status() ?? null;
  if (resp) {
    serverTiming = resp.headers()["server-timing"] ?? null;
    if (!STREAM.test(e.url) && e.done) { try { const sz = await e.req.sizes(); bytes = sz.responseBodySize; } catch {} }
  }
  const start = t.startTime > 0 ? t.startTime - clickEpoch : e.wall - clickEpoch;
  const rel = v => (v >= 0 ? v : null);
  return {
    url: redact(e.url), urlKey: (() => { const u = new URL(e.url); return (u.pathname + u.search).replace(/spike-(small|medium|large|folders)/g, "{acct:$1}"); })(), method: e.method, status, failed: e.failed, stream: STREAM.test(e.url),
    startMs: +start.toFixed(1),
    requestStartMs: rel(t.requestStart) !== null ? +(start + t.requestStart).toFixed(1) : null,
    ttfbMs: rel(t.responseStart) !== null && rel(t.requestStart) !== null ? +(t.responseStart - t.requestStart).toFixed(1) : null,
    stallMs: rel(t.requestStart) !== null ? +t.requestStart.toFixed(1) : null,
    endMs: rel(t.responseEnd) !== null ? +(start + t.responseEnd).toFixed(1) : (e.endWall ? e.endWall - clickEpoch : (!STREAM.test(e.url) && rel(t.responseStart) !== null ? +(start + t.responseStart).toFixed(1) : null)),
    durMs: rel(t.responseEnd) !== null ? +t.responseEnd.toFixed(1) : null,
    bytes, serverTiming, rawUrl: e.url,
  };
}

async function waitSettled(page, net, sinceIdx, clickEpoch, timeOrigin) {
  const t0 = Date.now();
  while (Date.now() - t0 < TIMEOUT) {
    await page.waitForTimeout(50);
    const pending = net.list.slice(sinceIdx).filter(e => !e.done && !STREAM.test(e.url) && !(e.respWall && Date.now() - e.respWall > 200));
    const s = await page.evaluate(() => ({ lastMut: window.__spike.mut.at(-1)?.t ?? 0, marks: window.__spike.marks }));
    const lastMutEpoch = s.lastMut ? timeOrigin + s.lastMut : clickEpoch;
    const lastNet = Math.max(clickEpoch, ...net.list.slice(sinceIdx).filter(e => !STREAM.test(e.url)).map(e => Math.max(e.wall, e.endWall ?? e.respWall ?? 0)));
    const quietSince = Math.max(lastMutEpoch, lastNet);
    if (!pending.length && s.marks.firstRows !== undefined && Date.now() - quietSince >= SETTLE) {
      return { settledEpoch: quietSince, timedOut: false };
    }
  }
  return { settledEpoch: Date.now(), timedOut: true };
}

async function switchOnce(page, net, fromKey, toKey, ctxInfo) {
  const watch = { id: ID(toKey), key: toKey, name: NAMES[toKey], from: ID(fromKey), fromKey, minFolders: toKey === "folders" ? 40 : 6 };
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await page.evaluate(w => window.__spikeArm(w), watch);
  const sinceIdx = net.list.length;
  const ltBefore = await page.evaluate(() => window.__spike.lt.length);
  // Click the target mailbox in the sidebar. t0 = performance.now() immediately before dispatch.
  const clickPerf = await page.evaluate((name) => {
    const btn = [...document.querySelectorAll('[data-sidebar="menu-button"]')].find(b => (b.textContent ?? "").includes(name) && b.closest('[data-sidebar="group"]')?.textContent?.includes("Postfächer"));
    if (!btn) throw new Error("mailbox button not found: " + name);
    const t = performance.now(); btn.click(); window.__spikeCheck(); return t;
  }, NAMES[toKey]);
  const clickEpoch = timeOrigin + clickPerf;
  const { settledEpoch, timedOut } = await waitSettled(page, net, sinceIdx, clickEpoch, timeOrigin);
  const page_ = await page.evaluate(({ clickPerf, ltBefore }) => {
    const s = window.__spike; const marks = {}; for (const [k, v] of Object.entries(s.marks)) marks[k] = +(v - clickPerf).toFixed(1);
    const lt = s.lt.slice(ltBefore).filter(e => e.start >= clickPerf - 1).map(e => ({ start: +(e.start - clickPerf).toFixed(1), dur: +e.dur.toFixed(1) }));
    const muts = s.mut.map(m => ({ t: +(m.t - clickPerf).toFixed(1), n: m.n }));
    const rows = document.querySelectorAll("[data-message-id]").length;
    const folders = document.querySelectorAll(`[data-folder-id^="${s.watch.id}:"]`).length;
    s.watch = null;
    return { marks, lt, muts, rows, folders };
  }, { clickPerf, ltBefore });
  const settledMs = +(settledEpoch - clickEpoch).toFixed(1);
  const reqs = [];
  for (const e of net.list.slice(sinceIdx)) reqs.push(await describe(e, clickEpoch));
  // requests in flight at click time (started before click, not done at click)
  const inflightAtClick = net.list.slice(0, sinceIdx).filter(e => !STREAM.test(e.url) && ((e.endWall ?? e.respWall ?? Infinity) > clickEpoch)).map(e => redact(e.url));
  const ltIn = page_.lt.filter(l => l.start <= settledMs);
  const mutIn = page_.muts.filter(m => m.t <= settledMs);
  const frames = new Set(mutIn.map(m => Math.floor(m.t / 16.7))).size;
  return {
    from: fromKey, to: toKey, ...ctxInfo, timedOut,
    marks: page_.marks, settledMs, rowsInDom: page_.rows, foldersInDom: page_.folders,
    longTasks: { count: ltIn.length, totalMs: +ltIn.reduce((a, b) => a + b.dur, 0).toFixed(1), maxMs: ltIn.length ? Math.max(...ltIn.map(l => l.dur)) : 0, list: ltIn },
    mutations: { records: mutIn.reduce((a, b) => a + b.n, 0), callbacks: mutIn.length, frames16ms: frames },
    requests: reqs.map(({ rawUrl, ...r }) => ({ ...r, oldAccount: rawUrl.includes(ID(fromKey)) })),
    inflightAtClick,
  };
}

async function openPage(ctx, net) {
  const page = await ctx.newPage();
  await page.addInitScript(INIT);
  attachNet(page, net);
  return page;
}

async function loadAndSettle(page, net, key) {
  const before = net.list.length;
  const t0 = Date.now();
  await page.goto("/");
  // Wait until the active mailbox's rows are present and the page is quiet for 1.5 s (initial load is not measured).
  await page.waitForFunction(k => [...document.querySelectorAll("[data-message-id]")].some(r => (r.textContent ?? "").includes(` ${k} #`)), key, { timeout: 60000 });
  let quietSince = Date.now(), lastCount = net.list.length;
  while (Date.now() - quietSince < 1500) {
    await page.waitForTimeout(100);
    const pending = net.list.slice(before).filter(e => !e.done && !STREAM.test(e.url)).length;
    if (net.list.length !== lastCount || pending) { lastCount = net.list.length; quietSince = Date.now(); }
  }
  return Date.now() - t0;
}

const uptime = () => execSync("uptime").toString().trim();
const browser = await chromium.launch({ headless: true });
const state = await ensureSession(browser);
const results = { series: args.series, mode: args.mode, secondTab: args["second-tab"], startedAt: new Date().toISOString(), uptimeBefore: uptime(), runs: [] };
const pairs = args.pairs.split(",").map(p => p.split(":"));
const ctx = await browser.newContext({ baseURL: BASE, storageState: state, viewport: { width: 1440, height: 900 }, locale: "de-DE" });
let second = null;
const setActive = async (key) => { const r = await ctx.request.post("/api/auth/switch-account", { data: { accountId: ID(key) }, headers: { origin: BASE } }); if (r.status() !== 200) throw new Error("switch-account " + r.status()); };
if (args["second-tab"]) {
  const net2 = { seq: 0, list: [], map: new Map() };
  second = await openPage(ctx, net2);
  await setActive(pairs[0][0]); await loadAndSettle(second, net2, pairs[0][0]);
  results.secondTabNet = net2;
}
for (const [a, b] of pairs) {
  if (args.mode === "cold") {
    for (let i = 0; i < REPS; i++) {
      const net = { seq: 0, list: [], map: new Map() };
      await setActive(a);
      const page = await openPage(ctx, net);
      const loadMs = await loadAndSettle(page, net, a);
      await page.waitForTimeout(500);
      const run = await switchOnce(page, net, a, b, { rep: i, mode: "cold", pageLoadMs: loadMs });
      results.runs.push(run);
      console.log(`${args.series} cold ${a}->${b} #${i}: highlight ${run.marks.highlight} folders ${run.marks.folders} firstRows ${run.marks.firstRows} settled ${run.settledMs} reqs ${run.requests.length} lt ${run.longTasks.count}/${run.longTasks.totalMs}`);
      await page.close();
    }
  } else {
    const net = { seq: 0, list: [], map: new Map() };
    await setActive(a);
    const page = await openPage(ctx, net);
    await loadAndSettle(page, net, a);
    await page.waitForTimeout(500);
    // first switch after load is the cold one; record it but tag it
    let cur = a;
    for (let i = 0; i < REPS * 2 + 1; i++) {
      const to = cur === a ? b : a;
      const run = await switchOnce(page, net, cur, to, { rep: i, mode: i === 0 ? "warm-first" : "warm" });
      results.runs.push(run);
      console.log(`${args.series} ${run.mode} ${cur}->${to} #${i}: highlight ${run.marks.highlight} folders ${run.marks.folders} firstRows ${run.marks.firstRows} settled ${run.settledMs} reqs ${run.requests.length} lt ${run.longTasks.count}/${run.longTasks.totalMs}`);
      cur = to;
      await page.waitForTimeout(1000);
    }
    await page.close();
  }
}
results.uptimeAfter = uptime();
if (results.secondTabNet) { const n = results.secondTabNet; results.secondTab = { requests: n.list.length, byUrl: Object.entries(n.list.reduce((m, e) => { const u = redact(e.url); m[u] = (m[u] ?? 0) + 1; return m; }, {})) }; delete results.secondTabNet; }
await browser.close();
// summary
const groups = {};
for (const r of results.runs) { const k = `${r.mode}:${r.from}->${r.to}`; (groups[k] ??= []).push(r); }
results.summary = Object.fromEntries(Object.entries(groups).map(([k, rs]) => [k, {
  n: rs.length,
  highlight: { p50: median(rs.map(r => r.marks.highlight).filter(v => v != null)), p90: pct(rs.map(r => r.marks.highlight).filter(v => v != null), 90) },
  folders: { p50: median(rs.map(r => r.marks.folders).filter(v => v != null)), p90: pct(rs.map(r => r.marks.folders).filter(v => v != null), 90) },
  firstRows: { p50: median(rs.map(r => r.marks.firstRows).filter(v => v != null)), p90: pct(rs.map(r => r.marks.firstRows).filter(v => v != null), 90) },
  settled: { p50: median(rs.map(r => r.settledMs)), p90: pct(rs.map(r => r.settledMs), 90) },
  requests: median(rs.map(r => r.requests.length)), longTaskMs: median(rs.map(r => r.longTasks.totalMs)), timeouts: rs.filter(r => r.timedOut).length,
}]));
const file = `${args.out}/${args.series}.json`;
writeFileSync(file, JSON.stringify(results, null, 1));
console.log(JSON.stringify(results.summary, null, 1));
console.log("wrote", file);
