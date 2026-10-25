import { NextResponse } from "next/server";
import { createRateLimiter, getRequestIp } from "@/lib/rateLimit";

/** Shared by the admin rescan routes (doc/SPAM-DETECTION.md, „Posteingang jetzt prüfen“). */
// Next route bundles may load independent module graphs in the same server process.
const limitsKey = Symbol.for("noctua.spamRescanLimits");
type Limits = { actor: ReturnType<typeof createRateLimiter>; ip: ReturnType<typeof createRateLimiter> };
const shared = globalThis as typeof globalThis & { [limitsKey]?: Limits };
const limits = shared[limitsKey] ??= {
  actor: createRateLimiter({ windowMs: 60_000, max: 10 }),
  ip: createRateLimiter({ windowMs: 60_000, max: 30 })
};

export function spamRescanFailure(status: number, code: string, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, code }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** Start, cancel and move: 10 per minute per admin, 30 per IP. */
export function spamRescanRateLimited(request: Request, userId: string) {
  const actor = limits.actor.isLimited(userId), ip = limits.ip.isLimited(getRequestIp(request));
  return actor || ip ? spamRescanFailure(429, "rate_limited", { "Retry-After": "60" }) : null;
}
