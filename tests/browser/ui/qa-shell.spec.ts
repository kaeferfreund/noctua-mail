import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { totpFromUri } from "../../helpers/totp";

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
  const context = await browser.newContext({ baseURL: "http://localhost:3855" }), page = await context.newPage();
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
