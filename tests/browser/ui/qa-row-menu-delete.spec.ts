import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// „Löschen“ in the row ⋮ menu (desktop 1280 px light/dark, phone 390 px via
// swipe „Mehr“):
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-row-menu-delete.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/row-menu-delete-evidence;
// ROW_MENU_DELETE_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE", hasTouch: true });
const evidence = path.resolve(process.env.ROW_MENU_DELETE_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "row-menu-delete-evidence"));

const mails = [
  "Sicherungsbericht für den Testserver",
  "Wochenplan für das Team",
  "Rechnung 2026-117 ist eingegangen",
  "Einladung zum Sommerfest"
];

test.beforeAll(async () => {
  for (const [index, subject] of mails.entries()) {
    const source = [
      "From: Synthetic Sender <sender@example.test>",
      "To: demo@monkeydent.test",
      `Message-ID: <qa-row-menu-delete-${index}@example.test>`,
      `Date: ${new Date(Date.now() + 3_600_000 - index * 60_000).toUTCString()}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      `Synthetischer Text für ${subject}.`
    ].join("\r\n");
    const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, {
      method: "POST",
      body: JSON.stringify({ source, flags: index % 2 ? ["\\Seen"] : [] })
    });
    expect(response.ok).toBe(true);
  }
});

const rowFor = (page: Page, subject: string) =>
  page.locator('[data-message-list-row="true"]').filter({ hasText: subject });

async function waitForRows(page: Page) {
  // The first sync of the fixture inbox can outlast one page load.
  await expect.poll(async () => {
    if (await rowFor(page, mails[3]).count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120000, intervals: [500] }).toBe(true);
}

async function menuEntries(page: Page) {
  const menu = page.getByRole("menu");
  return menu.locator('[role="menuitem"], [role="separator"]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute("role") === "separator" ? "---" : node.textContent?.trim()));
}

async function openRowMenu(page: Page, row: Locator) {
  await row.hover();
  await row.locator('[data-message-action="menu"]').click();
  await expect(page.getByRole("menuitem", { name: "Löschen", exact: true })).toBeVisible();
}

const expectedHead = ["Antworten", "Allen antworten", "Weiterleiten", "Als neu bearbeiten", "---", "Löschen", "---"];

test("row menu: Löschen sits right after the compose actions at 1280 px and moves the row to Trash", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.emulateMedia({ colorScheme: "light" });
  await signInQa(page);
  await waitForRows(page);
  const first = rowFor(page, mails[0]);

  await openRowMenu(page, first);
  expect((await menuEntries(page)).slice(0, expectedHead.length)).toEqual(expectedHead);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(evidence, "desktop-1280-light-menu.png") });
  await page.keyboard.press("Escape");

  await page.emulateMedia({ colorScheme: "dark" });
  await openRowMenu(page, first);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(evidence, "desktop-1280-dark-menu.png") });

  // Keyboard: open with Enter on ⋮, arrow down to the entry, trigger with Enter.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.mouse.move(0, 0);
  await first.locator('[data-message-action="menu"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Antworten", exact: true })).toBeFocused();
  // Arrow keys sent during the open animation are dropped by the menu.
  await page.waitForTimeout(500);
  for (let step = 0; step < 4; step++) await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "Löschen", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(first).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(evidence, "desktop-1280-dark-after-delete.png") });
});

test("row menu: Löschen in the phone menu opened via swipe „Mehr“ at 390 px", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await signInQa(page);
  await waitForRows(page);
  const row = rowFor(page, mails[1]);
  await row.scrollIntoViewIfNeeded();
  const box = (await row.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const y = box.y + box.height / 2;
  const [x0, x1] = [box.x + box.width * 0.8, box.x + box.width * 0.45];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let step = 1; step <= 12; step++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * step) / 12, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.locator('[data-swipe-action="more"]').click();
  await expect(page.getByRole("menuitem", { name: "Löschen", exact: true })).toBeVisible();
  expect((await menuEntries(page)).slice(0, expectedHead.length)).toEqual(expectedHead);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(evidence, "phone-390-light-menu.png") });
});
