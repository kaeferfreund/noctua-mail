import { test, expect, type Page } from "@playwright/test";
import { evidencePath, signInQa } from "./qaRound2Session";
import { catalogs } from "./qaSweep3";

// Evidence for „Senden planen“: dialog, drafts list badge, opened scheduled draft (synthetic data only).
const copy = catalogs.de;
test.use({ locale: "de-DE", timezoneId: "Europe/Berlin" });
const mailbox = "/api/accounts/qa-shared";
const draftsUrl = "/?a=~qa-shared&f=Drafts";

async function saveDraft(page: Page, subject: string, to: string) {
  const response = await page.request.post(`${mailbox}/drafts/save`, { headers: { origin: new URL(page.url()).origin },
    data: { to, subject, text: "Hallo,\n\nanbei die synthetische Planung für nächste Woche.\n\nViele Grüße\nAlex" } });
  expect(response.status()).toBe(200);
  return (await response.json()).draftId as string;
}

async function openNewMail(page: Page) {
  const compose = page.getByRole("button", { name: copy.Shell.compose.new, exact: true });
  if (!await compose.isVisible()) await page.getByRole("button", { name: copy.Shell.sidebar.toggle, exact: true }).first().click();
  await compose.click();
  await expect(page.locator('[data-lexical-editor="true"]')).toBeVisible();
}

test("QA schedule send evidence at 1280/390 px, light and dark", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 860 });
  await signInQa(page);
  page.on("pageerror", error => console.log("[pageerror]", error.message));
  // The first mailbox sync creates the folders the drafts API needs.
  await expect(async () => {
    await page.goto("/");
    await expect(page.locator('[data-message-list-row="true"]').first()).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
  await page.goto(draftsUrl);
  await expect(page.getByText("Entwurf: Angebot prüfen").first()).toBeVisible({ timeout: 60_000 });
  const draftId = await saveDraft(page, "Angebot Prophylaxe-Termine", "praxis-kunde@example.test");
  await saveDraft(page, "Rückfrage Laborauftrag", "labor@example.test");
  const sendAt = Math.ceil((Date.now() + 26 * 3_600_000) / 900_000) * 900_000;
  const scheduled = await page.request.post(`${mailbox}/drafts/scheduled`, { headers: { origin: new URL(page.url()).origin }, data: { draftId, sendAt } });
  expect(scheduled.status()).toBe(201);

  page.on("dialog", dialog => { void dialog.accept(); });
  const combos = [[1280, 860], [390, 844]].flatMap(([width, height]) => (["light", "dark"] as const).map(scheme => ({ width, height, scheme })));
  for (const { width, height, scheme } of combos) {
    const tag = `${width}-${scheme}`;
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(draftsUrl);
    const badge = page.locator("[data-scheduled-send]").first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText("Geplant · ");
    await page.screenshot({ path: evidencePath(`drafts-badge-${tag}.png`) });

    await page.getByText("Angebot Prophylaxe-Termine").first().click();
    const bar = page.locator("[data-scheduled-send-bar]");
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("Bearbeiten hebt die Planung auf");
    await expect(bar.getByRole("button", { name: copy.Compose.schedule.sendNow })).toBeVisible();
    await page.screenshot({ path: evidencePath(`scheduled-draft-${tag}.png`) });
  }

  // Compose last: its autosaved drafts must not appear in the list evidence above.
  for (const { width, height, scheme } of combos) {
    const tag = `${width}-${scheme}`;
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/?a=~qa-shared&f=INBOX");
    await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
    await openNewMail(page);
    await page.getByLabel(copy.Compose.fields.to, { exact: true }).fill("praxis-kunde@example.test");
    await page.getByLabel(copy.Compose.fields.subject, { exact: true }).fill("Terminbestätigung");
    await page.locator("[data-compose-send-menu]").click();
    await page.getByRole("menuitem", { name: copy.Compose.schedule.open }).click();
    const dialog = page.getByRole("dialog", { name: copy.Compose.schedule.title });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: copy.Compose.schedule.submit, exact: true })).toBeVisible();
    await page.waitForTimeout(600); // dialog open / menu close animations
    await page.screenshot({ path: evidencePath(`dialog-${tag}.png`) });
    // Custom time with the past rejected inline (red outline).
    const date = dialog.getByLabel(copy.Compose.schedule.dateLabel);
    await date.fill("2026-10-01");
    await dialog.getByRole("button", { name: copy.Compose.schedule.submit, exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(copy.Compose.schedule.errors.past);
    await page.screenshot({ path: evidencePath(`dialog-past-error-${tag}.png`) });
    await dialog.getByRole("button", { name: copy.Compose.schedule.cancel, exact: true }).click();
    await expect(dialog).toBeHidden();
  }
});
