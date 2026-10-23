import { test, expect } from "@playwright/test";
import { evidencePath, recordQa, signInQa } from "./qaRound2Session";
import { catalogs } from "./qaSweep3";

// QA-210: the folder placeholder fits the desktop search field without a hard cut.
for (const locale of ["de", "en"] as const) test.describe(`QA-210 ${locale}`, () => {
  const copy = catalogs[locale];
  test.use({ locale: locale === "de" ? "de-DE" : "en-GB" });
  test(`QA-210 the folder search placeholder fits at 1440 and 1280 (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInQa(page);
    const expected = copy.Search.placeholder.folder.replace("{folder}", copy.Folders.inbox);
    const input = page.locator("#top-search-input");
    await expect(input).toHaveAttribute("placeholder", expected);
    const results = [];
    for (const [width, colorScheme] of [[1440, "light"], [1280, "dark"], [1440, "dark"], [1280, "light"]] as const) {
      await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme });
      await expect(input).toBeVisible();
      const fit = await input.evaluate((element: HTMLInputElement) => {
        const style = getComputedStyle(element);
        const canvas = document.createElement("canvas").getContext("2d")!;
        canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const available = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return { text: canvas.measureText(element.placeholder).width, available };
      });
      expect(fit.text, `${locale} ${width}`).toBeLessThanOrEqual(fit.available);
      if (locale === "de" || colorScheme === "light") await page.locator('[data-slot="shell-header"]').screenshot({ path: evidencePath(`QA-210-search-${locale}-${width}-${colorScheme}.png`) });
      results.push({ width, colorScheme, ...fit });
    }
    recordQa(`QA-210-${locale}`, { placeholder: expected, results });
  });
});
