import { describe, expect, spyOn, test } from "bun:test";
import webpush from "web-push";
import { createWebPushTransport, isAllowedPushEndpoint, readPushConfig } from "./server";

describe("readPushConfig", () => {
  const keys = webpush.generateVAPIDKeys();
  const env = { NOCTUA_VAPID_PUBLIC_KEY: keys.publicKey, NOCTUA_VAPID_PRIVATE_KEY: keys.privateKey, NOCTUA_VAPID_SUBJECT: "mailto:admin@example.test" };

  test("is null (push disabled) without keys, and reads a complete valid set", () => {
    expect(readPushConfig({})).toBeNull();
    expect(readPushConfig(env)).toEqual({ publicKey: keys.publicKey, privateKey: keys.privateKey, subject: "mailto:admin@example.test" });
    expect(readPushConfig({ ...env, NOCTUA_VAPID_SUBJECT: "https://mails.example.test" })?.subject).toBe("https://mails.example.test");
  });

  test("an incomplete or invalid set disables push with a warning", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(readPushConfig({ ...env, NOCTUA_VAPID_SUBJECT: "" })).toBeNull();
      expect(readPushConfig({ ...env, NOCTUA_VAPID_SUBJECT: "admin@example.test" })).toBeNull();
      expect(readPushConfig({ ...env, NOCTUA_VAPID_PRIVATE_KEY: keys.publicKey })).toBeNull();
      expect(readPushConfig({ ...env, NOCTUA_VAPID_PUBLIC_KEY: "not+base64url" })).toBeNull();
      // Never logs the key material.
      expect(JSON.stringify(warn.mock.calls)).not.toContain(keys.privateKey);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("isAllowedPushEndpoint", () => {
  test("rejects authorities that URL parsers and HTTP clients may read differently (review-r1 P1)", () => {
    for (const endpoint of [
      "https://127.0.0.1;.fcm.googleapis.com/x",
      "https://127.0.0.1\\.fcm.googleapis.com/x",
      "https://fcm.googleapis.com@127.0.0.1/x",
      "https://127.0.0.1%2e.fcm.googleapis.com/x",
      "https://fcm.googleapis.com./x",
      "https://FCM.GOOGLEAPIS.COM:443/x",
      "https://[::1].push.apple.com/x",
      "https://x_y.push.apple.com/x",
      "https://.push.apple.com/x"
    ]) expect(isAllowedPushEndpoint(endpoint)).toBe(false);
    expect(isAllowedPushEndpoint("https://Fcm.GoogleApis.com/fcm/send/abc")).toBe(true);
  });
  test("accepts the browser push services", () => {
    for (const endpoint of [
      "https://fcm.googleapis.com/fcm/send/synthetic",
      "https://updates.push.services.mozilla.com/wpush/v2/synthetic",
      "https://web.push.apple.com/synthetic",
      "https://wns2-par02p.notify.windows.com/w/?token=synthetic"
    ]) expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  test("rejects anything else (SSRF guard)", () => {
    for (const endpoint of [
      "http://fcm.googleapis.com/fcm/send/synthetic",
      "https://localhost/push",
      "https://127.0.0.1/push",
      "https://push.example.test/endpoint",
      "https://googleapis.com.example.test/x",
      "https://fcm.googleapis.com:8443/fcm/send/synthetic",
      "https://user:pass@fcm.googleapis.com/fcm/send/synthetic",
      "https://.googleapis.com/x",
      // Other Google APIs and hosts beside the push services (backlog push P3-4).
      "https://storage.googleapis.com/synthetic-bucket/x",
      "https://www.googleapis.com/x",
      "https://evil.fcm.googleapis.com/x",
      "https://push.services.mozilla.com/x",
      "https://synthetic.push.services.mozilla.com/x",
      "https://api.push.apple.com/3/device/synthetic",
      "https://synthetic.web.push.apple.com/x",
      "https://notify.windows.com/x",
      "not a url",
      `https://fcm.googleapis.com/${"x".repeat(2100)}`
    ]) expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

describe("createWebPushTransport", () => {
  const vapid = webpush.generateVAPIDKeys();
  const config = { ...vapid, subject: "mailto:admin@example.test" };
  // A real browser key pair shape: 65-byte P-256 point and 16-byte auth secret.
  const target = (endpoint: string) => ({ endpoint, p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" });
  const options = { ttlSeconds: 60, urgency: "high" as const };

  test("maps a network failure to a non-gone failure", async () => {
    const server = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    const port = server.port;
    server.stop(true);
    const result = await createWebPushTransport(config, 2_000)(target(`https://127.0.0.1:${port}/push`), "{}", options);
    expect(result).toMatchObject({ ok: false, gone: false });
  });

  test("gives up after the timeout when the push service never answers", async () => {
    const server = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    try {
      const started = Date.now();
      const result = await createWebPushTransport(config, 200)(target(`https://127.0.0.1:${server.port}/push`), "{}", options);
      expect(result).toMatchObject({ ok: false, gone: false, error: expect.stringMatching(/time(d)? ?out/i) });
      expect(Date.now() - started).toBeLessThan(2_000);
    } finally {
      server.stop(true);
    }
  });
});
