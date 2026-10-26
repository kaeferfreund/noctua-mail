import { NextResponse } from "next/server";
import { readAuthJson } from "@/app/api/_helpers/readAuthJson";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { getRunningBuild } from "@/lib/buildVersionFile";
import { sanitizeClientErrorReport } from "@/lib/clientErrors";
import { createRateLimiter } from "@/lib/rateLimit";

const perSession = createRateLimiter({ windowMs: 60_000, max: 10 });
const noStore = { "Cache-Control": "no-store" };

/**
 * A crashed browser UI reports here, so the crash leaves one line in the server
 * log (journalctl). Signed-in sessions only, including restricted ones (a crash
 * on the security screens counts as well); the body is capped at 16 KB.
 */
export async function POST(request: Request) {
  const originError = requireJsonSameOrigin(request);
  if (originError) return originError;
  const session = await requireActiveUserSession(request, { allowRestricted: true });
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    if (perSession.isLimited(session.sessionId)) {
      return NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429, headers: { ...noStore, "Retry-After": "60" } });
    }
    const payload = await readAuthJson(request).catch(() => null);
    if (payload instanceof NextResponse) return payload;
    const report = sanitizeClientErrorReport(payload);
    if (!report) return NextResponse.json({ ok: false, code: "invalid_request" }, { status: 400, headers: noStore });
    console.error("[client] crash", JSON.stringify({ ...report, userId: session.userId, serverBuild: getRunningBuild().label }));
    return new NextResponse(null, { status: 204, headers: noStore });
  });
}
