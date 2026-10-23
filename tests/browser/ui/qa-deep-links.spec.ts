import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { signInQa, openQaMenu } from "./qaRound2Session";
import { parseDeepLink, serializeDeepLink, emptyDeepLink, encodeDeepLinkId } from "../../../lib/navigation/deepLinks";
import { totpFromUri } from "../../helpers/totp";

// QA_DEEP_LINKS_FIXTURE=1 QA_SHELL_SPEC=qa-deep-links.spec.ts QA_SHELL_PORT=4110
// QA_SHELL_FIXTURE_IMAP_PORT=4111 QA_SHELL_FIXTURE_CONTROL_PORT=4112
// QA_SHELL_FIXTURE_SMTP_PORT=4113 bun scripts/runQaShellBrowserTests.ts
// The fixture runner owns all synthetic storage and processes.
test.use({ locale: "en-GB" });
const rows = (page: Page) => page.locator('[data-message-list-row="true"]');
const active = (page: Page) => page.locator('[data-message-list-row="true"][data-active="true"]');
const search = (page: Page) => {
  const params = new URL(page.url()).searchParams;
  const state = parseDeepLink(params.toString());
  return { get: (key: string) => {
    if (key === "accountId") return state.accountId || null;
    if (key === "folderId") return state.folderId || null;
    if (key === "openMessageId") return state.messageId || null;
    return params.get(key);
  } };
};
const evidence = process.env.DEEP_LINKS_EVIDENCE_DIR ?? ".tmp/deep-links-evidence";
let cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-GB", baseURL: process.env.QA_SHELL_BASE_URL });
  const page = await context.newPage(); await signInQa(page); cookies = await context.cookies(); await context.close();
});
test.afterEach(async ({ page }, info) => { if (info.status !== info.expectedStatus) { console.log("deep-link failure URL", page.url()); console.log("history trace", await page.locator("html").getAttribute("data-history-trace")); } });
test.beforeEach(async ({ page }) => {
  await page.context().addCookies(cookies); await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?a=~qa-shared"); await expect(rows(page).first()).toBeVisible();
  await expect.poll(() => search(page).get("folderId")).toBe("qa-shared:INBOX");
});
async function traceHistory(page: Page) {
  await page.evaluate(() => {
    const trace: unknown[] = [];
    for (const mode of ["pushState", "replaceState"] as const) {
      const original = history[mode].bind(history);
      history[mode] = (data, unused, url) => {
        trace.push({ mode, url }); document.documentElement.dataset.historyTrace = JSON.stringify(trace);
        return original(data, unused, url);
      };
    }
    window.addEventListener("popstate", () => { trace.push({ mode: "popstate", url: location.href }); document.documentElement.dataset.historyTrace = JSON.stringify(trace); });
  });
}
async function shot(page: Page, name: string) { mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true }); }

