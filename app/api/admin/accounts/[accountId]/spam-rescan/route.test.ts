import { afterAll, describe, expect, test } from "bun:test";
import { createAuthenticatedTestSession, syntheticRequestIp } from "@/lib/testAuthHarness";
import { createCollabFixture } from "@/lib/testThreadCollabHarness";
import { EMPTY_STATIC_RULES } from "@/lib/mail/spam/staticRules";

// Real routes, sessions and DBs; the scan's static rules are stubbed and no model is used (withModel false).
const { GET, POST } = await import("./route");
const { POST: cancel } = await import("./cancel/route");
const { POST: move } = await import("./move/route");
const { GET: activity } = await import("../../../spam-rescan/route");
const rescan = await import("@/lib/mail/spam/rescan");
const restore = rescan.replaceSpamRescanDeps({ loadStaticRules: async () => EMPTY_STATIC_RULES });
afterAll(async () => { await rescan.spamRescansIdle(); restore(); });

const f = await createCollabFixture();
await f.seed(f.message("<rescan-route@example.test>", { mailboxPath: "INBOX", imapUid: 7, dateValue: Date.now() - 2 * 24 * 60 * 60_000 }));
// Admins reach the rescan only for their own mailboxes: `admin` reads this one, `outsider` is no member.
const admin = await createAuthenticatedTestSession(undefined, "admin");
await admin.addMembership(admin.user.id, f.accountId, "viewer");
const outsider = await createAuthenticatedTestSession(undefined, "admin");
const manager = await createAuthenticatedTestSession(f.accountId);

const ORIGIN = "http://localhost:3000";
const url = (suffix = "") => `${ORIGIN}/api/admin/accounts/${encodeURIComponent(f.accountId)}/spam-rescan${suffix}`;
const params = (accountId = f.accountId) => ({ params: Promise.resolve({ accountId }) });
const headers = (cookie: string, extra: Record<string, string> = {}) => ({ cookie, origin: ORIGIN, "x-forwarded-for": syntheticRequestIp(), ...extra });
const json = (cookie: string, body: unknown, target = url()) =>
  new Request(target, { method: "POST", headers: headers(cookie, { "content-type": "application/json" }), body: JSON.stringify(body) });

