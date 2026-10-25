import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// iOS home-screen app with the opaque status bar: the page starts below the
// bar (top inset 0) and only the home indicator (bottom inset) pads. Chromium
// cannot emulate env(safe-area-inset-*), so the tests set the --sat/--sab
// tokens (app/globals.css) to device values on <html>:
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-ios-safe-area.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/ios-safe-area-evidence;
// IOS_SAFE_AREA_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE", hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const evidence = path.resolve(process.env.IOS_SAFE_AREA_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "ios-safe-area-evidence"));
// Opaque status bar: no top inset; home indicator: 34 px.
const TOP = 0;
const BOTTOM = 34;
const VIEWPORT = { width: 390, height: 844 };

async function simulateInsets(page: Page, top = TOP, bottom = BOTTOM) {
  await page.addInitScript(([top, bottom]) => {
    const apply = () => {
      document.documentElement.style.setProperty("--sat", `${top}px`);
      document.documentElement.style.setProperty("--sab", `${bottom}px`);
    };
    if (document.documentElement) apply();
    document.addEventListener("DOMContentLoaded", apply);
  }, [top, bottom]);
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

/** The rendered colour behind the phone's top bar and the theme-color metas, as hex. */
const topBarAndThemeColor = (page: Page) => page.evaluate(() => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d")!;
  const header = document.querySelector('[data-slot="shell-header"]')!;
  // The header is transparent; the first painted ancestor gives the bar its colour.
  let element: Element | null = header;
  while (element && getComputedStyle(element).backgroundColor === "rgba(0, 0, 0, 0)") element = element.parentElement;
  context.fillStyle = getComputedStyle(element!).backgroundColor;
  context.fillRect(0, 0, 1, 1);
  const bar = "#" + [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)].map(value => value.toString(16).padStart(2, "0")).join("");
  return { bar, meta: [...new Set([...document.querySelectorAll('meta[name="theme-color"]')].map(meta => meta.getAttribute("content")))] };
});

async function openSidebar(page: Page) {
  await page.getByRole("button", { name: "Seitenleiste umschalten", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Seitenleiste", exact: true })).toBeVisible();
}

test("home-screen meta: opaque status bar, cover viewport, theme colour per scheme", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto("/");
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content", "default");
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  // The server renders one theme-color per system scheme (first paint; the
  // opaque iOS bar takes it) ...
  const html = await (await page.request.get("/")).text();
  const served = [...html.matchAll(/<meta[^>]*name="theme-color"[^>]*>/g)].map(match => match[0]);
  expect(served).toHaveLength(2);
  expect(served[0]).toContain('media="(prefers-color-scheme: light)"');
  expect(served[0]).toContain('content="#ffffff"');
  expect(served[1]).toContain('media="(prefers-color-scheme: dark)"');
  expect(served[1]).toContain('content="#0a0a0a"');
  // ... and the client keeps both on the resolved app theme (here: system = dark).
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect.poll(() => page.locator('meta[name="theme-color"]').evaluateAll(metas => metas.map(meta => meta.getAttribute("content"))))
    .toEqual(["#0a0a0a", "#0a0a0a"]);
  // The early iOS detection ships inline in <head> and leaves Chromium unmarked;
  // its built (minified) source marks an iOS 26 home-screen app.
  await expect(page.locator("html")).not.toHaveAttribute("data-ios-standalone", "");
  expect(await page.evaluate(() => {
    const source = document.getElementById("ios-standalone")?.textContent ?? "";
    const env: Record<string, unknown> = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
      platform: "iPhone", maxTouchPoints: 5, standalone: true };
    for (const [key, value] of Object.entries(env)) Object.defineProperty(navigator, key, { configurable: true, value });
    new Function(source)();
    return document.documentElement.hasAttribute("data-ios-standalone");
  })).toBe(true);
  // Without insets (desktop, Android, Safari tab) nothing moves and the band has no height.
  expect((await band(page)).height).toBe(0);
});

