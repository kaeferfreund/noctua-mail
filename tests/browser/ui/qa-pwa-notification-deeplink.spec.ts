import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { signInQa } from "./qaRound2Session";
import { parseDeepLink, serializeDeepLink, emptyDeepLink } from "../../../lib/navigation/deepLinks";
import { PENDING_OPEN_CACHE, PENDING_OPEN_URL } from "../../../lib/push/pendingOpen";
import { totpFromUri } from "../../helpers/totp";

// Notification tap in the phone app opens the notified message, also across a sign-in
// (briefs/fix/pwa-notification-deeplink.md):
// QA_DEEP_LINKS_FIXTURE=1 QA_NOTIFICATION_FIXTURE=1 QA_SHELL_SPEC=qa-pwa-notification-deeplink.spec.ts
// QA_SHELL_PORT=4140 bun scripts/runQaShellBrowserTests.ts
test.use({ locale: "en-GB" });
const rows = (page: Page) => page.locator('[data-message-list-row="true"]');
const single = (page: Page) => page.locator('[data-message-list-row="true"]:not([data-thread-child="true"])')
  .filter({ hasNot: page.getByTitle(/ in thread$/) });
const state = (page: Page) => parseDeepLink(new URL(page.url()).search);
const evidence = process.env.PWA_DEEPLINK_EVIDENCE_DIR ?? ".tmp/pwa-notification-deeplink-evidence";
async function shot(page: Page, name: string) { mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/${name}.png` }); }

let cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
const ids: Record<string, string[]> = {};
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-GB", baseURL: process.env.QA_SHELL_BASE_URL });
  const page = await context.newPage(); await signInQa(page); cookies = await context.cookies();
  for (const account of ["qa-second", "qa-third", "qa-shared"]) {
    await page.goto(`/?a=~${account}`);
    await expect.poll(() => state(page).folderId).toBe(`${account}:INBOX`);
    await expect(rows(page).first()).toBeVisible();
    ids[account] = await single(page).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-message-id")!));
    expect(ids[account].length).toBeGreaterThanOrEqual(2);
  }
  await context.close();
});

/** The message public/sw.js `notificationclick` posts to an open window. */
async function notificationClick(page: Page, url: string) {
  await page.evaluate(target => {
    navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "noctua:notification-open", url: target } }));
  }, url);
}
/** What public/sw.js `notificationclick` stores before it focuses or opens a window. */
async function storeTap(page: Page, url: string) {
  await page.evaluate(async ([name, key, target]) => {
    await (await caches.open(name)).put(key, new Response(JSON.stringify({ url: target, at: Date.now() })));
  }, [PENDING_OPEN_CACHE, PENDING_OPEN_URL, url] as const);
}
const storedTap = (page: Page) => page.evaluate(async ([name, key]) => Boolean(await (await caches.open(name)).match(key)), [PENDING_OPEN_CACHE, PENDING_OPEN_URL] as const);
/** The phone app comes back to the foreground, as it does when a notification is tapped. */
async function foreground(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
}
const notificationUrl = (accountId: string, messageId: string) =>
  serializeDeepLink({ ...emptyDeepLink(), accountId, folderId: `${accountId}:INBOX`, messageId });

async function expectReader(page: Page, accountId: string, messageId: string) {
  await expect.poll(() => [state(page).accountId, state(page).messageId]).toEqual([accountId, messageId]);
  await expect(page.getByRole("button", { name: "Back to messages", exact: true })).toBeVisible();
  await expect(page.locator(`[data-message-list-row="true"][data-message-id="${messageId}"]`)).toHaveCount(1);
}
/** The login form the shell shows for an expired session. Waits out the fixture's login budget (three per ten seconds). */
async function signInForm(page: Page) {
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await page.waitForTimeout(11000);
  const [seed] = JSON.parse(readFileSync(process.env.QA_SHELL_SEED_FILE!, "utf8"));
  await page.locator('input[name="email"]').fill(seed.email);
  await page.locator('input[name="password"]').fill(seed.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator('input[name="code"]').fill(totpFromUri(seed.totpURI));
  await page.locator('form button[type="submit"]').click();
}
async function openMailbox(page: Page, accountId: string) {
  await page.goto(`/?a=~${accountId}`);
  await expect.poll(() => state(page).folderId).toBe(`${accountId}:INBOX`);
  await expect(rows(page).first()).toBeVisible();
}
/** The phone reader of another message stays open when the app goes to the background. */
async function openReader(page: Page, accountId: string, messageId: string) {
  await page.locator(`[data-message-list-row="true"][data-message-id="${messageId}"]`).click();
  await expectReader(page, accountId, messageId);
}

test.describe("phone", () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); });

  test("a: app open — the notified message opens, from the list and from the reader of another message", async ({ page }) => {
    await page.context().addCookies(cookies);
    await openMailbox(page, "qa-shared");
    await notificationClick(page, notificationUrl("qa-shared", ids["qa-shared"][1]));
    await expectReader(page, "qa-shared", ids["qa-shared"][1]);
    await notificationClick(page, notificationUrl("qa-second", ids["qa-second"][1]));
    await expectReader(page, "qa-second", ids["qa-second"][1]);
    await openMailbox(page, "qa-third");
    await openReader(page, "qa-third", ids["qa-third"][0]);
    await foreground(page);
    await notificationClick(page, notificationUrl("qa-third", ids["qa-third"][1]));
    await expectReader(page, "qa-third", ids["qa-third"][1]);
    await shot(page, "a-app-open-phone");
  });

  // The sign-in restores the user's own mailbox (qa-second), so neither target is on screen
  // afterwards: "same mailbox" expires at the message read, "other mailbox" at the switch.
  for (const [label, from, to] of [["same mailbox", "qa-shared", "qa-shared"], ["other mailbox", "qa-second", "qa-third"]] as const) {
    test(`b: expired session, ${label} — after sign-in the notified message opens`, async ({ page }) => {
      await page.context().addCookies(cookies);
      await openMailbox(page, from);
      await openReader(page, from, ids[from][0]);
      await page.context().clearCookies();
      await notificationClick(page, notificationUrl(to, ids[to][1]));
      await signInForm(page);
      await expectReader(page, to, ids[to][1]);
      await shot(page, `b-expired-${from === to ? "same" : "other"}-mailbox-phone`);
    });
  }

  test("b: expired session, the foreground session check runs before the notification message", async ({ page }) => {
    await page.context().addCookies(cookies);
    await openMailbox(page, "qa-shared");
    await page.context().clearCookies();
    await foreground(page);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await notificationClick(page, notificationUrl("qa-third", ids["qa-third"][1]));
    await shot(page, "b-sign-in-screen-phone");
    await signInForm(page);
    await expectReader(page, "qa-third", ids["qa-third"][1]);
  });

  test("c: cold start with the notification URL and an expired session — after sign-in the message opens", async ({ page }) => {
    await page.goto(notificationUrl("qa-second", ids["qa-second"][1]));
    await signInForm(page);
    await expectReader(page, "qa-second", ids["qa-second"][1]);
    await shot(page, "c-cold-start-expired-phone");
  });

  // iOS can lose the worker's message (inert window, page reloaded on resume); the stored
  // target opens the message (briefs/fix/pwa-notification-pending-open.md).
  test("d: page reloaded after the tap, the target only in the store — the reader opens", async ({ page }) => {
    await page.context().addCookies(cookies);
    await openMailbox(page, "qa-second");
    await storeTap(page, notificationUrl("qa-shared", ids["qa-shared"][1]));
    await page.reload();
    await expectReader(page, "qa-shared", ids["qa-shared"][1]);
    expect(await storedTap(page)).toBe(false);
    await shot(page, "d-reloaded-store-phone");
  });

  test("d: app in the foreground, the message lost — becoming visible opens the stored target once", async ({ page }) => {
    await page.context().addCookies(cookies);
    await openMailbox(page, "qa-third");
    await storeTap(page, notificationUrl("qa-third", ids["qa-third"][1]));
    await foreground(page);
    await expectReader(page, "qa-third", ids["qa-third"][1]);
    expect(await storedTap(page)).toBe(false);
    // Back to the list; a later foreground does not open the message again.
    await page.getByRole("button", { name: "Back to messages", exact: true }).click();
    await expect.poll(() => state(page).messageId).toBe("");
    await foreground(page);
    await page.waitForTimeout(1500);
    expect(state(page).messageId).toBe("");
    await shot(page, "d-foreground-store-phone");
  });

  test("forbidden: a notification for a mailbox without membership keeps the notice and stays put", async ({ page }) => {
    await page.context().addCookies(cookies);
    await openMailbox(page, "qa-shared");
    await notificationClick(page, notificationUrl("qa-not-a-member", "imap-0123456789abcdef01234567"));
    await expect(page.getByText("You do not have access to this mailbox.")).toBeVisible();
    await expect.poll(() => state(page).accountId).toBe("qa-shared");
    await expect(rows(page).first()).toBeVisible();
  });
});
