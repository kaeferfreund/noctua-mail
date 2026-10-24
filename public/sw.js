const REMINDER_SYNC_TAG = "noctua-reminders";
const REMINDER_META_CACHE = "noctua-reminder-meta-v1";
const REMINDER_META_URL = "/__noctua/reminder-meta";

// Same codec as lib/navigation/deepLinks.ts; kept standalone for this classic
// (unbundled) worker. deepLinks.test.ts checks the worker against the serializer.
function encodeDeepLinkId(id, prefix) {
  const hex = id.match(new RegExp(`^${prefix}-([0-9a-f]{24})$`))?.[1];
  if (!hex) return `~${id}`;
  const bytes = hex.match(/../g).map(byte => String.fromCharCode(parseInt(byte, 16))).join("");
  return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_");
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function defaultReminderMeta() {
  return {
    accountIds: [],
    deliveredByAccount: {}
  };
}

async function readReminderMeta() {
  try {
    const cache = await caches.open(REMINDER_META_CACHE);
    const response = await cache.match(REMINDER_META_URL);
    if (!response) return defaultReminderMeta();
    const parsed = await response.json();
    if (!parsed || typeof parsed !== "object") return defaultReminderMeta();
    const accountIds = Array.isArray(parsed.accountIds)
      ? parsed.accountIds.filter((value) => typeof value === "string" && value.trim())
      : [];
    const deliveredByAccount =
      parsed.deliveredByAccount && typeof parsed.deliveredByAccount === "object"
        ? parsed.deliveredByAccount
        : {};
    return { accountIds, deliveredByAccount };
  } catch {
    return defaultReminderMeta();
  }
}

async function writeReminderMeta(meta) {
  const cache = await caches.open(REMINDER_META_CACHE);
  await cache.put(
    REMINDER_META_URL,
    new Response(JSON.stringify(meta), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    })
  );
}

async function postReminderDelivered(accountId, reminderId, triggerAtMs) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    if ("postMessage" in client) {
      client.postMessage({
        type: "noctua:reminder-delivered",
        accountId,
        reminderId,
        triggerAtMs
      });
    }
  }
}

function normalizeReminder(item) {
  if (!item || typeof item !== "object") return null;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  if (!id) return null;
  const eventTitle = typeof item.eventTitle === "string" ? item.eventTitle.trim() : "";
  const triggerAtMs = Number(item.triggerAtMs);
  const eventStartAtMs = Number(item.eventStartAtMs);
  const nextEventStartAtMs = Number(item.nextEventStartAtMs ?? item.eventStartAtMs);
  const eventEndAtMsRaw = Number(item.eventEndAtMs);
  const durationMs =
    Number.isFinite(eventStartAtMs) &&
    Number.isFinite(eventEndAtMsRaw) &&
    eventEndAtMsRaw > eventStartAtMs
      ? eventEndAtMsRaw - eventStartAtMs
      : 0;
  const endAtMs = durationMs > 0 ? nextEventStartAtMs + durationMs : nextEventStartAtMs;
  const leadLabel = typeof item.leadLabel === "string" ? item.leadLabel.trim() : "";
  const messageId =
    typeof item.messageId === "string" && item.messageId.trim() ? item.messageId.trim() : null;
  const accountId =
    typeof item.accountId === "string" && item.accountId.trim() ? item.accountId.trim() : null;
  if (!Number.isFinite(triggerAtMs) || !Number.isFinite(nextEventStartAtMs)) return null;
  return {
    id,
    accountId,
    eventTitle: eventTitle || "Calendar event",
    eventLocation: typeof item.eventLocation === "string" ? item.eventLocation.trim() : "",
    messageId,
    triggerAtMs,
    nextEventStartAtMs,
    endAtMs,
    leadLabel: leadLabel || "Reminder"
  };
}

