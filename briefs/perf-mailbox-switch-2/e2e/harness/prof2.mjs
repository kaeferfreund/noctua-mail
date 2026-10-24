// CDP Profiler (100 µs sampling) over warm switches; aggregates inclusive time per function inside
// [threads responseEnd, first rows] (segment H) and [click, settled+] windows.
import { chromium, ensureSession, BASE } from "./common.mjs";
import { writeFileSync } from "node:fs";
const NAMES = { small: "Kleine Praxis", medium: "Mittlere Praxis", large: "Grosse Praxis", folders: "Viele Ordner" };
const [a, b] = (process.argv[2] ?? "small:large").split(":"); const REPS = Number(process.argv[3] ?? 4); const OUT = process.argv[4] ?? "../tmp/prof2";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ baseURL: BASE, storageState: await ensureSession(browser), viewport: { width: 1440, height: 900 }, locale: "de-DE" });
await ctx.request.post("/api/auth/switch-account", { data: { accountId: `spike-${a}` }, headers: { origin: BASE } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__fr = null; window.__watchKey = null; new MutationObserver(() => { if (window.__watchKey && window.__fr === null && [...document.querySelectorAll("[data-message-id]")].some(r => (r.textContent ?? "").includes(` ${window.__watchKey} #`))) window.__fr = performance.now(); }).observe(document, { subtree: true, childList: true, characterData: true }); });
await page.goto("/");
await page.waitForFunction(k => [...document.querySelectorAll("[data-message-id]")].some(r => (r.textContent ?? "").includes(` ${k} #`)), a, { timeout: 60000 });
await page.waitForTimeout(3000);
const cdp = await ctx.newCDPSession(page); await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
const H = {}, ALL = {}; let nH = 0;
const click = n => page.evaluate(n => { const spikeClickMarker = () => { const e = performance.now() + 3; while (performance.now() < e) {} }; spikeClickMarker(); const t = performance.now(); [...document.querySelectorAll('[data-sidebar="menu-button"]')].find(x => (x.textContent ?? "").includes(n)).click(); return t; }, n);
for (const to of [b, a]) { await click(NAMES[to]); await page.waitForTimeout(2500); }
for (let i = 0; i < REPS; i++) {
  await page.evaluate(k => { window.__fr = null; window.__watchKey = k; performance.clearResourceTimings(); }, b);
  await cdp.send("Profiler.start");
  const t0 = await click(NAMES[b]); await page.waitForTimeout(2000);
  const { profile } = await cdp.send("Profiler.stop");
  const info = await page.evaluate(() => ({ fr: window.__fr, origin: performance.timeOrigin, th: performance.getEntriesByType("resource").filter(e => /\/threads\?/.test(e.name)).map(e => e.responseEnd) }));
  writeFileSync(`${OUT}-${b}-${i}.cpuprofile`, JSON.stringify(profile));
  // profile.startTime is in µs on the monotonic clock; map via the click: first sample after click ≈ t0. Use performance.now() domain: Profiler timestamps share the same base as performance.now()*1000 + timeOrigin offset? Use relative alignment: assume profile.startTime corresponds to click - small epsilon.
  const nodes = new Map(profile.nodes.map(n => [n.id, n])); const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  let ts = profile.startTime; let markTs = null; { let x = profile.startTime; for (let k = 0; k < profile.samples.length; k++) { x += profile.timeDeltas[k]; if (nodes.get(profile.samples[k])?.callFrame.functionName === "spikeClickMarker") markTs = x; } }
  const base = markTs ?? profile.startTime; const thEnd = Math.max(...info.th); const winH = [thEnd - t0, info.fr - t0];
  for (let k = 0; k < profile.samples.length; k++) {
    ts += profile.timeDeltas[k]; const rel = (ts - base) / 1000; const dt = (profile.timeDeltas[k + 1] ?? 0) / 1000;
    let n = nodes.get(profile.samples[k]); if (!n || n.callFrame.functionName === "(idle)") continue;
    const inH = rel >= winH[0] && rel <= winH[1]; const seen = new Set();
    while (n) { const l = `${n.callFrame.functionName || "(anon)"} @ ${(n.callFrame.url || "").split("/").pop()}:${n.callFrame.lineNumber}`; if (!seen.has(l)) { seen.add(l); ALL[l] = (ALL[l] ?? 0) + dt / REPS; if (inH) H[l] = (H[l] ?? 0) + dt / REPS; } const p = parent.get(n.id); n = p ? nodes.get(p) : null; }
  }
  console.log(`rep ${i}: threads end ${winH[0].toFixed(0)} first rows ${winH[1].toFixed(0)} H ${(winH[1] - winH[0]).toFixed(0)}`);
  await click(NAMES[a]); await page.waitForTimeout(2500);
}
const show = (title, agg) => { console.log(title); for (const [k, v] of Object.entries(agg).sort((x, y) => y[1] - x[1]).filter(([k]) => process.env.ANON || !k.startsWith("(anon)")).slice(0, Number(process.env.TOP ?? 60))) console.log(v.toFixed(1).padStart(7), k); };
show("== segment H (threads end -> first rows), inclusive ms per switch", H);
if (process.env.ALLWIN) show("== click .. +2000 ms", ALL);
await browser.close();
