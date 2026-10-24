import { test, expect, type Page, type Dialog } from "@playwright/test";
import { readFileSync } from "node:fs";
import { evidencePath, recordQa, signInQa } from "../../tests/browser/ui/qaRound2Session";
import { catalogs, openUserMenuItem } from "../../tests/browser/ui/qaSweep3";

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

test.only("review QA-201 reply and forward on text and HTML messages", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: "light" });
  const html = `From: Synthetic Html <html@example.test>\r\nTo: demo@monkeydent.test\r\nMessage-ID: <qa-review-html@example.test>\r\nDate: ${new Date().toUTCString()}\r\nSubject: QA review HTML synthetic\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><p>Synthetic <b>HTML</b> body for the review.</p></body></html>\r\n`;
  await signInQa(page);
  await expect(page.getByText(/^QA long subject checks wrapping/).first()).toBeVisible({ timeout: 60000 });
  expect((await request.post(new URL("/inject", process.env.QA_SHELL_CONTROL_URL!).toString(), { data: { source: html } })).ok()).toBe(true);
  await page.getByRole("button", { name: "Alle Ordner auf neue E-Mails prüfen", exact: true }).first().click().catch(() => {});
  const { team, unsigned } = await seedSenders(page);
  const results: Record<string, unknown> = {};
  for (const [label, subject] of [["text", /^QA long subject checks wrapping/], ["html", /^QA review HTML synthetic/]] as const) for (const action of [copy.Reader.reply, copy.Reader.forward]) {
    const dialogs = dialogLog(page, "dismiss");
    await page.goto("/");
    await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
    await expect(page.getByText(subject).first()).toBeVisible({ timeout: 60000 });
    await page.getByText(subject).first().click();
    await page.getByRole("button", { name: action, exact: true }).first().click();
    await expect(page.getByLabel(copy.Compose.from, { exact: true })).toBeVisible();
    await page.waitForTimeout(600);
    const initialFrom = (await page.getByLabel(copy.Compose.from, { exact: true }).innerText()).trim();
    const initial = await body(page);
    await pickFrom(page, team);
    const firstTeam = await body(page);
    const promptsOnFirstTeam = dialogs.log.length;
    const rounds = await cycle(page, team, unsigned);
    const key = `${label}-${action}`;
    results[key] = { initialFrom, initialTab: initial.tab, initialSigs: sigCount(initial.value), initial: JSON.stringify(initial.value.slice(0, 100)), firstTeam: JSON.stringify(firstTeam.value.slice(0, 160)), firstTeamSigs: sigCount(firstTeam.value), promptsOnFirstTeam, rounds, promptsDismissedTotal: dialogs.log.length };
    if (label === "html" && action === copy.Reader.reply) await page.screenshot({ path: evidencePath("QA-201-reply-html-1440-light.png") });
    if (label === "text" && action === copy.Reader.reply) await page.screenshot({ path: evidencePath("QA-201-reply-text-1440-light.png") });
    dialogs.stop();
  }
  recordQa("review-QA-201-reply-forward", results);
});

test("review QA-201 modal new mail at 1440 and phone 390", async ({ page }) => {
  await signInQa(page);
  const { team, unsigned } = await seedSenders(page);
  const results: Record<string, unknown> = {};
  for (const [width, height, scheme, host] of [[1440, 900, "light", "modal"], [1440, 900, "dark", "inline"], [390, 844, "light", "phone"], [390, 844, "dark", "phone"]] as const) {
    await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: scheme });
    const dialogs = dialogLog(page, "dismiss");
    await page.goto("/");
    const compose = await openSidebarIfNeeded(page, copy.Shell.compose.new);
    await compose.click();
    await expect(page.locator('[data-lexical-editor="true"]')).toBeVisible();
    if (host === "modal") {
      await page.getByRole("button", { name: /^(Open in modal|Im Dialog öffnen)$/ }).click();
      await expect(page.getByRole("dialog").getByLabel(copy.Compose.from, { exact: true })).toBeVisible();
    }
    await expect(page.getByLabel(copy.Compose.from, { exact: true })).toContainText("team@example.test");
    const rounds = await cycle(page, team, unsigned, 3);
    await page.screenshot({ path: evidencePath(`QA-201-new-${host}-${width}-${scheme}.png`) });
    results[`${host}-${width}-${scheme}`] = { rounds, prompts: dialogs.log.length };
    dialogs.stop();
  }
  recordQa("review-QA-201-modal-phone", results);
});

