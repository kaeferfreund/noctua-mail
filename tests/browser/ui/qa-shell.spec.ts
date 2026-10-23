import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { totpFromUri } from "../../helpers/totp";

test.use({ locale: "en-GB" });

// Run via: QA_SHELL_USE_BUILD=1 nice -n 15 bun scripts/runQaShellBrowserTests.ts
// The harness owns the production server, synthetic storage and fixture ports.
type Seed = { email: string; password: string; totpURI: string; id: string };
let cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
let seeds: Seed[];
const subject = "QA long subject checks wrapping and leaves room for reading the synthetic message on a narrow phone. ".repeat(4).trim();
async function post(page: Page, path: string, body: unknown) {
  return page.evaluate(async ({ path, body }) => {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { path, body });
}
async function menu(page: Page, item: "Settings" | "Admin") {
  await page.getByRole("button", { name: "User menu", exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}
test.beforeAll(async ({ browser }) => {
  seeds = JSON.parse(readFileSync(process.env.QA_SHELL_SEED_FILE!, "utf8"));
  const context = await browser.newContext({ locale: "en-GB", baseURL: process.env.QA_SHELL_BASE_URL ?? "http://localhost:3799" }), page = await context.newPage();
  await page.goto("/");
  expect((await post(page, "/api/ba/sign-in/email", { email: seeds[0].email, password: seeds[0].password })).status).toBe(200);
  expect((await post(page, "/api/ba/two-factor/verify-totp", { code: totpFromUri(seeds[0].totpURI) })).status).toBe(200);
  expect((await post(page, "/api/auth/switch-account", { accountId: "qa-shared" })).status).toBe(200);
  cookies = await context.cookies(); await context.close();
});
test.beforeEach(async ({ page }) => {
  await page.context().addCookies(cookies);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "User menu", exact: true })).toBeVisible();
});
test("QA-003/009: create a 180-day token, reveal it once, refresh metadata, dismiss Settings", async ({ page }) => {
  await menu(page, "Settings");
  await page.getByRole("tab", { name: "MCP", exact: true }).click();
  await page.getByPlaceholder("My MCP client").fill("Synthetic QA token");
  const created = page.waitForResponse(response => response.url().endsWith("/mcp-tokens") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create token", exact: true }).click();
  const response = await created, data = await response.json();
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toEqual({ label: "Synthetic QA token", ttlSeconds: 15552000 });
  expect((data.tokenRecord.expiresAt - data.tokenRecord.createdAt) / 1000).toBe(15552000);
  await expect(page.getByText(data.token, { exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic QA token", { exact: true })).toBeVisible();
  await expect(page.getByText("Failed to create MCP token.")).toHaveCount(0);
  await page.getByRole("tab", { name: "Preferences", exact: true }).click();
  await page.getByRole("tab", { name: "MCP", exact: true }).click();
  await expect(page.getByText(data.token, { exact: true })).toHaveCount(0);
  await expect(page.getByText("Synthetic QA token", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "User menu", exact: true })).toBeFocused();
  console.log("QA-003", JSON.stringify({ post: 201, ttlSeconds: 15552000, secretShownOnce: true, listRefreshed: true }));
});
test("QA-004/009: pointer-operated members and confirmations stack above Admin; Escape removes one layer", async ({ page }) => {
  await menu(page, "Admin");
  await page.getByRole("button", { name: "Mailboxes", exact: true }).click();
  const manage = page.getByRole("button", { name: "Manage members", exact: true });
  await manage.click();
  const members = page.getByRole("dialog", { name: "Members of demo@monkeydent.test", exact: true });
  await members.getByLabel("Add existing enabled user").selectOption(seeds[1].id);
  await members.getByLabel("New member role").selectOption("editor");
  const hit = await members.getByRole("button", { name: "Add member", exact: true }).evaluate(button => {
    const r = button.getBoundingClientRect(); return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
  expect(hit).toBe(true);
  await members.getByRole("button", { name: "Add member", exact: true }).click();
  const role = members.getByLabel("Role for jo@example.test");
  await expect(role).toHaveValue("editor");
  const memberLayer = await members.evaluate(el => Number(getComputedStyle(el).zIndex));
  await role.focus();
  await role.selectOption("viewer");
  const confirm = page.getByRole("dialog", { name: "Change member role", exact: true });
  // Radix hides the parent from accessibility queries while its child is open.
  const layers = [memberLayer, await confirm.evaluate(el => Number(getComputedStyle(el).zIndex))];
  expect(layers).toEqual([9996, 9997]);
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0); await expect(role).toBeFocused(); await expect(members).toBeVisible();
  await role.selectOption("viewer"); await confirm.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(confirm).toHaveCount(0); await expect(role).toHaveValue("viewer");
  await page.keyboard.press("Escape"); await expect(members).toHaveCount(0); await expect(manage).toBeFocused();
  const admin = page.getByRole("dialog", { name: "Admin", exact: true });
  await expect(admin).toBeVisible();
  await page.getByRole("button", { name: "Users", exact: true }).click();
  await page.getByLabel("Role for jo@example.test").selectOption("admin");
  const userConfirm = page.getByRole("dialog", { name: "Change user role", exact: true });
  await userConfirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(userConfirm).toHaveCount(0);
  await page.keyboard.press("Escape"); await expect(admin).toHaveCount(0);
  await expect(page.getByRole("button", { name: "User menu", exact: true })).toBeFocused();
  console.log("QA-004/009", JSON.stringify({ layers, pointerAdd: true, pointerConfirm: true, focusRestored: true }));
});
test("QA-005: 360px and 390px reader retains 40% of the viewport with long subject and note open", async ({ page }) => {
  for (const colorScheme of ["light", "dark"] as const) for (const viewport of [{ width: 360, height: 780 }, { width: 390, height: 844 }]) {
    await page.emulateMedia({ colorScheme }); await page.setViewportSize(viewport); await page.goto("/");
    await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
    await page.getByText(subject, { exact: true }).first().click();
    await page.getByRole("button", { name: "Internal note", exact: true }).click();
    await page.getByLabel("Internal note · Markdown supported").fill("Synthetic note open during reader measurement.");
    const header = page.locator('[class*="threadHeader"]');
    const measure = () => header.evaluate(el => ({ header: el.getBoundingClientRect().height, message: el.nextElementSibling!.getBoundingClientRect().height, viewport: innerHeight }));
    const collapsed = await measure();
    expect(collapsed.message).toBeGreaterThanOrEqual(viewport.height * 0.4);
    const text = header.getByTitle(subject, { exact: true });
    await expect(text).toHaveCSS("-webkit-line-clamp", "3");
    await page.getByRole("button", { name: "Expand subject", exact: true }).click();
    await expect(text).toHaveText(subject);
    const expanded = await measure(); expect(expanded.message).toBeGreaterThanOrEqual(viewport.height * 0.4);
    await page.screenshot({ path: `.tmp/qa-shell-reader-${colorScheme}-${viewport.width}.png` });
    console.log("QA-005", JSON.stringify({ colorScheme, width: viewport.width, collapsed, expanded }));
  }
});
test("QA-011/012/013: 44px phone header actions, reduced-motion sidebar, folder search empty state", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/");
  const header = page.locator('[data-slot="shell-header"]');
  for (const name of [/^View:/, /^Sort & group:/, /^Message actions:/, /^Search messages$/, /^Activity and calendar$/]) {
    const button = header.getByRole("button", { name }); await expect(button).toBeVisible();
    const box = await button.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    console.log("QA-011", JSON.stringify({ name: String(name), width: box!.width, height: box!.height }));
  }
  await page.screenshot({ path: ".tmp/qa-shell-header-390.png" });
  await header.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Sidebar", exact: true });
  await expect(sheet).toBeVisible(); await expect(sheet).toHaveCSS("animation-name", "none"); await expect(sheet).toHaveCSS("transition-duration", "0s");
  await page.keyboard.press("Escape"); await expect(sheet).toHaveCount(0);
  await header.getByRole("button", { name: "Search messages", exact: true }).click();
  await page.getByRole("button", { name: "Search filters", exact: true }).click();
  await page.getByRole("radio", { name: /^Current folder:/ }).check();
  await page.keyboard.press("Escape");
  const input = page.getByRole("textbox", { name: /^Search/ });
  await input.fill("zz-no-synthetic-result-qa-shell"); await input.press("Enter"); await page.keyboard.press("Escape");
  await expect(page.getByText("No messages match this search.", { exact: true })).toBeVisible();
  await expect(page.getByText("No messages in this folder.", { exact: true })).toHaveCount(0);
});
const viewDescriptions = JSON.parse(readFileSync("messages/en.json", "utf8")).Views as Record<string, { name: string; description: string }>;
// Every view row gets a count, with wide synthetic values (12,345 renders as "12.3K"): the
// mailbox summary feeds the collaboration views and one-message count queries feed the
// virtual views. The summary event stream is held open without events, so a live summary
// cannot replace the routed counts while the rows are measured.
async function routeViewCounts(page: Page) {
  const collab = { assignedToMe: 3, unassignedOpen: 9111, open: 12345 };
  const virtual: Record<string, number> = { focused: 7, todo: 48, calendar: 5, "calendar,unread": 2 };
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    Object.assign(window, { fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      new URL(input instanceof Request ? input.url : String(input), location.href).pathname === "/api/me/events"
        ? Promise.resolve(new Response(new ReadableStream(), { headers: { "content-type": "text/event-stream" } }))
        : fetch(input, init) });
  });
  await page.route("**/api/me/mailboxes/summary", async route => {
    const response = await route.fetch(), body = await response.json();
    await route.fulfill({ response, json: { ...body, mailboxes: body.mailboxes.map((mailbox: object) => ({ ...mailbox, ...collab })) } });
  });
  await page.route(url => url.pathname.endsWith("/messages") && url.searchParams.get("pageSize") === "1" && url.searchParams.has("badges"), async route => {
    const total = virtual[new URL(route.request().url()).searchParams.get("badges")!];
    if (total === undefined) return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...await response.json(), total } });
  });
}
const countedViewRows = (page: Page) => page.locator("[data-view-id]").evaluateAll(buttons =>
  buttons.filter(button => button.parentElement!.querySelector('[data-sidebar="menu-badge"]')).length);
