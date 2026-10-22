import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getInviteCodes, getUsers } from "@/lib/db";
import { handleAdminUser } from "../_users";
import { requireAdminSessionOr403 } from "../_auth";

export async function GET(request: Request) {
  const auth = await requireAdminSessionOr403(request);
  if (auth instanceof NextResponse) return auth;
  return withAuthResponse(auth, async () => {

    const [invites, users] = await Promise.all([getInviteCodes(), getUsers()]);
    const userById = new Map(users.map((user) => [user.id, user]));
    const items = [...invites]
      .sort((a, b) => {
        const createdAtDiff = b.createdAt - a.createdAt;
        if (createdAtDiff !== 0) return createdAtDiff;
        return a.code.localeCompare(b.code);
      })
      .map((invite) => {
        const usedBy = invite.usedByUserId ? userById.get(invite.usedByUserId) : undefined;
        return {
          ...invite,
          isUsed: invite.uses > 0,
          usedByUserEmail: usedBy?.email ?? null
        };
      });

    return NextResponse.json({ ok: true, invites: items });
  });
}

export async function POST(request: Request) {
  return handleAdminUser(request,"generic-invite");
}
