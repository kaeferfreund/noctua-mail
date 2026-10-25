import webpush, { WebPushError } from "web-push";

/**
 * VAPID configuration and the web-push transport (doc/PUSH-NOTIFICATIONS.md).
 * Push is disabled unless all three NOCTUA_VAPID_* variables are set and valid.
 */
export type PushVapidConfig = { publicKey: string; privateKey: string; subject: string };

export const PUSH_SEND_TIMEOUT_MS = 10_000;

const BASE64URL = /^[A-Za-z0-9_-]+$/;
const warnedConfigs = new Set<string>();

/** RFC 8292 §2.1: a contact URI, mailto: or https:. */
export function isValidVapidSubject(subject: string) {
  return /^(mailto:\S+@\S+|https:\/\/\S+)$/.test(subject);
}

function base64UrlByteLength(value: string) {
  return BASE64URL.test(value) ? Buffer.from(value, "base64url").length : -1;
}

export function readPushConfig(env: Record<string, string | undefined> = process.env): PushVapidConfig | null {
  const publicKey = env.NOCTUA_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.NOCTUA_VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = env.NOCTUA_VAPID_SUBJECT?.trim() ?? "";
  if (!publicKey && !privateKey && !subject) return null;
  // An uncompressed P-256 point is 65 bytes, the private scalar 32 bytes (RFC 8292).
  const problem = base64UrlByteLength(publicKey) !== 65 ? "NOCTUA_VAPID_PUBLIC_KEY"
    : base64UrlByteLength(privateKey) !== 32 ? "NOCTUA_VAPID_PRIVATE_KEY"
      : !isValidVapidSubject(subject) ? "NOCTUA_VAPID_SUBJECT" : null;
  if (problem) {
    if (!warnedConfigs.has(problem)) {
      warnedConfigs.add(problem);
      console.warn(`[push] ${problem} is missing or invalid; Web Push stays disabled.`);
    }
    return null;
  }
  return { publicKey, privateKey, subject };
}

/**
 * The server POSTs to client-supplied endpoints, so only the hosts of the
 * browser push services are accepted (SSRF guard): Chrome/Edge/Android (FCM),
 * Firefox (Mozilla autopush), Safari/iOS (APNs web push), legacy Edge (WNS).
 */
const PUSH_SERVICE_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
/** WNS uses regional hosts such as wns2-par02p.notify.windows.com. */
const PUSH_SERVICE_HOST_SUFFIXES = [".notify.windows.com"];

export function isAllowedPushEndpoint(endpoint: string) {
  if (endpoint.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  // Defence in depth (review-r1 P1): web-push's HTTP client may parse an unusual
  // authority differently from the URL parser, e.g. "127.0.0.1;.fcm.googleapis.com".
  // Only plain DNS hostnames pass, and the raw authority must be exactly that host.
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(host)) return false;
  const rawAuthority = endpoint.slice("https://".length).split(/[/?#]/, 1)[0];
  if (rawAuthority.toLowerCase() !== host) return false;
  return PUSH_SERVICE_HOSTS.has(host) || PUSH_SERVICE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix) && host.length > suffix.length);
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushSendOptions = { ttlSeconds: number; urgency: "very-low" | "low" | "normal" | "high"; topic?: string };
export type PushDelivery = { ok: true } | { ok: false; gone: boolean; statusCode?: number; error: string };
export type PushTransport = (target: PushTarget, payload: string, options: PushSendOptions) => Promise<PushDelivery>;

export function createWebPushTransport(config: PushVapidConfig, timeoutMs = PUSH_SEND_TIMEOUT_MS): PushTransport {
  return async (target, payload, options) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Push request timed out")), timeoutMs);
    });
    try {
      await Promise.race([
        webpush.sendNotification({ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } }, payload, {
          vapidDetails: config,
          TTL: options.ttlSeconds,
          urgency: options.urgency,
          topic: options.topic,
          timeout: timeoutMs
        }),
        deadline
      ]);
      return { ok: true };
    } catch (error) {
      const statusCode = error instanceof WebPushError ? error.statusCode : undefined;
      return {
        ok: false,
        gone: statusCode === 404 || statusCode === 410,
        statusCode,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      clearTimeout(timer);
    }
  };
}
