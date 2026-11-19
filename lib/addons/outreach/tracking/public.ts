import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";
import { outreachAddonEnabled } from "../config";
import { getOutreachDb } from "../db";
import { recordTrackingEvent } from "./events";
import { normalizeTrackingIp } from "./ip";
import { httpTarget } from "./rewrite";

const pixel = Uint8Array.from(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==", "base64"));
const limiter = createRateLimiter({ max: 120 });
const privateHeaders = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };
const tokenPattern = /^[A-Za-z0-9_-]{27}$/;

type Link = { accountId: string; sendId: string; contactId: string | null; url: string | null };

async function lookupLink(token: string, kind: "open" | "click"): Promise<Link | null> {
  if (!tokenPattern.test(token)) return null;
  const db = await getOutreachDb();
  // The globally unique capability identifies its mailbox. Join to the send
  // with that accountId so stale tokens cannot outlive their owning row.
  return db.prepare(`SELECT l.accountId, l.sendId, COALESCE(l.contactId, s.contactId) AS contactId, l.url
    FROM tracking_links l JOIN sends s ON s.accountId = l.accountId AND s.id = l.sendId
    WHERE l.token = ? AND l.kind = ?`).get(token, kind) as Link | null;
}

function notFound(request: Request) {
  return new Response(request.method === "HEAD" ? null : "Not found", { status: 404, headers: privateHeaders });
}

async function observe(request: Request, link: Link, kind: "open" | "click", ip: string | null, url: string | null) {
  try {
    await recordTrackingEvent({ ...link, type: kind, ip, url, userAgent: request.headers.get("user-agent"),
      detail: { requestMethod: request.method } });
  } catch {
    console.warn("[outreach] Could not store tracking event");
  }
}

export async function trackingOpenResponse(request: Request, filename: string) {
  if (!outreachAddonEnabled() || !filename.endsWith(".gif")) return notFound(request);
  try {
    const ip = normalizeTrackingIp(getRequestIp(request));
    if (!limiter.isLimited(ip ?? "unknown")) {
      const link = await lookupLink(filename.slice(0, -4), "open");
      if (link) await observe(request, link, "open", ip, null);
    }
  } catch {
    console.warn("[outreach] Could not resolve tracking pixel");
  }
  return new Response(request.method === "HEAD" ? null : pixel, {
    headers: { ...privateHeaders, "Content-Type": "image/gif", "Content-Length": String(pixel.length) }
  });
}

export async function trackingClickResponse(request: Request, token: string) {
  if (!outreachAddonEnabled()) return notFound(request);
  try {
    const link = await lookupLink(token, "click");
    const target = link?.url && httpTarget(link.url);
    if (!link || !target) return notFound(request);
    const ip = normalizeTrackingIp(getRequestIp(request));
    if (!limiter.isLimited(ip ?? "unknown")) await observe(request, link, "click", ip, link.url);
    return new Response(null, { status: 302, headers: { ...privateHeaders, Location: target.href } });
  } catch {
    console.warn("[outreach] Could not resolve tracking link");
    return notFound(request);
  }
}
