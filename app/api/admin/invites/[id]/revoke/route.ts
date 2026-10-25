import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { revokeInviteCode } from "@/lib/db";
import { requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { requireAdminSessionOr403 } from "../../../_auth";

/** Revokes one still-issued invite, addressed by its history id (never by the code). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = await requireBodylessSameOrigin(request); if (origin) return origin;
  const auth = await requireAdminSessionOr403(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  return withAuthResponse(auth, async () => await revokeInviteCode(id, auth.userId)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, code: "invite_not_issued" }, { status: 409 }));
}
