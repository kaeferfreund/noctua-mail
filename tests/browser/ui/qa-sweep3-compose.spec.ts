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
