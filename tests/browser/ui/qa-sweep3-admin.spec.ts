import { test, expect, type Page } from "@playwright/test";
import { evidencePath, recordQa, signInQa } from "./qaRound2Session";
import { catalogs, openUserMenuItem } from "./qaSweep3";

// QA-203: on phones the admin header, section and mailbox action rows wrap;
// every button stays inside the viewport, shows its full label and keeps 44 px.
async function measureAdminButtons(page: Page, title: string) {
  const admin = page.getByRole("dialog", { name: title, exact: true });
  return admin.locator("button:visible").evaluateAll(buttons => buttons.map(button => {
    const box = button.getBoundingClientRect();
    return { label: button.textContent?.trim() || button.getAttribute("aria-label") || "", left: box.left, right: box.right, height: box.height,
      clipped: button.scrollWidth > button.clientWidth + 1 };
  }));
}

for (const locale of ["de", "en"] as const) test.describe(`QA-203 ${locale}`, () => {
  const copy = catalogs[locale];
  test.use({ locale: locale === "de" ? "de-DE" : "en-GB" });
  test(`QA-203 admin rows wrap on phones (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInQa(page);
    await openUserMenuItem(page, copy, copy.Shell.admin);
    await page.getByRole("button", { name: copy.Admin.tabs.mailboxes, exact: true }).click();
    await expect(page.getByRole("button", { name: copy.Admin.mailboxes.delete, exact: true }).first()).toBeVisible();
    const results = [];
    for (const colorScheme of ["light", "dark"] as const) for (const width of [390, 360, 320]) {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: width === 320 ? 568 : 800 });
      await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
      await expect(page.getByRole("button", { name: copy.Admin.mailboxes.create, exact: true })).toBeInViewport({ ratio: 1 });
      const buttons = await measureAdminButtons(page, copy.Admin.title);
      for (const button of buttons) {
        expect(button.left, `${button.label} @${width}`).toBeGreaterThanOrEqual(0);
        expect(button.right, `${button.label} @${width}`).toBeLessThanOrEqual(width);
        expect(button.height, `${button.label} @${width}`).toBeGreaterThanOrEqual(44);
        expect(button.clipped, `${button.label} @${width}`).toBe(false);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.getByRole("button", { name: copy.Admin.mailboxes.delete, exact: true }).first().scrollIntoViewIfNeeded();
      if (width !== 360 || locale === "de") await page.screenshot({ path: evidencePath(`QA-203-${locale}-${width}-${colorScheme}.png`) });
      results.push({ colorScheme, width, buttons: buttons.length, minHeight: Math.min(...buttons.map(button => button.height)), maxRight: Math.max(...buttons.map(button => button.right)) });
    }
    recordQa(`QA-203-${locale}`, results);
  });
});
