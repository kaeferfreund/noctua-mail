import { test, expect, type Page } from "@playwright/test";
import { evidencePath, reauthQa, recordQa, signInQa } from "./qaRound2Session";
import { catalogs } from "./qaSweep3";

// Reader toolbar with „KI-Antwort entwerfen“, „Link kopieren“, „Inhalt kopieren“ at 1280 and
// 390 px, the copied link resolved by MCP resolve_link, and the AI reply client flow with the
// instruction prompt (popover at 1280, bottom sheet at 390, dictation through a stub recognizer).
// The ai-reply request is answered inside the browser (page.route), so no model is ever called:
//   ANTHROPIC_API_KEY=synthetic-no-network QA_SHELL_PORT=<port> QA_SHELL_SPEC=qa-ai-reply-copy-link.spec.ts \
//     QA_ROUND2_EVIDENCE_DIR=<dir> bun scripts/runQaShellBrowserTests.ts
const copy = catalogs.de;
test.use({ locale: "de-DE", timezoneId: "Europe/Berlin", permissions: ["clipboard-read", "clipboard-write"] });
const subject = "Unterlagen für Donnerstag";
const body = "Hallo Alex,\r\n\r\nanbei die Unterlagen für Donnerstag.\r\n\r\nViele Grüße\r\nToni Muster";
const generated = "Hallo Toni,\n\nvielen Dank, das passt so!\n\nViele Grüße\nAlex";

