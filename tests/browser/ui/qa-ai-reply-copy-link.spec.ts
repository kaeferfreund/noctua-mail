import { test, expect, type Page } from "@playwright/test";
import { evidencePath, reauthQa, recordQa, signInQa } from "./qaRound2Session";
import { catalogs } from "./qaSweep3";

// Reader toolbar with „KI-Antwort entwerfen“, „Link kopieren“, „Inhalt kopieren“ at 1280 and
// 390 px, the copied link resolved by MCP resolve_link, and the AI reply client flow. The
// ai-reply request is answered inside the browser (page.route), so no model is ever called:
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
  await page.route("**/ai-reply", async route => {
    if (answer === "unavailable") {
      await route.fulfill({ status: 503, json: { ok: false, code: "ai_unavailable" } });
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.fulfill({ json: { ok: true, draftId: "qa-ai-draft", url: null, message: {
      id: "qa-ai-draft", accountId: "qa-shared", folderId: "qa-shared:Drafts", threadId: "<qa-ai-reply@example.test>", subject: `Re: ${subject}`,
      from: "Demo <demo@monkeydent.test>", to: "Toni Muster <toni.muster@example.test>", preview: "", date: new Date().toISOString(),
      dateValue: Date.now(), body: `${generated}\n\nAm 27.10.2026 schrieb Toni Muster:\n> anbei die Unterlagen für Donnerstag.`,
      inReplyTo: "<qa-ai-reply@example.test>", draft: true, flags: ["\\Draft", "\\Seen", "$NoctuaAI"]
    } } });
  });

  await readerButton(page, "ai-reply").click();
  await expect(page.getByText(copy.Reader.aiReplyUnavailable).first()).toBeVisible();
  await page.screenshot({ path: evidencePath("ai-reply-unavailable-1280.png") });

  answer = "draft";
  await readerButton(page, "ai-reply").click();
  await expect(readerButton(page, "ai-reply")).toBeDisabled();
  await page.screenshot({ path: evidencePath("ai-reply-running-1280.png") });
  await expect(page.getByText("vielen Dank, das passt so!").first()).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: evidencePath("ai-reply-draft-open-1280.png") });
  recordQa("ai-reply-client", { unavailableNotice: true, draftOpened: true });
});
