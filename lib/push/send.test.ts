import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { parseDeepLink } from "@/lib/navigation/deepLinks";
import { getSharedTestAuthHarness } from "@/lib/testAuthHarness";
import { createCollabFixture } from "@/lib/testThreadCollabHarness";
import { createPushNotifier, type PushNotifierOptions } from "./send";
import type { PushDelivery, PushTransport } from "./server";
import { getPushSubscription, PUSH_MAX_FAILURES, upsertPushSubscription } from "./subscriptions";
import { DEFAULT_PUSH_DEVICE_SETTINGS, type PushDeviceSettings, type PushPayload } from "./types";
import { getDb } from "../db/connection";

type Sent = { endpoint: string; payload: PushPayload; at: number; topic?: string };

function fakeTransport(respond: (endpoint: string) => PushDelivery | Promise<PushDelivery> = () => ({ ok: true })) {
  const sent: Sent[] = [];
  const transport: PushTransport = async (target, payload, options) => {
    sent.push({ endpoint: target.endpoint, payload: JSON.parse(payload), at: Date.now(), topic: options.topic });
    return respond(target.endpoint);
  };
  return { sent, transport };
}

const quiet: Array<ReturnType<typeof spyOn>> = [];
afterEach(() => { while (quiet.length) quiet.pop()?.mockRestore(); });
function silenceWarnings() { quiet.push(spyOn(console, "warn").mockImplementation(() => {})); }

