import { test, expect, type CDPSession, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// Swipe actions on phone list rows (390 px, touch), driven with real touch
// input through CDP:
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-mobile-swipe.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/mobile-swipe-evidence;
// MOBILE_SWIPE_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE", hasTouch: true });
const evidence = path.resolve(process.env.MOBILE_SWIPE_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "mobile-swipe-evidence"));

const mails = [
  { subject: "Wochenplan für das Team", from: "Synthetic Planner <planner@example.test>", seen: false },
  { subject: "Rechnung 2026-117 ist eingegangen", from: "Synthetic Billing <billing@example.test>", seen: true },
  { subject: "Einladung zum Sommerfest", from: "Synthetic Events <events@example.test>", seen: false },
  { subject: "Lieferstatus Ihrer Bestellung", from: "Synthetic Shop <shop@example.test>", seen: true }
];

test.beforeAll(async () => {
  for (const [index, mail] of mails.entries()) {
    const source = [
      `From: ${mail.from}`,
      "To: demo@monkeydent.test",
      `Message-ID: <qa-mobile-swipe-${index}@example.test>`,
      `Date: ${new Date(Date.now() + 3_600_000 - index * 60_000).toUTCString()}`,
      `Subject: =?UTF-8?B?${Buffer.from(mail.subject).toString("base64")}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      `Synthetischer Text für ${mail.subject}.`
    ].join("\r\n");
    const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, {
      method: "POST",
      body: JSON.stringify({ source, flags: mail.seen ? ["\\Seen"] : [] })
    });
    expect(response.ok).toBe(true);
  }
});

const rowFor = (page: Page, subject: string) =>
  page.locator('[data-message-list-row="true"]').filter({ hasText: subject });

async function touchDrag(cdp: CDPSession, row: Locator, fromRatio: number, toRatio: number, dy = 0) {
  await row.scrollIntoViewIfNeeded();
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width * fromRatio;
  const x1 = box.x + box.width * toRatio;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  const steps = 12;
  for (let step = 1; step <= steps; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x0 + ((x1 - x0) * step) / steps, y: y + (dy * step) / steps }]
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function tap(cdp: CDPSession, x: number, y: number) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("mobile swipe: reveal, full swipe and single open row at 390 px", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await signInQa(page);
  const first = rowFor(page, mails[0].subject);
  // The first sync of the fixture inbox can outlast one page load.
  await expect.poll(async () => {
    if (await rowFor(page, mails[3].subject).count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120000, intervals: [500] }).toBe(true);
  await expect(first).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const actions = page.locator("[data-swipe-actions]");

  await page.screenshot({ path: path.join(evidence, "swipe-390-closed.png") });

  // A vertical drag scrolls and neither swipes nor opens the message.
  await touchDrag(cdp, first, 0.5, 0.52, 120);
  await expect(actions).toHaveCount(0);
  await expect(first).toBeVisible();

  // Short left swipe: Mehr and Löschen.
  await touchDrag(cdp, first, 0.8, 0.45);
  await expect(page.getByRole("button", { name: "Löschen", exact: true }).last()).toBeVisible();
  await expect(page.locator('[data-swipe-action="more"]')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(evidence, "swipe-390-left-open.png") });

  // Mehr opens the row's existing message menu.
  await page.locator('[data-swipe-action="more"]').click();
  await expect(page.getByRole("menuitem", { name: "Archivieren", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(actions).toHaveCount(0);

  // Short right swipe on an unread row: Gelesen.
  const unread = rowFor(page, mails[2].subject);
  await touchDrag(cdp, unread, 0.1, 0.35);
  await expect(page.locator('[data-swipe-action="read"]')).toHaveText("Gelesen");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(evidence, "swipe-390-right-open.png") });

  // Opening another row closes the first: only one open row.
  const second = rowFor(page, mails[1].subject);
  await expect(second).toBeInViewport();
  await tap(cdp, 200, (await second.boundingBox())!.y + 10);
  await expect(actions).toHaveCount(0);
  await expect(second).toBeVisible();

  // Long right swipe toggles read; the next reveal offers Ungelesen.
  await touchDrag(cdp, unread, 0.05, 0.9);
  await expect(actions).toHaveCount(0);
  await expect.poll(async () => {
    await touchDrag(cdp, unread, 0.1, 0.35);
    const label = await page.locator('[data-swipe-action="read"]').textContent();
    // A touch on the open row closes it without opening the message.
    const box = (await unread.boundingBox())!;
    await tap(cdp, box.x + box.width - 20, box.y + box.height / 2);
    return label;
  }, { timeout: 15000, intervals: [500] }).toBe("Ungelesen");

  // Long left swipe deletes (moves to the trash) directly.
  const doomed = rowFor(page, mails[3].subject);
  await touchDrag(cdp, doomed, 0.95, 0.1);
  await expect(doomed).toHaveCount(0);
  await page.screenshot({ path: path.join(evidence, "swipe-390-after-delete.png") });
});