test("URL reader: reload, fresh login, Back to list then previous mailbox, Forward", async ({ page, browser }) => {
  await traceHistory(page);
  const switchWrites: string[] = [];
  page.on("request", request => { if (request.url().endsWith("/api/auth/switch-account")) switchWrites.push(request.postDataJSON().accountId); });
  await page.getByRole("button", { name: /QA Second/ }).click();
  await expect.poll(() => search(page).get("accountId")).toBe("qa-second");
  await expect(rows(page).first()).toBeVisible();
  await expect.poll(() => search(page).get("folderId")).toBe("qa-second:INBOX");
  const id = await rows(page).first().getAttribute("data-message-id"); await rows(page).first().click();
  await expect.poll(() => search(page).get("openMessageId")).toBe(id);
  expect(switchWrites).toEqual(["qa-second"]);
  await page.evaluate(() => { Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: async (text: string) => { document.documentElement.dataset.deepLinkClipboard = text; }
  } }); });
  // Selection expands the compact card after its existing collapse-settle step.
  await expect(page.locator("#reader").getByRole("button", { name: "Collapse message", exact: true }).first()).toBeVisible();
  await page.locator('#reader [data-message-action="menu"]').first().click();
  await expect(page.getByRole("menuitem", { name: "Copy link", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Copy link", exact: true }).click();
  const link = await page.locator("html").getAttribute("data-deep-link-clipboard");
  expect(link).toBe(page.url());
  const compact = new URL(link!);
  expect(compact.searchParams.get("a")).toBe("~qa-second");
  expect(compact.searchParams.get("f")).toBe("INBOX");
  expect(compact.searchParams.get("m")).toMatch(/^[A-Za-z0-9_-]{16}$/);
  for (const key of ["accountId", "folderId", "openMessageId", "messageId"]) expect(compact.searchParams.has(key)).toBe(false);
  await page.goBack(); await expect.poll(() => search(page).get("openMessageId")).toBe(null);
  await expect(page.locator("[data-reader-toolbar]")).toHaveCount(0);
  await page.goBack(); await expect.poll(() => search(page).get("accountId")).toBe("qa-shared");
  await page.goForward(); await expect.poll(() => search(page).get("accountId")).toBe("qa-second");
  await page.goForward(); await expect.poll(() => search(page).get("openMessageId")).toBe(id);
  await page.reload(); await expect(active(page)).toHaveAttribute("data-message-id", id!);
  await expect(page.locator('[data-reader-toolbar]')).toBeVisible(); await shot(page, "desktop-reader");
  const context = await browser.newContext({ locale: "en-GB", baseURL: process.env.QA_SHELL_BASE_URL });
  const fresh = await context.newPage(); await fresh.goto(link!);
  const [seed] = JSON.parse(readFileSync(process.env.QA_SHELL_SEED_FILE!, "utf8"));
  await fresh.locator('input[name="email"]').fill(seed.email);
  await fresh.locator('input[name="password"]').fill(seed.password);
  await fresh.getByRole("button", { name: "Sign in", exact: true }).click();
  await fresh.locator('input[name="code"]').fill(totpFromUri(seed.totpURI));
  await fresh.locator('form button[type="submit"]').click();
  await expect(active(fresh)).toHaveAttribute("data-message-id", id!);
  await expect.poll(() => search(fresh).get("accountId")).toBe("qa-second");
  await context.close();
});

test("URL state: settings sections, admin sections, search, calendar and blank compose", async ({ page }) => {
  await openQaMenu(page, "Settings"); await page.getByRole("tab", { name: "Preferences", exact: true }).click();
  await expect.poll(() => search(page).get("settings")).toBe("preferences");
  await page.reload(); await expect(page.getByRole("tab", { name: "Preferences", exact: true })).toHaveAttribute("data-state", "active");
  await page.goBack(); // Reload preserved the original settings tab history entry.
  await expect.poll(() => search(page).get("settings")).toBe("account");
  await page.goto("/?a=~qa-shared&admin=audit");
  await expect(page.getByRole("button", { name: "Audit", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/?a=~qa-shared&s=all&q=synthetic&g=sender&filter=unread");
  await expect.poll(() => search(page).get("q")).toBe("synthetic"); await expect(rows(page).first()).toBeVisible();
  await page.goto("/?a=~qa-shared&panel=calendar");
  await expect(page.locator('[data-calendar-frame="popover"]')).toBeVisible();
  await expect.poll(() => search(page).get("panel")).toBe("calendar");
  const mailto = "mailto:reader@example.test?subject=Synthetic%20protocol%20entry&body=Synthetic%20body";
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  const handler = manifest.protocol_handlers.find((entry: { protocol: string }) => entry.protocol === "mailto");
  expect(handler.url).toBe("/?c=%s");
  await page.goto(handler.url.replace("%s", encodeURIComponent(mailto)));
  await expect(page.getByLabel("Subject:", { exact: true })).toHaveValue("Synthetic protocol entry");
  await expect.poll(() => search(page).get("c")).toBe("mailto:");
});

test("calendar file handler redirects to the compact calendar panel", async ({ page }) => {
  await page.route("**/api/calendar/import", route => route.fulfill({ json: { ok: true, eventUids: ["synthetic-import"] } }));
  await page.addInitScript(() => {
    Object.defineProperty(window, "launchQueue", { configurable: true, value: {
      setConsumer: (consumer: (params: { files: Array<{ getFile: () => Promise<File> }> }) => void) => {
        consumer({ files: [{ getFile: async () => new File(["BEGIN:VCALENDAR\r\nEND:VCALENDAR"], "synthetic.ics", { type: "text/calendar" }) }] });
      }
    } });
  });
  await page.goto("/calendar/import");
  await expect.poll(() => search(page).get("panel")).toBe("calendar");
  await expect(page.locator('[data-calendar-frame="popover"]')).toBeVisible();
});

test("forbidden and deleted message links fall back without exposing mailbox data or retry loops", async ({ page }) => {
  const privateRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/accounts/qa-private")) privateRequests.push(request.url()); });
  await page.goto(serializeDeepLink({ ...emptyDeepLink(), accountId: "qa-private", messageId: "private-id" }));
  await expect(page.getByText("You do not have access to this mailbox. Your current mailbox remains open.")).toBeVisible();
  await expect.poll(() => search(page).get("accountId")).toBe("qa-shared");
  expect(privateRequests).toEqual([]);
  expect((await page.request.get("/api/accounts/qa-private/messages/private-id")).status()).toBe(403);
  await page.goto("/?a=~qa-shared&f=INBOX&m=~deleted-id");
  await expect(page.getByText("This message is no longer available. The folder remains open.")).toBeVisible();
  await expect.poll(() => search(page).get("openMessageId")).toBe(null); await expect(rows(page).first()).toBeVisible();
  await shot(page, "missing-message");
});

test("390px reader uses a single URL entry; phone Back, Forward and reload return to the same message", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await rows(page).first().getAttribute("data-message-id");
  const historyBefore = await page.evaluate(() => history.length);
  await rows(page).first().click(); await expect.poll(() => search(page).get("openMessageId")).toBe(id);
  expect(await page.evaluate(() => history.length)).toBe(historyBefore + 1);
  await expect(page.locator("#list")).toBeHidden(); await shot(page, "phone-reader-390");
  await page.getByRole("button", { name: "Back to messages", exact: true }).click();
  await expect.poll(() => search(page).get("openMessageId")).toBe(null); await expect(rows(page).first()).toBeVisible();
  await page.goForward(); await expect.poll(() => search(page).get("openMessageId")).toBe(id);
  await expect(page.locator("#list")).toBeHidden(); await page.reload();
  await expect(page.locator("#list")).toBeHidden(); await expect.poll(() => search(page).get("openMessageId")).toBe(id);
  await page.goBack(); await expect(rows(page).first()).toBeVisible(); await shot(page, "phone-list-390");
});


test("cold reader does not wait for a held list; warm SW notification resolves an RFC identity through the same route", async ({ page }) => {
  const id = await rows(page).first().getAttribute("data-message-id");
  const detailResponse = await page.request.get(`/api/accounts/qa-shared/messages/${id}`);
  expect(detailResponse.status()).toBe(200);
  const detail = await detailResponse.json();
  let release: () => void = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/api\/accounts\/qa-shared\/(threads|messages|search)\?/, async route => { await held; await route.continue(); });
  await page.goto(`/?a=~qa-shared&f=INBOX&m=${encodeDeepLinkId(id!, "imap")}`);
  try {
    await expect(page.locator("[data-reader-toolbar]")).toBeVisible();
    await expect.poll(() => search(page).get("openMessageId")).toBe(id);
    await expect(page.getByText("This message is no longer available. The folder remains open.")).toHaveCount(0);
  } finally { release(); }
  await expect(active(page)).toHaveAttribute("data-message-id", id!);
  await page.unroute(/\/api\/accounts\/qa-shared\/(threads|messages|search)\?/);
  await page.goBack(); await expect.poll(() => search(page).get("openMessageId")).toBe(null);
  const notificationUrl = serializeDeepLink({ ...emptyDeepLink(), accountId: "qa-shared", messageId: detail.message.messageId });
  await page.evaluate(url => { navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: {
    type: "noctua:notification-open", url
  } })); }, notificationUrl);
  await expect.poll(() => search(page).get("openMessageId")).toBe(id);
  await expect(page.locator("[data-reader-toolbar]")).toBeVisible();
});

