import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { signInQa } from "./qaRound2Session";
import { parseDeepLink, serializeDeepLink, emptyDeepLink } from "../../../lib/navigation/deepLinks";
import { totpFromUri } from "../../helpers/totp";

// White page after notification click → read → mailbox switch (briefs/fix/notification-open-crash.md):
// QA_DEEP_LINKS_FIXTURE=1 QA_NOTIFICATION_FIXTURE=1 QA_SHELL_SPEC=qa-notification-open.spec.ts
// QA_SHELL_PORT=4130 bun scripts/runQaShellBrowserTests.ts
// The fixture runner owns all synthetic storage and processes.
test.use({ locale: "en-GB" });
const rows = (page: Page) => page.locator('[data-message-list-row="true"]');
const single = (page: Page) => page.locator('[data-message-list-row="true"]:not([data-thread-child="true"])')
  .filter({ hasNot: page.getByTitle(/ in thread$/) });
const state = (page: Page) => parseDeepLink(new URL(page.url()).search);
const evidence = process.env.NOTIFICATION_OPEN_EVIDENCE_DIR ?? ".tmp/notification-open-evidence";
async function shot(page: Page, name: string) { mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/${name}.png` }); }

let cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
/** Message ids per mailbox, read once the mailboxes have synced. */
const ids: Record<string, string[]> = {};
/** Messages that belong to a thread with several messages in INBOX. */
const threads: Record<string, string[]> = {};
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-GB", baseURL: process.env.QA_SHELL_BASE_URL });
  const page = await context.newPage(); await signInQa(page); cookies = await context.cookies();
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const account of ["qa-second", "qa-third", "qa-shared"]) {
    await page.goto(`/?a=~${account}`);
    await expect.poll(() => state(page).folderId).toBe(`${account}:INBOX`);
    await expect(rows(page).first()).toBeVisible();
    ids[account] = await single(page).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-message-id")!));
    expect(ids[account].length).toBeGreaterThanOrEqual(2);
    const list = await (await page.request.get(`/api/accounts/${account}/messages?folderId=${encodeURIComponent(`${account}:INBOX`)}&pageSize=200`)).json();
    const messages = list.items as Array<{ id: string; threadId?: string | null }>;
    threads[account] = messages.filter(message => message.threadId && messages.filter(other => other.threadId === message.threadId).length > 1).map(message => message.id);
    expect(threads[account].length).toBeGreaterThan(6);
  }
  await context.close();
});

/** Every uncaught render error must surface here instead of as a silent white page. */
let watched: string[] = [];
test.afterEach(async ({ page }, info) => { if (info.status !== info.expectedStatus) console.log("failure URL", page.url(), "browser errors", JSON.stringify(watched, null, 1)); });
function watchErrors(page: Page) {
  const errors: string[] = []; watched = errors;
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}\n${error.stack ?? ""}`));
  page.on("response", response => { if (response.status() >= 400) errors.push(`http ${response.status()} ${response.url()}`); });
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  return errors;
}
const fatal = (errors: string[]) => errors.filter(line => line.startsWith("pageerror") || /Minified React error|The above error occurred/.test(line));

/** The same path as public/sw.js `notificationclick` for an open window. */
async function notificationClick(page: Page, url: string) {
  await page.evaluate(target => {
    navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "noctua:notification-open", url: target } }));
  }, url);
}
const notificationUrl = (accountId: string, messageId: string) =>
  serializeDeepLink({ ...emptyDeepLink(), accountId, folderId: `${accountId}:INBOX`, messageId });

async function expectShell(page: Page, errors: string[]) {
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  expect(fatal(errors)).toEqual([]);
}
async function switchMailbox(page: Page, name: RegExp, accountId: string) {
  const mobile = page.viewportSize()!.width < 768;
  const scope = mobile ? page.getByRole("dialog", { name: "Sidebar", exact: true }) : page;
  if (mobile) await page.locator('[data-slot="shell-header"]').getByRole("button", { name: "Toggle sidebar", exact: true }).click();
  await scope.getByRole("button", { name }).click();
  await expect.poll(() => state(page).accountId).toBe(accountId);
  await expect(rows(page).first()).toBeVisible();
}
async function expectReader(page: Page, accountId: string, messageId: string) {
  await expect.poll(() => [state(page).accountId, state(page).messageId]).toEqual([accountId, messageId]);
  await expect(page.viewportSize()!.width < 768 ? page.getByRole("button", { name: "Back to messages", exact: true })
    : page.locator("[data-reader-toolbar]").first()).toBeVisible();
  // Auto mark-read runs after the personal dwell (default 1 s).
  await page.waitForTimeout(1600);
}

