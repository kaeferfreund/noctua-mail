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

async function openFromUserMenu(page: Page, width: number, item: "Einstellungen" | "Administration") {
  await page.goto("/");
  if (width < 768) await page.getByRole("button", { name: "Seitenleiste umschalten", exact: true }).click();
  await page.getByRole("button", { name: "Benutzermenü", exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

async function openSettings(page: Page, width: number) {
  await openFromUserMenu(page, width, "Einstellungen");
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

// Native admin selects share the settings control look: rounded, padded, 44px on phones.
async function nativeSelects(scope: ReturnType<Page["locator"]>) {
  return scope.locator("select").evaluateAll(elements => elements
    .filter(element => (element as HTMLElement).offsetParent)
    .map(element => ({ label: element.getAttribute("aria-label") ?? element.closest("label")?.textContent?.slice(0, 40) ?? "",
      height: (element as HTMLElement).offsetHeight, radius: getComputedStyle(element).borderTopLeftRadius, padding: getComputedStyle(element).paddingLeft })));
}
function expectStyledSelects(selects: Awaited<ReturnType<typeof nativeSelects>>, width: number) {
  expect(selects.length).toBeGreaterThan(0);
  for (const select of selects) {
    expect(select.height).toBeGreaterThanOrEqual(width < 768 ? 44 : 36);
    expect(Number.parseFloat(select.radius)).toBeGreaterThan(0);
    expect(Number.parseFloat(select.padding)).toBeGreaterThanOrEqual(8);
  }
}

test("admin selects are styled and the admin members table sits on a card in both themes", async ({ page }) => {
  await signInQa(page);
  await setGerman(page);
  const results = [];
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await openFromUserMenu(page, width, "Administration");
      const admin = page.getByRole("dialog", { name: "Administration", exact: true });
      await expect(admin.getByRole("combobox", { name: "Rolle für alex@example.test", exact: true })).toBeVisible();
      await page.screenshot({ path: evidencePath(`admin-users-${width}-${colorScheme}.png`) });
      const userSelects = await nativeSelects(admin);
      expectStyledSelects(userSelects, width);
      await admin.getByRole("button", { name: "Einladungen", exact: true }).click();
      await expect(admin.getByRole("combobox", { name: "Rolle der eingeladenen Person", exact: true })).toBeVisible();
      const inviteSelects = await nativeSelects(admin);
      expectStyledSelects(inviteSelects, width);
      await admin.getByRole("button", { name: "Postfächer", exact: true }).click();
      await admin.getByRole("button", { name: "Mitglieder verwalten", exact: true }).first().click();
      const members = page.getByRole("dialog", { name: "Mitglieder von demo@monkeydent.test", exact: true });
      const table = members.locator("[data-members-table]");
      await expect(table.locator("tbody tr")).not.toHaveCount(0);
      await page.screenshot({ path: evidencePath(`admin-members-${width}-${colorScheme}.png`) });
      // The members dialog portals outside the Settings theme; its table still gets the panel card.
      const card = await table.evaluate(element => {
        const style = getComputedStyle(element);
        const cell = getComputedStyle(element.querySelector("th")!);
        return { background: style.backgroundColor, image: style.backgroundImage, radius: style.borderTopLeftRadius, cellPadding: cell.paddingLeft,
          scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
      });
      results.push({ colorScheme, width, userSelects, inviteSelects, card: { ...card, image: card.image.slice(0, 40) } });
      expect(card.background).not.toBe("rgba(0, 0, 0, 0)");
      expect(card.image).toContain("radial-gradient");
      expect(Number.parseFloat(card.radius)).toBeGreaterThan(0);
      expect(Number.parseFloat(card.cellPadding)).toBeGreaterThan(0);
      if (width < 768) expect(card.scrollWidth).toBeGreaterThan(card.clientWidth);
      await page.keyboard.press("Escape");
      await expect(members).toBeHidden();
      await page.keyboard.press("Escape");
      await expect(admin).toBeHidden();
    }
  }
  recordQa("settings-admin", results);
});

test("the MCP tab fits phones and keeps mailbox names whole", async ({ page }) => {
  await signInQa(page);
  await setGerman(page);
  const results = [];
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const dialog = await openSettings(page, width);
    await dialog.getByRole("tab", { name: "MCP", exact: true }).click();
    const panel = dialog.locator('[role="tabpanel"][data-state="active"]');
    const mailbox = panel.getByRole("checkbox", { name: "QA Shared (demo@monkeydent.test)", exact: true });
    await expect(mailbox).toBeVisible();
    await page.screenshot({ path: evidencePath(`settings-mcp-${width}.png`) });
    const url = panel.getByText(/\/api\/mcp$/);
    const endpoint = await url.evaluate(element => {
      const card = element.closest(".rt-Card")!.getBoundingClientRect(), box = element.getBoundingClientRect();
      return { title: element.getAttribute("title"), right: box.right, cardRight: card.right };
    });
    // The mailbox name is user text: not hyphenated or split at an arbitrary letter, and
    // "(demo@monkeydent.test)" stays on one line where the column fits it.
    const label = await panel.locator("label").filter({ hasText: "QA Shared (demo@monkeydent.test)" }).evaluate(element => {
      const text = element.textContent!, range = document.createRange();
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = []; for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);
      const open = nodes.find(node => node.data.includes("("))!, close = [...nodes].reverse().find(node => node.data.includes(")"))!;
      range.setStart(open, open.data.indexOf("(")); range.setEnd(close, close.data.lastIndexOf(")") + 1);
      const user = element.querySelector("[data-user-text]"), style = user && getComputedStyle(user);
      return { text, lines: new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size,
        hyphens: style?.hyphens, overflowWrap: style?.overflowWrap };
    });
    const overflow = await sidewaysScrollers(page);
    results.push({ width, endpoint, label, overflow });
    expect(overflow).toEqual([]);
    expect(endpoint.title).toMatch(/\/api\/mcp$/);
    expect(endpoint.right).toBeLessThanOrEqual(endpoint.cardRight);
    expect(label).toMatchObject({ hyphens: "manual", overflowWrap: "break-word" });
    if (width >= 768) expect(label.lines).toBe(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
  recordQa("settings-mcp", results);
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
