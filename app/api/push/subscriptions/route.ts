import { okResponse } from "@/app/api/_helpers/response";
import { isAllowedPushEndpoint, readPushConfig } from "@/lib/push/server";
import { parsePushDeviceSettings } from "@/lib/push/settings";
import {
  deleteOwnPushSubscription,
  listPushSubscriptionsForUser,
  toPushSubscriptionSummary,
  upsertPushSubscription
} from "@/lib/push/subscriptions";
import type { PushDeviceSettings } from "@/lib/push/types";
import { invalidPushBody, pushNotConfigured, pushRoute, readPushBody, unknownPushDevice } from "../_shared";

const BODY_KEYS = new Set(["subscription", "settings", "userAgent"]);
const SUBSCRIPTION_KEYS = new Set(["endpoint", "keys", "expirationTime"]);
const USER_AGENT_MAX = 512;

function base64UrlBytes(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]+={0,2}$/.test(value) ? Buffer.from(value, "base64url").length : -1;
}

/** PushSubscriptionJSON with a push-service endpoint, a P-256 key (65 bytes) and a 16-byte auth secret. */
function parseSubscription(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => SUBSCRIPTION_KEYS.has(key))) return null;
  const keys = record.keys as Record<string, unknown> | undefined;
  if (typeof record.endpoint !== "string" || !isAllowedPushEndpoint(record.endpoint)) return null;
  if (!keys || typeof keys !== "object" || base64UrlBytes(keys.p256dh) !== 65 || base64UrlBytes(keys.auth) !== 16) return null;
  return { endpoint: record.endpoint, p256dh: keys.p256dh as string, auth: keys.auth as string };
}

export async function GET(request: Request) {
  return pushRoute(request, "none", async (session) =>
    okResponse({ subscriptions: (await listPushSubscriptionsForUser(session.userId)).map(toPushSubscriptionSummary) }));
}

export async function POST(request: Request) {
  return pushRoute(request, "json", async (session) => {
    if (!readPushConfig()) return pushNotConfigured();
    const body = await readPushBody(request);
    if (body instanceof Response) return body;
    if (!Object.keys(body).every((key) => BODY_KEYS.has(key))) return invalidPushBody();
    const subscription = parseSubscription(body.subscription);
    let settings: PushDeviceSettings | undefined;
    if (body.settings !== undefined) {
      const parsed = parsePushDeviceSettings(body.settings);
      if (!parsed) return invalidPushBody();
      settings = parsed;
    }
    if (!subscription || (body.userAgent !== undefined && typeof body.userAgent !== "string")) return invalidPushBody();
    const userAgent = ((body.userAgent as string | undefined) ?? request.headers.get("user-agent") ?? "").slice(0, USER_AGENT_MAX) || null;
    const stored = await upsertPushSubscription({ userId: session.userId, ...subscription, userAgent, settings });
    return okResponse({ id: stored.id, settings: stored.settings });
  });
}

/** The client's own endpoint, e.g. after `PushSubscription.unsubscribe()`. */
export async function DELETE(request: Request) {
  return pushRoute(request, "json", async (session) => {
    const body = await readPushBody(request);
    if (body instanceof Response) return body;
    if (Object.keys(body).length !== 1 || typeof body.endpoint !== "string" || !body.endpoint) return invalidPushBody();
    return await deleteOwnPushSubscription(session.userId, { endpoint: body.endpoint }) ? okResponse() : unknownPushDevice();
  });
}
