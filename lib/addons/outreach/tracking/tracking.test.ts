import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET as getOpen, HEAD as headOpen } from "@/app/t/o/[filename]/route";
import { GET as getClick, HEAD as headClick } from "@/app/t/c/[token]/route";
import { closeOutreachDb, getOutreachDb } from "../db";
import { newOutreachToken } from "../ids";
import { saveOutreachSettings } from "../settings";
import { getMessageTracking, getOutreachOverview, getSendStats, listLinkStats, listSendSummaries, listTrackingEvents,
  prepareTrackedHtml, recordTrackingEvent, runTrackingRetention } from "./index";
import { DAY_MS, truncateTrackingIp } from "./ip";

const accountId = "mailbox-a";
const origin = "https://links.example.test";
const target = "https://target.example.test/a?x=1&y=2";
const envKeys = ["NOCTUA_DATA_DIR", "NOCTUA_ADDON_OUTREACH", "NOCTUA_OUTREACH_PUBLIC_URL", "BETTER_AUTH_URL", "NOCTUA_OUTREACH_GEOIP_DB"] as const;
let env: Array<string | undefined>;
let dir: string;

beforeEach(() => {
  env = envKeys.map(key => process.env[key]);
  dir = mkdtempSync(join(tmpdir(), "outreach-tracking-"));
  process.env.NOCTUA_DATA_DIR = dir;
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  process.env.NOCTUA_OUTREACH_PUBLIC_URL = origin;
  delete process.env.NOCTUA_OUTREACH_GEOIP_DB;
});
afterEach(() => {
  closeOutreachDb();
  for (const [i, key] of envKeys.entries()) {
    if (env[i] === undefined) delete process.env[key];
    else process.env[key] = env[i];
  }
  rmSync(dir, { recursive: true, force: true });
});

async function seedSend(id = "send-a", mailbox = accountId, kind = "campaign", sentAt = Date.now() - 60_000) {
  const db = await getOutreachDb();
  db.prepare(`INSERT INTO sends (id, accountId, kind, campaignId, contactId, messageId, recipients, subject, status, queuedAt, sentAt)
    VALUES (?, ?, ?, 'campaign-a', ?, ?, 'recipient@example.test', 'Synthetic mail', 'sent', ?, ?)`)
    .run(id, mailbox, kind, `contact-${id}`, `<${id}@example.test>`, sentAt, sentAt);
  return db;
}

async function rewrite(html: string) {
  return prepareTrackedHtml({ accountId, sendId: "send-a", html, trackOpens: true, trackClicks: true,
    keepUrls: ["https://target.example.test/keep"] });
}

