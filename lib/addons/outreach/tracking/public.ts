import type { Database } from "bun:sqlite";
import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";
import { outreachAddonEnabled } from "../config";
import { getOutreachDb, outreachDbExists } from "../db";
import { recordTrackingEvent } from "./events";
import { normalizeTrackingIp } from "./ip";
import { httpTarget } from "./rewrite";

const pixel = Uint8Array.from(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64"));
const eventLimiter = createRateLimiter({ max: 120 });
const unknownTokenLookupWindowMs = 60_000;
const maxRememberedUnknownTokens = 4_096;
const unknownTokensByDb = new WeakMap<Database, Map<string, number>>();
const privateHeaders = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };
const tokenPattern = /^[A-Za-z0-9_-]{27}$/;

type Link = { accountId: string; sendId: string; url: string | null };

async function lookupLink(token: string, kind: "open" | "click"): Promise<Link | null> {
  if (!tokenPattern.test(token)) return null;
  const db = await getOutreachDb();
  let unknown = unknownTokensByDb.get(db);
  if (!unknown) {
    unknown = new Map();
    unknownTokensByDb.set(db, unknown);
  }
  // Give each unknown token one lookup per window while remembered, independent
  // of the event budget. First-seen guesses still need an indexed probe.
  const key = `${kind}:${token}`;
  const now = Date.now();
  if ((unknown.get(key) ?? 0) > now) return null;
  unknown.delete(key);

  // The unique capability identifies its mailbox. Join to its owning send.
  const link = db.prepare(`SELECT l.accountId, l.sendId, l.url
    FROM tracking_links l JOIN sends s ON s.accountId = l.accountId AND s.id = l.sendId
    WHERE l.token = ? AND l.kind = ?`).get(token, kind) as Link | null;
  if (!link) {
    if (unknown.size >= maxRememberedUnknownTokens) unknown.delete(unknown.keys().next().value!);
    unknown.set(key, now + unknownTokenLookupWindowMs);
  }
  return link;
}

function notFound(request: Request) {
  return new Response(request.method === "HEAD" ? null : "Not found", { status: 404, headers: privateHeaders });
}

async function observe(request: Request, link: Link, kind: "open" | "click", token: string) {
  const ip = normalizeTrackingIp(getRequestIp(request));
  if (eventLimiter.isLimited(ip ?? "unknown")) return;
  try {
    await recordTrackingEvent({ accountId: link.accountId, sendId: link.sendId, linkToken: token, type: kind, ip, userAgent: request.headers.get("user-agent"),
      detail: { requestMethod: request.method } });
  } catch {
    console.warn("[outreach] Could not store tracking event");
  }
}

/**
 * Mail that was already sent stays usable when the addon is switched off later: as long as its
 * database is there, links redirect and the pixel answers, and nothing is recorded. An
 * installation that never used the addon has no database and answers 404 as before.
 */
export function servesDeliveredMail() {
  return outreachAddonEnabled() || outreachDbExists();
}

export async function trackingOpenResponse(request: Request, filename: string) {
  if (!servesDeliveredMail() || !filename.endsWith(".gif")) return notFound(request);
  // Switched off: the same image, no lookup, no event.
  if (outreachAddonEnabled()) {
    try {
      const token = filename.slice(0, -4);
      const link = await lookupLink(token, "open");
      if (link) await observe(request, link, "open", token);
    } catch {
      console.warn("[outreach] Could not resolve tracking pixel");
    }
  }
  return new Response(request.method === "HEAD" ? null : pixel, {
    headers: { ...privateHeaders, "Content-Type": "image/gif", "Content-Length": String(pixel.length) }
  });
}

export async function trackingClickResponse(request: Request, token: string) {
  if (!servesDeliveredMail()) return notFound(request);
  try {
    const link = await lookupLink(token, "click");
    const target = link?.url && httpTarget(link.url);
    if (!link || !target) return notFound(request);
    // Switched off: the stored target still works, the click is not recorded.
    if (outreachAddonEnabled()) await observe(request, link, "click", token);
    return new Response(null, { status: 302, headers: { ...privateHeaders, Location: target.href } });
  } catch {
    console.warn("[outreach] Could not resolve tracking link");
    return notFound(request);
  }
}