test.beforeAll(async () => {
  const source = ["From: Toni Muster <toni.muster@example.test>", "To: demo@monkeydent.test", "Message-ID: <qa-ai-reply@example.test>",
    `Date: ${new Date(Date.now() + 3_600_000).toUTCString()}`, `Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "", body].join("\r\n");
  const response = await fetch(`${process.env.QA_SHELL_CONTROL_URL}/inject`, { method: "POST", body: JSON.stringify({ source, flags: ["\\Seen"] }) });
  expect(response.ok).toBe(true);
});

async function openMail(page: Page) {
  const row = page.locator('[data-message-list-row="true"]').filter({ hasText: subject }).first();
  await expect.poll(async () => {
    if (await row.count()) return true;
    await page.waitForTimeout(3000); await page.goto("/");
    return false;
  }, { timeout: 120_000, intervals: [500] }).toBe(true);
  await row.click();
  await expect(page.getByText("anbei die Unterlagen für Donnerstag.").first()).toBeVisible();
}

const readerButton = (page: Page, action: string) => page.locator(`[data-message-action="${action}"]`).first();
const prompt = copy.Reader.aiReplyPrompt;
const instructionField = (page: Page) => page.getByRole("textbox", { name: prompt.label });

/**
 * Replaces the browser's recognizer with a scripted one: an interim result shortly after start,
 * the final result on stop. Records what Chromium itself offers before the stub is installed.
 */
async function stubSpeechRecognition(page: Page) {
  await page.addInitScript(() => {
    const scope = window as unknown as Record<string, unknown>;
    scope.__qaNativeSpeech = { standard: typeof scope.SpeechRecognition, webkit: typeof scope.webkitSpeechRecognition };
    const result = (transcript: string, isFinal: boolean) => ({ resultIndex: 0, results: [Object.assign([{ transcript, confidence: 1 }], { isFinal })] });
    class QaRecognition extends EventTarget {
      lang = ""; interimResults = false; continuous = true;
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() { scope.__qaRecognition = { lang: this.lang, interimResults: this.interimResults, continuous: this.continuous };
        setTimeout(() => this.onresult?.(result("Zusage für Donnerstag", false)), 150); }
      stop() { this.onresult?.(result("Zusage für Donnerstag, 14 Uhr passt", true)); this.onend?.(); }
      abort() { this.onend?.(); }
    }
    scope.SpeechRecognition = QaRecognition;
  });
}

type AiReplyBody = { locale?: string; instruction?: string };
const draftResponse = () => ({ ok: true, draftId: "qa-ai-draft", url: null, message: {
  id: "qa-ai-draft", accountId: "qa-shared", folderId: "qa-shared:Drafts", threadId: "<qa-ai-reply@example.test>", subject: `Re: ${subject}`,
  from: "Demo <demo@monkeydent.test>", to: "Toni Muster <toni.muster@example.test>", preview: "", date: new Date().toISOString(),
  dateValue: Date.now(), body: `${generated}\n\nAm 27.10.2026 schrieb Toni Muster:\n> anbei die Unterlagen für Donnerstag.`,
  inReplyTo: "<qa-ai-reply@example.test>", draft: true, flags: ["\\Draft", "\\Seen", "$NoctuaAI"]
} });

test("reader toolbar: AI reply and copy actions at 1280 and 390 px; the copied link resolves in MCP", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 860 });
  await signInQa(page);
  page.on("pageerror", error => console.log("[pageerror]", error.message));
  await openMail(page);

  for (const action of ["ai-reply", "copy-link", "copy-content"]) await expect(readerButton(page, action)).toBeVisible();
  await expect(readerButton(page, "ai-reply")).toHaveAttribute("aria-label", copy.Reader.aiReply);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: evidencePath("reader-toolbar-1280.png") });

  await readerButton(page, "copy-link").click();
  await expect(page.getByText(copy.Reader.linkCopied).first()).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const parsed = new URL(link);
  expect(parsed.searchParams.get("a")).toBeTruthy();
  expect(parsed.searchParams.get("m")).toBeTruthy();
  await page.screenshot({ path: evidencePath("reader-link-copied-1280.png") });

  await readerButton(page, "copy-content").click();
  await expect(page.getByText(copy.Reader.contentCopied).first()).toBeVisible();
  const content = await page.evaluate(() => navigator.clipboard.readText());
  expect(content).toContain("Von: Toni Muster <toni.muster@example.test>");
  expect(content).toContain(`Betreff: ${subject}`);
  expect(content).toContain("anbei die Unterlagen für Donnerstag.");

  // The copied link, pasted to MCP, names the same message.
  const origin = new URL(page.url()).origin;
  const minted = await page.request.post("/api/accounts/qa-shared/mcp-tokens", { headers: { origin, "x-noctua-reauth": await reauthQa(page, "mcp.create") },
    data: { label: "Synthetic link QA", accountIds: ["qa-shared"], mode: "read" } });
  expect(minted.status()).toBe(201);
  const { token } = await minted.json() as { token: string };
  const resolved = await page.request.post("/api/mcp", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json, text/event-stream", "content-type": "application/json" },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "resolve_link", arguments: { url: link } } }
  });
  const result = (await resolved.json() as { result: { structuredContent: { ok: boolean; accountId: string; isDraft: boolean; message: { subject: string; url: string } } } }).result;
  expect(result.structuredContent).toMatchObject({ ok: true, accountId: "qa-shared", isDraft: false, message: { subject } });
  recordQa("ai-reply-copy-link", { copiedLink: parsed.search, resolvedSubject: result.structuredContent.message.subject, contentLines: content.split("\n").length });

  // 390 px: the extra icons move into the ⋮ menu.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(link);
  await expect(page.getByText("anbei die Unterlagen für Donnerstag.").first()).toBeVisible();
  for (const action of ["ai-reply", "copy-link", "copy-content"]) await expect(readerButton(page, action)).toBeHidden();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: evidencePath("reader-toolbar-390.png") });
  await page.locator('[data-message-action="menu"]').last().click();
  for (const label of [copy.Reader.aiReply, copy.Reader.copyLink, copy.Reader.copyContent]) {
    await expect(page.getByRole("menuitem", { name: label })).toBeVisible();
  }
  await page.screenshot({ path: evidencePath("reader-menu-390.png") });
});

test("KI-Antwort opens the returned draft in the composer; 503 shows the setup notice", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 860 });
  await signInQa(page);
  await openMail(page);
  let answer: "draft" | "unavailable" = "unavailable";
  const bodies: AiReplyBody[] = [];
  await page.route("**/ai-reply", async route => {
    bodies.push(route.request().postDataJSON() as AiReplyBody);
    if (answer === "unavailable") {
      await route.fulfill({ status: 503, json: { ok: false, code: "ai_unavailable" } });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.fulfill({ json: draftResponse() });
  });

  // „Ohne Hinweis“ is the one-click reply from before.
  await readerButton(page, "ai-reply").click();
  await expect(page.locator('[data-ai-reply-prompt="popover"]')).toBeVisible();
  await page.getByRole("button", { name: prompt.withoutHint, exact: true }).click();
  await expect(page.getByText(copy.Reader.aiReplyUnavailable).first()).toBeVisible();
  expect(bodies[0]).toEqual({ locale: "de" });
  await page.screenshot({ path: evidencePath("ai-reply-unavailable-1280.png") });

  answer = "draft";
  await readerButton(page, "ai-reply").click();
  await expect(instructionField(page)).toBeFocused();
  await instructionField(page).fill("Zusage, Donnerstag 14 Uhr passt");
  await instructionField(page).press("Enter");
  await expect(page.locator('[data-ai-reply-prompt="popover"]')).toBeHidden();
  await expect(readerButton(page, "ai-reply")).toBeDisabled();
  expect(bodies[1]).toEqual({ locale: "de", instruction: "Zusage, Donnerstag 14 Uhr passt" });
  await page.screenshot({ path: evidencePath("ai-reply-running-1280.png") });
  await expect(page.getByText("vielen Dank, das passt so!").first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: evidencePath("ai-reply-draft-open-1280.png") });
  recordQa("ai-reply-client", { unavailableNotice: true, draftOpened: true, bodies });
});

test("KI-Antwort prompt: popover with dictation at 1280 px, bottom sheet from the ⋮ menu at 390 px", async ({ page }) => {
  test.setTimeout(600_000);
  await stubSpeechRecognition(page);
  await page.setViewportSize({ width: 1280, height: 860 });
  await signInQa(page);
  await openMail(page);
  const bodies: AiReplyBody[] = [];
  await page.route("**/ai-reply", async route => {
    bodies.push(route.request().postDataJSON() as AiReplyBody);
    await route.fulfill({ status: 503, json: { ok: false, code: "ai_unavailable" } });
  });
  const popover = page.locator('[data-ai-reply-prompt="popover"]');
  const mic = page.locator("[data-ai-reply-dictate]");

  // Desktop popover at the button; Esc closes it without a request.
  await readerButton(page, "ai-reply").click();
  await expect(popover).toBeVisible();
  await expect(instructionField(page)).toHaveAttribute("placeholder", prompt.placeholder);
  await expect(instructionField(page)).toHaveAttribute("maxlength", "200");
  const [buttonBox, popoverBox] = [await readerButton(page, "ai-reply").boundingBox(), await popover.boundingBox()];
  expect(popoverBox!.y).toBeGreaterThan(buttonBox!.y);
  expect(Math.abs(popoverBox!.x + popoverBox!.width - (buttonBox!.x + buttonBox!.width))).toBeLessThan(24);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: evidencePath("ai-instruction-popover-1280.png") });
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  expect(bodies).toEqual([]);

  // Dictation: interim words in grey while listening, the final text appended on stop.
  await readerButton(page, "ai-reply").click();
  await instructionField(page).fill("Bitte freundlich:");
  await mic.click();
  await expect(mic).toHaveAttribute("data-ai-reply-dictate", "listening");
  await expect(page.locator("[data-ai-reply-interim]")).toContainText("Zusage für Donnerstag");
  await expect(page.locator('[data-ai-reply-hint="listening"]')).toHaveText(prompt.listening);
  await page.screenshot({ path: evidencePath("ai-instruction-dictating-1280.png") });
  await mic.click();
  await expect(mic).toHaveAttribute("data-ai-reply-dictate", "idle");
  await expect(instructionField(page)).toHaveValue("Bitte freundlich: Zusage für Donnerstag, 14 Uhr passt");
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__qaRecognition))
    .toEqual({ lang: "de-DE", interimResults: true, continuous: false });
  await page.getByRole("button", { name: prompt.submit, exact: true }).click();
  await expect(popover).toBeHidden();
  expect(bodies.at(-1)).toEqual({ locale: "de", instruction: "Bitte freundlich: Zusage für Donnerstag, 14 Uhr passt" });
  await expect(page.getByText(copy.Reader.aiReplyUnavailable).first()).toBeVisible();

  // 390 px: the ⋮ entry opens the same prompt as a bottom sheet.
  await readerButton(page, "copy-link").click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(link);
  await expect(page.getByText("anbei die Unterlagen für Donnerstag.").first()).toBeVisible();
  await page.locator('[data-message-action="menu"]').last().click();
  await page.getByRole("menuitem", { name: copy.Reader.aiReply }).click();
  const sheet = page.locator('[data-ai-reply-prompt="sheet"]');
  await expect(sheet).toBeVisible();
  await expect(instructionField(page)).toBeFocused();
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox!.y + sheetBox!.height).toBeGreaterThan(844 - 2);
  expect(sheetBox!.width).toBe(390);
  const long = "Zusage für Donnerstag um 14 Uhr, die Unterlagen sind vollständig angekommen und passen so. Bitte noch kurz den Raum bestätigen, dann ist alles klar für uns beide.";
  await instructionField(page).fill(long);
  await expect(page.locator("[data-ai-reply-counter]")).toHaveText(`${long.length}/200`);
  await expect(mic).toBeVisible();
  await page.screenshot({ path: evidencePath("ai-instruction-sheet-counter-390.png") });
  await mic.click();
  await expect(page.locator("[data-ai-reply-interim]")).toContainText("Zusage für Donnerstag");
  // The long text overflows the field: the newest (interim) words stay in view.
  await expect.poll(() => page.locator("[data-ai-reply-interim]").evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await page.screenshot({ path: evidencePath("ai-instruction-sheet-dictating-390.png") });
  await mic.click();
  await expect(instructionField(page)).toHaveValue(`${long} Zusage für Donnerstag, 14 Uhr passt`.slice(0, 200).trimEnd());
  await page.getByRole("button", { name: prompt.submit, exact: true }).click();
  await expect(sheet).toBeHidden();
  expect(bodies.at(-1)?.instruction).toHaveLength(Math.min(200, `${long} Zusage für Donnerstag, 14 Uhr passt`.length));
  const nativeSpeech = await page.evaluate(() => (window as unknown as Record<string, unknown>).__qaNativeSpeech);
  recordQa("ai-reply-instruction", { requests: bodies.length, nativeSpeech, counter: `${long.length}/200` });
});
