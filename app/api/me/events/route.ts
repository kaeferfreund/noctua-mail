import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { createUserEventStream } from "@/lib/userEvents";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const session = await requireActiveUserSession(request);
  if (session instanceof Response) return session;
  return withAuthResponse(session, () => new Response(createUserEventStream(request, session), { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no"
  } }));
}
