import { describe, expect, test } from "bun:test";
import { getSharedTestAuthHarness } from "@/lib/testAuthHarness";
import { listPushSubscriptionsForUser, upsertPushSubscription, type PushSubscriptionInput } from "./subscriptions";
import { DEFAULT_PUSH_DEVICE_SETTINGS } from "./types";

const endpoint = () => `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`;

async function newUser() {
  const harness = await getSharedTestAuthHarness();
  const user = await harness.createUser(`push-store-${crypto.randomUUID()}@example.test`);
  const subscribe = (input: Omit<PushSubscriptionInput, "userId" | "p256dh" | "auth" | "userAgent">) =>
    upsertPushSubscription({ userId: user.id, p256dh: "synthetic-key", auth: "synthetic-auth", userAgent: null, ...input });
  const devices = async () => (await listPushSubscriptionsForUser(user.id)).map(({ endpoint, settings }) => ({ endpoint, settings }));
  return { user, subscribe, devices };
}

describe("upsertPushSubscription with previousEndpoint", () => {
  const custom = { accountIds: ["acc-synthetic"], includeSubject: false, badge: false, quietHours: null };

  test("carries the previous settings over even when the new endpoint was already registered with defaults", async () => {
    const { subscribe, devices } = await newUser();
    const old = endpoint();
    const rotated = endpoint();
    await subscribe({ endpoint: old, settings: custom });
    // E.g. the settings page synced the new endpoint before the service worker reported the rotation.
    await subscribe({ endpoint: rotated });
    const stored = await subscribe({ endpoint: rotated, previousEndpoint: old });
    expect(stored.settings).toEqual(custom);
    expect(await devices()).toEqual([{ endpoint: rotated, settings: custom }]);
  });

  test("the same endpoint as previous is a plain re-POST", async () => {
    const { subscribe, devices } = await newUser();
    const same = endpoint();
    const first = await subscribe({ endpoint: same, settings: custom });
    const again = await subscribe({ endpoint: same, previousEndpoint: same });
    expect(again).toMatchObject({ id: first.id, settings: custom });
    expect(await devices()).toEqual([{ endpoint: same, settings: custom }]);
  });

  test("another user's previous endpoint is neither read nor removed", async () => {
    const owner = await newUser();
    const other = await newUser();
    const ownerEndpoint = endpoint();
    await owner.subscribe({ endpoint: ownerEndpoint, settings: custom });
    const stored = await other.subscribe({ endpoint: endpoint(), previousEndpoint: ownerEndpoint });
    expect(stored.settings).toEqual(DEFAULT_PUSH_DEVICE_SETTINGS);
    expect(await owner.devices()).toEqual([{ endpoint: ownerEndpoint, settings: custom }]);
  });
});
