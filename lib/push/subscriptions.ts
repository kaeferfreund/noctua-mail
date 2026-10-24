import { createHash, randomUUID } from "crypto";
import { withDbWriteRetry } from "@/lib/dbWriteRetry";
import { parsePushDeviceSettings } from "./settings";
import { DEFAULT_PUSH_DEVICE_SETTINGS, type PushDeviceSettings, type PushSubscriptionSummary } from "./types";
import { getDb } from "../db/connection";

/** Consecutive non-410 delivery failures after which a device is dropped. */
export const PUSH_MAX_FAILURES = 5;
/** Devices kept per user; subscribing another one drops the least recently seen. */
export const PUSH_MAX_DEVICES_PER_USER = 20;

export type StoredPushSubscription = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  settings: PushDeviceSettings;
  createdAt: number;
  lastSeenAt: number;
  lastSentAt: number | null;
  failures: number;
};

type PushSubscriptionRow = Omit<StoredPushSubscription, "settings"> & { settings: string };

export function pushEndpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 16);
}

function parseStoredSettings(value: string): PushDeviceSettings {
  try {
    return parsePushDeviceSettings(JSON.parse(value)) ?? DEFAULT_PUSH_DEVICE_SETTINGS;
  } catch {
    return DEFAULT_PUSH_DEVICE_SETTINGS;
  }
}

function fromRow(row: PushSubscriptionRow): StoredPushSubscription {
  return { ...row, settings: parseStoredSettings(row.settings), failures: row.failures ?? 0 };
}

export function toPushSubscriptionSummary(subscription: StoredPushSubscription): PushSubscriptionSummary {
  return {
    id: subscription.id,
    endpointHash: pushEndpointHash(subscription.endpoint),
    userAgent: subscription.userAgent,
    settings: subscription.settings,
    createdAt: subscription.createdAt,
    lastSeenAt: subscription.lastSeenAt
  };
}

export type PushSubscriptionInput = {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  settings?: PushDeviceSettings;
};

/**
 * Upsert by endpoint. A re-POST from the same user refreshes keys and lastSeenAt
 * and keeps the stored settings unless new ones are given. An endpoint is the
 * browser's own capability: when another user signs in on that browser and
 * subscribes, the old row is replaced by a new one (new id, default settings).
 * A user keeps at most PUSH_MAX_DEVICES_PER_USER devices.
 */
export async function upsertPushSubscription(input: PushSubscriptionInput): Promise<StoredPushSubscription> {
  return withDbWriteRetry("upsertPushSubscription", async () => {
    const db = await getDb();
    const now = Date.now();
    return db.transaction(() => {
      const existing = db.prepare(`SELECT * FROM push_subscriptions WHERE endpoint = ?`).get(input.endpoint) as PushSubscriptionRow | undefined;
      if (existing && existing.userId === input.userId) {
        const settings = input.settings ?? parseStoredSettings(existing.settings);
        db.prepare(`UPDATE push_subscriptions SET p256dh = ?, auth = ?, userAgent = COALESCE(?, userAgent), settings = ?,
            lastSeenAt = ?, failures = 0 WHERE id = ?`)
          .run(input.p256dh, input.auth, input.userAgent, JSON.stringify(settings), now, existing.id);
      } else {
        if (existing) db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).run(existing.id);
        db.prepare(`INSERT INTO push_subscriptions (id, userId, endpoint, p256dh, auth, userAgent, settings, createdAt, lastSeenAt, failures)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`)
          .run(randomUUID(), input.userId, input.endpoint, input.p256dh, input.auth, input.userAgent,
            JSON.stringify(input.settings ?? DEFAULT_PUSH_DEVICE_SETTINGS), now, now);
        db.prepare(`DELETE FROM push_subscriptions WHERE userId = ? AND id NOT IN (
            SELECT id FROM push_subscriptions WHERE userId = ? ORDER BY lastSeenAt DESC, createdAt DESC LIMIT ?)`)
          .run(input.userId, input.userId, PUSH_MAX_DEVICES_PER_USER);
      }
      return fromRow(db.prepare(`SELECT * FROM push_subscriptions WHERE endpoint = ?`).get(input.endpoint) as PushSubscriptionRow);
    }).immediate();
  });
}

export async function listPushSubscriptionsForUser(userId: string): Promise<StoredPushSubscription[]> {
  const db = await getDb();
  return (db.prepare(`SELECT * FROM push_subscriptions WHERE userId = ? ORDER BY createdAt, id`).all(userId) as PushSubscriptionRow[]).map(fromRow);
}

/** Every device; the sender filters by settings and live membership. */
export async function listAllPushSubscriptions(): Promise<StoredPushSubscription[]> {
  const db = await getDb();
  return (db.prepare(`SELECT * FROM push_subscriptions ORDER BY userId, createdAt, id`).all() as PushSubscriptionRow[]).map(fromRow);
}

export async function hasAnyPushSubscription() {
  const db = await getDb();
  return Boolean(db.prepare(`SELECT 1 FROM push_subscriptions LIMIT 1`).get());
}

export async function getPushSubscription(id: string): Promise<StoredPushSubscription | null> {
  const db = await getDb();
  const row = db.prepare(`SELECT * FROM push_subscriptions WHERE id = ?`).get(id) as PushSubscriptionRow | undefined;
  return row ? fromRow(row) : null;
}

/** Own devices only; null when the id is unknown or belongs to someone else. */
export async function updatePushSubscriptionSettings(userId: string, id: string, settings: PushDeviceSettings) {
  return withDbWriteRetry("updatePushSubscriptionSettings", async () => {
    const db = await getDb();
    const result = db.prepare(`UPDATE push_subscriptions SET settings = ? WHERE id = ? AND userId = ?`).run(JSON.stringify(settings), id, userId);
    return result.changes > 0 ? settings : null;
  });
}

export async function deleteOwnPushSubscription(userId: string, selector: { id: string } | { endpoint: string }) {
  return withDbWriteRetry("deleteOwnPushSubscription", async () => {
    const db = await getDb();
    const result = "id" in selector
      ? db.prepare(`DELETE FROM push_subscriptions WHERE id = ? AND userId = ?`).run(selector.id, userId)
      : db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND userId = ?`).run(selector.endpoint, userId);
    return result.changes > 0;
  });
}

/** Push service reported the subscription gone (404/410). */
export async function deletePushSubscription(id: string) {
  return withDbWriteRetry("deletePushSubscription", async () => {
    const db = await getDb();
    db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).run(id);
  });
}

export async function recordPushDelivered(id: string, at: number) {
  return withDbWriteRetry("recordPushDelivered", async () => {
    const db = await getDb();
    db.prepare(`UPDATE push_subscriptions SET lastSentAt = ?, failures = 0 WHERE id = ?`).run(at, id);
  });
}

/** Counts a failed delivery; the device is removed after PUSH_MAX_FAILURES in a row. Returns whether it was removed. */
export async function recordPushFailed(id: string) {
  return withDbWriteRetry("recordPushFailed", async () => {
    const db = await getDb();
    return db.transaction(() => {
      const row = db.prepare(`UPDATE push_subscriptions SET failures = COALESCE(failures, 0) + 1 WHERE id = ? RETURNING failures`).get(id) as { failures: number } | undefined;
      if (!row || row.failures < PUSH_MAX_FAILURES) return false;
      db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).run(id);
      return true;
    }).immediate();
  });
}
