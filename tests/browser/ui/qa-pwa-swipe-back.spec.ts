import { test, expect, chromium, devices, webkit, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { signInQa } from "./qaRound2Session";

// iPhone home-screen app: the edge swipe is Back. A notification tap opens the closed app
// with clients.openWindow, whose window starts with an empty entry before the app; Back
// showed that entry (white) and a reload kept it (briefs/fix/pwa-swipe-back-white-screen.md).
// WebKit and Chromium, both with the iPhone profile and navigator.standalone:
//   QA_SHELL_SPEC=qa-pwa-swipe-back.spec.ts QA_SHELL_PORT=<port> bun scripts/runQaShellBrowserTests.ts
// QA_WEBKIT_EXECUTABLE points at a WebKit launcher on hosts without its system libraries.
test.use({ locale: "en-GB" });
const evidence = process.env.PWA_SWIPE_BACK_EVIDENCE_DIR ?? ".tmp/pwa-swipe-back-evidence";
const rows = (page: Page) => page.locator('[data-message-list-row="true"]');
const readerBack = (page: Page) => page.getByRole("button", { name: "Back to messages", exact: true });
const where = (page: Page) => page.evaluate(() => ({ url: `${location.pathname}${location.search}`, state: history.state as Record<string, unknown> | null }));

let cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
let messageId = "";
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-GB", baseURL: process.env.QA_SHELL_BASE_URL });
  const page = await context.newPage(); await signInQa(page); cookies = await context.cookies();
  await expect(rows(page).first()).toBeVisible();
  messageId = (await rows(page).first().getAttribute("data-message-id"))!;
  await context.close();
});

/** The list or the reader of the app, not the empty entry before it. */
async function expectApp(page: Page) {
  expect(page.url()).not.toBe("about:blank");
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  await expect(rows(page).first().or(readerBack(page)).first()).toBeVisible();
  expect(await page.evaluate(() => document.querySelector("main")?.textContent?.trim().length ?? 0)).toBeGreaterThan(0);
}
/** The edge swipe. Back within the app is same-document and may not report a navigation. */
async function swipeBack(page: Page) {
  await page.goBack({ timeout: 10_000 }).catch(() => null);
  await page.waitForTimeout(300);
}

