import { createVerify, X509Certificate } from "node:crypto";
import { BodyReadTimeoutError, readBoundedBody } from "@/app/api/_helpers/readAuthJson";
import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";
import { outreachAddonEnabled } from "@/lib/addons/outreach/config";
import { applySesEvent } from "@/lib/addons/outreach/sending/sesEvents";
import { z } from "zod";

const maxBodyBytes = 256 * 1024;
const topicRegion = /^arn:aws:sns:([a-z0-9-]+):\d{12}:[A-Za-z0-9_.-]+$/;
const envelope = z.object({
  TopicArn: z.string(), MessageId: z.guid(), Message: z.string(), Timestamp: z.iso.datetime(),
  SignatureVersion: z.enum(["1", "2"]), Signature: z.string().min(1).max(1024).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  SigningCertURL: z.string().max(2048), Type: z.enum(["Notification", "SubscriptionConfirmation", "UnsubscribeConfirmation"]),
  Subject: z.string().optional(), SubscribeURL: z.string().max(4096).optional(), Token: z.string().optional()
});
type Envelope = z.infer<typeof envelope>;
type SnsFetch = (url: URL, init: RequestInit) => Promise<Response>;

function snsUrl(value: string | undefined, hostname: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === hostname && !url.port && !url.username && !url.password && !url.hash ? url : null;
  } catch {
    return null;
  }
}

function signedContent(message: Envelope) {
  const fields = message.Type === "Notification"
    ? (["Message", "MessageId", ...(message.Subject === undefined ? [] : ["Subject"] as const), "Timestamp", "TopicArn", "Type"] as const)
    : (["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"] as const);
  return fields.map(field => `${field}\n${message[field]}\n`).join("");
}

export function createSnsVerifier(now: () => number = Date.now) {
  const cache = new Map<string, { expires: number; cert: Promise<X509Certificate> }>();
  return async (message: Envelope, url: URL, fetch: SnsFetch) => {
    const at = now();
    const key = url.href;
    let entry = cache.get(key);
    if (!entry || entry.expires <= at) {
      const cert = (async () => {
        const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
        if (!response.ok || Number(response.headers.get("content-length")) > 16_384) throw new Error("SNS certificate unavailable");
        const pem = await response.text();
        if (pem.length > 16_384) throw new Error("SNS certificate too large");
        return new X509Certificate(pem);
      })();
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      entry = { expires: at + 60 * 60_000, cert };
      cache.set(key, entry);
      const pending = entry;
      void cert.catch(() => { if (cache.get(key) === pending) cache.delete(key); });
    }
    const cert = await entry.cert;
    if (at < Date.parse(cert.validFrom) || at >= Date.parse(cert.validTo)) return false;
    try {
      return createVerify(message.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1").update(signedContent(message))
        .verify(cert.publicKey, message.Signature, "base64");
    } catch {
      return false;
    }
  };
}

const limiter = createRateLimiter({ max: 600 });
const globalLimiter = createRateLimiter({ max: 3600 });
const defaults = {
  enabled: outreachAddonEnabled, topic: () => process.env.NOCTUA_OUTREACH_SES_EVENTS_TOPIC_ARN,
  isLimited: (request: Request) => globalLimiter.isLimited("sns") || limiter.isLimited(getRequestIp(request)),
  fetch: globalThis.fetch as SnsFetch, verify: createSnsVerifier(), apply: applySesEvent
};

export function createSnsHandler(deps = defaults) {
  // SNS confirmation itself is idempotent upstream. Coalesce replays locally,
  // including requests that arrive while the confirmation fetch is in flight.
  const confirmations = new Map<string, Promise<void>>();
  return async (request: Request) => {
    const topic = deps.topic();
    if (!deps.enabled() || !topic) return new Response(null, { status: 404 });
    if (deps.isLimited(request)) return new Response(null, { status: 429, headers: { "Retry-After": "60" } });
    let message: Envelope;
    try {
      const bytes = await readBoundedBody(request, maxBodyBytes);
      if (!bytes) return new Response(null, { status: 413 });
      message = envelope.parse(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (error) {
      return new Response(null, { status: error instanceof BodyReadTimeoutError ? 408 : 400 });
    }
    const region = topicRegion.exec(topic)?.[1];
    if (message.TopicArn !== topic || !region) return new Response(null, { status: 403 });
    const host = `sns.${region}.amazonaws.com`;
    const cert = snsUrl(message.SigningCertURL, host);
    if (!cert || cert.search || !/^\/SimpleNotificationService-[a-f0-9]+\.pem$/i.test(cert.pathname)) {
      return new Response(null, { status: 403 });
    }
    if (message.Type !== "Notification" && (!message.Token || !message.SubscribeURL)) return new Response(null, { status: 400 });
    try {
      if (!(await deps.verify(message, cert, deps.fetch))) return new Response(null, { status: 403 });
      if (message.Type === "SubscriptionConfirmation") {
        const target = snsUrl(message.SubscribeURL, host);
        if (!target || target.pathname !== "/" || target.searchParams.get("TopicArn") !== topic
            || target.searchParams.get("Action") !== "ConfirmSubscription" || target.searchParams.get("Token") !== message.Token) {
          return new Response(null, { status: 403 });
        }
        const key = `${topic}/${message.MessageId}`;
        let confirmation = confirmations.get(key);
        if (!confirmation) {
          if (confirmations.size >= 128) confirmations.delete(confirmations.keys().next().value!);
          confirmation = (async () => {
            const response = await deps.fetch(target, { redirect: "error", signal: AbortSignal.timeout(5000) });
            await response.body?.cancel();
            if (!response.ok) throw new Error("SNS confirmation unavailable");
          })();
          confirmations.set(key, confirmation);
          void confirmation.catch(() => { if (confirmations.get(key) === confirmation) confirmations.delete(key); });
        }
        await confirmation;
      } else if (message.Type === "Notification") {
        let notification: unknown;
        try { notification = JSON.parse(message.Message); } catch { return new Response(null, { status: 400 }); }
        await deps.apply(message.MessageId, notification);
      }
      return new Response(null, { status: 200 });
    } catch {
      // SNS retries 5xx. Avoid logging the message, certificate URL or confirmation token.
      return new Response(null, { status: 503 });
    }
  };
}
