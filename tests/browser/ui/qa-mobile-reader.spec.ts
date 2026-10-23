import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// Opened HTML mail with blocked remote content and the collaboration bar on
// phones (390 / 360 px, light and dark) plus one desktop reference:
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-mobile-reader.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/mobile-reader-evidence;
// MOBILE_READER_EVIDENCE_DIR redirects it, MOBILE_READER_PREFIX names the files.
test.use({ locale: "de-DE" });
const evidence = path.resolve(process.env.MOBILE_READER_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "mobile-reader-evidence"));
const prefix = process.env.MOBILE_READER_PREFIX ?? "mobile-reader";
const subject = "Swap-Punkte für die kommende Handelswoche";
const html = `<html><body><img src="https://images.example.test/logo.png" width="32" height="32" alt="">
<h1>Swap-Punkte | KW 44</h1><p>Liebe Kundin, lieber Kunde,</p>
${Array.from({ length: 12 }, (_, n) => `<p>Synthetischer Absatz ${n + 1} für die mobile Leseansicht.</p>`).join("\n")}
</body></html>`;
const source = [
  "From: Synthetic Broker <support@mail.example.test>",
  "To: demo@monkeydent.test",
  "Message-ID: <qa-mobile-reader@example.test>",
  `Date: ${new Date(Date.now() + 3_600_000).toUTCString()}`,
  `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
  "MIME-Version: 1.0",
  "Content-Type: text/html; charset=utf-8",
  "Content-Transfer-Encoding: 8bit",
  "",
  html
].join("\r\n");

test.beforeAll(async () => {
  const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, { method: "POST", body: JSON.stringify({ source, flags: ["\\Seen"] }) });
  expect(response.ok).toBe(true);
});

async function openMail(page: Page) {
  const row = page.locator('[data-message-list-row="true"]').filter({ hasText: subject });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("status").filter({ hasText: "Externe Inhalte blockiert" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Zuständig", exact: true })).toBeVisible();
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const top = (selector: string) => {
      const element = [...document.querySelectorAll<HTMLElement>(selector)].find(item => item.getBoundingClientRect().height > 0);
      return element ? Math.round(element.getBoundingClientRect().top) : null;
    };
    return {
      bannerTop: top('[data-mail-print="body"] [role="status"]'),
      bodyTop: top('[data-mail-print="body"] iframe'),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
}

test("mobile reader: compact header rows leave room for the mail body", async ({ page }) => {
  const results: Record<string, unknown>[] = [];
  mkdirSync(evidence, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await signInQa(page);
  // The first sync of the fixture inbox can outlast one page load.
  const row = page.locator('[data-message-list-row="true"]').filter({ hasText: subject });
  await expect.poll(async () => {
    if (await row.count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120000, intervals: [500] }).toBe(true);
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 1440, height: 900 }]) {
    for (const scheme of viewport.width > 768 ? ["light"] as const : ["dark", "light"] as const) {
      await page.setViewportSize(viewport);
      await page.evaluate(value => { localStorage.setItem("noctua:theme", value); }, scheme);
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
      await openMail(page);
      // Let the sandboxed HTML frame settle its measured height.
      await page.waitForTimeout(800);
      const result = { ...viewport, scheme, ...await measure(page) };
      results.push(result);
      await page.screenshot({ path: path.join(evidence, `${prefix}-${viewport.width}-${scheme}.png`) });
      expect(result.horizontalOverflow).toBe(false);
      if (process.env.MOBILE_READER_ASSERT_BODY === "1" && viewport.width === 390) {
        expect(result.bodyTop).not.toBeNull();
        expect(result.bodyTop!).toBeLessThan(viewport.height * 0.45);
      }
    }
  }
  writeFileSync(path.join(evidence, `${prefix}.json`), JSON.stringify(results, null, 2));
  console.log("mobile-reader", JSON.stringify(results));
});
