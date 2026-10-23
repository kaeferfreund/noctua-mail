import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa, recordQa } from "./qaRound2Session";

test.use({ locale: "en-GB" });
// Runs in the round-two QA suite and needs its fixture (QA synthetic rows across
// several pages); without it the paging and print cases fail:
//   QA_ROUND2_FIXTURE=1 QA_SHELL_PORT=<port> bun scripts/runQaShellBrowserTests.ts \
//     --config=playwright.qa-round2.config.ts qa-reader-focus
// Evidence defaults to the untracked <checkout>/.tmp/reader-focus-evidence, resolved
// from this file rather than the working directory; READER_FOCUS_EVIDENCE_DIR
// redirects it (for example to a preserved review directory).
const evidence = path.resolve(process.env.READER_FOCUS_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "reader-focus-evidence"));
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
  await expect(toolbar(page).getByRole("button", { name: "Back to messages", exact: true })).toBeFocused();
  recordQa("reader-focus-saved-entry", await page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute("aria-label") })));
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

test("reader focus: Enter and Shift+Enter entries leave with one Escape although Back shows its tooltip", async ({ page }) => {
  await start(page);
  const back = toolbar(page).getByRole("button", { name: "Back to messages", exact: true });
  for (const entry of ["Enter", "Shift+Enter"] as const) {
    const row = rows(page).nth(entry === "Enter" ? 0 : 1);
    const id = await row.getAttribute("data-message-id");
    if (entry === "Shift+Enter") await row.click();
    await row.focus(); await page.keyboard.press(entry);
    await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
    await expect(back).toBeFocused();
    // Keyboard-placed focus is focus-visible, so the Back tooltip is open.
    await expect(page.getByRole("tooltip", { name: "Back to messages (Escape)" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panes(page)).toHaveAttribute("data-reader-layout", "split");
    // Exit focuses the reader's row, or the list container while that row is not
    // yet rendered; never another row.
    const exitFocus = () => page.evaluate(() => {
      const active = document.activeElement;
      if (!active?.closest('[id="list"]')) return null;
      return active.closest<HTMLElement>("[data-message-id]")?.dataset.messageId ?? "list";
    });
    await expect.poll(exitFocus).not.toBeNull();
    const focus = await exitFocus();
    expect([id, "list"]).toContain(focus);
    await expect(page.locator(`[data-message-list-row="true"][data-message-id="${id}"]`)).toHaveAttribute("data-selected", "true");
    recordQa(`reader-focus-escape-${entry === "Enter" ? "enter" : "shift-enter"}`, { id, escapePresses: 1, focus });
  }
});

test("reader focus: a saved focus preference keeps loading list pages while no message is open", async ({ page }) => {
  const pages: string[] = [];
  // Small pages make the synthetic fixture span several pages without changing product code.
  await page.route(/\/api\/accounts\/qa-shared\/(threads|messages)(\?|$)/, async route => {
    const url = new URL(route.request().url());
    if (!url.searchParams.has("pageSize")) return route.continue();
    url.searchParams.set("pageSize", "20");
    pages.push(url.searchParams.get("page") ?? "");
    await route.continue({ url: String(url) });
  });
  await start(page);
  await page.evaluate(() => localStorage.setItem("noctua:readerLayout", "focus"));
  await page.reload();
  await expect(rows(page).first()).toBeVisible();
  await expect(panes(page)).toHaveAttribute("data-reader-layout", "split");
  const list = page.locator('[id="list"] aside');
  const initial = [...pages];
  await expect.poll(async () => {
    await list.evaluate(el => { el.scrollTop = el.scrollHeight; });
    return pages.length - initial.length;
  }).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => localStorage.getItem("noctua:readerLayout"))).toBe("focus");
  recordQa("reader-focus-saved-preference-paging", { initial, afterScroll: pages.slice(initial.length) });
  await rows(page).first().click();
  await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
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

test("reader focus: collapsed sidebar keeps the delete notice and Undo reachable", async ({ page }) => {
  await start(page);
  const deletedId = await rows(page).first().getAttribute("data-message-id");
  const nextId = await rows(page).nth(1).getAttribute("data-message-id");
  await rows(page).first().dblclick();
  await page.locator('[data-shell-action="toggle-sidebar"]').click();
  await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute("data-state", "collapsed");
  await toolbar(page).getByRole("button", { name: "Delete", exact: true }).click();
  const undo = page.locator(".inapp-notice-stack-pane").getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeVisible();
  const back = toolbar(page).getByRole("button", { name: "Back to messages", exact: true });
  await expect(back).toBeFocused();
  await expect(undo).toBeInViewport({ ratio: 1 });
  await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
  await expect(page.locator('[data-message-list-row="true"][data-active="true"]')).toHaveAttribute("data-message-id", nextId!);
  recordQa("reader-focus-delete-notice", { deletedId, nextId, undo: await undo.boundingBox(), stack: await page.locator(".inapp-notice-stack-pane").boundingBox() });
  await screenshot(page, "delete-visible-undo.png");
  await undo.click();
  await expect(page.getByText("Message restored.", { exact: true }).first()).toBeVisible();
  await expect(undo).toHaveCount(0);
  await expect(back).toBeFocused();
});

test("reader focus: archive row action and toolbar use real HTTP and continue to the next rendered message", async ({ page }) => {
  const browserLog: string[] = [];
  page.on("console", message => { if (/\[list-debug\].*(selecting message|message pruned|active message missing)/.test(message.text())) browserLog.push(message.text()); });
  await start(page);
  for (const surface of ["row", "toolbar"] as const) {
    const target = rows(page).first();
    const id = (await target.getAttribute("data-message-id"))!;
    const original = await page.request.get(`/api/accounts/qa-shared/messages/${encodeURIComponent(id)}`);
    expect(original.status()).toBe(200);
    const before = (await original.json()).message;
    const nextId = await rows(page).nth(1).getAttribute("data-message-id");
    const responseReady = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/${encodeURIComponent(id)}/archive`));
    if (surface === "row") {
      await target.getByRole("button", { name: "Message actions", exact: true }).click();
      await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
    } else {
      await target.dblclick();
      await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
      await toolbar(page).getByRole("button", { name: "Archive", exact: true }).click();
    }
    const response = await responseReady;
    expect(response.status()).toBe(200);
    expect(response.request().headers()["content-type"]).toBe("application/json");
    expect(response.request().postDataJSON()).toEqual({});
    const result = await response.json();
    expect(result.action).toBe("moved");
    const moved = await page.request.get(`/api/accounts/qa-shared/messages/${encodeURIComponent(result.messageId ?? id)}`);
    expect(moved.status()).toBe(200);
    const after = (await moved.json()).message;
    expect(after.folderId).toBe(result.archiveFolderId);
    expect(after.folderId).not.toBe(before.folderId);
    await expect(page.locator(`[data-message-list-row="true"][data-message-id="${id}"]`)).toHaveCount(0);
    recordQa(`reader-focus-archive-${surface}`, { status: response.status(), id, result, from: before.folderId, to: after.folderId, nextId });
    if (surface === "toolbar") {
      await expect(panes(page)).toHaveAttribute("data-reader-layout", "focus");
      await expect(page.locator('[data-message-list-row="true"][data-active="true"]')).toHaveAttribute("data-message-id", nextId!);
      // Removing a collapsed thread root can leave another representative in
      // that row, so derive the successor's position from the rendered order.
      const position = await rows(page).evaluateAll((elements, id) => elements.findIndex(element => element.getAttribute("data-message-id") === id) + 1, nextId);
      expect(position).toBeGreaterThan(0);
      await expect(toolbar(page).locator('[data-reader-position]')).toHaveText(new RegExp(`^${position} / [0-9]+[+]?$`));
      recordQa("reader-focus-archive-browser-log", browserLog);
      recordQa("reader-focus-archive-state", await page.evaluate(() => ({ counter: document.querySelector("[data-reader-position]")?.textContent, rows: Array.from(document.querySelectorAll<HTMLElement>('[data-message-list-row="true"]')).map(row => ({ id: row.dataset.messageId, active: row.dataset.active, selected: row.dataset.selected })) })));
      await screenshot(page, "archive-next-focus.png");
    }
  }
});

test("reader focus: real print PDF excludes an unsent inline reply and internal controls", async ({ page }) => {
  await start(page);
  await page.getByRole("textbox", { name: "Search Inbox", exact: true }).fill('QA synthetic');
  const printRow = rows(page).filter({ hasText: /QA synthetic [0-9]{3}/ }).first();
  await expect(printRow).toContainText("QA synthetic");
  await printRow.dblclick();
  await expect(page.locator('[data-reader-print]').getByText("Synthetic QA round two message.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reply", exact: true }).first().click();
  const draft = page.locator('[data-reader-print] textarea').first();
  const privateText = "UNSENT SYNTHETIC PRIVATE DRAFT example.test";
  await draft.fill(privateText);
  await expect(draft).toHaveValue(privateText);
  await expect(page.getByRole("button", { name: "Send", exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Thread collaboration", { exact: true })).toBeVisible();
  // Sender avatars render initials as text; they are decoration and must not print.
  const avatars = page.locator('[data-reader-print] span[aria-hidden="true"]:has(> img[alt=""])');
  await expect(avatars.first()).toBeVisible();
  const initials = (await avatars.first().innerText()).trim();
  expect(initials).toMatch(/^\S{1,3}$/);
  await page.emulateMedia({ media: "print" });
  for (const avatar of await avatars.all()) await expect(avatar).toBeHidden();
  expect((await page.locator('[data-reader-print]').innerText()).split(/\s+/)).not.toContain(initials);
  await expect(page.getByLabel("Thread collaboration", { exact: true })).toBeHidden();
  await expect(draft).toBeHidden();
  await expect(page.getByRole("button", { name: "Send", exact: true }).first()).toBeHidden();
  await expect(toolbar(page)).toBeHidden();
  await expect(page.locator('[data-reader-print]').getByText("Synthetic QA round two message.", { exact: true })).toBeVisible();
  await expect(page.locator('[data-reader-print]').getByRole("button", { name: "Reply", exact: true }).first()).toBeHidden();
  await screenshot(page, "reply-print-private-excluded.png");
  await page.pdf({ path: path.join(evidence, "reply-print-private-excluded.pdf"), format: "A4", printBackground: true });
  recordQa("reader-focus-print", { privateText, draftHidden: await draft.isHidden(), printableZones: await page.locator('[data-mail-print]').count() });
  await page.emulateMedia({ media: "screen" });
  await expect(draft).toHaveValue(privateText);
});
