import { NextResponse } from "next/server";
import { requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { assertStreamAuthorized } from "@/lib/authStreams";
import { authorizeMailboxSummary, getUserMailboxSummary } from "@/lib/mailboxSummary";

export async function GET(request: Request) {
  const session = await requireActiveUserSession(request);
  if (session instanceof Response) return session;
  return withAuthResponse(session, async () => {
    const summary = await getUserMailboxSummary(session.userId);
    let response: Response;
    try {
      await assertStreamAuthorized(session, db => {
        response = NextResponse.json(authorizeMailboxSummary(db, session.userId, summary), { headers: { "Cache-Control": "no-store" } });
      });
    } catch {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    return response!;
  });
}
