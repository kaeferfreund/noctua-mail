import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { signInQa } from "./qaRound2Session";

test.use({ locale: "en-GB" });
const evidence = process.env.READER_FOCUS_EVIDENCE_DIR ?? "artifacts/reader-focus";
const rows = (page: Page) => page.locator('[data-message-list-row="true"]');
const panes = (page: Page) => page.locator('[data-reader-layout]');
const toolbar = (page: Page) => page.locator('[data-reader-toolbar]');
async function start(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await signInQa(page);
  await expect(rows(page).first()).toBeVisible();
  console.log("reader-focus: signed in; synthetic rows visible", width);
}
async function screenshot(page: Page, name: string) {
  mkdirSync(evidence, { recursive: true });
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.screenshot({ path: path.join(evidence, name), fullPage: true });
}

test("reader focus: double-click, counter, next, back preserves mounted list and selection; desktop light/dark", async ({ page }) => {
  await start(page);
  await rows(page).first().click();
  await expect(toolbar(page).getByText("Tip: Double-click opens the message in a larger view")).toBeVisible();
  const firstId = await rows(page).first().getAttribute("data-message-id");
  await rows(page).first().dblclick();
  console.log("reader-focus: double-click completed");
  await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
  await expect(page.locator('[id="list"]')).toBeHidden();
  await expect(page.locator('[data-slot="sidebar"]')).toBeVisible();
  await expect(toolbar(page).locator('[data-reader-position]')).toHaveText(/^1 \/ \d+\+?$/);
  await expect(toolbar(page).getByRole("button", { name: "Previous message", exact: true })).toBeDisabled();
  await toolbar(page).getByRole("button", { name: "Next message", exact: true }).click();
  await expect(toolbar(page).locator('[data-reader-position]')).toHaveText(/^2 \/ \d+\+?$/);
  console.log("reader-focus: counter advanced");
  const activeRow = page.locator('[data-message-list-row="true"][data-active="true"]');
  await expect(activeRow).toHaveCount(1);
  const secondId = await activeRow.getAttribute("data-message-id");
  expect(secondId).not.toBe(firstId);
  await toolbar(page).getByRole("button", { name: "Back to messages", exact: true }).click();
  await expect(panes(page)).toHaveAttribute("data-reader-layout", "split");
  await expect(page.locator(`[data-message-id="${secondId}"][data-selected="true"]`)).toBeVisible();
  await expect(toolbar(page).getByText(/^Tip:/)).toHaveCount(0);
  // Assert the same list DOM and a scrolled position survive expansion/back.
  const list = page.locator('[id="list"] aside');
  await list.evaluate(el => { el.setAttribute("data-reader-kept", "yes"); el.scrollTop = 180; });
  const scrollBefore = await list.evaluate(el => el.scrollTop);
  await toolbar(page).getByRole("button", { name: "Expand reading view", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(list).toHaveAttribute("data-reader-kept", "yes");
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBe(scrollBefore);
  // Focus layout and its message presentation remain usable at both desktop widths.
  await toolbar(page).getByRole("button", { name: "Expand reading view", exact: true }).click();
  for (const width of [1280, 1024]) for (const scheme of ["light", "dark"] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(value => { localStorage.setItem("noctua:theme", value); }, scheme);
    await page.reload();
    await rows(page).first().click();
    await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
    await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
    await expect(toolbar(page).getByRole("button", { name: "Next message", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await screenshot(page, `reader-focus-${scheme}-${width}.png`);
  }
});

test("reader focus: Enter, toggles, j/k, sidebar reset, persistence, print and existing message actions", async ({ page }) => {
  await start(page);
  await rows(page).first().focus(); await page.keyboard.press("Enter");
  await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
  await page.keyboard.press("j"); await expect(toolbar(page).locator('[data-reader-position]')).toHaveText(/^2 \//);
  await page.keyboard.press("k"); await expect(toolbar(page).locator('[data-reader-position]')).toHaveText(/^1 \//);
  await page.keyboard.press("Shift+Enter"); await expect(panes(page)).toHaveAttribute("data-reader-layout", "split");
  await page.keyboard.press("Shift+Enter"); await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
  expect(await page.evaluate(() => localStorage.getItem("noctua:readerLayout"))).toBe("focus");
  await page.reload(); await rows(page).first().click();
  await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
  // Clicking even the current view returns to the list without forgetting the preference.
  await page.locator('[data-slot="sidebar"]').getByRole("button", { name: /Inbox/, exact: true }).first().click();
  await expect(panes(page)).toHaveAttribute("data-reader-layout", "split");
  await rows(page).first().click(); await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
  await page.evaluate(() => { window.print = () => { document.body.dataset.readerPrinted = "yes"; }; });
  await toolbar(page).getByRole("button", { name: "Print message", exact: true }).click();
  expect(await page.locator("body").getAttribute("data-reader-printed")).toBe("yes");
  await page.emulateMedia({ media: "print" });
  await expect(toolbar(page)).toBeHidden();
  await expect(page.locator('[data-reader-print]')).toBeVisible();
  const printReader = await page.locator('[data-reader-print]').boundingBox();
  expect(printReader!.x).toBeLessThan(10);
  expect(printReader!.width).toBeGreaterThan(1200);
  await expect(page.locator('[data-slot="sidebar"]')).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  const popupReady = page.waitForEvent("popup");
  await toolbar(page).getByRole("button", { name: "Open in new window", exact: true }).click();
  const popup = await popupReady;
  await expect(popup).toHaveURL(/\/message\/window\?/);
  await popup.close();
  await toolbar(page).getByRole("button", { name: "Mark as Done", exact: true }).click();
  await expect(toolbar(page).getByRole("button", { name: "Mark as not done", exact: true })).toBeVisible();
  await toolbar(page).getByRole("button", { name: "Mark as not done", exact: true }).click();
  await expect(toolbar(page).getByRole("button", { name: "Mark as Done", exact: true })).toBeVisible();
  await toolbar(page).getByRole("button", { name: "Show message list", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("noctua:readerLayout"))).toBe("split");
});

test("reader focus: 390px keeps the existing single-pane reader and mobile back history", async ({ page }) => {
  await start(page, 390);
  await page.evaluate(() => localStorage.setItem("noctua:readerLayout", "focus"));
  await page.reload();
  await rows(page).first().click();
  await expect(panes(page)).toHaveAttribute("data-mobile-view", "thread");
  await expect(page.locator('[id="list"]')).toBeHidden();
  await expect(page.locator('[data-reader-toolbar]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Expand reading view", exact: true })).toHaveCount(0);
  await screenshot(page, "reader-mobile-390.png");
  await page.getByRole("button", { name: "Back to messages", exact: true }).click();
  await expect(panes(page)).toHaveAttribute("data-mobile-view", "list");
  await expect(rows(page).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("noctua:readerLayout"))).toBe("focus");
});
