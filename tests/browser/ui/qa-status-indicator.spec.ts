import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { totpFromUri } from "../../helpers/totp";

// Same synthetic seed/login and fixture lifecycle as qa-shell.spec.ts.
// QA_SHELL_SPEC=qa-status-indicator.spec.ts QA_SHELL_PORT=3875 with explicit
// QA_SHELL_FIXTURE_{IMAP,SMTP,CONTROL}_PORT=3876/3877/3878.
test.use({ locale: "de-DE" });
let cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
const artifacts = process.env.QA_STATUS_ARTIFACTS ?? ".tmp/qa-status-indicator";
const baseline = process.env.QA_STATUS_BASELINE === "1";
const metrics: unknown[] = [];
const gains: unknown[] = [];
const footerGains: unknown[] = [];
async function post(page: Page, path: string, body: unknown) {
  return page.evaluate(async ({ path, body }) => {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return response.status;
  }, { path, body });
}
async function measure(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing measurement target: ${selector}`);
      const box = element.getBoundingClientRect(), css = getComputedStyle(element);
      return { x: box.x, y: box.y, width: box.width, height: box.height,
        usableWidth: element.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight),
        paddingX: parseFloat(css.paddingLeft), paddingY: parseFloat(css.paddingTop),
        border: css.borderLeftWidth, radius: css.borderRadius, shadow: css.boxShadow };
    };
    return { header: rect('[data-slot="shell-header"]'), grid: rect('#noctua-panes'),
      list: rect('#list > div'), listBody: rect('#list aside'), reader: rect('#reader > div'),
      readerBody: rect('#reader [class*="threadView"]:not([class*="threadViewShell"])') };
  });
}
test.beforeAll(async ({ browser }) => {
  mkdirSync(artifacts, { recursive: true });
  const [seed] = JSON.parse(readFileSync(process.env.QA_SHELL_SEED_FILE!, "utf8"));
  const context = await browser.newContext({ locale: "de-DE", baseURL: process.env.QA_SHELL_BASE_URL }), page = await context.newPage();
  await page.goto("/");
  expect(await post(page, "/api/ba/sign-in/email", { email: seed.email, password: seed.password })).toBe(200);
  expect(await post(page, "/api/ba/two-factor/verify-totp", { code: totpFromUri(seed.totpURI) })).toBe(200);
  expect(await post(page, "/api/auth/switch-account", { accountId: "qa-shared" })).toBe(200);
  // Finish the cold-start folder bootstrap before navigating away. The QA
  // seed deliberately begins without cached folders/messages.
  await page.goto("/");
  await expect(page.locator('#list [data-message-list-row]').first()).toBeVisible({ timeout: 120000 });
  cookies = await context.cookies(); await context.close();
});
test.beforeEach(async ({ page }) => {
  await page.context().addCookies(cookies);
  await page.goto("/");
  await expect(page.locator('[data-status-indicator]')).toBeVisible();
});
test("desktop status sections, density measurements and light/dark screenshots", async ({ page }) => {
  for (const width of [1280, 1024]) for (const colorScheme of ["light", "dark"] as const) {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme }); await page.goto("/");
    await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
    await expect(page.locator('#list [data-message-list-row]').first()).toBeVisible();
    // Wait for the background fixture sync so the screenshots exercise idle.
    await expect(page.locator('[data-status-indicator]')).toHaveAttribute("data-status-indicator", "idle", { timeout: 120000 });
    const before = await measure(page);
    metrics.push({ width, colorScheme, ...before });
    if (baseline) continue;
    const previous = JSON.parse(readFileSync(`${artifacts}/baseline-metrics.json`, "utf8")).find((value: { width: number; colorScheme: string }) => value.width === width && value.colorScheme === colorScheme);
    expect(before.header).toEqual(previous.header);
    expect(before.listBody.usableWidth).toBeGreaterThan(previous.listBody.usableWidth);
    expect(before.reader.width).toBeGreaterThan(previous.reader.width);
    expect(before.reader.height).toBeGreaterThan(previous.reader.height);
    gains.push({ width, colorScheme, listUsableWidth: { before: previous.listBody.usableWidth, after: before.listBody.usableWidth, gain: before.listBody.usableWidth - previous.listBody.usableWidth },
      readerWidth: { before: previous.reader.width, after: before.reader.width, gain: before.reader.width - previous.reader.width },
      readerHeight: { before: previous.reader.height, after: before.reader.height, gain: before.reader.height - previous.reader.height },
      readerBodyUsableWidth: { before: previous.readerBody.usableWidth, after: before.readerBody.usableWidth, gain: before.readerBody.usableWidth - previous.readerBody.usableWidth } });
    expect(before.grid.paddingX).toBeLessThanOrEqual(8);
    expect(before.listBody.paddingX).toBeLessThanOrEqual(12);
    expect(before.readerBody.paddingX).toBeLessThanOrEqual(16);
    expect(before.list.border).toBe("0px"); expect(before.reader.border).toBe("0px");
    expect(before.list.radius).toBe("0px"); expect(before.reader.radius).toBe("0px");
    expect(before.list.shadow).toBe("none"); expect(before.reader.shadow).toBe("none");
    expect(Math.abs(before.reader.x - before.list.x - before.list.width - 1)).toBeLessThan(1);
    await expect(page.locator(".bottom-bar, .bottom-center-time")).toHaveCount(0);
    // Restore only the removed footer's measured 28px flex footprint to
    // isolate its gain from the independent desktop density pass.
    await page.locator('#noctua-panes').evaluate(grid => {
      const footer = document.createElement("div"); footer.dataset.qaOldFooter = "";
      footer.style.cssText = "height:28px;min-height:28px;flex-shrink:0"; grid.after(footer);
    });
    const withFooter = await measure(page);
    expect(before.list.height - withFooter.list.height).toBe(28);
    expect(before.reader.height - withFooter.reader.height).toBe(28);
    expect(withFooter.header).toEqual(before.header);
    footerGains.push({ width, colorScheme, listHeight: { withFooter: withFooter.list.height, withoutFooter: before.list.height },
      readerHeight: { withFooter: withFooter.reader.height, withoutFooter: before.reader.height }, gain: 28 });
    await page.locator('[data-qa-old-footer]').evaluate(footer => footer.remove());
    await page.screenshot({ animations: "disabled", path: `${artifacts}/desktop-${width}-${colorScheme}.png` });
    await page.locator('[data-status-indicator]').click();
    const popover = page.getByRole("dialog", { name: "Aktivität und Kalender" });
    await expect(popover).toBeVisible();
    for (const title of ["Hintergrundaufgaben", "Posteingangsprüfung", "Fehler", "Demnächst"]) await expect(popover.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await popover.getByRole("button", { name: /^Posteingangsprüfung/ }).click();
    await expect(popover.getByText(/^Letzte Prüfung:/)).toBeVisible();
    await popover.getByRole("button", { name: "Fehler", exact: true }).click();
    await expect(popover.getByRole("button", { name: "Alle Fehler löschen" })).toBeVisible();
    await popover.getByRole("button", { name: /^Demnächst/ }).click();
    await expect(popover.getByRole("button", { name: "Kalender öffnen", exact: true })).toBeVisible();
    await page.screenshot({ animations: "disabled", path: `${artifacts}/popover-${width}-${colorScheme}.png` });
    await page.keyboard.press("Escape"); await expect(popover).toHaveCount(0);
    const after = await measure(page);
    expect(after).toEqual(before); // A portal must never take space from either pane.
  }
  writeFileSync(`${artifacts}/${baseline ? "baseline" : "final"}-metrics.json`, JSON.stringify(metrics, null, 2) + "\n");
  if (!baseline) {
    writeFileSync(`${artifacts}/density-gains.json`, JSON.stringify(gains, null, 2) + "\n");
    writeFileSync(`${artifacts}/footer-gains.json`, JSON.stringify(footerGains, null, 2) + "\n");
  }
});
test("PWA calendar route uses the header popover and preserves other URL state", async ({ page }) => {
  test.skip(baseline);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?other=keep&openCalendar=1#anchor");
  const popover = page.getByRole("dialog", { name: "Aktivität und Kalender" });
  await expect(popover).toBeVisible();
  await expect(popover.locator('[data-status-section="reminder"] button[aria-expanded]')).toHaveAttribute("aria-expanded", "true");
  await expect(popover.getByRole("button", { name: "Kalender-Seitenleiste einblenden" })).toBeVisible();
  await expect(page).toHaveURL(/\?other=keep#anchor$/);
  await popover.getByRole("button", { name: "Kalender-Seitenleiste einblenden" }).click();
  await expect(popover).toHaveCount(0);
  await expect(page.locator('#calendar')).toBeVisible();
});
test("390px keeps the menu, Sheet, 44px target and hidden footer", async ({ page }) => {
  test.skip(baseline);
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  const indicator = page.locator('[data-status-indicator]');
  await expect(indicator).toBeVisible();
  const box = await indicator.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.bottom-bar')).toHaveCount(0);
  await expect(page.locator('#reader')).toBeHidden();
  await page.screenshot({ animations: "disabled", path: `${artifacts}/mobile-390.png` });
  await indicator.click();
  await page.getByRole("menuitem", { name: "Hintergrundaufgaben", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Hintergrundaufgaben", exact: true });
  await expect(sheet).toHaveAttribute("data-slot", "sheet-content");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(sheet).toHaveCSS("opacity", "1");
  await page.screenshot({ animations: "disabled", path: `${artifacts}/mobile-sheet-390.png` });
  await page.keyboard.press("Escape"); await expect(sheet).toHaveCount(0); await expect(indicator).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

test("density preserves reader controls, inline compose, resizing, notice alignment and detached isolation", async ({ page }) => {
  test.skip(baseline);
  await page.setViewportSize({ width: 1280, height: 900 });
  const firstRow = page.locator('#list [data-message-list-row]').first();
  await firstRow.click();
  const threadHeader = page.locator('#reader [class*="threadHeader"]');
  const collaboration = page.getByLabel("Zusammenarbeit im Thread");
  await expect(threadHeader).toBeVisible(); await expect(collaboration).toBeVisible();
  const style = (locator: ReturnType<Page["locator"]>) => locator.evaluate(element => {
    const css = getComputedStyle(element);
    return { padding: css.padding, radius: css.borderRadius, shadow: css.boxShadow, fontSize: css.fontSize, lineHeight: css.lineHeight };
  });
  await page.screenshot({ animations: "disabled", path: `${artifacts}/reader-1280-light.png` });
  const headerStyle = await style(threadHeader), collaborationStyle = await style(collaboration);
  // Density tokens only affect pane wrappers. Raising them must not style
  // the thread header, collaboration controls or the inline compose card.
  await page.locator('#noctua-panes').evaluate(element => element.setAttribute("style", `${element.getAttribute("style") ?? ""}; --pane-padding-x: 16px; --pane-padding-y: 16px;`));
  expect(await style(threadHeader)).toEqual(headerStyle); expect(await style(collaboration)).toEqual(collaborationStyle);
  await page.locator('#noctua-panes').evaluate(element => { (element as HTMLElement).style.removeProperty("--pane-padding-x"); (element as HTMLElement).style.removeProperty("--pane-padding-y"); });

  const separator = page.locator('#noctua-panes > [data-slot="resizable-handle"]').first();
  const listWidth = (await page.locator('#list').boundingBox())!.width;
  await separator.focus(); await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await page.locator('#list').boundingBox())!.width).toBeGreaterThan(listWidth);

  // The message menu opens the existing standalone reader, outside the shell.
  await firstRow.getByRole("button", { name: "Nachrichtenaktionen", exact: true }).click();
  const popupReady = page.waitForEvent("popup");
  await page.getByRole("menuitem", { name: "In neuem Fenster öffnen", exact: true }).click();
  const detached = await popupReady;
  await expect(detached.locator('#noctua-panes')).toHaveCount(0);
  expect(await detached.locator('body').evaluate(element => getComputedStyle(element).getPropertyValue("--pane-padding-x"))).toBe("");
  await detached.close();

  await page.getByRole("button", { name: "Neue E-Mail", exact: true }).click();
  const compose = page.locator('article[class*="ComposeInlineCard"]');
  await expect(compose).toBeVisible();
  await page.screenshot({ animations: "disabled", path: `${artifacts}/compose-1280-light.png` });
  const composeStyle = await style(compose);
  expect(composeStyle.radius).not.toBe("0px");
  await page.locator('#noctua-panes').evaluate(element => { (element as HTMLElement).style.setProperty("--pane-padding-x", "16px"); });
  expect(await style(compose)).toEqual(composeStyle);
  await page.locator('#noctua-panes').evaluate(element => { (element as HTMLElement).style.removeProperty("--pane-padding-x"); });
  // No draft content was entered. Reload returns to the ordinary reader.
  await page.reload(); await expect(page.locator('[data-status-indicator]')).toBeVisible();
  await page.getByRole("button", { name: "Seitenleiste umschalten", exact: true }).click();
  await expect(page.locator('[data-status-indicator]')).toHaveAttribute("data-status-indicator", "idle", { timeout: 120000 });
  await page.route("**/api/accounts/qa-shared/sync**", route => route.fulfill({ status: 500, json: { error: "Synthetic status QA error" } }));
  await page.locator('[data-status-indicator]').click();
  await page.getByRole("dialog", { name: "Aktivität und Kalender" }).getByRole("button", { name: "Neue E-Mails abrufen", exact: true }).click();
  await expect(page.locator('[data-status-indicator]')).toHaveAttribute("data-status-indicator", "attention");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Aktivität und Kalender" })).toHaveCount(0);
  const offset = await page.locator('[data-placement="floating"]').evaluate(element => ({
    actual: parseFloat((element as HTMLElement).style.right),
    expected: Math.round(innerWidth - document.querySelector('#list aside')!.getBoundingClientRect().right)
  }));
  expect(Math.abs(offset.actual - offset.expected)).toBeLessThanOrEqual(1);
});

for (const [width, height] of [[1280, 900], [1024, 900], [390, 844]]) {
  test(`calendar frame renders clickable events at ${width}x${height}`, async ({ page }) => {
    test.skip(baseline);
    await page.setViewportSize({ width, height });
    const summary = `Synthetic calendar frame ${width}`;
    expect(await post(page, "/api/accounts/qa-shared/calendar/events", {
      summary, startAtMs: Date.now(), endAtMs: Date.now() + 3600000, allDay: true, sourceType: "local"
    })).toBe(200);
    await page.goto("/?openCalendar=1");
    const surface = page.locator(width < 768 ? '[data-slot="sheet-content"]' : '[data-slot="popover-content"]');
    const harness = surface.locator(".fc-view-harness");
    await expect.poll(() => harness.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(0);
    const harnessHeight = await harness.evaluate(element => element.getBoundingClientRect().height);
    const add = surface.locator(".fc-addEvent-button");
    await add.click();
    const create = page.getByRole("dialog", { name: "New Event", exact: true });
    const title = create.getByPlaceholder("Event title", { exact: true });
    await expect(title).toBeFocused();
    const surfaceLayer = await surface.evaluate(element => Number(getComputedStyle(element).zIndex));
    const dialogLayer = await create.locator("xpath=ancestor::*[contains(@class, 'rt-BaseDialogOverlay')]").evaluate(element => Number(getComputedStyle(element).zIndex));
    expect(surfaceLayer).toBeLessThan(dialogLayer);
    // Real pointer hit testing catches a painted-over dialog that fill() alone misses.
    await title.click();
    await title.fill(`${summary} created`);
    await create.getByRole("button", { name: "Open time picker" }).first().click();
    const picker = page.getByRole("listbox");
    await expect(picker).toBeVisible();
    const pickerLayer = await picker.locator("xpath=ancestor::*[contains(@class, 'rt-PopperContent')]").evaluate(element => Number(getComputedStyle(element).zIndex));
    expect(pickerLayer).toBeGreaterThan(dialogLayer);
    await page.keyboard.press("Escape");
    await create.getByRole("button", { name: "Create", exact: true }).click();
    await expect(create).toHaveCount(0);
    await expect(add).toBeFocused();
    await surface.locator(".fc-event-title").filter({ hasText: summary, hasNotText: "created" }).first().click();
    const editButton = surface.getByRole("button", { name: "Edit", exact: true });
    await editButton.click();
    const edit = page.getByRole("dialog", { name: "Edit Event", exact: true });
    await edit.getByPlaceholder("Event title", { exact: true }).click();
    await edit.getByPlaceholder("Event title", { exact: true }).fill(`${summary} edited`);
    await edit.getByRole("button", { name: "Save", exact: true }).click();
    await expect(edit).toHaveCount(0);
    await expect(editButton).toBeFocused();
    await expect(surface.getByText(`${summary} edited`, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(surface).toHaveCount(0);
    await expect(page.locator('[data-status-indicator]')).toBeFocused();
    console.log("CALENDAR_FRAME", JSON.stringify({ width, height, harnessHeight, surfaceLayer, dialogLayer, pickerLayer,
      eventOpened: true, created: true, edited: true, focusRestored: true }));
  });
}
