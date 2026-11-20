import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { signInQa } from "./qaRound2Session";

// Previews in the iOS home-screen app (display: standalone): a window opened
// there has no browser chrome and no way back, so attachment and HTML previews
// open inside the app with a close button below the status bar. Chromium cannot
// emulate the home-screen app or env(safe-area-inset-*): the tests set
// navigator.standalone and the --sat/--sab tokens (47 px notch, 34 px home
// indicator) before the app loads.
//   QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-pwa-preview.spec.ts \
//     bun scripts/runQaShellBrowserTests.ts
// Evidence defaults to the untracked <checkout>/.tmp/pwa-preview-evidence;
// PWA_PREVIEW_EVIDENCE_DIR redirects it.
test.use({ locale: "de-DE" });
const evidence = path.resolve(process.env.PWA_PREVIEW_EVIDENCE_DIR
  ?? path.join(fileURLToPath(new URL("../../../", import.meta.url)), ".tmp", "pwa-preview-evidence"));
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const TOP = 47;
const BOTTOM = 34;
const subject = "Synthetische Unterlagen mit Anhängen";

function crc32(bytes: Buffer) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

/** A 360×240 synthetic gradient as PNG. */
function syntheticPng() {
  const width = 360, height = 240;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      raw[offset] = Math.round((x / width) * 200) + 40;
      raw[offset + 1] = Math.round((y / height) * 160) + 60;
      raw[offset + 2] = 180;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2; header[10] = 0; header[11] = 0; header[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** A one-page synthetic PDF with correct cross-reference offsets. */
function syntheticPdf() {
  const stream = "BT /F1 24 Tf 72 720 Td (Synthetischer Bericht) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

const base64Lines = (data: Buffer) => data.toString("base64").replace(/.{76}/g, "$&\r\n");
const boundary = "qa-pwa-preview-boundary";
const html = `<html><body><h1>Unterlagen</h1>${Array.from({ length: 6 }, (_, n) => `<p>Synthetischer Absatz ${n + 1}.</p>`).join("")}</body></html>`;
const source = [
  "From: Synthetic Office <office@example.test>",
  "To: demo@monkeydent.test",
  "Message-ID: <qa-pwa-preview@example.test>",
  `Date: ${new Date(Date.now() + 7_200_000).toUTCString()}`,
  `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
  "MIME-Version: 1.0",
  `Content-Type: multipart/mixed; boundary="${boundary}"`,
  "",
  `--${boundary}`,
  "Content-Type: text/html; charset=utf-8",
  "Content-Transfer-Encoding: 8bit",
  "",
  html,
  `--${boundary}`,
  "Content-Type: image/png; name=\"foto.png\"",
  "Content-Disposition: attachment; filename=\"foto.png\"",
  "Content-Transfer-Encoding: base64",
  "",
  base64Lines(syntheticPng()),
  `--${boundary}`,
  "Content-Type: application/pdf; name=\"bericht.pdf\"",
  "Content-Disposition: attachment; filename=\"bericht.pdf\"",
  "Content-Transfer-Encoding: base64",
  "",
  base64Lines(syntheticPdf()),
  `--${boundary}`,
  "Content-Type: text/plain; charset=utf-8; name=\"notiz.txt\"",
  "Content-Disposition: attachment; filename=\"notiz.txt\"",
  "Content-Transfer-Encoding: 8bit",
  "",
  "Synthetische Notiz für die Vorschau.",
  `--${boundary}--`,
  ""
].join("\r\n");

test.beforeAll(async () => {
  const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, { method: "POST", body: JSON.stringify({ source, flags: ["\\Seen"] }) });
  expect(response.ok).toBe(true);
});

/** iOS home-screen app with notch and home indicator (or a plain tab when standalone is false). */
async function emulatePhone(page: Page, standalone: boolean) {
  await page.addInitScript(([top, bottom, standalone]) => {
    if (standalone) Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    const apply = () => {
      document.documentElement.style.setProperty("--sat", `${top}px`);
      document.documentElement.style.setProperty("--sab", `${bottom}px`);
    };
    if (document.documentElement) apply();
    document.addEventListener("DOMContentLoaded", apply);
  }, [TOP, BOTTOM, standalone] as const);
}

async function openMail(page: Page) {
  const row = page.locator('[data-message-list-row="true"]').filter({ hasText: subject });
  // The first sync of the fixture inbox can outlast one page load.
  await expect.poll(async () => {
    if (await row.first().waitFor({ timeout: 20_000 }).then(() => true, () => false)) return true;
    await page.reload();
    return false;
  }, { timeout: 120_000 }).toBe(true);
  await row.first().click();
  await expect(page.getByRole("link", { name: "Anhang ansehen" }).first()).toBeVisible();
}

const attachmentLink = (page: Page, filename: string) =>
  page.locator(".attachment-item").filter({ hasText: filename }).getByRole("link", { name: "Anhang ansehen" });

/** Geometry of the open in-app preview. */
async function measurePreview(page: Page) {
  return page.locator("[data-in-app-preview]").evaluate((sheet) => {
    const box = (element: Element | null) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const close = sheet.querySelector(':scope > [data-slot="sheet-close"]');
    const frame = sheet.querySelector("iframe");
    const point = close ? close.getBoundingClientRect() : null;
    const hit = point ? document.elementFromPoint(point.left + point.width / 2, point.top + point.height / 2) : null;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      sheet: box(sheet), close: box(close), frame: box(frame),
      closeLabel: close?.textContent ?? null,
      closeIsTopmost: Boolean(hit && close && close.contains(hit)),
      sandbox: frame?.getAttribute("sandbox") ?? null,
      src: frame?.getAttribute("src") ?? null
    };
  });
}

function expectReachable(geometry: Awaited<ReturnType<typeof measurePreview>>) {
  expect(geometry.close!.top).toBeGreaterThanOrEqual(TOP);
  expect(geometry.close!.width).toBeGreaterThanOrEqual(44);
  expect(geometry.close!.height).toBeGreaterThanOrEqual(44);
  expect(geometry.close!.right).toBeLessThanOrEqual(geometry.viewport.width);
  expect(geometry.closeIsTopmost).toBe(true);
  expect(geometry.frame!.bottom).toBeLessThanOrEqual(geometry.viewport.height - BOTTOM);
}

test("before: the preview window has no control back to the app; a browser tab still offers new windows", async ({ browser }) => {
  mkdirSync(evidence, { recursive: true });
  const context = await browser.newContext({ locale: "de-DE", hasTouch: true, isMobile: true, viewport: PHONE, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await emulatePhone(page, false);
  await signInQa(page);
  await openMail(page);
  // In a browser tab the window actions stay (the old behaviour of the home-screen app too).
  await page.getByRole("button", { name: "Nachrichtenaktionen" }).last().click();
  await expect(page.getByRole("menuitem", { name: "In neuem Fenster öffnen" })).toBeVisible();
  await page.screenshot({ path: path.join(evidence, "before-390-menu-tab-light.png") });
  await page.keyboard.press("Escape");
  // What the window showed in the home-screen app: the preview page, an attachment frame and nothing else.
  const href = await attachmentLink(page, "foto.png").getAttribute("href");
  await page.goto(`${href}?preview=1`);
  const controls = await page.locator("button, a, [role=button]").count();
  expect(controls).toBe(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(evidence, "before-390-attachment-window.png") });
  await context.close();
});

for (const scheme of ["light", "dark"] as const) {
  test(`home-screen app (${scheme}): previews open inside the app and close by button, Escape and Back`, async ({ browser }) => {
    mkdirSync(evidence, { recursive: true });
    const results: Record<string, unknown> = {};
    const context = await browser.newContext({ locale: "de-DE", hasTouch: true, isMobile: true, viewport: PHONE, deviceScaleFactor: 2, colorScheme: scheme });
    const page = await context.newPage();
    const popups: string[] = [];
    context.on("page", (opened) => { if (opened !== page) popups.push(opened.url()); });
    await emulatePhone(page, true);
    await signInQa(page);
    await openMail(page);
    await page.screenshot({ path: path.join(evidence, `after-390-reader-${scheme}.png`) });

    // No window actions that would leave the app; the HTML view stays.
    await page.getByRole("button", { name: "Nachrichtenaktionen" }).last().click();
    await expect(page.getByRole("menuitem", { name: "HTML-Fenster öffnen" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "In neuem Fenster öffnen" })).toHaveCount(0);
    await page.screenshot({ path: path.join(evidence, `after-390-menu-${scheme}.png`) });

    // HTML view inside the app; closed by its button.
    await page.getByRole("menuitem", { name: "HTML-Fenster öffnen" }).click();
    await expect(page.locator("[data-in-app-preview]")).toBeVisible();
    await page.waitForTimeout(600);
    results.html = await measurePreview(page);
    expectReachable(results.html as Awaited<ReturnType<typeof measurePreview>>);
    await page.screenshot({ path: path.join(evidence, `after-390-html-${scheme}.png`) });
    await page.locator('[data-in-app-preview] > [data-slot="sheet-close"]').click();
    await expect(page.locator("[data-in-app-preview]")).toHaveCount(0);

    // Image: sandboxed frame; closed by Escape.
    await attachmentLink(page, "foto.png").click();
    await expect(page.locator("[data-in-app-preview]")).toBeVisible();
    await page.waitForTimeout(600);
    results.image = await measurePreview(page);
    expectReachable(results.image as Awaited<ReturnType<typeof measurePreview>>);
    expect((results.image as { sandbox: string | null }).sandbox).toBe("");
    await page.screenshot({ path: path.join(evidence, `after-390-image-${scheme}.png`) });
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-in-app-preview]")).toHaveCount(0);

    // PDF: unsandboxed like the preview page; closed by its button. (A PDF viewer that takes
    // the focus keeps Escape inside its own frame. The headless shell renders no PDF.)
    await attachmentLink(page, "bericht.pdf").click();
    await expect(page.locator("[data-in-app-preview]")).toBeVisible();
    await page.waitForTimeout(600);
    results.pdf = await measurePreview(page);
    expectReachable(results.pdf as Awaited<ReturnType<typeof measurePreview>>);
    expect((results.pdf as { sandbox: string | null }).sandbox).toBeNull();
    await page.screenshot({ path: path.join(evidence, `after-390-pdf-${scheme}.png`) });
    await page.locator('[data-in-app-preview] > [data-slot="sheet-close"]').click();
    await expect(page.locator("[data-in-app-preview]")).toHaveCount(0);

    // Text: closed by the Back gesture; the reader stays open.
    await attachmentLink(page, "notiz.txt").click();
    await expect(page.locator("[data-in-app-preview]")).toBeVisible();
    await page.waitForTimeout(600);
    results.text = await measurePreview(page);
    expectReachable(results.text as Awaited<ReturnType<typeof measurePreview>>);
    await page.screenshot({ path: path.join(evidence, `after-390-text-${scheme}.png`) });
    await page.goBack();
    await expect(page.locator("[data-in-app-preview]")).toHaveCount(0);
    await expect(attachmentLink(page, "notiz.txt")).toBeVisible();

    expect(popups).toEqual([]);
    results.popups = popups;
    writeFileSync(path.join(evidence, `after-390-${scheme}.json`), JSON.stringify(results, null, 2));
    await context.close();
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(`desktop browser (${scheme}): the preview keeps its own window`, async ({ browser }) => {
    mkdirSync(evidence, { recursive: true });
    const context = await browser.newContext({ locale: "de-DE", viewport: DESKTOP, colorScheme: scheme });
    const page = await context.newPage();
    await signInQa(page);
    await openMail(page);
    await page.screenshot({ path: path.join(evidence, `after-1280-reader-${scheme}.png`) });
    const [popup] = await Promise.all([context.waitForEvent("page"), attachmentLink(page, "foto.png").click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toContain("preview=1");
    await expect(page.locator("[data-in-app-preview]")).toHaveCount(0);
    await popup.setViewportSize({ width: 920, height: 760 });
    await popup.screenshot({ path: path.join(evidence, `after-1280-attachment-window-${scheme}.png`) });
    await context.close();
  });
}
