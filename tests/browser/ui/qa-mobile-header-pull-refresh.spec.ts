import { test, expect, type CDPSession, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// Phone reader header without an empty band around a one-line subject, and
// pull-to-refresh on the phone message list (real touch input through CDP):
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-mobile-header-pull-refresh.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/mobile-header-pull-refresh-evidence;
// MOBILE_HEADER_EVIDENCE_DIR redirects it, MOBILE_HEADER_PREFIX names the files.
test.use({ locale: "de-DE", hasTouch: true });
const evidence = path.resolve(process.env.MOBILE_HEADER_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "mobile-header-pull-refresh-evidence"));
const prefix = process.env.MOBILE_HEADER_PREFIX ?? "after";

const shortSubject = "Kurzer Betreff zur Ratenwarnung";
const lateSubject = "Neu eingegangen nach dem Herunterziehen";
const source = (subject: string, id: string, offsetMs: number) => [
  "From: Synthetic Console <console@mail.example.test>",
  "To: demo@monkeydent.test",
  `Message-ID: <${id}@example.test>`,
  `Date: ${new Date(Date.now() + offsetMs).toUTCString()}`,
  `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8",
  "",
  `Synthetischer Text für ${subject}.`
].join("\r\n");

async function inject(subject: string, id: string, offsetMs: number) {
  const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, {
    method: "POST", body: JSON.stringify({ source: source(subject, id, offsetMs), flags: ["\\Seen"] })
  });
  expect(response.ok).toBe(true);
}

test.beforeAll(async () => { await inject(shortSubject, "qa-mobile-header-short", 7_200_000); });

const rowFor = (page: Page, subject: string) =>
  page.locator('[data-message-list-row="true"]').filter({ hasText: subject });

async function waitForRow(page: Page, subject: string) {
  // The first sync of the fixture inbox can outlast one page load.
  await expect.poll(async () => {
    if (await rowFor(page, subject).count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120000, intervals: [500] }).toBe(true);
}

/** Subject row, the collaboration row below it and the subject toggle's touch target. */
async function measureHeader(page: Page, subject: string) {
  return page.evaluate((title) => {
    const text = [...document.querySelectorAll<HTMLElement>(`[title="${CSS.escape(title)}"]`)]
      .find(item => item.closest("[data-reader-print]") && item.getBoundingClientRect().height > 0)!;
    const row = text.parentElement!.parentElement!.getBoundingClientRect();
    const toggle = text.nextElementSibling!.getBoundingClientRect();
    const collab = document.querySelector<HTMLElement>('[data-reader-print] [role="combobox"]')!.getBoundingClientRect();
    return {
      textHeight: Math.round(text.getBoundingClientRect().height),
      lineHeight: parseFloat(getComputedStyle(text).lineHeight),
      rowHeight: Math.round(row.height),
      gapToCollab: Math.round(collab.top - row.bottom),
      toggle: { width: Math.round(toggle.width), height: Math.round(toggle.height) }
    };
  }, subject);
}

test("mobile reader header: a one-line subject leaves no empty band", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await signInQa(page);
  await waitForRow(page, shortSubject);
  const results: Record<string, unknown>[] = [];
  for (const width of [390, 430]) {
    for (const scheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(value => { localStorage.setItem("noctua:theme", value); }, scheme);
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
      await rowFor(page, shortSubject).click();
      await expect(page.getByRole("combobox", { name: "Zuständig", exact: true })).toBeVisible();
      await page.waitForTimeout(400);
      const result = { width, scheme, ...await measureHeader(page, shortSubject) };
      results.push(result);
      await page.screenshot({ path: path.join(evidence, `${prefix}-reader-${width}-${scheme}.png`) });
      if (process.env.MOBILE_HEADER_ASSERT === "0") continue;
      // One subject line: the row is as tall as the text, the collaboration row follows at the column gap.
      expect(result.textHeight).toBeLessThanOrEqual(result.lineHeight * 1.5);
      expect(result.rowHeight).toBeLessThanOrEqual(Math.ceil(result.lineHeight) + 2);
      expect(result.gapToCollab).toBeLessThanOrEqual(12);
      // The chevron keeps its 44 px touch target.
      expect(result.toggle).toEqual({ width: 44, height: 44 });
    }
  }
  console.log("mobile-header", JSON.stringify(results));
});

async function touchPull(cdp: CDPSession, x: number, y0: number, distance: number, beforeRelease?: () => Promise<void>) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  const steps = 16;
  for (let step = 1; step <= steps; step++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + (distance * step) / steps }] });
  }
  await beforeRelease?.();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("mobile list: pulling down from the top checks the mailbox once", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await signInQa(page);
  await waitForRow(page, shortSubject);
  const pane = page.locator('[id="list"] aside');
  await expect(pane).toHaveAttribute("data-pull-state", "idle");
  expect(await pane.evaluate(el => getComputedStyle(el).overscrollBehaviorY)).toBe("contain");
  const syncs: string[] = [];
  page.on("request", request => {
    if (request.method() === "POST" && /\/sync$/.test(new URL(request.url()).pathname)) syncs.push(request.postData() ?? "");
  });
  const cdp = await page.context().newCDPSession(page);
  const box = (await pane.boundingBox())!;
  const x = box.x + box.width / 2;
  const y0 = box.y + 80;
  // The phone reader's back button shows only once a message is open.
  const opened = page.getByRole("button", { name: "Zurück zu den Nachrichten", exact: true });

  // A short pull springs back without a sync and does not open the row under the finger.
  await page.waitForTimeout(3000);
  syncs.length = 0;
  await touchPull(cdp, x, y0, 40);
  await expect(pane).toHaveAttribute("data-pull-state", "idle");
  await page.waitForTimeout(2000);
  expect(syncs).toHaveLength(0);
  await expect(opened).toBeHidden();

  // A full pull: one "new" sync of the open folder, then the indicator goes away.
  await touchPull(cdp, x, y0, 220, async () => {
    await expect(pane).toHaveAttribute("data-pull-state", "armed");
    await page.screenshot({ path: path.join(evidence, `${prefix}-pull-1-armed.png`) });
  });
  await page.screenshot({ path: path.join(evidence, `${prefix}-pull-2-released.png`) });
  await expect.poll(() => syncs.length, { timeout: 20000 }).toBe(1);
  expect(JSON.parse(syncs[0])).toMatchObject({ mode: "new" });
  await expect(pane).toHaveAttribute("data-pull-state", "idle", { timeout: 60000 });
  await page.waitForTimeout(2000);
  expect(syncs).toHaveLength(1);
  await expect(opened).toBeHidden();

  // A mail that arrived on the server shows up in the list after the pull.
  await inject(lateSubject, "qa-mobile-pull-late", 10_800_000);
  await touchPull(cdp, x, y0, 220);
  await expect(rowFor(page, lateSubject)).toBeVisible({ timeout: 30000 });
  await expect(pane).toHaveAttribute("data-pull-state", "idle", { timeout: 60000 });
  await page.screenshot({ path: path.join(evidence, `${prefix}-pull-3-new-mail.png`) });

  // Started away from the top, the same gesture only scrolls the list back up.
  if (await pane.evaluate(el => el.scrollHeight > el.clientHeight)) {
    await pane.evaluate(el => { el.scrollTop = 60; });
    syncs.length = 0;
    await touchPull(cdp, x, y0, 220);
    await expect(pane).toHaveAttribute("data-pull-state", "idle");
    await page.waitForTimeout(2000);
    expect(syncs).toHaveLength(0);
  }
});