test("review QA-201 reopened drafts get no extra signature", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: "light" });
  await signInQa(page);
  const { team, unsigned } = await seedSenders(page);
  const results: Record<string, unknown> = {};
  for (const kind of ["signed", "blank"] as const) {
    const dialogs = dialogLog(page, "dismiss");
    await page.goto("/");
    const compose = await openSidebarIfNeeded(page, copy.Shell.compose.new);
    await compose.click();
    await expect(page.getByLabel(copy.Compose.from, { exact: true })).toContainText("team@example.test");
    if (kind === "blank") await pickFrom(page, unsigned);
    const subject = `QA review draft ${kind} ${Date.now()}`;
    const saved = page.waitForResponse(response => response.url().endsWith("/drafts/save") && response.request().postDataJSON().subject === subject);
    await page.getByLabel("Subject:", { exact: true }).fill(subject);
    expect((await saved).status()).toBe(200);
    await expect(page.getByText(/Draft saved/)).toBeVisible();
    const beforeClose = await body(page);
    await page.goto("/");
    await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
    const drafts = page.getByRole("button", { name: new RegExp(copy.Folders.drafts) }).first();
    await page.waitForTimeout(500);
    if (!await drafts.isVisible() || !await drafts.evaluate(el => { const r = el.getBoundingClientRect(); return r.right > 0 && r.left < innerWidth; })) await page.getByRole("button", { name: copy.Shell.sidebar.toggle, exact: true }).first().click();
    await drafts.click();
    await page.getByText(subject, { exact: true }).first().click();
    await page.getByRole("button", { name: copy.Reader.editDraft, exact: true }).click();
    await expect(page.getByLabel("Subject:", { exact: true })).toHaveValue(subject);
    await page.waitForTimeout(800);
    const reopened = await body(page);
    const steps = [];
    for (const sender of [unsigned, team, unsigned, team]) {
      await pickFrom(page, sender);
      const now = await body(page);
      steps.push({ to: sender.email, sigs: sigCount(now.value), value: JSON.stringify(now.value.slice(0, 120)), prompts: dialogs.log.length });
    }
    if (kind === "signed") await page.screenshot({ path: evidencePath("QA-201-reopened-draft-1440-light.png") });
    results[kind] = { beforeCloseSigs: sigCount(beforeClose.value), reopenedSigs: sigCount(reopened.value), reopened: JSON.stringify(reopened.value.slice(0, 120)), steps, prompts: dialogs.log };
    dialogs.stop();
  }
  recordQa("review-QA-201-reopened", results);
});

test("review QA-203 admin users tab at 390 and desktop 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: "light" });
  await signInQa(page);
  await openUserMenuItem(page, copy, copy.Shell.admin);
  const results = [];
  for (const [width, height, scheme] of [[1440, 900, "light"], [1440, 900, "dark"], [390, 844, "light"], [390, 844, "dark"], [320, 568, "dark"]] as const) {
    await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: scheme });
    for (const tab of [copy.Admin.tabs.users, copy.Admin.tabs.mailboxes]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await page.waitForTimeout(400);
      const admin = page.getByRole("dialog", { name: copy.Admin.title, exact: true });
      const buttons = await admin.locator("button:visible").evaluateAll(list => list.map(button => { const box = button.getBoundingClientRect(); return { label: button.textContent?.trim(), right: Math.round(box.right), h: Math.round(box.height), clipped: button.scrollWidth > button.clientWidth + 1 }; }));
      const out = buttons.filter(b => b.right > width || b.clipped);
      results.push({ width, scheme, tab, buttons: buttons.length, minH: Math.min(...buttons.map(b => b.h)), maxH: Math.max(...buttons.map(b => b.h)), offenders: out, docScroll: await page.evaluate(() => document.documentElement.scrollWidth) });
      await page.screenshot({ path: evidencePath(`QA-203-review-${tab === copy.Admin.tabs.users ? "users" : "mailboxes"}-${width}-${scheme}.png`) });
    }
  }
  recordQa("review-QA-203", results);
});

for (const locale of ["de", "en"] as const) test.describe(`review QA-210 ${locale}`, () => {
  const loc = catalogs[locale];
  test.use({ locale: locale === "de" ? "de-DE" : "en-GB" });
  test(`review QA-210 placeholder fit over time and on phones (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInQa(page);
    const input = page.locator("#top-search-input");
    await expect(input).toHaveAttribute("placeholder", loc.Search.placeholder.folder.replace("{folder}", loc.Folders.inbox));
    const measure = () => input.evaluate((element: HTMLInputElement) => {
      const style = getComputedStyle(element);
      const canvas = document.createElement("canvas").getContext("2d")!;
      canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const visible = element.getBoundingClientRect().width > 0 && style.visibility !== "hidden";
      return { visible, text: Math.round(canvas.measureText(element.placeholder).width), available: Math.round(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) };
    });
    const results = [];
    for (const [width, height, scheme] of [[1440, 900, "light"], [1280, 900, "dark"], [1440, 900, "dark"], [1280, 900, "light"], [390, 844, "light"], [390, 844, "dark"], [320, 568, "dark"]] as const) {
      await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme: scheme });
      const samples = [];
      for (const wait of [0, 150, 500, 1500]) { await page.waitForTimeout(wait); samples.push({ wait, ...(await input.isVisible() ? await measure() : { visible: false }) }); }
      if (width < 768 && !await input.isVisible()) {
        const open = page.getByRole("button", { name: new RegExp(loc.Search.open ?? "Suche|Search") }).first();
        if (await open.count()) { await open.click().catch(() => {}); await page.waitForTimeout(500); samples.push({ wait: "after-open", ...(await input.isVisible() ? await measure() : { visible: false }) }); }
      }
      await page.screenshot({ path: evidencePath(`QA-210-review-${locale}-${width}-${scheme}.png`) });
      results.push({ width, scheme, samples });
      await page.keyboard.press("Escape").catch(() => {});
    }
    recordQa(`review-QA-210-${locale}`, results);
  });
});
