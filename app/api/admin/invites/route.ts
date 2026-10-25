import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { deleteSettledInviteCodes, getInviteHistory, inviteHistoryId, inviteStatus } from "@/lib/db";
import { requireBodylessSameOrigin } from "@/app/api/_helpers/requestOrigin";
import { handleAdminUser } from "../_users";
import { requireAdminSessionOr403 } from "../_auth";

export async function GET(request: Request) {
  const auth = await requireAdminSessionOr403(request);
  if (auth instanceof NextResponse) return auth;
  return withAuthResponse(auth, async () => {

    const invites = await getInviteHistory();
    const now = Date.now();
    const items = invites
      .map(invite => ({ invite, id: inviteHistoryId(invite.code) }))
      .sort((a, b) => b.invite.createdAt - a.invite.createdAt || a.id.localeCompare(b.id))
      .map(({ invite, id }) => {
        return {
          id,
          email: invite.email ?? null,
          // Display label only; operator codes have no issuer, a deleted issuer has no label.
          issuedBy: invite.issuerName ?? invite.issuerEmail,
          issuerDeleted: invite.issuedByUserId != null && invite.issuerEmail === null,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
          status: inviteStatus(invite, now)
        };
      });

    return NextResponse.json({ ok: true, invites: items }, { headers: { "cache-control": "no-store" } });
  });
}

export async function POST(request: Request) {
  return handleAdminUser(request,"generic-invite");
}

/** Clears the history of redeemed, expired and revoked codes; issued codes stay valid. */
export async function DELETE(request: Request) {
  const origin = await requireBodylessSameOrigin(request); if (origin) return origin;
  const auth = await requireAdminSessionOr403(request);
  if (auth instanceof NextResponse) return auth;
  return withAuthResponse(auth, async () => NextResponse.json({ ok: true, deleted: await deleteSettledInviteCodes(auth.userId) }));
}
