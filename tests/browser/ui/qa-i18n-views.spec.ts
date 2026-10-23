import { test, expect } from "@playwright/test";
import { evidencePath, recordQa, signInQa } from "./qaRound2Session";

// Uses the existing synthetic shell fixture and its authenticated session.
test("settings tabs contain wrapped labels at phone widths in both locales", async ({ page }) => {
  await signInQa(page);
  const results = [];
  for (const locale of ["de", "en"]) {
    const response = await page.request.put("/api/auth/preferences", { data: { uiLocale: locale },
      headers: { origin: new URL(page.url()).origin } });
    expect(response.status()).toBe(200);
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await page.getByRole("button", { name: locale === "de" ? "Seitenleiste umschalten" : "Toggle sidebar", exact: true }).click();
      await page.getByRole("button", { name: locale === "de" ? "Benutzermenü" : "User menu", exact: true }).click();
      await page.getByRole("menuitem", { name: locale === "de" ? "Einstellungen" : "Settings", exact: true }).click();
      const tabs = page.getByRole("tablist");
      await expect(tabs).toBeVisible();
      const measurements = await tabs.getByRole("tab").evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        const label = element.querySelector(".rt-TabsTriggerInner")!.getBoundingClientRect();
        return { text: element.getAttribute("aria-label"), top: rect.top, bottom: rect.bottom,
          height: rect.height, labelTop: label.top, labelBottom: label.bottom };
      }));
      for (const [index, row] of measurements.entries()) {
        expect(row.height).toBeGreaterThanOrEqual(44);
        expect(row.labelTop).toBeGreaterThanOrEqual(row.top);
        expect(row.labelBottom).toBeLessThanOrEqual(row.bottom);
        if (index) expect(row.top).toBeGreaterThanOrEqual(measurements[index - 1].bottom);
      }
      await page.screenshot({ path: evidencePath(`i18n-settings-${locale}-${width}.png`) });
      results.push({ locale, width, measurements });
    }
  }
  recordQa("i18n-settings", results);
});
