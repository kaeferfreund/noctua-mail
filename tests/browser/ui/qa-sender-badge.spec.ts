import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// "Nicht bestätigt" badge in the reader, desktop (1280 px) and phone (390 px):
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-sender-badge.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/sender-badge-evidence;
// SENDER_BADGE_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE" });
const evidence = path.resolve(process.env.SENDER_BADGE_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "sender-badge-evidence"));
const received = `Received: from relay.example.net by mx.example.test with ESMTPS; ${new Date().toUTCString()}`;
const mail = (subject: string, from: string, minutes: number, authenticationResults?: string) => [
  received,
  ...(authenticationResults ? [`Authentication-Results: mx.example.test; ${authenticationResults}`] : []),
  `From: ${from}`,
  "To: demo@demo-praxis.test",
  `Message-ID: <qa-sender-badge-${minutes}@example.test>`,
  `Date: ${new Date(Date.now() + minutes * 60_000).toUTCString()}`,
  `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
  "MIME-Version: 1.0",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Synthetischer Inhalt für die Absenderprüfung."
].join("\r\n");
const unverified = { subject: "Ihre Rechnung ist bereit (ohne Absenderprüfung)", from: "Synthetic Billing <billing@shop.example.test>" };
const verified = { subject: "Versandbestätigung (Absender bestätigt)", from: "Synthetic Shop <shop@shop.example.test>" };

test.beforeAll(async () => {
  for (const item of [mail(unverified.subject, unverified.from, 90), mail(verified.subject, verified.from, 80, "dkim=pass header.d=shop.example.test; spf=pass smtp.mailfrom=shop.example.test")]) {
    const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, { method: "POST", body: JSON.stringify({ source: item, flags: ["\\Seen"] }) });
    expect(response.ok).toBe(true);
  }
});

async function open(page: Page, subject: string) {
  const row = page.locator('[data-message-list-row="true"]').filter({ hasText: subject });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("combobox", { name: "Zuständig", exact: true })).toBeVisible();
  await expect(page.getByText("Synthetischer Inhalt für die Absenderprüfung.").first()).toBeVisible();
}

test("reader shows Nicht bestätigt only for an unverified sender", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await signInQa(page);
  const row = page.locator('[data-message-list-row="true"]').filter({ hasText: unverified.subject });
  await expect.poll(async () => {
    if (await row.count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120000, intervals: [500] }).toBe(true);
  const badge = page.locator("[data-unverified-sender-badge]").filter({ visible: true });
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    for (const scheme of ["light", "dark"] as const) {
      await page.setViewportSize(viewport);
      await page.evaluate(value => { localStorage.setItem("noctua:theme", value); }, scheme);
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
      await open(page, unverified.subject);
      await expect(badge).toHaveCount(1);
      await expect(badge).toHaveText("Nicht bestätigt");
      await expect(badge).toHaveAttribute("aria-label", /weder SPF noch DKIM/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.screenshot({ path: path.join(evidence, `unverified-${viewport.width}-${scheme}.png`) });
      if (scheme === "light") {
        await page.goto("/");
        await open(page, verified.subject);
        await expect(badge).toHaveCount(0);
        await page.screenshot({ path: path.join(evidence, `verified-${viewport.width}-${scheme}.png`) });
      }
    }
  }
});
