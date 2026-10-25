import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// Split reader: the compact/full toggle and Expand end the collaboration row (no
// toolbar row of their own, the subject keeps the full width) and the toggle icons
// are centred; desktop 1280 light/dark and 1024 plus the phone back row:
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-reader-header-compact.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/reader-header-evidence;
// READER_HEADER_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE" });
const evidence = path.resolve(process.env.READER_HEADER_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "reader-header-evidence"));
// Long enough to wrap onto two lines in the 1280 px split reader.
const subject = "Support-Anfrage von Synthetic Person (anfrage.person@praxis-beispiel.example.test) - Zahnarztpraxis Dr. Beispiel";
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

test("split reader: toggle and Expand end the collaboration row, subject uses the full width, centred icons", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await signInQa(page);
  for (const [width, scheme] of [[1280, "light"], [1280, "dark"], [1024, "light"]] as const) {
    await page.setViewportSize({ width, height: 860 });
    await page.evaluate(value => { localStorage.setItem("noctua:theme", value); }, scheme);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
    await openThread(page);
    const toolbar = page.locator("[data-reader-toolbar]");
    await expect(toolbar).toHaveAttribute("data-focus", "false");
    const expand = toolbar.getByRole("button", { name: "Vergrößern", exact: true });
    await expect(expand).toBeVisible();
    await expect(page.getByRole("button", { name: "Interne Notiz", exact: true })).toBeVisible();
    const layout = await page.evaluate(() => {
      const centre = (box: DOMRect) => box.y + box.height / 2;
      const bar = document.querySelector<HTMLElement>("[data-reader-toolbar]")!;
      const actions = bar.parentElement!;
      const collab = actions.closest<HTMLElement>("[aria-label]")!;
      const pane = document.querySelector<HTMLElement>("[data-reader-print]")!;
      const firstVisible = [...pane.children].find(child => (child as HTMLElement).getBoundingClientRect().height > 0)!;
      const toggle = actions.querySelector(".rt-SegmentedControlRoot")!.getBoundingClientRect();
      const button = bar.querySelector("button")!.getBoundingClientRect();
      const assignee = collab.querySelector("button")!.getBoundingClientRect();
      const subjectText = pane.querySelector<HTMLElement>("[data-expanded]")!;
      const subjectRow = subjectText.parentElement!.parentElement!;
      const header = subjectRow.parentElement!.getBoundingClientRect();
      return { collabLabel: collab.getAttribute("aria-label"), toggleInActions: actions.contains(document.querySelector('[role="radio"]')),
        subjectRowChildren: subjectRow.children.length, headerFirst: firstVisible.contains(bar),
        subjectWidthGap: Math.round(header.right - subjectText.getBoundingClientRect().right),
        subjectLines: Math.round(subjectText.getBoundingClientRect().height / parseFloat(getComputedStyle(subjectText).lineHeight)),
        expandVsToggleDy: Math.round(centre(button) - centre(toggle)), actionsVsAssigneeDy: Math.round(centre(toggle) - centre(assignee)),
        expandRightOfToggle: button.x > toggle.x + toggle.width, actionsRightGap: Math.round(header.right - button.right),
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    console.log("reader-header", width, scheme, JSON.stringify(layout));
    expect(layout).toMatchObject({ collabLabel: "Zusammenarbeit im Thread", toggleInActions: true, subjectRowChildren: 1,
      headerFirst: true, subjectWidthGap: 0, expandRightOfToggle: true, overflow: false });
    expect(Math.abs(layout.expandVsToggleDy)).toBeLessThanOrEqual(1);
    // Same line as assignee/status/notes, vertically centred with them.
    expect(Math.abs(layout.actionsVsAssigneeDy)).toBeLessThanOrEqual(1);
    if (width === 1280) expect(layout.subjectLines).toBe(2);
    const offsets = await iconOffsets(page);
    console.log("reader-header icons", width, scheme, JSON.stringify(offsets));
    expect(offsets.length).toBeGreaterThanOrEqual(4);
    for (const { dx, dy } of offsets) { expect(Math.abs(dx)).toBeLessThanOrEqual(0.5); expect(Math.abs(dy)).toBeLessThanOrEqual(0.5); }
    if (width === 1280 && scheme === "light") {
      // First selection shows the one-time tip under the subject row.
      await expect(page.locator("[data-reader-hint]")).toBeVisible();
      await shot(page, "desktop-1280-light-split-hint.png");
      await page.getByRole("button", { name: "Tipp zur Leseansicht schließen", exact: true }).click();
      await expect(page.locator("[data-reader-hint]")).toHaveCount(0);
    }
    await shot(page, `desktop-${width}-${scheme}-split.png`);
    await shot(page, `desktop-${width}-${scheme}-split-reader.png`, true);
  }
  // Focus layout keeps its full-width toolbar row and the toggle in the subject row.
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.locator("[data-reader-toolbar]").getByRole("button", { name: "Vergrößern", exact: true }).click();
  await expect(page.locator("[data-reader-toolbar]")).toHaveAttribute("data-focus", "true");
  await expect(page.locator("[data-reader-toolbar]").getByRole("button", { name: "Liste anzeigen", exact: true })).toBeVisible();
  await expect(page.getByLabel("Zusammenarbeit im Thread").getByRole("radio")).toHaveCount(0);
  await shot(page, "desktop-1280-light-focus.png");
  await page.keyboard.press("Shift+Enter");
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
