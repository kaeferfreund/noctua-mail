import { test, expect, type Page, type Dialog } from "@playwright/test";
import { readFileSync } from "node:fs";
import { evidencePath, recordQa, signInQa } from "../../tests/browser/ui/qaRound2Session";
import { catalogs } from "../../tests/browser/ui/qaSweep3";
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
async function pickFrom(page: Page, sender: Identity) {
  await page.getByLabel(copy.Compose.from, { exact: true }).click();
  await page.getByRole("option", { name: option(sender), exact: true }).click();
  await expect(page.getByLabel(copy.Compose.from, { exact: true })).toContainText(sender.email);
  await page.waitForTimeout(400);
}
async function body(page: Page) {
  const text = page.locator('textarea[name="compose_body"]:visible');
  if (await text.count()) return { tab: "text", value: await text.inputValue() };
  const md = page.locator('.w-md-editor textarea:visible');
  if (await md.count()) return { tab: "markdown", value: await md.inputValue() };
  return { tab: "html", value: (await page.locator('[data-lexical-editor="true"]').first().innerText()).replace(/ /g, " ") };
}
const sigCount = (value: string) => (value.match(/team@example\.test/g) ?? []).length;
function dialogLog(page: Page, mode: "accept" | "dismiss") {
  const log: string[] = [];
  const handler = (dialog: Dialog) => {
    if (dialog.type() === "beforeunload") { void dialog.accept(); return; }
    log.push(dialog.message());
    void (mode === "accept" ? dialog.accept() : dialog.dismiss());
  };
  page.on("dialog", handler);
  return { log, stop: () => page.off("dialog", handler) };
}
async function openSidebarIfNeeded(page: Page, name: string) {
  const target = page.getByRole("button", { name, exact: true });
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  await page.waitForTimeout(500);
  if (!await target.isVisible() || !await target.evaluate(el => { const r = el.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && r.width > 0; })) await page.getByRole("button", { name: copy.Shell.sidebar.toggle, exact: true }).first().click();
  return target;
}
async function cycle(page: Page, team: Identity, unsigned: Identity, rounds = 2) {
  const out = [];
  for (let round = 0; round < rounds; round += 1) {
    await pickFrom(page, unsigned);
    const without = await body(page);
    await pickFrom(page, team);
    const back = await body(page);
    out.push({ without: JSON.stringify(without.value.slice(0, 120)), back: JSON.stringify(back.value.slice(0, 160)), tab: back.tab, sigs: sigCount(back.value), startsWithSig: back.value.trimStart().startsWith("Viele Grüße") });
  }
  return out;
}


test("review QA-201 accept path on forward and text reply", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: "light" });
  await signInQa(page);
  await expect(page.getByText(/^QA long subject checks wrapping/).first()).toBeVisible({ timeout: 60000 });
  const html = `From: Synthetic Html <html@example.test>\r\nTo: demo@monkeydent.test\r\nMessage-ID: <qa-review-html2@example.test>\r\nDate: ${new Date().toUTCString()}\r\nSubject: QA review HTML synthetic\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><p>Synthetic <b>HTML</b> body for the review.</p></body></html>\r\n`;
  expect((await request.post(new URL("/inject", process.env.QA_SHELL_CONTROL_URL!).toString(), { data: { source: html } })).ok()).toBe(true);
  await page.getByRole("button", { name: "Alle Ordner auf neue E-Mails prüfen", exact: true }).first().click().catch(() => {});
  const { team, unsigned } = await seedSenders(page);
  const results: Record<string, unknown> = {};
  for (const [label, subject, action] of [["html-forward", /^QA review HTML synthetic/, copy.Reader.forward], ["text-forward", /^QA long subject checks wrapping/, copy.Reader.forward], ["text-reply", /^QA long subject checks wrapping/, copy.Reader.reply]] as const) {
    const dialogs = dialogLog(page, "accept");
    await page.goto("/");
    await expect(page.getByText(subject).first()).toBeVisible({ timeout: 60000 });
    await page.getByText(subject).first().click();
    await page.getByRole("button", { name: action, exact: true }).first().click();
    await expect(page.getByLabel(copy.Compose.from, { exact: true })).toBeVisible();
    await page.waitForTimeout(600);
    await pickFrom(page, team);
    const start = await body(page);
    await pickFrom(page, unsigned);
    await pickFrom(page, team);
    const back = await body(page);
    await page.screenshot({ path: evidencePath(`QA-201-review-accept-${label}-1440-light.png`) });
    results[label] = { prompts: dialogs.log.length, start: JSON.stringify(start.value.slice(0, 200)), back: JSON.stringify(back.value.slice(0, 260)), sigIndexStart: start.value.indexOf("Viele Grüße"), sigIndexBack: back.value.indexOf("Viele Grüße"), sigs: sigCount(back.value) };
    dialogs.stop();
  }
  recordQa("review-QA-201-accept", results);
});
