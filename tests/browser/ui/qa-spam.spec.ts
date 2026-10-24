import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// Spam detection screens (badge in list and reader, "Verdächtig" view, admin
// and mailbox settings) at 1280 px and 390 px, with synthetic data only:
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-spam.spec.ts bun scripts/runQaShellBrowserTests.ts
// No model is called: a safe static deny rule for a synthetic domain marks the
// messages through the real sync → sweep → classifier pipeline.
// Evidence defaults to <checkout>/.tmp/spam-evidence; SPAM_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE" });
const evidence = path.resolve(process.env.SPAM_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "spam-evidence"));
const spamSubject = "Sie haben einen Gutschein über 500 € gewonnen";

function source(id: string, from: string, subject: string, text: string, offsetMs: number) {
  return [
    `From: ${from}`, "To: demo@monkeydent.test", `Message-ID: <${id}@example.test>`,
    `Date: ${new Date(Date.now() + offsetMs).toUTCString()}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "X-Spam-Flag: YES", "X-Spam-Status: Yes, score=8.2", "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", text
  ].join("\r\n");
}

test.beforeAll(async () => {
  // Default rules location of the isolated QA data dir.
  writeFileSync(path.join(process.env.NOCTUA_DATA_DIR!, "spam-static-rules.json"), JSON.stringify({
    version: 1, allow: [], hints: [],
    deny: [{ type: "domain", value: "gewinn.example.test", safe: true, spamHits: 9, hamHits: 0, note: "synthetic" }]
  }));
  for (const [id, from, subject, text, offset] of [
    ["qa-spam-1", "Gewinnspiel-Team <promo@gewinn.example.test>", spamSubject, "Klicken Sie hier, um Ihren Gewinn abzuholen.", 3_600_000],
    ["qa-spam-2", "Gutschein Service <service@mx.gewinn.example.test>", "Letzte Erinnerung: Ihr Gewinn verfällt heute", "Nur noch heute einlösbar.", 3_500_000],
    ["qa-ham-1", "Synthetic Praxis <termine@example.test>", "Terminbestätigung für Dienstag", "Ihr Termin am Dienstag um 10 Uhr ist bestätigt.", 3_400_000]
  ] as const) {
    const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, { method: "POST", body: JSON.stringify({ source: source(id, from, subject, text, offset) }) });
    expect(response.ok).toBe(true);
  }
});

async function enableSpamDetection(page: Page) {
  const origin = new URL(page.url()).origin;
  const result = await page.request.put("/api/admin/spam-settings", { data: { enabled: true }, headers: { origin } });
  expect(result.status()).toBe(200);
}

async function waitForMarks(page: Page) {
  await expect.poll(async () => {
    const response = await page.request.get("/api/accounts/qa-shared/messages?page=1&pageSize=5&groupBy=date&searchScope=all&badges=suspicious");
    const total = response.ok() ? (await response.json()).total : 0;
    if (total >= 2) return total;
    await page.goto("/");
    await page.waitForTimeout(3000);
    return total;
  }, { timeout: 180000, intervals: [1000] }).toBeGreaterThanOrEqual(2);
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(evidence, `${name}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}

test("spam detection screens at desktop and phone width", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await signInQa(page);
  await enableSpamDetection(page);
  await waitForMarks(page);

  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const suffix = String(viewport.width);
    await page.setViewportSize(viewport);
    await page.goto("/");
    const row = page.locator('[data-message-list-row="true"]').filter({ hasText: spamSubject });
    await expect(row).toBeVisible({ timeout: 60000 });
    await expect(row.locator("[data-spam-badge]")).toHaveAttribute("title", /Verdächtig: /);
    await expect(row.locator("[data-spam-badge]")).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    await shot(page, `spam-list-${suffix}`);

    await row.click();
    const reader = page.locator("article").filter({ hasText: "Klicken Sie hier" });
    await expect(reader.locator("[data-spam-badge]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kein Spam", exact: true })).toBeVisible();
    await shot(page, `spam-reader-${suffix}`);

    await page.goto("/?view=virtual%3Asuspicious");
    await expect(page.locator('[data-message-list-row="true"]').filter({ hasText: "Terminbestätigung" })).toHaveCount(0);
    await expect(page.locator('[data-message-list-row="true"]').filter({ hasText: spamSubject }).locator("[data-spam-badge]")).toBeVisible();
    if (viewport.width >= 768) await expect(page.locator('[data-view-id="virtual:suspicious"]')).toBeVisible();
    await shot(page, `spam-view-${suffix}`);

    await page.goto("/?admin=spam");
    await expect(page.getByText("Spam-Erkennung eingeschaltet")).toBeVisible();
    await shot(page, `spam-admin-settings-${suffix}`);

    await page.goto("/?settings=spam");
    await expect(page.getByText("Spam-Erkennung für dieses Postfach")).toBeVisible();
    await shot(page, `spam-mailbox-settings-${suffix}`);
  }
});
