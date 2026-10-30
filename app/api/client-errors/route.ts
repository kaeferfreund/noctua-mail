import { NextResponse } from "next/server";
import { readAuthJson } from "@/app/api/_helpers/readAuthJson";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { getRunningBuild } from "@/lib/buildVersionFile";
import { sanitizeClientErrorReport } from "@/lib/clientErrors";
import { createRateLimiter } from "@/lib/rateLimit";

const perSession = createRateLimiter({ windowMs: 60_000, max: 10 });
// A blank screen repeats on every Back and reload: one line per minute is enough.
const blankPerSession = createRateLimiter({ windowMs: 60_000, max: 1 });
// Notification taps: evidence of which path opened the message, not a stream of events.
const notificationOpenPerSession = createRateLimiter({ windowMs: 60_000, max: 1 });
const noStore = { "Cache-Control": "no-store" };
const limited = () => NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429, headers: { ...noStore, "Retry-After": "60" } });

/**
 * A crashed browser UI reports here, so the crash leaves one line in the server
 * log (journalctl). Signed-in sessions only, including restricted ones (a crash
 * on the security screens counts as well); the body is capped at 16 KB. The blank-screen
 * watchdog uses the same route and logs as `[client] blank`, a notification tap as
 * `[client] notification-open`.
 */
export async function POST(request: Request) {
  const originError = requireJsonSameOrigin(request);
  if (originError) return originError;
  const session = await requireActiveUserSession(request, { allowRestricted: true });
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    if (perSession.isLimited(session.sessionId)) return limited();
    const payload = await readAuthJson(request).catch(() => null);
    if (payload instanceof NextResponse) return payload;
    const report = sanitizeClientErrorReport(payload);
    if (!report) return NextResponse.json({ ok: false, code: "invalid_request" }, { status: 400, headers: noStore });
    if (report.kind === "blank-screen" && blankPerSession.isLimited(session.sessionId)) return limited();
    if (report.kind === "notification-open" && notificationOpenPerSession.isLimited(session.sessionId)) return limited();
    const label = report.kind === "blank-screen" ? "[client] blank" : report.kind === "notification-open" ? "[client] notification-open" : "[client] crash";
    console.error(label, JSON.stringify({ ...report, userId: session.userId, serverBuild: getRunningBuild().label }));
    return new NextResponse(null, { status: 204, headers: noStore });
  });
}
