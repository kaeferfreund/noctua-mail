"use client";

import { AdminApiError, adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { isIosSafari, isStandalone, pushSupported } from "@/lib/push/platform";
import type { PushDeviceSettings } from "@/lib/push/types";

/** One of the signed-in user's push devices as listed by `GET /api/push/subscriptions`. */
export type PushDevice = {
  id: string;
  endpointHash: string;
  userAgent: string | null;
  settings: PushDeviceSettings;
  createdAt: number;
  lastSeenAt: number | null;
};

/** What this browser can do before any server call. */
export type PushAvailability = "available" | "unsupported" | "install-required" | "denied";

export type EnsurePushResult =
  | { status: "subscribed"; id: string; settings: PushDeviceSettings }
  | { status: Exclude<PushAvailability, "available"> | "dismissed" | "not-configured" };

const SUBSCRIPTIONS_URL = "/api/push/subscriptions";
const deviceUrl = (id: string) => `${SUBSCRIPTIONS_URL}/${encodeURIComponent(id)}`;

export function pushAvailability(): PushAvailability {
  // iOS only exposes PushManager to web apps opened from the home screen.
  if (isIosSafari() && !isStandalone()) return "install-required";
  if (!pushSupported()) return "unsupported";
  return Notification.permission === "denied" ? "denied" : "available";
}

/** `null` when the server has no VAPID keys (push not configured). */
export async function fetchVapidPublicKey(apiFetch: AdminFetch = fetch): Promise<string | null> {
  try {
    return (await adminRequest<{ publicKey: string }>(apiFetch, "/api/push/vapid-public-key")).publicKey;
  } catch (error) {
    if (error instanceof AdminApiError && (error.status === 404 || error.status === 503)) return null;
    throw error;
  }
}

export async function listPushDevices(apiFetch: AdminFetch = fetch): Promise<PushDevice[]> {
  return (await adminRequest<{ subscriptions: PushDevice[] }>(apiFetch, SUBSCRIPTIONS_URL)).subscriptions;
}

export async function updatePushDevice(apiFetch: AdminFetch, id: string, settings: PushDeviceSettings): Promise<PushDeviceSettings> {
  return (await adminRequest<{ settings: PushDeviceSettings }>(apiFetch, deviceUrl(id), jsonMutation("PUT", { settings }))).settings;
}

export async function removePushDevice(apiFetch: AdminFetch, id: string): Promise<void> {
  await adminRequest(apiFetch, deviceUrl(id), jsonMutation("DELETE"));
}

export async function sendTestPush(apiFetch: AdminFetch, id?: string): Promise<{ sent: number; failed: number }> {
  return adminRequest<{ sent: number; failed: number }>(apiFetch, "/api/push/test", jsonMutation("POST", id ? { id } : {}));
}

/** This browser's current push subscription, without registering anything. */
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function postSubscription(apiFetch: AdminFetch, subscription: PushSubscription, settings?: PushDeviceSettings) {
  return adminRequest<{ id: string; settings: PushDeviceSettings }>(apiFetch, SUBSCRIPTIONS_URL, jsonMutation("POST", {
    subscription: subscription.toJSON(), ...(settings ? { settings } : {}), userAgent: navigator.userAgent
  }));
}

/**
 * Re-POSTs an existing browser subscription (refreshes keys/lastSeenAt on the
 * server, keeps its settings) and returns the server id of this device.
 */
export async function syncPushSubscription(apiFetch: AdminFetch = fetch): Promise<{ id: string; settings: PushDeviceSettings } | null> {
  if (pushAvailability() !== "available" || Notification.permission !== "granted") return null;
  const subscription = await currentPushSubscription();
  return subscription ? postSubscription(apiFetch, subscription) : null;
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function sameKey(current: ArrayBuffer | null, expected: Uint8Array) {
  if (!current || current.byteLength !== expected.byteLength) return false;
  const bytes = new Uint8Array(current);
  return bytes.every((byte, index) => byte === expected[index]);
}

/**
 * Subscribes this browser and registers it with the server. Must be called from
 * a user gesture: the permission prompt comes first so Safari keeps the gesture.
 */
export async function ensurePushSubscription(settings?: PushDeviceSettings, apiFetch: AdminFetch = fetch): Promise<EnsurePushResult> {
  const availability = pushAvailability();
  if (availability !== "available") return { status: availability };
  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { status: permission === "denied" ? "denied" : "dismissed" };
  }
  const publicKey = await fetchVapidPublicKey(apiFetch);
  if (!publicKey) return { status: "not-configured" };
  const applicationServerKey = base64UrlToBytes(publicKey);
  // MailClient registers /sw.js on start; registering again is a no-op then.
  if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register("/sw.js");
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, applicationServerKey)) {
    // The server's VAPID key changed; the old subscription can no longer receive pushes.
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
  const device = await postSubscription(apiFetch, subscription, settings);
  return { status: "subscribed", id: device.id, settings: device.settings };
}

/** Removes this browser's subscription from the server and the browser. */
export async function disablePushSubscription(apiFetch: AdminFetch = fetch): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  try {
    await adminRequest(apiFetch, SUBSCRIPTIONS_URL, jsonMutation("DELETE", { endpoint: subscription.endpoint }));
  } catch (error) {
    // Already gone on the server: still drop the browser side.
    if (!(error instanceof AdminApiError && error.status === 404)) throw error;
  }
  await subscription.unsubscribe();
}

/** Short device label such as "Safari · iPhone" from a stored user agent. */
export function describeUserAgent(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const os = /iPhone/.test(userAgent) ? "iPhone" : /iPad/.test(userAgent) ? "iPad" : /Android/.test(userAgent) ? "Android"
    : /Windows/.test(userAgent) ? "Windows" : /Mac OS X|Macintosh/.test(userAgent) ? "macOS" : /CrOS/.test(userAgent) ? "ChromeOS" : /Linux/.test(userAgent) ? "Linux" : null;
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\/|FxiOS/.test(userAgent) ? "Firefox" : /OPR\//.test(userAgent) ? "Opera"
    : /Chrome\/|CriOS/.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : null;
  const label = [browser, os].filter(Boolean).join(" · ");
  return label || null;
}
