import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type de from "../../../messages/de.json";

export type Catalog = typeof de;
export const catalogs = Object.fromEntries((["de", "en"] as const).map(locale =>
  [locale, JSON.parse(readFileSync(path.join("messages", `${locale}.json`), "utf8")) as Catalog])) as Record<"de" | "en", Catalog>;

/** Localized variant of openQaMenu: reach the user menu at any width and open one entry. */
export async function openUserMenuItem(page: Page, copy: Catalog, item: string) {
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  const user = page.getByRole("button", { name: copy.Shell.userMenu, exact: true });
  // Phones and a collapsed desktop sidebar mount the user menu only after the sidebar opens.
  if (!await user.isVisible()) await page.getByRole("button", { name: copy.Shell.sidebar.toggle, exact: true }).first().click();
  await expect(user).toBeInViewport();
  await user.click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}