async function setup(options: { settings?: Partial<PushDeviceSettings>; member?: boolean; notifier?: PushNotifierOptions; transport?: ReturnType<typeof fakeTransport> } = {}) {
  const fixture = await createCollabFixture({ name: "Synthetic Team" });
  const harness = await getSharedTestAuthHarness();
  const user = await harness.createUser(`push-${crypto.randomUUID()}@example.test`);
  if (options.member !== false) await harness.addMembership(user.id, fixture.accountId, "viewer");
  const endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`;
  const device = await upsertPushSubscription({
    userId: user.id, endpoint, p256dh: "synthetic-key", auth: "synthetic-auth", userAgent: null,
    settings: { ...DEFAULT_PUSH_DEVICE_SETTINGS, ...options.settings }
  });
  const fake = options.transport ?? fakeTransport();
  const notifier = createPushNotifier({ transport: () => fake.transport, collapseMs: 60, spamWaitMs: 150, spamRetryMs: 20, ...options.notifier });
  let uid = 0;
  async function arrive(overrides: Record<string, unknown> = {}) {
    uid += 1;
    const [message] = await fixture.seed(fixture.message(`thread-${uid}-${crypto.randomUUID()}`, {
      imapUid: uid, unread: true, dateValue: Date.now(), subject: `Synthetic subject ${uid}`,
      from: `"Synthetic Sender ${uid}" <sender${uid}@example.test>`, ...overrides
    }));
    return message;
  }
  async function sync() {
    notifier.onSyncCompleted(fixture.accountId);
    await notifier.idle();
  }
  const mine = () => fake.sent.filter((entry) => entry.endpoint === endpoint);
  // Baseline: the first check after start never announces existing mail.
  await arrive();
  await sync();
  return { fixture, harness, user, device, endpoint, notifier, fake, arrive, sync, mine };
}

describe("push sending rules", () => {
  test("baselines on the first check, then announces new unread INBOX mail with a deep link", async () => {
    const t = await setup();
    expect(t.mine()).toEqual([]);
    const message = await t.arrive();
    await t.sync();
    expect(t.mine()).toHaveLength(1);
    const payload = t.mine()[0].payload;
    expect(payload).toMatchObject({
      type: "new-mail", accountId: t.fixture.accountId, accountName: "Synthetic Team", count: 1,
      messageId: message.id, threadId: message.threadId, from: "Synthetic Sender 2", subject: "Synthetic subject 2", badge: 2
    });
    if (payload.type !== "new-mail") throw new Error("unexpected payload");
    expect(parseDeepLink(new URL(payload.url, "http://localhost").search)).toMatchObject({
      accountId: t.fixture.accountId, folderId: t.fixture.folderId, messageId: message.id
    });
    expect(t.mine()[0].topic).toHaveLength(32);
    expect((await getPushSubscription(t.device.id))?.lastSentAt).toBeNumber();
    // Nothing new: no second push.
    await t.sync();
    expect(t.mine()).toHaveLength(1);
  });

  test("collapses mail within the window into one push per device and mailbox", async () => {
    const t = await setup();
    await t.arrive();
    await t.sync();
    expect(t.mine()).toHaveLength(1);
    await t.arrive();
    t.notifier.onSyncCompleted(t.fixture.accountId);
    const newest = await t.arrive();
    await t.sync();
    expect(t.mine()).toHaveLength(2);
    expect(t.mine()[1].payload).toMatchObject({ count: 2, messageId: newest.id, subject: newest.subject });
    expect(t.mine()[1].at - t.mine()[0].at).toBeGreaterThanOrEqual(50);
  });

  test("honours includeSubject, badge and the device's mailbox selection", async () => {
    const t = await setup({ settings: { includeSubject: false, badge: false } });
    await t.arrive();
    await t.sync();
    expect(t.mine()[0].payload).toMatchObject({ subject: null, from: "Synthetic Sender 2" });
    expect("badge" in t.mine()[0].payload).toBe(false);

    const other = await setup({ settings: { accountIds: ["some-other-mailbox"] } });
    await other.arrive();
    await other.sync();
    expect(other.mine()).toEqual([]);
  });

  test("sends nothing during quiet hours", async () => {
    // 03:00 UTC is 04:00 in Berlin, inside 22:00–07:00.
    const fixed = Date.parse("2026-01-15T03:00:00Z");
    const t = await setup({
      settings: { quietHours: { from: "22:00", to: "07:00", timeZone: "Europe/Berlin" } },
      notifier: { now: () => fixed }
    });
    await t.arrive({ dateValue: fixed });
    await t.sync();
    expect(t.mine()).toEqual([]);
  });

  test("skips spam, read, deleted and old mail", async () => {
    const t = await setup();
    const spam = await t.arrive();
    await t.fixture.api.saveSpamVerdict(t.fixture.accountId, spam.id, { verdict: "spam", confidence: 0.99, reasons: ["synthetic"] }, { automatic: true });
    await t.arrive({ unread: false });
    await t.arrive({ deleted: true });
    await t.arrive({ dateValue: Date.now() - 8 * 24 * 60 * 60_000 });
    await t.sync();
    expect(t.mine()).toEqual([]);
  });

  test("waits for the spam verdict when detection is on, bounded by the wait limit", async () => {
    const previous = process.env.NOCTUA_SPAM_ENABLED;
    process.env.NOCTUA_SPAM_ENABLED = "1";
    try {
      const t = await setup();
      const spam = await t.arrive();
      const unchecked = await t.arrive();
      t.notifier.onSyncCompleted(t.fixture.accountId);
      await Bun.sleep(40);
      expect(t.mine()).toEqual([]);
      await t.fixture.api.saveSpamVerdict(t.fixture.accountId, spam.id, { verdict: "spam", confidence: 0.99, reasons: ["synthetic"] }, { automatic: true });
      await t.notifier.idle();
      // The spam mail is dropped; the never-checked one goes out once the wait limit is reached.
      expect(t.mine()).toHaveLength(1);
      expect(t.mine()[0].payload).toMatchObject({ count: 1, messageId: unchecked.id });
    } finally {
      if (previous === undefined) delete process.env.NOCTUA_SPAM_ENABLED;
      else process.env.NOCTUA_SPAM_ENABLED = previous;
    }
  });

  test("only live members get pushes, also when access is revoked during the window", async () => {
    const outsider = await setup({ member: false });
    await outsider.arrive();
    await outsider.sync();
    expect(outsider.mine()).toEqual([]);

    const t = await setup({ notifier: { collapseMs: 120 } });
    await t.arrive();
    await t.sync();
    expect(t.mine()).toHaveLength(1);
    await t.arrive();
    t.notifier.onSyncCompleted(t.fixture.accountId);
    await Bun.sleep(20);
    (await getDb()).prepare("DELETE FROM user_accounts WHERE userId = ? AND accountId = ?").run(t.user.id, t.fixture.accountId);
    await t.notifier.idle();
    expect(t.mine()).toHaveLength(1);
  });

  test("does not announce mail that was read during the window", async () => {
    const t = await setup({ notifier: { collapseMs: 120 } });
    await t.arrive();
    await t.sync();
    const later = await t.arrive();
    t.notifier.onSyncCompleted(t.fixture.accountId);
    await Bun.sleep(20);
    t.fixture.db.prepare("UPDATE messages SET unread = 0 WHERE accountId = ? AND id = ?").run(t.fixture.accountId, later.id);
    await t.notifier.idle();
    expect(t.mine()).toHaveLength(1);
  });

  test("drops a device on 404/410 and after repeated failures", async () => {
    silenceWarnings();
    const gone = await setup({ transport: fakeTransport(() => ({ ok: false, gone: true, statusCode: 410, error: "Gone" })) });
    await gone.arrive();
    await gone.sync();
    expect(gone.mine()).toHaveLength(1);
    expect(await getPushSubscription(gone.device.id)).toBeNull();

    const failing = await setup({
      notifier: { collapseMs: 0 },
      transport: fakeTransport(() => { throw new Error("synthetic network failure"); })
    });
    for (let attempt = 1; attempt < PUSH_MAX_FAILURES; attempt += 1) {
      await failing.arrive();
      await failing.sync();
      expect((await getPushSubscription(failing.device.id))?.failures).toBe(attempt);
    }
    await failing.arrive();
    await failing.sync();
    expect(failing.mine()).toHaveLength(PUSH_MAX_FAILURES);
    expect(await getPushSubscription(failing.device.id)).toBeNull();
  });

  test("a success resets the failure count", async () => {
    silenceWarnings();
    let fail = true;
    const t = await setup({ notifier: { collapseMs: 0 }, transport: fakeTransport(() => fail ? { ok: false, gone: false, statusCode: 500, error: "synthetic" } : { ok: true }) });
    await t.arrive();
    await t.sync();
    expect((await getPushSubscription(t.device.id))?.failures).toBe(1);
    fail = false;
    await t.arrive();
    await t.sync();
    expect((await getPushSubscription(t.device.id))?.failures).toBe(0);
  });

  test("does nothing when push is not configured", async () => {
    const t = await setup({ notifier: { transport: () => null } });
    await t.arrive();
    await t.sync();
    expect(t.fake.sent).toEqual([]);
    expect(await t.notifier.sendTest(t.user.id)).toBeNull();
  });
});

describe("test push", () => {
  test("never contacts a stored endpoint the allowlist rejects and removes that device (review-r1 P1)", async () => {
    const t = await setup();
    silenceWarnings();
    // Stored directly, as a row from before the allowlist fix would be.
    const legacy = await upsertPushSubscription({
      userId: t.user.id, endpoint: "https://127.0.0.1;.fcm.googleapis.com/x", p256dh: "synthetic-key", auth: "synthetic-auth", userAgent: null
    });
    expect(await t.notifier.sendTest(t.user.id)).toEqual({ sent: 1, failed: 1 });
    expect(t.fake.sent.map((item) => item.endpoint)).toEqual([t.device.endpoint]);
    expect(await getPushSubscription(legacy.id)).toBeNull();
  });

  test("goes to one own device or all own devices, never to someone else's", async () => {
    const t = await setup();
    const second = await upsertPushSubscription({
      userId: t.user.id, endpoint: `https://updates.push.services.mozilla.com/wpush/v2/${crypto.randomUUID()}`,
      p256dh: "synthetic-key", auth: "synthetic-auth", userAgent: null
    });
    expect(await t.notifier.sendTest(t.user.id)).toEqual({ sent: 2, failed: 0 });
    expect(await t.notifier.sendTest(t.user.id, second.id)).toEqual({ sent: 1, failed: 0 });
    const last = t.fake.sent.at(-1)!;
    expect(last.endpoint).toBe(second.endpoint);
    expect(last.payload).toMatchObject({ type: "test", url: "/" });
    const stranger = await t.harness.createUser(`push-stranger-${crypto.randomUUID()}@example.test`);
    expect(await t.notifier.sendTest(stranger.id, second.id)).toBeNull();
    expect(await t.notifier.sendTest(stranger.id)).toEqual({ sent: 0, failed: 0 });
  });
});
