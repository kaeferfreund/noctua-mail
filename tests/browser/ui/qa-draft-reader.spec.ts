import { test, expect, type Page } from "@playwright/test";
import { evidencePath, recordQa, signInQa } from "./qaRound2Session";
import { catalogs } from "./qaSweep3";

// Evidence for drafts in the reader (also with a new message open) and „Senden planen“
// for a saved draft without opening compose, at 1280 and 390 px (synthetic data only).
const copy = catalogs.de;
test.use({ locale: "de-DE", timezoneId: "Europe/Berlin" });
const mailbox = "/api/accounts/qa-shared";
const draftsUrl = "/?a=~qa-shared&f=Drafts";
const rows = (page: Page) => page.locator('[data-message-list-row="true"]');

async function mcpCall(page: Page, token: string, name: string, args: Record<string, unknown>) {
  const response = await page.request.post("/api/mcp", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json, text/event-stream", "content-type": "application/json" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }
  });
  expect(response.status()).toBe(200);
}

async function seedDrafts(page: Page) {
  await expect(async () => {
    await page.goto("/");
    await expect(rows(page).first()).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
  const origin = new URL(page.url()).origin;
  const saved = await page.request.post(`${mailbox}/drafts/save`, { headers: { origin },
    data: { to: "praxis-kunde@example.test", subject: "Angebot Prophylaxe-Termine", text: "Hallo,\n\nanbei das synthetische Angebot.\n\nViele Grüße\nAlex" } });
  expect(saved.status()).toBe(200);
  const minted = await page.request.post(`${mailbox}/mcp-tokens`, { headers: { origin }, data: { label: "Synthetic draft QA", accountIds: ["qa-shared"], mode: "drafts" } });
  expect(minted.status()).toBe(201);
  const { token } = await minted.json() as { token: string };
  for (const [to, subject] of [["kunde@example.test", "Ihr Wunsch wurde umgesetzt"], ["labor@example.test", "Rückfrage Laborauftrag"]]) {
    await mcpCall(page, token, "create_draft_message", { accountId: "qa-shared", to, subject, text: "Hallo,\n\nsynthetischer Entwurf eines Assistenten.\n" });
  }
}

test("QA drafts open in the reader, also while a new message is open", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 860 });
  await signInQa(page);
  page.on("pageerror", error => console.log("[pageerror]", error.message));
  await seedDrafts(page);
  await page.goto(draftsUrl);
  await expect(page.getByText("Ihr Wunsch wurde umgesetzt").first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: copy.Shell.compose.new, exact: true }).click();
  await expect(page.locator('[data-lexical-editor="true"]')).toBeVisible();
  await rows(page).filter({ hasText: "Ihr Wunsch wurde umgesetzt" }).first().click();
  await expect(page.getByText(copy.Reader.selectThread)).toHaveCount(0);
  await expect(page.getByText("synthetischer Entwurf eines Assistenten.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: copy.Compose.window.restore, exact: true })).toBeVisible();
  await page.screenshot({ path: evidencePath("draft-reader-with-minimized-compose-1280.png") });
  recordQa("draft-reader", { readerShown: true, composeMinimized: true });
});

test("QA schedule a draft without opening it at 1280/390 px", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 860 });
  await signInQa(page);
  page.on("pageerror", error => console.log("[pageerror]", error.message));
  page.on("dialog", dialog => { void dialog.accept(); });
  await seedDrafts(page);
  for (const [width, height] of [[1280, 860], [390, 844]]) {
    const tag = String(width);
    await page.setViewportSize({ width, height });
    await page.goto(draftsUrl);
    const subject = width === 1280 ? "Ihr Wunsch wurde umgesetzt" : "Rückfrage Laborauftrag";
    const row = rows(page).filter({ hasText: subject }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.locator('[data-message-action="menu"]').click();
    await page.getByRole("menuitem", { name: copy.Compose.schedule.open }).click();
    const dialog = page.getByRole("dialog", { name: copy.Compose.schedule.title });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(600); // dialog / sheet animation
    await page.screenshot({ path: evidencePath(`schedule-draft-dialog-${tag}.png`) });
    await dialog.getByRole("button", { name: copy.Compose.schedule.submit, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-lexical-editor="true"]')).toHaveCount(0);
    // Choosing a row menu entry also selects the row (as for every entry), so the reader shows the bar.
    const bar = page.locator('[data-scheduled-send-bar="queued"]');
    await expect(bar).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: evidencePath(`schedule-draft-reader-${tag}.png`) });
    const back = page.getByRole("button", { name: copy.Reader.backMessages, exact: true });
    if (await back.isVisible()) await back.click();
    await expect(row.locator('[data-scheduled-send="queued"]')).toBeVisible();
    await page.screenshot({ path: evidencePath(`schedule-draft-badge-${tag}.png`) });
    await row.click();
    await bar.getByRole("button", { name: copy.Compose.schedule.unschedule }).click();
    await expect(bar).toHaveCount(0);
  }
  // The reader's quick action plans the opened draft as well (desktop).
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(draftsUrl);
  await rows(page).filter({ hasText: "Angebot Prophylaxe-Termine" }).first().click();
  await page.locator('[data-reader-print] [data-message-action="schedule"]').first().click();
  const dialog = page.getByRole("dialog", { name: copy.Compose.schedule.title });
  await dialog.getByRole("button", { name: copy.Compose.schedule.submit, exact: true }).click();
  await expect(page.locator('[data-scheduled-send-bar="queued"]')).toBeVisible();
  await page.screenshot({ path: evidencePath("schedule-draft-quick-action-1280.png") });
  const schedules = await (await page.request.get(`${mailbox}/drafts/scheduled`)).json() as { scheduledSends: Array<{ status: string }> };
  recordQa("schedule-draft", { open: schedules.scheduledSends.filter(item => item.status === "queued").length });
});
