import { readAuthJson } from "@/app/api/_helpers/readAuthJson";
import { NextResponse } from "next/server";
import { compareAndSetActiveAccountId, getAuth, setActiveAccountId } from "@/lib/betterAuth";
import { getDb } from "@/lib/db/connection";
import { requireActiveUserSession, requireAccountAccessOr403, withAuthResponse } from "@/lib/auth";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";

export async function POST(request: Request) {
  const error = requireJsonSameOrigin(request);
  if (error) return error;
  const session = await requireActiveUserSession(request);
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const body = await readAuthJson(request).catch(() => null);
    if (body instanceof NextResponse) return body;
    const payload = body as { accountId?: unknown } | null;
    const accountId = typeof payload?.accountId === "string" ? payload.accountId.trim() : "";
    if (!accountId) return NextResponse.json({ok:false,message:"Missing accountId"},{status:400});
    const access = await requireAccountAccessOr403(session, accountId);
    if (access instanceof NextResponse) return access;
    const updated = await setActiveAccountId(await getAuth(), session.sessionToken, accountId);
    if (!updated) return NextResponse.json({ok:false,message:"Unauthorized"},{status:401});
    const stillAllowed = await requireAccountAccessOr403(session, accountId);
    if (stillAllowed instanceof NextResponse) {
      // Undo only this request's write: a switch another tab committed meanwhile passed its own check and stays.
      await compareAndSetActiveAccountId(await getDb(), session.sessionToken, accountId, null);
      return stillAllowed;
    }
    return NextResponse.json({ok:true,accountId});
  });
}
