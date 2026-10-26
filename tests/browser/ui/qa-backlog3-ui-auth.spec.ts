import { test, expect } from "@playwright/test";
import { signInQa, evidencePath, recordQa } from "./qaRound2Session";

// Run with the isolated synthetic shell harness and QA_SHELL_PORT on an unused port.
test.use({ locale: "de-DE", hasTouch: true });
test("reader, mailbox defaults, members and long mailbox names at desktop and phone widths", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signInQa(page);
  expect((await page.request.put("/api/auth/preferences", { data: { uiLocale: "de" }, headers: { origin: new URL(page.url()).origin } })).ok()).toBe(true);
  // The isolated fixture's first sync starts with an empty folder table.
  await expect.poll(async () => {
    const response = await page.request.get("/api/accounts/qa-shared/folders");
    return response.ok() && (await response.json() as unknown[]).length > 0;
  }).toBe(true);
  await page.goto("/?a=~qa-shared&f=INBOX");
  const rows = page.locator('[data-message-list-row="true"]');
  await expect(rows.first()).toBeVisible();
  // A menu action leaves the list selected place alone, including its mobile URL.
  const row = rows.first();
  await row.hover();
  await row.locator('[data-message-action="menu"]').click();
  await page.screenshot({ path: evidencePath("ui-auth-menu-1280.png") });
  await page.getByRole("menuitem", { name: /Als (un)?gelesen markieren/, exact: true }).click();
  expect(new URL(page.url()).searchParams.get("m")).toBeNull();
  await row.dblclick();
  await expect(page.locator('[data-reader-position]')).toHaveText(/^[1-9]\d* \/ \d+\+?$/);
  await page.screenshot({ path: evidencePath("ui-auth-reader-1280.png") });

  // Synthetic long names exercise the real table without changing fixture storage.
  const longName = "Synthetisches Gemeinschaftspostfach mit einem ausführlichen vollständigen Anzeigenamen";
  await page.route("**/api/admin/users", async route => {
    const response = await route.fetch();
    const body = await response.json();
    for (const user of body.users ?? []) for (const account of user.accounts ?? []) account.name = longName;
    await route.fulfill({ response, json: body });
  });
  const measurements = [];
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390) {
      await page.goto("/?a=~qa-shared&f=INBOX");
      await expect(rows.first()).toBeVisible();
      await page.screenshot({ path: evidencePath("ui-auth-list-390.png") });
      const box = (await rows.first().boundingBox())!;
      const cdp = await page.context().newCDPSession(page);
      const y = box.y + box.height / 2;
      const x0 = box.x + box.width * 0.8, x1 = box.x + box.width * 0.45;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
      for (let step = 1; step <= 12; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * step / 12, y }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
      await page.locator('[data-swipe-action="more"]').click();
      await expect(page.getByRole("menu")).toBeVisible();
      await page.screenshot({ path: evidencePath("ui-auth-menu-390.png") });
      await page.getByRole("menuitem", { name: /Als (un)?gelesen markieren/, exact: true }).click();
      expect(new URL(page.url()).searchParams.get("m")).toBeNull();
      await rows.first().click();
      await expect(page.locator("#noctua-panes")).toHaveAttribute("data-mobile-view", "thread");
      await page.screenshot({ path: evidencePath("ui-auth-reader-390.png") });
    }
    await page.goto("/?a=~qa-shared&settings=account");
    const settings = page.getByRole("dialog", { name: "Postfacheinstellungen", exact: true });
    const defaultSelect = settings.getByRole("combobox", { name: "Vorgabe für alle Mitglieder", exact: true });
    await expect(defaultSelect).toBeVisible();
    await defaultSelect.selectOption(width === 1280 ? "after3s" : "after1s");
    await settings.getByRole("button", { name: "Postfachvorgabe speichern", exact: true }).click();
    await expect(settings.getByRole("button", { name: "Postfachvorgabe speichern", exact: true })).toBeDisabled();
    await defaultSelect.scrollIntoViewIfNeeded();
    await page.screenshot({ path: evidencePath(`ui-auth-default-${width}.png`) });
    await settings.getByRole("tab", { name: "Mitglieder", exact: true }).click();
    const add = settings.getByRole("button", { name: "Mitglied hinzufügen", exact: true });
    await expect(add).toBeVisible();
    const memberRow = await settings.locator('form[role="search"]').evaluate(search => {
      const group = search.parentElement!;
      const boxes = [...group.querySelectorAll("input, select, button")].map(element => {
        const box = element.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
      });
      return { boxes, width: group.clientWidth, overflow: group.scrollWidth > group.clientWidth + 1 };
    });
    if (width === 1280) expect(Math.max(...memberRow.boxes.map(box => box.top)) - Math.min(...memberRow.boxes.map(box => box.top))).toBeLessThan(8);
    expect(memberRow.overflow).toBe(false);
    await add.scrollIntoViewIfNeeded();
    await page.screenshot({ path: evidencePath(`ui-auth-members-${width}.png`) });
    await page.goto("/?a=~qa-shared&admin=users");
    const users = page.locator("[data-admin-users-table]");
    await expect(users.getByText(longName, { exact: true }).first()).toBeVisible();
    const name = users.getByText(longName, { exact: true }).first();
    const wrapping = await name.evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth,
      height: element.getBoundingClientRect().height, lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight) }));
    expect(wrapping.scroll).toBeLessThanOrEqual(wrapping.client + 1);
    expect(wrapping.height).toBeGreaterThan(wrapping.lineHeight);
    await name.scrollIntoViewIfNeeded();
    await page.screenshot({ path: evidencePath(`ui-auth-users-${width}.png`) });
    measurements.push({ width, memberRow, wrapping });
  }
  recordQa("ui-auth-layout", measurements);
});
