import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// iOS home-screen app under the translucent status bar. Chromium cannot
// emulate env(safe-area-inset-*), so the second test sets the --sat/--sab
// tokens (app/globals.css) to notch-sized values on <html>:
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-ios-safe-area.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/ios-safe-area-evidence;
// IOS_SAFE_AREA_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE", hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const evidence = path.resolve(process.env.IOS_SAFE_AREA_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "ios-safe-area-evidence"));
const TOP = 47;
const BOTTOM = 34;
const VIEWPORT = { width: 390, height: 844 };

async function simulateInsets(page: Page) {
  await page.addInitScript(([top, bottom]) => {
    const apply = () => {
      document.documentElement.style.setProperty("--sat", `${top}px`);
      document.documentElement.style.setProperty("--sab", `${bottom}px`);
    };
    if (document.documentElement) apply();
    document.addEventListener("DOMContentLoaded", apply);
  }, [TOP, BOTTOM]);
}

const topOf = (page: Page, selector: string) => page.locator(selector).first().evaluate(el => {
  const box = el.getBoundingClientRect();
  return { top: Math.round(box.top), bottom: Math.round(box.bottom) };
});

/** The band under the status bar: height and colour of body::before. */
const band = (page: Page) => page.evaluate(() => {
  const style = getComputedStyle(document.body, "::before");
  return { height: parseFloat(style.height), background: style.backgroundColor, zIndex: Number(style.zIndex) };
});

