import { expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { totpFromUri } from "../../helpers/totp";

export async function signInQa(page: Page) {
  // The existing compose cases each sign in. Respect the production three-per-
  // ten-second login budget when these independent UI cases run in the same suite.
  await page.waitForTimeout(11000);
  const [seed] = JSON.parse(readFileSync(process.env.QA_SHELL_SEED_FILE!, "utf8"));
  await page.goto("/");
  for (const [url, body] of [
    ["/api/ba/sign-in/email", { email: seed.email, password: seed.password }],
    ["/api/ba/two-factor/verify-totp", { code: totpFromUri(seed.totpURI) }],
    ["/api/auth/switch-account", { accountId: "qa-shared" }]
  ] as const) {
    const result = await page.request.post(url, { data: body, headers: { origin: new URL(page.url()).origin } });
    expect(result.status()).toBe(200);
  }
  await page.reload();
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
}

export async function openQaMenu(page: Page, item: "Settings" | "Admin") {
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  const user = page.getByRole("button", { name: "User menu", exact: true });
  const width = page.viewportSize()!.width;
  if (width < 768) {
    if (!await page.getByRole("dialog", { name: "Sidebar", exact: true }).isVisible()) {
      await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    }
  } else {
    await user.waitFor({ state: "attached" });
    const box = await user.boundingBox();
    if (!box || box.x < 0 || box.x + box.width > width) {
      await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    }
  }
  await expect(user).toBeInViewport();
  await user.click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

export function evidencePath(file: string) {
  const dir = process.env.QA_ROUND2_EVIDENCE_DIR ?? ".tmp/qa-round2-evidence";
  mkdirSync(dir, { recursive: true });
  return path.join(dir, file);
}
export function recordQa(id: string, value: unknown) {
  writeFileSync(evidencePath(`${id}.json`), JSON.stringify(value, null, 2));
  console.log(id, JSON.stringify(value));
}
