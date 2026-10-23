import { test, expect } from "@playwright/test";
import { evidencePath, openQaMenu, recordQa, signInQa } from "./qaRound2Session";

test("QA-102 the open Create mailbox dialog keeps typed values across both breakpoint directions", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: "dark" });
  await signInQa(page); await openQaMenu(page, "Admin");
  await page.getByRole("button", { name: "Mailboxes", exact: true }).click();
  await page.getByRole("button", { name: "Create mailbox", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create mailbox", exact: true });
  await dialog.getByLabel("Name", { exact: true }).pressSequentially("Synthetic keyboard mailbox", { delay: 0 });
  await dialog.getByLabel("Email", { exact: true }).pressSequentially("keyboard@example.test", { delay: 0 });
  const results = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Synthetic keyboard mailbox");
    await expect(dialog.getByLabel("Email", { exact: true })).toHaveValue("keyboard@example.test");
    await expect(page.getByRole("button", { name: "Close admin", exact: true, includeHidden: true })).toHaveCount(1);
    await page.screenshot({ path: evidencePath(`QA-102-${viewport.width}-${results.length}-dark.png`) });
    results.push({ ...viewport, dialogs: await dialog.count(), name: await dialog.getByLabel("Name", { exact: true }).inputValue(), email: await dialog.getByLabel("Email", { exact: true }).inputValue() });
  }
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Admin", exact: true })).toBeVisible();
  recordQa("QA-102", results);
});