test("390px sidebar keeps the selected mailbox and folder, with working Back/Forward", async ({ page }) => {
  await traceHistory(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const switchWrites: string[] = [];
  page.on("request", request => { if (request.url().endsWith("/api/auth/switch-account")) switchWrites.push(request.postDataJSON().accountId); });
  const toggle = page.locator('[data-slot="shell-header"]').getByRole("button", { name: "Toggle sidebar", exact: true });
  const sheet = page.getByRole("dialog", { name: "Sidebar", exact: true });
  await toggle.click();
  await sheet.getByRole("button", { name: /QA Second/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => search(page).get("folderId")).toBe("qa-second:INBOX");
  await expect(rows(page).first()).toBeVisible();
  expect(switchWrites).toEqual(["qa-second"]);
  await toggle.click();
  await expect(sheet.getByRole("button", { name: /QA Second/ })).toHaveAttribute("aria-current", "true");
  await sheet.locator('[data-folder-id="qa-second:Sent"]').click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => search(page).get("folderId")).toBe("qa-second:Sent");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("QA Second / Sent");
  await expect(rows(page).first()).toBeVisible();
  await page.goBack();
  await expect.poll(() => search(page).get("folderId")).toBe("qa-second:INBOX");
  await expect(rows(page).first()).toBeVisible();
  await page.goBack();
  await expect.poll(() => search(page).get("folderId")).toBe("qa-shared:INBOX");
  await expect(rows(page).first()).toBeVisible();
  await page.goForward();
  await expect.poll(() => search(page).get("folderId")).toBe("qa-second:INBOX");
  await expect(rows(page).first()).toBeVisible();
  await page.goForward();
  await expect.poll(() => search(page).get("folderId")).toBe("qa-second:Sent");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("QA Second / Sent");
  await expect(rows(page).first()).toBeVisible();
});

test("virtual-view filter navigation restores with Back/Forward and keeps URL updates alive", async ({ page }) => {
  await traceHistory(page);
  await page.locator('[data-view-id="virtual:unassigned"]').click();
  await expect.poll(() => search(page).get("view")).toBe("virtual:unassigned");
  await page.getByRole("button", { name: "Search filters", exact: true }).click();
  await page.getByRole("checkbox", { name: "Unread", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect.poll(() => search(page).get("filter")).toBe("unread");
  await expect.poll(() => search(page).get("view")).toBe(null);
  await page.goBack();
  await expect.poll(() => search(page).get("view")).toBe("virtual:unassigned");
  await expect(page.locator('[data-view-id="virtual:unassigned"]')).toHaveAttribute("data-active", "true");
  expect(search(page).get("filter")).toBe(null);
  await page.goBack();
  await expect.poll(() => search(page).get("folderId")).toBe("qa-shared:INBOX");
  await expect(rows(page).first()).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-view-id="virtual:unassigned"]')).toHaveAttribute("data-active", "true");
  await page.goForward();
  await expect.poll(() => search(page).get("filter")).toBe("unread");
  await expect.poll(() => search(page).get("view")).toBe(null);
  await page.getByRole("button", { name: "Search filters", exact: true }).click();
  await page.getByRole("checkbox", { name: "Unread", exact: true }).uncheck();
  await expect.poll(() => search(page).get("filter")).toBe(null);
  await page.goto("/?a=~qa-shared&view=virtual:open&filter=unread");
  await expect.poll(() => search(page).get("view")).toBe(null);
  await page.getByRole("button", { name: "Search filters", exact: true }).click();
  await page.getByRole("checkbox", { name: "Unread", exact: true }).uncheck();
  await expect.poll(() => search(page).get("filter")).toBe(null);
});

for (const action of ["Delete", "Archive"]) {
  test(`${action} in the reader replaces its entry; Back returns to the original list`, async ({ page }) => {
    await traceHistory(page);
    // Use individual messages so the action targets exactly the clicked row.
    await page.getByRole("button", { name: /^Sort & group:/ }).click();
    await page.getByRole("menuitemradio", { name: "Off", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Sort & group:/ })).toHaveAccessibleName(/threads off/);
    const id = await rows(page).first().getAttribute("data-message-id");
    const listUrl = page.url();
    await page.locator(`[data-message-list-row="true"][data-message-id="${id}"]`).click();
    await expect.poll(() => search(page).get("openMessageId")).toBe(id);
    await page.locator('[data-reader-toolbar]').getByRole("button", { name: "Expand reading view", exact: true }).click();
    await expect(page.locator('[data-reader-toolbar]')).toHaveAttribute("data-focus", "true");
    const historyBefore = await page.evaluate(() => history.length);
    await page.locator('[data-reader-toolbar]').getByRole("button", { name: action, exact: true }).click();
    await expect(page.locator(`[data-message-list-row="true"][data-message-id="${id}"]`)).toHaveCount(0);
    await expect.poll(() => search(page).get("openMessageId")).not.toBe(id);
    expect(await page.evaluate(() => history.length)).toBe(historyBefore);
    await page.goBack();
    await expect(page).toHaveURL(listUrl);
    await expect(page.locator('[data-reader-toolbar]')).toHaveCount(0);
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByText(/This message was moved/)).toHaveCount(0);
  });
}
