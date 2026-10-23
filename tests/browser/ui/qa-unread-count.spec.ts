import { test, expect, type Page } from "@playwright/test";
import { evidencePath, recordQa, signInQa } from "./qaRound2Session";

async function counts(page: Page) {
  return page.evaluate(async () => {
    const folders = await (await fetch("/api/accounts/qa-shared/folders")).json();
    const summary = await (await fetch("/api/me/mailboxes/summary")).json();
    const inbox = folders.find((folder: { name: string }) => folder.name === "INBOX");
    const mailbox = summary.mailboxes.find((mailbox: { accountId: string }) => mailbox.accountId === "qa-shared");
    const row = document.querySelector('[data-sidebar="menu-button"][aria-current="true"]')?.parentElement;
    const inboxRow = [...document.querySelectorAll('[data-sidebar="menu-button"]')].find(el => el.textContent === "Inbox")?.parentElement;
    const focusedRow = [...document.querySelectorAll('[data-sidebar="menu-button"]')].find(el => el.textContent === "Focused")?.parentElement;
    const treeBadge = document.querySelector('[title^="Inbox ("][aria-label$=" unread"]');
    return { api: inbox?.unreadCount, summary: mailbox?.unread, mailbox: Number(row?.querySelector('[title="Unread"]')?.textContent), inbox: Number(inboxRow?.querySelector('[aria-label$=" unread"]')?.textContent), tree: Number(treeBadge?.textContent), focused: Number(focusedRow?.querySelector('[aria-label$=" unread"]')?.textContent?.replace("Unread: ", "")), total: inbox?.count };
  });
}
const expected = (n: number, total = 300) => ({ api: n, summary: n, mailbox: n, inbox: n, tree: n, focused: n, total });

test("QA-101 one Mark as read gives 110 → 109 within 2s, stable at 10s; unread → 110; new mail → 111", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ colorScheme: "dark" });
  const streamStatuses: number[] = [];
  page.on("response", response => { if (response.url().includes("/imap/stream")) streamStatuses.push(response.status()); });
  await signInQa(page);
  await expect.poll(() => counts(page), { timeout: 60000 }).toEqual(expected(110));
  console.log("QA-101 initial", JSON.stringify(await counts(page)));
  await expect(page.getByRole("img", { name: "Watcher: Listening for new mail", exact: true })).toBeVisible();
  await expect.poll(() => streamStatuses).toContain(200);
  const posts: unknown[] = [];
  page.on("request", req => { if (req.method() === "POST" && /\/messages\/[^/]+\/flags$/.test(new URL(req.url()).pathname)) posts.push(req.postDataJSON()); });
  const search = page.getByRole("textbox", { name: /^Search/ });
  await expect(search).toBeVisible();
  await search.fill("QA synthetic 014"); await search.press("Enter");
  await expect(page.getByText("QA synthetic 014", { exact: true }).first()).toBeVisible();
  await page.getByText("QA synthetic 014", { exact: true }).first().click();
  const actions = page.getByRole("button", { name: /^Message actions:/ });
  await expect(actions).toBeEnabled();
  await actions.click();
  const responsePromise = page.waitForResponse(res => /\/messages\/[^/]+\/flags$/.test(new URL(res.url()).pathname) && res.request().method() === "POST");
  const started = Date.now();
  await page.getByRole("menuitem", { name: /^Mark as read/ }).click();
  const response = await responsePromise; expect(response.status()).toBe(200);
  const samples = [];
  await expect.poll(async () => { const value = await counts(page); samples.push({ ms: Date.now() - started, ...value }); return value; }, { timeout: 2000, intervals: [50, 100, 200] }).toEqual(expected(109));
  const settledMs = Date.now() - started;
  expect(settledMs).toBeLessThanOrEqual(2000);
  await page.screenshot({ path: evidencePath("QA-101-read-109-dark.png") });
  // Measure continuously until ten seconds, so a transient correct value cannot pass.
  while (Date.now() - started < 10000) {
    const value = await counts(page); expect(value).toEqual(expected(109));
    samples.push({ ms: Date.now() - started, ...value }); await page.waitForTimeout(250);
  }
  const stable = await counts(page); expect(stable).toEqual(expected(109));
  samples.push({ ms: Date.now() - started, ...stable });
  expect(posts).toEqual([{ flag: "seen", value: true }]);
  await page.screenshot({ path: evidencePath("QA-101-stable-10s-dark.png") });
  await actions.click();
  const unreadStart = Date.now();
  await page.getByRole("menuitem", { name: /^Mark as unread/ }).click();
  await expect.poll(() => counts(page), { timeout: 2000 }).toEqual(expected(110));
  const unreadMs = Date.now() - unreadStart, unread = await counts(page);
  expect(unreadMs).toBeLessThanOrEqual(2000);
  expect(posts).toEqual([{ flag: "seen", value: true }, { flag: "seen", value: false }]);
  const injectStart = Date.now();
  const injection = await request.post(new URL("/inject", process.env.QA_SHELL_CONTROL_URL!).toString(), { data: { subject: "QA new synthetic unread", text: "Synthetic QA-101 new-mail check" } });
  expect(injection.ok()).toBe(true);
  await expect.poll(() => counts(page), { timeout: 20000 }).toEqual(expected(111, 301));
  const newMailMs = Date.now() - injectStart, newMail = await counts(page);
  await page.screenshot({ path: evidencePath("QA-101-new-111-dark.png") });
  recordQa("QA-101", { initial: expected(110), streamStatuses, mutationStatus: response.status(), readPosts: posts.slice(0, 1), settledMs, samples, unread, unreadMs, newMail, newMailMs, injectionStatus: injection.status() });
});
