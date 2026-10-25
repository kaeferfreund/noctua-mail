import { imapLoginAvailable } from "@/lib/imapLoginPolicy";
import { NextResponse } from "next/server";
import { getUserById } from "@/lib/serverDb";
import { ensureActiveAccountId, requireActiveUserSession, withAuthResponse } from "@/lib/auth";
import { SESSION_IDLE_TIMEOUT_SECONDS } from "@/lib/betterAuth";
import { sanitizeAccessEntriesForClient } from "@/lib/accountPresentation";

export async function GET(request: Request) {
  const session = await requireActiveUserSession(request, { allowRestricted: true });
  if (session instanceof NextResponse) return session;
  return withAuthResponse(session, async () => {
    const user = await getUserById(session.userId);
    if (!user) return NextResponse.json({ok:false,message:"Unauthorized"},{status:401});
    const restricted = session.enrollmentRequired || session.reauthRequired;
    const selection = restricted ? { mailboxState: "enrollment", accountId: null, access: null } : await ensureActiveAccountId(session);
    return NextResponse.json({ ok: true,
      user: restricted ? { id: user.id, email: user.email, name:user.name, uiLocale: user.uiLocale } : user,
      // The mailbox list is the access read taken after the selection write; no second rebuild.
      accountId: selection.accountId, accounts: selection.access ? sanitizeAccessEntriesForClient(session.userId, selection.access.entries) : [],
      exp: Math.floor(session.expiresAt / 1000), ttlSeconds: SESSION_IDLE_TIMEOUT_SECONDS,
      mailboxState: selection.mailboxState,
      security: { imapLoginAvailable: imapLoginAvailable(), hasPassword: user.hasPassword,
        enrollmentRequired: session.enrollmentRequired, reauthRequired: session.reauthRequired,
        ...(session.securityCode ? { code: session.securityCode } : {}) } });
  });
}
