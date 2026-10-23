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
  cookies = await context.cookies();
  if (process.env.QA_STATUS_STORAGE_STATE) await context.storageState({ path: process.env.QA_STATUS_STORAGE_STATE });
  await context.close();
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
    if (width < 768) {
      await page.locator('[data-status-indicator]').click();
      await page.getByRole("menuitem", { name: "Kalender öffnen", exact: true }).click();
    } else await page.goto("/?openCalendar=1");
    const surface = page.locator(width < 768 ? '[data-slot="sheet-content"]' : '[data-slot="popover-content"]');
    const harness = surface.locator(".fc-view-harness");
    await expect.poll(() => harness.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(0);
    const harnessHeight = await harness.evaluate(element => element.getBoundingClientRect().height);
    await page.screenshot({ animations: "disabled", path: `${artifacts}/calendar-${width}.png` });
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
    await page.screenshot({ animations: "disabled", path: `${artifacts}/calendar-create-${width}.png` });
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
    await expect(surface.getByRole("heading", { name: `${summary} edited`, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(surface).toHaveCount(0);
    await expect(page.locator('[data-status-indicator]')).toBeFocused();
    console.log("CALENDAR_FRAME", JSON.stringify({ width, height, harnessHeight, surfaceLayer, dialogLayer, pickerLayer,
      eventOpened: true, created: true, edited: true, focusRestored: true }));
  });
}

// FullCalendar's href-less date labels report tabIndex 0; Radix then picked one
// as the popover's last tabbable element and Tab left the popover. Walk the real
// tab order with the keyboard: it must wrap inside the popover both ways.
test("desktop calendar popover keeps Tab and Shift+Tab inside the popover", async ({ page }) => {
  test.skip(baseline);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('[data-status-indicator]')).toHaveAttribute("data-status-indicator", "idle", { timeout: 120000 });
  expect(await post(page, "/api/accounts/qa-shared/calendar/events", {
    summary: "Synthetic tab loop", startAtMs: Date.now(), endAtMs: Date.now() + 3600000, allDay: true, sourceType: "local"
  })).toBe(200);
  await page.goto("/?openCalendar=1");
  const popover = page.locator('[data-slot="popover-content"]');
  await expect(popover.locator(".fc-event").filter({ hasText: "Synthetic tab loop" }).first()).toBeVisible();
  const first = popover.getByRole("button", { name: "Neue E-Mails abrufen", exact: true });
  await first.focus();
  const focused = () => page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    const popover = document.querySelector('[data-slot="popover-content"]');
    return { inside: !!element && !!popover?.contains(element), first: element?.textContent === "Neue E-Mails abrufen",
      event: !!element?.closest(".fc-event"), label: element?.getAttribute("aria-label") ?? element?.textContent?.trim().slice(0, 60) ?? "" };
  });
  const order: string[] = [];
  let wrapped = false, events = 0;
  for (let step = 0; step < 120 && !wrapped; step++) {
    await page.keyboard.press("Tab");
    const now = await focused();
    expect(now.inside, `Tab ${step + 1} after ${order.at(-1)}`).toBe(true);
    if (now.first) wrapped = true; else { order.push(now.label); if (now.event) events++; }
  }
  expect(wrapped).toBe(true);
  expect(events).toBeGreaterThan(0);
  await page.keyboard.press("Shift+Tab");
  const last = await focused();
  expect(last.inside).toBe(true);
  expect(last.label).toBe(order.at(-1));
  await page.keyboard.press("Tab");
  expect((await focused()).first).toBe(true);
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(page.locator('[data-status-indicator]')).toBeFocused();
  writeFileSync(`${artifacts}/calendar-tab-loop.json`, JSON.stringify({ steps: order.length + 1, events, order }, null, 2) + "\n");
});

// Phone calendar in the fullscreen Sheet, including the 320x500 keyboard-
// shortened viewport. Playwright's click() scrolls overflow:hidden ancestors
// and would conceal clipped controls, so every control must already sit in
// the viewport, keep a 44px target and win hit testing before a raw mouse
// click at its centre is used.
const phoneControls = [".fc-addEvent-button", ".fc-today-button", ".fc-prev-button", ".fc-next-button",
  ".fc-dayGridMonth-button", ".fc-timeGridWeek-button", ".fc-timeGridDay-button"];
