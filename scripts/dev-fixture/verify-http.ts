/** Opt-in proof against a running app and fixture. Not part of bun test. */
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import type { Folder, Message } from "../../lib/data";
import { demoPass, demoUser } from "./seed";
const { values } = parseArgs({ args: process.argv.slice(2), options: { "base-url": { type: "string", default: "http://localhost:3786" }, "invite-code": { type: "string" } } });
let cookie = "";
async function request(path: string, body?: unknown) {
  const response = await fetch(`${values["base-url"]}${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  assert(response.ok, `${path}: HTTP ${response.status} ${response.ok ? "" : await response.text()}`);
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return response;
}
if (values["invite-code"]) {
  const signup = await (await request("/api/auth/signup", { inviteCode: values["invite-code"], account: { id: "ignored-server-derives-id", name: "MonkeyDent", email: demoUser, avatar: "MD", imap: { host: "127.0.0.1", port: 3789, secure: false, user: demoUser, password: demoPass }, smtp: { host: "127.0.0.1", port: 3787, secure: false, user: demoUser, password: demoPass } } })).json();
  console.log("signup", JSON.stringify(signup));
}
const login = await (await request("/api/auth/login", { email: demoUser, password: demoPass })).json() as { ok: boolean; accountId: string };
console.log("login", JSON.stringify(login));
const api = `/api/accounts/${login.accountId}`;
async function sync(path: string) {
  const started = await (await request(`${api}/sync`, { folderId: `${login.accountId}:${path}`, mode: "full" })).json() as { jobId: string };
  for (let attempt = 0; attempt < 120; attempt++) {
    const status = await (await request(`${api}/sync/status?jobId=${started.jobId}`)).json() as { job: { status: string; error?: string; result?: { count: number } } };
    assert.notEqual(status.job.status, "failed", status.job.error);
    if (status.job.status === "done") { console.log(`sync ${path}: done count=${status.job.result?.count}`); return; }
    await sleep(250);
  }
  throw new Error(`Sync timed out: ${path}`);
}
await sync("INBOX");
const folders = await (await request(`${api}/folders`)).json() as Folder[];
const expectedCounts = new Map([["INBOX", 60], ["Sent", 15], ["Drafts", 3], ["Trash", 3], ["Junk", 2], ["Archive", 4], ["Projekte", 0], ["Projekte/Website", 3]]);
assert.equal(folders.length, expectedCounts.size);
for (const folder of folders) {
  const path = folder.id.slice(login.accountId.length + 1);
  if (path !== "INBOX") await sync(path);
}
console.log("folders", folders.map(f => `${f.id.slice(login.accountId.length + 1)}${f.specialUse ? ` (${f.specialUse})` : ""}`).join(", "));
const messages = await (await request(`${api}/messages?pageSize=1000`)).json() as { items: Message[]; total: number };
assert.equal(messages.total, 90, "Use a freshly seeded fixture (without injections or sent test mail)");
for (const [path, count] of expectedCounts) assert.equal(messages.items.filter(m => m.folderId === `${login.accountId}:${path}`).length, count, path);
const inbox = messages.items.filter(m => m.folderId.endsWith(":INBOX"));
assert.equal(new Set(inbox.map(m => m.threadId)).size, 25);
const unread = inbox.filter(m => m.unread).length;
const flagged = inbox.filter(m => m.flagged).length;
assert(unread > 0 && flagged > 0);
for (const message of inbox) if (message.inReplyTo) assert(message.references?.includes(message.inReplyTo));
const sent = messages.items.filter(m => m.folderId.endsWith(":Sent"));
assert(sent.some(m => m.from.includes("Alex Beispiel")) && sent.some(m => m.from.includes("Toni Muster")));
assert(messages.items.filter(m => m.folderId.endsWith(":Drafts")).every(m => m.draft));
const threads = await (await request(`${api}/threads?folderId=${encodeURIComponent(`${login.accountId}:INBOX`)}&pageSize=1000`)).json() as { items: Message[]; total: number };
const threadCount = new Set(threads.items.map(m => m.threadId)).size;
assert.equal(threadCount, 25);
console.log(`messages=${messages.total}; INBOX=${inbox.length}; threads API: ${threadCount} conversations / ${threads.items.length} messages (total=${threads.total}); unread=${unread}; flagged=${flagged}; sent team members=2; drafts=3`);
const attachmentTypes = new Set<string>();
for (const summary of messages.items.filter(m => m.hasAttachments || m.hasInlineAttachments || m.subject === "Einladung zur Teambesprechung")) {
  const { message } = await (await request(`${api}/messages/${summary.id}`)).json() as { message: Message };
  for (const attachment of message.attachments ?? []) {
    const response = await request(`${api}/messages/${message.id}/attachments/${attachment.id}`);
    const data = Buffer.from(await response.arrayBuffer());
    assert(data.length > 0);
    if (attachment.contentType === "application/pdf") assert(data.toString().startsWith("%PDF-1.4"));
    if (attachment.contentType === "text/calendar") assert(data.toString().includes("METHOD:REQUEST"));
    attachmentTypes.add(attachment.contentType);
  }
}
for (const type of ["application/pdf", "image/png", "text/calendar"]) assert(attachmentTypes.has(type), type);
const newsletter = inbox.find(m => m.subject === "Praxispost im Oktober");
assert(newsletter?.hasInlineAttachments);
const details = await (await request(`${api}/messages/${newsletter.id}`)).json() as { message: Message };
assert(details.message.htmlBody?.includes("MonkeyDent Praxispost"));
console.log(`attachment downloads verified: ${[...attachmentTypes].sort().join(", ")}; newsletter HTML + inline image verified`);
