import { NextResponse } from "next/server";
import { getUserById } from "@/lib/serverDb";
import { ensureActiveAccountId, requireActiveUserSession, withAuthResponse, SESSION_TTL_SECONDS } from "@/lib/auth";
import { sanitizeAccountsForClient } from "@/lib/accountPresentation";

export async function GET(request: Request) {
  const session = await requireActiveUserSession(request, { allowRestricted: true });
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const user = await getUserById(session.userId);
    if (!user) return NextResponse.json({ok:false,message:"Unauthorized"},{status:401});
    const restricted = session.enrollmentRequired || session.reauthRequired;
    const selection = restricted ? { mailboxState: "enrollment", accountId: null, accounts: [] } : await ensureActiveAccountId(session);
    return NextResponse.json({ ok: true,
      user: restricted ? { id: user.id, email: user.email, name:user.name } : user,
      accountId: selection.accountId, accounts: restricted ? [] : await sanitizeAccountsForClient(session.userId),
      exp: Math.floor(session.expiresAt / 1000), ttlSeconds: SESSION_TTL_SECONDS,
      mailboxState: selection.mailboxState,
      security: { enrollmentRequired: session.enrollmentRequired, reauthRequired: session.reauthRequired,
        ...(session.securityCode ? { code: session.securityCode } : {}) } });
  });
}
