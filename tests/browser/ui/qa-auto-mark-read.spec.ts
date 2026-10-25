import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// Opened unread mail is marked read after the personal dwell (default 1 s):
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-auto-mark-read.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/auto-mark-read-evidence;
// AUTO_READ_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE" });
const evidence = path.resolve(process.env.AUTO_READ_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "auto-mark-read-evidence"));
const subjects = {
  desktop: "Synthetische Rechnung zum Lesen am Desktop",
  skimmed: "Synthetischer Newsletter nur kurz angesehen",
  phone: "Synthetische Terminbestätigung zum Lesen am Telefon"
};

test.beforeAll(async () => {
  for (const [n, subject] of Object.values(subjects).entries()) {
    const source = [
      "From: Synthetic Sender <sender@example.test>",
      "To: demo@monkeydent.test",
      `Message-ID: <qa-auto-read-${n}@example.test>`,
      `Date: ${new Date(Date.now() + 3_600_000 - n * 60_000).toUTCString()}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Synthetischer Inhalt für die Prüfung des automatischen Gelesen-Status."
    ].join("\r\n");
    const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, { method: "POST", body: JSON.stringify({ source, flags: [] }) });
    expect(response.ok).toBe(true);
  }
});

const row = (page: Page, subject: string) => page.locator('[data-message-list-row="true"]').filter({ hasText: subject });
// Every list layout announces unread rows with a visually hidden „Ungelesen“.
const expectUnread = (target: Locator, unread: boolean) =>
  unread ? expect(target).toContainText("Ungelesen") : expect(target).not.toContainText("Ungelesen");

async function openPreferences(page: Page, width: number) {
  if (width < 768) await page.getByRole("button", { name: "Seitenleiste umschalten", exact: true }).click();
  await page.getByRole("button", { name: "Benutzermenü", exact: true }).click();
  await page.getByRole("menuitem", { name: "Einstellungen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Postfacheinstellungen", exact: true });
  await dialog.getByRole("tab", { name: "Persönliche Einstellungen", exact: true }).click();
  const select = dialog.getByRole("combobox", { name: "Geöffnete E-Mails als gelesen markieren", exact: true });
  await expect(select).toBeEnabled();
  await select.scrollIntoViewIfNeeded();
  return select;
}

/** Opens `target` and resolves with the mark-read request and its delay after the click. */
async function openAndAwaitRead(page: Page, target: Locator) {
  const request = page.waitForRequest(item => item.method() === "POST" && /\/messages\/[^/]+\/flags$/.test(new URL(item.url()).pathname));
  const started = Date.now();
  await target.click();
  const flags = await request;
  return { body: flags.postDataJSON(), delayMs: Date.now() - started };
}

test("auto-read: setting, dwell, skimming and list state at 1280 and 390 px", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  const results: Record<string, unknown> = {};
  await page.setViewportSize({ width: 1280, height: 800 });
  await signInQa(page);
  // The first sync of the fixture inbox can outlast one page load.
  await expect.poll(async () => {
    if (await row(page, subjects.phone).count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120000, intervals: [500] }).toBe(true);

  const setting = await openPreferences(page, 1280);
  results.options = await setting.locator("option").allTextContents();
  results.value = await setting.inputValue();
  await page.screenshot({ path: path.join(evidence, "setting-1280.png") });
  await page.keyboard.press("Escape");

  for (const subject of Object.values(subjects)) await expectUnread(row(page, subject), true);
  await row(page, subjects.desktop).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, "list-before-1280.png") });
  // Skimming: a message left before the dwell stays unread.
  await row(page, subjects.skimmed).click();
  await page.waitForTimeout(300);
  results.desktop = await openAndAwaitRead(page, row(page, subjects.desktop));
  await expectUnread(row(page, subjects.desktop), false);
  await page.waitForTimeout(1500);
  await expectUnread(row(page, subjects.skimmed), true);
  await row(page, subjects.desktop).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, "list-after-1280.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectUnread(row(page, subjects.phone), true);
  await row(page, subjects.phone).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, "list-before-390.png") });
  await openPreferences(page, 390);
  await page.screenshot({ path: path.join(evidence, "setting-390.png") });
  await page.goto("/");
  results.phone = await openAndAwaitRead(page, row(page, subjects.phone));
  await page.screenshot({ path: path.join(evidence, "reader-390.png") });
  // A fresh load shows the stored read state.
  await page.goto("/");
  await expectUnread(row(page, subjects.phone), false);
  await expectUnread(row(page, subjects.skimmed), true);
  await row(page, subjects.phone).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(evidence, "list-after-390.png") });

  writeFileSync(path.join(evidence, "auto-mark-read.json"), JSON.stringify(results, null, 2));
  console.log("auto-mark-read", JSON.stringify(results));
  expect(results.options).toEqual(["Postfachvorgabe übernehmen", "Sofort", "Nach 1 Sekunde", "Nach 3 Sekunden", "Nie (manuell)"]);
  expect(results.value).toBe("inherit");
  for (const key of ["desktop", "phone"] as const) {
    const result = results[key] as { body: unknown; delayMs: number };
    expect(result.body).toEqual({ flag: "seen", value: true });
    expect(result.delayMs).toBeGreaterThanOrEqual(900);
  }
});
