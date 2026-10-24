import { test, expect } from "@playwright/test";
import { evidencePath, recordQa, signInQa } from "../../tests/browser/ui/qaRound2Session";
import { catalogs } from "../../tests/browser/ui/qaSweep3";

for (const locale of ["de", "en"] as const) test.describe(`phone ${locale}`, () => {
  const loc = catalogs[locale];
  test.use({ locale: locale === "de" ? "de-DE" : "en-GB" });
  test(`review QA-210 phone placeholder (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInQa(page);
    const results = [];
    for (const [width, height, scheme] of [[390, 844, "light"], [390, 844, "dark"], [320, 568, "light"], [320, 568, "dark"]] as const) {
      await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: scheme });
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: loc.Shell.search, exact: true }).first().click();
      const input = page.locator("#top-search-input:visible");
      await expect(input).toBeVisible();
      await page.waitForTimeout(400);
      const fit = await input.evaluate((element: HTMLInputElement) => {
        const style = getComputedStyle(element);
        const canvas = document.createElement("canvas").getContext("2d")!;
        canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        return { placeholder: element.placeholder, text: Math.round(canvas.measureText(element.placeholder).width), available: Math.round(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) };
      });
      await page.screenshot({ path: evidencePath(`QA-210-review-phone-${locale}-${width}-${scheme}.png`) });
      results.push({ width, scheme, ...fit });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
    recordQa(`review-QA-210-phone-${locale}`, results);
  });
});
