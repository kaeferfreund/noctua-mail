import { createHash } from "crypto";
import { readAccountAccess, resolveAccountRole } from "@/lib/accountAccess";
import { getAccountById, getFolders, getMailboxSummaries } from "@/lib/db";
import { isSpamDetectionOn } from "@/lib/mail/spam/config";
import { loadMailboxSpamSettings, loadSpamConfig } from "@/lib/mail/spam/settings";
import { emptyDeepLink, serializeDeepLink } from "@/lib/navigation/deepLinks";
import { extractDisplayName } from "@/lib/senderIdentity";
import { findInboxFolder } from "@/lib/specialFolders";
import { createWebPushTransport, readPushConfig, type PushDelivery, type PushSendOptions, type PushTransport } from "./server";
import { isWithinQuietHours, pushSettingsIncludeAccount } from "./settings";
import {
  deletePushSubscription,
  getPushSubscription,
  hasAnyPushSubscription,
  listAllPushSubscriptions,
  listPushSubscriptionsForUser,
  recordPushDelivered,
  recordPushFailed,
  type StoredPushSubscription
} from "./subscriptions";
import type { PushDeviceSettings, PushPayload } from "./types";
import { getAccountDb, getDb } from "../db/connection";

/**
 * Sending rules (doc/PUSH-NOTIFICATIONS.md). After every successful sync job
 * the account's INBOX is compared with an in-memory UID high-water mark; new
 * unread mail waits briefly for its spam verdict, then goes to every device of
 * every live member whose settings include the mailbox. At most one push per
 * (device, mailbox) per collapse window; later mail is counted into the next
 * one. Everything runs in the background: sync never waits for a push.
 */
export const PUSH_COLLAPSE_MS = 30_000;
export const PUSH_CONCURRENCY = 4;
/** Longest wait for the spam classifier before an unchecked message is announced anyway. */
export const PUSH_SPAM_WAIT_MS = 60_000;
const PUSH_SPAM_RETRY_MS = 5_000;
/** Mail older than this (Date header) is not announced, e.g. old mail moved back into INBOX. */
const MAX_MESSAGE_AGE_MS = 7 * 24 * 60 * 60_000;
const MAX_NEW_MESSAGES_PER_CHECK = 500;
const MAX_TEXT_LENGTH = 200;
const NEW_MAIL_TTL_SECONDS = 12 * 60 * 60;
const TEST_TTL_SECONDS = 5 * 60;

type Timer = ReturnType<typeof setTimeout>;

export type PushNotifierOptions = {
  /** null → push is not configured. Defaults to the web-push transport for the NOCTUA_VAPID_* config. */
  transport?: () => PushTransport | null;
  now?: () => number;
  collapseMs?: number;
  spamWaitMs?: number;
  spamRetryMs?: number;
  concurrency?: number;
};

export type PushNotifier = {
  onSyncCompleted(accountId: string): void;
  /** null when `id` is not one of the user's devices; also null when push is not configured. */
  sendTest(userId: string, id?: string): Promise<{ sent: number; failed: number } | null>;
  /** Resolves once no check, timer or delivery is outstanding (tests, shutdown). */
  idle(): Promise<void>;
};

type InboxMessage = {
  id: string;
  folderId: string;
  threadId: string | null;
  fromAddr: string;
  fromEmail: string | null;
  subject: string;
  unread: number | null;
  deleted: number | null;
  draft: number | null;
  dateValue: number;
  spamVerdict: string | null;
  spamCheckedAt: number | null;
};

type DeviceWindow = { lastSentAt: number; messageIds: string[]; timer?: Timer };