const phoneCalendar: unknown[] = [];
for (const [width, height] of [[320, 568], [320, 500], [360, 640], [390, 844]]) {
  test(`phone calendar controls stay reachable at ${width}x${height}`, async ({ page }) => {
    test.skip(baseline);
    await page.setViewportSize({ width, height }); await page.goto("/");
    const indicator = page.locator('[data-status-indicator]');
    await indicator.click();
    await page.getByRole("menuitem", { name: "Kalender öffnen", exact: true }).click();
    const sheet = page.locator('[data-slot="sheet-content"]');
    await expect(sheet).toHaveCSS("opacity", "1");
    const harness = sheet.locator(".fc-view-harness");
    const reachable = async (locator: ReturnType<Page["locator"]>) => {
      const box = (await locator.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(height);
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      expect(await locator.evaluate((element, { x, y }) => {
        const top = document.elementFromPoint(x, y);
        return top !== null && element.contains(top);
      }, center)).toBe(true);
      return center;
    };
    const frame = () => sheet.evaluate(element => {
      const body = element.querySelector<HTMLElement>(":scope > .radix-themes")!;
      const overflow = [body, ...body.querySelectorAll<HTMLElement>(".fc, .fc-header-toolbar, .fc-view-harness, .fc-col-header-cell")]
        .filter(node => node.scrollWidth > node.clientWidth || node.scrollLeft !== 0).map(node => node.className);
      const columns = [...element.querySelectorAll(".fc-col-header-cell")].map(cell => cell.getBoundingClientRect())
        .map(box => ({ left: box.left, right: box.right }));
      // Every sampled point over the Sheet hits the Sheet: nothing paints above it.
      const sheetBox = element.getBoundingClientRect(), foreign: string[] = [];
      for (let x = sheetBox.left + 4; x < sheetBox.right; x += (sheetBox.width - 8) / 4)
        for (let y = sheetBox.top + 4; y < sheetBox.bottom; y += (sheetBox.height - 8) / 7) {
          const top = document.elementFromPoint(x, y);
          if (!top || !element.contains(top)) foreign.push(`${Math.round(x)},${Math.round(y)}`);
        }
      return { overflow, columns, foreign, pageOverflow: document.documentElement.scrollWidth > innerWidth,
        harness: element.querySelector(".fc-view-harness")!.getBoundingClientRect().height,
        toolbar: element.querySelector(".fc-header-toolbar")!.getBoundingClientRect().height };
    });
    const views: Record<string, unknown> = {};
    for (const [view, button] of [["month", ".fc-dayGridMonth-button"], ["week", ".fc-timeGridWeek-button"], ["day", ".fc-timeGridDay-button"]] as const) {
      const center = await reachable(sheet.locator(button));
      await page.mouse.click(center.x, center.y);
      await expect(sheet.locator(button)).toHaveClass(/fc-button-active/);
      await expect.poll(() => harness.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(0);
      for (const control of phoneControls) await reachable(sheet.locator(control));
      for (const name of ["Kalender-Seitenleiste einblenden", "Demnächst"]) await reachable(sheet.getByRole("button", { name, exact: true }));
      await reachable(sheet.locator('[data-slot="sheet-close"]'));
      const measured = await frame();
      expect(measured.overflow).toEqual([]); expect(measured.pageOverflow).toBe(false); expect(measured.foreign).toEqual([]);
      expect(measured.columns.length).toBe(view === "day" ? 1 : 7);
      for (const column of measured.columns) { expect(column.left).toBeGreaterThanOrEqual(0); expect(column.right).toBeLessThanOrEqual(width); }
      views[view] = measured;
      if (view !== "day") await page.screenshot({ animations: "disabled", path: `${artifacts}/phone-calendar-${width}x${height}-${view}.png` });
    }
    const add = await reachable(sheet.locator(".fc-addEvent-button"));
    await page.mouse.click(add.x, add.y);
    const create = page.getByRole("dialog", { name: "New Event", exact: true });
    const title = create.getByPlaceholder("Event title", { exact: true });
    await expect(title).toBeFocused();
    const titleBox = (await title.boundingBox())!;
    expect(await title.evaluate((element, { x, y }) => element.contains(document.elementFromPoint(x, y)),
      { x: titleBox.x + titleBox.width / 2, y: titleBox.y + titleBox.height / 2 })).toBe(true);
    const sheetLayer = await sheet.evaluate(element => Number(getComputedStyle(element).zIndex));
    const dialogLayer = await create.locator("xpath=ancestor::*[contains(@class, 'rt-BaseDialogOverlay')]").evaluate(element => Number(getComputedStyle(element).zIndex));
    expect(sheetLayer).toBeLessThan(dialogLayer);
    await page.keyboard.press("Escape"); await expect(create).toHaveCount(0); await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape"); await expect(sheet).toHaveCount(0); await expect(indicator).toBeFocused();
    phoneCalendar.push({ width, height, sheetLayer, dialogLayer, views });
    writeFileSync(`${artifacts}/phone-calendar.json`, JSON.stringify(phoneCalendar, null, 2) + "\n");
  });
}
