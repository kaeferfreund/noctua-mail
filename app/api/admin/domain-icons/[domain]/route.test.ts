import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "fs";
import sharp from "sharp";
import type { Account } from "@/lib/data";
import { createAuthenticatedTestSession, syntheticRequestIp } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { getDomainIconsDir } from "@/lib/runtimePaths";
import { listAdminAudit } from "@/lib/db";

const { upsertAccount } = await dbModulePromise;
const { GET, PUT, DELETE } = await import("./route");
const { GET: list } = await import("../route");

const domain = `icons-${crypto.randomUUID().slice(0, 8)}.example.test`;
const accountId = `acc-domain-icon-${crypto.randomUUID()}`;
const account: Account = {
  id: accountId, name: "Domain icon", email: `team@${domain}`, avatar: "",
  // Sender icons off: the favicon fallback never goes to the network.
  settings: { appearance: { senderIcons: false } },
  imap: { host: "imap.example.test", port: 993, secure: true, user: `team@${domain}`, password: "secret" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: `team@${domain}`, password: "secret" }
};
await upsertAccount(account);

const admin = await createAuthenticatedTestSession(undefined, "admin");
// Admins manage icons only for domains of mailboxes they are a member of.
await admin.addMembership(admin.user.id, accountId, "viewer");
const memberAdmin = async () => { const session = await createAuthenticatedTestSession(undefined, "admin"); await session.addMembership(session.user.id, accountId, "viewer"); return session; };
const manager = await createAuthenticatedTestSession(accountId);
const viewer = await createAuthenticatedTestSession();
await viewer.addMembership(viewer.user.id, accountId, "viewer");

const ORIGIN = "http://localhost:3000";
const params = (value: string) => ({ params: Promise.resolve({ domain: value }) });
const iconUrl = (value: string) => `${ORIGIN}/api/admin/domain-icons/${encodeURIComponent(value)}`;

function upload(body: BodyInit | null, options: { cookie?: string; target?: string; headers?: Record<string, string> } = {}) {
  const target = options.target ?? domain;
  return PUT(new Request(iconUrl(target), {
    method: "PUT", body,
    headers: { cookie: options.cookie ?? admin.jar.header(), origin: ORIGIN, "content-type": "application/octet-stream",
      "x-forwarded-for": syntheticRequestIp(), ...options.headers }
  }), params(target));
}

function reset(cookie = admin.jar.header(), target = domain) {
  return DELETE(new Request(iconUrl(target), { method: "DELETE", headers: { cookie, origin: ORIGIN, "x-forwarded-for": syntheticRequestIp() } }), params(target));
}

function preview(headers: Record<string, string> = {}, cookie = admin.jar.header()) {
  return GET(new Request(iconUrl(domain), { headers: { cookie, ...headers } }), params(domain));
}

const logo = () => sharp({ create: { width: 120, height: 60, channels: 4, background: { r: 10, g: 120, b: 200, alpha: 1 } } }).png().toBuffer();

