import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// Opened HTML mail with blocked remote content and the collaboration bar on
// phones (390 / 360 px) and desktop (1280 px), light and dark, plus the
// 1440 px light reference:
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
// A sender address longer than a phone row: it must truncate, not break mid-word.
const senderEmail = "kundenservice.benachrichtigungen@mail.example.test";
const source = [
  `From: Synthetic Broker <${senderEmail}>`,
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
    // The message card's own actions (Reply … Delete), next to its Delete button.
    const actions = [...document.querySelectorAll<HTMLElement>('[data-message-action="delete"]')]
      .find(item => item.getBoundingClientRect().height > 0)?.parentElement;
    const address = [...document.querySelectorAll<HTMLElement>('button[title*="<"]')]
      .find(item => item.getBoundingClientRect().height > 0);
    const email = address?.lastElementChild as HTMLElement | undefined;
    return {
      bannerTop: top('[data-mail-print="body"] [role="status"]'),
      bodyTop: top('[data-mail-print="body"] iframe'),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      actionTargets: [...actions?.querySelectorAll("button") ?? []].map(button => {
        const box = button.getBoundingClientRect();
        return { name: button.getAttribute("aria-label"), width: Math.round(box.width), height: Math.round(box.height) };
      }),
      address: email ? {
        title: address!.title,
        lineHeight: parseFloat(getComputedStyle(email).lineHeight),
        height: email.getBoundingClientRect().height,
        truncated: email.scrollWidth > email.clientWidth,
        insideCard: email.getBoundingClientRect().right <= innerWidth
      } : null
    };
  });
}

/** Relative luminance of the HTML body's text inside the sandboxed mail frame. */
async function bodyTextLuminance(page: Page) {
  const frame = page.frames().find(item => item !== page.mainFrame() && item.url() === "about:srcdoc");
  const color = await frame!.evaluate(() => getComputedStyle(document.querySelector("p")!).color);
  const [r, g, b] = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return { color, luminance: 0.2126 * r + 0.7152 * g + 0.0722 * b };
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
  const runs = [{ width: 390, height: 844 }, { width: 360, height: 740 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]
    .map(viewport => ({ viewport, schemes: viewport.width === 1440 ? ["light"] as const : ["dark", "light"] as const }));
  for (const { viewport, schemes } of runs) {
    for (const scheme of schemes) {
      await page.setViewportSize(viewport);
      await page.evaluate(value => { localStorage.setItem("noctua:theme", value); }, scheme);
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(new RegExp(scheme));
      await openMail(page);
      // Let the sandboxed HTML frame settle its measured height.
      await page.waitForTimeout(800);
      const result = { ...viewport, scheme, ...await measure(page), bodyText: await bodyTextLuminance(page) };
      results.push(result);
      await page.screenshot({ path: path.join(evidence, `${prefix}-${viewport.width}-${scheme}.png`) });
      expect(result.horizontalOverflow).toBe(false);
      // Plain HTML mails take the theme's text colour (light text on the dark card).
      if (scheme === "dark") expect(result.bodyText.luminance).toBeGreaterThan(0.6);
      else expect(result.bodyText.luminance).toBeLessThan(0.05);
      if (viewport.width < 768) {
        expect(result.actionTargets.map(target => target.name)).toEqual(["Antworten", "Allen antworten", "Weiterleiten", "Ähnliche suchen", "Löschen"]);
        for (const target of result.actionTargets) {
          expect(target.width, target.name!).toBeGreaterThanOrEqual(40);
          expect(target.height, target.name!).toBeGreaterThanOrEqual(40);
        }
        // One truncated line inside the card; the trigger's title keeps the full address.
        expect(result.address).toMatchObject({ truncated: true, insideCard: true });
        expect(result.address!.height).toBeLessThanOrEqual(result.address!.lineHeight * 1.5);
        expect(result.address!.title).toBe(`Synthetic Broker <${senderEmail}>`);
      }
      if (process.env.MOBILE_READER_ASSERT_BODY === "1" && viewport.width === 390) {
        expect(result.bodyTop).not.toBeNull();
        expect(result.bodyTop!).toBeLessThan(viewport.height * 0.45);
      }
    }
  }
  writeFileSync(path.join(evidence, `${prefix}.json`), JSON.stringify(results, null, 2));
  console.log("mobile-reader", JSON.stringify(results));
});
