import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import { readFileSync } from "node:fs";
import { totpFromUri } from "../../helpers/totp";
import { evidencePath, recordQa } from "./qaRound2Session";

// Run via: QA_SHELL_USE_BUILD=1 QA_SHELL_SPEC=qa-csp.spec.ts nice -n 15 bun scripts/runQaShellBrowserTests.ts
// Checks that the app Content-Security-Policy does not break the main views and
// that attachment documents cannot act with the viewer's session.
test.use({ locale: "en-GB" });

const ACCOUNT = "qa-shared";
const ACTIVE_SUBJECT = "CSP synthetic attachments";
const b64 = (value: string) => Buffer.from(value).toString("base64");
const activeSource = () => {
  const boundary = "csp-boundary";
  const html = '<p>Synthetic body</p><img src="https://images.example.test/pixel.png" alt="remote">';
  const formAttachment = '<!doctype html><meta name="referrer" content="origin"><form method="post" action="/api/csp-probe">' +
    '<button id="submit" style="width:100%;height:200px">Synthetic</button></form><script>document.title="script-ran"</script>';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><script>document.title="svg-script-ran"</script><rect width="40" height="40" fill="red"/></svg>';
  return [
    "From: Synthetic Sender <sender@example.test>", "To: demo@demo-praxis.test", "Message-ID: <csp-attachments@example.test>",
    `Date: ${new Date().toUTCString()}`, `Subject: ${ACTIVE_SUBJECT}`, "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
    `--${boundary}`, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64", "", b64(html),
    `--${boundary}`, 'Content-Type: text/html; name="form.html"', 'Content-Disposition: attachment; filename="form.html"',
    "Content-Transfer-Encoding: base64", "", b64(formAttachment),
    `--${boundary}`, 'Content-Type: image/svg+xml; name="logo.svg"', 'Content-Disposition: attachment; filename="logo.svg"',
    "Content-Transfer-Encoding: base64", "", b64(svg),
    `--${boundary}--`, ""
  ].join("\r\n");
};

type Violation = { page: string; text: string };
const violations: Violation[] = [];
const pageErrors: string[] = [];

