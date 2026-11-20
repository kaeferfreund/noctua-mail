import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { canOpenUserEventStream, createUserEventStream } from "@/lib/userEvents";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const session = await requireActiveUserSession(request);
  if (session instanceof Response) return session;
  if (!canOpenUserEventStream(session)) {
    // The client retries with backoff; a slot frees when another tab closes its stream.
    return withAuthResponse(session, () => Response.json({ ok: false, message: "Too many event streams" },
      { status: 429, headers: { "retry-after": "30", "cache-control": "no-store" } }));
  }
  return withAuthResponse(session, () => new Response(createUserEventStream(request, session), { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no"
  } }));
}
