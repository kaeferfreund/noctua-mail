import { NextResponse } from "next/server";
import { getAuth, setActiveAccountId } from "@/lib/betterAuth";
import { requireActiveUserSession, requireAccountAccessOr403, withAuthResponse } from "@/lib/auth";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";

export async function POST(request: Request) {
  const error = requireJsonSameOrigin(request);
  if (error) return error;
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const payload = await request.json().catch(() => null) as { accountId?: unknown } | null;
    const accountId = typeof payload?.accountId === "string" ? payload.accountId.trim() : "";
    if (!accountId) return NextResponse.json({ok:false,message:"Missing accountId"},{status:400});
    const access = await requireAccountAccessOr403(session, accountId);
    if (access instanceof NextResponse) return access;
    const updated = await setActiveAccountId(await getAuth(), session.sessionToken, accountId);
    if (!updated) return NextResponse.json({ok:false,message:"Unauthorized"},{status:401});
    const stillAllowed = await requireAccountAccessOr403(session, accountId);
    if (stillAllowed instanceof NextResponse) {
      await setActiveAccountId(await getAuth(), session.sessionToken, null);
      return stillAllowed;
    }
    return NextResponse.json({ok:true,accountId});
  });
}
