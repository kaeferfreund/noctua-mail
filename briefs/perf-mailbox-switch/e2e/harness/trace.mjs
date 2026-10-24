// Chrome trace of single warm switches; summarises renderer main-thread time by top-level event between click and +settleMs.
// Usage: node trace.mjs --pairs small:large,large:small --window 1500
import { chromium, ensureSession, BASE } from "./common.mjs";
import { writeFileSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
const { values: args } = parseArgs({ options: { pairs: { type: "string", default: "small:large,large:small" }, window: { type: "string", default: "1500" }, reps: { type: "string", default: "3" } } });
const NAMES = { small: "Kleine Praxis", medium: "Mittlere Praxis", large: "Grosse Praxis", folders: "Viele Ordner" };
const WIN = Number(args.window);
const browser = await chromium.launch({ headless: true });
const state = await ensureSession(browser);
const ctx = await browser.newContext({ baseURL: BASE, storageState: state, viewport: { width: 1440, height: 900 }, locale: "de-DE" });
const summary = [];
for (const [a, b] of args.pairs.split(",").map(p => p.split(":"))) {
  await ctx.request.post("/api/auth/switch-account", { data: { accountId: `spike-${a}` }, headers: { origin: BASE } });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForFunction(k => [...document.querySelectorAll("[data-message-id]")].some(r => (r.textContent ?? "").includes(` ${k} #`)), a, { timeout: 60000 });
  await page.waitForTimeout(3000);
  let cur = a;
  // warm-up switch pair, then traced switches
  for (const to of [b, a]) { await page.evaluate(n => [...document.querySelectorAll('[data-sidebar="menu-button"]')].find(x => (x.textContent ?? "").includes(n)).click(), NAMES[to]); await page.waitForTimeout(3000); }
  for (let i = 0; i < Number(args.reps) * 2; i++) {
    const to = cur === a ? b : a;
    const path = `/tmp/spike-switch-e2e/tmp/trace-${cur}-${to}-${i}.json`;
    await browser.startTracing(page, { path, categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "v8", "blink.user_timing"] });
    const clickTs = await page.evaluate(n => { const t = performance.now(); performance.mark("spike-click"); [...document.querySelectorAll('[data-sidebar="menu-button"]')].find(x => (x.textContent ?? "").includes(n)).click(); return t; }, NAMES[to]);
    await page.waitForTimeout(WIN + 500);
    await browser.stopTracing();
    const trace = JSON.parse(readFileSync(path, "utf8"));
    const ev = trace.traceEvents ?? trace;
    const mark = ev.find(e => e.name === "spike-click");
    const threads = {}; for (const e of ev) if (e.name === "thread_name") threads[`${e.pid}:${e.tid}`] = e.args.name;
    const mainKey = mark ? `${mark.pid}:${mark.tid}` : Object.entries(threads).find(([, n]) => n === "CrRendererMain")?.[0];
    const t0 = mark?.ts ?? 0;
    const top = ev.filter(e => `${e.pid}:${e.tid}` === mainKey && e.ph === "X" && e.ts >= t0 && e.ts <= t0 + WIN * 1000);
    // top-level = not nested inside another X event on the same thread
    top.sort((x, y) => x.ts - y.ts);
    const byName = {}; let end = 0; let busy = 0;
    const detail = {};
    for (const e of top) {
      if (e.ts >= end) { byName[e.name] = (byName[e.name] ?? 0) + e.dur / 1000; busy += e.dur / 1000; end = e.ts + e.dur; }
      if (["FunctionCall", "Layout", "UpdateLayoutTree", "Paint", "PrePaint", "MinorGC", "MajorGC", "V8.GC_MC_BACKGROUND_MARKING", "ParseHTML", "EvaluateScript", "v8.compile", "RunMicrotasks", "TimerFire", "EventDispatch", "FireAnimationFrame", "Commit", "Layerize", "ResourceReceivedData", "HitTest"].includes(e.name)) detail[e.name] = (detail[e.name] ?? 0) + e.dur / 1000;
    }
    const r = { from: cur, to, i, windowMs: WIN, mainThreadBusyMs: +busy.toFixed(1), topLevel: Object.fromEntries(Object.entries(byName).map(([k, v]) => [k, +v.toFixed(1)]).sort((x, y) => y[1] - x[1]).slice(0, 8)), inclusive: Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, +v.toFixed(1)]).sort((x, y) => y[1] - x[1])) };
    summary.push(r); console.log(JSON.stringify(r));
    cur = to;
    await page.waitForTimeout(1500);
  }
  await page.close();
}
writeFileSync("/tmp/spike-switch-e2e/results/trace-summary.json", JSON.stringify({ at: new Date().toISOString(), summary }, null, 1));
await browser.close();
