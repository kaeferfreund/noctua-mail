import { NextResponse } from "next/server";
import { requireAdminSessionOr403 } from "../_auth";
import { withAuthResponse } from "@/lib/auth";
import { listSpamRescanActivity } from "@/lib/mail/spam/rescan";

/** Running mailbox rescans and moves for the activity panel (admin only; ids and progress, no mail data). */
export async function GET(request: Request) {
  const session = await requireAdminSessionOr403(request); if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () =>
    NextResponse.json({ ok: true, jobs: await listSpamRescanActivity() }, { headers: { "Cache-Control": "no-store" } }));
}