async function openSidebar(page: Page) {
  await page.getByRole("button", { name: "Seitenleiste umschalten", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Seitenleiste", exact: true })).toBeVisible();
}

test("home-screen meta: translucent status bar, cover viewport, theme colour per scheme", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto("/");
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content", "black-translucent");
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  const themeColors = await page.locator('meta[name="theme-color"]').evaluateAll(metas =>
    metas.map(meta => ({ media: meta.getAttribute("media"), content: meta.getAttribute("content") })));
  expect(themeColors).toEqual([
    { media: "(prefers-color-scheme: light)", content: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", content: "#0a0a0a" }
  ]);
  // Without insets (desktop, Android, Safari tab) nothing moves and the band has no height.
  expect((await band(page)).height).toBe(0);
});

test("iPhone with a 47 px status bar: every top bar and frame starts below it", async ({ page, browser }) => {
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize(VIEWPORT);
  await simulateInsets(page);

  // Login screen.
  const anonymous = await browser.newContext({ locale: "de-DE", hasTouch: true, isMobile: true, viewport: VIEWPORT });
  const login = await anonymous.newPage();
  await simulateInsets(login);
  await login.goto("/");
  const loginFrame = login.locator("[data-shell]").filter({ has: login.getByRole("button", { name: "Anmelden", exact: true }) }).first();
  await expect(loginFrame).toBeVisible();
  await expect.poll(() => loginFrame.evaluate(el => getComputedStyle(el).paddingTop)).toBe(`${TOP + 16}px`);
  await login.screenshot({ path: path.join(evidence, "safe-area-390-login-light.png") });
  await anonymous.close();

  await signInQa(page);
  // The first sync of the fixture inbox can outlast one page load.
  const rows = page.locator('[data-message-list-row="true"]');
  await expect.poll(async () => {
    if (await rows.count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120000, intervals: [500] }).toBe(true);
  const results: Record<string, unknown>[] = [];
  for (const scheme of ["light", "dark"] as const) {
    await page.evaluate(value => { localStorage.setItem("noctua:theme", value); }, scheme);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
    const header = page.locator('[data-slot="shell-header"]');
    await expect(header).toBeVisible();
    await expect(rows.first()).toBeVisible();

    const statusBand = await band(page);
    expect(statusBand.height).toBe(TOP);
    expect(statusBand.zIndex).toBeGreaterThan(9999);
    // Light: iris behind iOS's white clock; dark: the dark header background.
    const headerBackground = await page.locator('[data-slot="sidebar-inset"]').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(statusBand.background).toBe(scheme === "light" ? "rgb(91, 91, 214)" : headerBackground);
    const list = await topOf(page, '[id="list"] aside');
    const shell = await topOf(page, '[data-slot="sidebar-wrapper"]');
    const result: Record<string, unknown> = { scheme, band: statusBand, header: await topOf(page, '[data-slot="shell-header"]'), list, shell };
    expect((result.header as { top: number }).top).toBe(TOP);
    expect(list.top).toBeGreaterThanOrEqual(TOP);
    // The shell and the list's scroll container reach the bottom edge; the home
    // indicator is padding inside the list, not an unused band below it.
    expect(shell.bottom).toBe(VIEWPORT.height);
    expect(list.bottom).toBe(VIEWPORT.height);
    expect(await page.locator('[id="list"] aside').evaluate(el => getComputedStyle(el).paddingBottom)).toBe(`${8 + BOTTOM}px`);
    // Floating notices clear the home indicator.
    expect(await page.locator(".inapp-notice-stack").first().evaluate(el => getComputedStyle(el).bottom)).toBe(`${40 + BOTTOM}px`);
    await page.screenshot({ path: path.join(evidence, `safe-area-390-list-${scheme}.png`) });

    // Reader: the shell header stays the top bar, "Zurück" follows below it.
    await rows.first().click();
    const back = page.getByRole("button", { name: "Zurück zu den Nachrichten", exact: true });
    await expect(back).toBeVisible();
    result.readerBack = await back.evaluate(el => Math.round(el.getBoundingClientRect().top));
    expect(result.readerBack as number).toBeGreaterThanOrEqual(TOP);
    const reader = page.locator("[data-reader-scroll]").filter({ visible: true }).first();
    expect(await reader.evaluate(el => ({ bottom: Math.round(el.getBoundingClientRect().bottom), paddingBottom: getComputedStyle(el).paddingBottom })))
      .toEqual({ bottom: VIEWPORT.height, paddingBottom: `${8 + BOTTOM}px` });
    await page.screenshot({ path: path.join(evidence, `safe-area-390-reader-${scheme}.png`) });

    // Phone sidebar sheet.
    await page.goto("/");
    await expect(header).toBeVisible();
    await openSidebar(page);
    const sidebarSheet = await topOf(page, '[data-slot="sidebar"][data-mobile="true"]');
    expect(sidebarSheet.top).toBe(TOP);
    expect(sidebarSheet.bottom).toBe(VIEWPORT.height);
    expect(await page.locator('[data-slot="sidebar"][data-mobile="true"]').evaluate(el => getComputedStyle(el).paddingBottom)).toBe(`${BOTTOM}px`);
    result.sidebarSheet = sidebarSheet;
    await page.screenshot({ path: path.join(evidence, `safe-area-390-sidebar-${scheme}.png`) });

    // Fullscreen settings frame.
    await page.getByRole("button", { name: "Benutzermenü", exact: true }).click();
    await page.getByRole("menuitem", { name: "Einstellungen", exact: true }).click();
    const settings = page.locator(".account-settings-modal");
    await expect(settings).toBeVisible();
    // Let the dialog's open animation settle.
    await expect.poll(() => settings.evaluate(el => Math.round(el.getBoundingClientRect().top))).toBe(0);
    const tabs = await settings.locator('[role="tablist"]').first().evaluate(el => Math.round(el.getBoundingClientRect().top));
    const frame = await settings.evaluate(el => ({ top: Math.round(el.getBoundingClientRect().top), paddingTop: getComputedStyle(el).paddingTop, paddingBottom: getComputedStyle(el).paddingBottom }));
    expect(frame).toMatchObject({ top: 0, paddingTop: `${TOP}px`, paddingBottom: `${BOTTOM}px` });
    expect(tabs).toBeGreaterThanOrEqual(TOP);
    result.settings = { ...frame, tabs };
    await page.screenshot({ path: path.join(evidence, `safe-area-390-settings-${scheme}.png`) });

    // Fullscreen compose.
    await page.goto("/");
    await expect(header).toBeVisible();
    await openSidebar(page);
    await page.locator('[data-shell-action="compose"]').click();
    const compose = page.locator('[role="dialog"][aria-modal="true"]').filter({ has: page.locator("[contenteditable]") }).first();
    await expect(compose).toBeVisible();
    const composeBox = await compose.evaluate(el => ({
      top: Math.round(el.getBoundingClientRect().top),
      firstChildTop: Math.round(el.firstElementChild!.getBoundingClientRect().top),
      paddingBottom: getComputedStyle(el).paddingBottom
    }));
    expect(composeBox.top).toBe(0);
    expect(composeBox.firstChildTop).toBeGreaterThanOrEqual(TOP);
    expect(composeBox.paddingBottom).toBe(`${12 + BOTTOM}px`);
    result.compose = composeBox;
    await page.screenshot({ path: path.join(evidence, `safe-area-390-compose-${scheme}.png`) });
    results.push(result);
  }
  console.log("ios-safe-area", JSON.stringify(results));
});

test("home-screen app (display-mode: standalone): frames take the whole screen height", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await simulateInsets(page);
  await page.goto("/");
  // Chromium cannot emulate display-mode, so apply the shipped standalone
  // rules (WebKit bug 301108 workaround) unconditionally and measure.
  const standaloneRules = await page.evaluate(() => {
    const texts: string[] = [];
    for (const sheet of [...document.styleSheets]) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; }
      const walk = (list: CSSRuleList) => {
        for (const rule of [...list]) {
          if (rule instanceof CSSMediaRule && rule.conditionText.includes("display-mode: standalone")) {
            texts.push(...[...rule.cssRules].map(inner => inner.cssText));
          } else if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules);
        }
      };
      walk(rules);
    }
    const style = document.createElement("style");
    style.textContent = texts.join("\n");
    document.head.append(style);
    return texts;
  });
  expect(standaloneRules.join(" ")).toContain("--app-height: 100lvh");
  expect(standaloneRules.join(" ")).toMatch(/html \{ min-height: min\(100lvh, calc\(100% \+ var\(--sat\)\)\); \}/);
  const sizes = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.height = "var(--app-height)";
    document.body.append(probe);
    const appHeight = probe.getBoundingClientRect().height;
    probe.remove();
    return { appHeight, html: document.documentElement.getBoundingClientRect().height, main: document.querySelector("main")!.getBoundingClientRect().height };
  });
  expect(sizes).toEqual({ appHeight: VIEWPORT.height, html: VIEWPORT.height, main: VIEWPORT.height });
  // The page fills the screen without becoming scrollable.
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBe(VIEWPORT.height);
});