async function processReminderNotifications(source) {
  const meta = await readReminderMeta();
  if (!Array.isArray(meta.accountIds) || meta.accountIds.length === 0) return;

  // If app is open, the foreground client scheduler handles reminders.
  const openClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (openClients.length > 0 && source !== "force") {
    return;
  }

  let changed = false;
  const now = Date.now();
  for (const accountId of meta.accountIds) {
    if (!accountId || typeof accountId !== "string") continue;
    let items = [];
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(accountId)}/reminders`, {
        cache: "no-store",
        credentials: "include"
      });
      if (!res.ok) continue;
      const payload = await res.json();
      items = Array.isArray(payload.items) ? payload.items : [];
    } catch {
      continue;
    }

    const reminders = items.map((item) => normalizeReminder(item)).filter(Boolean);
    const triggerMap = new Map(reminders.map((item) => [item.id, item.triggerAtMs]));
    if (!meta.deliveredByAccount[accountId] || typeof meta.deliveredByAccount[accountId] !== "object") {
      meta.deliveredByAccount[accountId] = {};
      changed = true;
    }
    const delivered = meta.deliveredByAccount[accountId];

    for (const reminder of reminders) {
      if (reminder.triggerAtMs > now) continue;
      if (reminder.endAtMs <= now) continue;
      if (Number(delivered[reminder.id]) === reminder.triggerAtMs) continue;
      const eventDateLabel = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(new Date(reminder.nextEventStartAtMs));
      const bodyParts = [`${reminder.leadLabel} reminder`, `Starts ${eventDateLabel}`];
      if (reminder.eventLocation) {
        bodyParts.push(reminder.eventLocation);
      }
      const params = new URLSearchParams();
      params.set("a", encodeDeepLinkId(reminder.accountId ?? accountId, "acc"));
      if (reminder.messageId) {
        params.set("m", encodeDeepLinkId(reminder.messageId, "imap"));
      }
      const query = params.toString();
      const targetUrl = query ? `/?${query}` : "/";
      await self.registration.showNotification(`Reminder: ${reminder.eventTitle}`, {
        body: bodyParts.join(" · "),
        tag: `calendar-reminder-${reminder.id}`,
        icon: "/icon.png",
        badge: "/favicon.png",
        data: { url: targetUrl }
      });
      delivered[reminder.id] = reminder.triggerAtMs;
      changed = true;
      await postReminderDelivered(accountId, reminder.id, reminder.triggerAtMs);
    }

    Object.entries(delivered).forEach(([id, triggerAt]) => {
      const currentTrigger = triggerMap.get(id);
      if (currentTrigger === undefined || Number(triggerAt) !== currentTrigger) {
        delete delivered[id];
        changed = true;
      }
    });
  }

  if (changed) {
    await writeReminderMeta(meta);
  }
}

self.addEventListener("message", (event) => {
  const payload = event.data;
  if (!payload || typeof payload !== "object") return;
  if (payload.type === "noctua:reminder-state") {
    event.waitUntil(
      (async () => {
        const meta = await readReminderMeta();
        const incomingAccountIds = Array.isArray(payload.accountIds)
          ? payload.accountIds.filter((value) => typeof value === "string" && value.trim())
          : [];
        const accountIds = Array.from(new Set([...(meta.accountIds ?? []), ...incomingAccountIds]));
        const deliveredByAccount = {
          ...(meta.deliveredByAccount && typeof meta.deliveredByAccount === "object"
            ? meta.deliveredByAccount
            : {})
        };
        const incomingDelivered =
          payload.deliveredByAccount && typeof payload.deliveredByAccount === "object"
            ? payload.deliveredByAccount
            : {};
        for (const accountId of accountIds) {
          const value = incomingDelivered[accountId];
          if (!value || typeof value !== "object") continue;
          deliveredByAccount[accountId] = {
            ...(deliveredByAccount[accountId] && typeof deliveredByAccount[accountId] === "object"
              ? deliveredByAccount[accountId]
              : {}),
            ...value
          };
        }
        await writeReminderMeta({ accountIds, deliveredByAccount });
      })()
    );
    return;
  }
  if (payload.type === "noctua:reminder-run-now") {
    event.waitUntil(processReminderNotifications("force"));
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag !== REMINDER_SYNC_TAG) return;
  event.waitUntil(processReminderNotifications("sync"));
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== REMINDER_SYNC_TAG) return;
  event.waitUntil(processReminderNotifications("periodic"));
});

// The main mail window handles "noctua:notification-open"; detached message or
// compose windows of the same origin are only a fallback.
function isMainWindow(client) {
  return new URL(client.url).pathname === "/";
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";
  const target = new URL(targetUrl, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const ordered = [...clients].sort((a, b) => Number(isMainWindow(b)) - Number(isMainWindow(a)));
      for (const client of ordered) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin !== target.origin) continue;
        if ("focus" in client) {
          await client.focus();
        }
        if ("postMessage" in client) {
          client.postMessage({
            type: "noctua:notification-open",
            url: targetUrl
          });
        }
        return;
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});

// Web Push (payload contract: briefs/web-push/_contract.md, produced by
// lib/push on the server). Malformed payloads are dropped without a
// notification.
const PUSH_ICON = "/icons/icon-192.png";
const PUSH_BADGE_ICON = "/icons/icon-96-mono.png";
const PUSH_SUBSCRIPTIONS_URL = "/api/push/subscriptions";

function readPushPayload(data) {
  if (!data || typeof data.json !== "function") return null;
  try {
    const payload = data.json();
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null;
  } catch {
    return null;
  }
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Notification targets stay inside the app, whatever the payload says.
function samePushUrl(value) {
  if (typeof value !== "string") return "/";
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

function pushBadgeCount(payload) {
  return typeof payload.badge === "number" && Number.isFinite(payload.badge) && payload.badge >= 0
    ? Math.floor(payload.badge)
    : null;
}

function pushNotification(payload) {
  const url = samePushUrl(payload.url);
  const common = { icon: PUSH_ICON, badge: PUSH_BADGE_ICON, data: { url } };
  if (payload.type === "test") {
    return { title: "Noctua: Benachrichtigungen aktiv", options: { ...common, tag: "noctua:test" } };
  }
  if (payload.type !== "new-mail") return null;
  const accountId = nonEmptyString(payload.accountId);
  const from = nonEmptyString(payload.from);
  if (!accountId || !from) return null;
  const count = Number.isInteger(payload.count) && payload.count > 1 ? payload.count : 1;
  const subject = nonEmptyString(payload.subject);
  const accountName = nonEmptyString(payload.accountName) ?? "Noctua";
  return {
    title: count > 1 ? `${accountName} · ${count} neue` : accountName,
    options: {
      ...common,
      body: subject ? `${from} — ${subject}` : from,
      tag: `mail:${accountId}`,
      renotify: true
    }
  };
}

async function applyAppBadge(count) {
  const nav = self.navigator;
  if (!nav || typeof nav.setAppBadge !== "function") return;
  try {
    if (count > 0) await nav.setAppBadge(count);
    else if (typeof nav.clearAppBadge === "function") await nav.clearAppBadge();
    else await nav.setAppBadge(0);
  } catch {
    // Badging is best effort.
  }
}

async function handlePush(payload) {
  const badge = pushBadgeCount(payload);
  const notification = pushNotification(payload);
  await Promise.all([
    badge === null ? undefined : applyAppBadge(badge),
    notification ? self.registration.showNotification(notification.title, notification.options) : undefined
  ]);
}

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event.data);
  if (!payload) return;
  event.waitUntil(handlePush(payload));
});

async function sendSubscriptionRequest(method, body) {
  return fetch(PUSH_SUBSCRIPTIONS_URL, {
    method,
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function readVapidPublicKey() {
  const response = await fetch("/api/push/vapid-public-key", { credentials: "include", cache: "no-store" });
  if (!response.ok) return null;
  const payload = await response.json();
  return nonEmptyString(payload?.publicKey);
}

// The browser rotated or dropped the subscription: subscribe again with the
// key the old one used (the server's key as a fallback) and register it.
async function renewPushSubscription(oldSubscription, newSubscription) {
  try {
    let subscription = newSubscription;
    if (!subscription) {
      const key = oldSubscription?.options?.applicationServerKey ?? (await readVapidPublicKey());
      if (!key) return;
      subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key
      });
    }
    const response = await sendSubscriptionRequest("POST", {
      subscription: subscription.toJSON(),
      userAgent: self.navigator?.userAgent
    });
    const oldEndpoint = oldSubscription?.endpoint;
    if (response.ok && oldEndpoint && oldEndpoint !== subscription.endpoint) {
      await sendSubscriptionRequest("DELETE", { endpoint: oldEndpoint });
    }
  } catch {
    // Signed out or offline: the settings page subscribes again on next use.
  }
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(renewPushSubscription(event.oldSubscription ?? null, event.newSubscription ?? null));
});
