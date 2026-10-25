import { test, expect, type Locator, type Page } from "@playwright/test";
import { evidencePath, openQaMenu, recordQa, signInQa } from "./qaRound2Session";

// The one-time secret dialog opens inside the Admin SettingsFrame. It has to be the
// top-most layer: the code readable (not covered by its blur overlay or the frame),
// the QR code complete on screen, and the dialog scrollable on a phone.
async function topLayer(dialog: Locator) {
  return dialog.evaluate(element => {
    const content = element as HTMLElement;
    const hitInside = (target: Element) => {
      const box = target.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return Boolean(hit && content.contains(hit));
    };
    const z = (node: Element | null) => node ? Number(getComputedStyle(node).zIndex) : null;
    return {
      codeHit: hitInside(content.querySelector("code")!), qrHit: hitInside(content.querySelector('[data-slot="qr-code"]')!),
      contentZ: z(content), settingsOverlayZ: z(document.querySelector(".rt-BaseDialogOverlay")), opacity: getComputedStyle(content).opacity
    };
  });
}

async function issueInvite(page: Page, width: number) {
  await page.getByRole("button", { name: "Invites", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill(`Synthetic Invitee ${width}`);
  await page.getByLabel("Email", { exact: true }).fill(`invitee-${width}@example.test`);
  await page.getByRole("button", { name: "Issue targeted invite", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "One-time invite code", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

for (const width of [1280, 390]) test(`one-time invite code and QR code are readable above the Admin frame at ${width}px`, async ({ page, browser }) => {
  await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
  await signInQa(page); await openQaMenu(page, "Admin");
  const dialog = await issueInvite(page, width);
  const code = (await dialog.locator("code").textContent())!.trim();
  expect(code).toMatch(/^[0-9a-f-]{36}$/);
  const qr = dialog.getByRole("img", { name: "QR code" });
  await qr.scrollIntoViewIfNeeded();
  await expect(qr).toBeInViewport({ ratio: 1 });
  expect((await qr.boundingBox())!.width).toBeGreaterThanOrEqual(200);
  await page.waitForTimeout(400);
  await page.screenshot({ path: evidencePath(`invite-secret-${width}.png`) });
  const layer = await topLayer(dialog);
  recordQa(`invite-secret-${width}`, layer);
  expect(layer).toMatchObject({ codeHit: true, qrHit: true, opacity: "1" });
  expect(layer.contentZ!).toBeGreaterThan(layer.settingsOverlayZ!);

  // The QR code opens the sign-up on this origin with the code filled in and gone from the URL.
  const phone = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 } });
  try {
    const invitee = await phone.newPage();
    await invitee.goto(`/#invite=${code}`);
    await expect(invitee.getByLabel("Invite code", { exact: true })).toHaveValue(code);
    await expect(invitee.getByLabel("Email", { exact: true })).toHaveValue("");
    expect(new URL(invitee.url()).hash).toBe("");
    await invitee.screenshot({ path: evidencePath(`invite-signup-prefilled-${width}.png`) });
  } finally { await phone.close(); }

  const done = dialog.getByRole("button", { name: "Done", exact: true });
  await done.scrollIntoViewIfNeeded(); await done.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Admin", exact: true })).toBeVisible();
});

test("invite history names the issuer and cleans up settled invites after confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signInQa(page); await openQaMenu(page, "Admin");
  const dialog = await issueInvite(page, 1281);
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  const history = page.getByRole("region", { name: "Invites" });
  const row = history.getByText(/invitee-1281@example.test · issued · Issued by /);
  await expect(row).toBeVisible();
  expect(await row.textContent()).not.toMatch(/Issued by [0-9a-f]{8}-[0-9a-f]{4}-/);
  await history.getByRole("button", { name: "Revoke invite for invitee-1281@example.test" }).click();
  await page.getByRole("dialog", { name: "Revoke invite" }).getByRole("button", { name: "Confirm" }).click();
  await expect(history.getByText(/invitee-1281@example.test · revoked/)).toBeVisible();
  await history.getByRole("button", { name: "Clean up history", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Clean up history" });
  await expect(confirm).toBeVisible(); await page.waitForTimeout(400);
  await page.screenshot({ path: evidencePath("invite-history-cleanup-confirm-1280.png") });
  await confirm.getByRole("button", { name: "Confirm" }).click();
  await expect(history.getByRole("status")).toHaveText(/entr(y|ies) deleted\./);
  await expect(history.getByText(/invitee-1281@example.test/)).toHaveCount(0);
  await page.screenshot({ path: evidencePath("invite-history-cleaned-1280.png") });
});
