import { test, expect, type APIResponse, type Page } from "@playwright/test";
import { signInQa, recordQa } from "./qaRound2Session";

// Real-HTTP contract for every route guarded by requireMutationSameOrigin: the
// production client sends these commands without a body, which must succeed,
// while non-JSON payloads and foreign origins stay rejected by the same guard.
test.use({ locale: "en-GB" });
const account = "/api/accounts/qa-shared";
const id = (value: string) => encodeURIComponent(value);
type Method = "POST" | "DELETE";
type Command = { name: string; method: Method; path: string; status: number };

async function call(page: Page, method: Method, path: string, init: { origin?: string; type?: string; data?: string } = {}) {
  const origin = init.origin ?? new URL(page.url()).origin;
  const headers: Record<string, string> = { origin };
  if (init.type) headers["content-type"] = init.type;
  return page.request.fetch(path, { method, headers, ...(init.data === undefined ? {} : { data: init.data }) });
}
async function json(response: APIResponse) {
  return response.json().catch(() => null);
}
async function created(page: Page, path: string, body: unknown) {
  const response = await call(page, "POST", path, { type: "application/json", data: JSON.stringify(body) });
  expect(response.status(), `${path} ${await response.text()}`).toBeLessThan(300);
  return json(response);
}
async function waitForJob(page: Page, path: string, jobId: string) {
  await expect.poll(async () => (await json(await page.request.get(`${path}?jobId=${id(jobId)}`)))?.job?.status ?? "missing",
    { timeout: 60000 }).toMatch(/^(done|failed)$/);
}