test("rewrites only eligible hrefs and preserves surrounding markup and entities", async () => {
  const db = await seedSend();
  const untouched = [
    `<a href="mailto:a@example.test">Mail</a>`, `<a href="tel:+123">Phone</a>`, `<a href="#id">Fragment</a>`,
    `<a href="/t/u/synthetic">Relative tracking</a>`, `<a href="${origin}/t/c/synthetic">Tracking</a>`,
    `<a href="https://target.example.test/keep">Keep</a>`, `<a href="/relative">Relative</a>`,
    `<a href="//target.example.test/path">Protocol relative</a>`, `<a href="https:target.example.test">Invalid</a>`,
    `<a href="https:///target.example.test">Invalid</a>`, `<a href="https://bad target.example.test">Invalid</a>`,
    `<a href="javascript:noop()">Script URL</a>`, `<!-- <a href="https://target.example.test/comment"> -->`,
    `<script>const sample = '<a href="https://target.example.test/script">'</script>`,
    `<img src="https://target.example.test/image">`, `<a title="href='https://target.example.test/title'">Title</a>`
  ];
  const input = `<!doctype html><html><head><title>Example</title></head><BODY style="color: #111">
<A data-label='a>b' HREF='https://target.example.test/a?x=1&amp;y=2'>first</A>
<a href=${target}>second</a>${untouched.join("")}</BODY></html>`;
  const html = await rewrite(input);
  const [click, open] = db.prepare("SELECT token, kind, url FROM tracking_links WHERE accountId = ? ORDER BY kind").all(accountId) as
    Array<{ token: string; kind: string; url: string | null }>;
  expect(click).toMatchObject({ kind: "click", url: target });
  expect(open).toMatchObject({ kind: "open", url: null });
  expect(html).toContain(`<A data-label='a>b' href="${origin}/t/c/${click.token}">first</A>`);
  expect(html).toContain(`<a href="${origin}/t/c/${click.token}">second</a>`);
  for (const tag of untouched) expect(html).toContain(tag);
  expect(html).toEndWith(`<img src="${origin}/t/o/${open.token}.gif" width="1" height="1" alt=""></BODY></html>`);
  expect(html.match(/\/t\/o\//g)).toHaveLength(1);
});

test("can rewrite malformed fragments and skips preparation without a public origin or active switches", async () => {
  const db = await seedSend();
  const html = '<b><a href="https://target.example.test"><i>Test</b> <a href="https://target.example.test/broken';
  const input = { accountId, sendId: "send-a", html, trackOpens: false, trackClicks: false };
  expect(await prepareTrackedHtml(input)).toBe(html);
  delete process.env.NOCTUA_OUTREACH_PUBLIC_URL;
  delete process.env.BETTER_AUTH_URL;
  expect(await prepareTrackedHtml({ ...input, trackOpens: true })).toBe(html);
  expect(db.prepare("SELECT * FROM tracking_links WHERE accountId = ?").all(accountId)).toHaveLength(0);
  process.env.NOCTUA_OUTREACH_PUBLIC_URL = origin;
  expect(await prepareTrackedHtml({ ...input, trackClicks: true })).toContain(`href="${origin}/t/c/`);
  expect(db.prepare("SELECT kind FROM tracking_links WHERE accountId = ?").all(accountId)).toEqual([{ kind: "click" }]);
});

test("public routes use opaque tokens, keep the pixel constant, store HEAD as machine and fail closed", async () => {
  const db = await seedSend();
  const html = await rewrite(`<a href="${target.replace("&", "&amp;")}">Link</a>`);
  const token = html.match(/\/t\/c\/([\w-]+)/)![1];
  const filename = html.match(/\/t\/o\/([\w-]+\.gif)/)![1];
  const address = "192.0.2.12";
  const headers = { "x-forwarded-for": `192.0.2.99, ${address}`, "user-agent": "Mozilla/5.0 Firefox/130.0 Linux" };
  const request = (path: string, method = "GET") => new Request(origin + path, { headers, method });
  const open = await getOpen(request(`/t/o/${filename}`), { params: Promise.resolve({ filename }) });
  const unknownFilename = `${newOutreachToken()}.gif`;
  const unknownOpen = await getOpen(request(`/t/o/${unknownFilename}`), { params: Promise.resolve({ filename: unknownFilename }) });
  expect(open.status).toBe(200);
  expect(unknownOpen.status).toBe(200);
  expect(open.headers.get("content-type")).toBe("image/gif");
  expect(open.headers.get("cache-control")).toBe("no-store, private");
  expect(open.headers.get("set-cookie")).toBeNull();
  const image = await open.arrayBuffer();
  expect(image.byteLength).toBe(43);
  expect(await unknownOpen.arrayBuffer()).toEqual(image);
  expect((await headOpen(request(`/t/o/${filename}`, "HEAD"), { params: Promise.resolve({ filename }) })).body).toBeNull();
  const poison = "?url=https://other.example.test";
  const click = await getClick(request(`/t/c/${token}${poison}`), { params: Promise.resolve({ token }) });
  expect(click.status).toBe(302);
  expect(click.headers.get("location")).toBe(target);
  expect(click.headers.get("referrer-policy")).toBe("no-referrer");
  expect(click.headers.get("set-cookie")).toBeNull();
  expect((await headClick(request(`/t/c/${token}`, "HEAD"), { params: Promise.resolve({ token }) })).status).toBe(302);
  for (const invalid of [newOutreachToken(), filename.slice(0, -4), "https://other.example.test"]) {
    const result = await getClick(request(`/t/c/${encodeURIComponent(invalid)}${poison}`), { params: Promise.resolve({ token: invalid }) });
    expect(result.status).toBe(404);
    expect(result.headers.get("location")).toBeNull();
    expect(await result.text()).toBe("Not found");
  }
  expect(db.prepare("SELECT type, machine, ip FROM tracking_events WHERE accountId = ? ORDER BY id").all(accountId)).toEqual([
    { type: "open", machine: 0, ip: address }, { type: "open", machine: 1, ip: address },
    { type: "click", machine: 0, ip: address }, { type: "click", machine: 1, ip: address }
  ]);
  db.prepare("UPDATE tracking_links SET url = 'javascript:noop()' WHERE accountId = ? AND token = ?").run(accountId, token);
  expect((await getClick(request(`/t/c/${token}`), { params: Promise.resolve({ token }) })).status).toBe(404);
  delete process.env.NOCTUA_ADDON_OUTREACH;
  expect((await getOpen(request(`/t/o/${filename}`), { params: Promise.resolve({ filename }) })).status).toBe(404);
  expect((await getClick(request(`/t/c/${token}`), { params: Promise.resolve({ token }) })).status).toBe(404);
});

test("rate limiting drops events while preserving the GIF and redirect independently of spoofed leading hops", async () => {
  await seedSend();
  const html = await rewrite(`<a href="https://target.example.test/rate">Link</a>`);
  const token = html.match(/\/t\/c\/([\w-]+)/)![1];
  const filename = html.match(/\/t\/o\/([\w-]+\.gif)/)![1];
  const request = (path: string, left = "192.0.2.13", right = "192.0.2.14") =>
    new Request(origin + path, { headers: { "x-forwarded-for": `${left}, ${right}` } });
  for (let i = 0; i < 120; i++) {
    const response = await getClick(request(`/t/c/${token}`), { params: Promise.resolve({ token }) });
    expect(response.status).toBe(302);
  }
  const redirect = await getClick(request(`/t/c/${token}`, "192.0.2.15"), { params: Promise.resolve({ token }) });
  expect(redirect.headers.get("location")).toBe("https://target.example.test/rate");
  const pixel = await getOpen(request(`/t/o/${filename}`), { params: Promise.resolve({ filename }) });
  expect((await pixel.arrayBuffer()).byteLength).toBe(43);
  expect(await getMessageTracking(accountId, { sendId: "send-a" })).toMatchObject({ clicks: 120, opens: 0 });
  await getOpen(request(`/t/o/${filename}`, "192.0.2.15", "192.0.2.16"), { params: Promise.resolve({ filename }) });
  expect(await getMessageTracking(accountId, { sendId: "send-a" })).toMatchObject({ opens: 1 });
});

test("IP retention is per mailbox, bounded, idempotent and normalizes mapped IPv4", async () => {
  const db = await seedSend();
  await seedSend("send-b", "mailbox-b");
  await saveOutreachSettings(accountId, { ipRetentionDays: 0 }, "user-a");
  await saveOutreachSettings("mailbox-b", { ipRetentionDays: 2 }, "user-a");
  const now = Date.now();
  await recordTrackingEvent({ accountId, sendId: "send-a", type: "open", ip: "::ffff:192.0.2.44", at: now });
  await recordTrackingEvent({ accountId: "mailbox-b", sendId: "send-b", type: "open", ip: "2001:0DB8:0123:4567::89", at: now });
  expect((await listTrackingEvents(accountId, {})).events[0]).toMatchObject({ ip: "192.0.2.0", ipTruncated: true });
  expect((await listTrackingEvents("mailbox-b", {})).events[0]).toMatchObject({ ip: "2001:db8:123:4567::89", ipTruncated: false });
  expect(truncateTrackingIp("::1")).toBe("::");
  expect(truncateTrackingIp("2001:db8::1:192.0.2.1")).toBe("2001:db8::");
  expect(truncateTrackingIp("invalid")).toBeNull();
  const extra = db.prepare(`INSERT INTO tracking_events (accountId, sendId, type, at, ip) VALUES ('mailbox-b', 'send-b', 'click', ?, '192.0.2.2')`);
  for (let i = 0; i < 500; i++) extra.run(now + i);
  expect(await runTrackingRetention(now + 2 * DAY_MS - 1)).toBe(0);
  expect(await runTrackingRetention(now + 3 * DAY_MS)).toBe(500);
  expect(await runTrackingRetention(now + 3 * DAY_MS)).toBe(1);
  expect(await runTrackingRetention(now + 3 * DAY_MS)).toBe(0);
  const retained = await listTrackingEvents("mailbox-b", { type: "open" });
  expect(retained.events[0]).toMatchObject({ ip: "2001:db8:123::", ipTruncated: true });
});

test("immediate truncation deduplicates one client without merging clients on the same network", async () => {
  await seedSend();
  await saveOutreachSettings(accountId, { ipRetentionDays: 0 }, "user-a");
  const input = { accountId, sendId: "send-a", type: "open" as const, userAgent: "GoogleImageProxy" };
  await recordTrackingEvent({ ...input, ip: "192.0.2.41" });
  await recordTrackingEvent({ ...input, ip: "::ffff:192.0.2.41" });
  await recordTrackingEvent({ ...input, ip: "192.0.2.42" });
  const { events } = await listTrackingEvents(accountId, {});
  expect(events).toHaveLength(2);
  for (const event of events) expect(event).toMatchObject({ ip: "192.0.2.0", ipTruncated: true, clientType: "proxy" });
});

test("read models count unique human sends, preserve individual counts and page tied timestamps", async () => {
  const now = Date.now();
  const db = await seedSend("send-a", accountId, "campaign", now - 80_000);
  await seedSend("send-b", accountId, "campaign", now - 80_000);
  await seedSend("test-a", accountId, "test", now - 70_000);
  await seedSend("foreign", "mailbox-b", "campaign", now - 70_000);
  for (const sendId of ["send-a", "send-b", "test-a"]) {
    await prepareTrackedHtml({ accountId, sendId, html: `<a href="https://target.example.test/report">Report</a>`, trackOpens: false, trackClicks: true });
  }
  for (const sendId of ["send-a", "send-b", "test-a", "foreign"]) {
    const mailbox = sendId === "foreign" ? "mailbox-b" : accountId;
    const input = { accountId: mailbox, sendId, ip: "192.0.2.23" };
    const url = "https://target.example.test/report";
    await recordTrackingEvent({ ...input, type: "open", at: now, userAgent: "Proofpoint" });
    await recordTrackingEvent({ ...input, type: "open", at: now, userAgent: "GoogleImageProxy" });
    await recordTrackingEvent({ ...input, type: "open", at: now - 13_000, userAgent: "GoogleImageProxy" });
    await recordTrackingEvent({ ...input, type: "open", at: now - 63_000, userAgent: "GoogleImageProxy" });
    await recordTrackingEvent({ ...input, type: "click", at: now, url });
    await recordTrackingEvent({ ...input, type: "click", at: now, url });
    await recordTrackingEvent({ ...input, type: "click", at: now, url, detail: { requestMethod: "HEAD" } });
  }
  await recordTrackingEvent({ accountId, sendId: "send-a", type: "bounce", at: now });
  await recordTrackingEvent({ accountId, sendId: "foreign", type: "bounce", at: now });
  const stats = await getSendStats(accountId, { campaignId: "campaign-a" });
  expect(stats).toMatchObject({ recipients: 2, sent: 2, opened: 2, clicked: 2, machineOpens: 2, bounced: 1 });
  expect(await getSendStats(accountId, { kinds: ["test"] })).toMatchObject({ recipients: 0 });
  expect(await getMessageTracking(accountId, { messageId: "send-a@example.test" })).toMatchObject({
    sendId: "send-a", opens: 2, machineOpens: 1, clicks: 2, bounced: true, firstOpenedAt: now - 63_000, lastOpenedAt: now,
    lastClickedAt: now, lastEvent: { type: "click", machine: false, ip: "192.0.2.23" }
  });
  expect(await getMessageTracking(accountId, { sendId: "test-a" })).toBeNull();
  expect(await getMessageTracking(accountId, { sendId: "foreign" })).toBeNull();
  expect(await listLinkStats(accountId, { campaignId: "campaign-a" })).toEqual([
    { url: "https://target.example.test/report", clicks: 4, uniqueClicks: 2 }
  ]);
  const first = await listSendSummaries(accountId, { campaignId: "campaign-a" }, { limit: 1 });
  expect(first.items).toMatchObject([{ sendId: "send-b", opens: 2, clicks: 2 }]);
  expect(first.nextCursor).not.toBeNull();
  const second = await listSendSummaries(accountId, { campaignId: "campaign-a" }, { limit: 1, cursor: first.nextCursor });
  expect(second.items).toMatchObject([{ sendId: "send-a", bounced: true }]);
  expect(second.nextCursor).toBeNull();
  const page = await listTrackingEvents(accountId, { campaignId: "campaign-a", type: "click", limit: 2 });
  expect(page.events).toHaveLength(2);
  expect(page.nextBefore).not.toBeNull();
  const next = await listTrackingEvents(accountId, { campaignId: "campaign-a", type: "click", limit: 2, before: page.nextBefore! });
  expect(next.events.map(event => event.sendId)).toEqual(["send-a", "send-a"]);
  expect(next.nextBefore).toBeNull();
  expect((await listTrackingEvents(accountId, { type: "click", includeMachine: true })).events).toHaveLength(6);
  db.prepare(`INSERT INTO lists (id, accountId, name, createdAt, updatedAt) VALUES ('list-a', ?, 'Synthetic', ?, ?)`).run(accountId, now, now);
  expect(await getOutreachOverview(accountId, now)).toMatchObject({ lists: 1, last30Days: stats });
  expect(await getOutreachOverview(accountId, now + 31 * DAY_MS)).toMatchObject({ last30Days: { recipients: 0 } });
});
