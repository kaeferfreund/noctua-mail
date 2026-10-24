import { test, expect, type Page } from "@playwright/test";
import { evidencePath, recordQa, signInQa } from "./qaRound2Session";

// Settings layout regressions (QA-205/207/216, 320 px overflow, hyphenation scope)
// on the synthetic shell fixture, in German.
async function setGerman(page: Page) {
  await page.goto("/message/window");
  const response = await page.request.put("/api/auth/preferences", { data: { uiLocale: "de" },
    headers: { origin: new URL(page.url()).origin } });
  expect(response.status()).toBe(200);
}

async function openSettings(page: Page, width: number) {
  await page.goto("/");
  if (width < 768) await page.getByRole("button", { name: "Seitenleiste umschalten", exact: true }).click();
  await page.getByRole("button", { name: "Benutzermenü", exact: true }).click();
  await page.getByRole("menuitem", { name: "Einstellungen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Postfacheinstellungen", exact: true });
  await expect(dialog.getByRole("tablist")).toBeVisible();
  // The dialog scales while opening; measure after its animation.
  await expect.poll(async () => (await dialog.boundingBox())?.width ?? 0).toBeCloseTo(width < 768 ? width : Math.min(980, width * 0.94), 0);
  return dialog;
}

// Scroll containers in the active panel that scroll sideways (the members table is meant to).
// Form controls scroll their own value (a long host name in a narrow input) and are not layout overflow.
function sidewaysScrollers(page: Page) {
  return page.locator('[role="tabpanel"][data-state="active"]').evaluate(panel => {
    const offenders: string[] = [];
    for (const element of [panel, ...panel.querySelectorAll<HTMLElement>("*")]) {
      if (element.closest("[data-members-table]") || element.matches("input, textarea, select")) continue;
      if (getComputedStyle(element).overflowX === "visible") continue;
      if (element.scrollWidth > element.clientWidth + 1) offenders.push(`${element.tagName}.${element.className} ${element.scrollWidth}>${element.clientWidth}`);
    }
    return offenders;
  });
}

test("settings fit phones, use 44px selects there, save once and hint the members scroll", async ({ page }) => {
  await signInQa(page);
  await setGerman(page);
  const results = [];
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const dialog = await openSettings(page, width);
    for (const tab of ["Postfach", "Persönliche Einstellungen", "Themen", "Mitglieder"]) {
      await dialog.getByRole("tab", { name: tab, exact: true }).click();
      const panel = dialog.locator('[role="tabpanel"][data-state="active"]');
      await expect(panel).toBeVisible();
      if (tab === "Persönliche Einstellungen") await expect(panel.getByLabel("Standardabsender", { exact: true })).toBeEnabled();
      if (tab === "Mitglieder") await expect(panel.locator("tbody tr")).not.toHaveCount(0);
      const selects = await panel.locator("select").evaluateAll(elements => elements
        .filter(element => (element as HTMLElement).offsetParent)
        .map(element => ({ label: element.getAttribute("aria-label") ?? element.closest("label")?.textContent?.slice(0, 40) ?? element.id, height: (element as HTMLElement).offsetHeight })));
      const overflow = await sidewaysScrollers(page);
      results.push({ width, tab, overflow, selects });
      expect(overflow).toEqual([]);
      for (const select of selects) expect(select.height).toBeGreaterThanOrEqual(width < 768 ? 44 : 36);
      const slug = { Postfach: "account", "Persönliche Einstellungen": "preferences", Themen: "topics", Mitglieder: "members" }[tab];
      await page.screenshot({ path: evidencePath(`settings-${slug}-${width}.png`) });
      if (tab === "Persönliche Einstellungen") {
        // QA-216: one save path for the whole tab.
        await expect(dialog.getByRole("button", { name: /speichern/i })).toHaveCount(1);
        expect(await panel.locator("fieldset").evaluateAll(sets => sets.map(set => getComputedStyle(set).borderTopWidth))).toEqual(["0px", "0px"]);
        if (width < 768) {
          // Hyphenation covers UI labels only, not the signature preview.
          expect(await panel.getByText("Standardabsender", { exact: true }).evaluate(element => getComputedStyle(element).hyphens)).toBe("auto");
          expect(await panel.locator("pre").evaluate(element => getComputedStyle(element).hyphens)).toBe("manual");
          await panel.locator("pre").scrollIntoViewIfNeeded();
          await page.screenshot({ path: evidencePath(`settings-preferences-${width}-bottom.png`) });
        }
      }
      if (tab === "Mitglieder" && width < 768) {
        const table = panel.locator("[data-members-table]");
        const scroll = await table.evaluate(element => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
          background: getComputedStyle(element).backgroundImage }));
        expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
        expect(scroll.background).toContain("radial-gradient");
      }
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
  recordQa("settings-phone", results);
});

test("QA-205: one Escape closes Settings opened from the user menu", async ({ page }) => {
  await signInQa(page);
  await setGerman(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const dialog = await openSettings(page, 1440);
  await expect(dialog.getByRole("tab", { name: "Postfach", exact: true })).toBeFocused();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Benutzermenü", exact: true })).toBeFocused();
});

test("QA-215: the reader labels IMAP system flags in German", async ({ page }) => {
  await signInQa(page);
  await setGerman(page);
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto("/");
  // A seed message that is already \\Seen (its row has no "Ungelesen" prefix).
  await page.getByRole("button", { name: /^Jona Testperson Vorsorge nach den Ferien/ }).first().click();
  // The flag badges sit in the header of the expanded message card.
  const badge = page.getByText("Gelesen", { exact: true }).first();
  await expect(badge).toBeVisible();
  await expect(page.getByText("Seen", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: evidencePath("reader-seen-badge-1280.png") });
});
