import { test, expect } from "@playwright/test";
import { evidencePath, openQaMenu, recordQa, signInQa } from "./qaRound2Session";

test("QA-103 Translation retains the shell in all five viewports and both themes", async ({ page }) => {
  const errors: string[] = [], results = [];
  page.on("pageerror", error => errors.push(error.message));
  await signInQa(page);
  for (const theme of ["light", "dark"] as const) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 834, height: 1112 }, { width: 390, height: 844 }, { width: 360, height: 780 }]) {
      await page.setViewportSize(viewport); await page.emulateMedia({ colorScheme: theme });
      await page.goto("/"); await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      await openQaMenu(page, "Settings");
      await page.getByRole("tab", { name: "Translation", exact: true }).click();
      await expect(page.getByLabel("API key", { exact: true })).toBeVisible();
      await expect(page.getByRole("switch", { name: "Enable translation", exact: true })).toBeVisible();
      await expect(page.getByLabel("Default target language", { exact: true })).toBeVisible();
      await expect(page.locator('[data-slot="shell-header"]')).toBeAttached();
      await expect(page.getByText("This page couldn’t load", { exact: false })).toHaveCount(0);
      const dialog = page.getByRole("dialog").last();
      const box = await dialog.boundingBox();
      if (viewport.width < 768) {
        expect(box!.x).toBe(0); expect(box!.y).toBe(0);
        expect(box!.width).toBe(viewport.width); expect(box!.height).toBe(viewport.height);
      }
      await page.screenshot({ path: evidencePath(`QA-103-${viewport.width}-${theme}.png`) });
      results.push({ theme, ...viewport, renders: true, shell: true, dialog: box });
    }
  }
  expect(errors).toEqual([]);
  recordQa("QA-103", { results, pageErrors: errors });
});