function watch(page: Page) {
  page.on("console", (message: ConsoleMessage) => {
    const text = message.text();
    if (/Content[- ]Security[- ]Policy|Refused to (load|execute|apply|frame|connect|evaluate|create)/i.test(text)) {
      violations.push({ page: page.url(), text });
    }
  });
  page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error.message}`));
}

async function signIn(page: Page) {
  const [seed] = JSON.parse(readFileSync(process.env.QA_SHELL_SEED_FILE!, "utf8"));
  const origin = new URL(page.url()).origin;
  for (const [url, body] of [
    ["/api/ba/sign-in/email", { email: seed.email, password: seed.password }],
    ["/api/ba/two-factor/verify-totp", { code: totpFromUri(seed.totpURI) }],
    ["/api/auth/switch-account", { accountId: ACCOUNT }]
  ] as const) {
    expect((await page.request.post(url, { data: body, headers: { origin } })).status()).toBe(200);
  }
}

async function findMessage(page: Page, subject: string) {
  const folders = await (await page.request.get(`/api/accounts/${ACCOUNT}/folders`)).json();
  const inbox = folders.find((folder: { specialUse?: string }) => folder.specialUse?.toLowerCase() === "\\inbox");
  let found: { id: string } | undefined;
  await expect.poll(async () => {
    const list = await (await page.request.get(`/api/accounts/${ACCOUNT}/messages?folderId=${encodeURIComponent(inbox.id)}&pageSize=200`)).json();
    found = list.items.find((item: { subject?: string }) => item.subject === subject);
    return !!found;
  }, { timeout: 60_000 }).toBe(true);
  return found!;
}

test("app pages run under the CSP without violations; attachments stay isolated", async ({ page, context }) => {
  test.setTimeout(300_000);
  watch(page);
  context.on("page", watch);
  const control = process.env.QA_SHELL_CONTROL_URL!;
  expect((await fetch(`${control}/inject`, { method: "POST", body: JSON.stringify({ source: activeSource() }) })).ok).toBe(true);

  // Login page: nonce policy, framework scripts carry the nonce.
  const login = await page.goto("/");
  const policy = login!.headers()["content-security-policy"] ?? "";
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
  expect(nonce).toBeTruthy();
  expect(policy).toContain("frame-ancestors 'none'");
  expect(login!.headers()["x-frame-options"]).toBe("DENY");
  expect(login!.headers()["x-content-type-options"]).toBe("nosniff");
  expect(login!.headers()["referrer-policy"]).toBe("same-origin");
  await expect(page.locator("input[type=email], input[name=email]").first()).toBeVisible();
  const scripts = await page.locator("script").evaluateAll((elements) => elements.map((element) => ({
    src: element.getAttribute("src"), nonce: (element as HTMLScriptElement).nonce })));
  expect(scripts.length).toBeGreaterThan(0);
  // Inline scripts need the nonce; chunks loaded later by a nonced script run through 'strict-dynamic'.
  const inline = scripts.filter((script) => !script.src);
  expect(inline.length).toBeGreaterThan(0);
  for (const script of inline) expect(script.nonce).toBe(nonce);
  await page.screenshot({ path: evidencePath("csp-login.png") });

  // Shell after sign-in.
  await signIn(page);
  await page.goto("/");
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  await expect(page.locator("[data-message-list-row]").first()).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: evidencePath("csp-shell.png") });

  // Service worker registers and activates under worker-src.
  const sw = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return { scope: registration.scope, active: !!(registration.active ?? registration.installing ?? registration.waiting) };
  });
  expect(sw.active).toBe(true);

  // HTML mail in the srcdoc reading frame.
  const newsletter = await findMessage(page, "Praxispost im Oktober");
  await page.goto(`/message/window?accountId=${ACCOUNT}&messageId=${encodeURIComponent(newsletter.id)}`);
  const mailFrame = page.frameLocator("iframe[sandbox='allow-same-origin']");
  await expect(mailFrame.getByText("Demo-Praxis Praxispost")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => mailFrame.locator("img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: evidencePath("csp-html-mail.png") });

  // Remote image after consent, and attachments of an external sender.
  const active = await findMessage(page, ACTIVE_SUBJECT);
  await page.goto(`/message/window?accountId=${ACCOUNT}&messageId=${encodeURIComponent(active.id)}`);
  await expect(page.frameLocator("iframe[sandbox='allow-same-origin']").getByText("Synthetic body")).toBeVisible({ timeout: 30_000 });
  // The reserved host never resolves: the request must be attempted (DNS error), not blocked by the CSP.
  const remoteFailure = page.waitForEvent("requestfailed", (request) => request.url().startsWith("https://images.example.test/"));
  await page.getByRole("button", { name: "Load once", exact: true }).first().click();
  expect((await remoteFailure).failure()?.errorText).not.toContain("BLOCKED_BY_CSP");
  await page.screenshot({ path: evidencePath("csp-active-message.png") });

  const attachmentUrls = new Map<string, string>();
  for (const name of ["form.html", "logo.svg"]) {
    attachmentUrls.set(name, (await page.locator("a.attachment-link", { hasText: name }).getAttribute("href"))!);
  }
  const probes: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/csp-probe")) probes.push(request.url()); });
  for (const name of ["form.html", "logo.svg"]) {
    const url = attachmentUrls.get(name)!;
    const preview = await page.goto(`${url}?preview=1`);
    expect(preview!.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    expect(frame).toBeTruthy();
    await expect.poll(() => frame!.evaluate(() => document.readyState)).toBe("complete");
    // Opaque origin, no script.
    expect(await frame!.evaluate(() => self.origin)).toBe("null");
    expect(await page.title()).not.toContain("script-ran");
    expect(await frame!.evaluate(() => document.title)).not.toContain("script-ran");
    if (name === "form.html") await frame!.locator("#submit").click();
    await page.screenshot({ path: evidencePath(`csp-attachment-${name}.png`) });
    // Opened directly, the bytes are still sandboxed.
    const direct = await page.goto(url);
    expect(direct!.headers()["content-security-policy"]).toMatch(/^sandbox; default-src 'none'; form-action 'none'/);
    expect(await page.evaluate(() => self.origin)).toBe("null");
    if (name === "form.html") {
      await page.locator("#submit").click();
      expect(await page.title()).not.toContain("script-ran");
    }
  }
  await page.waitForTimeout(1000);
  expect(probes).toEqual([]);
  // The form submissions above are expected CSP blocks; they are not app violations.
  violations.splice(0, violations.length, ...violations.filter((entry) => !entry.page.includes("/attachments/")));

  // PDF preview keeps working (no sandbox for the browser's PDF viewer).
  const invoice = await findMessage(page, "Rechnung für Handschuhe und Masken");
  await page.goto(`/message/window?accountId=${ACCOUNT}&messageId=${encodeURIComponent(invoice.id)}`);
  const pdfUrl = (await page.locator("a.attachment-link", { hasText: "Rechnung-Demo.pdf" }).getAttribute("href"))!;
  const pdfResponse = page.waitForResponse((response) => response.url().endsWith(pdfUrl) && response.request().frame() !== page.mainFrame());
  await page.goto(`${pdfUrl}?preview=1`);
  const pdfFrame = await pdfResponse;
  expect(pdfFrame.status()).toBe(200);
  expect(pdfFrame.headers()["content-type"]).toBe("application/pdf");
  expect(pdfFrame.headers()["content-security-policy"]).not.toContain("sandbox");
  expect(await page.locator("iframe").getAttribute("sandbox")).toBeNull();
  // A full Chromium (not the headless shell) also loads its PDF viewer extension frame here.
  if (process.env.QA_PDF_VIEWER === "1") {
    await expect.poll(() => page.frames().some((frame) => frame.url().startsWith("chrome-extension://"))).toBe(true);
  }
  await page.screenshot({ path: evidencePath("csp-attachment-pdf.png") });

  // Compose: editor, markdown tab and preview.
  await page.goto("/");
  await page.getByRole("button", { name: "New mail", exact: true }).first().click();
  const editor = page.locator("[contenteditable=true]").first();
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await editor.click();
  await page.keyboard.type("Synthetic CSP compose check");
  await page.screenshot({ path: evidencePath("csp-compose.png") });

  // Calendar panel and the invite message snapshot.
  await page.goto(`/?a=~${ACCOUNT}&panel=calendar`);
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: evidencePath("csp-calendar.png") });
  const invite = await findMessage(page, "Einladung zur Teambesprechung");
  await page.goto(`/message/window?accountId=${ACCOUNT}&messageId=${encodeURIComponent(invite.id)}`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: evidencePath("csp-invite.png") });

  // Settings dialog, every tab.
  await page.goto("/");
  await page.getByRole("button", { name: "User menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  const tabs = page.getByRole("tablist").getByRole("tab");
  await expect(tabs.first()).toBeVisible();
  for (let index = 0; index < await tabs.count(); index++) {
    await tabs.nth(index).click();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: evidencePath("csp-settings.png") });

  // Phone width shell.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator('[data-slot="shell-header"]')).toBeVisible();
  await page.screenshot({ path: evidencePath("csp-shell-390.png") });

  // Not a violation: the reading frame's own meta policy repeats frame-ancestors from the HTTP policy of the
  // message HTML route, and browsers note that a meta policy ignores it.
  const metaNotices = violations.filter((entry) => /'frame-ancestors' is ignored when delivered via a <meta> element/.test(entry.text));
  violations.splice(0, violations.length, ...violations.filter((entry) => !metaNotices.includes(entry)));
  recordQa("csp", { policy, serviceWorker: sw, violations, pageErrors, probes, metaNotices: metaNotices.length });
  expect(violations).toEqual([]);
  expect(pageErrors).toEqual([]);
});