test("QA-014: sidebar view rows keep the count inside the row highlight and describe the hovered row", async ({ page }) => {
  const views = viewDescriptions;
  const catalogKey: Record<string, string> = { "virtual:assigned-to-me": "assignedToMe", "virtual:unassigned": "unassigned", "virtual:open": "open", "virtual:focused": "focused", "virtual:action-queue": "actionQueue" };
  const box = (el: Element) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
  await routeViewCounts(page);
  for (const colorScheme of ["light", "dark"] as const) for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    await page.emulateMedia({ colorScheme }); await page.setViewportSize(viewport); await page.goto("/");
    // On a fresh fixture the inbox row (and its unread count) appears once the folder list has
    // synced; a load that rendered before that point is reloaded.
    await expect(async () => {
      if (await countedViewRows(page) < 7) await page.reload();
      await expect.poll(() => countedViewRows(page), { timeout: 10000 }).toBe(7);
    }).toPass({ timeout: 90000 });
    const active = page.locator('[data-view-id^="folder:"][data-active="true"]');
    await expect(active.locator("..").locator('[data-sidebar="menu-badge"]')).toBeVisible();
    await page.mouse.move(viewport.width - 4, viewport.height - 4);
    const rows = await page.locator("[data-view-id]").evaluateAll(buttons => buttons.map(button => {
      const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
      const badge = button.parentElement!.querySelector('[data-sidebar="menu-badge"]');
      return { id: button.getAttribute("data-view-id")!, active: button.getAttribute("data-active") === "true", row: rect(button),
        label: rect(button.querySelector("span")!), badge: badge ? rect(badge) : null, background: getComputedStyle(button).backgroundColor };
    }));
    const withBadge = rows.filter(row => row.badge);
    expect(rows.map(row => row.id.startsWith("folder:") ? "inbox" : row.id)).toEqual(["inbox", "virtual:assigned-to-me", "virtual:unassigned",
      "virtual:open", "virtual:focused", "virtual:action-queue", "virtual:invite-deck"]);
    expect(withBadge).toHaveLength(rows.length);
    expect(rows.find(row => row.active)!.id).toMatch(/^folder:/);
    for (const { row, label, badge } of withBadge) {
      // The highlighted button box spans the badge, and wrapped labels end before it.
      expect(badge!.left).toBeGreaterThanOrEqual(row.left); expect(badge!.right).toBeLessThanOrEqual(row.right);
      expect(badge!.top).toBeGreaterThanOrEqual(row.top); expect(badge!.bottom).toBeLessThanOrEqual(row.bottom);
      expect(label.right).toBeLessThanOrEqual(badge!.left);
    }
    const activeBackground = rows.find(row => row.active)!.background;
    const hovered = page.locator('[data-view-id="virtual:unassigned"]');
    await hovered.hover();
    await expect.poll(() => hovered.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");
    const hoverBackground = await hovered.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(hoverBackground).not.toBe(activeBackground);
    await active.hover();
    await expect.poll(() => active.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(activeBackground);
    // The description belongs to the row under the pointer, opens beside it and stays in the viewport.
    // The first row is re-entered right after leaving it (Unassigned, Inbox, Unassigned), which
    // must reopen its own description rather than leave none or the previous row's.
    for (const id of ["virtual:unassigned", "virtual:open", "virtual:focused"]) {
      const row = page.locator(`[data-view-id="${id}"]`);
      await row.hover();
      const content = page.locator('[data-slot="tooltip-content"]');
      await expect(content).toHaveCount(1);
      await expect(content).toHaveAttribute("role", "tooltip");
      await expect(content).toHaveText(`${views[catalogKey[id]].name}: ${views[catalogKey[id]].description}`);
      const [rowBox, tip] = [await row.evaluate(box), await content.evaluate(box)];
      expect(tip.left).toBeGreaterThanOrEqual(rowBox.right);
      expect(tip.top).toBeGreaterThanOrEqual(0); expect(tip.bottom).toBeLessThanOrEqual(viewport.height);
      expect(tip.right).toBeLessThanOrEqual(viewport.width);
    }
    // Keyboard focus shows the full ring inside the scrolling sidebar content.
    await page.mouse.move(viewport.width - 4, viewport.height - 4);
    await page.keyboard.press("Shift");
    await hovered.focus();
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(1);
    await expect(page.getByRole("tooltip")).toHaveText(`${views.unassigned.name}: ${views.unassigned.description}`);
    const ring = await hovered.evaluate(el => {
      const clip = el.closest('[data-sidebar="content"]')!.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { focusVisible: el.matches(":focus-visible"), shadow: getComputedStyle(el).boxShadow, inside: r.left - 2 >= clip.left && r.right + 2 <= clip.right };
    });
    expect(ring.focusVisible).toBe(true); expect(ring.shadow).toContain("0px 0px 0px 2px"); expect(ring.inside).toBe(true);
    if (viewport.width === 1440) await page.screenshot({ path: `.tmp/qa-shell-views-${colorScheme}-1440.png` });
    console.log("QA-014", JSON.stringify({ colorScheme, width: viewport.width, activeBackground, hoverBackground, rows: withBadge.length,
      badges: await page.locator('[data-view-id] ~ [data-sidebar="menu-badge"]').allTextContents() }));
  }
});
test("QA-014: the phone sheet shows no view row description on hover or keyboard focus", async ({ page }) => {
  const descriptions = page.locator('[data-slot="tooltip-content"]');
  // Neither the pointer resting on a row (past the 400 ms open delay) nor keyboard focus opens
  // a description, and the row is not described by a hidden one.
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/");
  await page.locator('[data-slot="shell-header"]').getByRole("button", { name: "Toggle sidebar", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Sidebar", exact: true });
  const row = sheet.locator('[data-view-id="virtual:unassigned"]');
  await row.hover();
  await expect.poll(() => row.evaluate(el => el.matches(":hover"))).toBe(true);
  await page.waitForTimeout(800);
  await expect(descriptions).toHaveCount(0);
  await page.keyboard.press("Shift"); await row.focus();
  await expect(row).toBeFocused(); expect(await row.evaluate(el => el.matches(":focus-visible"))).toBe(true);
  await page.waitForTimeout(800);
  await expect(descriptions).toHaveCount(0);
  await expect(row).not.toHaveAttribute("aria-describedby");
  await page.screenshot({ path: ".tmp/qa-shell-views-sheet-390.png" });
});
test("QA-014: the collapsed sidebar keeps its rows out of the tab order and shows no description", async ({ page }) => {
  const rowDescriptions = Object.values(viewDescriptions).flatMap(view => typeof view?.description === "string" ? [view.description] : []);
  const descriptions = page.locator('[data-slot="tooltip-content"]');
  // The collapsed offcanvas sidebar is off screen: moving focus backwards from the toggle never
  // lands on one of its rows or opens a detached description.
  await expect(page.locator('[data-view-id="virtual:unassigned"]')).toBeInViewport();
  const toggle = page.locator('[data-slot="shell-header"]').getByRole("button", { name: "Toggle sidebar", exact: true });
  await toggle.click();
  const container = page.locator('[data-slot="sidebar-container"]');
  await expect(container).toHaveAttribute("inert", "");
  await expect.poll(() => container.evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await page.locator('[data-view-id="virtual:unassigned"]').focus();
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-slot="sidebar-container"]')))).toBe(false);
  await toggle.focus();
  for (let step = 0; step < 30; step++) {
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-slot="sidebar-container"]')))).toBe(false);
  }
  await page.waitForTimeout(800);
  expect((await descriptions.allTextContents()).filter(text => rowDescriptions.some(row => text.includes(row)))).toEqual([]);
  await page.screenshot({ path: ".tmp/qa-shell-views-collapsed-1440.png" });
});
