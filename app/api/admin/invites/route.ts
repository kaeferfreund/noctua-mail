import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getInviteCodes } from "@/lib/db";
import { createHash } from "node:crypto";
import { handleAdminUser } from "../_users";
import { requireAdminSessionOr403 } from "../_auth";

export async function GET(request: Request) {
  const auth = await requireAdminSessionOr403(request);
  if (auth instanceof NextResponse) return auth;
  return withAuthResponse(auth, async () => {

    const invites = await getInviteCodes();
    const now = Date.now();
    const items = [...invites]
      .sort((a, b) => {
        const createdAtDiff = b.createdAt - a.createdAt;
        if (createdAtDiff !== 0) return createdAtDiff;
        return inviteId(a.code).localeCompare(inviteId(b.code));
      })
      .map((invite) => {
        return {
          id: inviteId(invite.code),
          email: invite.email ?? null,
          issuedBy: invite.issuedByUserId ?? null,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          status: invite.uses > 0 ? "redeemed" : invite.revokedAt != null ? "revoked" : invite.expiresAt != null && invite.expiresAt <= now ? "expired" : "issued"
        };
      });

    return NextResponse.json({ ok: true, invites: items }, { headers: { "cache-control": "no-store" } });
  });
}

// Stable history identity, deliberately unrelated to the redeemable capability's format.
function inviteId(code: string) {
  return createHash("sha256").update(`noctua-invite-history:${code}`).digest("hex");
}

export async function POST(request: Request) {
  return handleAdminUser(request,"generic-invite");
}
