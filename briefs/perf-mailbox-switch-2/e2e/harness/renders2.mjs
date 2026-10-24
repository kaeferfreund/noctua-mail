// Records MailClient commits (instrumented scratch build) around warm switches.
import { chromium, ensureSession, BASE } from "./common.mjs";
const NAMES = { small: "Kleine Praxis", medium: "Mittlere Praxis", large: "Grosse Praxis", folders: "Viele Ordner" };
const [a, b] = (process.argv[2] ?? "small:large").split(":"); const REPS = Number(process.argv[3] ?? 2);
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ baseURL: BASE, storageState: await ensureSession(browser), viewport: { width: 1440, height: 900 }, locale: "de-DE" });
await ctx.request.post("/api/auth/switch-account", { data: { accountId: `spike-${a}` }, headers: { origin: BASE } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__fr = null; window.__watchKey = null; new MutationObserver(() => { if (window.__watchKey && window.__fr === null && [...document.querySelectorAll("[data-message-id]")].some(r => (r.textContent ?? "").includes(` ${window.__watchKey} #`))) window.__fr = performance.now(); }).observe(document, { subtree: true, childList: true, characterData: true }); });
await page.goto("/");
await page.waitForFunction(k => [...document.querySelectorAll("[data-message-id]")].some(r => (r.textContent ?? "").includes(` ${k} #`)), a, { timeout: 60000 });
await page.waitForTimeout(3000);
const click = n => page.evaluate(n => { const t = performance.now(); [...document.querySelectorAll('[data-sidebar="menu-button"]')].find(x => (x.textContent ?? "").includes(n)).click(); return t; }, n);
for (const to of [b, a]) { await click(NAMES[to]); await page.waitForTimeout(2500); }
for (let i = 0; i < REPS; i++) {
  await page.evaluate(k => { window.__fr = null; window.__watchKey = k; window.__mc = []; }, b);
  const t0 = await click(NAMES[b]); await page.waitForTimeout(2000);
  const { mc, fr } = await page.evaluate(() => ({ mc: window.__mc, fr: window.__fr }));
  console.log(`-- ${a}->${b} rep ${i} firstRows ${Math.round(fr - t0)} commits ${mc.length}`);
  let prev = null;
  for (const c of mc) { const diff = (c.changed ?? []).join(" "); console.log(`  render ${Math.round(c.r0 - t0)}..${Math.round(c.r - t0)} (${(c.r - c.r0).toFixed(1)}ms) commit ${Math.round(c.c - t0)} mt ${Math.round(c.mt - t0)} t0 ${Math.round(c.t - t0)}  ${diff.slice(0, 400)}`); }
  await click(NAMES[a]); await page.waitForTimeout(2500);
}
await browser.close();
