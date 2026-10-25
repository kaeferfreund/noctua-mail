import { test, expect, type Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { recordQa, signInQa } from "./qaRound2Session";
import { catalogs } from "./qaSweep3";

// „Senden planen“ end to end against the production server's job and the SMTP fixture:
// every planned draft reaches the outbox exactly once, also when a manual send races the job.
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-schedule-send-once.spec.ts bun scripts/runQaShellBrowserTests.ts
const copy = catalogs.de;
test.use({ locale: "de-DE", timezoneId: "Europe/Berlin" });
const mailbox = "/api/accounts/qa-shared";
const TICK_MS = 15_000;

const copies = (subject: string) => readdirSync(process.env.QA_SHELL_OUTBOX!).filter(name => name.endsWith(".eml"))
  .map(name => readFileSync(path.join(process.env.QA_SHELL_OUTBOX!, name), "utf8"))
  .filter(source => source.split(/\r?\n/).some(line => line === `Subject: ${subject}`)).length;
const origin = (page: Page) => ({ origin: new URL(page.url()).origin });

async function saveDraft(page: Page, subject: string) {
  const response = await page.request.post(`${mailbox}/drafts/save`, { headers: origin(page),
    data: { to: "recipient@example.test", subject, text: "Synthetic planned body." } });
  expect(response.status()).toBe(200);
  return (await response.json()).draftId as string;
}
async function plan(page: Page, draftId: string, sendAt: number) {
  const response = await page.request.post(`${mailbox}/drafts/scheduled`, { headers: origin(page), data: { draftId, sendAt } });
  expect(response.status()).toBe(201);
  return (await response.json()).scheduledSend.id as string;
}
async function openSchedules(page: Page, draftId: string) {
  const response = await page.request.get(`${mailbox}/drafts/scheduled?draftId=${encodeURIComponent(draftId)}`);
  return ((await response.json()).scheduledSends as Array<{ status: string }>);
}
/** Waits until the job has settled the draft's schedule (no queued/sending row left). */
async function untilSettled(page: Page, draftId: string, timeout = 90_000) {
  await expect.poll(async () => (await openSchedules(page, draftId)).filter(row => row.status !== "failed").length,
    { timeout, intervals: [1_000] }).toBe(0);
}

/** New compose in the UI; resolves with the draft id of its autosave. */
async function composeInUi(page: Page, subject: string) {
  await page.goto("/?a=~qa-shared&f=INBOX");
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  const compose = page.getByRole("button", { name: copy.Shell.compose.new, exact: true }).first();
  await compose.waitFor({ state: "attached" });
  const box = await compose.boundingBox();
  if (!box || box.x < 0 || box.y < 0 || box.x + box.width > page.viewportSize()!.width) {
    await page.getByRole("button", { name: copy.Shell.sidebar.toggle, exact: true }).first().click();
  }
  await expect(compose).toBeInViewport();
  await compose.click();
  await expect(page.locator('[data-lexical-editor="true"]')).toBeVisible();
  const saved = page.waitForResponse(response => response.url().includes("/drafts/save") && response.ok(), { timeout: 60_000 });
  await page.getByLabel(copy.Compose.fields.to, { exact: true }).fill("recipient@example.test");
  await page.getByLabel(copy.Compose.fields.subject, { exact: true }).fill(subject);
  await page.locator('[data-lexical-editor="true"]').click();
  await page.keyboard.type("Synthetic planned body.");
  const draftId = (await (await saved).json()).draftId as string;
  // Let a trailing autosave for the body finish so „Senden“ does not wait on it.
  await page.waitForTimeout(3_000);
  return draftId;
}
async function clickSend(page: Page) {
  const request = page.waitForRequest(req => req.url().includes("/smtp/send") && req.method() === "POST");
  const response = page.waitForResponse(res => res.url().includes("/smtp/send"));
  await page.getByRole("button", { name: copy.Compose.actions.send, exact: true }).click();
  return { body: (await request).postDataJSON() as { draftId?: string }, status: (await response).status() };
}

test("QA scheduled send goes out exactly once, also when a manual send races the job", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 860 });
  await signInQa(page);
  await expect(async () => {
    await page.goto("/");
    await expect(page.locator('[data-message-list-row="true"]').first()).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });
  const stamp = Date.now().toString(36);
  const result: Record<string, unknown> = {};

  // (a) The job alone: due in 20 s, exactly one copy, and none more after another full tick.
  const aSubject = `QA once job ${stamp}`;
  const aDraft = await saveDraft(page, aSubject);
  const aDue = Date.now() + 20_000;
  await plan(page, aDraft, aDue);
  await untilSettled(page, aDraft);
  const aSentAt = Date.now();
  expect(copies(aSubject)).toBe(1);
  await page.waitForTimeout(TICK_MS + 5_000);
  expect(copies(aSubject)).toBe(1);
  result.jobOnly = { delayMs: aSentAt - aDue, copies: copies(aSubject) };

  // (b1) Compose „Senden“ before the job: the draft's schedule (planned elsewhere, e.g. another
  // tab) is taken from the job; after the due time and a tick there is still one copy.
  const b1Subject = `QA once manual first ${stamp}`;
  const b1Draft = await composeInUi(page, b1Subject);
  const b1Due = Date.now() + 25_000;
  await plan(page, b1Draft, b1Due);
  const b1 = await clickSend(page);
  expect(b1.status).toBe(200);
  expect(b1.body.draftId).toBe(b1Draft);
  await expect.poll(() => copies(b1Subject), { timeout: 30_000 }).toBe(1);
  await page.waitForTimeout(Math.max(0, b1Due - Date.now()) + TICK_MS + 5_000);
  expect(copies(b1Subject)).toBe(1);
  expect(await openSchedules(page, b1Draft)).toEqual([]);
  result.manualFirst = { smtpSend: b1.status, copies: copies(b1Subject) };

  // (b2) The job first while compose is still open: „Senden“ is refused with 409, no second copy.
  const b2Subject = `QA once job first ${stamp}`;
  const b2Draft = await composeInUi(page, b2Subject);
  await plan(page, b2Draft, Date.now() + 2_000);
  await untilSettled(page, b2Draft);
  expect(copies(b2Subject)).toBe(1);
  const b2 = await clickSend(page);
  expect(b2.status).toBe(409);
  expect(b2.body.draftId).toBe(b2Draft);
  await expect(page.getByText(copy.Compose.schedule.sendConflictSent).first()).toBeVisible();
  expect(copies(b2Subject)).toBe(1);
  result.jobFirst = { smtpSend: b2.status, copies: copies(b2Subject) };

  // (b3) Race across a whole job tick: six drafts due at the same instant, one compose-style
  // send (with draftId, then the compose discard on success) per draft every 3 s around it.
  const due = Date.now() + 20_000;
  const race = await Promise.all(Array.from({ length: 6 }, async (_, index) => {
    const subject = `QA once race ${index} ${stamp}`;
    const draftId = await saveDraft(page, subject);
    await plan(page, draftId, due);
    return { subject, draftId, fireAt: due - 4_000 + index * 3_000 };
  }));
  const outcomes = await Promise.all(race.map(async entry => {
    await page.waitForTimeout(Math.max(0, entry.fireAt - Date.now()));
    const response = await page.request.post(`${mailbox}/smtp/send`, { headers: origin(page),
      data: { to: "recipient@example.test", subject: entry.subject, text: "Synthetic planned body.", draftId: entry.draftId } });
    const body = await response.json().catch(() => ({}));
    if (response.ok()) {
      await page.request.post(`${mailbox}/drafts/${encodeURIComponent(entry.draftId)}/discard`, { headers: origin(page), data: {} });
    }
    return { ...entry, status: response.status(), code: (body as { code?: string }).code ?? null };
  }));
  for (const entry of race) await untilSettled(page, entry.draftId);
  await page.waitForTimeout(TICK_MS + 5_000);
  for (const entry of outcomes) {
    expect([200, 409]).toContain(entry.status);
    expect(copies(entry.subject), entry.subject).toBe(1);
  }
  result.race = outcomes.map(entry => ({ offsetMs: entry.fireAt - due, smtpSend: entry.status, code: entry.code, copies: copies(entry.subject) }));
  recordQa("schedule-send-once-e2e", result);
});
