import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { evidencePath, recordQa, signInQa } from "./qaRound2Session";
import { catalogs } from "./qaSweep3";

const copy = catalogs.de;
test.use({ locale: "de-DE" });

type Identity = { id: string; email: string; displayName: string };
async function seedSenders(page: Page) {
  const [seed] = JSON.parse(readFileSync(process.env.QA_SHELL_SEED_FILE!, "utf8"));
  const mailbox = `/api/accounts/${encodeURIComponent(seed.accountId ?? "qa-shared")}`;
  const headers = { origin: new URL(page.url()).origin };
  expect((await page.request.put(`${mailbox}/settings`, { headers, data: { settings: { signatures: [{ id: "qa-team", name: "Team-Signatur", body: "Viele Grüße\n{{user.name}}\n{{identity.email}}" }] } } })).status()).toBe(200);
  const listed = (await (await page.request.get(`${mailbox}/identities`)).json()).identities as Identity[];
  async function identity(email: string, displayName: string, signatureId?: string) {
    const existing = listed.find(item => item.email === email);
    if (existing) return existing;
    const response = await page.request.post(`${mailbox}/identities`, { headers, data: { email, displayName, ...(signatureId ? { signatureId } : {}) } });
    expect(response.status()).toBe(201);
    return (await response.json()).identity as Identity;
  }
  const team = await identity("team@example.test", "QA Team", "qa-team");
  const unsigned = await identity("unsigned@example.test", "QA Ohne Signatur");
  expect((await page.request.put(`${mailbox}/prefs`, { headers, data: { defaultIdentityId: team.id, signatureOverride: null } })).status()).toBe(200);
  return { team, unsigned };
}
const option = (sender: Identity) => `${sender.displayName} <${sender.email}>`;
async function openNewMail(page: Page) {
  await page.goto("/");
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  const compose = page.getByRole("button", { name: copy.Shell.compose.new, exact: true });
  if (!await compose.isVisible()) await page.getByRole("button", { name: copy.Shell.sidebar.toggle, exact: true }).first().click();
  await compose.click();
  await expect(page.locator('[data-lexical-editor="true"]')).toBeVisible();
}
async function pickFrom(page: Page, sender: Identity) {
  await page.getByLabel(copy.Compose.from, { exact: true }).click();
  await page.getByRole("option", { name: option(sender), exact: true }).click();
  await expect(page.getByLabel(copy.Compose.from, { exact: true })).toContainText(sender.email);
}

test("QA-201 From switch to an unsigned identity and back restores the signature without a prompt", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: "light" });
  await signInQa(page);
  const { team, unsigned } = await seedSenders(page);
  const dialogs: string[] = [];
  page.on("dialog", dialog => { dialogs.push(dialog.message()); void dialog.accept(); });
  await openNewMail(page);
  const editor = page.locator('[data-lexical-editor="true"]');
  const body = async () => (await editor.innerText()).replace(/ /g, " ");
  await expect(editor).toContainText("team@example.test");
  const rounds = [];
  for (let round = 0; round < 3; round += 1) {
    await pickFrom(page, unsigned);
    await expect(editor).not.toContainText("Viele Grüße");
    expect((await body()).trim()).toBe("");
    await pickFrom(page, team);
    await expect(editor).toContainText("team@example.test");
    const text = await body();
    expect(text.match(/Viele Grüße/g)).toHaveLength(1);
    expect(text.startsWith("Viele Grüße")).toBe(true);
    rounds.push(JSON.stringify(text));
  }
  expect(dialogs).toEqual([]);
  await page.screenshot({ path: evidencePath("QA-201-signature-restored-1440-light.png") });
  // Authored text still asks before a different signature is appended.
  await pickFrom(page, unsigned);
  await editor.click(); await page.keyboard.type("Synthetischer Text");
  await pickFrom(page, team);
  expect(dialogs).toHaveLength(1);
  await expect(editor).toContainText("Synthetischer Text");
  await expect(editor).toContainText("team@example.test");
  recordQa("QA-201", { rounds, promptsWhileUntouched: 0, promptsAfterAuthoredText: dialogs.length });
});

test("QA-204 the desktop From menu is about as wide as its field", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: "dark" });
  await signInQa(page);
  await seedSenders(page);
  const results = [];
  for (const [width, height, scheme, host] of [[1440, 900, "dark", "modal"], [1440, 900, "light", "inline"], [1280, 720, "light", "modal"], [390, 844, "dark", "phone"], [320, 568, "light", "phone"]] as const) {
    await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: scheme });
    await openNewMail(page);
    // The reported case: the desktop modal (the label is localized by i18n slice 3).
    if (host === "modal") {
      await page.getByRole("button", { name: /^(Open in modal|Im Dialog öffnen)$/ }).click();
      await expect(page.getByRole("dialog").getByLabel(copy.Compose.from, { exact: true })).toBeVisible();
    }
    const trigger = page.getByLabel(copy.Compose.from, { exact: true });
    const field = (await trigger.boundingBox())!;
    await trigger.click();
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    // The popper content owns the width; the listbox viewport sits inside its padding.
    const content = page.locator(".rt-SelectContent");
    // Measure after the open animation; its transform scales the box while it runs.
    await content.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)));
    const menu = (await content.boundingBox())!;
    if (width >= 768) {
      expect(Math.abs(menu.width - Math.min(560, Math.max(280, field.width)))).toBeLessThanOrEqual(1);
      expect(menu.x).toBeGreaterThanOrEqual(field.x - 1);
    } else {
      expect(Math.round(menu.width)).toBe(width - 32);
    }
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: evidencePath(`QA-204-from-menu-${host}-${width}-${scheme}.png`) });
    results.push({ width, scheme, host, field: { x: field.x, width: field.width }, menu: { x: menu.x, width: menu.width } });
    await page.keyboard.press("Escape");
    await expect(listbox).toHaveCount(0);
  }
  recordQa("QA-204", results);
});
