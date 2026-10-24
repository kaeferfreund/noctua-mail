import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// Split reader: Expand sits in the subject row (no toolbar row of its own) and the
// compact/full icons are centred, desktop light/dark plus the phone back row:
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-reader-header-compact.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/reader-header-evidence;
// READER_HEADER_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE" });
const evidence = path.resolve(process.env.READER_HEADER_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "reader-header-evidence"));
const subject = "Synthetische Abstimmung zur Leseansicht";
const message = (n: number) => [
  `From: ${n % 2 ? "Demo Team <demo@monkeydent.test>" : "Synthetic Reader <reader@example.test>"}`,
  `To: ${n % 2 ? "reader@example.test" : "demo@monkeydent.test"}`,
  `Message-ID: <qa-reader-header-${n}@example.test>`,
  ...(n ? [`In-Reply-To: <qa-reader-header-${n - 1}@example.test>`,
    `References: ${Array.from({ length: n }, (_, i) => `<qa-reader-header-${i}@example.test>`).join(" ")}`] : []),
  `Date: ${new Date(Date.now() + 3_600_000 + n * 60_000).toUTCString()}`,
  `Subject: =?UTF-8?B?${Buffer.from(`${n ? "Re: " : ""}${subject}`).toString("base64")}?=`,
  "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "",
  `Synthetische Nachricht ${n + 1} im Verlauf.`
].join("\r\n");

test.beforeAll(async () => {
  for (const n of [0, 1, 2]) {
    const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, { method: "POST", body: JSON.stringify({ source: message(n), flags: ["\\Seen"] }) });
    expect(response.ok).toBe(true);
  }
});

async function openThread(page: Page) {
  const row = page.locator('[data-message-list-row="true"]').filter({ hasText: subject }).first();
  await expect.poll(async () => {
    if (await row.count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120000, intervals: [500] }).toBe(true);
  await row.click();
  await expect(page.getByRole("radio", { name: "Kompakt", exact: true }).first()).toBeAttached();
}

/** Icon centre minus item centre for every visible compact/full item, in px. */
async function iconOffsets(page: Page) {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".rt-SegmentedControlItem")]
    .filter(item => item.getBoundingClientRect().height > 0)
    .flatMap(item => {
      const box = item.getBoundingClientRect();
      return [...item.querySelectorAll("svg")].map(svg => {
        const icon = svg.getBoundingClientRect();
        return { dx: Math.round((icon.x + icon.width / 2 - (box.x + box.width / 2)) * 10) / 10,
          dy: Math.round((icon.y + icon.height / 2 - (box.y + box.height / 2)) * 10) / 10 };
      });
    }));
}

async function shot(page: Page, name: string, clipHeader = false) {
  mkdirSync(evidence, { recursive: true });
  const header = page.locator("#reader");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(evidence, name), ...(clipHeader ? { clip: (await header.boundingBox())! } : {}) });
}

test("split reader: Expand in the subject row, no toolbar row, centred toggle icons", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await signInQa(page);
  for (const scheme of ["light", "dark"] as const) {
    await page.evaluate(value => { localStorage.setItem("noctua:theme", value); }, scheme);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
    await openThread(page);
    const toolbar = page.locator("[data-reader-toolbar]");
    await expect(toolbar).toHaveAttribute("data-focus", "false");
    const expand = toolbar.getByRole("button", { name: "Vergrößern", exact: true });
    await expect(expand).toBeVisible();
    // The subject row holds subject, toggle and Expand; nothing sits above the thread header.
    const layout = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>("[data-reader-toolbar]")!;
      const row = bar.parentElement!;
      const pane = document.querySelector<HTMLElement>("[data-reader-print]")!;
      const firstVisible = [...pane.children].find(child => (child as HTMLElement).getBoundingClientRect().height > 0)!;
      const toggle = row.querySelector(".rt-SegmentedControlRoot")!.getBoundingClientRect();
      const button = bar.querySelector("button")!.getBoundingClientRect();
      return { inSubjectRow: row.contains(document.querySelector('[role="radio"]')), headerFirst: firstVisible.contains(bar),
        expandCentreDy: Math.round((button.y + button.height / 2) - (toggle.y + toggle.height / 2)),
        expandRightOfToggle: button.x > toggle.x + toggle.width, paneTop: Math.round(pane.getBoundingClientRect().top),
        headerTop: Math.round(firstVisible.getBoundingClientRect().top) };
    });
    console.log("reader-header", scheme, JSON.stringify(layout));
    expect(layout).toMatchObject({ inSubjectRow: true, headerFirst: true, expandRightOfToggle: true });
    expect(Math.abs(layout.expandCentreDy)).toBeLessThanOrEqual(2);
    expect(layout.headerTop).toBe(layout.paneTop);
    const offsets = await iconOffsets(page);
    console.log("reader-header icons", scheme, JSON.stringify(offsets));
    expect(offsets.length).toBeGreaterThanOrEqual(4);
    for (const { dx, dy } of offsets) { expect(Math.abs(dx)).toBeLessThanOrEqual(0.5); expect(Math.abs(dy)).toBeLessThanOrEqual(0.5); }
    if (scheme === "light") {
      // First selection shows the one-time tip under the subject row.
      await expect(page.locator("[data-reader-hint]")).toBeVisible();
      await shot(page, "desktop-1280-light-split-hint.png");
      await page.getByRole("button", { name: "Tipp zur Leseansicht schließen", exact: true }).click();
      await expect(page.locator("[data-reader-hint]")).toHaveCount(0);
    }
    await shot(page, `desktop-1280-${scheme}-split.png`);
    await shot(page, `desktop-1280-${scheme}-split-reader.png`, true);
  }
  // Focus layout keeps its full-width toolbar row, Expand becomes "Liste anzeigen" at its end.
  await page.locator("[data-reader-toolbar]").getByRole("button", { name: "Vergrößern", exact: true }).click();
  await expect(page.locator("[data-reader-toolbar]")).toHaveAttribute("data-focus", "true");
  await expect(page.locator("[data-reader-toolbar]").getByRole("button", { name: "Liste anzeigen", exact: true })).toBeVisible();
  await shot(page, "desktop-1280-dark-focus.png");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-reader-toolbar]")).toHaveAttribute("data-focus", "false");
});

test("phone reader: compact/full icons centred in the back row", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInQa(page);
  await page.evaluate(() => { localStorage.setItem("noctua:theme", "light"); });
  await page.goto("/");
  await openThread(page);
  await expect(page.locator("[data-reader-toolbar]")).toHaveCount(0);
  const offsets = await iconOffsets(page);
  console.log("reader-header icons phone", JSON.stringify(offsets));
  expect(offsets.length).toBeGreaterThanOrEqual(4);
  for (const { dx, dy } of offsets) { expect(Math.abs(dx)).toBeLessThanOrEqual(0.5); expect(Math.abs(dy)).toBeLessThanOrEqual(0.5); }
  await shot(page, "phone-390-light-reader.png");
});