describe("admin spam rescan routes", () => {
  test("only admins read the counts or start a scan; mailbox managers are refused", async () => {
    expect((await GET(new Request(url("?period=30d"), { headers: { cookie: manager.jar.header() } }), params())).status).toBe(403);
    expect((await POST(json(manager.jar.header(), { period: "30d", withModel: false }), params())).status).toBe(403);
    expect((await activity(new Request(`${ORIGIN}/api/admin/spam-rescan`, { headers: { cookie: manager.jar.header() } }))).status).toBe(403);
    const response = await GET(new Request(url("?period=30d"), { headers: { cookie: admin.jar.header() } }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, preview: { period: "30d", inboxRows: 1, unchecked: 1, hasJunkFolder: false }, job: null, items: [] });
    expect((await GET(new Request(url("?period=week"), { headers: { cookie: admin.jar.header() } }), params())).status).toBe(400);
    expect((await GET(new Request(url(), { headers: { cookie: admin.jar.header() } }), params("missing-account"))).status).toBe(404);
  });

  test("an admin without membership gets 404 everywhere, as for an unknown mailbox, and sees neither the mailbox nor its jobs", async () => {
    const cookie = outsider.jar.header();
    for (const response of [
      await GET(new Request(url("?period=30d"), { headers: { cookie } }), params()),
      await POST(json(cookie, { period: "30d", withModel: false }), params()),
      await cancel(new Request(url("/cancel"), { method: "POST", headers: headers(cookie) }), params()),
      await move(json(cookie, { jobId: "any", ids: ["x"] }, url("/move")), params())
    ]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: "account_not_found" });
    }
    expect(await (await GET(new Request(url(), { headers: { cookie } }), params("missing-account"))).json()).toMatchObject({ code: "account_not_found" });
    expect((await rescan.loadSpamRescanState(f.accountId)).job).toBeNull();

    const { GET: settings } = await import("../../../spam-settings/route");
    const own = await (await settings(new Request(`${ORIGIN}/api/admin/spam-settings`, { headers: { cookie: admin.jar.header() } }))).json() as { rescanMailboxes: Array<{ accountId: string; email: string }> };
    expect(own.rescanMailboxes).toContainEqual({ accountId: f.accountId, email: "team@example.test" });
    const foreign = await (await settings(new Request(`${ORIGIN}/api/admin/spam-settings`, { headers: { cookie } }))).json() as { rescanMailboxes: Array<{ accountId: string }> };
    expect(foreign.rescanMailboxes.some((mailbox) => mailbox.accountId === f.accountId)).toBe(false);
  });

  test("a foreign origin or a non-JSON body is refused before anything starts", async () => {
    const foreign = new Request(url(), { method: "POST", headers: { ...headers(admin.jar.header(), { "content-type": "application/json" }), origin: "https://foreign.example.test" },
      body: JSON.stringify({ period: "30d", withModel: false }) });
    expect((await POST(foreign, params())).status).toBe(403);
    const text = new Request(url(), { method: "POST", headers: headers(admin.jar.header(), { "content-type": "text/plain" }), body: "{}" });
    expect((await POST(text, params())).status).toBe(400);
    expect((await POST(json(admin.jar.header(), { period: "30d", withModel: true }), params())).status).toBe(400);
  });

  test("start, one job per mailbox, cancel and move validation", async () => {
    // The scan waits until released, so the second start meets the running one.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const restoreGate = rescan.replaceSpamRescanDeps({ loadStaticRules: async () => { await gate; return EMPTY_STATIC_RULES; } });
    let jobId: string;
    try {
      const started = await POST(json(admin.jar.header(), { period: "all", withModel: false }), params());
      expect(started.status).toBe(202);
      const { job } = await started.json() as { job: { id: string; status: string } };
      expect(job.status).toBe("running");
      jobId = job.id;
      const second = await POST(json(admin.jar.header(), { period: "all", withModel: false }), params());
      expect(second.status).toBe(409);
      expect(await second.json()).toMatchObject({ code: "rescan_running" });
      const running = await (await activity(new Request(`${ORIGIN}/api/admin/spam-rescan`, { headers: { cookie: admin.jar.header() } }))).json() as { jobs: unknown[] };
      expect(running.jobs).toContainEqual(expect.objectContaining({ id: job.id, accountId: f.accountId, mailbox: "Synthetic shared inbox", status: "running" }));
      const hidden = await (await activity(new Request(`${ORIGIN}/api/admin/spam-rescan`, { headers: { cookie: outsider.jar.header() } }))).json() as { jobs: Array<{ id: string }> };
      expect(hidden.jobs.some((entry) => entry.id === job.id)).toBe(false);
      expect((await cancel(new Request(url("/cancel"), { method: "POST", headers: headers(outsider.jar.header()) }), params())).status).toBe(404);
      expect((await cancel(new Request(url("/cancel"), { method: "POST", headers: headers(admin.jar.header()) }), params())).status).toBe(202);
    } finally {
      release();
      await rescan.spamRescansIdle();
      restoreGate();
    }
    const state = await (await GET(new Request(url("?period=all"), { headers: { cookie: admin.jar.header() } }), params())).json() as { job: { status: string } };
    expect(state.job.status).toBe("cancelled");

    const idle = await cancel(new Request(url("/cancel"), { method: "POST", headers: headers(admin.jar.header()) }), params());
    expect(idle.status).toBe(409);
    expect(await idle.json()).toMatchObject({ code: "rescan_not_running" });
    expect((await move(json(admin.jar.header(), { jobId, ids: "all" }, url("/move")), params())).status).toBe(400);
    expect((await move(json(admin.jar.header(), { jobId: "unknown", ids: ["x"] }, url("/move")), params())).status).toBe(404);
    // A job of another mailbox is not found under this one, and nothing of it is selected.
    const otherMailbox = await createCollabFixture();
    const foreign = await rescan.startSpamRescan({ accountId: otherMailbox.accountId, period: "all", withModel: false, modelLimit: 0, userId: admin.user.id });
    await rescan.spamRescansIdle();
    const crossed = await move(json(admin.jar.header(), { jobId: foreign.id, ids: ["x"] }, url("/move")), params());
    expect(crossed.status).toBe(404);
    expect(await crossed.json()).toMatchObject({ code: "rescan_not_found" });
    expect((await rescan.loadSpamRescanState(otherMailbox.accountId)).job).toMatchObject({ id: foreign.id, status: "ready" });

  });

  test("start, cancel and move share a per-admin rate limit", async () => {
    const other = await createAuthenticatedTestSession(undefined, "admin");
    await other.addMembership(other.user.id, f.accountId, "viewer");
    const statuses: number[] = [];
    for (let index = 0; index < 11; index += 1) {
      statuses.push((await cancel(new Request(url("/cancel"), { method: "POST", headers: headers(other.jar.header()) }), params())).status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 409)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