test("bodyless commands: every guarded route accepts an empty request and keeps rejecting non-JSON bodies", async ({ page }) => {
  await signInQa(page);
  await expect(page.locator('[data-message-list-row="true"]').first()).toBeVisible();
  const list = await json(await page.request.get(`${account}/messages?page=1&pageSize=300&groupBy=date&folderId=${id("qa-shared:INBOX")}`));
  const inbox: Array<{ id: string; subject: string }> = list.items;
  const bySubject = (subject: string) => inbox.find(message => message.subject === subject)!.id;
  const newsletter = bySubject("Praxispost im Oktober");
  const invoice = bySubject("Rechnung für Handschuhe und Masken");
  const plain = inbox.filter(message => message.id !== newsletter && message.id !== invoice).map(message => message.id);
  expect(plain.length).toBeGreaterThanOrEqual(4);
  const [resyncId, spamId, archiveId, deleteId] = plain;
  const attachment = (await json(await page.request.get(`${account}/messages/${id(invoice)}`))).message.attachments[0].id as string;
  const draftBody = (subject: string) => ({ to: "synthetic-recipient@example.test", subject, text: "Synthetic bodyless contract draft." });
  const sendDraft = (await created(page, `${account}/drafts/save`, draftBody("Bodyless send synthetic"))).draftId as string;
  const discardDraft = (await created(page, `${account}/drafts/save`, draftBody("Bodyless discard synthetic"))).draftId as string;
  const folderName = "Bodyless synthetic";
  await created(page, `${account}/folders/create`, { name: folderName });
  const alias = (await created(page, `${account}/recipient-aliases`, { name: "Bodyless synthetic alias", recipients: "alias@example.test" })).alias.id as string;
  const topic = (await created(page, `${account}/topics`, { name: "Bodyless synthetic topic" })).topic.id as string;
  const event = (await created(page, `${account}/calendar/events`, { summary: "Bodyless synthetic event", startAtMs: Date.now() + 86400000 })).event.id as string;

  const message = (messageId: string, action: string) => `${account}/messages/${id(messageId)}/${action}`;
  const commands: Command[] = [
    { name: "message resync", method: "POST", path: message(resyncId, "resync"), status: 200 },
    { name: "folder consistency", method: "POST", path: `${account}/folders/${id("qa-shared:INBOX")}/consistency`, status: 200 },
    { name: "account sync", method: "POST", path: `${account}/sync`, status: 202 },
    { name: "calendar sync", method: "POST", path: `${account}/calendar/sync`, status: 200 },
    { name: "categories model reset", method: "POST", path: `${account}/categories/model/reset`, status: 200 },
    { name: "categories recompute", method: "POST", path: `${account}/categories/recompute`, status: 202 },
    { name: "threads recompute", method: "POST", path: `${account}/threads/recompute`, status: 202 },
    { name: "unsubscribe", method: "POST", path: message(newsletter, "unsubscribe"), status: 200 },
    { name: "attachment DELETE", method: "DELETE", path: `${account}/messages/${id(invoice)}/attachments/${id(attachment)}`, status: 200 },
    { name: "spam", method: "POST", path: message(spamId, "spam"), status: 200 },
    { name: "not-spam", method: "POST", path: "", status: 200 },
    { name: "archive", method: "POST", path: message(archiveId, "archive"), status: 200 },
    { name: "delete to Trash", method: "POST", path: message(deleteId, "delete"), status: 200 },
    { name: "permanent delete in Trash", method: "POST", path: "", status: 200 },
    { name: "draft send", method: "POST", path: `${account}/drafts/${id(sendDraft)}/send`, status: 200 },
    { name: "draft discard", method: "POST", path: `${account}/drafts/${id(discardDraft)}/discard`, status: 200 },
    { name: "folder delete", method: "POST", path: `${account}/folders/${id(`qa-shared:${folderName}`)}/delete`, status: 200 },
    { name: "recipient alias DELETE", method: "DELETE", path: `${account}/recipient-aliases/${id(alias)}`, status: 200 },
    { name: "topic DELETE", method: "DELETE", path: `${account}/topics/${id(topic)}`, status: 200 },
    { name: "calendar event DELETE", method: "DELETE", path: `${account}/calendar/events/${id(event)}?soft=true`, status: 200 }
  ];
  const results: Array<Record<string, unknown>> = [];
  let previous: Record<string, unknown> | null = null;
  let trashed = "";
  for (const command of commands) {
    // Chained commands continue on the message id the previous move returned.
    if (command.name === "not-spam") command.path = message(previous!.messageId as string, "not-spam");
    if (command.name === "permanent delete in Trash") command.path = message(previous!.messageId as string, "delete");
    const rejected: Record<string, unknown> = {};
    for (const [variant, init, status, code] of [
      ["text/plain body", { type: "text/plain", data: "synthetic" }, 400, "json_required"],
      ["form body", { type: "application/x-www-form-urlencoded", data: "synthetic=1" }, 400, "json_required"],
      ["foreign origin", { origin: "https://foreign.example.test" }, 403, "invalid_origin"]
    ] as const) {
      const response = await call(page, command.method, command.path, init);
      expect(response.status(), `${command.name}: ${variant}`).toBe(status);
      expect((await json(response))?.code, `${command.name}: ${variant}`).toBe(code);
      rejected[variant] = response.status();
    }
    const response = await call(page, command.method, command.path);
    const body = await json(response);
    expect(response.status(), `${command.name}: bodyless ${JSON.stringify(body)}`).toBe(command.status);
    expect(body?.ok, `${command.name}: bodyless`).toBe(true);
    if (body?.jobId) await waitForJob(page, `${command.path}/status`, body.jobId);
    if (command.name === "delete to Trash") trashed = body.messageId;
    previous = body;
    results.push({ route: `${command.method} ${command.path.replace(/\?.*$/, "")}`, name: command.name, bodyless: response.status(), action: body?.action ?? body?.method ?? null, rejected });
  }
  // The bodyless permanent delete really removed the message from Trash.
  expect((await page.request.get(`${account}/messages/${id(trashed)}`)).status()).toBe(404);
  recordQa("bodyless-command-matrix", results);
});
