import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import webpush from "web-push";
import { createPushNotifier, replacePushNotifier } from "@/lib/push/send";
import type { PushTransport } from "@/lib/push/server";
import { DEFAULT_PUSH_DEVICE_SETTINGS } from "@/lib/push/types";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { GET as getVapidKey } from "./vapid-public-key/route";
import { DELETE as deleteByEndpoint, GET as listSubscriptions, POST as subscribe } from "./subscriptions/route";
import { DELETE as deleteById, PUT as updateSettings } from "./subscriptions/[id]/route";
import { POST as sendTest } from "./test/route";

const ORIGIN = "http://localhost:3000";
const keys = webpush.generateVAPIDKeys();
const VAPID_ENV = { NOCTUA_VAPID_PUBLIC_KEY: keys.publicKey, NOCTUA_VAPID_PRIVATE_KEY: keys.privateKey, NOCTUA_VAPID_SUBJECT: "mailto:admin@example.test" };
const previousEnv = Object.fromEntries(Object.keys(VAPID_ENV).map((key) => [key, process.env[key]]));
const sent: string[] = [];
const transport: PushTransport = async (target) => { sent.push(target.endpoint); return { ok: true }; };

function configure(on: boolean) {
  for (const [key, value] of Object.entries(VAPID_ENV)) {
    if (on) process.env[key] = value;
    else delete process.env[key];
  }
}

beforeAll(() => {
  configure(true);
  replacePushNotifier(createPushNotifier({ transport: () => transport }));
});
afterAll(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  replacePushNotifier(undefined);
});

function request(path: string, method: string, cookie: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/push${path}`, {
    method,
    headers: { cookie, origin: ORIGIN, "user-agent": "Synthetic Browser/1.0", ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function subscription(endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`, fill = 4) {
  return { endpoint, expirationTime: null, keys: { p256dh: Buffer.alloc(65, fill).toString("base64url"), auth: Buffer.alloc(16, fill).toString("base64url") } };
}

async function signedIn() {
  const session = await createAuthenticatedTestSession();
  return { ...session, cookie: session.jar.header() };
}