for (const [label, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]] as const) {
  test.describe(label, () => {
    test.beforeEach(async ({ page }) => {
      await page.context().addCookies(cookies); await page.setViewportSize({ width, height });
    });

    test("warm notification click into another mailbox, read, switch mailboxes", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto("/?a=~qa-shared"); await expect(rows(page).first()).toBeVisible();
      const target = ids["qa-second"][1];
      await notificationClick(page, notificationUrl("qa-second", target));
      await expectReader(page, "qa-second", target);
      await expectShell(page, errors);
      if (label === "phone") {
        await page.getByRole("button", { name: "Back to messages", exact: true }).click();
        await expect.poll(() => state(page).messageId).toBe("");
        await expectShell(page, errors);
        await notificationClick(page, notificationUrl("qa-second", ids["qa-second"][0]));
        await expectReader(page, "qa-second", ids["qa-second"][0]);
      }
      await switchMailbox(page, /QA Third/, "qa-third");
      await expectShell(page, errors);
      await switchMailbox(page, /QA Shared/, "qa-shared");
      await expectShell(page, errors);
      // A second notification while a reader of the previous mailbox is open.
      await single(page).first().click();
      await notificationClick(page, notificationUrl("qa-third", ids["qa-third"][1]));
      await expectReader(page, "qa-third", ids["qa-third"][1]);
      await switchMailbox(page, /QA Second/, "qa-second");
      await expectShell(page, errors);
      await page.goBack(); await page.goBack();
      await expectShell(page, errors);
    });

    test("cold start with the notification URL, read, switch mailboxes", async ({ page }) => {
      const errors = watchErrors(page);
      const target = ids["qa-second"][1];
      await page.goto(notificationUrl("qa-second", target));
      await expectReader(page, "qa-second", target);
      await expectShell(page, errors);
      if (label === "phone") {
        await page.goBack();
        await expect.poll(() => state(page).messageId).toBe("");
        await expectShell(page, errors);
        await page.goForward();
        await expectReader(page, "qa-second", target);
      }
      await switchMailbox(page, /QA Third/, "qa-third");
      await expectShell(page, errors);
      await switchMailbox(page, /QA Second/, "qa-second");
      await expectShell(page, errors);
    });

    test("notification for a missing or moved message, then switch mailboxes", async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto("/?a=~qa-shared"); await expect(rows(page).first()).toBeVisible();
      await notificationClick(page, notificationUrl("qa-second", "imap-0123456789abcdef01234567"));
      await expect(page.getByText("This message is no longer available. The folder remains open.")).toBeVisible();
      await expect.poll(() => state(page).accountId).toBe("qa-second");
      await expectShell(page, errors);
      await switchMailbox(page, /QA Third/, "qa-third");
      await expectShell(page, errors);
      // The notification names INBOX, the message is found elsewhere by the resolver.
      await notificationClick(page, serializeDeepLink({ ...emptyDeepLink(), accountId: "qa-second", folderId: "qa-second:Archive", messageId: ids["qa-second"][1] }));
      await expectReader(page, "qa-second", ids["qa-second"][1]);
      await switchMailbox(page, /QA Shared/, "qa-shared");
      await expectShell(page, errors);
      await page.goto(notificationUrl("qa-third", "imap-0123456789abcdef01234567"));
      await expect(page.getByText("This message is no longer available. The folder remains open.")).toBeVisible();
      await switchMailbox(page, /QA Second/, "qa-second");
      await expectShell(page, errors);
    });
  });
}

test("stress: notification clicks interleaved with mailbox switches on a slow network", async ({ page }) => {
  await page.context().addCookies(cookies);
  const errors = watchErrors(page);
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  await page.route("**/api/**", async route => { await new Promise(resolve => setTimeout(resolve, 50 + random() * 900)); await route.fallback(); });
  const mailboxes = [[/QA Shared/, "qa-shared"], [/QA Second/, "qa-second"], [/QA Third/, "qa-third"]] as const;
  const pick = () => mailboxes[Math.floor(random() * mailboxes.length)];
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/?a=~qa-shared"); await expect(rows(page).first()).toBeVisible();
    for (let step = 0; step < 14; step++) {
      const [name] = pick();
      const [, other] = pick();
      await notificationClick(page, notificationUrl(other, ids[other][Math.floor(random() * ids[other].length)]));
      await page.waitForTimeout(random() * 2500);
      const mobile = width < 768;
      if (mobile) {
        const back = page.getByRole("button", { name: "Back to messages", exact: true });
        if (random() < 0.5 && await back.isVisible()) await back.click();
        await page.locator('[data-slot="shell-header"]').getByRole("button", { name: "Toggle sidebar", exact: true }).click();
        await page.getByRole("dialog", { name: "Sidebar", exact: true }).getByRole("button", { name }).click();
      } else await page.getByRole("button", { name }).click();
      await page.waitForTimeout(random() * 1500);
      if (random() < 0.3) await page.goBack();
      await expectShell(page, errors);
    }
  }
});

