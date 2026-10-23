import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { signInQa } from "./qaRound2Session";

// QA_ROUND2_FIXTURE=1 QA_DEEP_LINKS_FIXTURE=1 QA_SHELL_SPEC=qa-scroll-anchors.spec.ts QA_SHELL_PORT=4100
// QA_SHELL_FIXTURE_IMAP_PORT=4101 QA_SHELL_FIXTURE_CONTROL_PORT=4102
// QA_SHELL_FIXTURE_SMTP_PORT=4103 bun scripts/runQaShellBrowserTests.ts
// 300 synthetic INBOX messages; the runner owns all storage and processes.
test.use({ locale: "en-GB" });
const rows = (page: Page) => page.locator('#list [data-message-list-row="true"]');
const search = (page: Page) => new URL(page.url()).searchParams;
const evidence = process.env.SCROLL_ANCHORS_EVIDENCE_DIR ?? ".tmp/scroll-anchors-evidence";
let cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-GB", baseURL: process.env.QA_SHELL_BASE_URL });
  const page = await context.newPage(); await signInQa(page); cookies = await context.cookies(); await context.close();
});
test.beforeEach(async ({ page }) => {
  await page.context().addCookies(cookies);
});
async function shot(page: Page, name: string) { mkdirSync(evidence, { recursive: true }); await page.screenshot({ path: `${evidence}/${name}.png` }); }

/** First list row crossing the list viewport's top edge, and the viewport's offset into it. */
function visibleTop(page: Page) {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('#list [data-message-list-row="true"]');
    let pane = row?.parentElement ?? null;
    while (pane && !["auto", "scroll"].includes(getComputedStyle(pane).overflowY)) pane = pane.parentElement;
    if (!pane || pane.clientHeight === 0) return null;
    const top = pane.getBoundingClientRect().top;
    const first = Array.from(pane.querySelectorAll<HTMLElement>('[data-message-list-row="true"]'))
      .map(element => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.height > 0 && rect.bottom > top + 0.5)
      .sort((a, b) => a.rect.top - b.rect.top)[0];
    return first ? { id: first.element.dataset.messageId, offset: Math.round(top - first.rect.top), scrollTop: Math.round(pane.scrollTop) } : null;
  });
}
async function scrollFar(page: Page) {
  const box = (await page.locator("#list").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let step = 0; step < 6; step++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(120); }
  await expect.poll(async () => (await visibleTop(page))?.scrollTop ?? 0).toBeGreaterThan(3000);
  // Let the throttled capture and any page load settle.
  await page.waitForTimeout(400);
  const state = await visibleTop(page);
  expect(state?.id).toBeTruthy();
  return state!;
}
async function openVisibleRow(page: Page, below: string) {
  const id = await page.evaluate(anchor => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('#list [data-message-list-row="true"]'));
    const index = rows.findIndex(row => row.dataset.messageId === anchor);
    return rows[index + 3]?.dataset.messageId ?? "";
  }, below);
  expect(id).toBeTruthy();
  await page.locator(`#list [data-message-list-row="true"][data-message-id="${id}"]`).click();
  await expect.poll(() => search(page).get("openMessageId")).toBe(id);
  return id;
}

test("390px: scroll far, open a mail, Back shows the same rows", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?accountId=qa-shared"); await expect(rows(page).first()).toBeVisible();
  await expect.poll(() => search(page).get("folderId")).toBe("qa-shared:INBOX");
  const before = await scrollFar(page);
  await openVisibleRow(page, before.id!);
  await expect(page.locator("#list")).toBeHidden();
  await page.getByRole("button", { name: "Back to messages", exact: true }).click();
  await expect.poll(() => search(page).get("openMessageId")).toBe(null);
  await expect.poll(() => visibleTop(page)).toEqual(before);
  await shot(page, "phone-list-after-back-390");
  // Browser Forward/Back through the same entries.
  await page.goForward(); await expect(page.locator("#list")).toBeHidden();
  await page.goBack();
  await expect.poll(() => visibleTop(page)).toEqual(before);
  // From the reader, switch mailbox through the sidebar, then Back twice:
  // the list is rebuilt for the other mailbox in between.
  const opened = await openVisibleRow(page, before.id!);
  const sheet = page.getByRole("dialog", { name: "Sidebar", exact: true });
  await page.locator('[data-slot="shell-header"]').getByRole("button", { name: "Toggle sidebar", exact: true }).click();
  await sheet.getByRole("button", { name: /QA Second/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => search(page).get("accountId")).toBe("qa-second");
  await expect(rows(page).first()).toBeVisible();
  await page.goBack(); await expect.poll(() => search(page).get("openMessageId")).toBe(opened);
  await page.goBack(); await expect.poll(() => search(page).get("openMessageId")).toBe(null);
  await expect.poll(() => visibleTop(page)).toEqual(before);
});

test("desktop: list position survives a mailbox switch on Back and on a revisit", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?accountId=qa-shared"); await expect(rows(page).first()).toBeVisible();
  await expect.poll(() => search(page).get("folderId")).toBe("qa-shared:INBOX");
  const before = await scrollFar(page);
  await openVisibleRow(page, before.id!);
  await expect(page.locator("[data-reader-toolbar]")).toBeVisible();
  await page.getByRole("button", { name: /QA Second/ }).click();
  await expect.poll(() => search(page).get("accountId")).toBe("qa-second");
  await expect(rows(page).first()).toBeVisible();
  await expect.poll(async () => (await visibleTop(page))?.scrollTop).toBe(0);
  await page.goBack();
  await expect.poll(() => search(page).get("accountId")).toBe("qa-shared");
  await expect.poll(() => visibleTop(page)).toEqual(before);
  await shot(page, "desktop-list-after-back");
  // A revisit by click (no history navigation) returns to the place's last position.
  await page.getByRole("button", { name: /QA Second/ }).click();
  await expect.poll(() => search(page).get("accountId")).toBe("qa-second");
  await page.getByRole("button", { name: /QA Shared/ }).click();
  await expect.poll(() => search(page).get("accountId")).toBe("qa-shared");
  await expect.poll(() => visibleTop(page)).toEqual(before);
});
