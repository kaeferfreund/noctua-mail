import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// „Posteingang jetzt prüfen“ (doc/SPAM-DETECTION.md) at 1280 px and 390 px, synthetic data only:
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-spam-rescan.spec.ts bun scripts/runQaShellBrowserTests.ts
// No model is called (no API key: the model step shows as unavailable). The server-flag
// stage runs for real on injected mail; the progress view, the activity panel and a list
// with model hits use synthetic responses of the same routes.
// Evidence defaults to <checkout>/.tmp/spam-rescan-evidence; SPAM_RESCAN_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE" });
const evidence = path.resolve(process.env.SPAM_RESCAN_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "spam-rescan-evidence"));
const DAY = 24 * 60 * 60_000;
const rescanUrl = "/api/admin/accounts/qa-shared/spam-rescan";
const isRescanState = (url: URL) => url.pathname === rescanUrl;

function source(id: string, from: string, subject: string, ageDays: number, flagged: boolean) {
  return [
    `From: ${from}`, "To: demo@monkeydent.test", `Message-ID: <${id}@example.test>`,
    `Date: ${new Date(Date.now() - ageDays * DAY).toUTCString()}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    ...(flagged ? ["X-Spam-Flag: YES", "X-Spam-Status: Yes, score=8.2"] : []),
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", "Synthetischer Inhalt."
  ].join("\r\n");
}

const injected: Array<[string, string, string, number, boolean, string[]]> = [
  ["qa-rescan-1", "Gewinnspiel-Team <promo@gewinn.example.invalid>", "Sie haben einen Gutschein über 500 € gewonnen", 10, true, []],
  ["qa-rescan-2", "Paket Service <info@zustellung.example.invalid>", "Ihr Paket wartet: Zollgebühr offen", 20, true, []],
  ["qa-rescan-3", "Kryptoclub <club@rendite.example.invalid>", "Verdoppeln Sie Ihr Erspartes in 7 Tagen", 45, true, []],
  // Kept by the conservative rules: answered, a known sender, too young for the scan (the sweep's window).
  ["qa-rescan-4", "Verein <kasse@verein.example.invalid>", "Beitragsrechnung 2026", 12, true, ["\\Answered"]],
  ["qa-rescan-5", "Shop Newsletter <news@shop.example.invalid>", "Herbstangebote im Shop", 15, true, []],
  ["qa-rescan-6", "Shop Newsletter <news@shop.example.invalid>", "Ihre Bestellung ist unterwegs", 30, false, []],
  ["qa-rescan-7", "Shop Newsletter <news@shop.example.invalid>", "Rechnung zu Ihrer Bestellung", 31, false, []],
  ["qa-rescan-8", "Lotterie <ziehung@lotto.example.invalid>", "Letzte Chance auf den Jackpot", 1, true, []]
];

test.beforeAll(async () => {
  for (const [id, from, subject, age, flagged, flags] of injected) {
    const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, { method: "POST", body: JSON.stringify({ source: source(id, from, subject, age, flagged), flags }) });
    expect(response.ok).toBe(true);
  }
});

async function shot(page: Page, name: string, locator?: ReturnType<Page["locator"]>) {
  await page.waitForTimeout(500);
  if (locator) await locator.screenshot({ path: path.join(evidence, `${name}.png`) });
  else await page.screenshot({ path: path.join(evidence, `${name}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}

async function waitForSyncedInbox(page: Page) {
  const status = await (await fetch(`${process.env.QA_SHELL_CONTROL_URL}/status`)).json() as Array<{ path: string; messages: number }>;
  const expected = status.find((box) => box.path === "INBOX")!.messages;
  await expect.poll(async () => {
    const response = await page.request.get(`${rescanUrl}?period=all`);
    const rows = response.ok() ? (await response.json()).preview.inboxRows as number : 0;
    if (rows < expected) { await page.goto("/"); await page.waitForTimeout(3000); }
    return rows;
  }, { timeout: 180000, intervals: [1000] }).toBeGreaterThanOrEqual(expected);
}

async function openPanel(page: Page) {
  await page.goto("/?admin=spam");
  await page.getByRole("button", { name: "Posteingang von demo@monkeydent.test prüfen" }).click();
  return page.getByRole("listitem").filter({ has: page.getByText("demo@monkeydent.test", { exact: true }) });
}

const mixedJob = {
  id: "synthetic-job", accountId: "qa-shared", status: "ready", period: "30d", withModel: true, modelLimit: 40, phase: null, processed: 0, total: 0,
  counts: { inboxRows: 120, serverFlagged: 4, serverFlagSelected: 2, serverFlagExcluded: { answered: 1, "sender-history": 1 }, modelChecked: 40, modelCalls: 31, classifierMarked: 2, items: 4 },
  error: null, createdByUserId: "synthetic", createdAt: Date.now() - 5 * 60_000, updatedAt: Date.now(), finishedAt: Date.now()
};
const mixedItems = [
  { id: "s1", from: "Gewinnspiel-Team <promo@gewinn.example.invalid>", subject: "Sie haben einen Gutschein über 500 € gewonnen", date: "", dateValue: Date.now() - 2 * DAY, stage: "server-flag", reasons: [], score: 8.2, moveStatus: null },
  { id: "s2", from: "Paket Service <info@zustellung.example.invalid>", subject: "Ihr Paket wartet: Zollgebühr offen", date: "", dateValue: Date.now() - 6 * DAY, stage: "server-flag", reasons: [], score: 11.4, moveStatus: null },
  { id: "c1", from: "Konto-Sicherheit <alert@bank-verify.example.invalid>", subject: "Ihr Konto wird heute gesperrt – jetzt bestätigen", date: "", dateValue: Date.now() - 9 * DAY, stage: "classifier", reasons: ["Dringlichkeit und Drohung", "Link auf fremde Domain"], score: 0.96, moveStatus: null },
  { id: "c2", from: "Gewinnzentrale <win@prize.example.invalid>", subject: "Glückwunsch! Ihr iPhone wartet", date: "", dateValue: Date.now() - 14 * DAY, stage: "classifier", reasons: ["Gewinnversprechen ohne Teilnahme"], score: 0.91, moveStatus: null }
];
const preview30 = { period: "30d", inboxRows: 120, unchecked: 40, modelLimit: 40, modelBlocked: null, hasJunkFolder: true };

test("admin INBOX rescan at desktop and phone width", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  const measurements: Record<string, unknown> = {};
  await page.setViewportSize({ width: 1280, height: 900 });
  await signInQa(page);
  // On like in production; without an API key the sweep and the model step leave mail unchecked.
  const enabled = await page.request.put("/api/admin/spam-settings", { data: { enabled: true }, headers: { origin: new URL(page.url()).origin } });
  expect(enabled.status()).toBe(200);
  await waitForSyncedInbox(page);

  // 1. Setup: counts per period, model step unavailable without an API key.
  let panel = await openPanel(page);
  await expect(panel.getByText(/Mails im Posteingang in diesem Zeitraum/)).toBeVisible();
  await panel.getByLabel("Alles").check();
  await expect(panel.getByText(/kein API-Schlüssel/)).toBeVisible();
  await shot(page, "setup-1280");
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.scrollIntoViewIfNeeded();
  await shot(page, "setup-390");

  // 2. The real server-flag stage: three selected, the answered, known-sender and young one kept.
  await page.setViewportSize({ width: 1280, height: 900 });
  await panel.getByRole("button", { name: "Prüfung starten" }).click();
  const list = panel.getByRole("list", { name: "Treffer" });
  await expect(list).toBeVisible({ timeout: 60000 });
  await expect(list.getByRole("checkbox")).toHaveCount(3);
  await expect(panel.getByText(/^Vom Server markiert: 6, davon 3 aus Schutzgründen im Posteingang behalten/)).toBeVisible();
  for (const subject of ["Sie haben einen Gutschein über 500 € gewonnen", "Ihr Paket wartet: Zollgebühr offen", "Verdoppeln Sie Ihr Erspartes in 7 Tagen"]) {
    await expect(list.getByText(subject)).toBeVisible();
  }
  await list.scrollIntoViewIfNeeded();
  await shot(page, "result-1280");
  await page.setViewportSize({ width: 390, height: 844 });
  await list.scrollIntoViewIfNeeded();
  await shot(page, "result-390");
  measurements.result390 = await panel.evaluate((element) => ({
    buttons: [...element.querySelectorAll("button")].map((button) => ({ text: button.textContent, width: Math.round(button.getBoundingClientRect().width), height: Math.round(button.getBoundingClientRect().height) })),
    listScrolls: getComputedStyle(element.querySelector("ul[aria-label]")!).overflowY
  }));

  // 3. Move all but one: through the IMAP fixture into Junk, the deselected one stays.
  await list.getByLabel("„Verdoppeln Sie Ihr Erspartes in 7 Tagen“ auswählen").uncheck();
  await panel.getByRole("button", { name: "Ausgewählte verschieben (2)" }).click();
  await expect(panel.getByText("2 verschoben, 0 nicht mehr im Posteingang, 0 geändert und behalten, 0 Fehler.")).toBeVisible({ timeout: 60000 });
  await expect(list.getByText("Verschoben")).toHaveCount(2);
  await shot(page, "moved-390");
  await page.setViewportSize({ width: 1280, height: 900 });
  await list.scrollIntoViewIfNeeded();
  await shot(page, "moved-1280");
  const status = await (await fetch(`${process.env.QA_SHELL_CONTROL_URL}/status`)).json() as Array<{ path: string; messages: number }>;
  measurements.imapAfterMove = status.filter((box) => box.path === "INBOX" || box.path === "Junk");

  // 4. Synthetic responses: a list with model hits, the progress view and the activity panel.
  await page.route(isRescanState, (route) => route.fulfill({ json: { ok: true, preview: preview30, job: mixedJob, items: mixedItems } }));
  panel = await openPanel(page);
  await expect(panel.getByText("Ihr Konto wird heute gesperrt – jetzt bestätigen")).toBeVisible();
  await panel.getByRole("list", { name: "Treffer" }).scrollIntoViewIfNeeded();
  await shot(page, "mixed-1280");
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.getByRole("list", { name: "Treffer" }).scrollIntoViewIfNeeded();
  await shot(page, "mixed-390");

  const running = { ...mixedJob, status: "running", phase: "classifier", processed: 12, total: 40, counts: { inboxRows: 120 } };
  await page.unroute(isRescanState);
  await page.route(isRescanState, (route) => route.fulfill({ json: { ok: true, preview: preview30, job: running, items: [] } }));
  await page.route((url) => url.pathname === "/api/admin/spam-rescan", (route) => route.fulfill({ json: { ok: true, jobs: [{ id: running.id, accountId: "qa-shared", mailbox: "QA Shared",
    status: "running", phase: "classifier", processed: 12, total: 40, updatedAt: Date.now() }] } }));
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    panel = await openPanel(page);
    await expect(panel.getByText("Filter-Prüfung mit Modell")).toBeVisible();
    await shot(page, `progress-${viewport.width}`);
    await page.goto("/");
    await page.getByRole("button", { name: /Synchronisiert|Aktivität und Kalender/ }).first().click();
    if (viewport.width < 768) await page.getByRole("menuitem", { name: "Hintergrundaufgaben" }).click();
    await expect(page.getByText("Spam-Prüfung: QA Shared")).toBeVisible();
    await expect(page.getByRole("button", { name: "Prüfung abbrechen" })).toBeVisible();
    await shot(page, `activity-${viewport.width}`);
  }
  writeFileSync(path.join(evidence, "measurements.json"), JSON.stringify(measurements, null, 2));
});
