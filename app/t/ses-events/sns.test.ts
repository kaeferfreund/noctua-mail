import { expect, test } from "bun:test";
import { X509Certificate } from "node:crypto";
import { createSnsHandler, createSnsVerifier } from "./sns";
import signed from "./sns.fixture.json";

const topic = "arn:aws:sns:eu-central-1:000000000000:test-topic";
const host = "sns.eu-central-1.amazonaws.com";
const notification = {
  Type: "Notification", TopicArn: topic, MessageId: "c6512800-891c-4664-945a-e17cc00f1a6a", Message: '{"test":true}',
  Timestamp: "2026-11-19T00:00:00.000Z", SignatureVersion: "2", Signature: signed.signature,
  SigningCertURL: `https://${host}/SimpleNotificationService-abcd1234.pem`
};

function request(message: unknown) {
  return new Request("https://mail.example.test/t/ses-events", { method: "POST", body: JSON.stringify(message) });
}

function fixture() {
  const calls: URL[] = [];
  const applied: unknown[] = [];
  let checks = 0;
  const deps: NonNullable<Parameters<typeof createSnsHandler>[0]> = {
    enabled: () => true, topic: () => topic, isLimited: () => false,
    fetch: async (url, init) => {
      expect(init.redirect).toBe("error");
      calls.push(url);
      return new Response(null, { status: 200 });
    },
    verify: async () => { checks++; return true; },
    apply: async (id, event) => { applied.push([id, event]); }
  };
  return { deps, calls, applied, checks: () => checks };
}

test("SNS rejects an unset topic, wrong topic, foreign certificate host, bad signature and rate limit", async () => {
  const f = fixture();
  expect((await createSnsHandler({ ...f.deps, topic: () => undefined })(request(notification))).status).toBe(404);
  const handler = createSnsHandler(f.deps);
  expect((await handler(request({ ...notification, TopicArn: topic + "-other" }))).status).toBe(403);
  expect((await handler(request({ ...notification, SigningCertURL: "https://other.example.test/auth.pem" }))).status).toBe(403);
  expect(f.checks()).toBe(0);
  f.deps.verify = async () => false;
  expect((await handler(request(notification))).status).toBe(403);
  f.deps.isLimited = () => true;
  expect((await handler(request(notification))).status).toBe(429);
  expect(f.calls).toEqual([]);
  expect(f.applied).toEqual([]);
});

test("SNS caps the streamed request size", async () => {
  const f = fixture();
  const handler = createSnsHandler(f.deps);
  expect((await handler(request({ ...notification, Message: "x".repeat(256 * 1024) }))).status).toBe(413);
  expect(f.checks()).toBe(0);
});

test("SNS verifies an actual RSA SHA-256 signature, uses the cached certificate and rejects mutations", async () => {
  const f = fixture();
  const cert = new X509Certificate(signed.cert);
  f.deps.verify = createSnsVerifier(() => Date.parse(cert.validFrom) + 1000);
  f.deps.fetch = async url => { f.calls.push(url); return new Response(signed.cert); };
  const handler = createSnsHandler(f.deps);
  expect((await handler(request(notification))).status).toBe(200);
  expect((await handler(request({ ...notification, Message: '{"test":false}' }))).status).toBe(403);
  expect(f.calls).toHaveLength(1);
  expect(f.applied).toEqual([[notification.MessageId, { test: true }]]);
});

test("SNS confirms only the verified topic and allowed HTTPS host, coalescing a replay", async () => {
  const f = fixture();
  const handler = createSnsHandler(f.deps);
  const token = "synthetic-token";
  const params = new URLSearchParams({ Action: "ConfirmSubscription", TopicArn: topic, Token: token });
  const message = { ...notification, Type: "SubscriptionConfirmation", Token: token, SubscribeURL: `https://${host}/?${params}` };
  expect((await handler(request({ ...message, SubscribeURL: `https://other.example.test/?${params}` }))).status).toBe(403);
  const results = await Promise.all([handler(request(message)), handler(request(message))]);
  expect(results.map(result => result.status)).toEqual([200, 200]);
  expect(f.calls.map(url => url.hostname)).toEqual([host]);
});