function truncate(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}…` : text;
}

function senderLabel(message: Pick<InboxMessage, "fromAddr" | "fromEmail">) {
  return truncate(extractDisplayName(message.fromAddr) || message.fromEmail || message.fromAddr);
}

/** Push services replace an undelivered message with the same topic (RFC 8030 §5.4): one pending push per mailbox. */
function accountTopic(accountId: string) {
  return createHash("sha256").update(accountId).digest("base64url").slice(0, 32);
}

function defaultTransport(): PushTransport | null {
  const config = readPushConfig();
  return config ? createWebPushTransport(config) : null;
}

async function loadInboxMessages(accountId: string, ids: string[]): Promise<InboxMessage[]> {
  if (!ids.length) return [];
  const db = await getAccountDb(accountId);
  return db.prepare(`SELECT id, folderId, threadId, fromAddr, fromEmail, subject, unread, deleted, draft, dateValue, spamVerdict, spamCheckedAt
    FROM messages WHERE accountId = ? AND id IN (SELECT value FROM json_each(?))`).all(accountId, JSON.stringify(ids)) as InboxMessage[];
}

/** Still worth a notification: in INBOX, unread, live, not spam, not a draft, not old. */
function isAnnounceable(message: InboxMessage | undefined, inboxId: string, now: number): message is InboxMessage {
  return Boolean(message) && message!.folderId === inboxId && message!.unread === 1 && !message!.deleted && !message!.draft
    && message!.spamVerdict !== "spam" && message!.dateValue >= now - MAX_MESSAGE_AGE_MS;
}

async function unreadBadge(userId: string, settings: PushDeviceSettings) {
  const { entries } = readAccountAccess(await getDb(), userId, { identities: false });
  const accountIds = entries.map(({ account }) => account.id).filter((id) => pushSettingsIncludeAccount(settings, id));
  return (await getMailboxSummaries(accountIds)).reduce((total, summary) => total + summary.unreadInbox, 0);
}

function createLimiter(concurrency: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

export function createPushNotifier(options: PushNotifierOptions = {}): PushNotifier {
  const getTransport = options.transport ?? defaultTransport;
  const now = options.now ?? Date.now;
  const collapseMs = options.collapseMs ?? PUSH_COLLAPSE_MS;
  const spamWaitMs = options.spamWaitMs ?? PUSH_SPAM_WAIT_MS;
  const spamRetryMs = options.spamRetryMs ?? PUSH_SPAM_RETRY_MS;
  const limit = createLimiter(Math.max(1, options.concurrency ?? PUSH_CONCURRENCY));

  /** Highest INBOX UID already considered, per account; unset until the first check after start. */
  const marks = new Map<string, number>();
  /** New messages waiting for their spam verdict: id → first seen. */
  const pending = new Map<string, Map<string, number>>();
  const pendingTimers = new Map<string, Timer>();
  const windows = new Map<string, DeviceWindow>();
  const chains = new Map<string, Promise<void>>();

  let outstanding = 0;
  let idleWaiters: Array<() => void> = [];
  function track(work: Promise<unknown>) {
    outstanding += 1;
    void work.catch((error) => console.warn("[push] background work failed", { error: String(error) })).finally(() => {
      outstanding -= 1;
      if (outstanding > 0) return;
      const waiters = idleWaiters;
      idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    });
  }
  function schedule(fn: () => Promise<void>, ms: number): Timer {
    let release!: () => void;
    track(new Promise<void>((resolve) => { release = resolve; }));
    const timer = setTimeout(() => { void fn().catch((error) => console.warn("[push] scheduled work failed", { error: String(error) })).finally(release); }, ms);
    (timer as { unref?: () => void }).unref?.();
    return timer;
  }

  /** Per-account serialization, so overlapping sync completions read the mark once. */
  function serialized(accountId: string, fn: () => Promise<void>) {
    const next = (chains.get(accountId) ?? Promise.resolve()).then(fn, fn);
    const settled = next.catch((error) => console.warn("[push] new-mail check failed", { accountId, error: String(error) }));
    chains.set(accountId, settled);
    void settled.finally(() => { if (chains.get(accountId) === settled) chains.delete(accountId); });
    return settled;
  }

  async function inboxIdOf(accountId: string) {
    return findInboxFolder(await getFolders(accountId), accountId)?.id ?? null;
  }

  async function collect(accountId: string) {
    if (!getTransport()) return;
    const inboxId = await inboxIdOf(accountId);
    if (!inboxId) return;
    const db = await getAccountDb(accountId);
    // Only recent mail can be announced; the date bound keeps both reads on idx_messages_account_folder_date.
    const since = now() - MAX_MESSAGE_AGE_MS;
    const { maxUid } = db.prepare(`SELECT MAX(imapUid) AS maxUid FROM messages WHERE accountId = ? AND folderId = ? AND dateValue >= ?`)
      .get(accountId, inboxId, since) as { maxUid: number | null };
    const mark = marks.get(accountId);
    // First check after start, newest mail deleted/moved, or a UIDVALIDITY reset: baseline only, never a flood of old mail.
    // The mark is kept even without devices, so the first mail after subscribing is announced.
    if (mark === undefined || maxUid === null || maxUid < mark) {
      marks.set(accountId, maxUid ?? 0);
      return;
    }
    if (maxUid === mark && !pending.get(accountId)?.size) return;
    marks.set(accountId, maxUid);
    if (!(await hasAnyPushSubscription())) {
      pending.delete(accountId);
      return;
    }
    if (maxUid > mark) {
      const rows = db.prepare(`SELECT id FROM messages WHERE accountId = ? AND folderId = ? AND dateValue >= ? AND imapUid > ? AND imapUid <= ?
        ORDER BY imapUid DESC LIMIT ?`).all(accountId, inboxId, since, mark, maxUid, MAX_NEW_MESSAGES_PER_CHECK) as Array<{ id: string }>;
      const waiting = pending.get(accountId) ?? new Map<string, number>();
      const seenAt = now();
      for (const { id } of rows.reverse()) if (!waiting.has(id)) waiting.set(id, seenAt);
      pending.set(accountId, waiting);
    }
    await processPending(accountId, inboxId);
  }

  async function processPending(accountId: string, inboxId: string) {
    const waiting = pending.get(accountId);
    if (!waiting?.size) return;
    const at = now();
    const spamOn = isSpamDetectionOn(await loadSpamConfig(), await loadMailboxSpamSettings(accountId));
    const rows = new Map((await loadInboxMessages(accountId, [...waiting.keys()])).map((row) => [row.id, row]));
    const ready: string[] = [];
    for (const [id, firstSeenAt] of waiting) {
      const row = rows.get(id);
      if (!isAnnounceable(row, inboxId, at)) { waiting.delete(id); continue; }
      if (spamOn && row.spamCheckedAt === null && at - firstSeenAt < spamWaitMs) continue;
      waiting.delete(id);
      ready.push(id);
    }
    if (!waiting.size) pending.delete(accountId);
    else if (!pendingTimers.has(accountId)) {
      pendingTimers.set(accountId, schedule(() => {
        pendingTimers.delete(accountId);
        return serialized(accountId, async () => {
          const currentInbox = await inboxIdOf(accountId);
          if (currentInbox) await processPending(accountId, currentInbox);
        });
      }, spamRetryMs));
    }
    if (ready.length) await dispatch(accountId, ready);
  }

  async function dispatch(accountId: string, messageIds: string[]) {
    for (const subscription of await listAllPushSubscriptions()) {
      if (!pushSettingsIncludeAccount(subscription.settings, accountId)) continue;
      const key = `${subscription.id}\u0000${accountId}`;
      const window = windows.get(key) ?? { lastSentAt: Number.NEGATIVE_INFINITY, messageIds: [] };
      windows.set(key, window);
      for (const id of messageIds) if (!window.messageIds.includes(id)) window.messageIds.push(id);
      if (window.timer) continue;
      const wait = window.lastSentAt + collapseMs - now();
      if (wait <= 0) flush(subscription.id, accountId, window);
      else window.timer = schedule(async () => { flush(subscription.id, accountId, window); }, wait);
    }
  }

  function flush(subscriptionId: string, accountId: string, window: DeviceWindow) {
    window.timer = undefined;
    const messageIds = window.messageIds;
    window.messageIds = [];
    if (!messageIds.length) return;
    window.lastSentAt = now();
    track(limit(() => deliverNewMail(subscriptionId, accountId, messageIds)));
  }

  async function deliverNewMail(subscriptionId: string, accountId: string, messageIds: string[]) {
    const transport = getTransport();
    const subscription = await getPushSubscription(subscriptionId);
    if (!transport || !subscription) return;
    const at = now();
    if (!pushSettingsIncludeAccount(subscription.settings, accountId) || isWithinQuietHours(subscription.settings.quietHours, at)) return;
    // Live membership at send time: a revoked member gets nothing, whatever the device settings say.
    if (!(await resolveAccountRole(subscription.userId, accountId))) return;
    const inboxId = await inboxIdOf(accountId);
    if (!inboxId) return;
    // Re-read: mail read, moved or marked as spam during the window is not announced.
    const rows = new Map((await loadInboxMessages(accountId, messageIds)).map((row) => [row.id, row]));
    const live = messageIds.map((id) => rows.get(id)).filter((row): row is InboxMessage => isAnnounceable(row, inboxId, at));
    const newest = live.at(-1);
    if (!newest) return;
    const account = await getAccountById(accountId);
    if (!account) return;
    const payload: PushPayload = {
      type: "new-mail",
      accountId,
      accountName: truncate(account.name || account.email),
      count: live.length,
      messageId: newest.id,
      threadId: newest.threadId ?? null,
      from: senderLabel(newest),
      subject: subscription.settings.includeSubject ? truncate(newest.subject) : null,
      url: serializeDeepLink({ ...emptyDeepLink(), accountId, folderId: inboxId, messageId: newest.id }),
      ...(subscription.settings.badge ? { badge: await unreadBadge(subscription.userId, subscription.settings) } : {}),
      sentAt: at
    };
    await send(transport, subscription, payload, { ttlSeconds: NEW_MAIL_TTL_SECONDS, urgency: "high", topic: accountTopic(accountId) });
  }

  /** Never throws. 404/410 drops the device; other failures count towards PUSH_MAX_FAILURES. */
  async function send(transport: PushTransport, subscription: StoredPushSubscription, payload: PushPayload, sendOptions: PushSendOptions) {
    try {
      const result: PushDelivery = await transport(subscription, JSON.stringify(payload), sendOptions)
        .catch((error: unknown) => ({ ok: false, gone: false, error: String(error) }));
      if (result.ok) {
        await recordPushDelivered(subscription.id, now());
        return true;
      }
      if (result.gone) await deletePushSubscription(subscription.id);
      else if (await recordPushFailed(subscription.id)) console.warn("[push] device removed after repeated failures", { subscriptionId: subscription.id });
      else console.warn("[push] delivery failed", { subscriptionId: subscription.id, statusCode: result.statusCode, error: result.error });
      return false;
    } catch (error) {
      console.warn("[push] delivery failed", { subscriptionId: subscription.id, error: String(error) });
      return false;
    }
  }

  return {
    onSyncCompleted(accountId) {
      track(serialized(accountId, () => collect(accountId)));
    },
    async sendTest(userId, id) {
      const transport = getTransport();
      if (!transport) return null;
      const devices = (await listPushSubscriptionsForUser(userId)).filter((device) => id === undefined || device.id === id);
      if (id !== undefined && !devices.length) return null;
      const payload: PushPayload = { type: "test", url: "/", sentAt: now() };
      const results = await Promise.all(devices.map((device) =>
        limit(() => send(transport, device, payload, { ttlSeconds: TEST_TTL_SECONDS, urgency: "high" }))));
      const sent = results.filter(Boolean).length;
      return { sent, failed: results.length - sent };
    },
    idle() {
      return outstanding === 0 ? Promise.resolve() : new Promise<void>((resolve) => idleWaiters.push(resolve));
    }
  };
}

const runtime = globalThis as typeof globalThis & { __noctuaPushNotifier?: PushNotifier };

export function getPushNotifier(): PushNotifier {
  return runtime.__noctuaPushNotifier ??= createPushNotifier();
}

/** Test seam: replace the process-wide notifier (undefined restores the default on next use). */
export function replacePushNotifier(next: PushNotifier | undefined) {
  runtime.__noctuaPushNotifier = next;
}

/** Sync hook: fire-and-forget, never throws into the sync job. */
export function notifyPushAfterSync(accountId: string) {
  try {
    getPushNotifier().onSyncCompleted(accountId);
  } catch (error) {
    console.warn("[push] failed to schedule new-mail check", { accountId, error: String(error) });
  }
}