for (const [label, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]] as const) {
  test(`${label}: notifications for thread replies, read, switch mailboxes`, async ({ page }) => {
    await page.context().addCookies(cookies); await page.setViewportSize({ width, height });
    const errors = watchErrors(page);
    await page.goto("/?a=~qa-shared"); await expect(rows(page).first()).toBeVisible();
    for (const [index, [from, to, name]] of ([["qa-second", "qa-third", /QA Third/], ["qa-third", "qa-shared", /QA Shared/], ["qa-shared", "qa-second", /QA Second/]] as const).entries()) {
      for (const messageId of [threads[from][index], threads[from].at(-1 - index)!]) {
        await notificationClick(page, notificationUrl(from, messageId));
        await expectReader(page, from, messageId);
        await expectShell(page, errors);
      }
      await switchMailbox(page, name, to);
      await expectShell(page, errors);
    }
  });
}

/** The login form the shell shows for an expired session. */
async function signInForm(page: Page) {
  const [seed] = JSON.parse(readFileSync(process.env.QA_SHELL_SEED_FILE!, "utf8"));
  await page.locator('input[name="email"]').fill(seed.email);
  await page.locator('input[name="password"]').fill(seed.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator('input[name="code"]').fill(totpFromUri(seed.totpURI));
  await page.locator('form button[type="submit"]').click();
}
for (const [label, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]] as const) {
  test(`${label}: expired session — cold and warm notification open, sign in, read, switch mailboxes`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = watchErrors(page);
    const target = threads["qa-second"][2];
    await page.goto(notificationUrl("qa-second", target));
    await signInForm(page);
    await expectReader(page, "qa-second", target);
    await switchMailbox(page, /QA Third/, "qa-third");
    await expectShell(page, errors);
    // The session expires while the app sits in the background.
    await page.context().clearCookies();
    await notificationClick(page, notificationUrl("qa-shared", threads["qa-shared"][3]));
    await page.waitForTimeout(13000); // Login rate budget of the fixture (three per ten seconds).
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await signInForm(page);
    // The notification's message is not reopened after this sign-in (noted in the report); the shell must stay usable.
    await expectShell(page, errors);
    await switchMailbox(page, /QA Second/, "qa-second");
    await expectShell(page, errors);
    await switchMailbox(page, /QA Third/, "qa-third");
    await expectShell(page, errors);
  });
}

test.describe("crash screen", () => {
  // The German UI the household uses; the language follows Accept-Language.
  test.use({ locale: "de-DE" });
  for (const [label, width, height] of [["desktop", 1440, 900], ["phone", 390, 844]] as const) {
    test(`${label}: a render crash shows the crash screen instead of a white page and is reported`, async ({ page }) => {
      await page.context().addCookies(cookies); await page.setViewportSize({ width, height });
      // Date formatting runs while the list renders; failing it on demand stands in for any render error.
      await page.addInitScript(() => {
        const crash = () => { if (sessionStorage.getItem("qa-render-crash") === "1") throw new TypeError("Synthetic render crash"); };
        for (const [target, key] of [[Intl.DateTimeFormat.prototype, "format"], [Intl.DateTimeFormat.prototype, "formatToParts"],
          [Date.prototype, "toLocaleDateString"], [Date.prototype, "toLocaleTimeString"], [Date.prototype, "toLocaleString"]] as const) {
          const original = Object.getOwnPropertyDescriptor(target, key)!;
          Object.defineProperty(target, key, { ...original, ...original.get
            ? { get() { const value = original.get!.call(this); return function (this: unknown, ...args: unknown[]) { crash(); return value.apply(this, args); }; } }
            : { value: function (this: unknown, ...args: unknown[]) { crash(); return (original.value as (...a: unknown[]) => unknown).apply(this, args); } } });
        }
      });
      const link = `${notificationUrl("qa-second", threads["qa-second"][1])}&q=synthetic`;
      const shell = page.locator('[data-slot="shell-header"]');
      await page.goto(link); await expect(shell).toBeVisible();
      await page.evaluate(() => sessionStorage.setItem("qa-render-crash", "1"));
      const reported = page.waitForResponse(response => response.url().endsWith("/api/client-errors"));
      await page.reload();
      const screen = page.locator("[data-crash-screen]");
      await expect(screen.getByRole("heading", { name: "Die Oberfläche ist abgestürzt" })).toBeVisible();
      const response = await reported;
      expect(response.status()).toBe(204);
      const body = JSON.parse(response.request().postData()!);
      expect(body).toMatchObject({ source: "boundary", message: "TypeError: Synthetic render crash", path: "/", queryKeys: ["a", "f", "m", "q"] });
      expect(JSON.stringify(body)).not.toMatch(/\bsynthetic\b/); // The value of q stays in the browser.
      await shot(page, `crash-screen-${label}`);
      await expect(screen.getByRole("link", { name: "Zur Startseite" })).toHaveAttribute("href", "/");
      await page.evaluate(() => sessionStorage.setItem("qa-render-crash", "0"));
      await screen.getByRole("button", { name: "Neu laden" }).click();
      await expect(shell).toBeVisible();
      await expect(screen).toHaveCount(0);
    });
  }
});
