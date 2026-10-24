// V8 CPU profile (via tracing ProfileChunk samples) of warm switches; self time by function + script chunk, window = click..+1500 ms.
import { chromium, ensureSession, BASE } from "./common.mjs";
import { writeFileSync, readFileSync } from "node:fs";
const NAMES = { small: "Kleine Praxis", medium: "Mittlere Praxis", large: "Grosse Praxis", folders: "Viele Ordner" };
const pairs = (process.argv[2] ?? "small:large,large:folders").split(",").map(p => p.split(":"));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ baseURL: BASE, storageState: await ensureSession(browser), viewport: { width: 1440, height: 900 }, locale: "de-DE" });
const click = (page, n) => page.evaluate(n => { performance.mark("spike-click"); [...document.querySelectorAll('[data-sidebar="menu-button"]')].find(x => (x.textContent ?? "").includes(n)).click(); }, n);
const out = [];
for (const [a, b] of pairs) {
  await ctx.request.post("/api/auth/switch-account", { data: { accountId: `spike-${a}` }, headers: { origin: BASE } });
  const page = await ctx.newPage(); await page.goto("/");
  await page.waitForFunction(k => [...document.querySelectorAll("[data-message-id]")].some(r => (r.textContent ?? "").includes(` ${k} #`)), a, { timeout: 60000 });
  await page.waitForTimeout(3000);
  for (const to of [b, a]) { await click(page, NAMES[to]); await page.waitForTimeout(3000); }
  const agg = {}; let total = 0;
  for (let i = 0; i < 2; i++) {
    const path = `/tmp/spike-switch-e2e/tmp/prof-${a}-${b}-${i}.json`;
    await browser.startTracing(page, { path, categories: ["disabled-by-default-v8.cpu_profiler", "devtools.timeline", "blink.user_timing"] });
    await click(page, NAMES[b]); await page.waitForTimeout(2000);
    await browser.stopTracing();
    const ev = JSON.parse(readFileSync(path, "utf8")).traceEvents;
    const mark = ev.find(e => e.name === "spike-click");
    const nodes = new Map(); let t = null; const samples = [];
    for (const e of ev.filter(e => e.name === "ProfileChunk" && e.pid === mark.pid).sort((x, y) => x.ts - y.ts)) {
      const d = e.args.data; const cp = d.cpuProfile ?? {};
      for (const n of cp.nodes ?? []) nodes.set(n.id, n);
      const deltas = d.timeDeltas ?? []; (cp.samples ?? []).forEach((s, k) => { t = (t ?? (ev.find(x => x.name === "Profile" && x.pid === mark.pid)?.args?.data?.startTime ?? e.ts)) + deltas[k]; samples.push([t, s]); });
    }
    for (let k = 1; k < samples.length; k++) {
      const [ts, id] = samples[k]; if (ts < mark.ts || ts > mark.ts + 1500000) continue;
      const dt = (ts - samples[k - 1][0]) / 1000; const n = nodes.get(id)?.callFrame ?? {};
      if (n.functionName === "(idle)" || n.functionName === "(program)") continue;
      const key = `${n.functionName || "(anon)"} @ ${(n.url || "").split("/").pop()}:${n.lineNumber}`;
      agg[key] = (agg[key] ?? 0) + dt; total += dt;
    }
    await page.waitForTimeout(1000); await click(page, NAMES[a]); await page.waitForTimeout(3000);
  }
  const top = Object.entries(agg).sort((x, y) => y[1] - x[1]).slice(0, 25).map(([k, v]) => [k, +(v / 2).toFixed(1)]);
  out.push({ from: a, to: b, perSwitchSampledJsMs: +(total / 2).toFixed(1), topSelf: top });
  console.log(`${a}->${b} sampled JS ${(total / 2).toFixed(0)} ms/switch`); for (const [k, v] of top.slice(0, 18)) console.log(`  ${String(v).padStart(7)}  ${k}`);
  await page.close();
}
writeFileSync("/tmp/spike-switch-e2e/results/cpu-profile-summary.json", JSON.stringify({ at: new Date().toISOString(), out }, null, 1));
await browser.close();