describe("admin domain icon routes", () => {
  test("an admin uploads, the icon is served as a 64×64 PNG with ETag, and reset restores the favicon", async () => {
    const response = await upload(await logo());
    expect(response.status).toBe(200);
    const saved = await response.json() as { ok: boolean; domain: string; version: string };
    expect(saved).toMatchObject({ ok: true, domain });
    expect(saved.version).toMatch(/^[0-9a-f]{16}$/);

    // Stored under a hash, never under the domain name.
    const files = readdirSync(getDomainIconsDir());
    expect(files.some(name => name.includes(domain))).toBe(false);
    expect(files.filter(name => /^[0-9a-f]{64}\.png$/.test(name)).length).toBeGreaterThan(0);

    const served = await preview();
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("cache-control")).toBe("private, no-cache");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    const metadata = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
    expect([metadata.format, metadata.width, metadata.height]).toEqual(["png", 64, 64]);
    const etag = served.headers.get("etag")!;
    expect((await preview({ "if-none-match": etag })).status).toBe(304);

    const listed = await (await list(new Request(`${ORIGIN}/api/admin/domain-icons`, { headers: { cookie: admin.jar.header() } }))).json() as { domains: Array<{ domain: string; mailboxes: number; version: string | null }> };
    expect(listed.domains.find(entry => entry.domain === domain)).toMatchObject({ mailboxes: 1, version: saved.version });

    const audit = await listAdminAudit({ limit: 20 });
    expect(audit.find(entry => entry.action === "domain_icon.upload" && entry.payload?.domain === domain)).toMatchObject({ actorUserId: admin.user.id });

    const removed = await reset();
    expect(await removed.json()).toEqual({ ok: true, domain, removed: true });
    expect((await listAdminAudit({ limit: 20 })).some(entry => entry.action === "domain_icon.reset" && entry.payload?.domain === domain)).toBe(true);
    expect(readdirSync(getDomainIconsDir()).length).toBe(files.length - 1);
    // No logo for a synthetic domain and the override gone: 404, no image.
    expect((await preview()).status).toBe(404);
    expect(await (await reset()).json()).toEqual({ ok: true, domain, removed: false });
  });

  test("rejects bad magic bytes, SVG and oversize uploads before storing anything", async () => {
    const before = existsSync(getDomainIconsDir()) ? readdirSync(getDomainIconsDir()).length : 0;
    const html = await upload(Buffer.from("<html><script>alert(1)</script></html>"));
    expect([html.status, (await html.json()).code]).toEqual([415, "unsupported_format"]);
    const svg = await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
    expect([svg.status, (await svg.json()).code]).toEqual([415, "unsupported_format"]);
    const broken = await upload(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]));
    expect([broken.status, (await broken.json()).code]).toEqual([422, "invalid_image"]);
    expect((await upload(Buffer.alloc(0))).status).toBe(400);

    // Declared too large: refused from the header. Streamed too large: refused
    // at the first chunk past the cap, without a declared length.
    const declared = await upload(Buffer.alloc(16), { headers: { "content-length": String(512 * 1024 + 1) } });
    expect([declared.status, (await declared.json()).code]).toEqual([413, "too_large"]);
    const chunks = [new Uint8Array(400 * 1024), new Uint8Array(200 * 1024)];
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { const next = chunks.shift(); if (next) controller.enqueue(next); else controller.close(); } });
    const streamed = await upload(stream);
    expect([streamed.status, (await streamed.json()).code]).toEqual([413, "too_large"]);

    const after = existsSync(getDomainIconsDir()) ? readdirSync(getDomainIconsDir()).length : 0;
    expect(after).toBe(before);
  });

  test("only admins may upload, reset or preview; managers and viewers get 403", async () => {
    for (const session of [manager, viewer]) {
      expect((await upload(await logo(), { cookie: session.jar.header() })).status).toBe(403);
      expect((await reset(session.jar.header())).status).toBe(403);
      expect((await preview({}, session.jar.header())).status).toBe(403);
    }
    expect((await upload(await logo(), { cookie: "" })).status).toBe(401);
  });

  test("same-origin octet-stream only; the domain must be valid and belong to a mailbox", async () => {
    // Own admin: the earlier tests used up most of the first admin's budget.
    const cookie = (await memberAdmin()).jar.header();
    expect((await upload(await logo(), { cookie, headers: { origin: "https://foreign.example.test" } })).status).toBe(403);
    expect((await upload(await logo(), { cookie, headers: { "content-type": "image/svg+xml" } })).status).toBe(400);
    for (const target of ["../../etc/passwd", ".example.test", "a/b.example.test", "EXAMPLE", "a..b.test", "-x.example.test"]) {
      const response = await upload(await logo(), { cookie, target });
      expect([target, response.status, (await response.json()).code]).toEqual([target, 400, "invalid_domain"]);
    }
    const unknown = await upload(await logo(), { cookie, target: "no-mailbox.example.test" });
    expect([unknown.status, (await unknown.json()).code]).toEqual([404, "unknown_domain"]);
    // Upper case input is normalised to the stored key.
    const upper = await upload(await logo(), { cookie, target: domain.toUpperCase() });
    expect(await upper.json()).toMatchObject({ ok: true, domain });
    expect((await reset(cookie)).status).toBe(200);
  });

  test("an admin who is not a member of a mailbox at the domain gets 404 and does not see it listed; an orphaned upload stays resettable", async () => {
    const outsider = await createAuthenticatedTestSession(undefined, "admin");
    const cookie = outsider.jar.header();
    const before = existsSync(getDomainIconsDir()) ? readdirSync(getDomainIconsDir()).length : 0;
    for (const response of [await upload(await logo(), { cookie }), await reset(cookie), await preview({}, cookie)]) {
      expect([response.status, (await response.json()).code]).toEqual([404, "unknown_domain"]);
    }
    expect(existsSync(getDomainIconsDir()) ? readdirSync(getDomainIconsDir()).length : 0).toBe(before);
    const listed = async (session: { jar: { header(): string } }) => (await (await list(new Request(`${ORIGIN}/api/admin/domain-icons`, { headers: { cookie: session.jar.header() } }))).json() as { domains: Array<{ domain: string }> }).domains.map(entry => entry.domain);
    expect(await listed(outsider)).not.toContain(domain);
    expect(await listed(admin)).toContain(domain);
    // A domain no mailbox uses any more: its upload is listed for every admin and can be reset.
    const orphan = `orphan-${crypto.randomUUID().slice(0, 8)}.example.test`;
    const { saveDomainIcon } = await import("@/lib/domainIcons");
    await saveDomainIcon(orphan, await sharp(await logo()).resize(64, 64).png().toBuffer(), admin.user.id);
    expect(await listed(outsider)).toContain(orphan);
    expect(await (await reset(cookie, orphan)).json()).toEqual({ ok: true, domain: orphan, removed: true });
  });

  test("rate-limits uploads per admin", async () => {
    const busy = await memberAdmin();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) statuses.push((await upload(Buffer.from("x"), { cookie: busy.jar.header() })).status);
    expect(statuses.slice(0, 10).every(status => status === 415)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
