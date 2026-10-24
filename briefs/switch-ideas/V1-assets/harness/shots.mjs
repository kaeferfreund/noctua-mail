// Sidebar screenshots (desktop 1440x900 and 390 px) + pending state with a delayed folders read. Synthetic data only.
import { chromium, ensureSession, BASE } from "./common.mjs";
const OUT = "/home/monkey/code/noctua-mail/repo/wt-switch-tree/.tmp/e2e/shots";
const browser = await chromium.launch({ headless: true });
const state = await ensureSession(browser);
const settle = (page) => page.waitForSelector('[data-folder-id^="spike-folders:"]', { timeout: 20000 }).then(() => page.waitForTimeout(1500));
const r = await (await browser.newContext({ baseURL: BASE, storageState: state })).request.post("/api/auth/switch-account", { data: { accountId: "spike-folders" }, headers: { origin: BASE } });
console.log("switch", r.status());
for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile-390", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ baseURL: BASE, storageState: state, viewport, locale: "de-DE", deviceScaleFactor: name === "desktop" ? 1 : 2 });
  const page = await ctx.newPage(); await page.goto("/");
  if (name === "desktop") {
    await settle(page);
    await page.locator('[data-folder-id^="spike-folders:"]').nth(3).hover(); await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}-sidebar-hover.png`, clip: { x: 0, y: 0, width: 360, height: 900 } });
    // Pending state: hold the next folders read for 2 s, click another mailbox, capture the busy row.
    await page.route("**/api/accounts/spike-small/folders", async route => { await new Promise(res => setTimeout(res, 2000)); await route.continue(); });
    await page.locator('[data-sidebar="menu-button"]', { hasText: "Kleine Praxis" }).click();
    await page.waitForTimeout(300);
    const busy = await page.locator('[data-sidebar="menu-button"][aria-busy="true"]').count();
    const current = await page.locator('[data-sidebar="menu-button"][aria-current="true"]').textContent();
    console.log("pending: busy rows", busy, "aria-current on", current);
    await page.screenshot({ path: `${OUT}/${name}-sidebar-pending.png`, clip: { x: 0, y: 0, width: 360, height: 420 } });
    await page.waitForTimeout(2500);
    console.log("after settle: busy rows", await page.locator('[data-sidebar="menu-button"][aria-busy="true"]').count(), "aria-current on", await page.locator('[data-sidebar="menu-button"][aria-current="true"]').textContent());
    // Folder menu opened by keyboard on the active folder row.
    await page.locator('[data-folder-id="spike-small:INBOX"]').focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
    console.log("menu items", await page.getByRole("menuitem").allTextContents());
    await page.screenshot({ path: `${OUT}/${name}-folder-menu-keyboard.png`, clip: { x: 0, y: 0, width: 420, height: 900 } });
    await page.keyboard.press("Escape");
  } else {
    await page.waitForTimeout(3000);
    await page.locator('[data-sidebar="trigger"]').first().click(); await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${name}-sidebar.png` });
  }
  await ctx.close();
}
await browser.close();
