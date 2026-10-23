import { test, expect, type Page } from "@playwright/test";
import { evidencePath, recordQa, signInQa } from "./qaRound2Session";

// Leave the shell's identity/locale listener before changing its server preference.
// Otherwise an in-flight identity refresh can race the next full navigation.
async function setLocale(page: Page, locale: string) {
  await page.goto("/message/window");
  const response = await page.request.put("/api/auth/preferences", { data: { uiLocale: locale },
    headers: { origin: new URL(page.url()).origin } });
  expect(response.status()).toBe(200);
}

// Uses the existing synthetic shell fixture and its authenticated session.
test("settings tabs contain wrapped labels in both locales", async ({ page }) => {
  await signInQa(page);
  const results = [];
  for (const locale of ["de", "en"]) {
    await setLocale(page, locale);
    for (const width of [1280, 320, 360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      if (width < 768) await page.getByRole("button", { name: locale === "de" ? "Seitenleiste umschalten" : "Toggle sidebar", exact: true }).click();
      await page.getByRole("button", { name: locale === "de" ? "Benutzermenü" : "User menu", exact: true }).click();
      await page.getByRole("menuitem", { name: locale === "de" ? "Einstellungen" : "Settings", exact: true }).click();
      const tabs = page.getByRole("tablist");
      await expect(tabs).toBeVisible();
      // The settings dialog scales while opening; measure after its animation.
      if (width < 768) await expect.poll(async () => (await tabs.getByRole("tab").first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const measurements = await tabs.getByRole("tab").evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        const label = element.querySelector(".rt-TabsTriggerInner")!.getBoundingClientRect();
        return { text: element.getAttribute("aria-label"), top: rect.top, bottom: rect.bottom,
          height: rect.height, labelTop: label.top, labelBottom: label.bottom };
      }));
      for (const [index, row] of measurements.entries()) {
        expect(row.height).toBeGreaterThanOrEqual(width < 768 ? 44 : 32);
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

test("sidebar view rows reserve count space and contain wrapped labels", async ({ page }) => {
  await signInQa(page);
  const results = [];
  for (const locale of ["de", "en"]) {
    await setLocale(page, locale);
    for (const width of [1280, 390, 360, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      if (width < 768) await page.getByRole("button", { name: locale === "de" ? "Seitenleiste umschalten" : "Toggle sidebar", exact: true }).click();
      const rows = page.locator("[data-view-id]");
      await expect(rows).toHaveCount(7);
      await expect(page.locator('[data-view-id="virtual:focused"]').locator("..").locator('[data-sidebar="menu-badge"]')).toBeVisible();
      const measurements = await rows.evaluateAll(elements => elements.map(element => {
        const row = element.getBoundingClientRect();
        const label = element.querySelector("span")!.getBoundingClientRect();
        const badge = element.parentElement!.querySelector('[data-sidebar="menu-badge"]');
        const count = badge?.getBoundingClientRect();
        return { id: element.getAttribute("data-view-id"), top: row.top, bottom: row.bottom, height: row.height,
          labelTop: label.top, labelBottom: label.bottom, labelRight: label.right,
          countLeft: count?.left, countText: badge?.textContent, countAriaLabel: badge?.getAttribute("aria-label") };
      }));
      for (const [index, row] of measurements.entries()) {
        expect(row.labelTop).toBeGreaterThanOrEqual(row.top);
        expect(row.labelBottom).toBeLessThanOrEqual(row.bottom);
        if (row.countLeft !== undefined) {
          expect(row.labelRight).toBeLessThanOrEqual(row.countLeft);
          expect(row.countText).not.toMatch(/ungelesen|Aufgaben|Unread|Pending/);
          expect(row.countAriaLabel).toBeTruthy();
        }
        if (index) expect(row.top).toBeGreaterThanOrEqual(measurements[index - 1].bottom);
      }
      await page.screenshot({ path: evidencePath(`i18n-sidebar-${locale}-${width}.png`) });
      results.push({ locale, width, measurements });
    }
  }
  recordQa("i18n-sidebar", results);
});

test("detached folder tooltips and move notices use the picker locale", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await signInQa(page);
  const identity = await (await page.request.get("/api/auth/me")).json();
  const accountId = identity.accountId as string;
  const folders = await (await page.request.get(`/api/accounts/${accountId}/folders`)).json();
  const inbox = folders.find((folder: { specialUse?: string }) => folder.specialUse?.toLowerCase() === "\\inbox");
  const sent = folders.find((folder: { specialUse?: string }) => folder.specialUse?.toLowerCase() === "\\sent");
  expect(inbox).toBeTruthy(); expect(sent).toBeTruthy();
  const listPath = `/api/accounts/${accountId}/messages?folderId=${encodeURIComponent(inbox.id)}&pageSize=1`;
  const results = [];
  for (const locale of ["de", "en"]) {
    await setLocale(page, locale);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const before = await (await page.request.get(listPath)).json();
      expect(before.items.length).toBe(1);
      await page.goto(`/message/window?accountId=${encodeURIComponent(accountId)}&messageId=${encodeURIComponent(before.items[0].id)}`);
      const badge = page.getByRole("button", { name: locale === "de" ? "Posteingang" : "Inbox", exact: true });
      await expect(badge).toHaveAttribute("title", locale === "de" ? "Posteingang" : "Inbox");
      await badge.hover();
      await page.screenshot({ path: evidencePath(`i18n-detached-${locale}-${width}.png`) });
      await page.goto("/");
      if (width < 768) await page.getByRole("button", { name: locale === "de" ? "Seitenleiste umschalten" : "Toggle sidebar", exact: true }).click();
      await page.locator('[data-view-id^="folder:"]').click();
      const row = page.locator("[data-message-list-row]").first();
      await row.click({ modifiers: ["Control"] });
      await page.getByRole("button", { name: locale === "de" ? /^Nachrichtenaktionen:/ : /^Message actions:/ }).click();
      await page.getByRole("menuitem", { name: locale === "de" ? "Verschieben nach" : "Move to", exact: true }).hover();
      await page.getByRole("menuitem", { name: locale === "de" ? "Mehr …" : "More...", exact: true }).click();
      const picker = page.getByRole("dialog", { name: locale === "de" ? "Verschieben nach …" : "Move to...", exact: true });
      const moved = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/messages/move"));
      await picker.locator(`[data-folder-id=${JSON.stringify(sent.id)}]`).click();
      expect((await moved).status()).toBe(200);
      const notice = page.getByText(locale === "de" ? /Nachricht.*nach „Gesendet“ verschoben/ : /(?:Moving|Moved) (?:message|[0-9]+ messages) to Sent/).first();
      await expect(notice).toBeVisible();
      const text = await notice.innerText();
      await page.screenshot({ path: evidencePath(`i18n-move-${locale}-${width}.png`) });
      await page.getByRole("button", { name: locale === "de" ? "Rückgängig" : "Undo", exact: true }).first().click();
      await expect.poll(async () => (await (await page.request.get(listPath)).json()).total).toBe(before.total);
      results.push({ locale, width, folderTitle: locale === "de" ? "Posteingang" : "Inbox", notice: text, undone: true });
    }
  }
  expect(errors).toEqual([]);
  recordQa("i18n-reader-moves", { results, pageErrors: errors });
});
