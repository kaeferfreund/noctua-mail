import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// Mail text in the app font: plain-text mails, the Markdown and Text compose
// editors, and HTML mails without their own font; HTML mails with their own
// font (Georgia inline on <body> or in a <style> rule) keep it. 1280 and 390 px:
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-mail-body-font.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/mail-body-font-evidence;
// MAIL_BODY_FONT_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE" });
const evidence = path.resolve(process.env.MAIL_BODY_FONT_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "mail-body-font-evidence"));
const subjects = {
  text: "Schrift-Test Klartext",
  html: "Schrift-Test HTML ohne eigene Schrift",
  georgiaInline: "Schrift-Test HTML mit Georgia (inline)",
  georgiaStyle: "Schrift-Test HTML mit Georgia (style)"
} as const;
const plainBody = [
  "Hallo Alex,",
  "",
  "vielen Dank für die Unterlagen. Für Donnerstag habe ich die folgenden Punkte notiert:",
  "",
  "  - Prophylaxe-Termine für November abstimmen",
  "  - Laborauftrag 4711 nachfragen",
  "  - Rechnung an praxis-kunde@example.test schicken",
  "",
  "Ein längerer Absatz zeigt, wie der Text im Leser umbricht, wenn eine Zeile breiter ist als der verfügbare Platz im Lesebereich.",
  "",
  "Viele Grüße",
  "Toni Muster"
].join("\n");
const htmlBody = "<p>Hallo Alex,</p><p>diese synthetische HTML-Mail bringt keine eigene Schrift mit und erscheint deshalb in der App-Schrift.</p><p>Viele Grüße<br>Toni Muster</p>";
const georgiaParagraphs = "<p>Hallo Alex,</p><p>diese synthetische HTML-Mail setzt Georgia und behält ihre Schrift.</p><p>Viele Grüße<br>Toni Muster</p>";

function message(id: string, subject: string, contentType: string, body: string, minutes: number) {
  return [
    "From: Toni Muster <toni.muster@example.test>",
    "To: demo@monkeydent.test",
    `Message-ID: <qa-mail-body-font-${id}@example.test>`,
    `Date: ${new Date(Date.now() + 3_600_000 + minutes * 60_000).toUTCString()}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0", `Content-Type: ${contentType}; charset=utf-8`, "Content-Transfer-Encoding: 8bit", "",
    body
  ].join("\r\n");
}

test.beforeAll(async () => {
  const sources = [
    message("text", subjects.text, "text/plain", plainBody.replaceAll("\n", "\r\n"), 4),
    message("html", subjects.html, "text/html", `<html><body>${htmlBody}</body></html>`, 3),
    message("georgia-inline", subjects.georgiaInline, "text/html",
      `<html><body style="font-family: Georgia, serif">${georgiaParagraphs}</body></html>`, 2),
    message("georgia-style", subjects.georgiaStyle, "text/html",
      `<html><head><style>body { font-family: Georgia, serif; }</style></head><body>${georgiaParagraphs}</body></html>`, 1)
  ];
  for (const source of sources) {
    const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, { method: "POST", body: JSON.stringify({ source, flags: ["\\Seen"] }) });
    expect(response.ok).toBe(true);
  }
});

async function openMail(page: Page, subject: string) {
  const row = page.locator('[data-message-list-row="true"]').filter({ hasText: subject }).first();
  await expect.poll(async () => {
    if (await row.count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120000, intervals: [500] }).toBe(true);
  await row.click();
}

/** Computed font of the nearest pre-wrap box around `text` (the plain-text view). */
async function plainTextFont(page: Page, text: string) {
  return page.evaluate((needle) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.includes(needle)) continue;
      for (let element = node.parentElement; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (style.whiteSpace === "pre-wrap") return { fontFamily: style.fontFamily, fontSize: style.fontSize };
      }
    }
    return null;
  }, text);
}

/** Computed font of the first paragraph in the sandboxed HTML mail frame. */
async function htmlParagraphFont(page: Page) {
  await expect.poll(() => page.frames().some(item => item !== page.mainFrame() && item.url() === "about:srcdoc")).toBe(true);
  const frame = page.frames().find(item => item !== page.mainFrame() && item.url() === "about:srcdoc")!;
  return frame.evaluate(() => getComputedStyle(document.querySelector("p")!).fontFamily);
}

async function shot(page: Page, name: string) {
  mkdirSync(evidence, { recursive: true });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: path.join(evidence, name) });
}

const viewports = [{ width: 1280, height: 860, tag: "1280" }, { width: 390, height: 844, tag: "390" }] as const;

test("reader: plain-text and HTML mails without own font use the app font, Georgia stays Georgia", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 860 });
  await signInQa(page);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await openMail(page, subjects.text);
    await expect(page.getByText("Prophylaxe-Termine für November", { exact: false }).first()).toBeVisible();
    const plain = await plainTextFont(page, "Prophylaxe-Termine für November");
    expect(plain?.fontFamily).toContain("-apple-system");
    expect(plain?.fontFamily).not.toContain("monospace");
    expect(plain?.fontSize).toBe("15px");
    await shot(page, `reader-plaintext-${viewport.tag}.png`);

    for (const [key, expected] of [["html", "-apple-system"], ["georgiaInline", "Georgia"], ["georgiaStyle", "Georgia"]] as const) {
      await page.goto("/");
      await openMail(page, subjects[key]);
      await page.waitForTimeout(800);
      expect(await htmlParagraphFont(page), key).toContain(expected);
      await shot(page, `reader-${key === "html" ? "html-app-font" : key === "georgiaInline" ? "html-georgia-inline" : "html-georgia-style"}-${viewport.tag}.png`);
    }
  }
});

for (const viewport of viewports) {
  test(`compose at ${viewport.tag} px: Markdown and Text editors write in the app font`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize(viewport);
    await signInQa(page);
    // Phones reach „Neue E-Mail“ through the sidebar sheet.
    if (viewport.width < 768) await page.getByRole("button", { name: "Seitenleiste umschalten", exact: true }).click();
    await page.getByRole("button", { name: "Neue E-Mail", exact: true }).first().click();
    await page.getByRole("tab", { name: "Markdown", exact: true }).click();
    const markdownInput = page.locator(".w-md-editor-text-input");
    await expect(markdownInput).toBeVisible();
    await markdownInput.fill("Hallo Alex,\n\nhier die **Termine** für November:\n\n- Montag 9:00\n- Donnerstag 14:30\n\nViele Grüße\nToni");
    const markdownFont = await markdownInput.evaluate(element => getComputedStyle(element).fontFamily);
    expect(markdownFont).toContain("-apple-system");
    expect(markdownFont).not.toContain("monospace");
    await shot(page, `compose-markdown-${viewport.tag}.png`);

    await page.getByRole("tab", { name: "Text", exact: true }).click();
    const textInput = page.locator("textarea").filter({ hasText: "Termine" }).first();
    await expect(textInput).toBeVisible();
    const textFont = await textInput.evaluate(element => getComputedStyle(element).fontFamily);
    expect(textFont).toContain("-apple-system");
    expect(textFont).not.toContain("monospace");
    await shot(page, `compose-text-${viewport.tag}.png`);
  });
}