test("iPhone with the opaque status bar: frames start at the top, reach the bottom and pad for the home indicator", async ({ page, browser }) => {
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

    // Nothing is drawn under the opaque bar: no band. The bar takes theme-color,
    // which follows the theme chosen in the app (white / dark header colour).
    const statusBand = await band(page);
    expect(statusBand.height).toBe(0);
    await expect.poll(() => page.locator('meta[name="theme-color"]').evaluateAll(metas => metas.map(meta => meta.getAttribute("content"))))
      .toEqual(scheme === "light" ? ["#ffffff", "#ffffff"] : ["#0a0a0a", "#0a0a0a"]);
    // The opaque status bar (theme-color) is exactly the top bar's colour, also
    // with the list scrolled, so iOS shows no seam above the header.
    expect(await topBarAndThemeColor(page)).toEqual({ bar: scheme === "light" ? "#ffffff" : "#0a0a0a", meta: [scheme === "light" ? "#ffffff" : "#0a0a0a"] });
    await page.locator('[id="list"] aside').evaluate(el => { el.scrollTop = 400; });
    expect(await topBarAndThemeColor(page)).toEqual({ bar: scheme === "light" ? "#ffffff" : "#0a0a0a", meta: [scheme === "light" ? "#ffffff" : "#0a0a0a"] });
    await page.locator('[id="list"] aside').evaluate(el => { el.scrollTop = 0; });
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
    // Opening a mail keeps the same top bar, so the status bar colour does not change.
    expect(await topBarAndThemeColor(page)).toEqual({ bar: scheme === "light" ? "#ffffff" : "#0a0a0a", meta: [scheme === "light" ? "#ffffff" : "#0a0a0a"] });
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

// iOS 26 home-screen app: the early script marks <html data-ios-standalone>
// (lib/ui/iosStandalone.ts; Chromium is no iPhone, so the test sets it) and
// every view's top bar gets the 6px --top-spacer in its own colour.
const SPACER = 6;
test("iOS 26 home-screen app: a 6px spacer above each top bar, the list still reaches the bottom", async ({ page, browser }) => {
  mkdirSync(evidence, { recursive: true });
  const markIosStandalone = () => document.addEventListener("DOMContentLoaded", () => document.documentElement.setAttribute("data-ios-standalone", ""));
  await page.setViewportSize(VIEWPORT);
  await simulateInsets(page);
  await page.addInitScript(markIosStandalone);

  const anonymous = await browser.newContext({ locale: "de-DE", hasTouch: true, isMobile: true, viewport: VIEWPORT });
  const login = await anonymous.newPage();
  await simulateInsets(login);
  await login.addInitScript(markIosStandalone);
  await login.goto("/");
  const loginFrame = login.locator("[data-shell]").filter({ has: login.getByRole("button", { name: "Anmelden", exact: true }) }).first();
  await expect(loginFrame).toBeVisible();
  await expect.poll(() => loginFrame.evaluate(el => getComputedStyle(el).paddingTop)).toBe(`${16 + SPACER}px`);
  await anonymous.close();

  await signInQa(page);
  const rows = page.locator('[data-message-list-row="true"]');
  await expect.poll(async () => {
    if (await rows.count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120000, intervals: [500] }).toBe(true);
  await page.evaluate(() => { localStorage.setItem("noctua:theme", "dark"); });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ios-standalone", "");
  const header = page.locator('[data-slot="shell-header"]');
  await expect(rows.first()).toBeVisible();
  const headerBox = await header.evaluate(el => ({ top: Math.round(el.getBoundingClientRect().top), height: Math.round(el.getBoundingClientRect().height), paddingTop: getComputedStyle(el).paddingTop }));
  // The header starts at the top and carries the spacer itself, so the spacer has the header's colour.
  expect(headerBox).toEqual({ top: 0, height: 48 + SPACER, paddingTop: `${SPACER}px` });
  expect((await topBarAndThemeColor(page)).bar).toBe("#0a0a0a");
  const list = await topOf(page, '[id="list"] aside');
  expect(list).toEqual({ top: 48 + SPACER, bottom: VIEWPORT.height });
  await page.screenshot({ path: path.join(evidence, "spacer-390-list-dark.png") });

  // Reader: same top bar, nothing jumps when a mail opens.
  await rows.first().click();
  await expect(page.getByRole("button", { name: "Zurück zu den Nachrichten", exact: true })).toBeVisible();
  expect(await header.evaluate(el => Math.round(el.getBoundingClientRect().height))).toBe(48 + SPACER);
  await page.screenshot({ path: path.join(evidence, "spacer-390-reader-dark.png") });

  // Sidebar sheet head.
  await page.goto("/");
  await openSidebar(page);
  const sidebarHead = page.locator('[data-slot="sidebar"][data-mobile="true"] [data-slot="sidebar-header"]');
  expect(await sidebarHead.evaluate(el => getComputedStyle(el).paddingTop)).toBe(`${8 + SPACER}px`);
  await page.screenshot({ path: path.join(evidence, "spacer-390-sidebar-dark.png") });

  // Fullscreen settings and compose.
  await page.getByRole("button", { name: "Benutzermenü", exact: true }).click();
  await page.getByRole("menuitem", { name: "Einstellungen", exact: true }).click();
  const settings = page.locator(".account-settings-modal");
  await expect(settings).toBeVisible();
  expect(await settings.evaluate(el => getComputedStyle(el).paddingTop)).toBe(`${SPACER}px`);
  await page.goto("/");
  await openSidebar(page);
  await page.locator('[data-shell-action="compose"]').click();
  const compose = page.locator('[role="dialog"][aria-modal="true"]').filter({ has: page.locator("[contenteditable]") }).first();
  await expect(compose).toBeVisible();
  expect(await compose.evaluate(el => getComputedStyle(el).paddingTop)).toBe(`${12 + SPACER}px`);
});

// Chromium cannot emulate display-mode, so apply the shipped standalone rules
// unconditionally and measure, for the opaque bar (top inset 0) and for an
// install from before it (translucent bar, 47 px top inset, WebKit bug 301108).
for (const top of [TOP, 47]) {
  test(`home-screen app (display-mode: standalone, top inset ${top} px): frames take the screen height without scrolling`, async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await simulateInsets(page, top);
    await page.goto("/");
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
    expect(standaloneRules.join(" ")).toMatch(/--app-height: min\(100lvh, calc\(100dvh \+ var\(--sat\)\)\)/);
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
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBe(VIEWPORT.height);
  });
}