for (const engine of ["webkit", "chromium"] as const) {
  test.describe(engine, () => {
    let browser: Browser;
    test.beforeAll(async () => {
      browser = engine === "webkit" ? await webkit.launch({ executablePath: process.env.QA_WEBKIT_EXECUTABLE || undefined }) : await chromium.launch();
    });
    test.afterAll(async () => { await browser.close(); });
    async function phone(standalone = true) {
      const { defaultBrowserType: _engine, ...iphone } = devices["iPhone 13"];
      const context = await browser.newContext({ ...iphone, viewport: { width: 390, height: 844 }, locale: "en-GB", baseURL: process.env.QA_SHELL_BASE_URL });
      await context.addCookies(cookies);
      if (standalone) await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "standalone", { get: () => true, configurable: true }));
      // A new page starts on an empty entry, as the window clients.openWindow creates.
      return { context, page: await context.newPage() };
    }
    async function shot(page: Page, name: string) {
      mkdirSync(evidence, { recursive: true });
      await page.screenshot({ path: `${evidence}/${engine}-${name}.png` });
    }
    const notificationUrl = () => `/?a=~qa-shared&f=INBOX&m=~${messageId}`;

    test("root cause: without the trap, Back from a notification-opened app shows the empty entry and a reload keeps it", async () => {
      const { context, page } = await phone(false);
      await page.goto(notificationUrl());
      await expect(readerBack(page)).toBeVisible();
      await swipeBack(page);
      await expectApp(page);
      await swipeBack(page);
      expect(page.url()).toBe("about:blank");
      await page.reload();
      expect(page.url()).toBe("about:blank");
      expect(await page.evaluate(() => document.body?.innerText.trim() ?? "")).toBe("");
      await shot(page, "root-cause-browser-tab-blank");
      await context.close();
    });

    test("notification tap: Back goes reader → list and then stays in the app, also after a reload", async () => {
      const { context, page } = await phone();
      await page.goto(notificationUrl());
      await expect(readerBack(page)).toBeVisible();
      await shot(page, "notification-reader");
      await swipeBack(page);
      await expectApp(page);
      await expect(readerBack(page)).toBeHidden();
      const list = await where(page);
      expect(list.url).toBe("/?a=%7Eqa-shared&f=INBOX");
      for (let n = 0; n < 3; n++) {
        await swipeBack(page);
        await expectApp(page);
        expect(await where(page)).toMatchObject({ url: list.url, state: { noctuaRootTrap: true, noctuaUrl: true, noctuaMessageEntry: false } });
      }
      await shot(page, "notification-back-stays");
      await page.reload();
      await expectApp(page);
      await swipeBack(page);
      await expectApp(page);
      expect((await where(page)).url).toBe(list.url);
      // The reader still opens and closes with Back on top of the trap.
      await rows(page).first().click();
      await expect(readerBack(page)).toBeVisible();
      await swipeBack(page);
      await expect(readerBack(page)).toBeHidden();
      await expectApp(page);
      await context.close();
    });

    test("the notification URL is the final app URL: no redirect adds another entry", async () => {
      const { context, page } = await phone();
      const response = await page.request.get(notificationUrl(), { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      await context.close();
    });

    const entries: Array<[string, (page: Page) => Promise<void>]> = [
      ["cold start", async () => {}],
      ["reader", async page => { await rows(page).first().click(); await expect(readerBack(page)).toBeVisible(); }],
      ["sidebar", async page => { await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click(); await expect(page.getByRole("dialog", { name: "Sidebar" })).toBeVisible(); }],
      ["settings", async page => {
        await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
        await page.getByRole("button", { name: "User menu", exact: true }).click();
        await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
        await expect(page.getByRole("dialog").last()).toBeVisible();
      }],
      ["compose", async page => {
        await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
        await page.locator('[data-shell-action="compose"]').click();
        await expect.poll(() => new URL(page.url()).searchParams.has("c")).toBe(true);
      }],
      ["invite link", async page => { await page.goto("/#invite=synthetic-code"); }]
    ];
    for (const [name, open] of entries) {
      test(`home-screen start, ${name}: Back once, twice and a reload keep the app`, async () => {
        const { context, page } = await phone();
        await page.goto("/");
        await expectApp(page);
        await open(page);
        await swipeBack(page);
        await expectApp(page);
        // Back keeps unsent text in a minimized composer; every other Sheet or dialog closes.
        if (name === "compose") await expect.poll(() => new URL(page.url()).searchParams.has("c")).toBe(false);
        else await expect(page.getByRole("dialog")).toHaveCount(0);
        await swipeBack(page);
        await expectApp(page);
        await page.reload();
        await expectApp(page);
        await swipeBack(page);
        await expectApp(page);
        if (name === "sidebar" || name === "reader") await shot(page, `${name.replace(/ /g, "-")}-back-twice-reload`);
        await context.close();
      });
    }

    test("a stale overlay or reader marker in history.state renders the list after a reload", async () => {
      const { context, page } = await phone();
      await page.goto("/");
      await expectApp(page);
      await page.evaluate(() => history.replaceState({ ...history.state, noctuaMobileOverlay: 7, noctuaMobileView: "thread", noctuaMessageEntry: true }, ""));
      await page.reload();
      await expectApp(page);
      await expect(rows(page).first()).toBeVisible();
      await swipeBack(page);
      await expectApp(page);
      await context.close();
    });

    test("an app root that stays empty is reported as a blank screen", async () => {
      const { context, page } = await phone();
      await page.goto("/");
      await expectApp(page);
      const report = page.waitForRequest(request => request.url().endsWith("/api/client-errors") && request.method() === "POST", { timeout: 10_000 });
      // An empty <main> ahead of the app's own stands in for a root that rendered nothing; React's tree stays untouched.
      await page.evaluate(() => {
        document.body.prepend(document.createElement("main"));
        const restore = new PageTransitionEvent("pageshow", { persisted: true });
        window.dispatchEvent(restore);
      });
      const body = (await report).postDataJSON();
      expect(body).toMatchObject({ source: "watchdog", kind: "blank-screen", standalone: true,
        blank: { search: "?a=%7Eqa-shared&f=INBOX", historyStateKeys: expect.arrayContaining(["noctuaRootTrap"]), visibilityState: "visible", trigger: "pageshow" } });
      // Both engines share one session: the second report within the minute meets the route's limit.
      expect([204, 429]).toContain((await (await report).response())?.status());
      await context.close();
    });
  });
}