describe("push API", () => {
  test("every route requires a signed-in session", async () => {
    const responses = await Promise.all([
      getVapidKey(request("/vapid-public-key", "GET", "")),
      listSubscriptions(request("/subscriptions", "GET", "")),
      subscribe(request("/subscriptions", "POST", "", { subscription: subscription() })),
      deleteByEndpoint(request("/subscriptions", "DELETE", "", { endpoint: "https://fcm.googleapis.com/x" })),
      updateSettings(request("/subscriptions/x", "PUT", "", { settings: DEFAULT_PUSH_DEVICE_SETTINGS }), params("x")),
      deleteById(request("/subscriptions/x", "DELETE", ""), params("x")),
      sendTest(request("/test", "POST", ""))
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
  });

  test("not configured: no public key (404), no subscribe or test (503)", async () => {
    const user = await signedIn();
    configure(false);
    try {
      expect((await getVapidKey(request("/vapid-public-key", "GET", user.cookie))).status).toBe(404);
      expect((await subscribe(request("/subscriptions", "POST", user.cookie, { subscription: subscription() }))).status).toBe(503);
      expect((await sendTest(request("/test", "POST", user.cookie))).status).toBe(503);
      expect((await listSubscriptions(request("/subscriptions", "GET", user.cookie))).status).toBe(200);
    } finally {
      configure(true);
    }
    const response = await getVapidKey(request("/vapid-public-key", "GET", user.cookie));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, publicKey: keys.publicKey });
  });

  test("subscribe upserts by endpoint and never returns the endpoint", async () => {
    const user = await signedIn();
    const device = subscription();
    const first = await subscribe(request("/subscriptions", "POST", user.cookie, { subscription: device }));
    expect(first.status).toBe(200);
    const created = await first.json();
    expect(created).toMatchObject({ ok: true, settings: DEFAULT_PUSH_DEVICE_SETTINGS });
    const settings = { ...DEFAULT_PUSH_DEVICE_SETTINGS, includeSubject: false };
    const again = await (await subscribe(request("/subscriptions", "POST", user.cookie, { subscription: subscription(device.endpoint, 7), settings, userAgent: "Synthetic Phone" }))).json();
    expect(again).toEqual({ ok: true, id: created.id, settings });
    const stored = user.master.prepare("SELECT p256dh, userAgent FROM push_subscriptions WHERE id = ?").get(created.id);
    expect(stored).toEqual({ p256dh: Buffer.alloc(65, 7).toString("base64url"), userAgent: "Synthetic Phone" });

    const listResponse = await listSubscriptions(request("/subscriptions", "GET", user.cookie));
    const listText = await listResponse.text();
    expect(listText).not.toContain(device.endpoint);
    const list = JSON.parse(listText);
    expect(list.subscriptions).toEqual([{ id: created.id, endpointHash: expect.stringMatching(/^[0-9a-f]{16}$/), userAgent: "Synthetic Phone", settings, createdAt: expect.any(Number), lastSeenAt: expect.any(Number) }]);
  });

  test("rejects invalid bodies, foreign origins and non-push endpoints", async () => {
    const user = await signedIn();
    const valid = subscription();
    for (const body of [
      {}, { subscription: null }, { subscription: valid, extra: 1 },
      { subscription: { ...valid, endpoint: "https://push.example.test/x" } },
      { subscription: { ...valid, endpoint: "https://127.0.0.1/x" } },
      { subscription: { ...valid, keys: { p256dh: "short", auth: valid.keys.auth } } },
      { subscription: { ...valid, keys: { p256dh: valid.keys.p256dh, auth: Buffer.alloc(8).toString("base64url") } } },
      { subscription: valid, settings: { accountIds: "all" } },
      { subscription: valid, userAgent: 5 }
    ]) expect((await subscribe(request("/subscriptions", "POST", user.cookie, body))).status).toBe(400);
    expect((await subscribe(request("/subscriptions", "POST", user.cookie, { subscription: valid }, { origin: "https://foreign.example.test" }))).status).toBe(403);
    expect((await subscribe(request("/subscriptions", "POST", user.cookie, { subscription: valid }, { "content-type": "text/plain" }))).status).toBe(400);
    expect((await (await listSubscriptions(request("/subscriptions", "GET", user.cookie))).json()).subscriptions).toEqual([]);
  });

  test("settings and removal are own-only", async () => {
    const owner = await signedIn();
    const other = await signedIn();
    const device = subscription();
    const { id } = await (await subscribe(request("/subscriptions", "POST", owner.cookie, { subscription: device }))).json();
    const settings = { accountIds: ["acc-synthetic"], includeSubject: true, badge: false, quietHours: { from: "22:00", to: "07:00", timeZone: "Europe/Berlin" } };

    expect((await updateSettings(request(`/subscriptions/${id}`, "PUT", other.cookie, { settings }), params(id))).status).toBe(404);
    expect((await deleteById(request(`/subscriptions/${id}`, "DELETE", other.cookie), params(id))).status).toBe(404);
    expect((await deleteByEndpoint(request("/subscriptions", "DELETE", other.cookie, { endpoint: device.endpoint }))).status).toBe(404);
    expect((await (await listSubscriptions(request("/subscriptions", "GET", other.cookie))).json()).subscriptions).toEqual([]);
    expect((await sendTest(request("/test", "POST", other.cookie, { id }))).status).toBe(404);

    expect((await updateSettings(request(`/subscriptions/${id}`, "PUT", owner.cookie, { settings: { ...settings, badge: "no" } }), params(id))).status).toBe(400);
    expect((await updateSettings(request(`/subscriptions/${id}`, "PUT", owner.cookie, { settings, extra: 1 }), params(id))).status).toBe(400);
    const updated = await updateSettings(request(`/subscriptions/${id}`, "PUT", owner.cookie, { settings }), params(id));
    expect(await updated.json()).toEqual({ ok: true, settings });

    expect((await deleteById(request(`/subscriptions/${id}`, "DELETE", owner.cookie), params(id))).status).toBe(200);
    expect((await deleteById(request(`/subscriptions/${id}`, "DELETE", owner.cookie), params(id))).status).toBe(404);

    await subscribe(request("/subscriptions", "POST", owner.cookie, { subscription: device }));
    expect((await deleteByEndpoint(request("/subscriptions", "DELETE", owner.cookie, { endpoint: device.endpoint }))).status).toBe(200);
    expect((await deleteByEndpoint(request("/subscriptions", "DELETE", owner.cookie, { endpoint: 5 }))).status).toBe(400);
  });

  test("another user subscribing the same browser endpoint takes the device over", async () => {
    const first = await signedIn();
    const second = await signedIn();
    const device = subscription();
    const { id } = await (await subscribe(request("/subscriptions", "POST", first.cookie, { subscription: device, settings: { ...DEFAULT_PUSH_DEVICE_SETTINGS, accountIds: ["acc-first"] } }))).json();
    const takeover = await (await subscribe(request("/subscriptions", "POST", second.cookie, { subscription: device }))).json();
    expect(takeover.id).not.toBe(id);
    expect(takeover.settings).toEqual(DEFAULT_PUSH_DEVICE_SETTINGS);
    expect((await (await listSubscriptions(request("/subscriptions", "GET", first.cookie))).json()).subscriptions).toEqual([]);
    expect((await (await listSubscriptions(request("/subscriptions", "GET", second.cookie))).json()).subscriptions).toHaveLength(1);
  });

  test("test push goes to the caller's own devices", async () => {
    const user = await signedIn();
    const phone = subscription();
    const laptop = subscription(`https://updates.push.services.mozilla.com/wpush/v2/${crypto.randomUUID()}`);
    const { id } = await (await subscribe(request("/subscriptions", "POST", user.cookie, { subscription: phone }))).json();
    await subscribe(request("/subscriptions", "POST", user.cookie, { subscription: laptop }));
    sent.length = 0;
    expect(await (await sendTest(request("/test", "POST", user.cookie))).json()).toEqual({ ok: true, sent: 2, failed: 0 });
    expect(sent.sort()).toEqual([phone.endpoint, laptop.endpoint].sort());
    sent.length = 0;
    expect(await (await sendTest(request("/test", "POST", user.cookie, { id }))).json()).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(sent).toEqual([phone.endpoint]);
    expect((await sendTest(request("/test", "POST", user.cookie, { id: 5 }))).status).toBe(400);
    expect((await sendTest(request("/test", "POST", user.cookie, { id, extra: true }))).status).toBe(400);
  });
});
